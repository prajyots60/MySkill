import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Process FormData instead of JSON - more efficient for binary data
    const formData = await request.formData()
    
    // Extract parameters from the form data
    const uploadUrl = formData.get('uploadUrl') as string
    const contentRange = formData.get('contentRange') as string
    const contentType = formData.get('contentType') as string
    const accessToken = formData.get('accessToken') as string
    const chunk = formData.get('chunk') as File // This will be the raw binary file chunk
    
    if (!uploadUrl || !chunk || !contentRange || !contentType || !accessToken) {
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 })
    }
    
    // Get binary chunk data - handle potential File, Blob, or Buffer types
    let binaryData;
    try {
      if (chunk instanceof File || chunk instanceof Blob) {
        const arrayBuffer = await chunk.arrayBuffer();
        binaryData = new Uint8Array(arrayBuffer);
      } else {
        // If it's already a buffer or something else, try to use it directly
        throw new Error("Unexpected chunk type");
      }
    } catch (error) {
      console.error("Error processing chunk data:", error);
      throw new Error("Failed to process chunk data");
    }

    // Forward the chunk to YouTube (proxy the request)
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Range": contentRange,
        "Authorization": `Bearer ${accessToken}`
      },
      body: binaryData // Send binary data to YouTube
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