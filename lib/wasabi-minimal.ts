import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

// Initialize S3 client configured for Wasabi
console.log("--- Minimal Wasabi S3Client Init ---");
console.log(`Region: ${process.env.WASABI_REGION}`);
console.log(`Endpoint: ${process.env.WASABI_ENDPOINT}`);
console.log(`Access Key Configured: ${Boolean(process.env.WASABI_ACCESS_KEY)}`);
console.log(`Secret Key Configured: ${Boolean(process.env.WASABI_SECRET_KEY)}`);
// Log a preview of the secret key (first 5 characters)
console.log(`Secret Key Preview: ${process.env.WASABI_SECRET_KEY ? process.env.WASABI_SECRET_KEY.substring(0, 5) + '...' : 'Not set'}`);
console.log("------------------------------------");

export const wasabiClientMinimal = new S3Client({
  region: process.env.WASABI_REGION || 'us-east-1', // Use region from env var
  endpoint: process.env.WASABI_ENDPOINT || 'https://s3.us-east-1.wasabisys.com',
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY || '',
    secretAccessKey: process.env.WASABI_SECRET_KEY || '',
  },
  forcePathStyle: true, // Important for Wasabi
});

export async function listWasabiBuckets() {
  console.log("Attempting to list Wasabi buckets...");
  const command = new ListBucketsCommand({});
  try {
    const response = await wasabiClientMinimal.send(command);
    console.log("List buckets successful.");
    return { success: true, buckets: response.Buckets };
  } catch (error) {
    console.error("Error listing Wasabi buckets:", error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
} 