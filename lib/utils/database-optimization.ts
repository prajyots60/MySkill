/**
 * Database query optimization utilities
 */

import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

// Cache TTL in seconds
const QUERY_CACHE_TTL = 60 * 5 // 5 minutes

/**
 * Optimized course query with efficient joins and caching
 */
export async function getOptimizedCourse(courseId: string, userId?: string) {
  // Try to get from cache first
  const cacheKey = `course:${courseId}:${userId || "anonymous"}`
  const cachedCourse = await redis.get(cacheKey)

  if (cachedCourse) {
    return JSON.parse(cachedCourse)
  }

  // If not in cache, query with optimized joins
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      isPublished: true,
      createdAt: true,
      updatedAt: true,
      creatorId: true,
      creator: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      // Only select necessary fields for sections
      sections: {
        where: { isPublished: true },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          // Only select necessary fields for lectures
          lectures: {
            where: { isPublished: true },
            select: {
              id: true,
              title: true,
              description: true,
              type: true,
              isPreview: true,
              position: true,
              videoUrl: true,
              duration: true,
            },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
      // Get enrollment status if userId provided
      ...(userId
        ? {
            enrollments: {
              where: { userId },
              select: { id: true },
            },
          }
        : {}),
    },
  })

  if (!course) {
    return null
  }

  // Process the data
  const result = {
    ...course,
    isEnrolled: userId ? course.enrollments && course.enrollments.length > 0 : false,
  }

  // Remove enrollments from result
  if ("enrollments" in result) {
    delete result.enrollments
  }

  // Cache the result
  await redis.set(cacheKey, JSON.stringify(result), { ex: QUERY_CACHE_TTL })

  return result
}

/**
 * Optimized batch query for multiple courses
 */
export async function getOptimizedCourses(limit = 10, offset = 0, filters: any = {}) {
  // Build cache key based on parameters
  const cacheKey = `courses:${limit}:${offset}:${JSON.stringify(filters)}`
  const cachedCourses = await redis.get(cacheKey)

  if (cachedCourses) {
    return JSON.parse(cachedCourses)
  }

  // Build where clause
  const where: any = { isPublished: true }

  if (filters.creatorId) {
    where.creatorId = filters.creatorId
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  // Execute optimized query
  const [courses, totalCount] = await Promise.all([
    prisma.course.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        creatorId: true,
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        // Count sections and lectures instead of fetching them
        _count: {
          select: {
            sections: true,
            enrollments: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.course.count({ where }),
  ])

  // Process the results
  const result = {
    courses: courses.map((course) => ({
      ...course,
      sectionCount: course._count.sections,
      enrollmentCount: course._count.enrollments,
      _count: undefined,
    })),
    totalCount,
  }

  // Cache the result
  await redis.set(cacheKey, JSON.stringify(result), { ex: QUERY_CACHE_TTL })

  return result
}

/**
 * Invalidate course cache when data changes
 */
export async function invalidateCourseCache(courseId: string) {
  const keys = await redis.keys(`course:${courseId}:*`)

  if (keys.length > 0) {
    await redis.del(...keys)
  }

  // Also invalidate courses list cache
  const courseListKeys = await redis.keys("courses:*")
  if (courseListKeys.length > 0) {
    await redis.del(...courseListKeys)
  }
}
