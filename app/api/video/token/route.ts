import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { encodeVideoId, validateVideoAccess } from "@/lib/utils/video-security"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get("lectureId")

    if (!lectureId) {
      return NextResponse.json({ message: "Lecture ID is required" }, { status: 400 })
    }

    // Validate that the user has access to this lecture
    const hasAccess = await validateVideoAccess(session.user.id, lectureId)
    if (!hasAccess) {
      return NextResponse.json({ message: "Access denied to this lecture" }, { status: 403 })
    }

    // Fetch the lecture to get the video ID
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      select: { videoId: true },
    })

    if (!lecture || !lecture.videoId) {
      return NextResponse.json({ message: "Video not found for this lecture" }, { status: 404 })
    }

    // Generate a secure token for the video ID
    const token = encodeVideoId(lecture.videoId)

    // Return the token (not the video ID)
    return NextResponse.json({ token })
  } catch (error) {
    console.error("Error generating video token:", error)
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to generate video token",
      },
      { status: 500 },
    )
  }
}
