import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

// Cache duration in seconds
const CACHE_DURATION = 60 * 30 // 30 minutes
const STALE_WHILE_REVALIDATE = 60 * 60 // 1 hour

interface RatingData {
  averageRating: number;
  totalReviews: number;
}

export async function GET(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const { courseId } = params

    // Set cache control headers for stale-while-revalidate strategy
    const headers = new Headers()
    headers.set(
      "Cache-Control",
      `s-maxage=${CACHE_DURATION}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`
    )

    // Try to get from cache first
    const cacheKey = `course:${courseId}`
    const cachedCourse = await redis.get(cacheKey)

    if (cachedCourse) {
      console.log("Using cached course data")
      return NextResponse.json(
        { course: typeof cachedCourse === "string" ? JSON.parse(cachedCourse) : cachedCourse },
        { headers }
      )
    }

    // Get course from database with all related data
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
        // Only return published courses for non-creators and non-admins
        OR: [{ isPublished: true }, { creatorId: session?.user?.id }],
      },
      include: {
        creator: true,
        sections: {
          orderBy: {
            order: "asc",
          },
          include: {
            lectures: {
              orderBy: {
                order: "asc",
              },
              include: {
                documents: true,
              },
            },
            documents: true,
          },
        },
        documents: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    })

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      )
    }

    // Get rating data
    const ratingData = await prisma.$queryRaw<RatingData[]>`
      SELECT 
        AVG(rating)::float as "averageRating",
        COUNT(*) as "totalReviews"
      FROM "Review"
      WHERE "contentId" = ${courseId}
    `

    // Add rating data to course object
    const courseWithRating = {
      ...course,
      rating: parseFloat(ratingData[0]?.averageRating?.toFixed(1) || "0"),
      reviewCount: parseInt(ratingData[0]?.totalReviews?.toString() || "0")
    }

    // Cache the course data
    await redis.set(cacheKey, JSON.stringify(courseWithRating), {
      ex: CACHE_DURATION + STALE_WHILE_REVALIDATE // Total cache lifetime
    })

    return NextResponse.json({ course: courseWithRating }, { headers })
  } catch (error) {
    console.error("Error fetching course:", error)
    return NextResponse.json(
      { error: "Failed to fetch course" },
      { status: 500 }
    )
  }
}
