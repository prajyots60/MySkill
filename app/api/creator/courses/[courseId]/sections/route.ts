import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis, REDIS_KEYS, invalidateCache } from "@/lib/redis"

export async function GET(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { courseId } = await params

    // Check if course exists and belongs to the user
    const course = await prisma.content.findFirst({
      where: {
        id: courseId,
        creatorId: session.user.id,
      },
      select: {
        id: true,
      },
    })

    if (!course) {
      return NextResponse.json({ message: "Course not found or you don't have permission" }, { status: 404 })
    }

    // Try to get from cache first
    const cacheKey = `course:${courseId}:sections`
    const cachedSections = await redis.get(cacheKey)

    if (cachedSections) {
      const parsedSections = typeof cachedSections === "string" ? JSON.parse(cachedSections) : cachedSections

      return NextResponse.json({ success: true, sections: parsedSections })
    }

    // Get sections from database
    const sections = await prisma.section.findMany({
      where: {
        contentId: courseId,
      },
      orderBy: {
        order: "asc",
      },
      include: {
        _count: {
          select: {
            lectures: true,
          },
        },
        lectures: {
          orderBy: {
            order: "asc",
          },
          select: {
            id: true,
            title: true,
            type: true,
            isPreview: true,
            duration: true,
          },
        },
      },
    })

    // Cache the results
    await redis.set(cacheKey, JSON.stringify(sections), {
      ex: 60 * 5, // 5 minutes
    })

    return NextResponse.json({ success: true, sections })
  } catch (error) {
    console.error("Error getting sections:", error)
    return NextResponse.json({ success: false, message: "Failed to get sections" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { courseId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { courseId } = await params

    // Check if course exists and belongs to the user
    const course = await prisma.content.findFirst({
      where: {
        id: courseId,
        creatorId: session.user.id,
      },
      select: {
        id: true,
      },
    })

    if (!course) {
      return NextResponse.json({ message: "Course not found or you don't have permission" }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const { title, description } = body

    if (!title) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 })
    }

    // Get the highest order number
    const highestOrder = await prisma.section.findFirst({
      where: {
        contentId: courseId,
      },
      orderBy: {
        order: "desc",
      },
      select: {
        order: true,
      },
    })

    const order = highestOrder ? highestOrder.order + 1 : 1

    // Create the section
    const section = await prisma.section.create({
      data: {
        title,
        description,
        order,
        content: {
          connect: { id: courseId },
        },
      },
    })

    // Invalidate cache
    await invalidateCache(`course:${courseId}:sections`)
    await invalidateCache(REDIS_KEYS.COURSE(courseId))

    return NextResponse.json({ success: true, section }, { status: 201 })
  } catch (error) {
    console.error("Error creating section:", error)
    return NextResponse.json({ success: false, message: "Failed to create section" }, { status: 500 })
  }
}
