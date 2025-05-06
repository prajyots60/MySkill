"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

// Enroll in a course
export async function enrollInCourse(courseId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if course exists and is published
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
        isPublished: true,
      },
    })

    if (!course) {
      throw new Error("Course not found or not available")
    }

    // Check if user is already enrolled
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
      },
    })

    if (existingEnrollment) {
      throw new Error("Already enrolled in this course")
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        user: {
          connect: { id: session.user.id },
        },
        content: {
          connect: { id: courseId },
        },
      },
    })

    // Invalidate cache
    await redis.del(`student:enrollments:${session.user.id}`)

    revalidatePath(`/content/${courseId}`)
    revalidatePath(`/dashboard/student`)
    revalidatePath(`/dashboard/student/my-courses`)

    return { success: true, enrollment }
  } catch (error) {
    console.error("Error enrolling in course:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to enroll in course" }
  }
}

// Unenroll from a course
export async function unenrollFromCourse(courseId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if enrollment exists
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
      },
    })

    if (!enrollment) {
      throw new Error("Not enrolled in this course")
    }

    // Delete enrollment
    await prisma.enrollment.delete({
      where: {
        id: enrollment.id,
      },
    })

    // Delete all progress for this course
    await prisma.progress.deleteMany({
      where: {
        userId: session.user.id,
        lecture: {
          section: {
            contentId: courseId,
          },
        },
      },
    })

    // Invalidate cache
    await redis.del(`student:enrollments:${session.user.id}`)

    revalidatePath(`/content/${courseId}`)
    revalidatePath(`/dashboard/student`)
    revalidatePath(`/dashboard/student/my-courses`)

    return { success: true }
  } catch (error) {
    console.error("Error unenrolling from course:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to unenroll from course" }
  }
}

// Check if user is enrolled in a course
export async function checkEnrollmentStatus(courseId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user is enrolled
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
      },
    })

    return {
      success: true,
      isEnrolled: !!enrollment,
      enrollmentDate: enrollment?.enrolledAt || null,
    }
  } catch (error) {
    console.error("Error checking enrollment:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to check enrollment" }
  }
}
