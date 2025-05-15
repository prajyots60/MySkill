import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getValidAccessToken } from "@/lib/dailymotion"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const videoUrl = formData.get("videoUrl") as string

    // The videoUrl is essential - it's the URL returned from Dailymotion's upload endpoint
    if (!videoUrl) {
      return NextResponse.json({ error: "No video URL provided" }, { status: 400 })
    }

    // Optional metadata
    const title = formData.get("title") as string || "Untitled Video"
    const description = formData.get("description") as string || ""
    const tags = formData.get("tags") as string || ""
    const private_ = formData.get("private") === "true"
    const is_created_for_kids = formData.get("is_created_for_kids") === "true"
    const channel = formData.get("channel") as string || ""
    const published = formData.get("published") !== "false" // Default to true

    const accessToken = await getValidAccessToken(session.user.id)

    // Create the video using the uploaded video URL
    console.log("Creating video on Dailymotion...")
    const createVideoResponse = await fetch("https://api.dailymotion.com/me/videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        url: videoUrl,
        title,
        description,
        tags,
        private: private_.toString(),
        is_created_for_kids: is_created_for_kids.toString(),
        channel,
        published: published.toString(),
      }),
    })

    if (!createVideoResponse.ok) {
      const errorData = await createVideoResponse.json().catch(() => ({}))
      console.error("Failed to create video:", errorData)
      return NextResponse.json(
        { error: `Failed to create video: ${errorData.error_description || 'Unknown error'}` }, 
        { status: createVideoResponse.status }
      )
    }

    const videoData = await createVideoResponse.json()
    console.log("Video created successfully:", videoData)

    return NextResponse.json({
      success: true,
      video: videoData,
    })
  } catch (error) {
    console.error("Error creating video:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create video" },
      { status: 500 }
    )
  }
}

// Get upload URL from Dailymotion
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accessToken = await getValidAccessToken(session.user.id)

    // Get upload URL from Dailymotion
    console.log("Requesting upload URL from Dailymotion...")
    const uploadUrlResponse = await fetch("https://api.dailymotion.com/file/upload", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!uploadUrlResponse.ok) {
      const errorData = await uploadUrlResponse.json().catch(() => ({}))
      console.error("Failed to get upload URL:", errorData)
      return NextResponse.json(
        { error: `Failed to get upload URL: ${errorData.error_description || 'Unknown error'}` },
        { status: uploadUrlResponse.status }
      )
    }

    const uploadUrlData = await uploadUrlResponse.json()
    console.log("Upload URL response:", uploadUrlData)

    return NextResponse.json({
      success: true,
      uploadUrl: uploadUrlData.upload_url,
      progressUrl: uploadUrlData.progress_url,
    })
  } catch (error) {
    console.error("Error getting upload URL:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get upload URL" },
      { status: 500 }
    )
  }
}