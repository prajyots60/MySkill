import { google } from "googleapis"
import { prisma } from "@/lib/db"

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/youtube/callback`,
)

// YouTube API scopes
const SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
]

// Generate authorization URL
export function getAuthUrl(userId: string) {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force to get refresh token
    state: userId, // Pass the user ID as state
  })
}

// Exchange code for tokens
export async function getTokensFromCode(code: string) {
  try {
    const { tokens } = await oauth2Client.getToken(code)
    return tokens
  } catch (error) {
    console.error("Error getting tokens:", error)
    throw error
  }
}

// Get authenticated YouTube client
export async function getYouTubeClient(userId: string) {
  try {
    // Get user's refresh token from database
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
        scope: {
          contains: "youtube",
        },
      },
      select: {
        refresh_token: true,
      },
    })

    if (!account?.refresh_token) {
      throw new Error("User not connected to YouTube")
    }

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    // Create YouTube client
    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    })

    return youtube
  } catch (error) {
    console.error("Error getting YouTube client:", error)
    throw error
  }
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string) {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    })

    const { credentials } = await oauth2Client.refreshAccessToken()
    return credentials
  } catch (error) {
    console.error("Error refreshing access token:", error)
    throw error
  }
}

// Get YouTube channel info
export async function getChannelInfo(userId: string) {
  try {
    const youtube = await getYouTubeClient(userId)

    const response = await youtube.channels.list({
      part: ["snippet", "statistics"],
      mine: true,
    })

    return response.data.items?.[0] || null
  } catch (error) {
    console.error("Error getting channel info:", error)
    throw error
  }
}
