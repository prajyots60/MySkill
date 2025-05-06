import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis, REDIS_KEYS, invalidateCache } from "@/lib/redis"
import { supabaseAdmin } from "@/lib/supabase"
import { google } from "googleapis"
import { updateLecture } from "@/lib/actions/lecture"

const youtube = google.youtube("v3")

export async function GET(request: Request, { params }: { params: { lectureId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { lectureId } = await params

    // Get the lecture from the database
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        section: {
          include: {
            content: {
              select: {
                id: true,
                creatorId: true,
                price: true,
              },
            },
          },
        },
        documents: true,
      },
    })

    if (!lecture) {
      return NextResponse.json({ message: "Lecture not found" }, { status: 404 })
    }

    // Check if user is the creator or an admin
    const isCreator = lecture.section.content.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"
    const isPreview = lecture.isPreview
    const isFreeCourse = lecture.section.content.price === 0 || lecture.section.content.price === null

    // Allow access if:
    // 1. User is creator/admin
    // 2. Lecture is a preview lecture
    // 3. Course is free
    if (!isCreator && !isAdmin && !isPreview && !isFreeCourse) {
      return NextResponse.json({ message: "You don't have permission to view this lecture" }, { status: 403 })
    }

    return NextResponse.json({ success: true, lecture })
  } catch (error) {
    console.error("Error getting lecture:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to get lecture" },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request, { params }: { params: { lectureId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Properly await the params to avoid the Next.js error
    const { lectureId } = await params
    const { title, description, isPreview } = await request.json()

    // Use the server action to update the lecture
    const result = await updateLecture({
      lectureId,
      title,
      description,
      isPreview,
    })

    if (result.success) {
      return NextResponse.json({ success: true, lecture: result.lecture })
    } else {
      return NextResponse.json({ success: false, message: result.error || "Failed to update lecture" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error updating lecture:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to update lecture" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: { lectureId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Properly await the params to avoid the Next.js error
    const { lectureId } = await params

    // Get the lecture to check ownership
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        section: {
          include: {
            content: true,
          },
        },
        documents: true,
      },
    })

    console.log("Found lecture:", lecture)

    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    // Check if the user owns the course
    if (lecture.section.content.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Delete resources based on lecture type
    if (lecture.type === "VIDEO") {
      // Delete video from Supabase storage
      if (lecture.videoId) {
        const videoPath = lecture.videoId.split("/").pop()
        if (videoPath) {
          console.log("Deleting video from storage:", videoPath)
          const { error: storageError } = await supabaseAdmin.storage
            .from("content")
            .remove([`${session.user.id}/${videoPath}`])

          if (storageError) {
            console.error("Error deleting video from storage:", storageError)
          }
        }
      }
    } else if (lecture.type === "LIVE") {
      // For live lectures, we'll try to delete the YouTube stream if it exists
      // This is a best-effort approach since we don't have direct access to the streamId
      try {
        // We'll log this for debugging purposes
        console.log(`Attempting to delete live lecture: ${lectureId}`)
      } catch (error) {
        console.error("Error handling live lecture deletion:", error)
      }
    }

    // Delete associated documents
    const documentPaths = lecture.documents
      .map((doc) => {
        const docPath = doc.url.split("/").pop()
        return docPath ? `${session.user.id}/${docPath}` : null
      })
      .filter(Boolean) as string[]

    if (documentPaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage.from("content").remove(documentPaths)

      if (storageError) {
        console.error("Error deleting documents from storage:", storageError)
      }
    }

    // Delete the lecture and all related data from the database
    await prisma.lecture.delete({
      where: {
        id: lectureId,
      },
    })

    // Invalidate caches
    await invalidateCache(REDIS_KEYS.COURSE(lecture.section.content.id))
    await redis.del(`course:${lecture.section.content.id}:sections`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting lecture:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to delete lecture" },
      { status: 500 },
    )
  }
}
