import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

/**
 * This endpoint checks the Dailymotion connection status
 * and provides detailed debug information on what might be wrong
 */
export async function GET() {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ 
        connected: false, 
        error: "Not authenticated",
        details: null 
      }, { status: 401 })
    }

    // Clear any cached data to ensure a fresh check
    await redis.del(`dailymotion:connection:${session.user.id}`)
    
    // Directly query the raw user data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        dailymotionConnected: true,
      }
    })
    
    // Check if dailymotionInfo exists
    const dailymotionInfo = await prisma.dailymotionInfo.findUnique({
      where: { userId: session.user.id }
    })

    // Debug info
    const debugInfo = {
      userHasDailymotionConnectedField: 'dailymotionConnected' in (user || {}),
      dailymotionConnectedValue: user?.dailymotionConnected,
      dailymotionInfoExists: !!dailymotionInfo,
      dailymotionInfoValid: dailymotionInfo ? 
        !!dailymotionInfo.accessToken && 
        new Date(dailymotionInfo.expiresAt) > new Date() : 
        false
    }
    
    // If the user doesn't have the dailymotionConnected field or it's false
    // but we have valid dailymotionInfo, we need to fix the user record
    if ((!debugInfo.userHasDailymotionConnectedField || !user?.dailymotionConnected) && 
        debugInfo.dailymotionInfoExists && 
        debugInfo.dailymotionInfoValid) {
      
      // Try to update the user record
      try {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { dailymotionConnected: true }
        })
        
        debugInfo.userUpdated = "User record updated to set dailymotionConnected=true"
      } catch (updateError) {
        debugInfo.updateError = "Failed to update user record: " + String(updateError)
      }
    }

    // Determine connection status
    const isConnected = user?.dailymotionConnected && !!dailymotionInfo
    
    return NextResponse.json({
      connected: isConnected,
      error: null,
      details: isConnected ? {
        connected: true,
        userId: dailymotionInfo?.dailymotionUserId,
        username: dailymotionInfo?.username,
        profilePictureUrl: dailymotionInfo?.profilePictureUrl,
        connectedAt: dailymotionInfo?.connectedAt,
        expiresAt: dailymotionInfo?.expiresAt,
      } : null,
      debug: debugInfo
    }, { status: 200 })
  } catch (error) {
    console.error("Error checking Dailymotion status:", error)
    return NextResponse.json({ 
      connected: false, 
      error: "Failed to check connection",
      details: null,
      errorDetails: String(error)
    }, { status: 500 })
  }
}