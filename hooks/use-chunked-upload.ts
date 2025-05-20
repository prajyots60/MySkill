'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

// Default chunk size: 5MB (adjust based on your needs)
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

interface ChunkedUploadOptions {
  file: File;
  category: string;
  metadata?: Record<string, string>;
  onProgress?: (progress: number) => void;
  chunkSize?: number;
}

interface ChunkedUploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export function useChunkedUpload() {
  const { data: session } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Upload a large file in chunks to avoid timeouts
   */
  const uploadLargeFile = async ({
    file,
    category,
    metadata = {},
    onProgress,
    chunkSize = DEFAULT_CHUNK_SIZE,
  }: ChunkedUploadOptions): Promise<ChunkedUploadResult> => {
    if (!session?.user) {
      return { success: false, error: 'You must be logged in to upload files' };
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      if (onProgress) onProgress(0);

      console.log(`Starting chunked upload for ${file.name} (${file.size} bytes)`);

      // Generate a file key based on the category and filename
      const timestamp = Date.now();
      const uniqueId = Math.random().toString(36).substring(2, 10);
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileKey = `${category}/${timestamp}-${uniqueId}-${safeFileName}`;

      // Calculate number of chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      console.log(`File will be split into ${totalChunks} chunks of ${chunkSize} bytes each`);

      // Step 1: Initialize the upload
      const initResponse = await fetch('/api/storage/chunked-upload?action=initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          totalChunks,
          fileKey,
          contentType: file.type,
          metadata,
        }),
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        throw new Error(errorData.message || 'Failed to initialize upload');
      }

      const { uploadId } = await initResponse.json();
      
      // Progress tracking
      let uploadedChunks = 0;
      
      // Step 2: Upload each chunk
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        // Retry logic for each chunk
        let chunkUploaded = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!chunkUploaded && retryCount < maxRetries) {
          try {
            const uploadResponse = await fetch(
              `/api/storage/chunked-upload?action=upload&uploadId=${uploadId}&chunkIndex=${chunkIndex}`,
              {
                method: 'POST',
                body: chunk,
              }
            );

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              throw new Error(errorData.message || 'Failed to upload chunk');
            }

            const responseData = await uploadResponse.json();
            
            // If this chunk completed the upload, return the result
            if (responseData.complete) {
              setUploadProgress(100);
              if (onProgress) onProgress(100);
              
              return {
                success: true,
                url: responseData.url,
                key: responseData.key,
              };
            }
            
            chunkUploaded = true;
            uploadedChunks++;
            
            // Update progress
            const progress = Math.round((uploadedChunks / totalChunks) * 100);
            setUploadProgress(progress);
            if (onProgress) onProgress(progress);
            
          } catch (error) {
            console.error(`Error uploading chunk ${chunkIndex}:`, error);
            retryCount++;
            
            if (retryCount >= maxRetries) {
              throw new Error(`Failed to upload chunk ${chunkIndex} after ${maxRetries} attempts`);
            }
            
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          }
        }
      }
      
      // Step 3: Check the status to ensure all chunks were received
      const statusResponse = await fetch(`/api/storage/chunked-upload?uploadId=${uploadId}`, {
        method: 'GET',
      });
      
      if (!statusResponse.ok) {
        const errorData = await statusResponse.json();
        throw new Error(errorData.message || 'Failed to check upload status');
      }
      
      const statusData = await statusResponse.json();
      
      if (!statusData.status.complete) {
        throw new Error('Upload is incomplete. Some chunks may be missing.');
      }
      
      setUploadProgress(100);
      if (onProgress) onProgress(100);
      
      return {
        success: true,
        key: fileKey,
        // Construct the URL since we don't have it directly
        url: `https://${process.env.NEXT_PUBLIC_WASABI_BUCKET}.s3.${process.env.NEXT_PUBLIC_WASABI_REGION}.wasabisys.com/${encodeURIComponent(fileKey)}`,
      };
    } catch (error) {
      console.error('Chunked upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadLargeFile,
    isUploading,
    uploadProgress,
  };
}
