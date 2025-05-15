import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

/**
 * This endpoint initiates a reconnection to Dailymotion by
 * clearing any existing connection and redirecting to the authorization endpoint
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

    const userId = session.user.id

    try {
      // Delete any existing connection data
      await prisma.$transaction(async (tx) => {
        // Update User model
        await tx.user.update({
          where: { id: userId },
          data: {
            dailymotionConnected: false,
          },
        })

        // Delete any existing Dailymotion info
        await tx.dailymotionInfo.deleteMany({
          where: { userId },
        })
      })

      // Clear any cached token and connection status
      await redis.del(`dailymotion:token:${userId}`)
      await redis.del(`dailymotion:connection:${userId}`)

      console.log('🔍 Dailymotion - Successfully cleared connection for user:', userId)
    } catch (dbError) {
      console.error('🔍 Dailymotion - Error clearing existing connection:', dbError)
    }

    // Redirect to the authorization endpoint to start the OAuth flow
    const url = new URL(request.url)
    return NextResponse.redirect(`${url.origin}/api/dailymotion/authorize`)
  } catch (error) {
    console.error("Error reconnecting to Dailymotion:", error)
    return NextResponse.json({
      error: "Failed to reconnect"
    }, { status: 500 })
  }
}