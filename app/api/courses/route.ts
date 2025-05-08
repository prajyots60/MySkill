import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { redis } from "@/lib/redis"
import { REDIS_KEYS } from "@/lib/constants"
import type { Course, CourseResponse } from "@/types/course"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import createBatch from "@/lib/utils/db-batch"
import dbMonitoring from "@/lib/db-monitoring"

interface DatabaseCourse {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  price: number;
  level: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isTrending?: boolean;
  _count: {
    enrollments: number;
  };
  sections: {
    _count: {
      lectures: number;
    };
  }[];
  creator?: {
    id: string;
    name: string;
    image: string | null;
  };
  enrollments?: { id: string }[];
  reviews?: { rating: number }[];
}

interface ProcessedCourse {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  price: number;
  level: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  enrollmentCount: number;
  lectureCount: number;
  creator?: {
    id: string;
    name: string;
    image: string | null;
  };
  creatorId: string;
  creatorName: string;
  creatorImage: string;
  isEnrolled: boolean;
  isTrending?: boolean;
  rating: number;
  reviewCount: number;
}

// Shorter cache duration for more frequent updates
const SHORT_CACHE_DURATION = 60 // 1 minute
const LONG_CACHE_DURATION = 300 // 5 minutes

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const level = searchParams.get("level")
    const tags = searchParams.get("tags")?.split(",") || []

    console.log("GET /api/courses - Request params:", {
      search,
      limit,
      offset,
      level,
      tags,
    })

    // Build cache key based on parameters
    const cacheKey = REDIS_KEYS.PUBLIC_COURSES(search, limit, offset, level, tags.join(","))
    const cacheTimestampKey = `${cacheKey}:timestamp`

    // Try to get from cache first
    try {
      const [cachedCourses, cacheTimestamp] = await Promise.all([redis.get(cacheKey), redis.get(cacheTimestampKey)])

      if (cachedCourses && typeof cachedCourses === 'string') {
        console.log(`Retrieved courses from cache: ${cacheKey}`)
        
        // If the cache is stale, trigger a background refresh
        const now = Date.now()
        if (cacheTimestamp && typeof cacheTimestamp === 'string' && now - parseInt(cacheTimestamp) > SHORT_CACHE_DURATION * 1000) {
          console.log("Cache is stale, triggering background refresh")
          // Don't await this so it happens in background
          refreshCache(cacheKey, cacheTimestampKey, search, limit, offset, level, tags)
        }
        
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

    // Fetch fresh data from database and cache it
    const coursesData = await fetchAndCacheCourses(
      cacheKey,
      cacheTimestampKey,
      search,
      limit,
      offset,
      level,
      tags,
      session
    )

    return NextResponse.json({
      success: true,
      courses: coursesData.courses,
      totalCount: coursesData.totalCount,
      fromCache: false,
    })
  } catch (error) {
    console.error("Error fetching courses:", error)
    
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('courses_search_connection_error')
    }
    
    return NextResponse.json(
      { success: false, message: "Failed to fetch courses", error: (error as Error).message },
      { status: 500 }
    )
  }
}

async function fetchAndCacheCourses(
  cacheKey: string,
  cacheTimestampKey: string,
  search: string,
  limit: number,
  offset: number,
  level: string | null,
  tags: string[],
  session: any | null,
): Promise<{ courses: any[], totalCount: number }> {
  // Build where clause
  const where: any = {
    isPublished: true,
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { creator: { name: { contains: search, mode: "insensitive" } } },
    ]
  }

  if (level && level !== "All Levels") {
    where.level = level
  }

  if (tags.length > 0) {
    where.tags = {
      hasSome: tags,
    }
  }

  console.log("Fetching fresh data from database with where clause:", where)

  // Create a batch for querying courses
  const batch = createBatch()
  
  // Add courses query
  batch.add(tx => tx.content.findMany({
    where,
    orderBy: {
      updatedAt: "desc",
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
      reviews: {
        select: {
          rating: true,
        }
      }
    },
    skip: offset,
    take: limit,
  }))
  
  // Add count query
  batch.add(tx => tx.content.count({
    where,
  }))
  
  // Execute all queries in a single transaction
  const [courses, totalCount] = await batch.execute()

  // Process courses to format data
  const processedCourses: ProcessedCourse[] = courses.map((course: DatabaseCourse) => {
    // Calculate average rating if reviews exist
    const averageRating = course.reviews && course.reviews.length > 0
      ? course.reviews.reduce((sum, review) => sum + review.rating, 0) / course.reviews.length
      : 0;
      
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      price: course.price,
      level: course.level,
      tags: course.tags,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      enrollmentCount: course._count.enrollments,
      lectureCount: course.sections.reduce((total, section) => total + section._count.lectures, 0),
      creator: course.creator,
      creatorId: course.creator?.id || "", // Add explicit creatorId property
      creatorName: course.creator?.name || "",
      creatorImage: course.creator?.image || "",
      isEnrolled: course.enrollments && course.enrollments.length > 0,
      isTrending: course.isTrending,
      rating: parseFloat(averageRating.toFixed(1)),
      reviewCount: course.reviews?.length || 0
    }
  })

  // Cache the results
  await Promise.all([
    redis.set(cacheKey, JSON.stringify(processedCourses), { ex: LONG_CACHE_DURATION }),
    redis.set(cacheTimestampKey, Date.now().toString(), { ex: LONG_CACHE_DURATION }),
  ])

  return { courses: processedCourses, totalCount }
}

async function refreshCache(
  cacheKey: string,
  cacheTimestampKey: string,
  search: string,
  limit: number,
  offset: number,
  level: string | null,
  tags: string[],
) {
  try {
    const session = await getServerSession(authOptions)
    await fetchAndCacheCourses(cacheKey, cacheTimestampKey, search, limit, offset, level, tags, session)
    console.log(`Successfully refreshed cache for ${cacheKey}`)
  } catch (error) {
    console.error(`Failed to refresh cache for ${cacheKey}:`, error)
  }
}
