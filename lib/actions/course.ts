"use server"

import { revalidatePath } from "next/cache"
import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  cacheCourse,
  getCachedCourse,
  cacheCreatorCourses,
  getCachedCreatorCourses,
  invalidateCache,
  REDIS_KEYS,
} from "@/lib/redis"
import { supabaseAdmin } from "@/lib/supabase"
import type { ContentType } from "@/lib/types"

// Create a new course
export async function createCourse({
  title,
  description,
  type,
  price,
  isPublished,
  tags,
  thumbnail,
}: {
  title: string
  description: string
  type: ContentType
  price: number
  isPublished: boolean
  tags: string[]
  thumbnail?: File
}) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user is a creator
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || (user.role !== "CREATOR" && user.role !== "ADMIN")) {
      throw new Error("Only creators can create courses")
    }

    // Upload thumbnail to Supabase if provided
    let thumbnailUrl = null
    if (thumbnail) {
      const fileName = `${session.user.id}/${Date.now()}-${thumbnail.name}`
      const { data, error } = await supabaseAdmin.storage.from("thumbnails").upload(fileName, thumbnail, {
        cacheControl: "3600",
        upsert: false,
      })

      if (error) {
        throw new Error(`Error uploading thumbnail: ${error.message}`)
      }

      // Get the public URL
      const { data: publicUrlData } = supabaseAdmin.storage.from("thumbnails").getPublicUrl(data.path)
      thumbnailUrl = publicUrlData.publicUrl
    }

    // Create the course in the database
    const course = await prisma.content.create({
      data: {
        title,
        description,
        type,
        price: price || 0,
        isPublished,
        tags,
        thumbnail: thumbnailUrl,
        creator: {
          connect: { id: session.user.id },
        },
      },
    })

    // Invalidate creator courses cache
    await invalidateCache(REDIS_KEYS.CREATOR_COURSES(session.user.id))

    revalidatePath("/dashboard/creator")
    return { success: true, courseId: course.id }
  } catch (error) {
    console.error("Error creating course:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to create course" }
  }
}

// Get all courses for a creator
export async function getCreatorCourses() {
  try {
    const session = await getAuthSession()

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      throw new Error("Only creators can access courses")
    }

    // Try to get from cache first
    const cachedCourses = await getCachedCreatorCourses(session.user.id)
    if (cachedCourses) {
      return { success: true, courses: cachedCourses }
    }

    // Get courses from database with strict creator ID filtering
    const courses = await prisma.content.findMany({
      where: {
        creatorId: session.user.id, // Ensure we only get courses owned by the current creator
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
        sections: {
          select: {
            _count: {
              select: {
                lectures: true,
              },
            },
          },
        },
      },
    })

    // Transform the data
    const transformedCourses = courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      type: course.type,
      price: course.price,
      isPublished: course.isPublished,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      tags: course.tags,
      enrollmentCount: course._count.enrollments,
      lectureCount: course.sections.reduce((acc, section) => acc + section._count.lectures, 0),
    }))

    // Cache the results with creator-specific key
    await cacheCreatorCourses(session.user.id, transformedCourses)

    return { success: true, courses: transformedCourses }
  } catch (error) {
    console.error("Error getting creator courses:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to get courses" }
  }
}

// Get a single course by ID
export async function getCourseById(courseId: string) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Try to get from cache first with creator ID to ensure isolation
    const cachedCourse = await getCachedCourse(courseId, session.user.id)
    if (cachedCourse) {
      // Verify the cached course belongs to this creator
      if (cachedCourse && 
          typeof cachedCourse === 'object' && 
          'creatorId' in cachedCourse && 
          (cachedCourse.creatorId === session.user.id || session.user.role === "ADMIN")) {
        return { success: true, course: cachedCourse }
      }
    }

    // Get course from database
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        sections: {
          orderBy: {
            order: "asc",
          },
          include: {
            lectures: {
              orderBy: {
                order: "asc",
              },
            },
            documents: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    })

    if (!course) {
      throw new Error("Course not found")
    }

    // Check if user is the creator or an admin
    const isCreator = course.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      throw new Error("You don't have permission to view this course")
    }

    // Cache the results with creator ID for proper isolation
    await cacheCourse(courseId, course, session.user.id)

    return { success: true, course }
  } catch (error) {
    console.error("Error getting course:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to get course" }
  }
}

