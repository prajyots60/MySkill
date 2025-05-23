const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

if (!process.env.WASABI_ACCESS_KEY || !process.env.WASABI_SECRET_KEY || !process.env.NEXT_PUBLIC_WASABI_REGION) {
  console.error('Missing required environment variables. Please check your .env file.');
  console.error('Required variables: WASABI_ACCESS_KEY_ID, WASABI_SECRET_ACCESS_KEY, NEXT_PUBLIC_WASABI_REGION');
  process.exit(1);
}

// Configure AWS SDK v3 for Wasabi
const s3Client = new S3Client({
  endpoint: `https://s3.${process.env.NEXT_PUBLIC_WASABI_REGION}.wasabisys.com`,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY,
    secretAccessKey: process.env.WASABI_SECRET_KEY
  },
  region: process.env.NEXT_PUBLIC_WASABI_REGION,
  forcePathStyle: true
});

async function deployWasabiCORS() {
  try {
    // Read CORS configuration
    const corsConfig = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'wasabi-cors.json'), 'utf8')
    );

    // Deploy CORS configuration
    const params = {
      Bucket: process.env.NEXT_PUBLIC_WASABI_BUCKET,
      CORSConfiguration: {
        CORSRules: corsConfig
      }
    };

    console.log('Deploying CORS configuration to Wasabi bucket...');
    // Deploy CORS configuration using AWS SDK v3
    const command = new PutBucketCorsCommand(params);
    await s3Client.send(command);
    console.log('CORS configuration deployed successfully!');
  } catch (error) {
    if (error.name === 'NoSuchBucket') {
      console.error(`Error: Bucket ${process.env.NEXT_PUBLIC_WASABI_BUCKET} not found`);
    } else if (error.name === 'AccessDenied') {
      console.error('Error: Access denied. Please check your credentials and bucket permissions');
    } else {
      console.error('Error deploying CORS configuration:', error);
    }
    process.exit(1);
  }
}

deployWasabiCORS();
