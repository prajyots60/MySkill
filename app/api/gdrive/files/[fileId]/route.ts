import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { deleteDriveFile } from "@/lib/server/gdrive"

// Delete a file from Google Drive
export async function DELETE(request: Request, { params }: { params: { fileId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can delete files" }, { status: 403 })
    }

    const fileId = params.fileId
    
    if (!fileId) {
      return NextResponse.json({ message: "File ID is required" }, { status: 400 })
    }

    // Delete the file
    await deleteDriveFile(session.user.id, fileId)
    
    return NextResponse.json({
      success: true,
      message: "File deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting file from Google Drive:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to delete file" },
      { status: 500 },
    )
  }
}