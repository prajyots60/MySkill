import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { redis } from "@/lib/redis"
import { REDIS_KEYS } from "@/lib/constants"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import dbMonitoring from "@/lib/db-monitoring"

// Cache duration for featured courses (5 minutes)
const CACHE_DURATION = 300

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    // Try to get from cache first
    const cacheKey = REDIS_KEYS.FEATURED_COURSES || "featured_courses"
    
    try {
      const cachedCourses = await redis.get(cacheKey)
      if (cachedCourses && typeof cachedCourses === 'string') {
        console.log(`Retrieved featured courses from cache: ${cacheKey}`)
        return NextResponse.json({
          success: true,
          courses: JSON.parse(cachedCourses),
          fromCache: true,
        })
      }
    } catch (error) {
      console.error("Cache error:", error)
      // Continue to fetch from database if cache fails
    }

    // Fetch courses sorted by recent updates
    console.log("Fetching courses for featured section")
    const courses = await prisma.content.findMany({
      where: {
        isPublished: true,
        type: "COURSE",
      },
      orderBy: {
        // Use only fields that exist in the schema
        updatedAt: 'desc',
      },
      take: 6, // Limit to 6 featured courses
      include: {
        _count: {
          select: {
            enrollments: true,
            reviews: true, // Add review count
          },
        },
        reviews: {
          select: {
            rating: true,
          }
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
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        enrollments: session?.user?.id
          ? {
              where: {
                userId: session.user.id,
              },
              select: {
                id: true,
              },
              take: 1,
            }
          : undefined,
      },
    })

    // If no courses found at all, return empty array
    if (courses.length === 0) {
      return NextResponse.json({
        success: true,
        courses: [],
        fromCache: false,
      })
    }

    // Process courses
    const processedCourses = courses.map((course) => {
      // Calculate average rating
      let averageRating = 0;
      if (course.reviews && course.reviews.length > 0) {
        const totalRating = course.reviews.reduce((sum, review) => sum + review.rating, 0);
        averageRating = totalRating / course.reviews.length;
      }
      
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        price: course.price,
        level: "beginner",
        tags: course.tags || [],
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
        enrollmentCount: course._count.enrollments,
        lectureCount: course.sections.reduce((total, section) => total + section._count.lectures, 0),
        creator: course.creator,
        creatorName: course.creator?.name || "",
        creatorImage: course.creator?.image || "",
        isEnrolled: course.enrollments && course.enrollments.length > 0,
        type: course.type,
        rating: averageRating,
        reviewCount: course._count.reviews || 0,
      };
    })

    // Cache the results
    try {
      await redis.set(cacheKey, JSON.stringify(processedCourses), { ex: CACHE_DURATION })
    } catch (error) {
      console.error("Failed to cache featured courses:", error)
    }

    return NextResponse.json({
      success: true,
      courses: processedCourses,
      fromCache: false,
    })
  } catch (error) {
    console.error("Error fetching featured courses:", error)
    
    // Track database connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('featured_courses_connection_error')
    }
    
    return NextResponse.json(
      { success: false, message: "Failed to fetch featured courses", error: (error as Error).message },
      { status: 500 }
    )
  }
}