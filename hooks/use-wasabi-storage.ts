'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

interface UploadOptions {
  file: File;
  category: string;
  metadata?: Record<string, string>;
  onProgress?: (progress: number) => void;
  usePresignedUrl?: boolean;
}

interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  securityToken?: string; // Add security token to interface
  error?: string;
}

interface DeleteResult {
  success: boolean;
  key?: string;
  error?: string;
}

interface GetUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

export function useWasabiStorage() {
  const { data: session } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Initialize AWS S3 client for Wasabi (client-side)
  const getS3Client = () => {
    const region = process.env.NEXT_PUBLIC_WASABI_REGION || 'ap-southeast-1';
    const endpoint = `https://s3.${region}.wasabisys.com`;
    const bucket = process.env.NEXT_PUBLIC_WASABI_BUCKET || 'edutube';
    
    // Get temporary credentials from our server
    return { region, endpoint, bucket };
  };

  /**
   * Upload a file directly to Wasabi storage
   */
  const uploadFile = async ({
    file,
    category,
    metadata = {},
    onProgress,
    usePresignedUrl = true, // Default to using presigned URL for direct upload
  }: UploadOptions): Promise<UploadResult> => {
    if (!session?.user) {
      return { success: false, error: 'You must be logged in to upload files' };
    }

    // Check Wasabi configuration before attempting upload
    try {
      const configResponse = await fetch('/api/storage/check-config');
      if (configResponse.ok) {
        const { success, config } = await configResponse.json();
        if (!success || !config.hasAccessKey || !config.hasSecretKey || !config.bucket) {
          console.error('Wasabi configuration issue detected:', config);
          return {
            success: false,
            error: 'Storage is not properly configured. Please contact support.'
          };
        }
        
        // Log configuration for debugging
        console.log('Using storage configuration:', {
          region: config.region,
          bucket: config.bucket,
          endpointValid: config.endpointMatches
        });
      }
    } catch (error) {
      console.warn('Could not verify storage configuration:', error);
      // Continue anyway as this is just a pre-check
    }

    // Add retry mechanism
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: Error | null = null;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      if (onProgress) onProgress(0);
      
      while (retryCount < maxRetries) {
        try {
          if (retryCount > 0) {
            console.log(`Retry attempt ${retryCount} for uploading ${file.name}`);
            // If this is a retry, reset progress
            setUploadProgress(0);
            if (onProgress) onProgress(0);
          }

          // Get presigned URL from our server
          console.log('Starting direct upload for file:', file.name, 'category:', category);
          
          // Generate a file key based on the category and filename
          const timestamp = Date.now();
          const uniqueId = Math.random().toString(36).substring(2, 10);
          const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileKey = `${category}/${timestamp}-${uniqueId}-${safeFileName}`;
          
          // Step 1: Get a presigned URL for direct upload
          setUploadProgress(10);
          if (onProgress) onProgress(10);
          
          const presignedUrlResponse = await fetch('/api/wasabi-presigned-upload-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filename: safeFileName,
              contentType: file.type,
              category: category,
              metadata: Object.fromEntries(
                Object.entries(metadata).map(([k, v]) => [k, String(v)])
              )
            }),
          });

          if (!presignedUrlResponse.ok) {
            const errorData = await presignedUrlResponse.json();
            throw new Error(errorData.message || 'Failed to get upload URL');
          }

          const presignedData = await presignedUrlResponse.json();
          const { 
            url: presignedUrl, 
            key: returnedFileKey,
            securityToken,
            expiresAt
          } = presignedData;
          
          // Verify URL hasn't expired
          if (expiresAt && Date.now() > expiresAt) {
            throw new Error('Upload URL has expired. Please request a new upload URL.');
          }
          
          setUploadProgress(20);
          if (onProgress) onProgress(20);
          
          // Step 2: Upload directly to Wasabi using the presigned URL with PUT method
          console.log(`Uploading to: ${presignedUrl.split('?')[0]}`); // Only log the base URL, not the query params

          // Use XMLHttpRequest for progress tracking
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', presignedUrl, true);
          
          // Set the content type header
          xhr.setRequestHeader('Content-Type', file.type);
          
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              // Calculate progress from 20-95% to leave room for initialization and completion
              const percentComplete = Math.round((event.loaded / event.total) * 75) + 20;
              setUploadProgress(percentComplete);
              if (onProgress) onProgress(percentComplete);
              
              // More detailed console logging for debugging progress updates
              console.log(`Upload progress for ${file.name}: ${percentComplete}%`);
            }
          });
          
          // Create a promise to handle the upload
          const uploadPromise = new Promise<UploadResult>((resolve, reject) => {          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              // Set to 99% instead of 100% - the final 100% will be shown when processing is complete
              // This helps differentiate between "upload complete" and "processing complete"
              setUploadProgress(99);
              if (onProgress) onProgress(99);
              
              // Construct the object URL based on the Wasabi configuration
              const { region, bucket } = getS3Client();
              const objectUrl = `https://${bucket}.s3.${region}.wasabisys.com/${encodeURIComponent(returnedFileKey)}`;
                
                // Verify the upload with the security token
                if (securityToken) {
                  // Call a verification endpoint to confirm the upload was successful
                  fetch('/api/storage/verify-upload', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      key: returnedFileKey,
                      securityToken,
                      contentType: file.type,
                      fileSize: file.size,
                    }),
                  }).catch(err => {
                    console.warn('Upload verification failed:', err);
                    // Continue anyway as the file was uploaded successfully
                  });
                }
                
                resolve({
                  success: true,
                  url: objectUrl,
                  key: returnedFileKey,
                  securityToken // Include this for later verification if needed
                });
              } else {
                console.error(`Upload failed with status ${xhr.status}:`, xhr.responseText);
                console.log('Metadata used:', metadata);
                reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
              }
            };
            
            xhr.onerror = () => {
              console.error('Network error during upload. Check your internet connection.');
              reject(new Error('Network error during upload. Check your internet connection.'));
            };
            
            xhr.ontimeout = () => {
              console.error('Upload timed out. The file may be too large or your connection may be slow.');
              reject(new Error('Upload timed out'));
            };
          });
          
          // Set a longer timeout (30 minutes for large files)
          xhr.timeout = 1800000; // 30 minutes
          
          // Send the file directly (not formData)
          xhr.send(file);
          
          // Wait for upload to complete
          return await uploadPromise;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          retryCount++;
          
          if (retryCount < maxRetries) {
            console.log(`Upload failed, retrying (${retryCount}/${maxRetries})...`, error);
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount - 1)));
          } else {
            throw lastError;
          }
        }
      }
      
      // If we reached here, we've exhausted all retries
      return {
        success: false,
        error: lastError?.message || 'Upload failed after multiple attempts'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
    } finally {
      // Ensure loading state is always reset
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  /**
   * Delete a file from Wasabi storage
   */
  const deleteFile = async (key: string): Promise<DeleteResult> => {
    if (!session?.user) {
      return { success: false, error: 'You must be logged in to delete files' };
    }

    try {
      const response = await fetch('/api/storage/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete file');
      }

      return { success: true, key };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        key,
      };
    }
  };

  /**
   * Get a temporary URL to access a file
   */
  const getFileUrl = async (key: string, expiresIn = 3600): Promise<GetUrlResult> => {
    if (!session?.user) {
      return { success: false, error: 'You must be logged in to access files' };
    }

    try {
      const response = await fetch('/api/storage/get-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, expiresIn }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get file URL');
      }

      const data = await response.json();
      return { success: true, url: data.url };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  };

  return {
    uploadFile,
    deleteFile,
    getFileUrl,
    isUploading,
    uploadProgress,
  };
}
