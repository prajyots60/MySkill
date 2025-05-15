import { prisma } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import { Prisma } from "@prisma/client"

const DAILYMOTION_API_URL = "https://api.dailymotion.com"

type DailymotionInfoWithCredentials = Prisma.DailymotionInfoGetPayload<{
  include: { credentials: true }
}>

export async function getValidAccessToken(userId: string): Promise<string> {
  // Get the user's Dailymotion info
  const dailymotionInfo = await prisma.dailymotionInfo.findUnique({
    where: { userId },
    include: { credentials: true }
  }) as DailymotionInfoWithCredentials | null

  if (!dailymotionInfo?.credentials) {
    throw new Error("Dailymotion account not connected")
  }

  // Check if the access token is expired
  if (new Date() >= dailymotionInfo.expiresAt) {
    // Refresh the token
    const apiKey = decrypt(dailymotionInfo.credentials.apiKey)
    const apiSecret = decrypt(dailymotionInfo.credentials.apiSecret)

    const tokenResponse = await fetch(`${DAILYMOTION_API_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: apiKey,
        client_secret: apiSecret,
        refresh_token: dailymotionInfo.refreshToken!,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      throw new Error(`Failed to refresh access token: ${errorData.error_description || 'Unknown error'}`)
    }

    const tokenData = await tokenResponse.json()

    // Update the stored tokens
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

  return dailymotionInfo.accessToken
}

export async function getDailymotionUserInfo(userId: string) {
  const accessToken = await getValidAccessToken(userId)

  const response = await fetch(`${DAILYMOTION_API_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to get Dailymotion user info: ${errorData.error_description || 'Unknown error'}`)
  }

  return response.json()
}

export async function getDailymotionVideoInfo(userId: string, videoId: string) {
  const accessToken = await getValidAccessToken(userId)

  const response = await fetch(`${DAILYMOTION_API_URL}/video/${videoId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to get video info: ${errorData.error_description || 'Unknown error'}`)
  }

  return response.json()
}

export async function deleteDailymotionVideo(userId: string, videoId: string) {
  const accessToken = await getValidAccessToken(userId)

  const response = await fetch(`${DAILYMOTION_API_URL}/video/${videoId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to delete video: ${errorData.error_description || 'Unknown error'}`)
  }

  return true
}

export async function updateDailymotionVideo(
  userId: string,
  videoId: string,
  updates: {
    title?: string
    description?: string
    tags?: string
    private?: boolean
    is_created_for_kids?: boolean
    channel?: string
    published?: boolean
  }
) {
  const accessToken = await getValidAccessToken(userId)

  const response = await fetch(`${DAILYMOTION_API_URL}/video/${videoId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(
      Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value.toString()
        }
        return acc
      }, {} as Record<string, string>)
    ),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to update video: ${errorData.error_description || 'Unknown error'}`)
  }

  return response.json()
} 