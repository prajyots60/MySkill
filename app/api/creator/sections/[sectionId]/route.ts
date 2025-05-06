import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis, REDIS_KEYS, invalidateCache } from "@/lib/redis"
import { supabaseAdmin } from "@/lib/supabase"

export async function DELETE(request: Request, { params }: { params: { sectionId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { sectionId } = await params

    // Get the section to check permissions and get related data
    const section = await prisma.section.findUnique({
      where: {
        id: sectionId,
      },
      select: {
        id: true,
        contentId: true,
        content: {
          select: {
            creatorId: true,
          },
        },
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
        documents: {
          select: {
            id: true,
            url: true,
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
      return NextResponse.json({ message: "You don't have permission to delete this section" }, { status: 403 })
    }

    // Delete all related resources from Supabase storage
    const resourcesToDelete: string[] = []

    // Delete all lecture videos and documents
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

    // Delete section documents
    section.documents.forEach((doc) => {
      if (doc.url) {
        const docPath = doc.url.split("/").pop()
        if (docPath) {
          resourcesToDelete.push(`${session.user.id}/${docPath}`)
        }
      }
    })

    // Delete all resources from Supabase storage
    if (resourcesToDelete.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage.from("content").remove(resourcesToDelete)
      if (storageError) {
        console.error("Error deleting resources from storage:", storageError)
      }
    }

    // Delete the section and all related data from the database in a transaction
    // to ensure all related entities are properly deleted
    await prisma.$transaction(async (tx) => {
      // First, delete all documents associated with the section's lectures
      await tx.document.deleteMany({
        where: {
          lectureId: {
            in: section.lectures.map(lecture => lecture.id)
          }
        }
      });

      // Then delete all lectures in the section
      await tx.lecture.deleteMany({
        where: {
          sectionId: sectionId
        }
      });

      // Delete any documents directly attached to the section
      await tx.document.deleteMany({
        where: {
          sectionId: sectionId
        }
      });

      // Finally delete the section itself
      await tx.section.delete({
        where: {
          id: sectionId,
        }
      });
    });

    // Invalidate all related caches
    await invalidateCache(REDIS_KEYS.COURSE(section.contentId))
    await redis.del(`course:${section.contentId}:sections`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting section:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to delete section" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: { sectionId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Properly await the params
    const { sectionId } = await params

    // Get the section to check permissions
    const section = await prisma.section.findUnique({
      where: {
        id: sectionId,
      },
      include: {
        content: {
          select: {
            id: true,
            creatorId: true,
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
      return NextResponse.json({ message: "You don't have permission to update this section" }, { status: 403 })
    }

    // Parse request body
    const { title, description } = await request.json()

    if (!title) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 })
    }

    // Update the section
    const updatedSection = await prisma.section.update({
      where: {
        id: sectionId,
      },
      data: {
        title,
        description,
      },
    })

    // Invalidate cache
    await invalidateCache(REDIS_KEYS.COURSE(section.content.id))
    await redis.del(`course:${section.content.id}:sections`)

    return NextResponse.json({ success: true, section: updatedSection })
  } catch (error) {
    console.error("Error updating section:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to update section" },
      { status: 500 },
    )
  }
}
