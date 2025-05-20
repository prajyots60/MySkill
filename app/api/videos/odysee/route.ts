import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { 
  parseOdyseeUrl, 
  isValidOdyseeUrl, 
  resolveOdyseeShortlink, 
  extractVideoIdFromShortlink,
  getEmbedUrlFromShortlink,
  getOdyseeDirectUrl
} from '@/lib/odysee-helpers';
import { OdyseeVideoMetadata, OdyseeStreamData } from '@/types/odysee';

// POST endpoint to save Odysee video information
export async function POST(req: Request) {
  try {
    // Verify user authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request data
    const body = await req.json();
    const { 
      url: originalUrl, 
      title, 
      description, 
      sectionId, 
      isPreview = false,
      directUrl,           // Add support for direct URL parameter
      embedUrl,            // Add support for embed URL parameter
      thumbnailUrl,        // Add support for thumbnail URL
      duration             // Add support for video duration
    } = body;

    if (!originalUrl) {
      return NextResponse.json({ error: 'No video URL provided' }, { status: 400 });
    }

    // First validate basic format
    if (!isValidOdyseeUrl(originalUrl)) {
      return NextResponse.json({ error: 'Invalid Odysee URL format' }, { status: 400 });
    }

    // Special handling for shortlinks
    if (originalUrl.includes('ody.sh/')) {
      try {
        // Try to resolve the shortlink first
        const resolvedUrl = await resolveOdyseeShortlink(originalUrl);
        
        // If resolution worked and we got a different URL
        if (resolvedUrl !== originalUrl && resolvedUrl.includes('odysee.com')) {
          // Handle as regular Odysee URL
          const parsedData = parseOdyseeUrl(resolvedUrl);
          if (parsedData) {
            // Continue with the resolved URL
            return await createOdyseeVideo(
              session.user.id,
              originalUrl,
              resolvedUrl,
              parsedData,
              title,
              description,
              sectionId,
              isPreview,
              directUrl,  // Pass directly provided directUrl parameter
              thumbnailUrl, // Pass thumbnail URL
              duration      // Pass duration
            );
          }
        }
        
        // If resolution failed, try direct embedding
        const videoId = extractVideoIdFromShortlink(originalUrl);
        if (videoId) {
          const embedUrl = getEmbedUrlFromShortlink(originalUrl);
          if (embedUrl) {
            // Use the extracted ID for both claim name and ID
            const parsedData = {
              claimId: videoId,
              claimName: videoId,
              embedUrl
            };
            
            // Create the video with the direct embed approach
            return await createOdyseeVideo(
              session.user.id,
              originalUrl,
              null, // No resolved URL
              parsedData,
              title,
              description,
              sectionId,
              isPreview,
              directUrl, // Pass directly provided directUrl parameter
              thumbnailUrl, // Pass thumbnail URL
              duration      // Pass duration
            );
          }
        }
        
        // If we couldn't get a valid videoId for direct embedding
        return NextResponse.json({ error: 'Failed to process Odysee shortlink' }, { status: 400 });
      } catch (error) {
        console.error('Error processing Odysee shortlink:', error);
        return NextResponse.json({ error: 'Failed to process Odysee shortlink' }, { status: 400 });
      }
    }

    // Standard Odysee URL handling
    const parsedData = parseOdyseeUrl(originalUrl);
    if (!parsedData) {
      return NextResponse.json({ error: 'Failed to parse Odysee URL' }, { status: 400 });
    }

    // Create the video
    return await createOdyseeVideo(
      session.user.id,
      originalUrl,
      null, // No resolved URL for standard URLs
      parsedData,
      title,
      description,
      sectionId,
      isPreview,
      directUrl, // Pass directly provided directUrl parameter
      thumbnailUrl, // Pass thumbnail URL
      duration      // Pass duration
    );
  } catch (error) {
    console.error('Error saving Odysee video:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save Odysee video' },
      { status: 500 }
    );
  }
}

