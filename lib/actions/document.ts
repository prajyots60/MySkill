import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { createClient } from "@/lib/supabase"
import { invalidateCache } from "@/lib/redis"

// Upload document
export async function uploadDocument(params: {
  title: string
  description?: string
  file: File
  contentId?: string
  sectionId?: string
  lectureId?: string
}) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" }
    }

    const { title, description, file, contentId, sectionId, lectureId } = params

    // Upload file to Supabase Storage
    const supabase = createClient()
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`
    const filePath = `documents/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage.from("content").upload(filePath, file)

    if (uploadError) {
      console.error("Error uploading file:", uploadError)
      return { success: false, error: "Failed to upload file" }
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("content").getPublicUrl(filePath)
    const url = urlData.publicUrl

    // Create document in database
    const document = await db.document.create({
      data: {
        title,
        description,
        url,
        fileName,
        filePath,
        fileType: file.type,
        fileSize: file.size,
        uploadedById: session.user.id,
        ...(contentId && { contentId }),
        ...(sectionId && { sectionId }),
        ...(lectureId && { lectureId }),
      },
    })

    // Invalidate cache
    if (contentId) await invalidateCache(`course:${contentId}*`)
    if (sectionId) await invalidateCache(`section:${sectionId}*`)
    if (lectureId) await invalidateCache(`lecture:${lectureId}*`)

    return { success: true, document }
  } catch (error) {
    console.error("Error uploading document:", error)
    return { success: false, error: "Failed to upload document" }
  }
}

// Delete document
export async function deleteDocument(documentId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" }
    }

    // Get document
    const document = await db.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return { success: false, error: "Document not found" }
    }

    // Delete file from Supabase Storage
    if (document.filePath) {
      const supabase = createClient()
      const { error: deleteError } = await supabase.storage.from("content").remove([document.filePath])

      if (deleteError) {
        console.error("Error deleting file:", deleteError)
      }
    }

    // Delete document from database
    await db.document.delete({
      where: { id: documentId },
    })

    // Invalidate cache
    if (document.contentId) await invalidateCache(`course:${document.contentId}*`)
    if (document.sectionId) await invalidateCache(`section:${document.sectionId}*`)
    if (document.lectureId) await invalidateCache(`lecture:${document.lectureId}*`)

    return { success: true }
  } catch (error) {
    console.error("Error deleting document:", error)
    return { success: false, error: "Failed to delete document" }
  }
}
