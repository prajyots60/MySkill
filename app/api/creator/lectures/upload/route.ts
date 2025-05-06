import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { getYouTubeClient, uploadVideoToYouTube } from "@/lib/youtube"
import { v4 as uuidv4 } from "uuid"

// Store upload jobs in memory (in production, use a proper job queue)
const uploadJobs = new Map()

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can upload videos" }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const sectionId = formData.get("sectionId") as string
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const isPreview = formData.get("isPreview") === "true"
    const videoFile = formData.get("videoFile") as File

    if (!sectionId || !title || !videoFile) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    // Get the section and its course to check permissions
    const section = await prisma.section.findUnique({
      where: {
        id: sectionId,
      },
      include: {
        content: {
          select: {
            id: true,
            creatorId: true,
            title: true,
            tags: true,
          },
        },
      },
    })

    if (!section) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 })
    }

    // Check if user is the creator or an admin
    const isCreator = section.content.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { message: "You don't have permission to upload videos to this section" },
        { status: 403 },
      )
    }

    // Generate a unique job ID
    const jobId = uuidv4()

    // Store job information
    uploadJobs.set(jobId, {
      status: "uploading",
      progress: 0,
      title,
      sectionId,
      description,
      isPreview,
      videoFile,
      userId: session.user.id,
      contentId: section.content.id,
      createdAt: new Date(),
    })

    // Also store in Redis for persistence
    await redis.set(
      `upload:${jobId}`,
      JSON.stringify({
        status: "uploading",
        progress: 0,
        title,
        sectionId,
        description,
        isPreview,
        userId: session.user.id,
        contentId: section.content.id,
        createdAt: new Date().toISOString(),
      }),
      { ex: 86400 },
    ) // Expire after 24 hours

    // Start background processing
    processVideoUpload(jobId).catch((error) => {
      console.error("Error processing video upload:", error)
      uploadJobs.set(jobId, {
        ...uploadJobs.get(jobId),
        status: "failed",
        error: error.message || "Failed to process video upload",
      })

      // Update Redis with error
      redis
        .set(
          `upload:${jobId}`,
          JSON.stringify({
            ...uploadJobs.get(jobId),
            status: "failed",
            error: error.message || "Failed to process video upload",
          }),
          { ex: 86400 },
        )
        .catch(console.error)
    })

    // Return immediately with the job ID
    return NextResponse.json({
      success: true,
      jobId,
      message: "Video upload started in the background",
    })
  } catch (error) {
    console.error("Error starting video upload:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to start video upload" },
      { status: 500 },
    )
  }
}

// Function to process video upload in the background
async function processVideoUpload(jobId: string) {
  try {
    // Check if job exists in memory
    const job = uploadJobs.get(jobId)
    if (!job) {
      throw new Error("Job not found")
    }

    // Check if job has been canceled
    const redisJob = await redis.get(`upload:${jobId}`)
    if (!redisJob) {
      // Job was canceled, clean up memory
      uploadJobs.delete(jobId)
      return
    }

    // Update job status to processing
    uploadJobs.set(jobId, { ...job, status: "processing", progress: 10 })
    await redis.set(`upload:${jobId}`, JSON.stringify({ ...job, status: "processing", progress: 10 }), { ex: 86400 })

    // Get YouTube client
    const youtube = await getYouTubeClient(job.userId)

    // Check if job has been canceled before proceeding
    const checkCanceled = await redis.get(`upload:${jobId}`)
    if (!checkCanceled) {
      // Job was canceled, clean up memory
      uploadJobs.delete(jobId)
      return
    }

    // Convert File to Buffer
    const arrayBuffer = await job.videoFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to YouTube
    const videoData = await uploadVideoToYouTube(job.userId, {
      title: job.title,
      description: job.description || "",
      videoFile: buffer,
      isPrivate: true, // Always upload as unlisted for security
    })

    // Check if job has been canceled before proceeding
    const checkCanceled2 = await redis.get(`upload:${jobId}`)
    if (!checkCanceled2) {
      // Job was canceled, clean up memory
      uploadJobs.delete(jobId)
      return
    }

    // Update job status to processing
    uploadJobs.set(jobId, { ...job, status: "processing", progress: 50 })
    await redis.set(`upload:${jobId}`, JSON.stringify({ ...job, status: "processing", progress: 50 }), { ex: 86400 })

    // Get the highest order and add 1
    const highestOrderLecture = await prisma.lecture.findFirst({
      where: {
        sectionId: job.sectionId,
      },
      orderBy: {
        order: "desc",
      },
      select: {
        order: true,
      },
    })

    const order = highestOrderLecture ? highestOrderLecture.order + 1 : 0

    // Create lecture in database
    const lecture = await prisma.lecture.create({
      data: {
        title: job.title,
        description: job.description || "",
        type: "VIDEO",
        videoId: videoData.id,
        duration: Number.parseInt(videoData.contentDetails?.duration || "0", 10),
        isPreview: job.isPreview,
        order,
        section: {
          connect: { id: job.sectionId },
        },
      },
    })

    // Check if job has been canceled before proceeding
    const checkCanceled3 = await redis.get(`upload:${jobId}`)
    if (!checkCanceled3) {
      // Job was canceled, but lecture was already created
      // We'll keep the lecture but mark the job as canceled
      uploadJobs.delete(jobId)
      return
    }

    // Update job status to completed
    uploadJobs.set(jobId, {
      ...job,
      status: "completed",
      progress: 100,
      lectureId: lecture.id,
      videoId: videoData.id,
    })

    // Update Redis with completed status
    await redis.set(
      `upload:${jobId}`,
      JSON.stringify({
        ...job,
        status: "completed",
        progress: 100,
        lectureId: lecture.id,
        videoId: videoData.id,
      }),
      { ex: 86400 },
    )
  } catch (error) {
    console.error("Error processing video upload:", error)

    // Update job status to failed
    const job = uploadJobs.get(jobId)
    if (job) {
      uploadJobs.set(jobId, {
        ...job,
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to process video upload",
      })

      // Update Redis with error
      await redis.set(
        `upload:${jobId}`,
        JSON.stringify({
          ...job,
          status: "failed",
          error: error instanceof Error ? error.message : "Failed to process video upload",
        }),
        { ex: 86400 },
      )
    }

    throw error
  }
}

