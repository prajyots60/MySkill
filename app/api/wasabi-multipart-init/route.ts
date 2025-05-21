import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { S3Client, CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { applyRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

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

// Longer upload expiry for resumable uploads (7 days)
const UPLOAD_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting (10 requests per minute)
    const rateLimitResult = applyRateLimit(req, {
      limit: 10,
      windowMs: 60 * 1000, // 1 minute
      identifier: 'wasabi-multipart-init'
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
    const { key, contentType, metadata = {}, uploadId = null } = await req.json();

    // Validate required fields
    if (!key || !contentType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: key and contentType' },
        { status: 400 }
      );
    }

    // Validate that the key starts with a valid prefix for this user
    // This is a security check to prevent users from uploading to arbitrary locations
    const validPrefixes = [
      `courses/videos/${metadata.sectionId}`, 
      'security-test',  // For testing uploads
    ];
    
    const hasValidPrefix = validPrefixes.some(prefix => key.startsWith(prefix));
    
    if (!hasValidPrefix) {
      return NextResponse.json(
        { success: false, message: 'Invalid upload location' },
        { status: 403 }
      );
    }
    
    // Add user ID, timestamp, and resumable info to metadata for security tracking and features
    const enhancedMetadata: Record<string, string> = {
      ...metadata,
      userId: session.user.id,
      uploadTimestamp: new Date().toISOString(),
      isResumable: 'true',
      uploadVersion: '2.0', // Version of our upload system
    };
    
    // Add encryption metadata if present
    if (metadata.isEncrypted === 'true') {
      enhancedMetadata.encryptionVersion = metadata.encryptionAlgorithm || 'aes-gcm';
    }
    
    // Generate a security token for this upload (will be verified at completion time)
    const securityToken = crypto.createHash('sha256')
      .update(`${session.user.id}-${key}-${process.env.NEXTAUTH_SECRET || ''}-${Date.now()}`)
      .digest('hex');
    
    enhancedMetadata.securityToken = securityToken;
    
    // Create multipart upload
    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      Metadata: enhancedMetadata,
    });
    
    const result = await s3Client.send(command);
    
    // Calculate expiry timestamp for this upload session
    const expiresAt = Date.now() + UPLOAD_EXPIRY_MS;
    
    return NextResponse.json({
      success: true,
      uploadId: result.UploadId,
      key: result.Key,
      securityToken,
      expiresAt,
      uploadExpiry: UPLOAD_EXPIRY_MS,
      metadata: {
        ...enhancedMetadata,
        securityToken: undefined // Don't return security token in metadata
      }
    });
    
  } catch (error) {
    console.error('Error initializing multipart upload:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to initialize upload' },
      { status: 500 }
    );
  }
}
