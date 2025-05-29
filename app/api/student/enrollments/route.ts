import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import dbMonitoring from "@/lib/db-monitoring"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"

// Maximum retry attempts for database operations
const MAX_RETRIES = 3

/**
 * Retry function for database operations with exponential backoff
 */
async function retryOperation<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (retries <= 0 || !isPrismaTimeoutError(error)) {
      throw error
    }
    
    // Log retry attempt
    console.log(`Retrying operation, ${retries} attempts left`)
    
    // Exponential backoff
    const delay = Math.pow(2, MAX_RETRIES - retries) * 100
    await new Promise(resolve => setTimeout(resolve, delay))
    
    // Retry with one fewer retry available
    return retryOperation(operation, retries - 1)
  }
}

/**
 * Check if the error is a Prisma transaction timeout error
 */
function isPrismaTimeoutError(error: any): boolean {
  return (
    error instanceof PrismaClientKnownRequestError && 
    (error.code === 'P2028' || error.message.includes('transaction'))
  )
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Try to get from cache first
    const cacheKey = `student:enrollments:${userId}`
    const cachedData = await redis.get(cacheKey)

    if (cachedData) {
      return NextResponse.json({
        success: true,
        ...JSON.parse(typeof cachedData === "string" ? cachedData : JSON.stringify(cachedData)),
        fromCache: true,
      })
    }

    // Fetch enrollments and progress data separately with retry logic
    let enrollments = []
    let progressData = []
    
    try {
      // Get all enrollments with course data
      enrollments = await retryOperation(() => prisma.enrollment.findMany({
        where: {
          userId: userId,
        },
        include: {
          content: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
              sections: {
                include: {
                  lectures: {
                    select: {
                      id: true,
                      title: true,
                      order: true,
                    },
                  },
                },
                orderBy: {
                  order: "asc",
                },
              },
              _count: {
                select: {
                  enrollments: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",  // Using createdAt instead of enrolledAt which doesn't exist
        },
      }))
    } catch (error) {
      console.error("Error fetching enrollments:", error)
      dbMonitoring.trackError('enrollment_list_enrollments_error')
      
      // Return partial data if we have any from cache
      if (cachedData) {
        const parsedCache = JSON.parse(typeof cachedData === "string" ? cachedData : JSON.stringify(cachedData))
        return NextResponse.json({
          success: true,
          ...parsedCache,
          fromCache: true,
          partial: true,
          message: "Using cached data due to database error"
        })
      }
      
      // If no cache data, throw to let the outer catch handle it
      throw error
    }
    
    try {
      // Get all progress data for the user in a single query
      progressData = await retryOperation(() => prisma.progress.findMany({
        where: {
          userId: userId,
        },
        include: {
          lecture: {
            select: {
              id: true,
              title: true,
              section: {
                select: {
                  id: true,
                  contentId: true,
                },
              },
            },
          },
        },
      }))
    } catch (error) {
      console.error("Error fetching progress data:", error)
      dbMonitoring.trackError('enrollment_list_progress_error')
      
      // Continue with empty progress - better than failing entirely
      progressData = []
    }

    // Group progress by course
    const progressByContent: Record<string, any> = {}
    progressData.forEach((progress) => {
      const contentId = progress.lecture.section.contentId
      if (!progressByContent[contentId]) {
        progressByContent[contentId] = {
          completedLectures: 0,
          totalLectures: 0,
          lastAccessed: null,
        }
      }

      if (progress.isComplete) {
        progressByContent[contentId].completedLectures++
      }

      // Track last accessed
      if (
        !progressByContent[contentId].lastAccessed ||
        new Date(progress.updatedAt) > new Date(progressByContent[contentId].lastAccessed)
      ) {
        progressByContent[contentId].lastAccessed = progress.updatedAt
      }
    })

    // Process enrollments into courses with progress
    const processedCourses = enrollments.map((enrollment) => {
      const course = enrollment.content
      const totalLectures = course.sections.reduce((total, section) => total + section.lectures.length, 0)

      // Find next lecture to watch (first incomplete lecture)
      let nextLecture = null
      let foundIncomplete = false

      for (const section of course.sections) {
        if (foundIncomplete) break

        for (const lecture of section.lectures) {
          const isComplete = progressData.some((p) => p.lectureId === lecture.id && p.isComplete)

          if (!isComplete) {
            nextLecture = {
              id: lecture.id,
              title: lecture.title,
            }
            foundIncomplete = true
            break
          }
        }
      }

      // Set progress data
      const progress = progressByContent[course.id] || { completedLectures: 0, lastAccessed: null }
      progress.totalLectures = totalLectures
      progress.percentage = totalLectures > 0 ? Math.round((progress.completedLectures / totalLectures) * 100) : 0

      // Determine if course is completed
      const isCompleted = progress.percentage === 100

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        creatorId: course.creatorId,
        creatorName: course.creator?.name,
        creatorImage: course.creator?.image,
        enrollmentCount: course._count?.enrollments || 0,
        updatedAt: course.updatedAt,
        createdAt: course.createdAt,
        isPublished: course.isPublished,
        price: course.price,
        level: course.level,
        tags: course.tags,
        isTrending: course.isTrending,
        totalLectures,
        completedLectures: progress.completedLectures,
        progress: progress.percentage,
        nextLecture,
        lastAccessed: progress.lastAccessed,
        enrolledAt: enrollment.createdAt, // Using createdAt instead of enrolledAt
        isCompleted,
      }
    })

    // Split into in-progress and completed courses
    const inProgressCourses = processedCourses.filter((course) => !course.isCompleted)
    const completedCourses = processedCourses.filter((course) => course.isCompleted)

    // Calculate stats
    const stats = {
      totalCoursesEnrolled: processedCourses.length,
      totalCompletedCourses: completedCourses.length,
      coursesInProgress: inProgressCourses.length,
    }

    // Prepare response data
    const responseData = {
      success: true,
      enrolledCourses: processedCourses,
      inProgressCourses,
      completedCourses,
      stats,
    }

    try {
      // Cache the response (10 minutes)
      await redis.set(cacheKey, JSON.stringify(responseData), { ex: 600 })
    } catch (error) {
      console.error("Error caching enrollment data:", error)
      // Continue without caching - not critical
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error fetching enrolled courses:", error)
    
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('enrollment_list_connection_error')
    } else if (isPrismaTimeoutError(error)) {
      dbMonitoring.trackError('enrollment_list_timeout_error')
    } else {
      dbMonitoring.trackError('enrollment_list_unknown_error')
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch enrolled courses",
        error: error instanceof Error ? error.message : "Unknown error" 
      }, 
      { status: 500 }
    )
  }
}
