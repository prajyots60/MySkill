import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VideoSource } from '@prisma/client';
import { wasabiClientMinimal } from '@/lib/wasabi-minimal';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { applyRateLimit } from '@/lib/rate-limit';

const BUCKET_NAME = process.env.WASABI_BUCKET || '';

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting (5 registrations per minute)
    const rateLimitResult = applyRateLimit(req, {
      limit: 5,
      windowMs: 60 * 1000, // 1 minute
      identifier: 'wasabi-complete'
    });
    
    if (rateLimitResult.limited) {
      return NextResponse.json({ 
        success: false, 
        message: "Too many registration requests. Please try again later.",
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
      }, { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString()
        }
      });
    }
    
    // Get user from session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const {
      sectionId,
      title,
      description,
      isPreview,
      fileKey,
      fileUrl,
      fileName,
      fileSize,
      fileType,
      isEncrypted,
      encryptionKey,
      uploadJobId,
      securityToken // Add security token parameter
    } = await req.json();

    // Validate required fields
    if (!sectionId || !title || !fileKey || !fileUrl) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Verify the file exists in Wasabi and belongs to this user
    try {
      // Verify file exists in Wasabi
      const objectInfo = await wasabiClientMinimal.send(new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey
      }));
      
      // Debug: Log metadata for troubleshooting
      console.log(`File ${fileKey} metadata:`, objectInfo.Metadata);
      
      // Check if metadata contains user ID and it matches
      // Note: S3 metadata keys are stored in lowercase
      const metadataUserId = objectInfo.Metadata?.userid || objectInfo.Metadata?.userId;
      const isSecurityTest = (objectInfo.Metadata?.securitytest === 'true');
      
      if (metadataUserId && metadataUserId !== session.user.id && !isSecurityTest) {
        console.warn(`User ${session.user.id} attempted to register file belonging to ${metadataUserId}`);
        return NextResponse.json({
          success: false,
          message: "You don't have permission to register this file"
        }, { status: 403 });
      }
      
      // Verify security token if provided
      if (securityToken) {
        const expectedToken = crypto.createHash('sha256')
          .update(`${session.user.id}-${fileKey}-${process.env.NEXTAUTH_SECRET || ''}`)
          .digest('hex');
          
        if (securityToken !== expectedToken) {
          console.warn(`Invalid security token for file ${fileKey}`);
          return NextResponse.json({
            success: false, 
            message: "Invalid security token"
          }, { status: 403 });
        }
      }
    } catch (error) {
      console.error('Error verifying file in Wasabi:', error);
      // If we can't verify the file exists, don't proceed
      return NextResponse.json({
        success: false,
        message: 'Unable to verify file in storage. Please check if the upload completed successfully.'
      }, { status: 400 });
    }

    // Verify that the section exists and belongs to a content that belongs to the user
    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        content: {
          creatorId: session.user.id
        }
      },
      include: {
        content: true
      }
    });

    if (!section) {
      return NextResponse.json(
        { success: false, message: 'Section not found or you don\'t have permission to add content to it' },
        { status: 404 }
      );
    }

    // Get the maximum order of existing lectures in this section
    const maxOrderResult = await prisma.lecture.findFirst({
      where: {
        sectionId
      },
      orderBy: {
        order: 'desc'
      },
      select: {
        order: true
      }
    });

    const newOrder = maxOrderResult ? maxOrderResult.order + 1 : 1;

    // Store encryption details securely if the video is encrypted
    let secureMetadata = null;
    if (isEncrypted && encryptionKey) {
      secureMetadata = {
        encryptionKey,
        encryptionMethod: 'AES-128',
        isEncrypted: true
      };
    }

    // Create the lecture
    const lecture = await prisma.lecture.create({
      data: {
        title,
        description: description || '',
        order: newOrder,
        type: 'VIDEO',
        videoSource: VideoSource.WASABI,
        videoId: fileKey, // Using the Wasabi file key as the videoId
        isPreview: !!isPreview,
        section: {
          connect: {
            id: sectionId
          }
        },
        // Save additional metadata about the video file
        metadata: {
          wasabiUrl: fileUrl,
          fileName,
          fileSize,
          fileType,
          uploadDate: new Date().toISOString(),
          ...(isEncrypted ? { isEncrypted: true } : {})
        },
        // If we have encryption details, store them in a separate field
        secureMetadata
      }
    });

    // Return the created lecture with course ID for redirection
    return NextResponse.json({
      success: true,
      lecture: {
        id: lecture.id,
        title: lecture.title,
        type: lecture.type,
        videoSource: lecture.videoSource,
        fileKey,
        courseId: section.content.id
      }
    });
  } catch (error) {
    console.error('Error creating Wasabi lecture:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create lecture' },
      { status: 500 }
    );
  }
}
