import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Try to get from cache first
    const cacheKey = `student:bookmarks:${session.user.id}`
    const cachedData = await redis.get(cacheKey)

    if (cachedData) {
      return NextResponse.json({
        success: true,
        bookmarks: JSON.parse(typeof cachedData === "string" ? cachedData : JSON.stringify(cachedData)),
        fromCache: true,
      })
    }

    // Get all bookmarked courses
    const bookmarks = await prisma.content.findMany({
      where: {
        bookmarks: {
          some: {
            userId: session.user.id,
          },
        },
        isPublished: true,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
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
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    // Transform the data
    const transformedBookmarks = bookmarks.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      price: course.price,
      creatorName: course.creator?.name || null,
      creatorImage: course.creator?.image || null,
      enrollmentCount: course._count.enrollments,
      lectureCount: course.sections.reduce((acc, section) => acc + section._count.lectures, 0),
      updatedAt: course.updatedAt,
      level: course.level,
      tags: course.tags,
    }))

    // Cache the results
    await redis.set(cacheKey, JSON.stringify(transformedBookmarks), { ex: 60 * 5 }) // 5 minutes

    return NextResponse.json({
      success: true,
      bookmarks: transformedBookmarks,
      fromCache: false,
    })
  } catch (error) {
    console.error("Error fetching bookmarked courses:", error)
    return NextResponse.json({ success: false, message: "Failed to fetch bookmarked courses" }, { status: 500 })
  }
}
