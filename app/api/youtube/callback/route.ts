import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { google } from "googleapis"
import { SCOPES } from "@/lib/youtube"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/auth/signin", request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    if (error) {
      console.error("YouTube OAuth error:", error)
      return NextResponse.redirect(new URL("/dashboard/creator?error=youtube_connection_failed", request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL("/dashboard/creator?error=no_code", request.url))
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/youtube/callback`,
    )

    const { tokens } = await oauth2Client.getToken(code)
    const { access_token, refresh_token, expiry_date } = tokens

    if (!access_token) {
      return NextResponse.redirect(new URL("/dashboard/creator?error=no_token", request.url))
    }

    // Check if user already has a YouTube account
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google-youtube", // Changed from "google" to "google-youtube"
      },
    })

    // Create a scopes string with all required YouTube scopes
    const scopesString = SCOPES.join(' ')

    if (existingAccount) {
      // Update existing account
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          access_token: access_token as string,
          refresh_token: refresh_token as string,
          expires_at: expiry_date ? Math.floor(expiry_date / 1000) : undefined,
          scope: scopesString,
        },
      })
    } else {
      // Create new account
      await prisma.account.create({
        data: {
          userId: session.user.id,
          type: "oauth",
          provider: "google-youtube", // Changed from "google" to "google-youtube"
          providerAccountId: session.user.id, // Using user ID as provider account ID
          access_token: access_token as string,
          refresh_token: refresh_token as string,
          expires_at: expiry_date ? Math.floor(expiry_date / 1000) : undefined,
          token_type: "Bearer",
          scope: scopesString,
        },
      })
    }

    // Update user's YouTube connection status
    await prisma.user.update({
      where: { id: session.user.id },
      data: { youtubeConnected: true },
    })

    // Invalidate any existing cache
    await redis.del(`youtube:connection:${session.user.id}`)
    await redis.del(`youtube:client:${session.user.id}`)

    // Get channel details to cache
    try {
      oauth2Client.setCredentials(tokens)
      const youtube = google.youtube({ version: "v3", auth: oauth2Client })

      const response = await youtube.channels.list({
        part: ["snippet"],
        mine: true,
      })

      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0]
        const channelDetails = {
          channelId: channel.id,
          channelName: channel.snippet?.title,
          thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
          connectedAt: new Date().toISOString(),
        }

        // Cache the connection status
        await redis.set(
          `youtube:connection:${session.user.id}`,
          JSON.stringify({
            connected: true,
            details: channelDetails,
          }),
          { ex: 60 * 60 }, // 1 hour
        )
      }
    } catch (error) {
      console.error("Error fetching YouTube channel details:", error)
    }

    return NextResponse.redirect(new URL("/dashboard/creator?success=youtube_connected", request.url))
  } catch (error) {
    console.error("Error in YouTube callback:", error)
    return NextResponse.redirect(new URL("/dashboard/creator?error=youtube_connection_failed", request.url))
  }
}
