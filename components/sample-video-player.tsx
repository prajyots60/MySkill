'use client';

import { useState, useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface SampleVideoPlayerProps {
  title?: string;
  className?: string;
  autoplay?: boolean;
  onProgress?: (progress: number) => void;
  onEnded?: () => void;
}

export default function SampleVideoPlayer({
  title,
  className = '',
  autoplay = false,
  onProgress,
  onEnded
}: SampleVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sample video URL for testing
  const sampleVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

  useEffect(() => {
    // Clean up previous player instance
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }

    const initializePlayer = () => {
      if (!videoRef.current) return;

      const videoJsOptions = {
        autoplay: autoplay,
        controls: true,
        responsive: true,
        fluid: true,
        sources: [{
          src: sampleVideoUrl,
          type: 'video/mp4'
        }]
      };

      // Initialize video.js player
      const player = videojs(videoRef.current, videoJsOptions, () => {
        console.log('Sample Video Player initialized');
        setLoading(false);
      });

      // Add event listeners
      player.on('timeupdate', () => {
        if (onProgress && player.duration() && player.currentTime()) {
          const progress = (player.currentTime() / player.duration()) * 100;
          onProgress(progress);
        }
      });

      player.on('ended', () => {
        if (onEnded) {
          onEnded();
        }
      });

      player.on('error', (e: any) => {
        console.error('Video player error:', e);
        setError('Failed to play video. Please try again later.');
      });

      playerRef.current = player;
    };

    // Initialize player after a short delay to ensure DOM is ready
    setTimeout(() => {
      try {
        initializePlayer();
      } catch (err) {
        console.error('Error initializing player:', err);
        setError('Failed to initialize video player.');
        setLoading(false);
      }
    }, 100);

    return () => {
      // Clean up player on unmount
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [autoplay, onProgress, onEnded, sampleVideoUrl]);

  if (loading) {
    return (
      <Card className={`w-full overflow-hidden ${className}`}>
        <CardContent className="p-0 flex items-center justify-center" style={{ minHeight: '300px' }}>
          <div className="flex flex-col items-center justify-center p-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Loading video player...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`w-full overflow-hidden ${className}`}>
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center p-6">
            <p className="text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full overflow-hidden ${className}`}>
      <CardContent className="p-0">
        {title && (
          <div className="p-3 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        )}
        <div data-vjs-player>
          <video 
            ref={videoRef} 
            className="video-js vjs-big-play-centered" 
            playsInline
          />
        </div>
      </CardContent>
    </Card>
  );
}
