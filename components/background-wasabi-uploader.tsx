'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { FileVideo, Upload, Loader2, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCourseStore } from '@/lib/store/course-store';
import { Switch } from '@/components/ui/switch';
import { v4 as uuidv4 } from 'uuid';
import { Label } from '@/components/ui/label';
import { useUploadStore } from '@/lib/store/upload-store';

interface BackgroundUploaderProps {
  sectionId: string;
  title: string;
  description?: string;
  isPreview?: boolean;
  file: File;
  onUploadComplete?: (lectureId: string, fileKey: string) => void;
  onUploadError?: (error: Error) => void;
  onUploadStart?: () => void;
  enableEncryption?: boolean;
}

export function BackgroundWasabiUploader({
  sectionId,
  title,
  description = '',
  isPreview = false,
  file,
  onUploadComplete,
  onUploadError,
  onUploadStart,
  enableEncryption = true
}: BackgroundUploaderProps) {
  const [useEncryption, setUseEncryption] = useState(enableEncryption);
  const [isStarting, setIsStarting] = useState(false);
  const { addUpload: addToCourseStore, updateUploadProgress: updateCourseStoreProgress, updateUploadStatus } = useCourseStore();
  const { addUpload } = useUploadStore();
  
  // Format bytes to human-readable size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Size threshold for using chunked uploads (20MB)
  const CHUNKED_UPLOAD_THRESHOLD = 20 * 1024 * 1024;
  const isLargeFile = file && file.size > CHUNKED_UPLOAD_THRESHOLD;

  // Handle background upload
  const handleBackgroundUpload = useCallback(async () => {
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
      setIsStarting(true);
      
      // Generate a unique ID for tracking this upload
      const uploadId = uuidv4();
      
      // Prepare metadata for the upload - always create a fresh object
      let metadata: Record<string, string> = {
        title,
        sectionId,
        isPreview: isPreview.toString(),
        contentType: 'video',
        videoSource: 'WASABI',
      };
      
      // Add optional properties as a new object instead of modifying
      metadata = description ? { ...metadata, description } : metadata;
      
      // Add encryption flag if enabled
      if (useEncryption) {
        metadata = { ...metadata, isEncrypted: 'true' };
      }
      
      // Add to upload store for background processing
      addUpload({
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
      addToCourseStore({
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
    } finally {
      setIsStarting(false);
    }
  }, [
    file, 
    sectionId, 
    title, 
    description, 
    isPreview, 
    addUpload,
    addToCourseStore,
    onUploadComplete, 
    onUploadError, 
    onUploadStart,
    useEncryption
  ]);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
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
            <div className="text-xs text-muted-foreground ml-2">
              (If you encounter upload issues, try disabling encryption)
            </div>
          </div>
          
          <Button 
            onClick={handleBackgroundUpload} 
            className="w-full"
            disabled={isStarting || !file}
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Upload...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload in Background
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Your upload will continue even if you navigate away from this page.
            <br />
            You can monitor your uploads using the upload manager.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
