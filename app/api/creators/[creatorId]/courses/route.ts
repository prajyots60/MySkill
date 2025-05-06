import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

// Cache duration
const CACHE_DURATION = 60 * 5 // 5 minutes

export async function GET(
  request: Request,
  { params }: { params: { creatorId: string } }
) {
  try {
    const { creatorId } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "12")
    const tag = searchParams.get("tag")
    
    if (!creatorId) {
      return NextResponse.json({ message: "Creator ID is required" }, { status: 400 })
    }

    // Set cache control headers
    const headers = new Headers()
    headers.set("Cache-Control", `s-maxage=${CACHE_DURATION}, stale-while-revalidate`)

    const cacheKey = `creator:${creatorId}:public:courses:page:${page}:limit:${limit}:tag:${tag || "all"}`

    // Try to get from cache first
    try {
      const cachedCourses = await redis.get(cacheKey)
      if (cachedCourses) {
        return NextResponse.json(
          {
            success: true,
            courses: JSON.parse(typeof cachedCourses === "string" ? cachedCourses : JSON.stringify(cachedCourses)),
            fromCache: true,
          },
          { headers }
        )
      }
    } catch (cacheError) {
      console.error("Cache read error:", cacheError)
      // Continue to database fetch if cache fails
    }

    // Verify the creator exists and is a creator
    const creator = await prisma.user.findUnique({
      where: {
        id: creatorId,
        role: "CREATOR",
      },
      select: {
        id: true,
      },
    })

    if (!creator) {
      return NextResponse.json({ message: "Creator not found" }, { status: 404 })
    }

    // Build the query - IMPORTANT: Only show published courses to everyone
    const where = {
      creatorId: creatorId,
      isPublished: true,
      ...(tag ? { tags: { has: tag } } : {}),
    }

    // Get total count for pagination
    const totalCount = await prisma.content.count({ where })
    
    // Get courses from database with pagination
    const courses = await prisma.content.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
        sections: {
          select: {
            id: true,
            _count: {
              select: {
                lectures: true,
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          }
        }
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // Transform the data
    const transformedCourses = courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      type: course.type,
      price: course.price,
      createdAt: course.createdAt,
      tags: course.tags,
      enrollmentCount: course._count.enrollments,
      lectureCount: course.sections.reduce((acc, section) => acc + section._count.lectures, 0),
      creator: course.creator,
    }))

    const result = {
      courses: transformedCourses,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
      }
    }

    // Cache the results
    try {
      await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_DURATION })
    } catch (cacheError) {
      console.error("Cache write error:", cacheError)
    }

    return NextResponse.json(
      {
        success: true,
        ...result,
        fromCache: false,
      },
      { headers }
    )
  } catch (error) {
    console.error("Error getting creator courses:", error)
    return NextResponse.json({ success: false, message: "Failed to get creator courses" }, { status: 500 })
  }
}
