import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

// GET - Check bookmark status
export async function GET(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const { courseId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const bookmark = await prisma.bookmark.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
      },
    })

    return NextResponse.json({
      success: true,
      isBookmarked: !!bookmark,
    })
  } catch (error) {
    console.error("Error checking bookmark status:", error)
    return NextResponse.json({ success: false, message: "Failed to check bookmark status" }, { status: 500 })
  }
}

// POST - Toggle bookmark
export async function POST(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const { courseId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check if course exists
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
        isPublished: true,
      },
    })

    if (!course) {
      return NextResponse.json({ success: false, message: "Course not found" }, { status: 404 })
    }

    // Check if already bookmarked
    const existingBookmark = await prisma.bookmark.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
      },
    })

    let isBookmarked: boolean
    if (existingBookmark) {
      // Remove bookmark
      await prisma.bookmark.delete({
        where: {
          id: existingBookmark.id,
        },
      })
      isBookmarked = false
    } else {
      // Add bookmark
      await prisma.bookmark.create({
        data: {
          user: {
            connect: { id: session.user.id },
          },
          content: {
            connect: { id: courseId },
          },
        },
      })
      isBookmarked = true
    }

    // Invalidate cache
    await redis.del(`student:bookmarks:${session.user.id}`)

    return NextResponse.json({
      success: true,
      isBookmarked,
      message: isBookmarked ? "Course bookmarked" : "Bookmark removed",
    })
  } catch (error) {
    console.error("Error toggling bookmark:", error)
    return NextResponse.json({ success: false, message: "Failed to toggle bookmark" }, { status: 500 })
  }
}
