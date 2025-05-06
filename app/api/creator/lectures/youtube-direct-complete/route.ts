import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { google } from "googleapis"
import { v4 as uuidv4 } from "uuid"
import { redis } from "@/lib/redis"

export async function POST(request: Request) {
  console.log("YouTube direct complete API called");
  
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log("No authenticated user found");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    console.log("Authenticated user:", session.user.id);

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      console.log("User is not a creator or admin:", session.user.role);
      return NextResponse.json({ message: "Only creators can upload videos" }, { status: 403 })
    }

    // Parse request body
    const requestBody = await request.json();
    console.log("Request body:", requestBody);
    
    const { 
      videoId, 
      sectionId, 
      title, 
      description, 
      isPreview,
      uploadJobId
    } = requestBody;

    if (!videoId || !sectionId) {
      console.log("Missing required fields:", { videoId, sectionId });
      return NextResponse.json({ message: "Video ID and section ID are required" }, { status: 400 })
    }

    console.log("Processing video metadata for:", { videoId, sectionId, title });

    // Get the section and verify permissions
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        content: {
          select: {
            id: true,
            creatorId: true,
          },
        },
      },
    })

    if (!section) {
      console.log("Section not found:", sectionId);
      return NextResponse.json({ message: "Section not found" }, { status: 404 })
    }

    console.log("Section found:", { 
      sectionId: section.id, 
      contentId: section.content.id,
      creatorId: section.content.creatorId 
    });

    // Check if user is the creator of the course
    const isCreator = section.content.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      console.log("User doesn't have permission:", { 
        userId: session.user.id, 
        contentCreatorId: section.content.creatorId,
        isAdmin
      });
      
      return NextResponse.json(
        { message: "You don't have permission to add videos to this section" },
        { status: 403 }
      )
    }

    // Get the YouTube video details to verify it exists and get duration
    console.log("Getting YouTube account credentials");
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google-youtube",
      },
      select: {
        access_token: true,
        refresh_token: true,
      },
    })

    if (!account?.access_token) {
      console.log("YouTube account not connected");
      return NextResponse.json(
        { message: "YouTube account not connected" },
        { status: 403 }
      )
    }

    console.log("Initializing YouTube API client");
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
    })

    // Create YouTube client
    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    })

    console.log("Fetching video details from YouTube for videoId:", videoId);
    
    try {
      // Get video details from YouTube
      const videoResponse = await youtube.videos.list({
        part: ["snippet", "contentDetails", "status"],
        id: [videoId],
      })

      console.log("YouTube API response:", {
        status: videoResponse.status,
        statusText: videoResponse.statusText,
        hasItems: videoResponse.data.items && videoResponse.data.items.length > 0,
        itemCount: videoResponse.data.items?.length
      });

      if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
        console.log("Video not found on YouTube:", videoId);
        return NextResponse.json(
          { message: "Video not found on YouTube" },
          { status: 404 }
        )
      }

      const videoData = videoResponse.data.items[0]
      
      // Parse the duration from YouTube's ISO 8601 format
      let durationInSeconds = 0
      if (videoData.contentDetails?.duration) {
        const duration = videoData.contentDetails.duration
        console.log("Raw duration from YouTube:", duration);
        
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
        if (match) {
          const hours = (match[1] ? parseInt(match[1]) : 0) * 3600
          const minutes = (match[2] ? parseInt(match[2]) : 0) * 60
          const seconds = match[3] ? parseInt(match[3]) : 0
          durationInSeconds = hours + minutes + seconds
          console.log("Parsed duration in seconds:", durationInSeconds);
        } else {
          console.log("Failed to parse duration format:", duration);
        }
      } else {
        console.log("No duration found in video data");
      }

      // Get the highest order and add 1
      console.log("Finding highest lecture order for section:", sectionId);
      const highestOrderLecture = await prisma.lecture.findFirst({
        where: {
          sectionId: sectionId,
        },
        orderBy: {
          order: "desc",
        },
        select: {
          order: true,
        },
      })

      const order = highestOrderLecture ? highestOrderLecture.order + 1 : 0
      console.log("Calculated lecture order:", order);

      console.log("Creating lecture in database with data:", {
        title: title || videoData.snippet?.title || "Untitled",
        sectionId,
        videoId,
        duration: durationInSeconds,
        isPreview: !!isPreview,
        order
      });

      try {
        // Create lecture in database
        const lecture = await prisma.lecture.create({
          data: {
            title: title || videoData.snippet?.title || "Untitled",
            description: description || videoData.snippet?.description || "",
            type: "VIDEO",
            videoId: videoId,
            duration: durationInSeconds,
            isPreview: !!isPreview,
            order,
            section: {
              connect: { id: sectionId },
            },
          },
        })

        console.log("Lecture created successfully:", lecture.id);

        // Update the upload job status if provided
        if (uploadJobId) {
          console.log("Updating upload job status in Redis:", uploadJobId);
          await redis.set(
            `upload:${uploadJobId}`,
            JSON.stringify({
              status: "completed",
              progress: 100,
              title,
              sectionId,
              userId: session.user.id,
              contentId: section.content.id,
              lectureId: lecture.id,
              videoId: videoId,
            }),
            { ex: 86400 }, // 24 hours expiration
          )
        }

        return NextResponse.json({
          success: true,
          lecture,
          message: "Lecture created successfully",
        })
      } catch (dbError) {
        console.error("Database error creating lecture:", dbError);
        return NextResponse.json(
          { 
            success: false, 
            message: "Failed to create lecture in database: " + (dbError instanceof Error ? dbError.message : String(dbError))
          },
          { status: 500 }
        )
      }
    } catch (ytError) {
      console.error("YouTube API error:", ytError);
      return NextResponse.json(
        { 
          success: false, 
          message: "Failed to fetch video from YouTube: " + (ytError instanceof Error ? ytError.message : String(ytError))
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error completing YouTube direct upload:", error)
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to complete YouTube upload" 
      },
      { status: 500 }
    )
  }
}