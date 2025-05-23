import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

// Update endpoint handling to ensure proper format
const WASABI_ACCESS_KEY = process.env.WASABI_ACCESS_KEY || process.env.WASABI_ACCESS_KEY_ID || '';
const WASABI_SECRET_KEY = process.env.WASABI_SECRET_KEY || process.env.WASABI_SECRET_ACCESS_KEY || '';
const WASABI_REGION = process.env.WASABI_REGION || 'ap-southeast-1';
const WASABI_BUCKET = process.env.WASABI_BUCKET || 'edutube';

// Ensure endpoint is properly formatted
let WASABI_ENDPOINT = process.env.WASABI_ENDPOINT || '';
if (!WASABI_ENDPOINT) {
  WASABI_ENDPOINT = `https://s3.${WASABI_REGION}.wasabisys.com`;
} else {
  // Remove any protocol prefix
  WASABI_ENDPOINT = WASABI_ENDPOINT.replace(/^https?:\/\//, '');
  // Ensure region is in the endpoint
  if (!WASABI_ENDPOINT.includes(WASABI_REGION)) {
    WASABI_ENDPOINT = WASABI_ENDPOINT.replace('s3.', `s3.${WASABI_REGION}.`);
  }
  // Ensure protocol is present
  if (!WASABI_ENDPOINT.startsWith('http')) {
    WASABI_ENDPOINT = `https://${WASABI_ENDPOINT}`;
  }
}

console.log('Wasabi Configuration:', {
  region: WASABI_REGION,
  endpoint: WASABI_ENDPOINT,
  bucket: WASABI_BUCKET,
  hasAccessKey: !!WASABI_ACCESS_KEY,
  hasSecretKey: !!WASABI_SECRET_KEY
});

// Create S3 client with Wasabi endpoint
const wasabiClient = new S3Client({
  region: WASABI_REGION,
  endpoint: WASABI_ENDPOINT,
  credentials: {
    accessKeyId: WASABI_ACCESS_KEY,
    secretAccessKey: WASABI_SECRET_KEY,
  },
  forcePathStyle: true // Required for Wasabi
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
      // Add response-content-disposition to prevent download
      ResponseContentDisposition: 'inline',
      // Add response-content-type for video streaming
      ResponseContentType: 'video/mp4'
    });
    
    const url = await getSignedUrl(wasabiClient, command, { 
      expiresIn,
      // Ensure these headers are included in the signature
      signableHeaders: new Set([
        'host',
        'range',
        'content-type',
        'content-length'
      ])
    });

    console.log(`Generated presigned URL (base): ${url.split('?')[0]}`);
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate presigned URL');
  }
}