// Helper function to create Odysee videos with standard logic
async function createOdyseeVideo(
  userId: string,
  originalUrl: string,
  resolvedUrl: string | null,
  parsedData: { claimId: string; claimName: string; embedUrl: string },
  title?: string,
  description?: string,
  sectionId?: string,
  isPreview: boolean = false,
  providedDirectUrl?: string,
  thumbnailUrl?: string,
  duration?: number
) {
  let nextOrder = 0; // Default order value
  
  // Check if section exists and user has access to it
  if (sectionId) {
    const section = await prisma.section.findUnique({
      where: {
        id: sectionId
      },
      include: {
        content: {
          select: {
            creatorId: true
          }
        },
        lectures: {
          orderBy: {
            order: 'desc'
          },
          take: 1,
          select: {
            order: true
          }
        }
      }
    });

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Verify the user owns the course
    if (section.content.creatorId !== userId) {
      return NextResponse.json({ error: 'You do not have permission to add videos to this section' }, { status: 403 });
    }
    
    // Calculate next order number
    nextOrder = section.lectures.length > 0 && section.lectures[0]
      ? section.lectures[0].order + 1 
      : 0;
  }

  // Get the direct URL for the video (prioritize provided direct URL, then signatures, then resolved URL)
  const directUrl = providedDirectUrl || (originalUrl.includes('signature=') ? originalUrl : (resolvedUrl || originalUrl));

  // Create or update lecture with Odysee video information
  const lecture = await prisma.lecture.create({
    data: {
      title: title || `Odysee Video: ${parsedData.claimName}`,
      description: description || '',
      type: 'VIDEO',
      videoSource: 'ODYSEE',
      claimId: parsedData.claimId,
      claimName: parsedData.claimName,
      isPreview,
      order: nextOrder,
      duration: duration, // Include the duration if provided
      // Store the direct URL and thumbnail in the streamData JSON field
      streamData: {
        originalUrl: originalUrl,
        embedUrl: parsedData.embedUrl,
        directUrl: directUrl,
        // Include additional metadata that might be useful
        isUnlisted: originalUrl.includes('signature='),
        thumbnailUrl: thumbnailUrl || null, // Store the thumbnail URL
        title: title || `Odysee Video: ${parsedData.claimName}`
      },
      section: sectionId ? {
        connect: {
          id: sectionId
        }
      } : undefined
    }
  });

  return NextResponse.json({
    success: true,
    lecture: {
      id: lecture.id,
      title: lecture.title,
      type: lecture.type,
      claimId: lecture.claimId,
      claimName: lecture.claimName,
      videoSource: lecture.videoSource,
      streamData: lecture.streamData
    }
  });
}

// GET endpoint to validate Odysee URL and return metadata
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const originalUrl = searchParams.get('url');

    if (!originalUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Basic validation
    if (!isValidOdyseeUrl(originalUrl)) {
      return NextResponse.json({ error: 'Invalid Odysee URL format' }, { status: 400 });
    }

    // Special handling for shortlinks
    if (originalUrl.includes('ody.sh/')) {
      // Try to resolve the shortlink
      try {
        const resolvedUrl = await resolveOdyseeShortlink(originalUrl);
        
        // If resolution worked and we got a different URL
        if (resolvedUrl !== originalUrl && resolvedUrl.includes('odysee.com')) {
          // Parse the resolved URL
          const parsedData = parseOdyseeUrl(resolvedUrl);
          if (parsedData) {
            return NextResponse.json({
              success: true,
              metadata: {
                originalUrl,
                resolvedUrl,
                directUrl: resolvedUrl, // Add the direct URL
                claimId: parsedData.claimId,
                claimName: parsedData.claimName,
                embedUrl: parsedData.embedUrl
              }
            });
          }
        }
        
        // If resolution failed, try direct embedding
        const videoId = extractVideoIdFromShortlink(originalUrl);
        if (videoId) {
          const embedUrl = getEmbedUrlFromShortlink(originalUrl);
          if (embedUrl) {
            return NextResponse.json({
              success: true,
              metadata: {
                originalUrl,
                resolvedUrl: null,
                directUrl: originalUrl, // Use original URL as direct URL
                claimId: videoId,
                claimName: videoId,
                embedUrl,
                directEmbed: true // Flag indicating we're using direct embed
              }
            });
          }
        }
        
        return NextResponse.json({ error: 'Failed to process Odysee shortlink' }, { status: 400 });
      } catch (error) {
        console.error('Error processing Odysee shortlink:', error);
        return NextResponse.json({ error: 'Failed to process Odysee shortlink' }, { status: 400 });
      }
    }

    // Standard Odysee URL handling
    const parsedData = parseOdyseeUrl(originalUrl);
    if (!parsedData) {
      return NextResponse.json({ error: 'Failed to parse Odysee URL' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      metadata: {
        originalUrl,
        directUrl: originalUrl, // Include the direct URL
        claimId: parsedData.claimId,
        claimName: parsedData.claimName,
        embedUrl: parsedData.embedUrl
      }
    });
  } catch (error) {
    console.error('Error validating Odysee URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to validate Odysee URL' },
      { status: 500 }
    );
  }
}