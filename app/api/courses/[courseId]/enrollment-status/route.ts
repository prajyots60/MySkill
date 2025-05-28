import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { redis } from "@/lib/redis"

export async function GET(request: Request, { params }: { params: { courseId: string } }) {
  try {
    // No need to await params - it's already resolved
    const { courseId } = await params
    const session = await getServerSession(authOptions)
    
    // Extract lectureId from URL if provided
    const url = new URL(request.url)
    const lectureId = url.searchParams.get('lectureId')
    
    // Try to get from cache first if user is logged in
    if (session?.user) {
      const cacheKey = `enrollment:${courseId}:${session.user.id}${lectureId ? `:${lectureId}` : ''}`
      const cachedStatus = await redis.get(cacheKey)
      
      // Fix for JSON parsing - the Redis client already returns a parsed object
      if (cachedStatus !== null) {
        return NextResponse.json(cachedStatus)
      }
    }

    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: {
        price: true,
        creatorId: true,
        isPublished: true,
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    // If lectureId is provided, check if it's a preview lecture
    let isPreviewLecture = false
    if (lectureId) {
      const lecture = await prisma.lecture.findUnique({
        where: { id: lectureId },
        select: { isPreview: true }
      });
      isPreviewLecture = !!lecture?.isPreview;
    }

    // If the user is not logged in
    if (!session?.user) {
      // For free courses, previews, or if the requested lecture is a preview, allow access
      if (course.price === 0 || course.price === null || isPreviewLecture) {
        return NextResponse.json({ isEnrolled: false, isFree: course.price === 0 || course.price === null, isPreviewLecture })
      }
      return NextResponse.json({ isEnrolled: false, requiresAuth: true }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role === "ADMIN") {
      const response = { isEnrolled: true, isAdmin: true }
      if (session.user) {
        const cacheKey = `enrollment:${courseId}:${session.user.id}${lectureId ? `:${lectureId}` : ''}`
        await redis.set(cacheKey, response, { ex: 3600 }) // 1 hour cache
      }
      return NextResponse.json(response)
    }

    // If the user is the creator, they have access
    if (course.creatorId === session.user.id) {
      const response = { isEnrolled: true, isCreator: true }
      const cacheKey = `enrollment:${courseId}:${session.user.id}${lectureId ? `:${lectureId}` : ''}`
      await redis.set(cacheKey, response, { ex: 3600 }) // 1 hour cache
      return NextResponse.json(response)
    }

    // If the course is free or the lecture is a preview, they have access
    if (course.price === 0 || course.price === null || isPreviewLecture) {
      const response = { isEnrolled: true, isFree: course.price === 0 || course.price === null, isPreviewLecture }
      const cacheKey = `enrollment:${courseId}:${session.user.id}${lectureId ? `:${lectureId}` : ''}`
      await redis.set(cacheKey, response, { ex: 3600 }) // 1 hour cache
      return NextResponse.json(response)
    }

    // Check if user is enrolled
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
      },
    })

    const response = { isEnrolled: !!enrollment }
    const cacheKey = `enrollment:${courseId}:${session.user.id}${lectureId ? `:${lectureId}` : ''}`
    await redis.set(cacheKey, response, { ex: 3600 }) // 1 hour cache
    return NextResponse.json(response)
  } catch (error) {
    console.error("[ENROLLMENT_STATUS]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
