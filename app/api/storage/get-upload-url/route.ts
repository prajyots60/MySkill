import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { generatePresignedUploadUrl } from '@/lib/wasabi-storage';

/**
 * API route for generating presigned URLs for direct uploads to Wasabi
 * This enables serverless uploads from the client directly to Wasabi
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const token = await getToken({ req });
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await req.json();
    const { fileKey, contentType, metadata = {} } = body;

    // Validate required fields
    if (!fileKey || !contentType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Add user information to the metadata to track who uploaded the file
    const enhancedMetadata = {
      ...metadata,
      userId: token.sub as string,
      uploadedBy: token.email as string,
      uploadedAt: new Date().toISOString()
    };

    // Generate the presigned URL with a longer expiration time for large files
    // 60 minutes should be sufficient for large video uploads
    const result = await generatePresignedUploadUrl(
      fileKey,
      contentType,
      enhancedMetadata,
      3600 // 60 minutes in seconds
    );

    // Return the URL and key to the client
    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}
