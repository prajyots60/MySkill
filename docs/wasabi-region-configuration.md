# Wasabi Region Configuration Guide

## Common Issues with Wasabi S3-Compatible Storage

When working with Wasabi's S3-compatible storage service, one of the most common issues is the **SignatureDoesNotMatch** error. This typically occurs due to a mismatch between the signing region and the actual bucket region.

## The Solution: Region Consistency

The key to fixing signature mismatch errors is to ensure that the signing region (used for authentication) matches the actual bucket region.

### 1. Environment Variables

Make sure your environment variables are configured consistently:

```
# Wasabi Cloud Storage Configuration
WASABI_ACCESS_KEY=your-access-key
WASABI_SECRET_KEY=your-secret-key
WASABI_REGION=ap-southeast-1       # Must match your actual bucket region
WASABI_ENDPOINT=https://s3.ap-southeast-1.wasabisys.com
WASABI_BUCKET=your-bucket-name

# Client-side Wasabi configuration
NEXT_PUBLIC_WASABI_BUCKET=your-bucket-name
NEXT_PUBLIC_WASABI_REGION=ap-southeast-1
```

### 2. S3 Client Configuration

Your S3 client must be configured with the same region as your bucket:

```typescript
export const wasabiClient = new S3Client({
  region: process.env.WASABI_REGION || 'ap-southeast-1', // Same as bucket region
  endpoint: process.env.WASABI_ENDPOINT,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY || '',
    secretAccessKey: process.env.WASABI_SECRET_KEY || '',
  },
  forcePathStyle: true, // Important for Wasabi
});
```

## Region-Specific Endpoints

Wasabi uses different endpoints for different regions:

| Region | Endpoint |
|--------|----------|
| us-east-1 | https://s3.us-east-1.wasabisys.com |
| us-east-2 | https://s3.us-east-2.wasabisys.com |
| us-central-1 | https://s3.us-central-1.wasabisys.com |
| us-west-1 | https://s3.us-west-1.wasabisys.com |
| ap-northeast-1 | https://s3.ap-northeast-1.wasabisys.com |
| ap-southeast-1 | https://s3.ap-southeast-1.wasabisys.com |
| ap-southeast-2 | https://s3.ap-southeast-2.wasabisys.com |
| eu-central-1 | https://s3.eu-central-1.wasabisys.com |
| eu-central-2 | https://s3.eu-central-2.wasabisys.com |
| eu-west-1 | https://s3.eu-west-1.wasabisys.com |
| eu-west-2 | https://s3.eu-west-2.wasabisys.com |

## Troubleshooting Steps

If you continue to experience signature mismatch errors:

1. **Double-check region consistency**: The region in your S3 client config must match the bucket's region
2. **Verify credentials**: Make sure the access key and secret key are correct
3. **Check endpoint URL**: The endpoint URL should include the correct region
4. **Use path-style addressing**: Set `forcePathStyle: true` in your S3 client config
5. **Check request timestamps**: Ensure your server's clock is synchronized (NTP)
6. **Examine S3 operation logs**: Enable detailed logging to see the exact signature calculation

## Testing Your Configuration

Use the provided configuration checker to validate your Wasabi settings:

```
GET /api/storage/check-config
```

This endpoint will verify:
- Your credentials are valid
- The bucket exists and is accessible
- The region configuration is consistent

## More Resources

- [Official Wasabi Documentation](https://wasabi-support.zendesk.com/hc/en-us)
- [S3 Signature V4 Process](https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-authenticating-requests.html)
