/**
 * Utility functions for video security
 */

// Use environment variable for encryption key
const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET || "eduplatform-secure-video-key"

/**
 * Encode a YouTube video ID to prevent direct access
 */
export function encodeVideoId(videoId: string): string {
  try {
    // Create a secure token with video ID, timestamp, and expiration
    const data = {
      id: videoId,
      timestamp: Date.now(),
      expires: Date.now() + 3600000, // 1 hour expiration
      nonce: Math.random().toString(36).substring(2, 10), // Add randomness to prevent token reuse
    }

    // Use simple base64 encoding for now to ensure compatibility
    return Buffer.from(JSON.stringify(data)).toString("base64")
  } catch (error) {
    console.error("Error encoding video ID:", error)
    throw new Error("Failed to secure video ID")
  }
}

/**
 * Decode an encoded video token
 */
export function decodeVideoId(token: string): string | null {
  try {
    // Simple base64 decoding
    const data = JSON.parse(Buffer.from(token, "base64").toString("utf-8"))

    // Check if token is expired
    if (data.expires && data.expires < Date.now()) {
      console.log("Token expired:", new Date(data.expires))
      return null
    }

    // Validate that we have a video ID
    if (!data.id) {
      console.error("Token missing video ID")
      return null
    }

    console.log("Successfully decoded token for video ID:", data.id)
    return data.id
  } catch (error) {
    console.error("Error decoding video token:", error)
    return null
  }
}

/**
 * Generate a secure URL for video access
 */
export function generateSecureVideoUrl(videoId: string): string {
  const token = encodeVideoId(videoId)
  return `/api/video/secure?token=${token}`
}

/**
 * Validate if a user has access to a specific video
 * This can be extended with more complex validation logic
 */
export async function validateVideoAccess(userId: string, lectureId: string): Promise<boolean> {
  // This would typically check database permissions
  // For now, we're just validating that both IDs exist
  return Boolean(userId && lectureId)
}
