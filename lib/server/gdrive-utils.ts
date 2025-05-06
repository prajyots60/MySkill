import { prisma } from "@/lib/prisma"
import { google } from "googleapis"

// Get the user's Google Drive token from the database
export async function getUserGDriveToken(userId: string) {
  try {
    // Find the account with provider 'google' for the user
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: "google",
      },
    })

    if (!account || !account.refresh_token) {
      return null
    }

    // Create an OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/gdrive/callback`
    )

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    // Check if access token is expired and refresh if needed
    if (account.expires_at && account.expires_at * 1000 < Date.now()) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken()
        
        // Update the account with new tokens
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: credentials.access_token,
            expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : undefined,
            id_token: credentials.id_token,
          },
        })

        // Return the refreshed credentials
        return credentials
      } catch (error) {
        console.error("Error refreshing token:", error)
        return null
      }
    }

    // Return existing credentials
    return {
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    }
  } catch (error) {
    console.error("Error getting Google Drive token:", error)
    return null
  }
}

// Get Google Drive user information with the given credentials
export async function getGDriveUserInfo(credentials: any) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    
    oauth2Client.setCredentials(credentials)
    
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    })
    
    const userInfo = await oauth2.userinfo.get()
    
    // Also get Drive storage information
    const drive = google.drive({
      version: 'v3',
      auth: oauth2Client,
    })
    
    const about = await drive.about.get({
      fields: 'storageQuota',
    })
    
    return {
      email: userInfo.data.email,
      name: userInfo.data.name,
      profileImage: userInfo.data.picture,
      storageQuota: about.data.storageQuota || undefined
    }
  } catch (error) {
    console.error("Error getting Google Drive user info:", error)
    throw error
  }
}

// Update user's Google Drive connection status in the database
export async function updateUserGDriveStatus(
  userId: string,
  connected: boolean,
  email?: string,
  name?: string,
  profileImage?: string
) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        gdriveConnected: connected,
        gdriveEmail: email,
        gdriveName: name,
        gdriveProfileImage: profileImage,
        gdriveConnectedAt: connected ? new Date() : null,
      },
    })
  } catch (error) {
    console.error("Error updating user Google Drive status:", error)
    throw error
  }
}

// Create a Google Drive API client
export function createDriveClient(credentials: any) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    
    oauth2Client.setCredentials(credentials)
    
    return google.drive({
      version: 'v3',
      auth: oauth2Client,
    })
  } catch (error) {
    console.error("Error creating Google Drive client:", error)
    throw error
  }
}