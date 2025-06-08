'use client';

import { useState, useCallback, useEffect } from 'react';
import { useResumableUpload } from '@/hooks/use-resumable-upload';
import { useEnhancedEncryption } from '@/hooks/use-enhanced-encryption';
import { useNetworkAwareUpload } from '@/hooks/use-network-aware-upload';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { FileVideo, Upload, Lock, Shield, Loader2, Wifi, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import { useUploadStore } from '@/lib/store/upload-store';
import { useCourseStore } from '@/lib/store/course-store';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cva } from 'class-variance-authority';

// Size threshold for special handling of large files (100MB)
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;

interface NextGenUploadProps {
  sectionId: string;
  title: string;
  description?: string;
  isPreview?: boolean;
  file: File;
  onUploadComplete?: (lectureId: string, fileKey: string) => void;
  onUploadError?: (error: Error) => void;
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  enableEncryption?: boolean;
  onCacheInvalidateNeeded?: (courseId: string) => Promise<void>;
}

// Status badge styling
const statusBadgeStyles = cva('text-xs flex items-center gap-1', {
  variants: {
    status: {
      excellent: 'bg-green-500/10 text-green-600 border-green-600/20',
      good: 'bg-blue-500/10 text-blue-600 border-blue-600/20',
      fair: 'bg-amber-500/10 text-amber-600 border-amber-600/20',
      poor: 'bg-red-500/10 text-red-600 border-red-600/20',
      offline: 'bg-slate-500/10 text-slate-600 border-slate-600/20',
    }
  },
  defaultVariants: {
    status: 'good'
  }
});

