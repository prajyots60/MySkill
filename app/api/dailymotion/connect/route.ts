"use server"

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { connectUserToDailymotion } from "@/lib/server/dailymotion"

/**
 * This route connects a user to Dailymotion using client credentials flow.
 * No user authentication with Dailymotion is needed since we're using a public API key.
 */
export async function GET() {
  try {
    // Get the user session
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can connect to Dailymotion" }, { status: 403 })
    }

    // Connect the user to Dailymotion with client credentials flow
    await connectUserToDailymotion(session.user.id)
    
    // Redirect back to the service connections page with success
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/creator/service-connections?connected=dailymotion`)
  } catch (error) {
    console.error("Error connecting to Dailymotion:", error)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/creator/service-connections?error=connection_failed`)
  }
}