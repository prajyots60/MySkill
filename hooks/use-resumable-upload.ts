'use client';

import { useState, useCallback } from 'react';

interface ChunkMetadata {
  chunkIndex: number;
  partNumber: number;
  start: number;
  end: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  attempts: number;
  etag?: string;
}

interface ResumeData {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadId: string;
  key: string;
  chunks: ChunkMetadata[];
  totalChunks: number;
  completedChunks: number;
  lastUpdated: number;
}

export function useResumableUpload() {
  const [resumableUploads, setResumableUploads] = useState<
    Map<string, ResumeData>
  >(new Map());

  /**
   * Resume an existing upload
   */
  const resumeUpload = useCallback(async (uploadId: string) => {
    console.log(`Attempting to resume upload with ID: ${uploadId}`);
    
    // First check in-memory state
    if (resumableUploads.has(uploadId)) {
      console.log(`Found upload in memory state: ${uploadId}`);
      const resumeData = resumableUploads.get(uploadId)!;
      
      // Quick validation of the resume data
      if (!resumeData || !resumeData.chunks || !resumeData.uploadId) {
        console.warn(`Found corrupt upload data for ID ${uploadId}. Will try localStorage backup.`, resumeData);
      } else {
        return {
          resumeData,
          isNew: false,
        };
      }
    } else {
      console.log(`Upload not found in memory state: ${uploadId}, checking localStorage...`);
    }

    // Try to load from localStorage
    try {
      const savedData = localStorage.getItem(`resumableUpload:${uploadId}`);
      if (savedData) {
        console.log(`Found upload in localStorage: ${uploadId}`);
        const resumeData = JSON.parse(savedData) as ResumeData;
        
        // Validate the loaded data
        if (!resumeData || !resumeData.chunks || !resumeData.uploadId) {
          throw new Error(`Invalid upload data format in localStorage for ${uploadId}`);
        }
        
        // Update state
        setResumableUploads((prev) => {
          const updated = new Map(prev);
          updated.set(uploadId, resumeData);
          return updated;
        });
        
        return {
          resumeData,
          isNew: false,
        };
      } else {
        console.warn(`No saved data in localStorage for ${uploadId}`);
        
        // Debug: List all localStorage keys with resumableUpload prefix
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('resumableUpload:')) {
            keys.push(key);
          }
        }
        console.log(`Available resumable upload keys:`, keys);
      }
    } catch (err) {
      console.warn(`Failed to load upload state from localStorage for ${uploadId}:`, err);
    }

    throw new Error(`No resumable upload found with ID: ${uploadId}`);
  }, [resumableUploads]);

  /**
   * Initialize a new resumable upload or resume an existing one
   */
  const initializeResumableUpload = useCallback(
    async (
      file: File,
      category: string,
      metadata: Record<string, string>,
      chunkSize: number = 5 * 1024 * 1024, // Default 5MB chunk size
      uploadId?: string
    ) => {
      try {
        // Check if we have an existing upload to resume - try in-memory state first
        if (uploadId) {
          // Check in-memory state
          if (resumableUploads.has(uploadId)) {
            console.log(`Found existing upload in memory state for ID: ${uploadId}`);
            return await resumeUpload(uploadId);
          }
          
          // Try loading from localStorage as backup
          try {
            const savedData = localStorage.getItem(`resumableUpload:${uploadId}`);
            if (savedData) {
              console.log(`Found existing upload in localStorage for ID: ${uploadId}`);
              const loadedData = JSON.parse(savedData) as ResumeData;
              
              // Add to in-memory state
              setResumableUploads(prev => {
                const updated = new Map(prev);
                updated.set(uploadId, loadedData);
                return updated;
              });
              
              return await resumeUpload(uploadId);
            }
          } catch (err) {
            console.warn(`Failed to check localStorage for upload ${uploadId}:`, err);
          }
        }

        // Generate a new uploadId if not provided
        const newUploadId = uploadId || `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        console.log(`Initializing new upload with ID: ${newUploadId}`);

        // Generate file key
        const timestamp = Date.now();
        const uniqueId = Math.random().toString(36).substring(2, 10);
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileKey = `${category}/${timestamp}-${uniqueId}-${safeFileName}`;

        // Initialize multipart upload on the server
        const initResponse = await fetch('/api/wasabi-multipart-init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: fileKey,
            contentType: file.type,
            metadata: Object.fromEntries(
              Object.entries(metadata).map(([k, v]) => [k, String(v)])
            ),
          }),
        });

        if (!initResponse.ok) {
          const errorData = await initResponse.json();
          throw new Error(errorData.message || 'Failed to initialize multipart upload');
        }

        const { uploadId: multipartUploadId, key } = await initResponse.json();

        // Calculate total chunks
        const totalChunks = Math.ceil(file.size / chunkSize);

        // Create chunk metadata
        const chunks: ChunkMetadata[] = [];
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          chunks.push({
            chunkIndex,
            partNumber: chunkIndex + 1,
            start,
            end,
            status: 'pending',
            attempts: 0,
          });
        }

        // Save upload state
        const resumeData: ResumeData = {
          fileId: newUploadId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadId: multipartUploadId,
          key,
          chunks,
          totalChunks,
          completedChunks: 0,
          lastUpdated: Date.now(),
        };

        // Save to localStorage for persistence across page reloads
        try {
          localStorage.setItem(
            `resumableUpload:${newUploadId}`,
            JSON.stringify(resumeData)
          );
        } catch (err) {
          console.warn('Failed to save upload state to localStorage:', err);
        }

        // Update state
        setResumableUploads((prev) => {
          const updated = new Map(prev);
          updated.set(newUploadId, resumeData);
          return updated;
        });

        return {
          resumeData,
          isNew: true,
        };
      } catch (error) {
        console.error('Failed to initialize resumable upload:', error);
        throw error;
      }
    },
    [resumableUploads, setResumableUploads]
  );

  /**
   * Update chunk status and persist changes
   */
  const updateChunkStatus = useCallback(
    (
      uploadId: string,
      chunkIndex: number,
      status: ChunkMetadata['status'],
      etag?: string
    ) => {
      setResumableUploads((prev) => {
        const upload = prev.get(uploadId);
        if (!upload) return prev;

        const updated = new Map(prev);
        const updatedUpload = { ...upload };
        
        // Update the specific chunk
        updatedUpload.chunks = [...upload.chunks];
        updatedUpload.chunks[chunkIndex] = {
          ...updatedUpload.chunks[chunkIndex],
          status,
          attempts: updatedUpload.chunks[chunkIndex].attempts + (status === 'failed' ? 1 : 0),
          ...(etag && { etag }),
        };
        
        // Update completed count
        updatedUpload.completedChunks = updatedUpload.chunks.filter(
          chunk => chunk.status === 'completed'
        ).length;
        
        updatedUpload.lastUpdated = Date.now();
        updated.set(uploadId, updatedUpload);

        // Save to localStorage
        try {
          localStorage.setItem(
            `resumableUpload:${uploadId}`,
            JSON.stringify(updatedUpload)
          );
        } catch (err) {
          console.warn('Failed to save upload state to localStorage:', err);
        }

        return updated;
      });
    },
    []
  );

  /**
   * Complete a multipart upload once all chunks are uploaded
   */
  const completeResumableUpload = useCallback(
    async (uploadId: string) => {
      console.log(`Attempting to complete upload with ID: ${uploadId}`);
      
      // Check in-memory state first
      let upload = resumableUploads.get(uploadId);
      
      // If not found, try to load from localStorage as a backup
      if (!upload) {
        try {
          console.log(`Upload not found in memory state, checking localStorage for ${uploadId}`);
          const savedData = localStorage.getItem(`resumableUpload:${uploadId}`);
          if (savedData) {
            upload = JSON.parse(savedData) as ResumeData;
            console.log(`Retrieved upload from localStorage: ${uploadId}`, upload);
            // Sync with in-memory state
            setResumableUploads((prev) => {
              const updated = new Map(prev);
              updated.set(uploadId, upload!);
              return updated;
            });
          } else {
            console.warn(`No saved data in localStorage for upload: ${uploadId}`);
            
            // Try to find any upload that might match based on available data in memory or localStorage
            console.log(`Attempting to find alternative upload sources for ID: ${uploadId}`);
            
            // List all localStorage keys related to resumable uploads
            const uploadKeys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('resumableUpload:')) {
                uploadKeys.push(key);
              }
            }
            
            // Log available keys for debugging
            console.log(`Available localStorage keys:`, uploadKeys);
            
            // If we have any uploads in memory or localStorage, try to use the most recent one as a fallback
            if (uploadKeys.length > 0) {
              try {
                // Sort by recency and try to load the most recent one
                const mostRecentKey = uploadKeys[0]; // Assume the first one for now
                const mostRecentData = localStorage.getItem(mostRecentKey);
                
                if (mostRecentData) {
                  const parsedData = JSON.parse(mostRecentData) as ResumeData;
                  console.warn(`Using alternative upload as fallback: ${parsedData.fileId}`);
                  upload = parsedData;
                  
                  // Sync with in-memory state
                  setResumableUploads((prev) => {
                    const updated = new Map(prev);
                    updated.set(parsedData.fileId, upload!);
                    return updated;
                  });
                }
              } catch (fallbackErr) {
                console.error("Fallback retrieval failed:", fallbackErr);
              }
            }
          }
        } catch (err) {
          console.warn(`Failed to retrieve upload ${uploadId} from localStorage:`, err);
        }
      }
      
      if (!upload) {
        console.error(`No upload found with ID: ${uploadId}. This is likely due to a state management issue.`);
        // Throw a more detailed error message that includes debugging information
        throw new Error(`Upload not found: ${uploadId}. Check console for more details.`);
      }

      // Verify all chunks are completed
      const allCompleted = upload.chunks.every(chunk => chunk.status === 'completed');
      if (!allCompleted) {
        const pendingChunks = upload.chunks.filter(chunk => chunk.status !== 'completed').length;
        console.warn(`Cannot complete upload: ${pendingChunks} chunks still pending for upload ${uploadId}`);
        
        // Check if this is a resumed upload that was fully uploaded previously but status was not synced
        // This can happen if the upload state in localStorage becomes stale
        const allPending = upload.chunks.every(chunk => chunk.status === 'pending' || chunk.status === 'failed');
        
        // If all chunks are pending (typically happens when resuming a upload with corrupted state)
        // AND user confirms we can attempt to recover the upload
        if (allPending && window.confirm(`Upload ${uploadId} appears to be stalled with ${pendingChunks} pending chunks. Attempt recovery?`)) {
          console.log(`Attempting recovery for upload ${uploadId} with ${pendingChunks} pending chunks`);
          
          // Attempt to recover by forcing completion - this is a fallback mechanism for uploads
          // that may actually be complete on the server side but have stale state locally
          return await recoverAndCompleteUpload(upload);
        }
        
        throw new Error(`Cannot complete upload: ${pendingChunks} chunks are not yet uploaded (ID: ${uploadId})`);
      }

      // Get all parts in the correct order
      const parts = upload.chunks
        .filter(chunk => chunk.etag)
        .map(chunk => ({
          PartNumber: chunk.partNumber,
          ETag: chunk.etag!,
        }));

      // Call the API to complete the multipart upload
      const completeResponse = await fetch('/api/wasabi-multipart-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: upload.key,
          uploadId: upload.uploadId,
          parts,
        }),
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.message || 'Failed to complete multipart upload');
      }

      const { location, etag } = await completeResponse.json();

      // Construct the object URL
      const { NEXT_PUBLIC_WASABI_REGION, NEXT_PUBLIC_WASABI_BUCKET } =
        process.env;
      const objectUrl =
        location ||
        `https://${NEXT_PUBLIC_WASABI_BUCKET}.s3.${NEXT_PUBLIC_WASABI_REGION}.wasabisys.com/${encodeURIComponent(
          upload.key
        )}`;

      // Clean up
      try {
        localStorage.removeItem(`resumableUpload:${uploadId}`);
      } catch (err) {
        console.warn('Failed to remove upload state from localStorage:', err);
      }

      setResumableUploads((prev) => {
        const updated = new Map(prev);
        updated.delete(uploadId);
        return updated;
      });

      return {
        success: true,
        key: upload.key,
        url: objectUrl,
        etag,
      };
    },
    [resumableUploads, setResumableUploads]
  );

  /**
   * Attempt to recover and complete an upload that has stalled
   * This function attempts to force complete an upload with stalled chunks
   * by fetching chunk ETags directly from the server if possible
   */
  const recoverAndCompleteUpload = async (upload: ResumeData) => {
    console.log(`Attempting to recover upload ${upload.fileId} with all pending chunks`);
    
    try {
      // Step 1: Attempt to list parts from the server to see if they're already uploaded
      const listResponse = await fetch(`/api/wasabi-multipart-list-parts?key=${encodeURIComponent(upload.key)}&uploadId=${encodeURIComponent(upload.uploadId)}`, {
        method: 'GET',
      });
      
      if (!listResponse.ok) {
        // If we can't list parts, we need to throw and fail
        const errorData = await listResponse.json();
        throw new Error(errorData.message || 'Failed to list multipart upload parts for recovery');
      }
      
      const { parts } = await listResponse.json();
      
      // If we have no parts on the server, recovery isn't possible
      if (!parts || parts.length === 0) {
        throw new Error(`Cannot recover: No parts found on server for upload ${upload.fileId}`);
      }
      
      console.log(`Found ${parts.length} parts on server for recovery of upload ${upload.fileId}`);
      
      // If the number of parts doesn't match the number of chunks, 
      // we need to handle this carefully - the upload might have been restructured
      if (parts.length !== upload.chunks.length) {
        console.warn(`Part/chunk count mismatch: ${parts.length} parts vs ${upload.chunks.length} chunks. Attempting to adjust.`);
        
        // We'll use the parts from the server directly instead of trying to match them with local chunks
        const adjustedChunks: ChunkMetadata[] = parts.map((part, idx) => ({
          chunkIndex: idx,
          partNumber: part.PartNumber || idx + 1,
          start: 0, // We don't know the exact byte ranges anymore
          end: 0,   // But that's okay for recovery
          status: 'completed' as ChunkMetadata['status'],
          attempts: 0,
          etag: part.ETag.replace(/"/g, '')
        }));
        
        // Replace chunks with adjusted ones
        upload.chunks = adjustedChunks;
        upload.totalChunks = adjustedChunks.length;
      }
      
      // Update the chunks with the ETags from the server
      const updatedChunks = upload.chunks.map((chunk, index) => ({
        ...chunk,
        status: 'completed' as ChunkMetadata['status'],
        etag: parts[index].ETag.replace(/"/g, '')
      }));
      
      // Create updated upload data
      const recoveredUpload: ResumeData = {
        ...upload,
        chunks: updatedChunks,
        completedChunks: updatedChunks.length,
        lastUpdated: Date.now()
      };
      
      // Call the API to complete the multipart upload with the recovered parts
      const parts4Complete = recoveredUpload.chunks.map(chunk => ({
        PartNumber: chunk.partNumber,
        ETag: chunk.etag!,
      }));
      
      // Complete the upload with the recovered parts
      const completeResponse = await fetch('/api/wasabi-multipart-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: upload.key,
          uploadId: upload.uploadId,
          parts: parts4Complete,
        }),
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.message || 'Failed to complete recovered multipart upload');
      }

      const { location, etag } = await completeResponse.json();

      // Construct the object URL
      const { NEXT_PUBLIC_WASABI_REGION, NEXT_PUBLIC_WASABI_BUCKET } = process.env;
      const objectUrl =
        location ||
        `https://${NEXT_PUBLIC_WASABI_BUCKET}.s3.${NEXT_PUBLIC_WASABI_REGION}.wasabisys.com/${encodeURIComponent(
          upload.key
        )}`;

      // Clean up
      try {
        localStorage.removeItem(`resumableUpload:${upload.fileId}`);
      } catch (err) {
        console.warn('Failed to remove recovered upload state from localStorage:', err);
      }

      setResumableUploads((prev) => {
        const updated = new Map(prev);
        updated.delete(upload.fileId);
        return updated;
      });

      return {
        success: true,
        key: upload.key,
        url: objectUrl,
        etag,
        wasRecovered: true
      };
    } catch (error) {
      console.error('Recovery attempt failed:', error);
      throw new Error(`Upload recovery failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  };

  /**
   * Get active uploads
   */
  const getActiveUploads = useCallback(() => {
    return Array.from(resumableUploads.values());
  }, [resumableUploads]);

  /**
   * Clear all stored uploads
   */
  const clearAllUploads = useCallback(() => {
    // Clear from localStorage
    resumableUploads.forEach((_, uploadId) => {
      try {
        localStorage.removeItem(`resumableUpload:${uploadId}`);
      } catch (err) {
        console.warn(`Failed to remove upload ${uploadId} from localStorage:`, err);
      }
    });

    // Clear from state
    setResumableUploads(new Map());
  }, [resumableUploads]);

  /**
   * Load all stored uploads from localStorage on initial mount
   */
  // Use useCallback with an empty dependency array to ensure this function never changes
