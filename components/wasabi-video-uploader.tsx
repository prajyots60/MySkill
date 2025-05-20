'use client';

import { useState, useRef, useCallback } from 'react';
import { useWasabiStorage } from '@/hooks/use-wasabi-storage';
import { useChunkedUpload } from '@/hooks/use-chunked-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { FileVideo, Upload, CheckCircle, AlertCircle, Loader2, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCourseStore } from '@/lib/store/course-store';
import { Switch } from '@/components/ui/switch';
import { v4 as uuidv4 } from 'uuid';

interface WasabiVideoUploaderProps {
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

export default function WasabiVideoUploader({
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
}: WasabiVideoUploaderProps) {
  const { uploadFile, isUploading, uploadProgress } = useWasabiStorage();
  const { uploadLargeFile } = useChunkedUpload();
  const [useEncryption, setUseEncryption] = useState(enableEncryption);
  const [uploadPhase, setUploadPhase] = useState<'preparing' | 'uploading' | 'processing' | 'finalizing'>('preparing');
  const { addUpload, updateUploadProgress, updateUploadStatus } = useCourseStore();
  
  // Size threshold for using chunked uploads (20MB)
  const CHUNKED_UPLOAD_THRESHOLD = 20 * 1024 * 1024;

  // Handle the upload process
  const handleUpload = useCallback(async () => {
    if (!sectionId) {
      toast({
        title: "Missing Information",
        description: "Please select a section for this video",
        variant: "destructive",
      });
      return;
    }
    
    if (!title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a title for your video",
        variant: "destructive",
      });
      return;
    }
    
    if (!file) {
      toast({
        title: "Missing Information",
        description: "Please select a video file to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate a unique ID for tracking this upload
      const uploadId = uuidv4();
      
      // Use the upload store for background uploads
      const uploadStore = await import("@/lib/store/upload-store");
      
      // Prepare metadata for the upload
      const metadata: Record<string, string> = {
        title,
        sectionId,
        isPreview: isPreview.toString(),
        contentType: 'video',
        videoSource: 'WASABI',
      };
      
      if (description) metadata.description = description;
      if (useEncryption) metadata.isEncrypted = 'true';
      
      // Add to upload store
      uploadStore.useUploadStore.getState().addUpload({
        id: uploadId,
        file,
        title,
        description,
        sectionId,
        isPreview,
        status: "queued",
        progress: 0,
        videoSource: "wasabi",
        isRestartable: true,
        category: `courses/videos/${sectionId}`,
        metadata
      });
      
      // Also add to course store for backwards compatibility
      addUpload({
        id: uploadId,
        type: "lecture",
        title,
      });

      if (onUploadStart) {
        onUploadStart();
      }

      toast({
        title: "Upload Started",
        description: "Your video is now uploading in the background. You can safely navigate away from this page.",
      });

      // We don't need to wait for the upload to complete here
      // It will be handled by the background upload service
      
      // Let the calling component know about the upload
      if (onUploadComplete) {
        onUploadComplete(uploadId, "");
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
    }

      // Encrypt the video if enabled
      let processedFile = file;
      let encryptionKey = null;
      
      if (useEncryption) {
        setUploadPhase('processing');
        updateUploadProgress(uploadId, 15);
        if (onUploadProgress) onUploadProgress(15);
        
        // Generate a secure encryption key
        const keyArray = new Uint8Array(16); // 128-bit key for AES-128
        window.crypto.getRandomValues(keyArray);
        encryptionKey = Array.from(keyArray)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
          
        try {
          // We'll use a Web Worker for encryption to avoid blocking the UI
          const encryptedBlob = await encryptFile(file, encryptionKey);
          processedFile = new File([encryptedBlob], file.name, { type: file.type });
          
          updateUploadProgress(uploadId, 20);
          if (onUploadProgress) onUploadProgress(20);
        } catch (encryptError) {
          console.error('Encryption failed:', encryptError);
          toast({
            title: "Encryption Failed",
            description: "Could not encrypt video. Uploading without encryption for now. You can try again later with encryption enabled.",
            variant: "destructive",
          });
          setUseEncryption(false);
          encryptionKey = null;
          // Continue with the unencrypted file
          processedFile = file;
        }
      }

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
      // We don't store the encryption key in the metadata for security reasons
      // It will be stored in our database instead

      setUploadPhase('uploading');
      // Use the folder structure: courses/videos/sectionId
      const category = `courses/videos/${sectionId}`;
      
      // Determine whether to use chunked upload based on file size
      let result;
      if (file.size > CHUNKED_UPLOAD_THRESHOLD) {
        console.log(`File size (${formatFileSize(file.size)}) exceeds threshold, using chunked upload`);
        // For large files, use chunked upload to prevent timeouts
        result = await uploadLargeFile({
          file: processedFile,
          category,
          metadata,
          onProgress: (progress) => {
            const actualProgress = Math.floor(20 + (progress * 0.6)); // Scale to 20-80%
            updateUploadProgress(uploadId, actualProgress);
            if (onUploadProgress) onUploadProgress(actualProgress);
          },
        });
      } else {
        // For smaller files, use the standard upload
        result = await uploadFile({
          file: processedFile,
          category,
          metadata,
          onProgress: (progress) => {
            const actualProgress = Math.floor(20 + (progress * 0.6)); // Scale to 20-80%
            updateUploadProgress(uploadId, actualProgress);
            if (onUploadProgress) onUploadProgress(actualProgress);
          },
        });
      }

      if (!result.success) {
        throw new Error(result.error || "Failed to upload video");
      }

      // Now register the video in our database
      setUploadPhase('finalizing');
      updateUploadProgress(uploadId, 90);
      if (onUploadProgress) onUploadProgress(90);

      // Use a timeout to ensure the upload is fully processed on Wasabi's side
      // before we register it in our database
      await new Promise(resolve => setTimeout(resolve, 2000));

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
          fileSize: file.size,
          fileType: file.type,
          isEncrypted: !!encryptionKey,
          // Only send encryption key via HTTPS
          encryptionKey: encryptionKey,
          uploadJobId: uploadId
        })
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.message || "Failed to register video in database");
      }

