import { Redis } from "@upstash/redis"
import type { TempUserData } from "./types"

// Initialize Redis client - use environment variables
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
})

// Cache TTL in seconds
const DEFAULT_TTL = 60 * 60 // 1 hour
const TEMP_USER_TTL = 60 * 60 * 24 // 24 hours
const COURSE_TTL = 60 * 15 // 15 minutes
const CREATOR_COURSES_TTL = 60 * 5 // 5 minutes
const SECTIONS_TTL = 60 * 10 // 10 minutes
const LECTURE_TTL = 60 * 30 // 30 minutes
const USER_TTL = 60 * 10 // 10 minutes
const YOUTUBE_CONNECTION_TTL = 60 * 60 // 1 hour

// Cache keys
export const REDIS_KEYS = {
  CREATOR_COURSES: (creatorId: string) => `creator:${creatorId}:courses`,
  COURSE: (courseId: string, creatorId?: string) => creatorId ? `creator:${creatorId}:course:${courseId}` : `course:${courseId}`,
  SECTION: (sectionId: string) => `section:${sectionId}`,
  LECTURE: (lectureId: string) => `lecture:${lectureId}`,
  USER: (userId: string) => `user:${userId}`,
  YOUTUBE_CONNECTION: (userId: string) => `youtube:connection:${userId}`,
  TEMP_USER: (userId: string) => `temp:user:${userId}`,
  TEMP_EMAIL: (email: string) => `temp:email:${email}`,
  USER_PROGRESS: (userId: string, courseId: string) => `progress:${userId}:${courseId}`,
  VIDEO_ACCESS: (userId: string, lectureId: string) => `video_access:${userId}:${lectureId}`,
  // Adding missing enrollment-related keys with correct cache key formats
  USER_ENROLLMENTS: (userId: string) => `student:enrollments:${userId}`,
  COURSE_ENROLLMENTS: (courseId: string) => `course:enrollments:${courseId}`,
}

// Generic cache operations
export async function setCache(key: string, value: any, ttl = DEFAULT_TTL) {
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttl })
    return true
  } catch (error) {
    console.error("Redis set error:", error)
    return false
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key)
    return typeof data === "string" ? (JSON.parse(data) as T) : (data as T | null)
  } catch (error) {
    console.error("Redis get error:", error)
    return null
  }
}

export async function deleteCache(key: string) {
  try {
    await redis.del(key)
    return true
  } catch (error) {
    console.error("Redis delete error:", error)
    return false
  }
}

// Cache course data
export async function cacheCourse(courseId: string, courseData: any, creatorId?: string) {
  return setCache(REDIS_KEYS.COURSE(courseId, creatorId), courseData, COURSE_TTL)
}

// Get cached course data
export async function getCachedCourse(courseId: string, creatorId?: string) {
  return getCache(REDIS_KEYS.COURSE(courseId, creatorId))
}

// Cache creator courses
export async function cacheCreatorCourses(creatorId: string, coursesData: any) {
  return setCache(REDIS_KEYS.CREATOR_COURSES(creatorId), coursesData, CREATOR_COURSES_TTL)
}

// Get cached creator courses
export async function getCachedCreatorCourses(creatorId: string) {
  return getCache(REDIS_KEYS.CREATOR_COURSES(creatorId))
}

// Cache section data
export async function cacheSection(sectionId: string, sectionData: any) {
  return setCache(REDIS_KEYS.SECTION(sectionId), sectionData, SECTIONS_TTL)
}

// Get cached section data
export async function getCachedSection(sectionId: string) {
  return getCache(REDIS_KEYS.SECTION(sectionId))
}

// Cache lecture data
export async function cacheLecture(lectureId: string, lectureData: any) {
  return setCache(REDIS_KEYS.LECTURE(lectureId), lectureData, LECTURE_TTL)
}

// Get cached lecture data
export async function getCachedLecture(lectureId: string) {
  return getCache(REDIS_KEYS.LECTURE(lectureId))
}

