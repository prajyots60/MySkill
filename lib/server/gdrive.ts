import { google } from "googleapis"
import { prisma } from "@/lib/db"
import { Readable } from "stream"

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/gdrive/callback`,
)

// Google Drive API scopes
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
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

// Get authenticated Google Drive client
export async function getGDriveClient(userId: string) {
  try {
    // Get user's refresh token from database
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google-drive", // Changed from "google" to "google-drive"
      },
    })

    if (!account?.refresh_token) {
      throw new Error("User not connected to Google Drive")
    }

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    // Create Drive client
    const drive = google.drive({
      version: "v3",
      auth: oauth2Client,
    })

    return drive
  } catch (error) {
    console.error("Error getting Google Drive client:", error)
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

// Get Google Drive user info
export async function getUserInfo(userId: string) {
  try {
    // Set credentials first
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google-drive", // Changed from "google" to "google-drive"
      },
    })

    if (!account?.refresh_token) {
      throw new Error("User not connected to Google Drive")
    }

    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    // Get user info
    const people = google.people({ version: "v1", auth: oauth2Client })
    const res = await people.people.get({
      resourceName: "people/me",
      personFields: "names,emailAddresses,photos",
    })

    // Get Drive storage quota
    const drive = google.drive({ version: "v3", auth: oauth2Client })
    const about = await drive.about.get({
      fields: "storageQuota",
    })

    return {
      name: res.data.names?.[0]?.displayName,
      email: res.data.emailAddresses?.[0]?.value,
      profileImage: res.data.photos?.[0]?.url,
      storageQuota: about.data.storageQuota,
    }
  } catch (error) {
    console.error("Error getting Google Drive user info:", error)
    throw error
  }
}

// Upload file to Google Drive
export async function uploadFileToDrive(
  userId: string,
  file: Buffer,
  options: {
    name: string,
    mimeType: string,
    folderId?: string, // Optional folder ID to upload to
  }
) {
  try {
    const drive = await getGDriveClient(userId)
    
    const fileMetadata = {
      name: options.name,
      ...(options.folderId && { parents: [options.folderId] }),
    }
    
    const media = {
      mimeType: options.mimeType,
      body: Readable.from(file),
    }
    
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, mimeType, webViewLink, webContentLink, size, createdTime",
    })
    
    return response.data
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error)
    throw error
  }
}

// List files from Google Drive
export async function listDriveFiles(
  userId: string, 
  options: {
    folderId?: string,
    pageSize?: number,
    pageToken?: string,
    query?: string,
  } = {}
) {
  try {
    const drive = await getGDriveClient(userId)
    
    let q = options.query || ""
    
    // If folder ID is provided, add it to the query
    if (options.folderId) {
      if (q) q += " and "
      q += `'${options.folderId}' in parents`
    }
    
    const response = await drive.files.list({
      q,
      pageSize: options.pageSize || 100,
      pageToken: options.pageToken,
      fields: "nextPageToken, files(id, name, mimeType, webViewLink, webContentLink, size, createdTime, thumbnailLink)",
    })
    
    return response.data
  } catch (error) {
    console.error("Error listing Google Drive files:", error)
    throw error
  }
}

// Create folder in Google Drive
export async function createDriveFolder(
  userId: string,
  folderName: string,
  parentFolderId?: string
) {
  try {
    const drive = await getGDriveClient(userId)
    
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId && { parents: [parentFolderId] }),
    }
    
    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, webViewLink',
    })
    
    return response.data
  } catch (error) {
    console.error("Error creating Google Drive folder:", error)
    throw error
  }
}

// Download file from Google Drive
export async function downloadDriveFile(userId: string, fileId: string) {
  try {
    const drive = await getGDriveClient(userId)
    
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' })
    
    return Buffer.from(response.data)
  } catch (error) {
    console.error("Error downloading file from Google Drive:", error)
    throw error
  }
}

// Delete file from Google Drive
export async function deleteDriveFile(userId: string, fileId: string) {
  try {
    const drive = await getGDriveClient(userId)
    
    await drive.files.delete({
      fileId: fileId,
    })
    
    return { success: true }
  } catch (error) {
    console.error("Error deleting file from Google Drive:", error)
    throw error
  }
}