      const completeData = await completeResponse.json();

      // Upload complete
      updateUploadProgress(uploadId, 100);
      updateUploadStatus(uploadId, "completed");
      if (onUploadProgress) onUploadProgress(100);

      toast({
        title: "Upload Complete",
        description: "Video has been uploaded successfully"
      });

      if (onUploadComplete && completeData.lecture) {
        onUploadComplete(completeData.lecture.id, result.key);
      }
      
      // Reset the upload phase regardless of callback
      setUploadPhase('preparing');
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload video";
      
      // Provide more detailed error messages for common issues
      let displayMessage = errorMessage;
      if (errorMessage.includes('timeout')) {
        displayMessage = "Upload timed out. This might be due to a large file or slow connection. Please try again with a stronger internet connection or compress your video.";
      } else if (errorMessage.includes('network')) {
        displayMessage = "Network error occurred. Please check your internet connection and try again.";
      } else if (errorMessage.includes('permission')) {
        displayMessage = "Permission denied. You may not have the correct permissions to upload to this location.";
      }
      
      toast({
        title: "Upload Failed",
        description: displayMessage,
        variant: "destructive"
      });

      if (onUploadError && error instanceof Error) {
        onUploadError(error);
      }
    }
  }, [
    file, 
    sectionId, 
    title, 
    description, 
    isPreview, 
    addUpload, 
    uploadFile, 
    updateUploadProgress, 
    updateUploadStatus, 
    onUploadComplete, 
    onUploadError, 
    onUploadStart, 
    onUploadProgress,
    useEncryption
  ]);

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get current phase description
  const getPhaseDescription = () => {
    switch (uploadPhase) {
      case 'preparing':
        return 'Preparing upload...';
      case 'processing':
        return `Encrypting video...`;
      case 'uploading':
        return `Uploading to Wasabi... ${uploadProgress}%`;
      case 'finalizing':
        return 'Finalizing upload...';
      default:
        return 'Uploading...';
    }
  };

  // Check if the file is large enough for chunked upload
  const isLargeFile = file && file.size > CHUNKED_UPLOAD_THRESHOLD;

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
                  {isLargeFile && <span className="ml-2 text-amber-600 font-medium">(Large file - will use chunked upload)</span>}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 mb-4">
              <Switch
                id="useEncryption"
                checked={useEncryption}
                onCheckedChange={setUseEncryption}
              />
              <Label htmlFor="useEncryption" className="flex items-center cursor-pointer">
                <Lock className="w-4 h-4 mr-2" /> 
                <span>Encrypt video for better security</span>
              </Label>
            </div>
            
            <Button 
              onClick={handleUpload} 
              className="w-full"
              disabled={isUploading || !file}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload to Wasabi Storage
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm font-medium">{getPhaseDescription()}</p>
              </div>
            </div>
            
            <Progress value={uploadProgress} />
            
            {uploadPhase === 'uploading' && (
              <p className="text-xs text-muted-foreground">
                {isLargeFile 
                 ? "Uploading in chunks directly to Wasabi. This may take some time for large files. Do not close this window." 
                 : "Uploading directly to Wasabi. Do not close this window."}
              </p>
            )}
            
            {uploadPhase === 'processing' && (
              <p className="text-xs text-muted-foreground">
                Encrypting your video for security. This may take a moment...
              </p>
            )}
            
            {uploadPhase === 'finalizing' && (
              <p className="text-xs text-muted-foreground">
                Almost done! Registering video in your course...
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to encrypt a file
async function encryptFile(file: File, key: string): Promise<Blob> {
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
}
