import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redis } from "@/lib/redis"

/**
 * This endpoint stores the OAuth state parameter for later verification
 */
export async function POST(request: Request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 })
    }
    
    // Parse the request body
    const body = await request.json()
    const { state, userId } = body
    
    // Verify that the userId in the state matches the authenticated user
    if (userId !== session.user.id) {
      return NextResponse.json({ 
        success: false,
        error: "User ID mismatch" 
      }, { status: 403 })
    }
    
    // Store the state in Redis with a 10-minute expiry
    const stateKey = `dailymotion:auth:state:${state}`
    await redis.set(stateKey, userId, { ex: 600 }) // 10 minutes
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error storing Dailymotion OAuth state:", error)
    return NextResponse.json({ 
      success: false,
      error: "Failed to store auth state" 
    }, { status: 500 })
  }
}