"use server"

// This file contains safe server actions that can be called from client components
// without exposing Prisma or other server-only dependencies directly

import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import cacheManager from "@/lib/cache-manager"
import { prisma } from "@/lib/db" // Direct import for more reliable connection
import { redis } from "@/lib/redis" // Import redis for direct cache access

// Function to fetch YouTube connection status
export async function fetchYouTubeConnectionStatus() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return { connected: false, error: "Not authenticated", details: null }
    }

    try {
      // Try to get from Redis cache first to reduce database load
      const cacheKey = `youtube:connection:${session.user.id}`
      const cachedData = await redis.get(cacheKey)
      
      if (cachedData) {
        try {
          // Make sure we're parsing a properly formatted JSON string
          const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData
          return parsed
        } catch (parseError) {
          // If parsing fails, continue to database query
          console.error("Error parsing cached YouTube connection data:", parseError)
        }
      }
      
      // Directly query the database
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { 
          youtubeConnected: true,
        },
      })

      // Prepare result
      const result = {
        connected: !!user?.youtubeConnected,
        error: null,
        details: user?.youtubeConnected ? {
          connected: true,
          connectedAt: new Date().toISOString(),
        } : null
      }
      
      // Ensure we're storing a proper JSON string
      await redis.set(cacheKey, JSON.stringify(result), { ex: 300 }) // 5 minutes cache
      
      return result
    } catch (dbError) {
      console.error("Database error fetching YouTube connection:", dbError)
      return { connected: false, error: "Database error", details: null }
    }
  } catch (error) {
    console.error("Error fetching YouTube connection status:", error)
    return { connected: false, error: "Failed to check connection", details: null }
  }
}

// Function to fetch Google Drive connection status
export async function fetchGDriveConnectionStatus() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return { connected: false, error: "Not authenticated", details: null }
    }

    try {
      // Try to get from Redis cache first to reduce database load
      const cacheKey = `gdrive:connection:${session.user.id}`
      const cachedData = await redis.get(cacheKey)
      
      if (cachedData) {
        try {
          // Make sure we're parsing a properly formatted JSON string
          const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData
          return parsed
        } catch (parseError) {
          // If parsing fails, continue to database query
          console.error("Error parsing cached Google Drive connection data:", parseError)
        }
      }
      
      // Directly query the database
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { 
          gdriveConnected: true,
        },
      })

      // Prepare result
      const result = {
        connected: !!user?.gdriveConnected,
        error: null,
        details: user?.gdriveConnected ? {
          connected: true,
          connectedAt: new Date().toISOString(),
        } : null
      }
      
      // Ensure we're storing a proper JSON string
      await redis.set(cacheKey, JSON.stringify(result), { ex: 300 }) // 5 minutes cache
      
      return result
    } catch (dbError) {
      console.error("Database error fetching Google Drive connection:", dbError)
      return { connected: false, error: "Database error", details: null }
    }
  } catch (error) {
    console.error("Error fetching Google Drive connection status:", error)
    return { connected: false, error: "Failed to check connection", details: null }
  }
}

// Function to fetch Google Forms connection status
export async function fetchGFormsConnectionStatus() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return { connected: false, error: "Not authenticated", details: null }
    }

    try {
      // Try to get from Redis cache first to reduce database load
      const cacheKey = `gforms:connection:${session.user.id}`
      const cachedData = await redis.get(cacheKey)
      
      if (cachedData) {
        try {
          // Make sure we're parsing a properly formatted JSON string
          const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData
          return parsed
        } catch (parseError) {
          // If parsing fails, continue to database query
          console.error("Error parsing cached Google Forms connection data:", parseError)
        }
      }
      
      // Check if the user has a Google account with Forms API scope
      const account = await prisma.account.findFirst({
        where: {
          userId: session.user.id,
          provider: "google",
          scope: {
            contains: "forms.body"
          }
        },
      })

      // Prepare result
      const result = {
        connected: !!account,
        error: null,
        details: account ? {
          email: account.email || undefined,
          name: account.name || undefined,
          connectedAt: new Date().toISOString(),
        } : null
      }
      
      // Ensure we're storing a proper JSON string
      await redis.set(cacheKey, JSON.stringify(result), { ex: 300 }) // 5 minutes cache
      
      return result
    } catch (dbError) {
      console.error("Database error fetching Google Forms connection:", dbError)
      return { connected: false, error: "Database error", details: null }
    }
  } catch (error) {
    console.error("Error fetching Google Forms connection status:", error)
    return { connected: false, error: "Failed to check connection", details: null }
  }
}

