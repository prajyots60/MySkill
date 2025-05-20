# Wasabi Cloud Storage Integration Guide

This guide explains how to set up and use Wasabi cloud storage integration in the educational platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration](#configuration)
3. [Usage](#usage)
   - [Server-Side Usage](#server-side-usage)
   - [Client-Side Usage](#client-side-usage)
4. [API Endpoints](#api-endpoints)
5. [Security Considerations](#security-considerations)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before integrating Wasabi storage, you need:

1. A Wasabi account
2. An S3 bucket created in Wasabi
3. Access and Secret keys with permissions to read/write to the bucket

## Configuration

### Environment Variables

Add the following environment variables to your `.env.local` file:

```
# Required for server-side operations
WASABI_ACCESS_KEY=your_wasabi_access_key
WASABI_SECRET_KEY=your_wasabi_secret_key
WASABI_REGION=your_region (e.g., us-east-1)
WASABI_ENDPOINT=https://s3.wasabisys.com
WASABI_BUCKET=your-bucket-name

# Optional for client-side URL generation (only add if needed)
NEXT_PUBLIC_WASABI_BUCKET=your-bucket-name
NEXT_PUBLIC_WASABI_REGION=your_region
```

### CORS Configuration for the Wasabi Bucket

For client-side direct uploads using presigned URLs, you need to configure CORS on your Wasabi bucket:

1. Log in to your Wasabi account
2. Navigate to your bucket
3. Go to the "Properties" tab
4. Add a CORS configuration similar to:

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

Replace `https://your-domain.com` with your production domain.

## Usage

### Server-Side Usage

Import the necessary functions from the Wasabi storage library:

```typescript
import { 
  uploadToWasabi, 
  generatePresignedUploadUrl, 
  generatePresignedGetUrl, 
  deleteFromWasabi,
  generateStorageKey
} from '@/lib/wasabi-storage';
```

#### Examples

**Upload a file:**

```typescript
const buffer = Buffer.from(arrayBuffer); // Convert File/ArrayBuffer to Buffer
const key = generateStorageKey('documents', 'my-file.pdf', userId);
const result = await uploadToWasabi(key, buffer, 'application/pdf', {
  createdBy: userId,
  courseId: 'course-123'
});
// result.url contains the file URL
// result.key contains the storage key
```

**Generate a presigned URL for uploads:**

```typescript
const key = generateStorageKey('images', 'profile.jpg', userId);
const { url, key } = await generatePresignedUploadUrl(key, 'image/jpeg', 3600);
// url is the presigned URL the client can use to upload directly
```

**Generate a presigned URL for viewing/downloading:**

```typescript
const { url } = await generatePresignedGetUrl('documents/users/123/abc123-lecture.pdf', 3600);
// url is a temporary URL that can be used to access the file
```

**Delete a file:**

```typescript
const result = await deleteFromWasabi('documents/users/123/abc123-lecture.pdf');
// result.success indicates if the deletion was successful
```

### Client-Side Usage

#### Using the WasabiFileUploader Component

The `WasabiFileUploader` component provides a complete UI for uploading files:

```tsx
import WasabiFileUploader from '@/components/wasabi-file-uploader';

// In your component
<WasabiFileUploader
  category="documents"
  onUploadComplete={(fileData) => {
    console.log('File uploaded:', fileData);
    // fileData contains: url, key, filename, fileType, fileSize
  }}
  allowedFileTypes={['application/pdf', 'image/jpeg']}
  maxSizeMB={10}
  metadata={{ courseId: '123', purpose: 'lecture-material' }}
/>
```

#### Using the useWasabiStorage Hook

For more control, use the `useWasabiStorage` hook:

```tsx
import { useWasabiStorage } from '@/hooks/use-wasabi-storage';

function MyComponent() {
  const { 
    uploadFile, 
    deleteFile, 
    getFileUrl, 
    isUploading, 
    uploadProgress 
  } = useWasabiStorage();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const result = await uploadFile({
      file,
      category: 'documents',
      metadata: { courseId: '123' },
      onProgress: (progress) => console.log(`Upload progress: ${progress}%`),
      usePresignedUrl: true // Set to false for server-side upload
    });

    if (result.success) {
      console.log('File uploaded:', result.url, result.key);
    } else {
      console.error('Upload failed:', result.error);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      {isUploading && <progress value={uploadProgress} max="100" />}
    </div>
  );
}
```

#### Accessing Files

To access a file, generate a presigned URL:

```typescript
const { getFileUrl } = useWasabiStorage();

const handleViewFile = async (key) => {
  const result = await getFileUrl(key);
  if (result.success && result.url) {
    window.open(result.url, '_blank');
  }
};
```

## API Endpoints

The platform provides several API endpoints for working with Wasabi storage:

### `/api/storage/presigned-url` (POST)

Generate a presigned URL for direct browser uploads.

**Request:**
```json
{
  "filename": "my-document.pdf",
  "contentType": "application/pdf",
  "category": "documents",
  "expiresIn": 3600
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://presigned-upload-url...",
  "key": "documents/users/123/abc123-my-document.pdf",
  "filename": "my-document.pdf",
  "contentType": "application/pdf",
  "category": "documents",
  "expiresIn": 3600
}
```

### `/api/storage/upload` (POST)

Upload a file via the server (multipart form data).

**Request:**
- `file`: The file to upload
- `category`: The category (e.g., documents, images)
- `metadata`: Optional JSON string with metadata

**Response:**
```json
{
  "success": true,
  "jobId": "job-123",
  "url": "https://bucket.s3.region.wasabisys.com/path/to/file",
  "key": "documents/users/123/abc123-my-document.pdf",
  "filename": "my-document.pdf",
  "fileType": "application/pdf",
  "fileSize": 1024,
  "category": "documents"
}
```

### `/api/storage/get-url` (POST)

Generate a presigned URL for viewing/downloading a file.

**Request:**
```json
{
  "key": "documents/users/123/abc123-my-document.pdf",
  "expiresIn": 3600
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://presigned-get-url...",
  "key": "documents/users/123/abc123-my-document.pdf",
  "expiresIn": 3600
}
```

### `/api/storage/delete` (POST)

Delete a file from Wasabi storage.

**Request:**
```json
{
  "key": "documents/users/123/abc123-my-document.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "key": "documents/users/123/abc123-my-document.pdf"
}
```

## Security Considerations

1. **Access Control**: Files are organized with user IDs in their paths to ensure users can only access their own files.
2. **Content Type Validation**: Only allowed content types can be uploaded.
3. **File Size Limits**: The API enforces file size limits to prevent abuse.
4. **Temporary URLs**: All access URLs are temporary and expire after a specified time.
5. **Server-Side Validation**: All API endpoints perform proper authentication and validation.

## Troubleshooting

### Common Issues

1. **Upload Fails with 403 Forbidden**:
   - Check CORS configuration on the Wasabi bucket
   - Verify API credentials have proper permissions

2. **File Not Found**:
   - Ensure you're using the correct key format
   - Check if the file was deleted or expired

3. **Upload Timeouts**:
   - For large files, consider using presigned URLs instead of server uploads
   - Check network conditions and Wasabi service status

4. **Environment Variables Not Working**:
   - Restart the server after updating environment variables
   - Check for typos in variable names

### Logs

Check server logs for detailed error messages when uploads fail or other issues occur.
