import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { getUserGDriveToken } from "@/lib/server/gdrive-utils"
import { google } from "googleapis"

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()

    if (!session || !session.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Only allow creators and admins to access this API
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 })
    }

    // Get the user's Google Drive token
    const token = await getUserGDriveToken(session.user.id)
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        message: "Google Drive not connected" 
      })
    }

    // Create an OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/gdrive/callback`
    )

    // Set credentials from the token
    oauth2Client.setCredentials(token)

    // Create a Drive client
    const drive = google.drive({
      version: 'v3',
      auth: oauth2Client,
    })

    // Get the user's storage quota
    const about = await drive.about.get({
      fields: 'storageQuota',
    })

    if (about.data?.storageQuota) {
      return NextResponse.json({
        success: true,
        storageQuota: about.data.storageQuota
      })
    } else {
      return NextResponse.json({
        success: false,
        message: "Failed to fetch storage quota"
      })
    }
    
  } catch (error) {
    console.error("Error fetching Google Drive storage:", error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch Google Drive storage"
    }, { status: 500 })
  }
}