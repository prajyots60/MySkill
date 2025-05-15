/**
 * Dailymotion API Integration
 * 
 * This module handles all interactions with the Dailymotion API:
 * - Authentication and token management
 * - Video uploads
 * - Video metadata updates
 */

import axios from 'axios'
import FormData from 'form-data'
import { prisma } from "@/lib/db"
import { decrypt } from "@/lib/encryption"

// Constants for Dailymotion API
const DAILYMOTION_API_BASE = 'https://api.dailymotion.com'
const DAILYMOTION_UPLOAD_API = 'https://upload-api.dailymotion.com/upload'

// Validate environment variables
const DAILYMOTION_API_KEY = process.env.DAILYMOTION_API_KEY
const DAILYMOTION_API_SECRET = process.env.DAILYMOTION_API_SECRET
const DAILYMOTION_USERNAME = process.env.DAILYMOTION_USERNAME
const DAILYMOTION_PASSWORD = process.env.DAILYMOTION_PASSWORD

// Function to validate required environment variables
function validateEnvironmentVariables() {
  const missingVars = []
  
  if (!DAILYMOTION_API_KEY) missingVars.push('DAILYMOTION_API_KEY')
  if (!DAILYMOTION_API_SECRET) missingVars.push('DAILYMOTION_API_SECRET')
  if (!DAILYMOTION_USERNAME) missingVars.push('DAILYMOTION_USERNAME')
  if (!DAILYMOTION_PASSWORD) missingVars.push('DAILYMOTION_PASSWORD')
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }
}

// Access token cache (for testing purposes only - in production use a database)
const tokenCache: Record<string, { token: string; expires: number }> = {}

const DAILYMOTION_TOKEN_URL = "https://api.dailymotion.com/oauth/token"

/**
 * Gets a valid access token for Dailymotion API
 * Will refresh the token if it's expired or about to expire
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  // Get the user's Dailymotion info and credentials
  const dailymotionInfo = await prisma.dailymotionInfo.findUnique({
    where: { userId },
    include: { credentials: true },
  })

  if (!dailymotionInfo) {
    throw new Error("Dailymotion connection not found")
  }

  // Check if token is still valid (with 5-minute buffer)
  const now = new Date()
  const expiresAt = new Date(dailymotionInfo.expiresAt)
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

  // If token is still valid, return it
  if (expiresAt > fiveMinutesFromNow) {
    return dailymotionInfo.accessToken
  }

  // Token is expired or about to expire, refresh it
  if (!dailymotionInfo.refreshToken || !dailymotionInfo.credentials) {
    throw new Error("No refresh token available")
  }

  const apiKey = decrypt(dailymotionInfo.credentials.apiKey)
  const apiSecret = decrypt(dailymotionInfo.credentials.apiSecret)

  // Request new token
  const response = await fetch(DAILYMOTION_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: apiKey,
      client_secret: apiSecret,
      refresh_token: dailymotionInfo.refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${await response.text()}`)
  }

  const tokenData = await response.json()

  // Update the stored token information
  await prisma.dailymotionInfo.update({
    where: { id: dailymotionInfo.id },
    data: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    },
  })

  return tokenData.access_token
}

/**
 * Uploads a video to Dailymotion
 */
export async function uploadVideo(
  userId: string,
  videoBuffer: Buffer,
  metadata: {
    title: string
    description?: string
    tags?: string[]
    isPrivate?: boolean
  }
): Promise<any> {
  try {
    // Get a valid access token
    const accessToken = await getValidAccessToken(userId)

    // Step 1: Request an upload URL
    const urlResponse = await fetch("https://api.dailymotion.com/file/upload", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!urlResponse.ok) {
      throw new Error(`Failed to get upload URL: ${await urlResponse.text()}`)
    }

    const { upload_url } = await urlResponse.json()

    // Step 2: Upload the video file
    const formData = new FormData()
    formData.append("file", new Blob([videoBuffer]), "video.mp4")

    const uploadResponse = await fetch(upload_url, {
      method: "POST",
      body: formData,
    })

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload video: ${await uploadResponse.text()}`)
    }

    const { url: fileUrl } = await uploadResponse.json()

    // Step 3: Create the video with the uploaded file
    const createParams = new URLSearchParams()
    createParams.append("url", fileUrl)
    createParams.append("title", metadata.title)

    if (metadata.description) {
      createParams.append("description", metadata.description)
    }

    if (metadata.tags && metadata.tags.length > 0) {
      createParams.append("tags", metadata.tags.join(","))
    }

    if (metadata.isPrivate) {
      createParams.append("private", "1")
      createParams.append("published", "0")
    } else {
      createParams.append("published", "1")
    }

    const videoResponse = await fetch("https://api.dailymotion.com/me/videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: createParams.toString(),
    })

    if (!videoResponse.ok) {
      throw new Error(`Failed to create video: ${await videoResponse.text()}`)
    }

    return videoResponse.json()
  } catch (error) {
    console.error("Failed to upload video to Dailymotion:", error)
    throw new Error(`Failed to upload video: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Fetches video information from Dailymotion
 */
export async function getVideoInfo(userId: string, videoId: string): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(userId)

    const response = await fetch(`https://api.dailymotion.com/video/${videoId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get video info: ${await response.text()}`)
    }

    return response.json()
  } catch (error) {
    console.error(`Failed to get video info for ${videoId}:`, error)
    throw new Error("Failed to fetch video information")
  }
}

/**
 * Updates video metadata on Dailymotion
 */
export async function updateVideoMetadata(
  userId: string,
  videoId: string,
  metadata: {
    title?: string
    description?: string
    tags?: string[]
    isPrivate?: boolean
  }
): Promise<any> {
  try {
    const accessToken = await getValidAccessToken(userId)
    
    const updateParams = new URLSearchParams()
    
    if (metadata.title) updateParams.append('title', metadata.title)
    if (metadata.description) updateParams.append('description', metadata.description)
    if (metadata.tags && metadata.tags.length > 0) updateParams.append('tags', metadata.tags.join(','))
    if (metadata.isPrivate !== undefined) {
      updateParams.append('private', metadata.isPrivate ? '1' : '0')
      updateParams.append('published', metadata.isPrivate ? '0' : '1')
    }
    
    const response = await axios.post(
      `${DAILYMOTION_API_BASE}/video/${videoId}`, 
      updateParams.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )
    
    return response.data
  } catch (error) {
    console.error(`Failed to update video metadata for ${videoId}:`, error)
    throw new Error('Failed to update video information')
  }
}