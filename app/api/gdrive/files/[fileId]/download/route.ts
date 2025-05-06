import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { downloadDriveFile } from "@/lib/server/gdrive"

// Download a file from Google Drive
export async function GET(request: Request, { params }: { params: { fileId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const fileId = params.fileId
    
    if (!fileId) {
      return NextResponse.json({ message: "File ID is required" }, { status: 400 })
    }

    // Download the file
    const fileBuffer = await downloadDriveFile(session.user.id, fileId)
    
    // You may want to get content type information and filename from additional API calls
    // For simplicity, using application/octet-stream here
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="file-${fileId}"`,
      },
    })
  } catch (error) {
    console.error("Error downloading file from Google Drive:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to download file" },
      { status: 500 },
    )
  }
}