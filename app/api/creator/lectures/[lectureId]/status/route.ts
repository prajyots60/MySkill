import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getYouTubeClient } from "@/lib/youtube"

export async function PUT(request: Request, { params }: { params: { lectureId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { lectureId } = await params

    if (!lectureId) {
      return NextResponse.json({ message: "Missing lecture ID" }, { status: 400 })
    }

    // Get the lecture to check ownership
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        section: {
          include: {
            content: true,
          },
        },
      },
    })

    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    // Check if the user owns the course
    if (lecture.section.content.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get YouTube client
    const youtube = await getYouTubeClient(session.user.id)

    // Get the broadcast status from YouTube
    const broadcastResponse = await youtube.liveBroadcasts.list({
      part: ["status"],
      id: [lecture.videoId!],
    })

    if (!broadcastResponse.data.items?.[0]) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 })
    }

    const broadcastStatus = broadcastResponse.data.items[0].status?.lifeCycleStatus

    // Map YouTube status to our status
    // YouTube lifeCycleStatus can be: ready, testing, live, complete, revoked, testStarting, liveStarting
    let status: "LIVE" | "SCHEDULED" | "ENDED"
    switch (broadcastStatus) {
      case "live":
      case "liveStarting":
      case "testing":
      case "testStarting":
        status = "LIVE"
        break
      case "ready":
        status = "SCHEDULED"
        break
      case "complete":
      case "revoked":
        status = "ENDED"
        break
      default:
        // Keep the current status if we don't recognize the state
        status = lecture.liveStatus || "SCHEDULED"
    }

    // Update the lecture status
    const updatedLecture = await prisma.lecture.update({
      where: { id: lectureId },
      data: {
        liveStatus: status,
        endedAt: status === "ENDED" ? new Date() : undefined,
      },
    })

    return NextResponse.json({ success: true, lecture: updatedLecture })
  } catch (error) {
    console.error("Error updating live stream status:", error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update live stream status" },
      { status: 500 },
    )
  }
}
