import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { google } from "googleapis"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can upload videos" }, { status: 403 })
    }

    // Parse request body
    const { title, description, isPrivate = true } = await request.json()

    if (!title) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 })
    }

    // Get the user's YouTube token from the database
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google-youtube",
      },
      select: {
        access_token: true,
        refresh_token: true,
        expires_at: true,
      },
    })

    if (!account?.access_token || !account?.refresh_token) {
      return NextResponse.json(
        { message: "YouTube account not connected. Please connect your YouTube account." },
        { status: 403 }
      )
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/youtube/callback`
    )

    // Set credentials
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    })

    // Refresh token if expired
    if (account.expires_at && account.expires_at * 1000 < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken()
      
      // Update token in database
      await prisma.account.update({
        where: { 
          provider_providerAccountId: {
            provider: "google-youtube",
            providerAccountId: session.user.id
          }
        },
        data: {
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : undefined,
        },
      })

      // Update client credentials
      oauth2Client.setCredentials(credentials)
    }

    // Create the resumable upload session
    try {
      console.log("Initializing YouTube upload session for user:", session.user.id);
      
      // Initialize a resumable upload session with more detailed headers
      const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${account.access_token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/*',
          'X-Upload-Content-Length': '0' // This is just a session init, no content yet
        },
        body: JSON.stringify({
          snippet: {
            title,
            description: description || "",
            categoryId: "22" // People & Blogs category as default
          },
          status: {
            privacyStatus: isPrivate ? "unlisted" : "public",
            selfDeclaredMadeForKids: false,
          }
        })
      });

      // Debug response details
      console.log("YouTube session response status:", res.status);
      console.log("YouTube session response headers:", JSON.stringify([...res.headers.entries()]));
      
      // Get the resumable upload URL from the Location header
      const uploadUrl = res.headers.get('Location');
      
      // Additional logging for debugging
      if (!uploadUrl) {
        console.error("Failed to get upload URL. Response details:", {
          status: res.status,
          statusText: res.statusText,
          headers: [...res.headers.entries()]
        });
        
        // Try to get response body for more information
        try {
          const responseText = await res.text();
          console.error("Response body:", responseText);
          
          // Check for specific YouTube API errors
          try {
            const errorData = JSON.parse(responseText);
            
            // Check for upload limit exceeded error
            if (errorData?.error?.errors?.[0]?.reason === "uploadLimitExceeded") {
              throw new Error(
                "YouTube upload limit exceeded. Your YouTube account has reached its upload limit. " +
                "Please try again later or use a different YouTube account."
              );
            }
            
            // Check for other common YouTube API errors
            if (errorData?.error?.message) {
              throw new Error(`YouTube API error: ${errorData.error.message}`);
            }
          } catch (parseError) {
            // If JSON parsing fails, just continue with generic error
            if (parseError instanceof Error && parseError.message.includes("YouTube")) {
              throw parseError; // Re-throw our custom error messages
            }
          }
        } catch (e) {
          console.error("Couldn't read response body:", e);
          
          // If we have a specific error, rethrow it
          if (e instanceof Error && e.message.includes("YouTube")) {
            throw e;
          }
        }
        
        throw new Error('Failed to get upload URL from YouTube');
      }
      
      console.log("Successfully obtained YouTube upload URL");

      // Return the upload URL and access token to the client
      return NextResponse.json({
        success: true,
        uploadUrl,
        access_token: account.access_token,
      });
    } catch (error) {
      console.error('Direct API fetch error:', error);
      throw error;
    }
  } catch (error) {
    console.error("Error creating YouTube upload session:", error)
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to create YouTube upload session" 
      },
      { status: 500 }
    )
  }
}