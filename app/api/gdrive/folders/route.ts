import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { createDriveFolder } from "@/lib/server/gdrive"

// Create a new folder in Google Drive
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can create folders" }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { folderName, parentFolderId } = body

    if (!folderName) {
      return NextResponse.json({ message: "Folder name is required" }, { status: 400 })
    }

    // Create a folder in Google Drive
    const result = await createDriveFolder(session.user.id, folderName, parentFolderId)

    return NextResponse.json({
      success: true,
      folder: result
    })
  } catch (error) {
    console.error("Error creating folder in Google Drive:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to create folder" },
      { status: 500 },
    )
  }
}