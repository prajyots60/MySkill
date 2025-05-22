import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

// Wasabi credentials from environment variables
const WASABI_ACCESS_KEY = process.env.WASABI_ACCESS_KEY || process.env.WASABI_ACCESS_KEY_ID || '';
const WASABI_SECRET_KEY = process.env.WASABI_SECRET_KEY || process.env.WASABI_SECRET_ACCESS_KEY || '';
const WASABI_REGION = process.env.WASABI_REGION || 'ap-southeast-1';
const WASABI_BUCKET = process.env.WASABI_BUCKET || 'edutube';

// Log the configuration (without secrets)
console.log('Wasabi Configuration:', {
  region: WASABI_REGION,
  bucket: WASABI_BUCKET,
  hasAccessKey: !!WASABI_ACCESS_KEY,
  hasSecretKey: !!WASABI_SECRET_KEY,
  endpoint: `https://s3.${WASABI_REGION}.wasabisys.com`
});

// Get the endpoint from environment or construct it
const WASABI_ENDPOINT = process.env.WASABI_ENDPOINT || `https://s3.${WASABI_REGION}.wasabisys.com`;

// Create S3 client with Wasabi endpoint
const wasabiClient = new S3Client({
  region: WASABI_REGION,
  endpoint: WASABI_ENDPOINT,
  credentials: {
    accessKeyId: WASABI_ACCESS_KEY,
    secretAccessKey: WASABI_SECRET_KEY,
  },
});

/**
 * Generate a presigned URL for accessing a file in Wasabi
 * @param key - The object key (file path) in the bucket
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Presigned URL
 */
export async function generatePresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  console.log(`Generating presigned URL for: ${key} in bucket: ${WASABI_BUCKET}`);
  
  try {
    // Clean up the key if it starts with a slash
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    
    const command = new GetObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: cleanKey,
    });
    
    const url = await getSignedUrl(wasabiClient, command, { expiresIn });
    console.log(`Generated presigned URL: ${url}`);
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate presigned URL');
  }
}
