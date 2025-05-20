import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

/**
 * API route for checking Wasabi S3 configuration
 * This endpoint returns non-sensitive configuration information 
 * to help diagnose connection issues
 */
export async function GET(req: Request) {
  try {
    // Verify authentication
    const token = await getToken({ req });
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the environment variables
    const config = {
      region: process.env.WASABI_REGION || '',
      endpoint: process.env.WASABI_ENDPOINT || '',
      bucket: process.env.WASABI_BUCKET || '',
      publicBucket: process.env.NEXT_PUBLIC_WASABI_BUCKET || '',
      publicRegion: process.env.NEXT_PUBLIC_WASABI_REGION || '',
      hasAccessKey: !!process.env.WASABI_ACCESS_KEY,
      hasSecretKey: !!process.env.WASABI_SECRET_KEY,
      endpointMatches: process.env.WASABI_ENDPOINT?.includes(process.env.WASABI_REGION || '') || false,
    };

    // Optional: Try to list buckets to verify credentials actually work
    let credentialsVerified = false;
    let bucketsAccessible = false;
    
    if (config.hasAccessKey && config.hasSecretKey && config.region && config.endpoint) {
      try {
        // Create a minimal client just for testing
        const testClient = new S3Client({
          region: config.region,
          endpoint: config.endpoint,
          credentials: {
            accessKeyId: process.env.WASABI_ACCESS_KEY || '',
            secretAccessKey: process.env.WASABI_SECRET_KEY || '',
          },
          forcePathStyle: true,
        });
        
        // Try to list buckets - this will verify credentials work
        const listCommand = new ListBucketsCommand({});
        const listResult = await testClient.send(listCommand);
        
        credentialsVerified = true;
        
        // Check if our target bucket is accessible
        if (listResult.Buckets && config.bucket) {
          bucketsAccessible = listResult.Buckets.some(bucket => 
            bucket.Name === config.bucket
          );
        }
      } catch (error) {
        console.error('Error verifying Wasabi credentials:', error);
        // We'll return false for credentialsVerified
      }
    }

    // Return the configuration (without sensitive values)
    return NextResponse.json({
      success: true,
      config: {
        ...config,
        credentialsVerified,
        bucketsAccessible,
      }
    });
  } catch (error) {
    console.error('Error checking Wasabi configuration:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}