'use client';

import { useState, useEffect } from 'react';
import VideoJsWasabiPlayer from '@/components/videojs-wasabi-player';
import { useWasabiStorage } from '@/hooks/use-wasabi-storage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

interface WasabiLecturePlayerProps {
  videoId: string; // This is the file key in Wasabi
  title?: string;
  isEncrypted?: boolean;
  encryptionKey?: string; // Encryption key for decryption
  className?: string;
  autoplay?: boolean;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}

export default function WasabiLecturePlayer({
  videoId,
  title,
  isEncrypted,
  encryptionKey: providedKey,
  className = '',
  autoplay = false,
  onProgress,
  onComplete
}: WasabiLecturePlayerProps) {
  const { getFileUrl } = useWasabiStorage();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Use the provided key directly, don't create a separate state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Log the encryption key for debugging
  useEffect(() => {
    if (providedKey) {
      console.log('Encryption key provided:', `${providedKey.substring(0, 4)}...${providedKey.substring(providedKey.length - 4)}`);
    } else {
      console.log('No encryption key provided');
    }
  }, [providedKey]);

  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      try {
        if (isMounted) {
          setLoading(true);
          setError(null);
        }

        console.log('Loading video with ID:', videoId);
        console.log('Encryption enabled:', isEncrypted);
        console.log('Encryption key provided:', !!providedKey);
        
        // For development/testing, we can use a sample video URL
        // TEMPORARY FIX: Force enable sample video mode until Wasabi signature issues are resolved
        const useSampleVideo = false; // Force enable sample videos
        
        console.log('NEXT_PUBLIC_USE_SAMPLE_VIDEO:', process.env.NEXT_PUBLIC_USE_SAMPLE_VIDEO);
        console.log('NEXT_PUBLIC_FALLBACK_TO_SAMPLE:', process.env.NEXT_PUBLIC_FALLBACK_TO_SAMPLE);
        console.log('Sample video mode FORCED ENABLED for development');
        
        // Define sample videos for fallback
        const sampleVideos = [
          'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
          'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        ];
        
        // Select a sample video based on the videoId to make it deterministic
        const sampleIndex = videoId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % sampleVideos.length;
        const sampleVideoUrl = sampleVideos[sampleIndex];
        
        if (useSampleVideo) {
          // Use a public sample video for testing
          console.log('Using sample video for testing:', sampleVideoUrl);
          
          if (isMounted) {
            setVideoUrl(sampleVideoUrl);
            setLoading(false);
          }
          return;
        }
        
        // Prepare the file key for the presigned URL request
        let fileKey = videoId;
        
        // If the videoId is a full path, use it as is
        // If it's just a filename, we'll need to construct the full path
        if (videoId.includes('/')) {
          // It's already a full path, just add .encrypted if needed
          if (isEncrypted && !videoId.endsWith('.encrypted')) {
            fileKey += '.encrypted';
          }
        } else {
          // It's just a file name, we need to construct a path
          // This is a simplified example - in production, you'd need to know the correct path structure
          fileKey = `courses/videos/${videoId}`;
          if (isEncrypted) {
            fileKey += '.encrypted';
          }
        }
        
        console.log('Requesting presigned URL for file key:', fileKey);
        
        // Request a presigned URL from our API
        console.log('Requesting presigned URL with key:', fileKey);
        
        try {
          const response = await fetch('/api/storage/get-presigned-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              key: fileKey,
              expiresIn: 3600 // 1 hour expiration
            })
          });
          
          // Get the response data regardless of status
          const data = await response.json();
          console.log('Presigned URL API response:', {
            status: response.status,
            success: data.success,
            hasUrl: !!data.url,
            hasDirectUrl: !!data.directUrl,
            message: data.message || 'No message provided',
            error: data.error || 'No error details'
          });
          
          if (!response.ok) {
            throw new Error(data.message || `Failed to get presigned URL: ${response.status}`);
          }
          
          if (!data.success || !data.url) {
            throw new Error('Failed to generate presigned URL: No URL returned');
          }
          
          console.log('Successfully generated presigned URL');
          console.log('Direct URL (for reference):', data.directUrl);
          
          // Use the presigned URL for the video
          if (isMounted) {
            setVideoUrl(data.url);
            setLoading(false);
          }
        } catch (error) {
          console.error('Error fetching presigned URL:', error);
          
          // Fallback to sample video if enabled
          if (process.env.NEXT_PUBLIC_FALLBACK_TO_SAMPLE === 'true') {
            console.log('Falling back to sample video due to error');
            const sampleVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
            
            if (isMounted) {
              setVideoUrl(sampleVideoUrl);
              setLoading(false);
              setError(`Using sample video due to error: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else {
            throw error; // Re-throw to be caught by the outer catch block
          }
        }
      } catch (err) {
        console.error('Error loading Wasabi video:', err);
        
        if (isMounted) {
          setError(`Failed to load video: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
        }
      }
    };
    
    loadVideo();
    
    return () => {
      isMounted = false;
    };
  }, [videoId, isEncrypted, providedKey]);

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
    <VideoJsWasabiPlayer
      fileUrl={videoUrl}
      title={title}
      isEncrypted={!!providedKey}
      encryptionKey={providedKey || undefined}
      autoplay={autoplay}
      className={className}
      onProgress={onProgress}
      onEnded={onComplete}
    />
  );
}
