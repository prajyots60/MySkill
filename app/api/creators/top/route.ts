import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { redis } from "@/lib/redis"
import { REDIS_KEYS } from "@/lib/constants"

// Cache duration for top creators (5 minutes)
const CACHE_DURATION = 300

export async function GET() {
  try {
    // Try to get from cache first
    const cacheKey = 'public:top_creators'
    
    try {
      const cachedCreators = await redis.get(cacheKey)
      if (cachedCreators && typeof cachedCreators === 'string') {
        console.log(`Retrieved top creators from cache: ${cacheKey}`)
        return NextResponse.json({
          success: true,
          creators: JSON.parse(cachedCreators),
          fromCache: true,
        })
      }
    } catch (error) {
      console.error("Cache error:", error)
      // Continue to fetch from database if cache fails
    }

    // Fetch top creators from database - users with role CREATOR
    // and include their follower count and content count
    console.log("Fetching top creators from database")
    
    // Using raw query to get creators with their follower and content counts
    const topCreators = await prisma.$queryRaw`
      SELECT u.*,
             COUNT(DISTINCT f.id) as "followers",
             COUNT(DISTINCT c.id) as "contentCount"
      FROM "User" u
      LEFT JOIN "UserFollow" f ON u.id = f."followingId"
      LEFT JOIN "Content" c ON u.id = c."creatorId"
      WHERE u.role = 'CREATOR'
      GROUP BY u.id
      ORDER BY "followers" DESC, "contentCount" DESC
      LIMIT 5
    `

    // Process creators data
    const processedCreators = Array.isArray(topCreators) 
      ? topCreators.map((creator: any) => ({
          id: creator.id,
          name: creator.name || "Anonymous Creator",
          bio: creator.bio || "This creator hasn't added a bio yet.",
          image: creator.image,
          followers: Number(creator.followers || 0),
          contentCount: Number(creator.contentCount || 0),
          createdAt: creator.createdAt,
        }))
      : []

    // Cache the results
    try {
      await redis.set(cacheKey, JSON.stringify(processedCreators), { ex: CACHE_DURATION })
    } catch (error) {
      console.error("Failed to cache top creators:", error)
    }

    return NextResponse.json({
      success: true,
      creators: processedCreators,
      fromCache: false,
    })
  } catch (error) {
    console.error("Error fetching top creators:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch top creators", error: (error as Error).message },
      { status: 500 }
    )
  }
}