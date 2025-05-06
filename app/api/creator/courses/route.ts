import { NextResponse, NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis, REDIS_KEYS, invalidateCache } from "@/lib/redis"
import { supabaseAdmin } from "@/lib/supabase"

// Cache duration
const CACHE_DURATION = 60 * 5 // 5 minutes

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can create courses" }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const type = formData.get("type") as string
    const price = Number.parseFloat(formData.get("price") as string) || 0
    const isPublished = formData.get("isPublished") === "true"
    const tags = ((formData.get("tags") as string) || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
    const thumbnail = formData.get("thumbnail") as File | null

    if (!title || !description) {
      return NextResponse.json({ message: "Title and description are required" }, { status: 400 })
    }

    // Upload thumbnail to Supabase if provided
    let thumbnailUrl = null
    if (thumbnail) {
      const fileName = `${session.user.id}/${Date.now()}-${thumbnail.name}`
      const buffer = await thumbnail.arrayBuffer()

      const { data, error } = await supabaseAdmin.storage.from("thumbnails").upload(fileName, buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: thumbnail.type,
      })

      if (error) {
        return NextResponse.json({ message: `Error uploading thumbnail: ${error.message}` }, { status: 500 })
      }

      // Get the public URL
      const { data: publicUrlData } = supabaseAdmin.storage.from("thumbnails").getPublicUrl(data.path)
      thumbnailUrl = publicUrlData.publicUrl
    }

    // Create the course in the database
    const course = await prisma.content.create({
      data: {
        title,
        description,
        type: type as any,
        price,
        isPublished,
        tags,
        thumbnail: thumbnailUrl,
        creator: {
          connect: { id: session.user.id },
        },
      },
    })

    // Invalidate creator courses cache
    await invalidateCache(REDIS_KEYS.CREATOR_COURSES(session.user.id))

    return NextResponse.json({ success: true, courseId: course.id }, { status: 201 })
  } catch (error) {
    console.error("Error creating course:", error)
    return NextResponse.json({ message: "Failed to create course" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can access courses" }, { status: 403 })
    }

    // Set cache control headers
    const headers = new Headers()
    headers.set("Cache-Control", `s-maxage=${CACHE_DURATION}, stale-while-revalidate`)

    const cacheKey = REDIS_KEYS.CREATOR_COURSES(session.user.id)

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
          { headers },
        )
      }
    } catch (cacheError) {
      console.error("Cache read error:", cacheError)
      // Continue to database fetch if cache fails
    }

    // Get courses from database with efficient querying
    const courses = await prisma.content.findMany({
      where: {
        creatorId: session.user.id,
      },
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
            title: true,
            _count: {
              select: {
                lectures: true,
              },
            },
          },
        },
      },
    })

    // Transform the data
    const transformedCourses = courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      type: course.type,
      price: course.price,
      isPublished: course.isPublished,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      tags: course.tags,
      enrollmentCount: course._count.enrollments,
      lectureCount: course.sections.reduce((acc, section) => acc + section._count.lectures, 0),
      sectionCount: course.sections.length,
    }))

    // Cache the results
    try {
      await redis.set(cacheKey, JSON.stringify(transformedCourses), { ex: CACHE_DURATION })
    } catch (cacheError) {
      console.error("Cache write error:", cacheError)
    }

    return NextResponse.json(
      {
        success: true,
        courses: transformedCourses,
        fromCache: false,
      },
      { headers },
    )
  } catch (error) {
    console.error("Error getting creator courses:", error)
    return NextResponse.json({ success: false, message: "Failed to get courses" }, { status: 500 })
  }
}
