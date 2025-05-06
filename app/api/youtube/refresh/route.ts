import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { getYouTubeClient } from "@/lib/youtube"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Only creators can refresh video service connection" },
        { status: 403 },
      )
    }

    // Check if user has a Google account with YouTube scope
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
        scope: {
          contains: "youtube",
        },
      },
    })

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "No video service connection found. Please connect your account first.",
        },
        { status: 404 },
      )
    }

    // Try to refresh the connection by making a test API call
    try {
      const youtube = await getYouTubeClient(session.user.id)
      const response = await youtube.channels.list({
        part: ["snippet"],
        mine: true,
      })

      let channelDetails = null

      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0]
        channelDetails = {
          channelId: channel.id,
          channelName: channel.snippet?.title,
          thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
        }
      }

      // Update user's YouTube connection status
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          youtubeConnected: true,
        },
      })

      // Update cache
      const cacheKey = `youtube:connection:${session.user.id}`
      await redis.set(
        cacheKey,
        JSON.stringify({
          connected: true,
          details: channelDetails,
        }),
        {
          ex: 60 * 60, // 1 hour
        },
      )

      return NextResponse.json({
        success: true,
        message: "Video service connection refreshed successfully",
        details: channelDetails,
      })
    } catch (error) {
      console.error("Error refreshing YouTube connection:", error)

      // If refresh failed, the token might be invalid
      return NextResponse.json(
        {
          success: false,
          message: "Failed to refresh connection. Please reconnect your account.",
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Error in refresh endpoint:", error)
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}
