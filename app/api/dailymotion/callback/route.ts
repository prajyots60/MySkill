import { NextResponse } from "next/server"
import { redis } from "@/lib/redis"
import { prisma } from "@/lib/db"
import { decrypt } from "@/lib/encryption"

const DAILYMOTION_TOKEN_URL = "https://api.dailymotion.com/oauth/token"

interface DailymotionCredentials {
  apiKey: string
  apiSecret: string
}

/**
 * This endpoint handles the callback from Dailymotion's authorization page
 */
export async function GET(request: Request) {
  try {
    // Get the query parameters from the callback URL
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const error = url.searchParams.get("error")
    const errorDescription = url.searchParams.get("error_description")

    // Check if there was an error in the authorization
    if (error) {
      console.error(`Dailymotion auth error: ${error}`, errorDescription)
      return NextResponse.redirect(
        `${url.origin}/dashboard/creator/service-connections?error=dailymotion_auth_failed&message=${encodeURIComponent(
          errorDescription || "Authorization failed"
        )}`
      )
    }

    // Check if code and state are present
    if (!code || !state) {
      return NextResponse.redirect(
        `${url.origin}/dashboard/creator/service-connections?error=missing_parameters&message=${encodeURIComponent(
          "Missing authorization parameters"
        )}`
      )
    }

    // Verify the state parameter to prevent CSRF attacks
    const userId = await redis.get(`dailymotion:auth:state:${state}`)
    const credentialsJson = await redis.get(`dailymotion:auth:credentials:${state}`)

    if (!userId || !credentialsJson) {
      return NextResponse.redirect(
        `${url.origin}/dashboard/creator/service-connections?error=invalid_state&message=${encodeURIComponent(
          "Invalid or expired authorization attempt"
        )}`
      )
    }

    // Delete the state and credentials from Redis as they're no longer needed
    await redis.del(`dailymotion:auth:state:${state}`)
    await redis.del(`dailymotion:auth:credentials:${state}`)

    // Parse the stored credentials
    let credentials: DailymotionCredentials
    try {
      const parsedCredentials = typeof credentialsJson === 'string' ? JSON.parse(credentialsJson) : credentialsJson
      if (!parsedCredentials || typeof parsedCredentials !== 'object') {
        throw new Error('Invalid credentials format')
      }
      if (!parsedCredentials.apiKey || !parsedCredentials.apiSecret) {
        throw new Error('Missing required credentials')
      }
      credentials = parsedCredentials as DailymotionCredentials
    } catch (e) {
      console.error('Error parsing credentials:', e)
      return NextResponse.redirect(
        `${url.origin}/dashboard/creator/service-connections?error=invalid_credentials&message=${encodeURIComponent(
          "Failed to parse stored credentials"
        )}`
      )
    }

    const apiKey = decrypt(credentials.apiKey)
    const apiSecret = decrypt(credentials.apiSecret)

    // Exchange the authorization code for an access token
    const tokenResponse = await fetch(DAILYMOTION_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: apiKey,
        client_secret: apiSecret,
        code,
        redirect_uri: `${url.origin}/api/dailymotion/callback`,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error(`Failed to exchange code for token: ${await tokenResponse.text()}`)
    }

    const tokenData = await tokenResponse.json()

    // Get user info from Dailymotion
    const userResponse = await fetch("https://api.dailymotion.com/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    if (!userResponse.ok) {
      throw new Error("Failed to get user info from Dailymotion")
    }

    const userData = await userResponse.json()

    // Store the connection in the database
    await prisma.$transaction(async (tx) => {
      // Create or update DailymotionInfo
      const dailymotionInfo = await tx.dailymotionInfo.upsert({
        where: { userId },
        create: {
          userId,
          dailymotionUserId: userData.id,
          username: userData.username,
          screenname: userData.screenname,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          profilePictureUrl: userData.avatar_720_url,
          scope: tokenData.scope,
        },
        update: {
          dailymotionUserId: userData.id,
          username: userData.username,
          screenname: userData.screenname,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          profilePictureUrl: userData.avatar_720_url,
          scope: tokenData.scope,
        },
      })

      // Store encrypted API credentials
      await tx.dailymotionCredentials.upsert({
        where: { dailymotionInfoId: dailymotionInfo.id },
        create: {
          dailymotionInfoId: dailymotionInfo.id,
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
        },
        update: {
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
        },
      })

      // Update user's connection status
      await tx.user.update({
        where: { id: userId },
        data: { dailymotionConnected: true },
      })
    })

    // Redirect back to the service connections page with success
    return NextResponse.redirect(
      `${url.origin}/dashboard/creator/service-connections?success=dailymotion_connected`
    )
  } catch (error) {
    console.error("Error in Dailymotion callback:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

    // Redirect back to the service connections page with an error message
    const url = new URL(request.url)
    return NextResponse.redirect(
      `${url.origin}/dashboard/creator/service-connections?error=dailymotion_callback_error&message=${encodeURIComponent(
        errorMessage
      )}`
    )
  }
}