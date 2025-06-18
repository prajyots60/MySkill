import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import type { UserFollow } from "@prisma/client"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check for cache-busting headers
    const requestHeaders = new Headers(request.headers)
    const shouldBypassCache = 
      requestHeaders.get('X-Cache-Bust') || 
      requestHeaders.get('Cache-Control') === 'no-cache, no-store, must-revalidate' ||
      requestHeaders.get('Pragma') === 'no-cache'
      
    // Try to get from cache if not bypassing
    if (!shouldBypassCache) {
      const cacheKey = `student:followed-instructors:${session.user.id}`
      const cachedData = await redis.get(cacheKey)

      if (cachedData) {
        return NextResponse.json({
          success: true,
          instructors: JSON.parse(typeof cachedData === "string" ? cachedData : JSON.stringify(cachedData)),
          fromCache: true,
        })
      }
    }

    // Get all followed instructors
    const userFollows = await prisma.userFollow.findMany({
      where: {
        followerId: session.user.id,
      },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            image: true,
            bio: true,
            createdAt: true,
            _count: {
              select: {
                contents: true,
                followers: { where: { follower: { role: "STUDENT" } } }, // Count followers who are students
              },
            },
          },
        },
      },
    })

    // Transform the data
    const transformedInstructors = userFollows.map((follow: UserFollow & { following: any }) => ({
      id: follow.following.id,
      name: follow.following.name || "Unknown Instructor",
      image: follow.following.image,
      bio: follow.following.bio,
      courseCount: follow.following._count.contents,
      followerCount: follow.following._count.followers,
      joinedDate: follow.following.createdAt?.toISOString(),
    }))

    // Cache the results if not bypassing cache
    if (!shouldBypassCache) {
      const cacheKey = `student:followed-instructors:${session.user.id}`
      await redis.set(cacheKey, JSON.stringify(transformedInstructors), { ex: 60 * 5 }) // 5 minutes
    }

    return NextResponse.json({
      success: true,
      instructors: transformedInstructors,
      fromCache: false,
    })
  } catch (error) {
    console.error("Error fetching followed instructors:", error)
    return NextResponse.json({ success: false, message: "Failed to fetch followed instructors" }, { status: 500 })
  }
}
