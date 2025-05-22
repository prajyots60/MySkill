import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Wasabi configuration
const WASABI_REGION = process.env.WASABI_REGION || 'ap-southeast-1';

// Parse the endpoint from env var or construct it
let WASABI_ENDPOINT = '';
if (process.env.WASABI_ENDPOINT) {
  // Remove any protocol prefix if present
  WASABI_ENDPOINT = process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '');
} else {
  WASABI_ENDPOINT = `s3.${WASABI_REGION}.wasabisys.com`;
}

// Make sure the region is included in the endpoint
if (!WASABI_ENDPOINT.includes(WASABI_REGION)) {
  // If endpoint doesn't include region, insert it (assuming format s3.wasabisys.com)
  WASABI_ENDPOINT = WASABI_ENDPOINT.replace('s3.', `s3.${WASABI_REGION}.`);
}

console.log('Final Wasabi endpoint:', WASABI_ENDPOINT);

const WASABI_BUCKET = process.env.WASABI_BUCKET || 'edutube';
const WASABI_ACCESS_KEY = process.env.WASABI_ACCESS_KEY || process.env.WASABI_ACCESS_KEY_ID;
const WASABI_SECRET_KEY = process.env.WASABI_SECRET_KEY || process.env.WASABI_SECRET_ACCESS_KEY;

// Debug the environment variables
console.log('Wasabi Configuration:', {
  region: WASABI_REGION,
  endpoint: WASABI_ENDPOINT,
  bucket: WASABI_BUCKET,
  hasAccessKey: !!WASABI_ACCESS_KEY,
  hasSecretKey: !!WASABI_SECRET_KEY
});

// Create S3 client
const s3Client = new S3Client({
  region: WASABI_REGION,
  endpoint: `https://${WASABI_ENDPOINT}`, // Make sure to add the https:// prefix
  credentials: {
    accessKeyId: WASABI_ACCESS_KEY || '',
    secretAccessKey: WASABI_SECRET_KEY || '',
  },
  forcePathStyle: true, // Required for Wasabi
});

// Log the complete S3 client configuration for debugging
console.log('S3 Client Configuration:', {
  region: WASABI_REGION,
  endpoint: `https://${WASABI_ENDPOINT}`,
  forcePathStyle: true,
  hasCredentials: !!(WASABI_ACCESS_KEY && WASABI_SECRET_KEY)
});

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { key, expiresIn = 3600 } = body;

    if (!key) {
      return NextResponse.json({ success: false, message: 'File key is required' }, { status: 400 });
    }

    // Check if credentials are available
    if (!WASABI_ACCESS_KEY || !WASABI_SECRET_KEY) {
      console.error('Missing Wasabi credentials');
      return NextResponse.json(
        { success: false, message: 'Server configuration error: Missing Wasabi credentials' },
        { status: 500 }
      );
    }

    // Log the request for debugging
    console.log('Generating presigned URL for:', {
      bucket: WASABI_BUCKET,
      key,
      expiresIn,
      hasAccessKey: !!WASABI_ACCESS_KEY,
      hasSecretKey: !!WASABI_SECRET_KEY,
    });

    // Verify the key format - remove any leading slashes
    const sanitizedKey = key.startsWith('/') ? key.substring(1) : key;
    
    // Create the GetObject command
    const command = new GetObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: sanitizedKey,
    });
    
    // Generate presigned URL with detailed error handling
    let url;
    try {
      // Create a new S3 client with the correct endpoint for this specific request
      // This ensures the hostname matches exactly what Wasabi expects
      const regionSpecificClient = new S3Client({
        region: WASABI_REGION,
        endpoint: `https://${WASABI_ENDPOINT}`,
        credentials: {
          accessKeyId: WASABI_ACCESS_KEY || '',
          secretAccessKey: WASABI_SECRET_KEY || '',
        },
        forcePathStyle: true,
      });
      
      url = await getSignedUrl(regionSpecificClient, command, { expiresIn });
      
      // Log the full URL for debugging (in development only)
      if (process.env.NODE_ENV === 'development') {
        console.log('Full presigned URL for debugging:', url);
      }
      
      // Log the generated URL (without sensitive parts)
      console.log('Generated presigned URL:', url.split('?')[0] + '?[signature-removed]');
      
      // Validate the URL format
      try {
        new URL(url); // This will throw if the URL is invalid
        console.log('URL validation: Valid URL format');
      } catch (urlError) {
        console.error('URL validation failed:', urlError);
        throw new Error('Generated URL has invalid format');
      }
    } catch (signError) {
      console.error('Error during presigned URL generation:', signError);
      throw signError;
    }

    // Return both the presigned URL and a direct URL for debugging
    // Format matches the working URL example provided by the user
    const directUrl = `https://${WASABI_ENDPOINT}/${WASABI_BUCKET}/${sanitizedKey}`;
    console.log('Direct URL (for reference only):', directUrl);
    
    // Log the URL parts for debugging
    console.log('URL parts:', {
      protocol: 'https',
      hostname: WASABI_ENDPOINT,
      bucket: WASABI_BUCKET,
      key: sanitizedKey
    });

    return NextResponse.json({ 
      success: true, 
      url,
      directUrl, // Include this for debugging purposes
      key: sanitizedKey
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to generate presigned URL';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = `${errorMessage}: ${error.message}`;
      
      // Check for specific error types
      if (error.message.includes('no such file') || error.message.includes('not found')) {
        statusCode = 404;
        errorMessage = 'File not found in storage bucket';
      } else if (error.message.includes('access denied') || error.message.includes('forbidden')) {
        statusCode = 403;
        errorMessage = 'Access denied to storage bucket';
      } else if (error.message.includes('invalid credentials')) {
        statusCode = 401;
        errorMessage = 'Invalid storage credentials';
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: statusCode }
    );
  }
}
