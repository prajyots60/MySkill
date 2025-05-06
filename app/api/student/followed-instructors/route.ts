import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import type { UserFollow } from "@prisma/client"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Try to get from cache first
    const cacheKey = `student:followed-instructors:${session.user.id}`
    const cachedData = await redis.get(cacheKey)

    if (cachedData) {
      return NextResponse.json({
        success: true,
        instructors: JSON.parse(typeof cachedData === "string" ? cachedData : JSON.stringify(cachedData)),
        fromCache: true,
      })
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
            _count: {
              select: {
                contents: true,
                followers: true,
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
      studentCount: follow.following._count.followers,
    }))

    // Cache the results
    await redis.set(cacheKey, JSON.stringify(transformedInstructors), { ex: 60 * 5 }) // 5 minutes

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
