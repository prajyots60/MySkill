import ImageKit from "imagekit"

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
})

interface UploadResult {
  url: string
  fileId: string
}

/**
 * Upload a file to ImageKit via our API route
 */
export async function uploadToImageKit(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/imagekit/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Upload failed")
    }

    const result = await response.json()
    return {
      url: result.url,
      fileId: result.fileId,
    }
  } catch (error) {
    console.error("Error uploading to ImageKit:", error)
    throw error
  }
} 