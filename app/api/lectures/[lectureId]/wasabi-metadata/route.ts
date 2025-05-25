import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * API route to get encryption metadata for a lecture
 * Used for diagnostic purposes in the encryption inspector
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { lectureId: string } }
) {
  try {
    // Get user from session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const lectureId = params.lectureId;
    if (!lectureId) {
      return NextResponse.json({ success: false, message: 'Missing lecture ID' }, { status: 400 });
    }
    
    // Find lecture with encryption details
    const lecture = await prisma.lecture.findUnique({
      where: {
        id: lectureId,
        course: {
          creatorId: session.user.id
        }
      },
      select: {
        id: true,
        title: true,
        videoSource: true,
        videoMetadata: true,
      }
    });
    
    if (!lecture) {
      return NextResponse.json(
        { success: false, message: 'Lecture not found or you do not have access to it' },
        { status: 404 }
      );
    }
    
    // Extract encryption metadata from secureMetadata if it exists
    let encryptionInfo = null;
    if (lecture.videoMetadata && typeof lecture.videoMetadata === 'object') {
      const metadata = lecture.videoMetadata as Record<string, any>;
      
      // Check if this is secure metadata with encryption info
      if (metadata.secureMetadata && typeof metadata.secureMetadata === 'object') {
        // Extract only the non-sensitive metadata (don't expose the key!)
        encryptionInfo = {
          algorithm: metadata.secureMetadata.encryptionAlgorithm,
          ivLength: metadata.secureMetadata.encryptionIVLength,
          keyLength: metadata.secureMetadata.encryptionKeyLength,
          isEncrypted: true,
          // Only provide the IV for diagnostic purposes - this is not sensitive
          encryptionIV: metadata.secureMetadata.encryptionIV,
          encryptionTimestamp: metadata.secureMetadata.encryptionTimestamp
        };
      } else if (metadata.isEncrypted) {
        // For older records that might not have detailed metadata
        encryptionInfo = {
          isEncrypted: true,
          algorithm: 'AES-GCM',
          keyLength: '256',
          ivLength: '12'
        };
      }
    }
    
    // Make sure we always provide the IV in a consistent top-level location if available
    let topLevelIV = null;
    if (encryptionInfo?.encryptionIV) {
      topLevelIV = encryptionInfo.encryptionIV;
    } else if (lecture.videoMetadata && typeof lecture.videoMetadata === 'object') {
      const metadata = lecture.videoMetadata as Record<string, any>;
      if (metadata.secureMetadata?.encryptionIV) {
        topLevelIV = metadata.secureMetadata.encryptionIV;
      }
    }

    return NextResponse.json({
      success: true,
      lecture: {
        id: lecture.id,
        title: lecture.title,
        videoSource: lecture.videoSource,
        isEncrypted: !!encryptionInfo?.isEncrypted
      },
      encryptionInfo,
      // Always include the IV at the top level if we have it
      ...(topLevelIV ? { encryptionIV: topLevelIV } : {})
    });
    
  } catch (error) {
    console.error('Error fetching encryption metadata:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch encryption metadata' },
      { status: 500 }
    );
  }
}
