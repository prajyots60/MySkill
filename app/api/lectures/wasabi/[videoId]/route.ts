import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

interface LectureParams {
  videoId: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: LectureParams }
) {
  try {
    const videoId = params.videoId;
    
    if (!videoId) {
      return NextResponse.json(
        { success: false, message: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get user from session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find the lecture by videoId (this is the Wasabi file key)
    const lecture = await prisma.lecture.findFirst({
      where: {
        videoId: videoId,
        videoSource: 'WASABI',
      },
      include: {
        section: {
          include: {
            content: {
              select: {
                creatorId: true,
                enrollments: {
                  where: {
                    userId: session.user.id,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lecture) {
      return NextResponse.json(
        { success: false, message: 'Video not found' },
        { status: 404 }
      );
    }

    // Check if user is authorized to view this video
    // User must either be the creator or enrolled in the course, unless the video is a preview
    const isCreator = lecture.section.content.creatorId === session.user.id;
    const isEnrolled = lecture.section.content.enrollments.length > 0;
    const isPreview = lecture.isPreview;

    if (!isCreator && !isEnrolled && !isPreview) {
      return NextResponse.json(
        { success: false, message: 'You do not have permission to view this video' },
        { status: 403 }
      );
    }

    // Check if the video is encrypted
    const metadata = lecture.metadata as any || {};
    const isEncrypted = metadata.isEncrypted === true;
    
    // For encrypted videos, get the encryption key from secure metadata
    // Only return the encryption key if the user is authorized
    let encryptionKey = null;
    if (isEncrypted && (isCreator || isEnrolled)) {
      const secureMetadata = lecture.secureMetadata as any || {};
      encryptionKey = secureMetadata.encryptionKey || null;
    }

    // Return the video details
    return NextResponse.json({
      success: true,
      videoId: lecture.videoId,
      title: lecture.title,
      isEncrypted,
      encryptionKey,
      metadata: {
        ...metadata,
        // Never expose the encryption key in the metadata
        encryptionKey: undefined,
      },
    });
  } catch (error) {
    console.error('Error getting Wasabi lecture:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to get video details' },
      { status: 500 }
    );
  }
}
