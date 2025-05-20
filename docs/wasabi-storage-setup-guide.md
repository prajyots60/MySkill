# Wasabi Storage Integration Setup Guide

This guide will walk you through the complete process of setting up and integrating Wasabi cloud storage in your educational platform.

## 1. Account Setup & Initial Configuration

### Sign up for Wasabi

1. Go to [Wasabi Cloud Storage](https://wasabi.com/) and sign up for an account
2. Once registered, create an S3 bucket for your educational platform
3. Generate access and secret keys with appropriate permissions

### Configure CORS for Client-Side Uploads

Navigate to your bucket settings and set up CORS configuration:

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://your-domain.com</AllowedOrigin>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
  </CORSRule>
</CORSConfiguration>
```

### Important Wasabi Configuration Notes

1. **Authentication Region**: Wasabi requires `us-east-1` as the region parameter when authenticating API requests, regardless of where your bucket is actually located.

2. **Endpoint Configuration**: Use the region-specific endpoint format: `https://s3.[your-region].wasabisys.com` (e.g., `https://s3.ap-southeast-1.wasabisys.com`).

3. **URL Format**: For AP regions, the correct URL format is: `https://s3.ap-southeast-1.wasabisys.com/bucket-name/key` (not the virtual-hosted style format).

4. **Path Style**: Use `forcePathStyle: true` in the S3 client configuration for proper addressing.

## 2. Environment Configuration

Create or update your `.env.local` file with the following variables:

```
# Wasabi Storage Configuration
WASABI_ACCESS_KEY=your_wasabi_access_key
WASABI_SECRET_KEY=your_wasabi_secret_key
WASABI_REGION=us-east-1
WASABI_ENDPOINT=https://s3.ap-southeast-1.wasabisys.com
WASABI_BUCKET=your-bucket-name

# For client-side URL generation - use your bucket's actual region here
NEXT_PUBLIC_WASABI_BUCKET=your-bucket-name
NEXT_PUBLIC_WASABI_REGION=ap-southeast-1
```

**Important:** 
1. For authentication with the Wasabi API, always use `WASABI_REGION=us-east-1` regardless of your bucket's actual location.
2. For the endpoint, use the region-specific endpoint format: `https://s3.[your-region].wasabisys.com`
3. For URL construction (NEXT_PUBLIC variables), use your bucket's actual region.

## 3. Database Migration

Run the following commands to update your database with the new CourseResource model:

```bash
npx prisma migrate dev --name add_course_resources
```

If you encounter issues with the migration, you can try:

```bash
# Generate migration without applying
npx prisma migrate dev --name add_course_resources --create-only

# Edit the migration file if needed, then apply
npx prisma migrate dev
```

## 4. Testing Your Integration

### Test Backend Functionality

1. Use the demo page we created at `/examples/wasabi-storage` to test uploads and downloads
2. Verify that files are being stored in your Wasabi bucket
3. Check that presigned URLs work correctly for both uploads and downloads

### Test Course Resource Management

1. Go to a course page where you have creator access
2. Try uploading various file types using the CourseResourceManager component
3. Verify that uploads are properly categorized and accessible to enrolled students

## 5. Wasabi Integration Features

This integration provides several key features:

1. **Direct server-side uploads**: For small files or when additional processing is needed
2. **Presigned URL uploads**: For large files, uploaded directly from the browser to Wasabi
3. **Secure file access**: Files are accessible only to authorized users via temporary URLs
4. **Organized storage**: Files are automatically organized by category, course, and user
5. **Course resource management**: Complete UI for managing course resources

## 6. Architecture Overview

The integration consists of the following components:

1. **Base Storage Library** (`lib/wasabi-storage.ts`): Core functions for interacting with Wasabi
2. **Course Storage Utilities** (`lib/course-storage-utils.ts`): Higher-level functions for course-specific files
3. **API Endpoints** (`app/api/storage/...` and `app/api/courses/.../resources/...`): RESTful endpoints for file operations
4. **UI Components** (`components/wasabi-file-uploader.tsx` and `components/course-resource-manager.tsx`): React components for file uploads
5. **Client Hook** (`hooks/use-wasabi-storage.ts`): React hook for working with storage in client components

## 7. Usage in Your Application

### Basic File Upload

```tsx
import WasabiFileUploader from '@/components/wasabi-file-uploader';

<WasabiFileUploader
  category="documents"
  onUploadComplete={(data) => console.log('File uploaded:', data)}
  allowedFileTypes={['application/pdf']}
  maxSizeMB={10}
/>
```

### Course Resource Management

```tsx
import CourseResourceManager from '@/components/course-resource-manager';

<CourseResourceManager
  courseId="course-123"
  courseTitle="My Course"
  isCreator={true}
/>
```

### Using the Storage Hook

```tsx
import { useWasabiStorage } from '@/hooks/use-wasabi-storage';

function MyComponent() {
  const { uploadFile, getFileUrl } = useWasabiStorage();
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const result = await uploadFile({
      file,
      category: 'documents',
      metadata: { purpose: 'example' }
    });
    
    if (result.success) {
      console.log('File uploaded:', result.url);
    }
  };
  
  return (
    <input type="file" onChange={handleFileChange} />
  );
}
```

## 8. Optimization Tips

1. **Large file handling**: For files larger than 100MB, use the client-side presigned URL method
2. **CDN integration**: Consider using a CDN in front of Wasabi for faster delivery
3. **Background processing**: Use a queue for processing uploads to avoid blocking the UI
4. **File deduplication**: Implement checksums to avoid storing duplicates
5. **Lifecycle management**: Set up lifecycle policies in Wasabi to manage old/unused files

## 9. Troubleshooting

### Common Issues and Solutions

#### "The request signature we calculated does not match the signature you provided"
- **Cause**: Incorrect access key or secret key, or using the wrong AWS signature version.
- **Solution**: 
  - Double-check your access key and secret key for typos or incorrect copying
  - Ensure your .env.local file has the correct values
  - Use the region-specific endpoint: `https://s3.ap-southeast-1.wasabisys.com` 
  - Set `forcePathStyle: true` in the S3 client configuration

#### "The authorization header is malformed; the region is wrong"
- **Cause**: Using the wrong region for authentication.
- **Solution**: Always use `us-east-1` for the `WASABI_REGION` variable regardless of your bucket's actual location.

#### CORS Errors
- **Cause**: Incorrect CORS configuration on your Wasabi bucket.
- **Solution**: Make sure your CORS configuration includes your domain and localhost for development.

#### General Troubleshooting Steps
1. Check that your environment variables are correct
2. Verify your Wasabi bucket permissions and CORS settings
3. Look for errors in the server logs and browser console
4. Test the API endpoints directly using a tool like Postman
5. Try creating a simple test file to upload directly through the Wasabi console

## 10. Next Steps

Once basic integration is working, consider implementing:

1. File versioning for important documents
2. File preview capabilities for common formats
3. Batch upload/download features
4. Video transcoding for uploaded videos
5. Advanced permissions for team collaboration

For more details, see the comprehensive documentation at `/docs/wasabi-storage-integration.md`.
