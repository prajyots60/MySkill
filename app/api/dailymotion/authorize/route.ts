import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { encrypt } from "@/lib/encryption"

const DAILYMOTION_AUTH_URL = "https://api.dailymotion.com/oauth/authorize"

/**
 * This endpoint redirects the user to Dailymotion's authorization page
 */
export async function GET(request: Request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: "Not authenticated" 
      }, { status: 401 })
    }
    
    // Generate state parameter for security (prevents CSRF attacks)
    const state = Buffer.from(JSON.stringify({
      userId: session.user.id,
      timestamp: Date.now()
    })).toString('base64')
    
    // Get the hostname for constructing the redirect URI
    const url = new URL(request.url)
    const hostname = url.origin
    
    // Construct the redirect URI
    const redirectUri = `${hostname}/api/dailymotion/callback`
    
    // Generate the authorization URL
    const authUrl = getAuthorizationUrl(redirectUri, state)
    
    // Store the state in the session or database for verification later
    // This is a simple example - you might want to use a more secure method
    await fetch(`${hostname}/api/dailymotion/store-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ state, userId: session.user.id })
    })
    
    // Redirect the user to Dailymotion's authorization page
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error("Error creating Dailymotion authorization URL:", error)
    return NextResponse.json({ 
      error: "Failed to create authorization URL" 
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get API credentials from request body
    const { apiKey, apiSecret } = await request.json()

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "API Key and Secret are required" },
        { status: 400 }
      )
    }

    // Generate a random state parameter for CSRF protection
    const state = crypto.randomUUID()

    // Store the state and user ID in Redis with a 10-minute expiration
    await redis.set(`dailymotion:auth:state:${state}`, session.user.id, {
      ex: 600, // 10 minutes
    })

    // Store encrypted credentials in Redis temporarily
    const encryptedCredentials = {
      apiKey: encrypt(apiKey),
      apiSecret: encrypt(apiSecret),
    }
    await redis.set(
      `dailymotion:auth:credentials:${state}`,
      JSON.stringify(encryptedCredentials),
      { ex: 600 }
    )

    // Construct the authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: apiKey,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/dailymotion/callback`,
      scope: "manage_videos manage_playlists",
      state,
    })

    const authorizationUrl = `${DAILYMOTION_AUTH_URL}?${params.toString()}`

    return NextResponse.json({ authorizationUrl })
  } catch (error) {
    console.error("Error initiating Dailymotion authorization:", error)
    return NextResponse.json(
      { error: "Failed to initiate authorization" },
      { status: 500 }
    )
  }
}