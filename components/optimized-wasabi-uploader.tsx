'use client';

import { useState, useCallback } from 'react';
import { useEncryptionWorker } from '@/hooks/use-encryption-worker';
import { useWasabiStorage } from '@/hooks/use-wasabi-storage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { FileVideo, Upload, Lock, Shield, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import { useUploadStore } from '@/lib/store/upload-store';
import { useCourseStore } from '@/lib/store/course-store';

// Size for each upload chunk (5MB)
const CHUNK_SIZE = 5 * 1024 * 1024;
// Size threshold for special handling of large files (100MB)
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;

interface OptimizedUploadProps {
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
}

export function OptimizedWasabiUploader({
  sectionId,
  title,
  description = '',
  isPreview = false,
  file,
  onUploadComplete,
  onUploadError,
  onUploadStart,
  onUploadProgress,
  enableEncryption = true
}: OptimizedUploadProps) {
  const [useEncryption, setUseEncryption] = useState(enableEncryption);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'preparing' | 'encrypting' | 'uploading' | 'processing' | 'finalizing'>('preparing');
  
  const { uploadFile } = useWasabiStorage();
  const { encryptFile, generateKey, isProcessing, isSupported } = useEncryptionWorker();
  const { addUpload } = useUploadStore();
  const { addUpload: addToCourseStore } = useCourseStore();
  
  const isWebWorkerSupported = isSupported();
  const isLargeFile = file.size > LARGE_FILE_THRESHOLD;
  
  // Format bytes to human-readable size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle upload with optimizations
  const handleUpload = useCallback(async () => {
    if (!sectionId || !title.trim() || !file) {
      toast({
        title: "Missing Information",
        description: "Please provide all required information before uploading",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate a unique ID for tracking this upload
      const uploadId = uuidv4();
      
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
      if (onUploadStart) {
        onUploadStart();
      }
      
      let encryptionKey: string | null = null;
      let processedFile = file;
      
      // Step 1: Encrypt file if enabled
      if (useEncryption) {
        try {
          setUploadPhase('encrypting');
          setUploadProgress(5);
          if (onUploadProgress) onUploadProgress(5);
          
          // Generate secure encryption key
          const keyData = await generateKey();
          encryptionKey = keyData.key;
          
          setUploadProgress(10);
          if (onUploadProgress) onUploadProgress(10);
          
          // Encrypt the file using the web worker
          const encryptedBlob = await encryptFile(file, encryptionKey, (progress) => {
            // Map progress to 10-30% range
            const scaledProgress = Math.floor(10 + (progress * 0.2));
            setUploadProgress(scaledProgress);
            if (onUploadProgress) onUploadProgress(scaledProgress);
          });
          
          // Convert Blob back to File to maintain file metadata
          processedFile = new File(
            [encryptedBlob], 
            file.name, 
            { 
              type: encryptedBlob.type || file.type,
              lastModified: file.lastModified 
            }
          );
          
          setUploadProgress(30);
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
          processedFile = file;
        }
      }
      
      // Step 2: Upload the file
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
      if (encryptionKey) metadata.isEncrypted = 'true';
      
      // Use chunked upload for all files
      const category = `courses/videos/${sectionId}`;
      
      // Upload the file
      const result = await uploadChunked(
        processedFile, 
        category, 
        metadata, 
        uploadId,
        (progress) => {
          // Map progress to 30-90% range
          const scaledProgress = Math.floor(30 + (progress * 0.6));
          setUploadProgress(scaledProgress);
          if (onUploadProgress) onUploadProgress(scaledProgress);
        }
      );
      
      if (!result.success) {
        throw new Error(result.error || "Failed to upload video");
      }
      
      // Step 3: Register the file in our backend
      setUploadPhase('finalizing');
      setUploadProgress(90);
      if (onUploadProgress) onUploadProgress(90);
      
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
      if (onUploadProgress) onUploadProgress(100);
      
      toast({
        title: "Upload Complete",
        description: "Video has been uploaded and registered successfully"
      });

      if (onUploadComplete && completeData.lecture) {
        onUploadComplete(completeData.lecture.id, result.key);
      }
      
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload video";
      
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
      setUploadProgress(0);
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
    uploadFile,
    encryptFile,
    generateKey,
    onUploadComplete, 
    onUploadError, 
    onUploadStart, 
    onUploadProgress,
    useEncryption
  ]);
  
  // Optimized chunked upload implementation
  const uploadChunked = async (
    file: File, 
    category: string, 
    metadata: Record<string, string>,
    uploadId: string,
    onProgress?: (progress: number) => void
  ) => {
    try {
      // Generate a file key based on the category and filename
      const timestamp = Date.now();
      const uniqueId = Math.random().toString(36).substring(2, 10);
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileKey = `${category}/${timestamp}-${uniqueId}-${safeFileName}`;
      
      // Step 1: Get a presigned URL for multipart upload initialization
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
          )
        }),
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        throw new Error(errorData.message || 'Failed to initialize multipart upload');
      }

      const { uploadId: multipartUploadId, key } = await initResponse.json();
      
      if (!multipartUploadId) {
        throw new Error('Failed to get multipart upload ID');
      }
      
      // Step 2: Upload file chunks in parallel (with controlled concurrency)
      const chunks: Blob[] = [];
      const parts: { PartNumber: number, ETag: string }[] = [];
      
      // Calculate total chunks
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let completedChunks = 0;
      
      // Create array of chunk objects
      for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        chunks.push(file.slice(start, end));
      }
      
      // Maximum concurrent uploads
      const MAX_CONCURRENT = Math.min(5, totalChunks);
      let activeUploads = 0;
      let nextChunkIndex = 0;
      
      // Process chunks with limited concurrency
      const processNextChunks = async () => {
        while (activeUploads < MAX_CONCURRENT && nextChunkIndex < totalChunks) {
          const chunkIndex = nextChunkIndex++;
          const partNumber = chunkIndex + 1;
          
          activeUploads++;
          uploadChunk(chunks[chunkIndex], partNumber, multipartUploadId, key)
            .then(eTag => {
              parts[chunkIndex] = { PartNumber: partNumber, ETag: eTag };
              completedChunks++;
              
              // Update progress
              if (onProgress) {
                onProgress(completedChunks / totalChunks * 100);
              }
              
              activeUploads--;
              processNextChunks(); // Process next chunk when this one completes
            })
            .catch(err => {
              console.error(`Error uploading chunk ${partNumber}:`, err);
              activeUploads--;
              // Still try to process more chunks - we'll handle failed parts later
              processNextChunks();
            });
        }
      };
      
      // Start processing chunks
      processNextChunks();
      
      // Wait for all chunks to complete or fail
      while (completedChunks < totalChunks) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Check if we have all parts
      if (parts.filter(Boolean).length !== totalChunks) {
        throw new Error('Some chunks failed to upload');
      }
      
      // Sort parts by part number
      parts.sort((a, b) => a.PartNumber - b.PartNumber);
      
      // Step 3: Complete the multipart upload
      const completeResponse = await fetch('/api/wasabi-multipart-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          uploadId: multipartUploadId,
          parts
        }),
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.message || 'Failed to complete multipart upload');
      }
      
      const { location, etag } = await completeResponse.json();
      
      // Construct the object URL
      const { NEXT_PUBLIC_WASABI_REGION, NEXT_PUBLIC_WASABI_BUCKET } = process.env;
      const objectUrl = location || `https://${NEXT_PUBLIC_WASABI_BUCKET}.s3.${NEXT_PUBLIC_WASABI_REGION}.wasabisys.com/${encodeURIComponent(key)}`;
      
      return {
        success: true,
        key,
        url: objectUrl,
        etag,
      };
    } catch (error) {
      console.error('Chunked upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      };
    }
  };
  
  // Helper to upload a single chunk
  const uploadChunk = async (
    chunk: Blob,
    partNumber: number,
    uploadId: string,
    key: string
  ): Promise<string> => {
    // Get presigned URL for this part
    const urlResponse = await fetch(`/api/wasabi-multipart-url?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`, {
      method: 'GET',
    });
    
    if (!urlResponse.ok) {
      throw new Error(`Failed to get URL for part ${partNumber}`);
    }
    
    const { url } = await urlResponse.json();
    
    // Upload the chunk
    const uploadResponse = await fetch(url, {
      method: 'PUT',
      body: chunk,
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload part ${partNumber}`);
    }
    
    // Get the ETag from response headers
    const eTag = uploadResponse.headers.get('ETag');
    if (!eTag) {
      throw new Error(`No ETag received for part ${partNumber}`);
    }
    
    // Return the ETag (remove quotes if present)
    return eTag.replace(/"/g, '');
  };
  
  // Display appropriate messages based on file size and encryption status
  const getEncryptionMessage = () => {
    if (!isWebWorkerSupported) {
      return "Encryption offloading not supported in your browser. Encryption may cause browser to slow down.";
    }
    if (isLargeFile) {
      return "For very large files, encryption may take some time but won't freeze your browser.";
    }
    return "Encryption adds additional security for your video content";
  };
  
  return (
    <Card className="w-full">
      <CardContent className="p-4">
        {!isUploading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileVideo className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)} • {file.type}
                  {isLargeFile && 
                    <span className="ml-2 text-amber-500">
                      (Large file - optimized chunked upload will be used)
                    </span>
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="useEncryption"
                checked={useEncryption}
                onCheckedChange={setUseEncryption}
              />
              <Label htmlFor="useEncryption" className="flex items-center cursor-pointer">
                <Lock className="w-4 h-4 mr-2" /> 
                <span>Encrypt video for security</span>
              </Label>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {getEncryptionMessage()}
            </p>
            
            <div className="flex flex-col space-y-2">
              <Button 
                onClick={handleUpload} 
                className="w-full"
                disabled={isUploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                Start Optimized Upload
              </Button>
              
              {isWebWorkerSupported && (
                <p className="text-xs text-center text-green-600 flex items-center justify-center">
                  <Shield className="w-3 h-3 mr-1" />
                  Using optimized encryption with background processing
                </p>
              )}
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
                  {uploadPhase === 'finalizing' && 'Finalizing upload...'}
                </p>
              </div>
            </div>
            
            <Progress value={uploadProgress} />
            
            <p className="text-xs text-muted-foreground">
              {uploadPhase === 'encrypting' && "Encrypting your video in the background. This won't freeze your browser."}
              {uploadPhase === 'uploading' && "Uploading in optimized chunks. You can continue using the app."}
              {uploadPhase === 'finalizing' && "Almost done! Registering your video in the system..."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
