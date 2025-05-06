import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { getAuthUrl } from "@/lib/server/gforms"

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
    await redis.del(`gforms:connection:${session.user.id}`)
    
    // Delete any existing Google account with Forms scopes
    await prisma.account.updateMany({
      where: {
        userId: session.user.id,
        provider: "google",
        scope: {
          contains: "forms.body"
        }
      },
      data: {
        scope: "",
      },
    })
    
    // Get the authorization URL
    const authUrl = getAuthUrl(session.user.id)
    
    // Redirect to the Google Forms OAuth consent screen
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error("Error in Google Forms reconnect:", error)
    return NextResponse.redirect(new URL("/dashboard/creator?error=googleforms_reconnect_failed", request.url))
  }
}