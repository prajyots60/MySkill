import { google } from "googleapis"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getUserById } from "./actions/user"
import { Readable } from "stream"

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/youtube/callback`,
)

// YouTube API scopes
export const SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.gdata.youtube.com",
  "https://gdata.youtube.com/",
  "https://gdata.youtube.com",
  "http://gdata.youtube.com",
  "http://gdata.youtube.com/",
  "https://gdata.youtube.com/feeds/",
  "http://gdata.youtube.com/feeds/api/videos/",
  "http://gdata.youtube.com/feeds/api/users/default/playlists",
  "http://gdata.youtube.com/youtube",
  "https://gdata.youtube.com/feeds/api/users/default/favorites/",
  "https://gdata.youtube.com/feeds/api",
  "https://gdata.youtube.com/captions",
  "https://gdata.youtube.com/feed"
]

// Generate authorization URL
export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force to get refresh token
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
    // Get user from database
    const userResult = await getUserById(userId)

    if (!userResult.success || !userResult.user) {
      throw new Error("User not connected to YouTube")
    }

    const user = userResult.user

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: user.refreshToken,
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

// Upload video to YouTube
export async function uploadVideoToYouTube(
  userId: string,
  options: {
    title: string
    description: string
    tags?: string[]
    videoFile: Buffer
    isPrivate?: boolean
  },
) {
  try {
    const youtube = await getYouTubeClient(userId)

    const videoStream = Readable.from(options.videoFile)

    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: options.title,
          description: options.description,
          tags: options.tags,
        },
        status: {
          privacyStatus: options.isPrivate ? "unlisted" : "public",
        },
      },
      media: {
        body: videoStream,
        mimeType: "video/*",
      },
    })

    return response.data
  } catch (error) {
    console.error("Error uploading video:", error)
    throw error
  }
}

// Delete a video from YouTube
export async function deleteVideoFromYouTube(userId: string, videoId: string) {
  try {
    const youtube = await getYouTubeClient(userId)

    await youtube.videos.delete({
      id: videoId
    })

    return true
  } catch (error) {
    console.error("Error deleting YouTube video:", error)
    throw error
  }
}

// Create a live stream
export async function createLiveStream(
  userId: string,
  options: {
    title: string
    description: string
    scheduledStartTime?: Date
    isPrivate?: boolean
  },
) {
  try {
    const youtube = await getYouTubeClient(userId)

    const response = await youtube.liveBroadcasts.insert({
      part: ["snippet", "status", "contentDetails"],
      requestBody: {
        snippet: {
          title: options.title,
          description: options.description,
          scheduledStartTime: options.scheduledStartTime?.toISOString(),
        },
        status: {
          privacyStatus: options.isPrivate ? "unlisted" : "public",
          selfDeclaredMadeForKids: false,
        },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true,
        },
      },
    })

    return response.data
  } catch (error) {
    console.error("Error creating live stream:", error)
    throw error
  }
}

// Check if user is connected to YouTube
export async function isYouTubeConnected() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return false

    const user = await getUserById(session.user.id)
    return !!user?.success && "refreshToken" in user && !!user.refreshToken
  } catch (error) {
    console.error("Error checking YouTube connection:", error)
    return false
  }
}
