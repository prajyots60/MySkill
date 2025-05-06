import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { 
  uploadFileToDrive, 
  listDriveFiles, 
  downloadDriveFile, 
  deleteDriveFile,
  createDriveFolder
} from "@/lib/server/gdrive"

// Upload a file to Google Drive
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can upload files" }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get("file") as File
    const filename = formData.get("filename") as string || file.name
    const folderId = formData.get("folderId") as string || undefined
    const mimeType = file.type || "application/octet-stream"

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Google Drive
    const result = await uploadFileToDrive(session.user.id, buffer, {
      name: filename,
      mimeType,
      folderId
    })

    return NextResponse.json({
      success: true,
      file: result
    })
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 500 },
    )
  }
}

// Get files from Google Drive
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get("folderId") || undefined
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize") as string, 10) : 100
    const pageToken = searchParams.get("pageToken") || undefined
    const query = searchParams.get("query") || undefined

    // List files from Google Drive
    const result = await listDriveFiles(session.user.id, {
      folderId: folderId || undefined,
      pageSize,
      pageToken: pageToken || undefined,
      query: query || undefined
    })

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error("Error listing Google Drive files:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to list files" },
      { status: 500 },
    )
  }
}