import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getValidAccessToken } from "@/lib/server/dailymotion"

/**
 * This endpoint tests various Dailymotion API endpoints
 * to show what data is available with your token
 */
export async function GET() {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: "Not authenticated"
      }, { status: 401 })
    }

    // Get a valid access token
    const accessToken = await getValidAccessToken(session.user.id)
    
    if (!accessToken) {
      return NextResponse.json({ 
        error: "No valid access token found"
      }, { status: 400 })
    }
    
    // Test different Dailymotion API endpoints
    const results = {}
    
    // Base headers for all requests
    const headers = {
      Authorization: `Bearer ${accessToken}`
    }
    
    // 1. Test /me endpoint (user info)
    try {
      const meResponse = await fetch("https://api.dailymotion.com/me", { headers })
      results.me = {
        status: meResponse.status,
        data: await meResponse.json()
      }
    } catch (error) {
      results.me = { error: String(error) }
    }
    
    // 2. Test /videos endpoint
    try {
      const videosResponse = await fetch("https://api.dailymotion.com/videos?limit=5", { headers })
      results.videos = {
        status: videosResponse.status,
        data: await videosResponse.json()
      }
    } catch (error) {
      results.videos = { error: String(error) }
    }
    
    // 3. Test /channels endpoint
    try {
      const channelsResponse = await fetch("https://api.dailymotion.com/channels", { headers })
      results.channels = {
        status: channelsResponse.status,
        data: await channelsResponse.json()
      }
    } catch (error) {
      results.channels = { error: String(error) }
    }
    
    // 4. Test file upload capabilities
    try {
      const uploadResponse = await fetch("https://api.dailymotion.com/file/upload", { headers })
      results.uploadCapabilities = {
        status: uploadResponse.status,
        data: await uploadResponse.json()
      }
    } catch (error) {
      results.uploadCapabilities = { error: String(error) }
    }
    
    // 5. Test info about the token itself
    try {
      const tokenInfoResponse = await fetch("https://api.dailymotion.com/oauth/info?fields=user_id,scopes,expires_in", { headers })
      results.tokenInfo = {
        status: tokenInfoResponse.status,
        data: await tokenInfoResponse.json()
      }
    } catch (error) {
      results.tokenInfo = { error: String(error) }
    }
    
    return NextResponse.json({
      message: "Dailymotion API test results",
      token: accessToken.substring(0, 10) + "...", // Show partial token for debugging
      results
    }, { status: 200 })
    
  } catch (error) {
    console.error("Error testing Dailymotion API:", error)
    return NextResponse.json({ 
      error: "Failed to test Dailymotion API",
      details: String(error)
    }, { status: 500 })
  }
}