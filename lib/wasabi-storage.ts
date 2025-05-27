import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

/**
 * Delete a file from Wasabi storage
 * @param key The key (path) of the file to delete
 * @returns Object with success status and metadata
 */
export async function deleteFromWasabi(key: string) {
  try {
    const client = getS3Client();
    const bucket = process.env.WASABI_BUCKET;

    if (!bucket) {
      throw new Error('Wasabi bucket is not configured');
    }

    // Create the command for deleting the object
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    // Execute the delete command
    const response = await client.send(command);

    return {
      success: true,
      key,
      deleted: true,
      deleteMarker: response.DeleteMarker,
      versionId: response.VersionId,
    };
  } catch (error) {
    console.error('Error deleting file from Wasabi:', error);
    throw error;
  }
}

/**
 * Generate a storage key (path) for a file in Wasabi
 * @param category The category/folder for the file (e.g., 'images', 'videos', 'documents')
 * @param filename The original filename
 * @param userId The ID of the user who owns the file
 * @param useOriginalName Whether to use the original filename or generate a UUID (default: false)
 * @returns A unique storage key for the file
 */
export function generateStorageKey(
  category: string,
  filename: string,
  userId: string,
  useOriginalName: boolean = false
): string {
  // Sanitize the category and ensure it doesn't contain path traversal
  const sanitizedCategory = category.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
  
  // Get the file extension
  const ext = path.extname(filename);
  
  // Generate a unique filename or use the original
  const uniqueFilename = useOriginalName
    ? sanitizeFilename(filename)
    : `${uuidv4()}${ext}`;
  
  // Format: users/{userId}/{category}/{uniqueFilename}
  return `users/${userId}/${sanitizedCategory}/${uniqueFilename}`;
}

/**
 * Sanitize a filename to be safe for storage
 * @param filename The original filename
 * @returns A sanitized version of the filename
 */
function sanitizeFilename(filename: string): string {
  // Remove any path components and keep only the base filename
  const basename = path.basename(filename);
  
  // Replace any potentially problematic characters
  return basename
    .replace(/[^\w\s.-]/g, '') // Remove special characters except dots, hyphens, and underscores
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .toLowerCase();            // Convert to lowercase
}