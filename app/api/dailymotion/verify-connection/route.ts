import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getValidAccessToken } from "@/lib/server/dailymotion"

/**
 * This endpoint checks if your Dailymotion account is properly connected
 * and shows the connection details including token information
 */
export async function GET() {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        message: "Not authenticated, please login first"
      }, { status: 401 })
    }

    // Check database connection status
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        dailymotionConnected: true,
      }
    })
    
    // Get saved token information from the database
    const dailymotionInfo = await prisma.dailymotionInfo.findUnique({
      where: { userId: session.user.id }
    })
    
    // Get a valid access token (will refresh if needed)
    let accessToken = null
    let tokenError = null
    try {
      accessToken = await getValidAccessToken(session.user.id)
    } catch (error) {
      tokenError = String(error)
    }
    
    // Test the token by making a call to the Dailymotion API
    let apiTestResult = null
    if (accessToken) {
      try {
        // Try to get info about the token
        const tokenInfoResponse = await fetch("https://api.dailymotion.com/oauth/info", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })
        
        if (tokenInfoResponse.ok) {
          apiTestResult = {
            success: true,
            status: tokenInfoResponse.status,
            data: await tokenInfoResponse.json()
          }
        } else {
          apiTestResult = {
            success: false,
            status: tokenInfoResponse.status,
            error: await tokenInfoResponse.text()
          }
        }
      } catch (error) {
        apiTestResult = {
          success: false,
          error: String(error)
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      connectionStatus: {
        databaseConnectionFlag: !!user?.dailymotionConnected,
        tokenInDatabase: !!dailymotionInfo?.accessToken,
        tokenExpiry: dailymotionInfo?.expiresAt ? new Date(dailymotionInfo.expiresAt).toISOString() : null,
        tokenValidNow: !!accessToken,
        tokenError: tokenError
      },
      tokenInfo: {
        partialToken: accessToken ? `${accessToken.substring(0, 10)}...` : null,
        apiTestResult
      },
      savedAccountDetails: dailymotionInfo ? {
        userId: dailymotionInfo.dailymotionUserId,
        username: dailymotionInfo.username,
        scope: dailymotionInfo.scope
      } : null
    }, { status: 200 })
    
  } catch (error) {
    console.error("Error checking Dailymotion connection:", error)
    return NextResponse.json({ 
      success: false,
      message: "Failed to check connection",
      error: String(error)
    }, { status: 500 })
  }
}