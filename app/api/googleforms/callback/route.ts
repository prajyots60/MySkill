import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { google } from "googleapis"
import { getTokensFromCode } from "@/lib/server/gforms"

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
      console.error("Google Forms OAuth error:", error)
      return NextResponse.redirect(new URL("/dashboard/creator?error=googleforms_connection_failed", request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL("/dashboard/creator?error=no_code", request.url))
    }

    // Validate state matches user ID for security
    if (state !== session.user.id) {
      console.error("State mismatch in Google Forms callback")
      return NextResponse.redirect(new URL("/dashboard/creator?error=invalid_state", request.url))
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/googleforms/callback`,
    )

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code)
    const { access_token, refresh_token, expiry_date } = tokens

    if (!access_token) {
      return NextResponse.redirect(new URL("/dashboard/creator?error=no_token", request.url))
    }

    // Check if user already has a Google account with forms scope
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
        scope: {
          contains: "forms.body"
        }
      },
    })

    if (existingAccount) {
      // Update existing account
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          access_token: access_token as string,
          refresh_token: refresh_token as string || existingAccount.refresh_token,
          expires_at: expiry_date ? Math.floor(expiry_date / 1000) : existingAccount.expires_at,
          scope: existingAccount.scope + " https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/forms.responses.readonly",
        },
      })
    } else {
      // Check if there's a generic Google account we can update
      const googleAccount = await prisma.account.findFirst({
        where: {
          userId: session.user.id,
          provider: "google",
        },
      })

      if (googleAccount) {
        // Update existing Google account to add forms scopes
        const currentScopes = googleAccount.scope?.split(" ") || []
        const formsScopes = [
          "https://www.googleapis.com/auth/forms.body",
          "https://www.googleapis.com/auth/forms.responses.readonly",
          "https://www.googleapis.com/auth/spreadsheets",
        ]
        const newScopes = [...new Set([...currentScopes, ...formsScopes])]
        
        await prisma.account.update({
          where: { id: googleAccount.id },
          data: {
            access_token: access_token as string,
            refresh_token: refresh_token as string || googleAccount.refresh_token,
            expires_at: expiry_date ? Math.floor(expiry_date / 1000) : googleAccount.expires_at,
            scope: newScopes.join(" "),
          },
        })
      } else {
        // Create new account
        await prisma.account.create({
          data: {
            userId: session.user.id,
            type: "oauth",
            provider: "google",
            providerAccountId: session.user.id,
            access_token: access_token as string,
            refresh_token: refresh_token as string,
            expires_at: expiry_date ? Math.floor(expiry_date / 1000) : undefined,
            token_type: "Bearer",
            scope: "https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/forms.responses.readonly https://www.googleapis.com/auth/spreadsheets",
          },
        })
      }
    }

    // Invalidate any existing cache
    await redis.del(`gforms:connection:${session.user.id}`)

    return NextResponse.redirect(new URL("/dashboard/creator/service-connections?success=googleforms_connected", request.url))
  } catch (error) {
    console.error("Error in Google Forms callback:", error)
    return NextResponse.redirect(new URL("/dashboard/creator?error=googleforms_connection_failed", request.url))
  }
}