// Function to fetch courses for a creator
export async function fetchCreatorCourses() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" }
    }

    // Use cache with a key based on user ID
    const cacheKey = `creator_courses:${session.user.id}`
    
    return await cacheManager.get(
      cacheKey,
      async () => {
        // Get courses from database using optimized db client with connection validation
        const courses = await db.query(() => db.prisma.content.findMany({
          where: {
            creatorId: session.user.id,
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
        }))

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

        return { success: true, courses: transformedCourses }
      },
      { 
        ttl: 3 * 60 * 1000, // Cache for 3 minutes
        backgroundRefresh: true, 
      }
    )
  } catch (error) {
    console.error("Error fetching creator courses:", error)
    return { success: false, error: "Failed to fetch courses" }
  }
}

// Function to fetch course sections
export async function fetchCourseSections(courseId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" }
    }

    // Use cache with a key based on course ID and user ID
    const cacheKey = `course_sections:${courseId}:${session.user.id}`
    
    return await cacheManager.get(
      cacheKey,
      async () => {
        // Use a single transaction for related queries to reduce connection overhead
        return await db.query(async () => {
          // Check if course exists and belongs to the user
          const course = await db.prisma.content.findFirst({
            where: {
              id: courseId,
              creatorId: session.user.id,
            },
            select: {
              id: true,
            },
          })

          if (!course) {
            return { success: false, error: "Course not found or you don't have permission" }
          }

          // Get sections from database
          const sections = await db.prisma.section.findMany({
            where: {
              contentId: courseId,
            },
            orderBy: {
              order: "asc",
            },
            include: {
              lectures: {
                orderBy: {
                  order: "asc",
                },
                include: {
                  documents: true,
                },
              },
              documents: true,
            },
          })

          return { success: true, sections }
        })
      },
      { 
        ttl: 5 * 60 * 1000, // Cache for 5 minutes
        backgroundRefresh: true,
      }
    )
  } catch (error) {
    console.error("Error fetching course sections:", error)
    return { success: false, error: "Failed to fetch sections" }
  }
}

// Function to fetch a single course
export async function fetchCourseById(courseId: string) {
  try {
    console.log(`Fetching course: ${courseId}`)
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" }
    }

    // Use cache with a key based on course ID and user ID
    const cacheKey = `course_detail:${courseId}:${session.user.id}`
    
    return await cacheManager.get(
      cacheKey,
      async () => {
        // Use optimized db client for connection management and retry logic
        return await db.query(async () => {
          // Get course from database
          const course = await db.prisma.content.findUnique({
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
                    include: {
                      documents: true,
                    },
                  },
                  documents: true,
                },
              },
              documents: true,
              _count: {
                select: {
                  enrollments: true,
                },
              },
            },
          })

          if (!course) {
            return { success: false, error: "Course not found" }
          }

          // Check if user is the creator or an admin
          const isCreator = course.creatorId === session.user.id
          const isAdmin = session.user.role === "ADMIN"

          if (!isCreator && !isAdmin) {
            return { success: false, error: "You don't have permission to view this course" }
          }

          return { success: true, course }
        })
      },
      { 
        ttl: 5 * 60 * 1000, // Cache for 5 minutes
        backgroundRefresh: true, 
      }
    )
  } catch (error) {
    console.error("Error fetching course:", error)
    return { success: false, error: "Failed to fetch course" }
  }
}

// Add more server actions as needed
