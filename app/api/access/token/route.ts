import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { sign } from "jsonwebtoken"

export async function GET(request: Request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get("lectureId")

    if (!lectureId) {
      return NextResponse.json({ message: "Lecture ID is required" }, { status: 400 })
    }

    // Try to get from cache first
    const cacheKey = `video_access:${session.user.id}:${lectureId}`
    const cachedToken = await redis.get(cacheKey)

    if (cachedToken) {
      const cachedData = JSON.parse(cachedToken as string)
      return NextResponse.json({
        token: cachedData.token,
        videoId: cachedData.videoId,
      })
    }

    // Get the lecture and its associated content
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        section: {
          include: {
            content: {
              select: {
                id: true,
                creatorId: true,
                price: true,
                isPublished: true,
              },
            },
          },
        },
      },
    })

    if (!lecture) {
      return NextResponse.json({ message: "Lecture not found" }, { status: 404 })
    }

    const content = lecture.section.content

    // Check if lecture is a preview
    const isPreview = lecture.isPreview

    // Check if user is the creator or an admin
    const isCreator = content.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"

    // Check if content is published
    if (!content.isPublished && !isCreator && !isAdmin) {
      return NextResponse.json({ message: "Content is not published" }, { status: 403 })
    }

    // Check if user is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: content.id,
      },
    })

    // Check if user has access
    const isFree = content.price === 0 || content.price === null
    const hasAccess = enrollment || isFree || isCreator || isAdmin || isPreview

    if (!hasAccess) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 })
    }

    // Generate a signed token for video access
    const token = sign(
      {
        userId: session.user.id,
        lectureId,
        contentId: content.id,
        exp: Math.floor(Date.now() / 1000) + 60 * 10, // 10 minutes
      },
      process.env.NEXTAUTH_SECRET!,
    )

    // Cache the token
    await redis.set(
      cacheKey,
      JSON.stringify({
        token,
        videoId: lecture.videoId,
      }),
      {
        ex: 60 * 10, // 10 minutes
      },
    )

    return NextResponse.json(
      {
        token,
        videoId: lecture.videoId,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error generating access token:", error)
    return NextResponse.json({ message: "Failed to generate access token" }, { status: 500 })
  }
}