// Endpoint to check upload status
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get("jobId")

    if (!jobId) {
      return NextResponse.json({ message: "Job ID is required" }, { status: 400 })
    }

    // Check if job exists in memory
    const job = uploadJobs.get(jobId)

    if (job) {
      return NextResponse.json({
        success: true,
        job: {
          id: jobId,
          status: job.status,
          progress: job.progress,
          title: job.title,
          error: job.error,
          lectureId: job.lectureId,
          videoId: job.videoId,
        },
      })
    }

    // If not in memory, check Redis
    const redisJob = await redis.get(`upload:${jobId}`)

    if (redisJob) {
      return NextResponse.json({
        success: true,
        job: typeof redisJob === "string" ? JSON.parse(redisJob) : redisJob,
      })
    }

    return NextResponse.json({ message: "Job not found" }, { status: 404 })
  } catch (error) {
    console.error("Error checking upload status:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to check upload status" },
      { status: 500 },
    )
  }
}

// Endpoint to cancel an upload and delete the YouTube video
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get("jobId")

    if (!jobId) {
      return NextResponse.json({ message: "Job ID is required" }, { status: 400 })
    }

    // Get job details from memory or Redis
    let job = uploadJobs.get(jobId)
    let videoId = job?.videoId
    let userId = job?.userId
    let lectureId = job?.lectureId

    // If not in memory, check Redis
    if (!job) {
      const redisJobData = await redis.get(`upload:${jobId}`)
      if (redisJobData) {
        try {
          const redisJob = JSON.parse(redisJobData as string)
          videoId = redisJob.videoId
          userId = redisJob.userId
          lectureId = redisJob.lectureId
        } catch (err) {
          console.error("Error parsing Redis job data:", err)
        }
      }
    }

    // If video has been uploaded to YouTube, delete it
    if (videoId && userId) {
      try {
        // Import the YouTube deletion function
        const { deleteVideoFromYouTube } = await import("@/lib/youtube")
        
        // Delete from YouTube
        await deleteVideoFromYouTube(userId, videoId)
        console.log(`Deleted YouTube video: ${videoId} for job: ${jobId}`)
      } catch (err) {
        console.error(`Error deleting YouTube video ${videoId}:`, err)
        // Continue with deletion even if YouTube deletion fails
      }
    }

    // If a lecture was created in the database, delete it
    if (lectureId) {
      try {
        await prisma.lecture.delete({
          where: { id: lectureId }
        })
        console.log(`Deleted lecture: ${lectureId} for job: ${jobId}`)
      } catch (err) {
        console.error(`Error deleting lecture ${lectureId}:`, err)
        // Continue with deletion even if lecture deletion fails
      }
    }

    // Remove from memory
    if (job) {
      uploadJobs.delete(jobId)
    }

    // Remove from Redis
    await redis.del(`upload:${jobId}`)

    return NextResponse.json({
      success: true,
      message: "Upload canceled and video deleted successfully",
      deletedFromYouTube: !!videoId,
      deletedLecture: !!lectureId
    })
  } catch (error) {
    console.error("Error canceling upload:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to cancel upload" },
      { status: 500 }
    )
  }
}
