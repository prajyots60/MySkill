import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { getAuthUrl } from "@/lib/server/gdrive"

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
    await redis.del(`gdrive:connection:${session.user.id}`)
    await redis.del(`gdrive:client:${session.user.id}`)
    await redis.del(`user:${session.user.id}`)
    
    // Delete any existing Google Drive tokens
    await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider: "google-drive",
      },
    })
    
    // Delete any legacy Google tokens that might have Drive scopes
    await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider: "google",
        scope: {
          contains: "drive",
        },
      },
    })

    // Get the authorization URL
    const authUrl = getAuthUrl(session.user.id)
    
    // Redirect to the Google Drive OAuth consent screen
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error("Error in Google Drive reconnect:", error)
    return NextResponse.redirect(new URL("/dashboard/creator?error=gdrive_reconnect_failed", request.url))
  }
}