// Added a flag to prevent multiple calls from causing state update loops
let uploadsLoaded = false;

const loadStoredUploads = useCallback(() => {
    // Skip if we've already loaded uploads to prevent unnecessary state updates
    if (uploadsLoaded) {
      return resumableUploads;
    }
    
    try {
      const uploads = new Map<string, ResumeData>();
      
      // Find all resumable uploads in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('resumableUpload:')) {
          const uploadId = key.replace('resumableUpload:', '');
          const data = localStorage.getItem(key);
          if (data) {
            try {
              const resumeData = JSON.parse(data) as ResumeData;
              uploads.set(uploadId, resumeData);
            } catch (err) {
              console.warn(`Failed to parse upload data for ${uploadId}:`, err);
            }
          }
        }
      }
      
      // Only update state if we found any uploads
      if (uploads.size > 0) {
        setResumableUploads(uploads);
      }
      
      // Mark as loaded so we don't reload unnecessarily
      uploadsLoaded = true;
      return uploads;
    } catch (err) {
      console.warn('Failed to load stored uploads:', err);
      return resumableUploads;
    }
  }, []);

  return {
    initializeResumableUpload,
    resumeUpload,
    updateChunkStatus,
    completeResumableUpload,
    recoverAndCompleteUpload,
    getActiveUploads,
    clearAllUploads,
    loadStoredUploads,
  };
}