// Cache user progress
export async function cacheUserProgress(userId: string, courseId: string, progressData: any) {
  return setCache(REDIS_KEYS.USER_PROGRESS(userId, courseId), progressData, USER_TTL)
}

// Get cached user progress
export async function getCachedUserProgress(userId: string, courseId: string) {
  return getCache(REDIS_KEYS.USER_PROGRESS(userId, courseId))
}

// Invalidate cache with pattern matching
export async function invalidateCache(pattern: string) {
  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
      console.log(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`)
    }
    return true
  } catch (error) {
    console.error(`Failed to invalidate cache for pattern: ${pattern}`, error)
    return false
  }
}

// Invalidate all course-related caches for a creator
export async function invalidateCreatorCaches(creatorId: string) {
  try {
    // Invalidate creator-specific patterns
    const patterns = [
      `creator:${creatorId}:*`,
      `creator_courses:${creatorId}*`
    ]
    
    let totalInvalidated = 0
    
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
        totalInvalidated += keys.length
      }
    }
    
    console.log(`Invalidated ${totalInvalidated} cache keys for creator: ${creatorId}`)
    return true
  } catch (error) {
    console.error(`Failed to invalidate caches for creator: ${creatorId}`, error)
    return false
  }
}

// Batch get multiple cache keys
export async function batchGetCache(keys: string[]) {
  try {
    if (keys.length === 0) return []
    const values = await redis.mget(...keys)
    return values.map((value) => (typeof value === "string" ? JSON.parse(value) : value))
  } catch (error) {
    console.error("Redis batch get error:", error)
    return []
  }
}

// Batch set multiple cache keys
export async function batchSetCache(items: { key: string; value: any; ttl?: number }[]) {
  try {
    if (items.length === 0) return true

    const pipeline = redis.pipeline()

    items.forEach((item) => {
      pipeline.set(item.key, JSON.stringify(item.value), { ex: item.ttl || DEFAULT_TTL })
    })

    await pipeline.exec()
    return true
  } catch (error) {
    console.error("Redis batch set error:", error)
    return false
  }
}

// Cache YouTube connection status
export async function cacheYouTubeConnection(userId: string, connectionData: any) {
  return setCache(REDIS_KEYS.YOUTUBE_CONNECTION(userId), connectionData, YOUTUBE_CONNECTION_TTL)
}

// Get cached YouTube connection status
export async function getCachedYouTubeConnection(userId: string) {
  return getCache(REDIS_KEYS.YOUTUBE_CONNECTION(userId))
}

// Temporary user operations
export async function storeTempUser(userData: TempUserData) {
  try {
    const userKey = REDIS_KEYS.TEMP_USER(userData.id)
    const emailKey = userData.email ? REDIS_KEYS.TEMP_EMAIL(userData.email) : null

    await setCache(userKey, userData, TEMP_USER_TTL)
    if (emailKey) {
      await redis.set(emailKey, userData.id, { ex: TEMP_USER_TTL })
    }
    return true
  } catch (error) {
    console.error("Redis temp user storage error:", error)
    return false
  }
}

export async function getTempUser(userId: string): Promise<TempUserData | null> {
  return getCache<TempUserData>(REDIS_KEYS.TEMP_USER(userId))
}

export async function getTempUserByEmail(email: string): Promise<TempUserData | null> {
  try {
    const userId = await redis.get(REDIS_KEYS.TEMP_EMAIL(email))
    return typeof userId === "string" ? getTempUser(userId) : null
  } catch (error) {
    console.error("Redis get temp user by email error:", error)
    return null
  }
}

export async function deleteTempUser(userId: string, email?: string) {
  try {
    await deleteCache(REDIS_KEYS.TEMP_USER(userId))
    if (email) {
      await deleteCache(REDIS_KEYS.TEMP_EMAIL(email))
    }
    return true
  } catch (error) {
    console.error("Redis delete temp user error:", error)
    return false
  }
}
