import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generatePresignedUrl } from '@/lib/wasabi';

export async function GET(
  req: NextRequest,
  { params }: { params: { lectureId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { lectureId } = params;
    
    if (!lectureId) {
      return NextResponse.json(
        { success: false, message: 'Lecture ID is required' },
        { status: 400 }
      );
    }

    // Get the lecture from the database
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        section: {
          include: {
            content: {
              select: {
                creatorId: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!lecture) {
      return NextResponse.json(
        { success: false, message: 'Lecture not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this lecture
    const userId = session.user.id;
    const isCreator = lecture.section.content.creatorId === userId;
    const isAdmin = session.user.role === 'ADMIN';
    const isFreeCourse = lecture.section.content.price === 0;
    const isPreviewLecture = lecture.isPreview;

    // Check if user is enrolled in the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        contentId: lecture.section.contentId,
      },
    });

    const isEnrolled = !!enrollment;
    const hasAccess = isEnrolled || isCreator || isAdmin || isFreeCourse || isPreviewLecture;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, message: 'You do not have access to this lecture' },
        { status: 403 }
      );
    }

    // Get the metadata from the lecture
    const metadata = (lecture as any).metadata || {};
    const secureMetadata = (lecture as any).secureMetadata || {};
    
    try {
      // Generate a presigned URL for the video
      let presignedUrl = null;
      if (lecture.videoId) {
        console.log(`Generating presigned URL for video: ${lecture.videoId}`);
        
        // Check if videoId is a full path or just a filename
        const videoKey = lecture.videoId;
        
        // Generate presigned URL with 2-hour expiration (7200 seconds)
        presignedUrl = await generatePresignedUrl(
          videoKey, 
          7200
        );
        
        console.log(`Generated presigned URL: ${presignedUrl}`);
      }
      
      // Return the necessary data for the Wasabi player
      return NextResponse.json({
        success: true,
        videoId: lecture.videoId,
        wasabiUrl: presignedUrl || metadata.wasabiUrl, // Use the presigned URL
        isEncrypted: secureMetadata.isEncrypted || false,
        encryptionKey: secureMetadata.encryptionKey,
        encryptionMethod: secureMetadata.encryptionMethod,
        fileType: metadata.fileType || 'video/mp4',
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
      });
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to generate video access URL' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching Wasabi metadata:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch video metadata' },
      { status: 500 }
    );
  }
}