// Update a course
export async function updateCourse({
  courseId,
  title,
  description,
  type,
  price,
  isPublished,
  tags,
  thumbnail,
}: {
  courseId: string
  title?: string
  description?: string
  type?: ContentType
  price?: number
  isPublished?: boolean
  tags?: string[]
  thumbnail?: File
}) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

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
      throw new Error("Course not found")
    }

    // Check if user is the creator or an admin
    const isCreator = course.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      throw new Error("You don't have permission to update this course")
    }

    // Upload thumbnail to Supabase if provided
    let thumbnailUrl = undefined
    if (thumbnail) {
      const fileName = `${session.user.id}/${Date.now()}-${thumbnail.name}`
      const { data, error } = await supabaseAdmin.storage.from("thumbnails").upload(fileName, thumbnail, {
        cacheControl: "3600",
        upsert: false,
      })

      if (error) {
        throw new Error(`Error uploading thumbnail: ${error.message}`)
      }

      // Get the public URL
      const { data: publicUrlData } = supabaseAdmin.storage.from("thumbnails").getPublicUrl(data.path)
      thumbnailUrl = publicUrlData.publicUrl
    }

    // Update the course in the database
    const updatedCourse = await prisma.content.update({
      where: {
        id: courseId,
      },
      data: {
        title,
        description,
        type,
        price,
        isPublished,
        tags,
        thumbnail: thumbnailUrl,
      },
    })

    // Comprehensive cache invalidation
    await Promise.all([
      // Individual course cache
      invalidateCache(REDIS_KEYS.COURSE(courseId)),
      // Creator's courses list
      invalidateCache(REDIS_KEYS.CREATOR_COURSES(session.user.id)),
      // Featured courses (if this course might be featured)
      invalidateCache('featured-courses'),
      // Category-based caches if applicable
      invalidateCache(`courses-category-${updatedCourse.type}`),
      // Search-related caches
      invalidateCache('course-search'),
      // User's enrolled courses (in case enrollment status changes)
      invalidateCache(REDIS_KEYS.USER_ENROLLED_COURSES(session.user.id))
    ])

    // Revalidate dynamic routes
    revalidatePath(`/content/${courseId}`)
    revalidatePath(`/dashboard/creator/content/${courseId}`)
    revalidatePath("/dashboard/creator")
    revalidatePath("/explore")

    return { success: true, course: updatedCourse }
  } catch (error) {
    console.error("Error updating course:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to update course" }
  }
}

// Delete a course
export async function deleteCourse(courseId: string) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Get the course to check permissions
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      select: {
        creatorId: true,
        thumbnail: true,
      },
    })

    if (!course) {
      throw new Error("Course not found")
    }

    // Check if user is the creator or an admin
    const isCreator = course.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      throw new Error("You don't have permission to delete this course")
    }

    // Delete the thumbnail from Supabase if it exists
    if (course.thumbnail) {
      const thumbnailPath = course.thumbnail.split("/").pop()
      if (thumbnailPath) {
        await supabaseAdmin.storage.from("thumbnails").remove([`${session.user.id}/${thumbnailPath}`])
      }
    }

    // Delete the course from the database
    await prisma.content.delete({
      where: {
        id: courseId,
      },
    })

    // Invalidate cache
    await invalidateCache(REDIS_KEYS.CREATOR_COURSES(session.user.id))
    await invalidateCache(REDIS_KEYS.COURSE(courseId))

    revalidatePath("/dashboard/creator")
    return { success: true }
  } catch (error) {
    console.error("Error deleting course:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete course" }
  }
}
