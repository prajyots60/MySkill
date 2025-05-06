import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import type { User } from "@prisma/client"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Fetch top 5 instructors with their follower and content counts
    const recommendedInstructors = await prisma.$queryRaw<(User & { followerCount: number; contentCount: number })[]>`
      SELECT u.*,
        COUNT(DISTINCT f.id) as "followerCount",
        COUNT(DISTINCT c.id) as "contentCount"
      FROM "User" u
      LEFT JOIN "UserFollow" f ON u.id = f."followingId"
      LEFT JOIN "Content" c ON u.id = c."creatorId"
      WHERE u.role = 'CREATOR'
      AND u.id != ${session.user.id}
      GROUP BY u.id
      ORDER BY "followerCount" DESC, "contentCount" DESC
      LIMIT 5
    `

    // Check if current user follows these instructors
    const followData = await prisma.$queryRaw<{ followingId: string }[]>`
      SELECT "followingId"
      FROM "UserFollow"
      WHERE "followerId" = ${session.user.id}
      AND "followingId" IN (${recommendedInstructors.map((i) => i.id).join(",")})
    `

    const followingIds = new Set(followData.map((follow) => follow.followingId))

    const formattedInstructors = recommendedInstructors.map((instructor) => ({
      id: instructor.id,
      name: instructor.name || "Anonymous Instructor",
      image: instructor.image,
      bio: instructor.bio || "This instructor hasn't added a bio yet.",
      followers: Number(instructor.followerCount),
      courseCount: Number(instructor.contentCount),
      isFollowing: followingIds.has(instructor.id),
      joinedDate: instructor.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      instructors: formattedInstructors,
    })
  } catch (error) {
    console.error("[RECOMMENDED_INSTRUCTORS]", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
