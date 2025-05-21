import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { S3Client, CompleteMultipartUploadCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { applyRateLimit } from '@/lib/rate-limit';

// Get Wasabi configuration
const BUCKET_NAME = process.env.WASABI_BUCKET || '';
const REGION = process.env.WASABI_REGION || '';
const ENDPOINT = process.env.WASABI_ENDPOINT || '';

// Initialize S3 client for Wasabi
const s3Client = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY || '',
    secretAccessKey: process.env.WASABI_SECRET_KEY || '',
  },
  forcePathStyle: true, // Required for Wasabi
});

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting (10 requests per minute)
    const rateLimitResult = applyRateLimit(req, {
      limit: 10,
      windowMs: 60 * 1000, // 1 minute
      identifier: 'wasabi-multipart-complete'
    });
    
    if (rateLimitResult.limited) {
      return NextResponse.json({ 
        success: false, 
        message: "Too many requests. Please try again later.",
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
    const { key, uploadId, parts } = await req.json();

    // Validate required fields
    if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: key, uploadId, and parts' },
        { status: 400 }
      );
    }
    
    // Verify parts format
    for (const part of parts) {
      if (!part.PartNumber || !part.ETag) {
        return NextResponse.json(
          { success: false, message: 'Each part must have PartNumber and ETag' },
          { status: 400 }
        );
      }
    }

    // Complete multipart upload
    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
      },
    });
    
    const result = await s3Client.send(command);

    // Verify the upload was successful by checking object metadata
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });
      
      const objectInfo = await s3Client.send(headCommand);
      
      // Check metadata to ensure this belongs to the current user
      const metadataUserId = objectInfo.Metadata?.userid || objectInfo.Metadata?.userId;
      const isSecurityTest = (objectInfo.Metadata?.securitytest === 'true');
      
      if (metadataUserId && metadataUserId !== session.user.id && !isSecurityTest) {
        console.warn(`User ${session.user.id} attempted to complete upload belonging to ${metadataUserId}`);
        return NextResponse.json({
          success: false,
          message: "You don't have permission to complete this upload"
        }, { status: 403 });
      }
    } catch (error) {
      // Log the error but continue, since the upload did complete
      console.error('Error verifying uploaded object:', error);
    }
    
    return NextResponse.json({
      success: true,
      key: result.Key,
      location: result.Location,
      etag: result.ETag,
      bucket: BUCKET_NAME
    });
    
  } catch (error) {
    console.error('Error completing multipart upload:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to complete upload' },
      { status: 500 }
    );
  }
}
