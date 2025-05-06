import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

// Cache duration in seconds
const CACHE_DURATION = 60 * 5 // 5 minutes

export async function GET(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const { courseId } = await params

    console.log("Fetching course with ID:", courseId)
    console.log("User session:", session?.user?.id, "Role:", session?.user?.role)

    if (!courseId) {
      return NextResponse.json({ message: "Course ID is required" }, { status: 400 })
    }

    // Set cache control headers for the response
    const headers = new Headers()
    headers.set("Cache-Control", `s-maxage=${CACHE_DURATION}, stale-while-revalidate`)

    // Try to get from cache first
    const cacheKey = `course:${courseId}`
    const cachedCourse = await redis.get(cacheKey)

    if (cachedCourse) {
      console.log("Using cached course data")
      return NextResponse.json(
        { course: typeof cachedCourse === "string" ? JSON.parse(cachedCourse) : cachedCourse },
        { headers },
      )
    }

    // Get course from database with all related data
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
        // Only return published courses for non-creators and non-admins
        OR: [{ isPublished: true }, { creatorId: session?.user?.id }, { creator: { role: "ADMIN" } }],
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

    console.log("Course data from database:", {
      id: course?.id,
      title: course?.title,
      isPublished: course?.isPublished,
      creatorId: course?.creatorId,
      price: course?.price,
    })

    if (!course) {
      console.log("Course not found or not accessible")
      return NextResponse.json({ message: "Course not found" }, { status: 404 })
    }

    // Cache the course data
    await redis.set(cacheKey, JSON.stringify(course), {
      ex: CACHE_DURATION,
    })

    return NextResponse.json({ course }, { headers })
  } catch (error) {
    console.error("Error fetching course:", error)
    return NextResponse.json({ message: "Failed to fetch course" }, { status: 500 })
  }
}
