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

// Add headers interface
interface FetchHeaders {
  'Content-Type': string;
  'Origin': string;
  'Access-Control-Request-Method'?: string;
  [key: string]: string | undefined;
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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(null);

        // Log encryption key validation early
        console.log('WasabiLecturePlayer encryption validation:', {
          isEncrypted,
          hasKey: !!providedKey,
          keyLength: providedKey?.length,
          keyFormat: providedKey ? {
            isHex: /^[0-9a-fA-F]+$/.test(providedKey),
            length: providedKey.length,
            firstFewChars: providedKey.substring(0, 8) + '...',
            containsNonHex: providedKey.match(/[^0-9a-fA-F]/g)
          } : null
        });
        
        console.log('Loading encrypted video:', {
          videoId,
          isEncrypted,
          hasKey: !!providedKey
        });
        
        // Simple path construction
        const fileKey = videoId.includes('/') ? videoId : `courses/videos/${videoId}`;
        
        // Get presigned URL
        try {
          const response = await fetch('/api/storage/get-presigned-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              key: fileKey,
              expiresIn: 3600
            })
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.url) {
            throw new Error(data.message || `Failed to get presigned URL: ${response.status}`);
          }
          
          console.log('Got presigned URL:', data.url);
          setVideoUrl(data.url);
          setLoading(false);
          
        } catch (error) {
          console.error('Failed to get presigned URL:', error);
          setError('Failed to access video');
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading video:', err);
          setError('Failed to load video');
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
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error || !videoUrl) {
    return (
      <Alert variant="destructive" className={`aspect-video flex items-center ${className}`}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Failed to load video'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <VideoJsWasabiPlayer
      fileUrl={videoUrl}
      title={title}
      isEncrypted={isEncrypted}
      encryptionKey={providedKey}
      className={className}
    />
  );
}
