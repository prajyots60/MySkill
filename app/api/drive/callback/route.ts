import { NextRequest, NextResponse } from "next/server"
import { getTokensFromCode, getDriveInfo, SCOPES } from "@/lib/server/drive"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { google } from "googleapis"

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const state = searchParams.get("state") // This should be the user ID
    const error = searchParams.get("error")

    // Check if there was an error in the OAuth process
    if (error) {
      console.error("Google OAuth error:", error)
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/creator/service-connections?error=${error}`)
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/creator/service-connections?error=missing_params`
      )
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code)
    if (!tokens || !tokens.access_token) {
      console.error("Failed to get tokens from code")
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/creator/service-connections?error=token_error`
      )
    }

    // Get user from state (user ID)
    const userId = state

    // Get account for this user or create if not exists
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
        OR: [
          { scope: { contains: "https://www.googleapis.com/auth/drive" } },
          { scope: { contains: "https://www.googleapis.com/auth/drive.file" } }
        ]
      },
    })

    // Create OAuth2 client with the received tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/drive/callback`
    )
    oauth2Client.setCredentials(tokens)
    
    // Get Drive information using the new tokens
    const driveClient = google.drive({ version: "v3", auth: oauth2Client })
    const driveInfo = await driveClient.about.get({
      fields: "user,storageQuota"
    })

    // Update user with Drive information
    await prisma.user.update({
      where: { id: userId },
      data: {
        driveConnected: true,
        driveEmail: driveInfo.data.user?.emailAddress,
        driveQuota: driveInfo.data.storageQuota ? {
          limit: driveInfo.data.storageQuota.limit,
          usage: driveInfo.data.storageQuota.usage,
          usageInDrive: driveInfo.data.storageQuota.usageInDrive,
          usageInDriveTrash: driveInfo.data.storageQuota.usageInDriveTrash
        } : undefined,
        driveConnectedAt: new Date(), // Add the connection timestamp
      },
    })

    // Update or create account with tokens
    const driveScopes = SCOPES || [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.metadata.readonly"
    ]

    if (account) {
      // Update existing account
      const currentScopes = account.scope?.split(" ") || []
      const newScopes = [...new Set([...currentScopes, ...driveScopes])]
      const newScopeStr = newScopes.join(" ")

      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          scope: newScopeStr,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || account.refresh_token, // Keep existing refresh token if no new one
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : account.expires_at,
        },
      })
    } else {
      // This should be rare, but create a new account if none exists
      await prisma.account.create({
        data: {
          userId,
          type: "oauth",
          provider: "google",
          providerAccountId: userId, // We should ideally get the Google ID from the token info
          scope: driveScopes.join(" "),
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || "", // This might be null, handle it
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        },
      })
    }

    // Clear any cached data
    await redis.del(`drive:connection:${userId}`)

    // Redirect to dashboard with success message
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/creator/service-connections?status=success`
    )
  } catch (error) {
    console.error("Error handling Google Drive callback:", error)
    
    // Safely extract error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : 'unknown_error';
    
    // Redirect with error
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/creator/service-connections?error=${encodeURIComponent(errorMessage)}`
    )
  }
}