'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { OdyseeUrlInput } from '@/components/odysee-url-input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { OdyseePlyr } from './odysee-plyr';
import { OdyseeStreamPlayer } from './odysee-stream-player';
import { OdyseeVideoMetadata, OdyseeApiResponse } from '@/types/odysee';

interface OdyseeVideoUploaderProps {
  sectionId: string;
  title: string;
  description?: string;
  isPreview?: boolean;
  initialUrl?: string;
  onUploadComplete?: (lectureId: string, claimId: string) => void;
  onUploadError?: (error: Error) => void;
}

export default function OdyseeVideoUploader({
  sectionId,
  title,
  description = "",
  isPreview = false,
  initialUrl = "",
  onUploadComplete,
  onUploadError
}: OdyseeVideoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<OdyseeVideoMetadata | null>(null);
  const { toast } = useToast();

  const handleVideoAdded = async (metadata: OdyseeVideoMetadata) => {
    try {
      // Store the video for preview
      setCurrentVideo({
        ...metadata,
        directUrl: metadata.resolvedUrl || metadata.directUrl || metadata.url
      });
      
      setIsUploading(true);
      
      // Create the lecture with Odysee video info
      const response = await fetch('/api/videos/odysee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: metadata.url,
          embedUrl: metadata.embedUrl,
          directUrl: metadata.resolvedUrl || metadata.directUrl || metadata.url,
          title: title || metadata.title || `Odysee Video: ${metadata.claimName}`,
          description,
          sectionId,
          isPreview,
          thumbnailUrl: metadata.thumbnailUrl, // Include thumbnail URL if available
          duration: metadata.duration // Include duration if available
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create lecture with Odysee video');
      }

      const result = await response.json() as OdyseeApiResponse;
      
      toast({
        title: "Success",
        description: "Odysee video has been added to your course",
      });

      if (onUploadComplete) {
        onUploadComplete(result.lecture.id, metadata.claimId);
      }
    } catch (error) {
      console.error("Error adding Odysee video:", error);
      
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to add Odysee video",
        variant: "destructive"
      });
      
      if (onUploadError && error instanceof Error) {
        onUploadError(error);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {currentVideo && (
        <div className="mt-4 border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2">{currentVideo.title || 'Video Preview'}</h3>
          
          {/* Thumbnail display before player loads */}
          {currentVideo.thumbnailUrl && (
            <div className="mb-4">
              <img 
                src={currentVideo.thumbnailUrl} 
                alt={currentVideo.title || 'Video thumbnail'} 
                className="w-full h-auto max-h-[200px] object-cover rounded-md"
              />
            </div>
          )}
          
          <OdyseeStreamPlayer
            claimId={currentVideo.claimId}
            claimName={currentVideo.claimName}
            streamData={{
              originalUrl: currentVideo.url,
              embedUrl: currentVideo.embedUrl,
              directUrl: currentVideo.directUrl || currentVideo.url,
              isUnlisted: !!currentVideo.url.includes('signature='),
              title: currentVideo.title,
              thumbnailUrl: currentVideo.thumbnailUrl
            }}
            className="h-[300px] w-full"
            title={currentVideo.title || 'Odysee Video'}
            onError={(error) => console.error("Odysee player error:", error)}
          />
          
          {currentVideo.description && (
            <p className="mt-2 text-sm text-gray-600">{currentVideo.description}</p>
          )}
          
          {currentVideo.duration && (
            <p className="mt-1 text-sm text-gray-600">
              Duration: {Math.floor(currentVideo.duration / 60)}:{(currentVideo.duration % 60).toString().padStart(2, '0')}
            </p>
          )}
        </div>
      )}
      <div className="rounded-md border p-4 bg-background">
        <h3 className="text-sm font-medium mb-2">Add Odysee Video</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Paste the URL of your Odysee video to add it to your course.
        </p>
        
        <OdyseeUrlInput
          onVideoAdded={handleVideoAdded}
          initialUrl={initialUrl}
          placeholder="https://odysee.com/video-title:abc123"
          buttonText={isUploading ? "Adding..." : "Add Video"}
        />
        
        {isUploading && (
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Adding video to your course...</span>
          </div>
        )}
      </div>
    </div>
  );
}
