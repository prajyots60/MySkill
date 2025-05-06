import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Extract parameters from the request
    const { uploadUrl, chunk, contentRange, contentType, accessToken } = await request.json()

    if (!uploadUrl || !chunk || !contentRange || !contentType || !accessToken) {
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 })
    }

    // Decode the base64 chunk data
    const binaryChunk = Buffer.from(chunk, 'base64')

    // Forward the chunk to YouTube (proxy the request)
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Range": contentRange,
        "Authorization": `Bearer ${accessToken}`
      },
      body: binaryChunk
    })

    // Get the response data
    let responseData = null
    let responseText = null
    
    // For successful responses, try to extract the video ID
    if (response.status === 200 || response.status === 201) {
      try {
        responseData = await response.json()
      } catch (e) {
        // If not JSON, get as text
        responseText = await response.text()
      }
    }

    // Return the proxy response
    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      text: responseText,
    })
  } catch (error) {
    console.error("YouTube chunk upload proxy error:", error)
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to proxy chunk to YouTube" 
      },
      { status: 500 }
    )
  }
}