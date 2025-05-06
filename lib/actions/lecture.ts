"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import type { LectureType } from "@/lib/types"

// Create a new lecture
export async function createLecture({
  sectionId,
  title,
  description,
  type,
  isPreview,
}: {
  sectionId: string
  title: string
  description?: string
  type: LectureType
  isPreview?: boolean
}) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user is a creator or admin
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      throw new Error("Only creators can create lectures")
    }

    // Check if section exists and belongs to the user
    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        content: {
          creatorId: session.user.id,
        },
      },
      select: {
        id: true,
        contentId: true,
      },
    })

    if (!section) {
      throw new Error("Section not found or you don't have permission")
    }

    // Get the next order number
    const lastLecture = await prisma.lecture.findFirst({
      where: { sectionId },
      orderBy: { order: "desc" },
      select: { order: true },
    })

    const nextOrder = (lastLecture?.order ?? 0) + 1

    // Create the lecture
    const lecture = await prisma.lecture.create({
      data: {
        title,
        description,
        type,
        isPreview: isPreview || false,
        sectionId,
        order: nextOrder,
      },
    })

    // Invalidate cache
    await redis.del(`section:${sectionId}`)
    await redis.del(`content:${section.contentId}`)

    revalidatePath(`/dashboard/creator/content/${section.contentId}`)
    revalidatePath(`/content/${section.contentId}`)

    return { success: true, lecture }
  } catch (error) {
    console.error("Error creating lecture:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to create lecture" }
  }
}

// Update a lecture
export async function updateLecture({
  lectureId,
  title,
  description,
  isPreview,
}: {
  lectureId: string
  title: string
  description: string
  isPreview: boolean
}) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" }
    }

    // Check if lecture exists and belongs to the user
    const lecture = await prisma.lecture.findFirst({
      where: {
        id: lectureId,
        section: {
          content: {
            creatorId: session.user.id,
          },
        },
      },
      include: {
        section: {
          select: {
            id: true,
            contentId: true,
          },
        },
      },
    })

    if (!lecture) {
      return { success: false, error: "Lecture not found or unauthorized" }
    }

    // Update the lecture
    const updatedLecture = await prisma.lecture.update({
      where: { id: lectureId },
      data: {
        title,
        description,
        isPreview,
      },
      include: {
        section: {
          select: {
            id: true,
            contentId: true,
          },
        },
      },
    })

    // Invalidate cache
    await redis.del(`lecture:${lectureId}`)
    await redis.del(`section:${updatedLecture.section.id}`)
    await redis.del(`content:${updatedLecture.section.contentId}`)

    revalidatePath(`/dashboard/creator/content/${updatedLecture.section.contentId}`)
    revalidatePath(`/content/${updatedLecture.section.contentId}`)

    return { success: true, lecture: updatedLecture }
  } catch (error) {
    console.error("Error updating lecture:", error)
    return { success: false, error: "Failed to update lecture" }
  }
}

// Delete a lecture
export async function deleteLecture(lectureId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user is a creator or admin
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      throw new Error("Only creators can delete lectures")
    }

    // Check if lecture exists and belongs to the user
    const lecture = await prisma.lecture.findFirst({
      where: {
        id: lectureId,
        section: {
          content: {
            creatorId: session.user.id,
          },
        },
      },
      include: {
        section: {
          select: {
            id: true,
            contentId: true,
          },
        },
      },
    })

    if (!lecture) {
      throw new Error("Lecture not found or you don't have permission")
    }

    // Delete the lecture
    await prisma.lecture.delete({
      where: {
        id: lectureId,
      },
    })

    // Invalidate cache
    await redis.del(`lecture:${lectureId}`)
    await redis.del(`section:${lecture.section.id}`)
    await redis.del(`content:${lecture.section.contentId}`)

    revalidatePath(`/dashboard/creator/content/${lecture.section.contentId}`)
    revalidatePath(`/content/${lecture.section.contentId}`)

    return { success: true }
  } catch (error) {
    console.error("Error deleting lecture:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete lecture" }
  }
}

// Get lecture by ID
export async function getLectureById(lectureId: string) {
  try {
    // Try to get from cache first
    const cachedLecture = await redis.get(`lecture:${lectureId}`)
    if (cachedLecture) {
      return { success: true, lecture: JSON.parse(cachedLecture as string) }
    }

    // Get lecture from database
    const lecture = await prisma.lecture.findUnique({
      where: {
        id: lectureId,
      },
      include: {
        section: {
          select: {
            id: true,
            title: true,
            contentId: true,
            content: {
              select: {
                id: true,
                title: true,
                creatorId: true,
              },
            },
          },
        },
        documents: true,
      },
    })

    if (!lecture) {
      throw new Error("Lecture not found")
    }

    // Cache the result
    await redis.set(`lecture:${lectureId}`, JSON.stringify(lecture), {
      ex: 60 * 5, // 5 minutes
    })

    return { success: true, lecture }
  } catch (error) {
    console.error("Error getting lecture:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to get lecture" }
  }
}

// Upload video to lecture
export async function uploadVideoToLecture({
  lectureId,
  videoId,
  duration,
}: {
  lectureId: string
  videoId: string
  duration: number
}) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user is a creator or admin
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      throw new Error("Only creators can upload videos")
    }

    // Check if lecture exists and belongs to the user
    const lecture = await prisma.lecture.findFirst({
      where: {
        id: lectureId,
        section: {
          content: {
            creatorId: session.user.id,
          },
        },
      },
      include: {
        section: {
          select: {
            id: true,
            contentId: true,
          },
        },
      },
    })

    if (!lecture) {
      throw new Error("Lecture not found or you don't have permission")
    }

    // Update the lecture with video ID and duration
    const updatedLecture = await prisma.lecture.update({
      where: {
        id: lectureId,
      },
      data: {
        videoId,
        duration,
      },
      include: {
        section: {
          select: {
            id: true,
            contentId: true,
          },
        },
      },
    })

    // Invalidate cache
    await redis.del(`lecture:${lectureId}`)
    await redis.del(`section:${updatedLecture.section.id}`)
    await redis.del(`content:${updatedLecture.section.contentId}`)

    revalidatePath(`/dashboard/creator/content/${updatedLecture.section.contentId}`)
    revalidatePath(`/content/${updatedLecture.section.contentId}`)
    revalidatePath(`/content/${updatedLecture.section.contentId}/player/${lectureId}`)

    return { success: true, lecture: updatedLecture }
  } catch (error) {
    console.error("Error uploading video to lecture:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to upload video" }
  }
}
