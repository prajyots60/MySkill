import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import createBatch from "@/lib/utils/db-batch"
import dbMonitoring from "@/lib/db-monitoring"
import { redis } from "@/lib/redis"

// GET - Get progress for a course or lecture - optimized with batching and caching
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get("courseId")
    const lectureId = searchParams.get("lectureId")

    // Different handling for course vs lecture progress
    if (courseId) {
      // Check redis cache first
      const cacheKey = `progress:${session.user.id}:course:${courseId}`
      const cachedData = await redis.get(cacheKey)
      
      if (cachedData) {
        return NextResponse.json(typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData)
      }
      
      // Avoid transaction timeouts by using individual queries instead of batch
      // Get completed lectures for the course
      const completedLectures = await prisma.progress.findMany({
        where: {
          userId: session.user.id,
          isComplete: true,
          lecture: {
            section: {
              contentId: courseId,
            },
          },
        },
        select: {
          lectureId: true,
        },
      })
      
      // Get total lectures in the course
      const totalLectures = await prisma.lecture.count({
        where: {
          section: {
            contentId: courseId,
          },
        },
      })
      
      // Get all section and lecture structure for the course
      const sections = await prisma.section.findMany({
        where: {
          contentId: courseId,
        },
        select: {
          id: true,
          title: true,
          order: true,
        },
        orderBy: {
          order: "asc",
        },
      })
      
      // Get lectures for each section
      const lecturesBySections = await prisma.lecture.findMany({
        where: {
          section: {
            contentId: courseId,
          },
        },
        select: {
          id: true,
          title: true,
          order: true,
          sectionId: true,
        },
        orderBy: {
          order: "asc",
        },
      })
      
      // Map lectures to their sections
      const sectionsWithLectures = sections.map(section => ({
        ...section,
        lectures: lecturesBySections.filter(lecture => lecture.sectionId === section.id)
      }))
      
      // Calculate overall progress percentage
      const completedCount = completedLectures.length
      const percentage = totalLectures > 0 ? Math.round((completedCount / totalLectures) * 100) : 0
      
      // Prepare response data
      const responseData = {
        success: true,
        progress: {
          totalLectures,
          completedLectures: completedCount,
          percentage,
          completedLectureIds: completedLectures.map((l) => l.lectureId),
          sections: sectionsWithLectures,
          nextCourseToTake: null,
        },
      }
      
      // If course is almost complete (> 75%), we'll check for a next course recommendation
      // But do this as a separate operation, not blocking the initial response
      if (percentage > 75) {
        // We'll start an async check, but we won't wait for it
        fetchNextCourseRecommendation(session.user.id, courseId, cacheKey, responseData)
      }
      
      // Cache the response
      await redis.set(cacheKey, JSON.stringify(responseData), { ex: 1800 }) // 30 minutes
      
      return NextResponse.json(responseData)
    } else if (lectureId) {
      // Check redis cache first for lecture progress
      const cacheKey = `progress:${session.user.id}:lecture:${lectureId}`
      const cachedData = await redis.get(cacheKey)
      
      if (cachedData) {
        return NextResponse.json(typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData)
      }
      
      // Get progress for a specific lecture
      const progress = await prisma.progress.findUnique({
        where: {
          userId_lectureId: {
            userId: session.user.id,
            lectureId,
          },
        },
        select: {
          isComplete: true,
          percentage: true,
          timeSpentSeconds: true,
          updatedAt: true,
        },
      })

      const responseData = {
        success: true,
        progress: progress || {
          isComplete: false,
          percentage: 0,
          timeSpentSeconds: 0,
        },
      }
      
      // Cache the response
      await redis.set(cacheKey, JSON.stringify(responseData), { ex: 300 }) // 5 minutes
      
      return NextResponse.json(responseData)
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Missing courseId or lectureId parameter" 
      }, { status: 400 })
    }
  } catch (error) {
    console.error("Error getting progress:", error)
    
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('progress_get_connection_error')
    }
    
    return NextResponse.json({ 
      success: false, 
      message: "Failed to get progress",
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}

// Helper function to asynchronously fetch course recommendations without blocking
async function fetchNextCourseRecommendation(
  userId: string, 
  courseId: string,
  cacheKey: string,
  responseData: any
) {
  try {
    // Try to find a related course from the same creator
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: { creatorId: true, tags: true },
    })
    
    if (course) {
      // Find a related course that user hasn't enrolled in yet
      const relatedCourse = await prisma.content.findFirst({
        where: {
          id: { not: courseId },
          creatorId: course.creatorId,
          isPublished: true,
          enrollments: {
            none: {
              userId,
            },
          },
        },
        select: {
          id: true,
          title: true,
          thumbnail: true,
        },
      })
      
      if (relatedCourse) {
        // Update the cached data with the recommendation
        responseData.progress.nextCourseToTake = relatedCourse
        await redis.set(cacheKey, JSON.stringify(responseData), { ex: 1800 }) // 30 minutes
      }
    }
  } catch (error) {
    console.error("Error fetching course recommendation:", error)
    // Just log the error, don't block the main response
  }
}

