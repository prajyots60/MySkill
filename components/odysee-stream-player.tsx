'use client';

import { useState, useEffect } from 'react';
import { OdyseePlyr } from './odysee-plyr';
import { OdyseeStreamData } from '@/types/odysee';

interface OdyseeStreamPlayerProps {
  claimId: string;
  claimName: string;
  streamData?: OdyseeStreamData | null;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

/**
 * A component that plays Odysee videos using the StreamData field
 * This is particularly useful for unlisted videos that require signature parameters
 */
export function OdyseeStreamPlayer({
  claimId,
  claimName,
  streamData,
  title = 'Odysee Video',
  className = '',
  autoPlay = false,
  onEnded,
  onError
}: OdyseeStreamPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Determine the best URL to use for the video
  const videoUrl = streamData?.directUrl || 
                   (streamData?.isUnlisted ? streamData?.originalUrl : null) || 
                   streamData?.embedUrl || 
                   streamData?.originalUrl || 
                   '';
  
  const handleError = (err: Error) => {
    setError(err.message);
    if (onError) onError(err);
  };
  
  // Show error or player
  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`}>
        <div className="text-center p-4">
          <p className="text-destructive font-medium mb-2">Error playing video</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <OdyseePlyr
      claimId={claimId}
      claimName={claimName}
      url={videoUrl}
      title={title}
      className={className}
      autoPlay={autoPlay}
      customEndScreen={true}
      onError={handleError}
      onEnded={onEnded}
      onReady={() => setIsLoading(false)}
    />
  );
}
