import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { getYouTubeClient } from "@/lib/youtube"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can create live streams" }, { status: 403 })
    }

    // Parse request body
    const { sectionId, title, description, isPreview, scheduledAt } = await request.json()

    if (!sectionId || !title) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    // Get the section and its course to check permissions
    const section = await prisma.section.findUnique({
      where: {
        id: sectionId,
      },
      include: {
        content: {
          select: {
            id: true,
            creatorId: true,
            title: true,
          },
        },
      },
    })

    if (!section) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 })
    }

    // Check if user is the creator or an admin
    const isCreator = section.content.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { message: "You don't have permission to create live streams in this section" },
        { status: 403 },
      )
    }

    // Get YouTube client
    const youtube = await getYouTubeClient(session.user.id)

    // Parse scheduled date if provided
    let scheduledStartTime: string | undefined
    if (scheduledAt) {
      scheduledStartTime = new Date(scheduledAt).toISOString()
    }

    // Variable to store broadcast response
    let broadcastResponse;

    // Create a live broadcast
    try {
      broadcastResponse = await youtube.liveBroadcasts.insert({
        part: ["snippet", "status", "contentDetails"],
        requestBody: {
          snippet: {
            title: `${section.content.title} - ${title}`,
            description: description || "",
            scheduledStartTime,
          },
          status: {
            privacyStatus: "unlisted",
            selfDeclaredMadeForKids: false,
          },
          contentDetails: {
            enableAutoStart: true,
            enableAutoStop: true,
            enableLowLatency: true,
            latencyPreference: "ultraLow",
            enableDvr: true,
            recordFromStart: true,
          },
        },
      })
      
      console.log("Broadcast creation response:", JSON.stringify(broadcastResponse.data))
      
      if (!broadcastResponse.data || !broadcastResponse.data.id) {
        return NextResponse.json({ message: "Failed to create live broadcast" }, { status: 500 })
      }
    } catch (error) {
      console.error("YouTube broadcast creation detailed error:", JSON.stringify(error, null, 2))
      throw error
    }

    // Create a live stream
    const streamResponse = await youtube.liveStreams.insert({
      part: ["snippet", "cdn"],
      requestBody: {
        snippet: {
          title: `${section.content.title} - ${title} (Stream)`,
        },
        cdn: {
          frameRate: "variable",
          resolution: "variable",
          ingestionType: "rtmp",
        },
      },
    })

    if (!streamResponse.data || !streamResponse.data.id) {
      return NextResponse.json({ message: "Failed to create live stream" }, { status: 500 })
    }

    // Bind the broadcast to the stream
    await youtube.liveBroadcasts.bind({
      id: broadcastResponse.data.id,
      part: ["id", "snippet"],
      streamId: streamResponse.data.id,
    })

    // Get the highest order and add 1
    const highestOrderLecture = await prisma.lecture.findFirst({
      where: {
        sectionId,
      },
      orderBy: {
        order: "desc",
      },
      select: {
        order: true,
      },
    })

    const order = highestOrderLecture ? highestOrderLecture.order + 1 : 0

    // Create the lecture in the database
    const lecture = await prisma.lecture.create({
      data: {
        title,
        description,
        type: "LIVE",
        videoId: broadcastResponse.data.id,
        isPreview: isPreview || false,
        liveStatus: scheduledStartTime ? "SCHEDULED" : "LIVE",
        scheduledAt: scheduledStartTime ? new Date(scheduledStartTime) : undefined,
        order,
        section: {
          connect: { id: sectionId },
        },
        streamData: {
          streamId: streamResponse.data.id,
          streamKey: streamResponse.data.cdn?.ingestionInfo?.streamName,
          streamUrl: streamResponse.data.cdn?.ingestionInfo?.ingestionAddress,
        },
      },
    })

    // Invalidate cache
    await redis.del(`course:${section.content.id}`)

    return NextResponse.json({
      success: true,
      lectureId: lecture.id,
      broadcastId: broadcastResponse.data.id,
      streamId: streamResponse.data.id,
      streamKey: streamResponse.data.cdn?.ingestionInfo?.streamName,
      streamUrl: streamResponse.data.cdn?.ingestionInfo?.ingestionAddress,
    })
  } catch (error) {
    console.error("Error creating live stream:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to create live stream",
      },
      { status: 500 },
    )
  }
}
