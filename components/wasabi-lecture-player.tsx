'use client';

import { useState, useEffect } from 'react';
import WasabiVideoPlayer from '@/components/wasabi-video-player';
import { useWasabiStorage } from '@/hooks/use-wasabi-storage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

interface WasabiLecturePlayerProps {
  videoId: string; // This is the file key in Wasabi
  title?: string;
  isEncrypted?: boolean;
  className?: string;
  autoplay?: boolean;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}

export default function WasabiLecturePlayer({
  videoId,
  title,
  isEncrypted,
  className = '',
  autoplay = false,
  onProgress,
  onComplete
}: WasabiLecturePlayerProps) {
  const { getFileUrl } = useWasabiStorage();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch the video URL and metadata
        const response = await fetch(`/api/lectures/wasabi/${videoId}`);
        
        if (!response.ok) {
          throw new Error('Failed to load video data');
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.message || 'Failed to load video');
        }
        
        // Get a direct or temporary URL to the video file
        const urlResult = await getFileUrl(videoId);
        
        if (!urlResult.success || !urlResult.url) {
          throw new Error('Failed to get video URL');
        }
        
        setVideoUrl(urlResult.url);
        
        // If the video is encrypted, get the encryption key
        if (data.isEncrypted) {
          setEncryptionKey(data.encryptionKey || null);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading Wasabi video:', err);
        setError(err instanceof Error ? err.message : 'Failed to load video');
        setLoading(false);
      }
    };

    loadVideo();
  }, [videoId, getFileUrl]);

  if (loading) {
    return (
      <Card className={`aspect-video ${className}`}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading secure video...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !videoUrl) {
    return (
      <Alert variant="destructive" className={`aspect-video flex items-center ${className}`}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Failed to load video. Please try again later.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <WasabiVideoPlayer
      fileUrl={videoUrl}
      title={title}
      isEncrypted={!!encryptionKey}
      encryptionKey={encryptionKey || undefined}
      autoplay={autoplay}
      className={className}
      onProgress={onProgress}
      onEnded={onComplete}
    />
  );
}
