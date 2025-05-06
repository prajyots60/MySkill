"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

// Simplified progress tracking - only track completion status
export async function updateProgress({
  lectureId,
  isComplete,
}: {
  lectureId: string
  isComplete: boolean
}) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Validate lecture exists and get course ID
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        section: {
          select: {
            contentId: true,
          },
        },
      },
    })

    if (!lecture) {
      throw new Error("Lecture not found")
    }

    const courseId = lecture.section.contentId

    // Check if user is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
      },
    })

    if (!enrollment) {
      throw new Error("Not enrolled in this course")
    }

    // Update or create progress - simplified to just track completion
    const progress = await prisma.progress.upsert({
      where: {
        userId_lectureId: {
          userId: session.user.id,
          lectureId,
        },
      },
      update: {
        isComplete,
      },
      create: {
        userId: session.user.id,
        lectureId,
        isComplete,
      },
    })

    // Invalidate cache
    await redis.del(`student:enrollments:${session.user.id}`)

    revalidatePath(`/content/${courseId}/player/${lectureId}`)
    revalidatePath(`/dashboard/student`)
    revalidatePath(`/dashboard/student/my-courses`)

    return { success: true, progress }
  } catch (error) {
    console.error("Error updating progress:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to update progress" }
  }
}

// Get progress for a course - simplified to just return completion status
export async function getCourseProgress(courseId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Get all completed lectures for the course
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

    const completedCount = completedLectures.length
    const percentage = totalLectures > 0 ? Math.round((completedCount / totalLectures) * 100) : 0

    return {
      success: true,
      progress: {
        totalLectures,
        completedLectures: completedCount,
        percentage,
        completedLectureIds: completedLectures.map((l) => l.lectureId),
      },
    }
  } catch (error) {
    console.error("Error getting course progress:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to get course progress" }
  }
}

// Get progress for a lecture - simplified to just return completion status
export async function getLectureProgress(lectureId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
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
      },
    })

    return {
      success: true,
      isComplete: progress?.isComplete || false,
    }
  } catch (error) {
    console.error("Error getting lecture progress:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to get lecture progress" }
  }
}
