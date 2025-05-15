'use client';

import React, { useEffect, useRef } from 'react';
import { useOptimizedState } from '@/hooks/use-optimized-state';
import { useVideoProgress } from '@/hooks/use-video-progress';

interface OdyseePlayerProps {
  claimId: string;
  claimName: string;
  embedUrl?: string;
  height?: number;
  width?: string;
  autoplay?: boolean;
  onReady?: () => void;
  onError?: (error: any) => void;
  onProgress?: (progress: number) => void;
  saveProgress?: boolean;
}

export function OdyseePlayer({
  claimId,
  claimName,
  embedUrl,
  height = 400,
  width = '100%',
  autoplay = false,
  onReady,
  onError,
  onProgress,
  saveProgress = false,
}: OdyseePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useOptimizedState(false);
  const [error, setError] = useOptimizedState<string | null>(null);
  const { updateProgress, getStoredProgress } = useVideoProgress();

  // Generate the embed URL if not provided
  const generateDefaultEmbedUrl = () => {
    // Check if claimName starts with @ (Channel-based URL)
    const isChannelUrl = claimName.startsWith('@');
    
    // Format: https://odysee.com/$/$WEBPAGE/ClaimName:ClaimId
    if (isChannelUrl) {
      return `https://odysee.com/%24/embed/${claimName}`;
    } else {
      return `https://odysee.com/%24/embed/${claimId}`;
    }
  };

  // Use the provided embedUrl or generate the default one
  const finalEmbedUrl = embedUrl || generateDefaultEmbedUrl();

  // Add autoplay parameter if needed
  const embedUrlWithParams = () => {
    // If this is already a full URL with signature params (for unlisted videos)
    // we need to preserve all params and just add autoplay if needed
    if (finalEmbedUrl.includes('signature=')) {
      const url = new URL(finalEmbedUrl);
      if (autoplay) {
        url.searchParams.set('autoplay', '1');
      }
      return url.toString();
    } 
    
    // For regular videos, we can just add autoplay param
    const separator = finalEmbedUrl.includes('?') ? '&' : '?';
    const params = autoplay ? `${separator}autoplay=1` : '';
    return `${finalEmbedUrl}${params}`;
  };

  // Handle video loaded event
  const handleIframeLoad = () => {
    setIsLoaded(true);
    setError(null);
    if (onReady) onReady();
    
    // Apply stored progress if available
    if (saveProgress) {
      const storedTime = getStoredProgress(`odysee-${claimId}`);
      if (storedTime && storedTime > 0) {
        // We'd need to use Odysee iframe API to set current time
        // This is a placeholder - actual API integration would be needed
        // tryToSetVideoTime(storedTime);
      }
    }
  };

  // Handle errors
  const handleIframeError = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    setError('Failed to load Odysee video');
    if (onError) onError(e);
  };

  // Effect to set up message listener for progress tracking
  useEffect(() => {
    if (!saveProgress && !onProgress) return;
    
    const handleMessage = (event: MessageEvent) => {
      // This is a placeholder for Odysee's postMessage API
      // Actual implementation would depend on Odysee's iframe API
      if (event.origin.includes('odysee.com') && event.data && event.data.type === 'timeupdate') {
        const currentTime = event.data.currentTime;
        
        if (saveProgress) {
          updateProgress(`odysee-${claimId}`, currentTime);
        }
        
        if (onProgress) {
          onProgress(currentTime);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [claimId, onProgress, saveProgress, updateProgress]);

  return (
    <div className="odysee-player-container" style={{ width, position: 'relative' }}>
      {error && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-red-500 text-center p-4"
        >
          {error}
        </div>
      )}
      
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
        <iframe
          ref={iframeRef}
          id={`odysee-iframe-${claimId}`}
          title={`Odysee video ${claimName || claimId}`}
          src={embedUrlWithParams()}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 0,
          }}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>
      
      {!isLoaded && !error && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900"
        >
          <div className="animate-pulse text-center">
            <div className="h-12 w-12 border-t-2 border-b-2 border-primary rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading Odysee video...</p>
          </div>
        </div>
      )}
    </div>
  );
}