export function NextGenWasabiUploader({
  sectionId,
  title,
  description = '',
  isPreview = false,
  file,
  onUploadComplete,
  onUploadError,
  onUploadStart,
  onUploadProgress,
  enableEncryption = false,
  onCacheInvalidateNeeded
}: NextGenUploadProps) {
  const [useEncryption, setUseEncryption] = useState(enableEncryption);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'preparing' | 'encrypting' | 'uploading' | 'processing' | 'finalizing' | 'verifying'>('preparing');
  const [resumeInfo, setResumeInfo] = useState<{ uploadId?: string, hasExistingUpload: boolean }>({ hasExistingUpload: false });
  
  // Initialize our custom hooks
  const { 
    initializeResumableUpload, 
    updateChunkStatus, 
    completeResumableUpload,
    loadStoredUploads,
    getActiveUploads
  } = useResumableUpload();
  
  const { 
    encryptFile, 
    generateKey, 
    isProcessing: isEncrypting 
  } = useEnhancedEncryption();
  
  const { 
    networkStatus, 
    networkSpeed, 
    adaptiveConfig,
    runNetworkSpeedTest,
    getRetryDelay 
  } = useNetworkAwareUpload();
  
  const { addUpload } = useUploadStore();
  const { 
    addUpload: addToCourseStore, 
    updateUploadProgress: updateCourseStoreProgress,
    updateUploadStatus 
  } = useCourseStore();
  
  // Check for any existing uploads for the same file on mount
  useEffect(() => {
    loadStoredUploads();

    // Check if we have an existing upload for this file based on name and size
    const checkExistingUploads = () => {
      const activeUploads = getActiveUploads();
      const matchingUpload = activeUploads.find(upload => 
        upload.fileName === file.name && 
        upload.fileSize === file.size
      );

      if (matchingUpload) {
        setResumeInfo({
          uploadId: matchingUpload.fileId,
          hasExistingUpload: true
        });
      }
    };

    checkExistingUploads();
  }, [file.name, file.size, loadStoredUploads, getActiveUploads]);
  
  // Format bytes to human-readable size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get connection status badge
  const getConnectionStatus = () => {
    if (!networkStatus.online) return { label: 'Offline', status: 'offline' as const };
    
    if (networkSpeed) {
      const { downloadSpeed } = networkSpeed;
      if (downloadSpeed >= 10) return { label: 'Excellent', status: 'excellent' as const };
      if (downloadSpeed >= 5) return { label: 'Good', status: 'good' as const };
      if (downloadSpeed >= 1) return { label: 'Fair', status: 'fair' as const };
      return { label: 'Poor', status: 'poor' as const };
    }
    
    // Fallback based on Network Information API
    const effectiveType = networkStatus.effectiveType;
    if (effectiveType === '4g') return { label: 'Good', status: 'good' as const };
    if (effectiveType === '3g') return { label: 'Fair', status: 'fair' as const };
    if (effectiveType === '2g' || effectiveType === 'slow-2g') return { label: 'Poor', status: 'poor' as const };
    
    return { label: 'Unknown', status: 'fair' as const };
  };

  // Handle upload with optimizations
  const handleUpload = useCallback(async (resumeUploadId?: string) => {
    if (!sectionId || !title.trim() || !file) {
      toast({
        title: "Missing Information",
        description: "Please provide all required information before uploading",
        variant: "destructive",
      });
      return;
    }
    
    // Generate a unique ID for tracking this upload - define outside try block to be accessible in catch/finally
    const uploadId = resumeUploadId || uuidv4();
    
    try {
      
      // Add to both upload systems for tracking
      addUpload({
        id: uploadId,
        file,
        title,
        description,
        sectionId,
        isPreview,
        status: "uploading",
        progress: 0,
        videoSource: "wasabi",
        isRestartable: true,
        category: `courses/videos/${sectionId}`,
        metadata: {
          title,
          sectionId,
          isPreview: isPreview.toString(),
          contentType: 'video',
          videoSource: 'WASABI',
          ...(description ? { description } : {}),
          ...(useEncryption ? { isEncrypted: 'true' } : {})
        }
      });
      
      addToCourseStore({
        id: uploadId,
        type: "lecture",
        title,
      });
      
      // Set uploading state
      setIsUploading(true);
      setUploadProgress(0);
      updateCourseStoreProgress(uploadId, 0);
      updateUploadStatus(uploadId, 'uploading');
      if (onUploadStart) {
        onUploadStart();
      }
      
      let encryptionKey: string | null = null;
      let encryptionIV: string | null = null; // Add IV variable to store the encryption IV
      let processedFile = file;
      
      // Step 1: Encrypt file if enabled
      if (useEncryption) {
        try {
          setUploadPhase('encrypting');
          setUploadProgress(5);
          updateCourseStoreProgress(uploadId, 5);
          if (onUploadProgress) onUploadProgress(5);
          
          // Generate secure encryption key with enhanced encryption
          const keyData = await generateKey();
          encryptionKey = keyData.key;
          
          setUploadProgress(10);
          updateCourseStoreProgress(uploadId, 10);
          if (onUploadProgress) onUploadProgress(10);
          
          // Encrypt the file using our enhanced encryption
          const encryptionResult = await encryptFile(file, (progress) => {
            // Map progress to 10-30% range
            const scaledProgress = Math.floor(10 + (progress.percentComplete * 0.2));
            setUploadProgress(scaledProgress);
            updateCourseStoreProgress(uploadId, scaledProgress);
            if (onUploadProgress) onUploadProgress(scaledProgress);
          });
          
          if (!encryptionResult.success || !encryptionResult.data) {
            throw new Error(encryptionResult.error || "Encryption failed");
          }
          
          // Store the encryption IV from metadata
          if (encryptionResult.metadata?.iv) {
            encryptionIV = encryptionResult.metadata.iv;
            console.log('Encryption IV captured:', encryptionIV.substring(0, 8) + '...');
          } else {
            console.warn('No IV found in encryption result!');
          }
          
          processedFile = new File(
            [encryptionResult.data], 
            `${file.name}.encrypted`,
            { type: 'application/octet-stream' }
          );
          
          setUploadProgress(30);
          updateCourseStoreProgress(uploadId, 30);
          if (onUploadProgress) onUploadProgress(30);
          
        } catch (encryptError) {
          console.error('Encryption failed:', encryptError);
          
          toast({
            title: "Encryption Failed",
            description: "Could not encrypt video. Uploading without encryption for now.",
            variant: "destructive",
          });
          
          // Fall back to non-encrypted upload
          encryptionKey = null;
          encryptionIV = null;
          processedFile = file;
        }
      }
      
      // Step 2: Initialize or resume upload
      setUploadPhase('uploading');
      
      // Prepare metadata
      const metadata: Record<string, string> = {
        title,
        sectionId,
        isPreview: isPreview.toString(),
        contentType: 'video',
        videoSource: 'WASABI',
      };
      
      if (description) metadata.description = description;
      if (encryptionKey) {
        metadata.isEncrypted = 'true';
        metadata.encryptionAlgorithm = 'aes-gcm';
        
        // Include IV in metadata if we have it
        if (encryptionIV) {
          metadata.encryptionIV = encryptionIV;
          metadata.encryptionIVLength = '12'; // Standard for AES-GCM
        } else {
          console.warn('Warning: Encryption IV missing, decryption may fail');
        }
      }
      
      // Use resumable upload with the file
      const category = `courses/videos/${sectionId}`;
      
      // Get network-optimized chunk size from our network-aware hook
      const { chunkSize, maxConcurrentChunks } = adaptiveConfig;
      
      // Initialize or resume the upload
      const { resumeData, isNew } = await initializeResumableUpload(
        processedFile,
        category,
        metadata,
        chunkSize,
        resumeUploadId
      );
      
      // Set the upload ID for future resume capability
      setResumeInfo({
        uploadId: resumeData.fileId,
        hasExistingUpload: true
      });
      
      // Upload all chunks in parallel with controlled concurrency
      const totalChunks = resumeData.totalChunks;
      let completedChunks = resumeData.completedChunks;
      let pendingChunks = resumeData.chunks
        .filter(chunk => chunk.status !== 'completed')
        .sort((a, b) => a.chunkIndex - b.chunkIndex);
      
      // Process chunks with limited concurrency based on network conditions
      let activeUploads = 0;
      let failedChunks: number[] = [];
      
      // Function to upload a single chunk
      const uploadChunk = async (chunk: typeof pendingChunks[0]) => {
        const { chunkIndex, partNumber, start, end } = chunk;
        
        // Mark chunk as uploading
        updateChunkStatus(resumeData.fileId, chunkIndex, 'uploading');
        
        try {
          // Get the chunk data
          const chunkBlob = processedFile.slice(start, end);
          
          // Get presigned URL for this part
          const urlResponse = await fetch(`/api/wasabi-multipart-url?key=${encodeURIComponent(resumeData.key)}&uploadId=${encodeURIComponent(resumeData.uploadId)}&partNumber=${partNumber}`, {
            method: 'GET',
          });

          if (!urlResponse.ok) {
            throw new Error(`Failed to get URL for part ${partNumber}`);
          }

          const { url } = await urlResponse.json();

          // Upload the chunk with retry logic
          let attempts = 0;
          let success = false;
          let eTag: string | null = null;

          while (!success && attempts < adaptiveConfig.retryLimit) {
            try {
              const uploadResponse = await fetch(url, {
                method: 'PUT',
                body: chunkBlob,
              });

              if (!uploadResponse.ok) {
                throw new Error(`Failed to upload part ${partNumber}`);
              }

              // Get the ETag from response headers
              eTag = uploadResponse.headers.get('ETag');
              if (!eTag) {
                throw new Error(`No ETag received for part ${partNumber}`);
              }

              // Success - remove quotes from ETag if present
              eTag = eTag.replace(/"/g, '');
              success = true;
            } catch (error) {
              attempts++;
              if (attempts < adaptiveConfig.retryLimit) {
                // Wait with exponential backoff before retrying
                const delay = getRetryDelay(attempts);
                await new Promise(resolve => setTimeout(resolve, delay));
              } else {
                // Max retries reached, propagate the error
                throw error;
              }
            }
          }

          // Mark chunk as completed with its ETag
          if (success && eTag) {
            updateChunkStatus(resumeData.fileId, chunkIndex, 'completed', eTag);
            completedChunks++;
            
            // Update overall progress (30-90% range)
            const overallProgress = Math.floor(30 + ((completedChunks / totalChunks) * 60));
            setUploadProgress(overallProgress);
            updateCourseStoreProgress(uploadId, overallProgress);
            if (onUploadProgress) onUploadProgress(overallProgress);
          }
        } catch (error) {
          console.error(`Error uploading chunk ${chunkIndex}:`, error);
          updateChunkStatus(resumeData.fileId, chunkIndex, 'failed');
          failedChunks.push(chunkIndex);
        } finally {
          activeUploads--;
        }
      };
      
      // Process chunks with network-aware concurrency control
      const processNextChunks = async () => {
        while (activeUploads < maxConcurrentChunks && pendingChunks.length > 0) {
          const nextChunk = pendingChunks.shift();
          if (nextChunk) {
            activeUploads++;
            // Start upload without awaiting to allow concurrency
            uploadChunk(nextChunk);
          }
        }
      };
      
      // Initial batch of uploads
      await processNextChunks();
      
      // Keep checking until all chunks are done or failed
      while (activeUploads > 0 || pendingChunks.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (activeUploads < maxConcurrentChunks && pendingChunks.length > 0) {
          await processNextChunks();
        }
      }
      
      // Check if we have failed chunks we need to retry
      if (failedChunks.length > 0) {
        throw new Error(`${failedChunks.length} chunks failed to upload after multiple retries`);
      }

      // Step 3: Verify and complete the upload
      setUploadPhase('verifying');
      setUploadProgress(90);
      updateCourseStoreProgress(uploadId, 90);
      if (onUploadProgress) onUploadProgress(90);
      
      // Complete the multipart upload
      const result = await completeResumableUpload(resumeData.fileId);
      
      if (!result.success) {
        throw new Error("Failed to complete multipart upload");
      }
      
      // Step 4: Register the file in our backend
      setUploadPhase('finalizing');
      setUploadProgress(95);
      updateCourseStoreProgress(uploadId, 95);
      if (onUploadProgress) onUploadProgress(95);
      
      // Use a timeout to ensure the upload is fully processed on Wasabi's side
      // before we register it in our database
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const completeResponse = await fetch("/api/creator/lectures/wasabi-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sectionId,
          title,
          description,
          isPreview,
          fileKey: result.key,
          fileUrl: result.url,
          fileName: file.name,
          fileSize: processedFile.size,
          fileType: file.type,
          isEncrypted: !!encryptionKey,
          encryptionKey: encryptionKey,
          encryptionIV: encryptionIV,
          encryptionIVLength: encryptionIV ? 12 : undefined,
          encryptionAlgorithm: encryptionKey ? 'aes-gcm' : undefined,
          encryptionTimestamp: Date.now(),
          uploadJobId: uploadId
        })
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.message || "Failed to register video in database");
      }

      const completeData = await completeResponse.json();
      
      // Update upload status in stores
      setUploadProgress(100);
      updateCourseStoreProgress(uploadId, 100);
      updateUploadStatus(uploadId, 'completed');
      if (onUploadProgress) onUploadProgress(100);
      
      // Reset resume info since upload is complete
      setResumeInfo({ hasExistingUpload: false });
      
      toast({
        title: "Upload Complete",
        description: "Video has been uploaded and registered successfully"
      });

      // If we have a course ID, invalidate the cache
      if (completeData.lecture?.courseId && onCacheInvalidateNeeded) {
        try {
          console.log("Invalidating cache for course:", completeData.lecture.courseId);
          await onCacheInvalidateNeeded(completeData.lecture.courseId);
        } catch (error) {
          console.error("Error invalidating cache:", error);
          // Don't throw - we don't want to block the UI flow if cache invalidation fails
        }
      }
      
      if (onUploadComplete && completeData.lecture) {
        onUploadComplete(completeData.lecture.id, result.key);
      }
      
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload video";
      
      // Update status to failed
      updateUploadStatus(uploadId, 'failed', errorMessage);
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive"
      });

      if (onUploadError && error instanceof Error) {
        onUploadError(error);
      }
    } finally {
      setIsUploading(false);
      // We keep the progress at 100% if successful, or reset to 0 if failed
      if (uploadProgress < 100) {
        setUploadProgress(0);
        // Also reset the course store progress
        updateCourseStoreProgress(uploadId, 0);
      }
      setUploadPhase('preparing');
    }
  }, [
    file, 
    sectionId, 
    title, 
    description, 
    isPreview, 
    addUpload,
    addToCourseStore, 
    encryptFile,
    generateKey,
    onUploadComplete, 
    onUploadError, 
    onUploadStart, 
    onUploadProgress,
    useEncryption,
    initializeResumableUpload,
    updateChunkStatus,
    completeResumableUpload,
    adaptiveConfig,
    getRetryDelay
  ]);
  
  // Handle resuming an existing upload
  const handleResumeUpload = useCallback(() => {
    if (resumeInfo.uploadId) {
      handleUpload(resumeInfo.uploadId);
    }
  }, [resumeInfo.uploadId, handleUpload]);
  
  // Display appropriate messages based on file size and encryption status
  const getEncryptionMessage = () => {
    if (isEncrypting) {
      return "Encryption is processed in background threads for optimal performance";
    }
    
    if (file.size > LARGE_FILE_THRESHOLD) {
      return "For very large files, encryption may take some time but won't freeze your browser.";
    }
    
    return "Enhanced encryption uses AES-GCM for better security and performance";
  };
  
  // Connection status
  const connection = getConnectionStatus();

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        {!isUploading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileVideo className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)} • {file.type}
                  {file.size > LARGE_FILE_THRESHOLD && 
                    <span className="ml-2 text-amber-500">
                      (Large file - resumable upload will be used)
                    </span>
                  }
                </p>
              </div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Badge variant="outline" className={statusBadgeStyles({ status: connection.status })}>
                        <Wifi className="h-3 w-3" /> {connection.label} 
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <p>Network speed: {networkSpeed?.downloadSpeed.toFixed(1) || 'Unknown'} Mbps</p>
                      <p>Chunk size: {formatFileSize(adaptiveConfig.chunkSize)}</p>
                      <p>Concurrent uploads: {adaptiveConfig.maxConcurrentChunks}</p>
                      <p className="italic">Click to test network speed</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="useEncryption"
                checked={useEncryption}
                onCheckedChange={setUseEncryption}
              />
              <Label htmlFor="useEncryption" className="flex items-center cursor-pointer">
                <Lock className="w-4 h-4 mr-2" /> 
                <span>Enhanced encryption (AES-GCM)</span>
              </Label>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {getEncryptionMessage()}
            </p>
            
            <div className="flex flex-col space-y-2">
              {resumeInfo.hasExistingUpload ? (
                <Button 
                  onClick={handleResumeUpload}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resume Existing Upload
                </Button>
              ) : null}
              
              <Button 
                onClick={() => handleUpload()}
                className="w-full"
                disabled={isUploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                Start Optimized Upload
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="mx-auto"
                onClick={() => runNetworkSpeedTest()}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Test Network Speed
              </Button>
              
              <p className="text-xs text-center text-green-600 flex items-center justify-center">
                <Shield className="w-3 h-3 mr-1" />
                Using network-optimized chunking with resumable uploads
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm font-medium">
                  {uploadPhase === 'encrypting' && `Encrypting video... ${uploadProgress}%`}
                  {uploadPhase === 'uploading' && `Uploading to Wasabi... ${uploadProgress}%`}
                  {uploadPhase === 'verifying' && `Verifying upload... ${uploadProgress}%`}
                  {uploadPhase === 'finalizing' && 'Finalizing upload...'}
                </p>
              </div>
            </div>
            
            <Progress value={uploadProgress} />
            
            <p className="text-xs text-muted-foreground">
              {uploadPhase === 'encrypting' && "Using enhanced encryption with chunked processing for optimal memory usage"}
              {uploadPhase === 'uploading' && `Uploading with ${adaptiveConfig.maxConcurrentChunks} concurrent ${formatFileSize(adaptiveConfig.chunkSize)} chunks based on your network speed`}
              {uploadPhase === 'verifying' && "Verifying upload integrity..."}
              {uploadPhase === 'finalizing' && "Almost done! Registering your video in the system..."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
