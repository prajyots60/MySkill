import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3 client for Wasabi
let s3Client: S3Client;

/**
 * Initialize the S3 client for Wasabi
 */
function getS3Client() {
  if (s3Client) return s3Client;

  // Get configuration from environment variables
  const accessKey = process.env.WASABI_ACCESS_KEY;
  const secretKey = process.env.WASABI_SECRET_KEY;
  const region = process.env.WASABI_REGION;
  const endpoint = process.env.WASABI_ENDPOINT;

  if (!accessKey || !secretKey || !region || !endpoint) {
    console.error('Wasabi storage configuration is incomplete:', { 
      hasAccessKey: !!accessKey, 
      hasSecretKey: !!secretKey, 
      region, 
      endpoint 
    });
    throw new Error('Wasabi storage is not properly configured');
  }

  // Create and configure the S3 client
  s3Client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true, // Required for Wasabi
  });

  console.log(`Wasabi S3 client initialized with region: ${region}, endpoint: ${endpoint}`);
  return s3Client;
}

/**
 * Upload a file to Wasabi
 */
export async function uploadToWasabi(
  key: string,
  data: Buffer,
  contentType: string,
  metadata: Record<string, string> = {}
) {
  try {
    const client = getS3Client();
    const bucket = process.env.WASABI_BUCKET;

    if (!bucket) {
      throw new Error('Wasabi bucket is not configured');
    }

    // Convert metadata to strings
    const s3Metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      s3Metadata[key] = String(value);
    }

    // Upload the file
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      Metadata: s3Metadata,
    });

    await client.send(command);

    // Return the URL of the uploaded file
    const url = `https://${bucket}.s3.${process.env.WASABI_REGION}.wasabisys.com/${encodeURIComponent(key)}`;

    return {
      success: true,
      key,
      url,
    };
  } catch (error) {
    console.error('Error uploading to Wasabi:', error);
    throw error;
  }
}

/**
 * Generate a pre-signed URL for uploading a file to Wasabi
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  metadata: Record<string, string> = {},
  expiresIn = 3600 // Default: 1 hour
) {
  try {
    const client = getS3Client();
    const bucket = process.env.WASABI_BUCKET;

    if (!bucket) {
      throw new Error('Wasabi bucket is not configured');
    }

    // Convert metadata to strings
    const s3Metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      s3Metadata[key] = String(value);
    }

    // Create the command for uploading
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: s3Metadata,
    });

    // Generate the pre-signed URL
    const presignedUrl = await getSignedUrl(client, command, { expiresIn });

    return {
      success: true,
      url: presignedUrl,
      key,
    };
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    throw error;
  }
}

/**
 * Generate a pre-signed URL for downloading a file from Wasabi
 */
export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn = 3600 // Default: 1 hour
) {
  try {
    const client = getS3Client();
    const bucket = process.env.WASABI_BUCKET;

    if (!bucket) {
      throw new Error('Wasabi bucket is not configured');
    }

    // Create the command for downloading
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    // Generate the pre-signed URL
    const presignedUrl = await getSignedUrl(client, command, { expiresIn });

    return {
      success: true,
      url: presignedUrl,
    };
  } catch (error) {
    console.error('Error generating pre-signed download URL:', error);
    throw error;
  }
}