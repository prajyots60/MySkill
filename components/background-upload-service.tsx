'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useUploadStore, type UploadTask } from '@/lib/store/upload-store';
import { useWasabiStorage } from '@/hooks/use-wasabi-storage';
import { toast } from '@/hooks/use-toast';
import { useCourseStore } from '@/lib/store/course-store';
import { useRouter } from 'next/navigation';

export function BackgroundUploadService() {
  const { 
    uploads, 
    activeUploadId, 
    updateUploadProgress, 
    updateUploadStatus,
    updateUploadMetadata,
    setActiveUpload,
    removeUpload
  } = useUploadStore();
  
  const router = useRouter();
  const { uploadFile, isUploading } = useWasabiStorage();
  const activeUploadRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  
  // Process the upload queue
  useEffect(() => {
    const processQueue = async () => {
      // If we're already processing an upload or there's no active upload ID, do nothing
      if (processingRef.current || !activeUploadId) return;
      
      // Set processing flag to prevent concurrent uploads
      processingRef.current = true;
      activeUploadRef.current = activeUploadId;
      
      const upload = uploads[activeUploadId];
      
      // Skip if no upload found or it's not in a queued state
      if (!upload || upload.status !== 'queued') {
        processingRef.current = false;
        return;
      }
      
      // Skip if it's a restartable upload but no file is provided
      if (upload.isRestartable && !upload.file) {
        console.log('Upload needs a file to restart:', upload.id);
        updateUploadStatus(upload.id, 'paused');
        processingRef.current = false;
        return;
      }
      
      // Only handle Wasabi uploads for now
      if (upload.videoSource !== 'wasabi') {
        console.log('Only Wasabi uploads are supported for background processing');
        processingRef.current = false;
        return;
      }

      try {
        // Update status to uploading
        updateUploadStatus(upload.id, 'uploading');
        
        // Create a fresh metadata object from scratch to avoid any immutability issues
        // Start with a copy of any existing metadata
        let metadataObj: Record<string, string> = { ...(upload.metadata || {}) };
        
        // Add our standard properties (overwriting any existing ones)
        metadataObj = {
          ...metadataObj,
          title: upload.title,
          sectionId: upload.sectionId,
          isPreview: upload.isPreview.toString(),
          contentType: 'video',
          videoSource: 'WASABI'
        };
        
        // Add description if it exists
        if (upload.description) {
          metadataObj = {
            ...metadataObj,
            description: upload.description
          };
        }
        
        // Check if encryption is needed
        let processedFile = upload.file!;
        let encryptionKey = null;
        
        // Add encryption flag to metadata if needed
        if (metadataObj.isEncrypted === 'true') {
          // Add it as a new property in an immutable way
          metadataObj = { ...metadataObj, isEncrypted: 'true' };
        }
        
        // Handle encryption if needed
        const enableEncryption = metadataObj.isEncrypted === 'true';
        
        if (enableEncryption) {
          try {
            // Generate a secure encryption key
            const keyArray = new Uint8Array(16); // 128-bit key for AES-128
            window.crypto.getRandomValues(keyArray);
            encryptionKey = Array.from(keyArray)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
              
            // Use the encryption helper function
            const encryptFile = async (file: File, key: string): Promise<Blob> => {
              return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (event) => {
                  try {
                    if (!event.target?.result) {
                      throw new Error('Failed to read file');
                    }
                    
                    // Convert hex key to ArrayBuffer
                    const keyBytes = new Uint8Array(key.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
                    
                    // Import the key for use with AES-CBC
                    const cryptoKey = await window.crypto.subtle.importKey(
                      'raw',
                      keyBytes,
                      { name: 'AES-CBC' },
                      false,
                      ['encrypt']
                    );
                    
                    // Generate an initialization vector
                    const iv = window.crypto.getRandomValues(new Uint8Array(16));
                    
                    // Encrypt the file data
                    const fileData = event.target.result as ArrayBuffer;
                    const encryptedData = await window.crypto.subtle.encrypt(
                      {
                        name: 'AES-CBC',
                        iv
                      },
                      cryptoKey,
                      fileData
                    );
                    
                    // Combine IV and encrypted data
                    const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
                    combinedData.set(iv, 0);
                    combinedData.set(new Uint8Array(encryptedData), iv.length);
                    
                    // Create a new Blob with the encrypted data
                    resolve(new Blob([combinedData], { type: file.type }));
                  } catch (error) {
                    reject(error);
                  }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
              });
            };
              
            // Encrypt the file
            updateUploadProgress(upload.id, 15);
            const encryptedBlob = await encryptFile(upload.file!, encryptionKey);
            processedFile = new File([encryptedBlob], upload.file!.name, { type: upload.file!.type });
            
            // Add encryption key to metadata (immutably)
            metadataObj = {
              ...metadataObj,
              isEncrypted: 'true',
              encryptionKey: encryptionKey
            };
            
          } catch (encryptError) {
            console.error('Encryption failed:', encryptError);
            // Continue with the unencrypted file
            processedFile = upload.file!;
            encryptionKey = null;
            
            // Remove encryption flag from metadata
            const newMetadata: Record<string, string> = {};
            Object.keys(metadataObj).forEach(key => {
              if (key !== 'isEncrypted') {
                newMetadata[key] = metadataObj[key];
              }
            });
            metadataObj = newMetadata;
          }
        }
        
        // Start the upload with the processed file
        const result = await uploadFile({
          file: processedFile,
          category: upload.category || `courses/videos/${upload.sectionId}`,
          metadata: metadataObj,
          onProgress: (progress) => {
            // Update both stores with the progress
            updateUploadProgress(upload.id, progress);
            
            // Also update the course store for UI notifications
            try {
              const { updateUploadProgress: updateCourseStoreProgress } = useCourseStore.getState();
              if (updateCourseStoreProgress) {
                updateCourseStoreProgress(upload.id, Math.round(progress));
              }
            } catch (err) {
              console.warn("Error updating course store progress:", err);
            }
          },
        });
        
        if (!result.success) {
          console.error('Upload failed with error:', result.error);
          
          // Handle common error cases
          if (result.error?.includes('AccessDenied') || result.error?.includes('Access Denied')) {
            throw new Error('Upload failed: Access denied to storage. Your account may not have permission to upload to this location or the storage credentials may have expired.');
          } else if (result.error?.includes('Forbidden')) {
            throw new Error('Upload failed: Permission denied. The storage system may be misconfigured or your credentials may not have write access.');
          } else {
            throw new Error(result.error || 'Upload failed');
          }
        }
        
        // Register the video in the database
        updateUploadProgress(upload.id, 90);
        
        // Wait a moment to ensure upload is fully processed on Wasabi's side
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const completeResponse = await fetch('/api/creator/lectures/wasabi-complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sectionId: upload.sectionId,
            title: upload.title,
            description: upload.description || '',
            isPreview: upload.isPreview,
            fileKey: result.key,
            fileUrl: result.url,
            fileName: upload.file!.name,
            fileSize: upload.file!.size,
            fileType: upload.file!.type,
            isEncrypted: !!encryptionKey,
            encryptionKey: encryptionKey,
            uploadJobId: upload.id,
            securityToken: result.securityToken // Pass the security token for verification
          }),
        });
        
        if (!completeResponse.ok) {
          const errorData = await completeResponse.json();
          throw new Error(errorData.message || 'Failed to register video in database');
        }
        
        const completeData = await completeResponse.json();
        
        // Update upload as completed
        updateUploadProgress(upload.id, 100);
        updateUploadStatus(upload.id, 'completed');
        
        if (completeData.lecture) {
          updateUploadMetadata(upload.id, {
            lectureId: completeData.lecture.id,
            key: result.key,
            url: result.url,
          });
        }
        
        // Show success toast
        toast({
          title: 'Upload Complete',
          description: `${upload.title} has been uploaded successfully`,
        });
        
        // Clear the upload from the UI immediately
        const courseId = completeData.lecture?.courseId;
        
        // Clean up both stores' upload entries
        removeUpload(upload.id);
        try {
          const { removeUpload: removeCourseStoreUpload } = useCourseStore.getState();
          if (removeCourseStoreUpload) {
            removeCourseStoreUpload(upload.id);
          }
        } catch (err) {
          console.warn("Error removing upload from course store:", err);
        }
        
        // Redirect to the course page if we have a course ID
        if (courseId) {
          console.log(`Redirecting to course page: /content/${courseId}`);
          // Use a short timeout to ensure the UI updates before navigation
          setTimeout(() => {
            router.push(`/content/${courseId}`);
          }, 500);
        }
        
      } catch (error) {
        console.error('Upload error:', error);
        
        // Update upload as failed
        updateUploadStatus(
          upload.id, 
          'failed', 
          error instanceof Error ? error.message : 'Upload failed'
        );
        
        // Show error toast
        toast({
          title: 'Upload Failed',
          description: error instanceof Error ? error.message : 'An unknown error occurred',
          variant: 'destructive',
        });
      } finally {
        // Reset processing flag
        processingRef.current = false;
        activeUploadRef.current = null;
      }
    };
    
    // Process the queue
    processQueue();
    
    // Cleanup function
    return () => {
      // If we're unmounting and there's an active upload, we don't need to do anything
      // because the upload is handled by the persistent state in the store
    };
  }, [
    activeUploadId, 
    uploads, 
    uploadFile, 
    updateUploadProgress, 
    updateUploadStatus,
    updateUploadMetadata
  ]);
  
  // Return null as this is a background service with no UI
  return null;
}

// Helper component to ensure background uploads continue
export function BackgroundUploadProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackgroundUploadService />
      {children}
    </>
  );
}
