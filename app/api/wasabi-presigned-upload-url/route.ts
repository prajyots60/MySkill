import { NextResponse } from "next/server";
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { wasabiClientMinimal } from "@/lib/wasabi-minimal"; // Reuse the minimal client
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { applyRateLimit } from "@/lib/rate-limit";

const BUCKET_NAME = process.env.WASABI_BUCKET || '';
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB max file size
const ALLOWED_CONTENT_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/x-ms-wmv',
  'video/mpeg',
  'video/*'
];

// Create an SHA-256 hash of a string
function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(request: Request) {
  try {
    // Apply rate limiting (10 requests per minute)
    const rateLimitResult = applyRateLimit(request, {
      limit: 10,
      windowMs: 60 * 1000, // 1 minute
      identifier: 'wasabi-upload'
    });
    
    if (rateLimitResult.limited) {
      console.warn(`Rate limit exceeded for upload request`);
      return NextResponse.json({ 
        success: false, 
        message: "Too many upload requests. Please try again later.",
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
      }, { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString()
        }
      });
    }
    
    // Check origin for CORS security
    const origin = request.headers.get('origin');
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000'];
    
    if (origin && !allowedOrigins.includes(origin)) {
      console.warn(`Blocked request from unauthorized origin: ${origin}`);
      return new NextResponse(null, { status: 403 });
    }
    
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !['CREATOR', 'ADMIN'].includes(session.user.role as string)) {
      console.warn(`Unauthorized upload attempt by user: ${session?.user?.id || 'unknown'}`);
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!BUCKET_NAME) {
       console.error("WASABI_BUCKET environment variable not set.");
       return NextResponse.json({ success: false, message: "Server storage not configured" }, { status: 500 });
    }

    const { filename, contentType, category = 'uploads', fileSize, metadata = {} } = await request.json();

    // Enhanced validation
    if (!filename || !contentType) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields: filename and contentType are required",
      }, { status: 400 });
    }
    
    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.includes(contentType) && 
        !ALLOWED_CONTENT_TYPES.includes('video/*')) {
      console.warn(`Blocked upload of unsupported content type: ${contentType}`);
      return NextResponse.json({
        success: false,
        message: "Unsupported content type. Only video files are allowed.",
      }, { status: 400 });
    }
    
    // Validate file size if provided
    if (fileSize && (typeof fileSize !== 'number' || fileSize <= 0 || fileSize > MAX_FILE_SIZE)) {
      console.warn(`Blocked upload of file with invalid size: ${fileSize}`);
      return NextResponse.json({
        success: false,
        message: `Invalid file size. Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB.`,
      }, { status: 400 });
    }

    // Sanitize filename to prevent path traversal attacks
    const sanitizedFilename = filename.replace(/[^\w\s.-]/g, '_');
    
    // Generate a cryptographically secure random string for additional security
    const secureRandom = crypto.randomBytes(8).toString('hex');
    
    // Generate a unique key for the file with a predictable pattern for authorization checks
    // Format: category/userId_timestamp_uuid_secureRandom_filename
    const userSpecificPrefix = `${session.user.id}_${Date.now()}`;
    const fileKey = category ? 
      `${category}/${userSpecificPrefix}_${uuidv4()}_${secureRandom}_${sanitizedFilename}` : 
      `uploads/users/${session.user.id}/${userSpecificPrefix}_${uuidv4()}_${secureRandom}_${sanitizedFilename}`;

    // Security token to validate upload requests - this helps prevent unauthorized uploads
    // even if someone gets access to the URL
    const securityToken = createHash(`${session.user.id}-${fileKey}-${process.env.NEXTAUTH_SECRET || ''}`);
    
    // Combine user metadata with additional tracking metadata
    const enhancedMetadata = {
      ...metadata,
      userid: session.user.id, // lowercase key for S3 compatibility
      uploadedby: session.user.email || 'unknown', // lowercase key
      uploadedat: new Date().toISOString(), // lowercase key
      securitytoken: securityToken, // lowercase key
      originpath: category, // lowercase key
      // Add some additional security metadata
      securitytest: metadata.securityTest === 'true' ? 'true' : 'false'
    };

    // Convert all metadata values to strings
    const s3Metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(enhancedMetadata)) {
      s3Metadata[key] = String(value);
    }

    // Create a conditional check for upload - this helps prevent overwriting existing files
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      Metadata: s3Metadata,
    });

    // Generate a presigned URL valid for 60 minutes (3600 seconds)
    // This is long enough for large uploads but not too long for security
    const signedUrl = await getSignedUrl(wasabiClientMinimal, command, { expiresIn: 3600 });

    console.log(`Generated presigned URL for ${fileKey}`);

    // Log the upload attempt for audit purposes
    console.log(`Upload initiated by user ${session.user.id} (${session.user.email}) for file ${sanitizedFilename} in category ${category}`);

    // Return the signed URL along with security token and key
    return NextResponse.json({ 
      success: true, 
      url: signedUrl, 
      key: fileKey,
      securityToken,  // Client will need to provide this when confirming the upload
      expiresAt: Date.now() + 3600 * 1000 // Expiration timestamp in milliseconds
    });

  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to generate presigned URL"
      },
      { status: 500 }
    );
  }
} 