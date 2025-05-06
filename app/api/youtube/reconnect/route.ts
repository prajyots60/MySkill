import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getAuthUrl } from "@/lib/youtube"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/auth/signin", request.url))
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard/creator?error=not_creator", request.url))
    }

    // Clear cached data
    await redis.del(`youtube:connection:${session.user.id}`)
    await redis.del(`youtube:client:${session.user.id}`)
    await redis.del(`user:${session.user.id}`)
    
    // Delete any existing Google YouTube tokens
    await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider: "google-youtube",
      },
    })
    
    // Delete any legacy Google tokens that might have YouTube scopes
    await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider: "google",
        scope: {
          contains: "youtube",
        },
      },
    })

    // Get the authorization URL
    const authUrl = getAuthUrl()
    
    // Redirect to the YouTube OAuth consent screen
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error("Error in YouTube reconnect:", error)
    return NextResponse.redirect(new URL("/dashboard/creator?error=youtube_reconnect_failed", request.url))
  }
}