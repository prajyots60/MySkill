import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting (50 requests per minute)
    // Rate limit is higher because clients will need multiple presigned URLs
    const rateLimitResult = applyRateLimit(req, {
      limit: 50,
      windowMs: 60 * 1000, // 1 minute
      identifier: 'wasabi-multipart-url'
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

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const key = searchParams.get('key');
    const uploadId = searchParams.get('uploadId');
    const partNumber = searchParams.get('partNumber');
    
    // Validate required fields
    if (!key || !uploadId || !partNumber) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: key, uploadId, and partNumber' },
        { status: 400 }
      );
    }
    
    // Create upload part command
    const command = new UploadPartCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: parseInt(partNumber, 10),
    });
    
    // Generate presigned URL (valid for 1 hour)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    return NextResponse.json({
      success: true,
      url,
      partNumber: parseInt(partNumber, 10),
      expiresAt: Date.now() + (3600 * 1000) // 1 hour expiry
    });
    
  } catch (error) {
    console.error('Error generating upload part URL:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
