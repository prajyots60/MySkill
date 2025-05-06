import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import { getUserInfo } from "@/lib/server/gdrive"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Only creators can refresh Google Drive connection" },
        { status: 403 },
      )
    }

    // Check if user has a Google account with Drive scope
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
        scope: {
          contains: "drive",
        },
      },
    })

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: "No Google Drive connection found. Please connect your account first.",
        },
        { status: 404 },
      )
    }

    // Try to refresh the connection by making a test API call
    try {
      // Get user info and storage quota
      const userInfo = await getUserInfo(session.user.id)

      // Update user's Google Drive connection status
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          gdriveConnected: true,
        },
      })

      // Update cache
      const cacheKey = `gdrive:connection:${session.user.id}`
      await redis.set(
        cacheKey,
        JSON.stringify({
          connected: true,
          details: {
            ...userInfo,
            connectedAt: new Date().toISOString(),
          },
        }),
        {
          ex: 60 * 60, // 1 hour
        },
      )

      return NextResponse.json({
        success: true,
        message: "Google Drive connection refreshed successfully",
        details: userInfo,
      })
    } catch (error) {
      console.error("Error refreshing Google Drive connection:", error)

      // If refresh failed, the token might be invalid
      return NextResponse.json(
        {
          success: false,
          message: "Failed to refresh connection. Please reconnect your account.",
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Error in refresh endpoint:", error)
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}