// POST - Update progress for a lecture - optimized with batching
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { lectureId, percentage, isComplete, timeSpentSeconds } = body

    if (!lectureId) {
      return NextResponse.json({ success: false, message: "Missing lectureId parameter" }, { status: 400 })
    }
    
    // Check if the request comes from offline sync
    const isOfflineSync = body.isOfflineSync === true
    
    // Create a batch for progress update validation
    const batch = createBatch()
    
    // Get lecture details and course ID
    batch.add(tx => tx.lecture.findUnique({
      where: { id: lectureId },
      include: {
        section: {
          select: {
            contentId: true,
          },
        },
      },
    }))
    
    // Check if user is enrolled
    batch.add(async (tx) => {
      const lectureData = await tx.lecture.findUnique({
        where: { id: lectureId },
        select: { section: { select: { contentId: true } } },
      });
      
      return tx.enrollment.findFirst({
        where: {
          userId: session.user.id,
          contentId: lectureData?.section?.contentId,
        },
        select: { id: true },
      });
    })
    
    // Execute queries in a single transaction
    const [lecture, enrollment] = await batch.execute()

    if (!lecture) {
      return NextResponse.json({ success: false, message: "Lecture not found" }, { status: 404 })
    }

    const courseId = lecture.section.contentId
    
    // If it's not an offline sync, check enrollment
    if (!isOfflineSync && !enrollment && session.user.role !== "ADMIN" && session.user.id !== lecture.section.contentId) {
      return NextResponse.json({ success: false, message: "Not enrolled in this course" }, { status: 403 })
    }

    // Get existing progress to determine if this is a new completion
    const existingProgress = await prisma.progress.findUnique({
      where: {
        userId_lectureId: {
          userId: session.user.id,
          lectureId,
        },
      },
      select: {
        isComplete: true,
      },
    })
    
    const wasAlreadyComplete = existingProgress?.isComplete === true
    const isNewCompletion = isComplete === true && !wasAlreadyComplete
    
    // Update or create progress
    const progress = await prisma.progress.upsert({
      where: {
        userId_lectureId: {
          userId: session.user.id,
          lectureId,
        },
      },
      update: {
        isComplete: isComplete !== undefined ? isComplete : undefined,
        percentage: percentage !== undefined ? percentage : undefined,
        timeSpentSeconds: timeSpentSeconds !== undefined 
          ? { increment: timeSpentSeconds } 
          : undefined,
      },
      create: {
        userId: session.user.id,
        lectureId,
        isComplete: isComplete || false,
        percentage: percentage || 0,
        timeSpentSeconds: timeSpentSeconds || 0,
      },
    })
    
    // If this is a new completion, check if the entire course is completed
    let courseCompleted = false
    if (isNewCompletion) {
      // Batch to check if course is completed
      const checkCompletionBatch = createBatch()
      
      // Get total lectures
      checkCompletionBatch.add(tx => tx.lecture.count({
        where: {
          section: {
            contentId: courseId,
          },
        },
      }))
      
      // Get completed lectures
      checkCompletionBatch.add(tx => tx.progress.count({
        where: {
          userId: session.user.id,
          isComplete: true,
          lecture: {
            section: {
              contentId: courseId,
            },
          },
        },
      }))
      
      // Execute completion check
      const [totalLectures, completedLectures] = await checkCompletionBatch.execute()
      
      courseCompleted = totalLectures > 0 && completedLectures === totalLectures
      
      // If course was completed, update additional stats
      if (courseCompleted) {
        // Update user's total completed courses count
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            // If you have a completedCoursesCount field, increment it
            // completedCoursesCount: { increment: 1 }
          },
        })
      }
    }

    // Invalidate cache
    await redis.del(`student:enrollments:${session.user.id}`)
    
    // Revalidate paths
    revalidatePath(`/content/${courseId}/player/${lectureId}`)
    revalidatePath(`/dashboard/student`)
    revalidatePath(`/dashboard/student/my-courses`)

    return NextResponse.json({
      success: true,
      progress,
      courseCompleted,
    })
  } catch (error) {
    console.error("Error updating progress:", error)
    
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('progress_update_connection_error')
    }
    
    return NextResponse.json({ 
      success: false, 
      message: "Failed to update progress",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
