import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { redis, getCachedLecture, cacheLecture } from "@/lib/redis"

export async function GET(request: Request, { params }: { params: { lectureId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const { lectureId } = await params

    // Try to get from cache first
    const cacheKey = `lecture:${lectureId}:${session?.user?.id || 'guest'}`
    const cachedLecture = await redis.get(cacheKey)
    
    if (cachedLecture && typeof cachedLecture === 'string') {
      return NextResponse.json(JSON.parse(cachedLecture))
    }

    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        section: {
          include: {
            content: {
              select: {
                id: true,
                title: true,
                price: true,
                creatorId: true,
                isPublished: true,
              },
            },
          },
        },
      },
    })

    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }
    
    // Make sure content is published unless user is creator or admin
    if (!lecture.section.content.isPublished && 
        session?.user?.id !== lecture.section.content.creatorId &&
        session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Content not available" }, { status: 404 })
    }

    // If the lecture is a preview, anyone can access it
    if (lecture.isPreview) {
      const response = { lecture }
      await redis.set(cacheKey, JSON.stringify(response), { ex: 3600 }) // 1 hour cache
      return NextResponse.json(response)
    }

    // If the course is free, anyone can access it
    if (lecture.section.content.price === 0 || lecture.section.content.price === null) {
      const response = { lecture }
      await redis.set(cacheKey, JSON.stringify(response), { ex: 3600 }) // 1 hour cache
      return NextResponse.json(response)
    }

    // If user is the creator, they can access it
    if (session?.user?.id === lecture.section.content.creatorId) {
      const response = { lecture }
      await redis.set(cacheKey, JSON.stringify(response), { ex: 3600 }) // 1 hour cache
      return NextResponse.json(response)
    }

    // If user is admin, they can access it
    if (session?.user?.role === "ADMIN") {
      const response = { lecture }
      await redis.set(cacheKey, JSON.stringify(response), { ex: 3600 }) // 1 hour cache
      return NextResponse.json(response)
    }

    // Check if user is enrolled
    if (session?.user) {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId: session.user.id,
          contentId: lecture.section.content.id,
        },
      })

      if (enrollment) {
        const response = { lecture }
        await redis.set(cacheKey, JSON.stringify(response), { ex: 3600 }) // 1 hour cache
        return NextResponse.json(response)
      }
    }

    // If we reach here, the user doesn't have access
    return NextResponse.json({ error: "You don't have permission to access this lecture" }, { status: 403 })
  } catch (error) {
    console.error("[LECTURE]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
