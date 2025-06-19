import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// API endpoint to fetch recent lectures for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    // Calculate date 3 days ago
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    // Get enrolled course IDs for the current user
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
      },
      select: {
        contentId: true,
      },
    })

    const enrolledCourseIds = enrollments?.map((enrollment) => enrollment.contentId) || []

    if (enrolledCourseIds.length === 0) {
      return NextResponse.json({
        success: true,
        lectures: [],
      })
    }

    // Get lectures from sections in enrolled courses
    // that were created in the last 3 days and not completed by the user
    const recentLectures = await prisma.lecture.findMany({
      where: {
        section: {
          contentId: {
            in: enrolledCourseIds
          }
        },
        createdAt: {
          gt: threeDaysAgo
        },
        progress: {
          none: {
            userId: session.user.id,
            isComplete: true
          }
        }
      },
      select: {
        id: true,
        title: true,
        videoId: true,
        videoSource: true,
        createdAt: true,
        section: {
          select: {
            contentId: true,
            content: {
              select: {
                title: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    // Transform the data to match the expected format in the frontend
    const formattedLectures = recentLectures.map(lecture => ({
      id: lecture.id,
      title: lecture.title,
      videoId: lecture.videoId,
      videoSource: lecture.videoSource,
      createdAt: lecture.createdAt,
      courseId: lecture.section.contentId,
      courseName: lecture.section.content.title
    }))

    return NextResponse.json({
      success: true,
      lectures: formattedLectures,
    })
  } catch (error) {
    console.error("Error fetching recent lectures:", error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch recent lectures", 
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined 
      },
      { status: 500 }
    )
  }
}
