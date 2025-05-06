import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { decodeVideoId } from "@/lib/utils/video-security"

// This endpoint acts as a proxy for YouTube video data
// It fetches video metadata without exposing the actual video ID to the client
export async function GET(request: Request) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ message: "Token is required" }, { status: 400 })
    }

    // Decode the token to get the video ID
    const videoId = decodeVideoId(token)

    if (!videoId) {
      return NextResponse.json({ message: "Invalid or expired token" }, { status: 403 })
    }

    // Fetch video metadata from YouTube API
    // Note: In a production environment, you would use the YouTube API with proper API keys
    // For this example, we're just returning basic metadata
    const videoMetadata = {
      // We don't include the actual videoId in the response
      title: "Secure Video Content",
      duration: 0, // This would come from the actual API
      thumbnail: "/placeholder.svg?height=480&width=640",
      // Other metadata without exposing the video ID
    }

    return NextResponse.json(videoMetadata)
  } catch (error) {
    console.error("Error fetching video metadata:", error)
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to fetch video metadata",
      },
      { status: 500 },
    )
  }
}
