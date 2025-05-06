import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  try {
    const { userId } = await params

    if (!userId) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 })
    }

    // Get total courses
    const totalCourses = await prisma.content.count({
      where: {
        creatorId: userId,
      },
    })

    // Get total students (sum of enrollments across all courses)
    const totalStudents = await prisma.enrollment.count({
      where: {
        content: {
          creatorId: userId,
        },
      },
    })

    // Get following count using UserFollow model
    const followingCount = await prisma.UserFollow.count({
      where: {
        followerId: userId,
      },
    })

    // Get user creation date
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      stats: {
        totalCourses,
        totalStudents,
        memberSince: user.createdAt,
        following: followingCount,
      },
    })
  } catch (error) {
    console.error("Error fetching user stats:", error)
    return NextResponse.json({ message: "Failed to fetch user statistics" }, { status: 500 })
  }
}
