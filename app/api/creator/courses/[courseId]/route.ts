import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis, REDIS_KEYS, invalidateCache } from "@/lib/redis"
import { supabaseAdmin } from "@/lib/supabase"

export async function DELETE(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { courseId } = params

    // Get the course to check permissions and get related data
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      select: {
        creatorId: true,
        thumbnail: true,
        sections: {
          select: {
            id: true,
            lectures: {
              select: {
                id: true,
                videoId: true,
                documents: {
                  select: {
                    id: true,
                    url: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ message: "Course not found" }, { status: 404 })
    }

    // Check if user is the creator or an admin
    const isCreator = course.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ message: "You don't have permission to delete this course" }, { status: 403 })
    }

    // Delete all related resources from Supabase storage
    const resourcesToDelete: string[] = []

    // Delete thumbnail if exists
    if (course.thumbnail) {
      const thumbnailPath = course.thumbnail.split("/").pop()
      if (thumbnailPath) {
        resourcesToDelete.push(`${session.user.id}/${thumbnailPath}`)
      }
    }

    // Delete all lecture videos and documents
    course.sections.forEach((section) => {
      section.lectures.forEach((lecture) => {
        if (lecture.videoId) {
          const videoPath = lecture.videoId.split("/").pop()
          if (videoPath) {
            resourcesToDelete.push(`${session.user.id}/${videoPath}`)
          }
        }
        lecture.documents.forEach((doc) => {
          if (doc.url) {
            const docPath = doc.url.split("/").pop()
            if (docPath) {
              resourcesToDelete.push(`${session.user.id}/${docPath}`)
            }
          }
        })
      })
    })

    // Delete all resources from Supabase storage
    if (resourcesToDelete.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage.from("content").remove(resourcesToDelete)
      if (storageError) {
        console.error("Error deleting resources from storage:", storageError)
      }
    }

    // Delete the course and all related data from the database
    await prisma.content.delete({
      where: {
        id: courseId,
      },
    })

    // Invalidate all related caches
    await invalidateCache(REDIS_KEYS.CREATOR_COURSES(session.user.id))
    await invalidateCache(REDIS_KEYS.COURSE(courseId))
    await redis.del(`course:${courseId}:sections`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting course:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to delete course" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { courseId } = await params

    // Get the course to check permissions
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      select: {
        creatorId: true,
      },
    })

    if (!course) {
      return NextResponse.json({ message: "Course not found" }, { status: 404 })
    }

    // Check if user is the creator or an admin
    const isCreator = course.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ message: "You don't have permission to update this course" }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { title, description, type, price, isPublished, tags } = body

    // Update the course in the database
    const updatedCourse = await prisma.content.update({
      where: {
        id: courseId,
      },
      data: {
        title,
        description,
        type,
        price: Number(price),
        isPublished,
        tags,
      },
    })

    // Invalidate cache
    await invalidateCache(REDIS_KEYS.CREATOR_COURSES(session.user.id))
    await invalidateCache(REDIS_KEYS.COURSE(courseId))

    return NextResponse.json({ success: true, course: updatedCourse })
  } catch (error) {
    console.error("Error updating course:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to update course" },
      { status: 500 },
    )
  }
}
