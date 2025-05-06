import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { google } from "googleapis"
import { getTokensFromCode, getUserInfo } from "@/lib/server/gdrive"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/auth/signin", request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const error = searchParams.get("error")
    const state = searchParams.get("state")

    if (error) {
      console.error("Google Drive OAuth error:", error)
      return NextResponse.redirect(new URL("/dashboard/creator?error=gdrive_connection_failed", request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL("/dashboard/creator?error=no_code", request.url))
    }

    // Validate state matches user ID for security
    if (state !== session.user.id) {
      console.error("State mismatch in Google Drive callback")
      return NextResponse.redirect(new URL("/dashboard/creator?error=invalid_state", request.url))
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/gdrive/callback`,
    )

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code)
    const { access_token, refresh_token, expiry_date } = tokens

    if (!access_token) {
      return NextResponse.redirect(new URL("/dashboard/creator?error=no_token", request.url))
    }

    // Check if user already has a Google Drive account
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google-drive", // Changed from "google" to "google-drive"
      },
    })

    if (existingAccount) {
      // Update existing account
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          access_token: access_token as string,
          refresh_token: refresh_token as string,
          expires_at: expiry_date ? Math.floor(expiry_date / 1000) : undefined,
          scope: "https://www.googleapis.com/auth/drive.file",
        },
      })
    } else {
      // Create new account
      await prisma.account.create({
        data: {
          userId: session.user.id,
          type: "oauth",
          provider: "google-drive", // Changed from "google" to "google-drive"
          providerAccountId: session.user.id, // Using user ID as provider account ID
          access_token: access_token as string,
          refresh_token: refresh_token as string,
          expires_at: expiry_date ? Math.floor(expiry_date / 1000) : undefined,
          token_type: "Bearer",
          scope: "https://www.googleapis.com/auth/drive.file",
        },
      })
    }

    // Update user's Google Drive connection status
    await prisma.user.update({
      where: { id: session.user.id },
      data: { gdriveConnected: true },
    })

    // Invalidate any existing cache
    await redis.del(`gdrive:connection:${session.user.id}`)
    await redis.del(`gdrive:client:${session.user.id}`)

    // Get user info to cache
    try {
      oauth2Client.setCredentials(tokens)
      
      // Get user info and storage quota
      const userInfo = await getUserInfo(session.user.id)
      
      // Cache the connection status and details
      await redis.set(
        `gdrive:connection:${session.user.id}`,
        JSON.stringify({
          connected: true,
          details: {
            ...userInfo,
            connectedAt: new Date().toISOString(),
          },
        }),
        { ex: 60 * 60 }, // 1 hour
      )
    } catch (error) {
      console.error("Error fetching Google Drive user info:", error)
    }

    return NextResponse.redirect(new URL("/dashboard/creator?success=gdrive_connected", request.url))
  } catch (error) {
    console.error("Error in Google Drive callback:", error)
    return NextResponse.redirect(new URL("/dashboard/creator?error=gdrive_connection_failed", request.url))
  }
}