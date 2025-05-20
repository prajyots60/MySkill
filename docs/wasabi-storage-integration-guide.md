# Wasabi Storage Integration Guide

This document provides comprehensive guidance for setting up and troubleshooting the Wasabi cloud storage integration for the education platform.

## Getting Started

### Prerequisites

1. A Wasabi cloud storage account
2. Access Key and Secret Key with appropriate permissions
3. A bucket created in Wasabi for storing files

### Environment Configuration

Add the following variables to your `.env.local` file:

```bash
# Wasabi Cloud Storage Configuration
WASABI_ACCESS_KEY=your_access_key
WASABI_SECRET_KEY=your_secret_key
WASABI_REGION=ap-southeast-1
WASABI_ENDPOINT=https://s3.ap-southeast-1.wasabisys.com
WASABI_BUCKET=your_bucket_name

# Client-side Wasabi configuration
NEXT_PUBLIC_WASABI_BUCKET=your_bucket_name
NEXT_PUBLIC_WASABI_REGION=ap-southeast-1
```

**Important Notes:**
- For Wasabi AP regions (ap-southeast-1, ap-northeast-1, etc.), use the **actual region name** for both server and client configuration.
- The endpoint should use the format: `https://s3.{region}.wasabisys.com`

## Common Issues and Solutions

### SignatureDoesNotMatch Error

#### Symptoms
- API calls to Wasabi fail with "SignatureDoesNotMatch" error
- Error message: "The request signature we calculated does not match the signature you provided."

#### Solutions

1. **Region Consistency**
   - Ensure that the `WASABI_REGION` environment variable matches the region of your bucket
   - For most cases, the signing region should match the actual bucket region

2. **Path-Style Addressing**
   - Use path-style addressing with Wasabi by setting `forcePathStyle: true` in the S3 client configuration

3. **Protocol and Endpoint**
   - Always use HTTPS in the endpoint URL
   - Verify the endpoint follows the correct format: `https://s3.{region}.wasabisys.com`

4. **API Compatibility**
   - Use known compatible AWS SDK versions. This application is tested with @aws-sdk/client-s3 version ^3.0.0

### Access Denied Errors

#### Symptoms
- API calls to Wasabi fail with "Access Denied" or "403 Forbidden" errors

#### Solutions

1. **Permissions**
   - Verify your access key and secret key have appropriate permissions
   - Check bucket policies and ACLs to ensure they allow the intended operations

2. **Bucket Region**
   - Confirm that you're accessing the bucket in the correct region

3. **Bucket Name**
   - Ensure the bucket name is correct and matches case exactly

### Bucket Not Found Errors

#### Symptoms
- API calls fail with "NoSuchBucket" or "404 Not Found" errors

#### Solutions

1. **Bucket Existence**
   - Verify the bucket exists in your Wasabi account
   - Use the Wasabi console to check bucket name and region

2. **Region Configuration**
   - Confirm you're targeting the correct region in your configuration

## Testing Your Integration

We provide a diagnostic test tool at `/storage-test` that can help identify and fix integration issues:

1. Navigate to `/storage-test` in your application
2. Run the diagnostic tests to check configuration, bucket access, and file uploads
3. View detailed logs for troubleshooting

## Advanced Configuration

### Custom URL Construction

If you need to customize how URLs are constructed for uploaded files, modify the URL construction in the `uploadToWasabi` function in `lib/wasabi-storage.ts`:

```typescript
url: `https://s3.${process.env.NEXT_PUBLIC_WASABI_REGION || 'ap-southeast-1'}.wasabisys.com/${BUCKET_NAME}/${key}`,
```

### Optimizing for Performance

For improved performance:

1. **Regional Endpoints**: Always use the regional endpoint closest to your application servers
2. **Caching Headers**: Consider setting appropriate caching headers for static files
3. **Content-Type**: Always set the correct content-type for uploaded files for proper browser handling

## Support

If you continue to experience issues after following this guide, please reach out to support with the following information:

1. Your environment configuration (excluding secrets)
2. Error messages and logs from the diagnostic tests
3. The specific API operations that are failing

## Changelog

**Version 1.0 (May 2025)**
- Initial documentation

**Version 1.1 (May 2025)**
- Added region matching fixes for AP regions
- Updated troubleshooting section with signature mismatch solutions
