'use client';

import { useState } from 'react';
import { OdyseeStreamPlayer } from './odysee-stream-player';
import { OdyseeStreamData } from '@/types/odysee';

interface OdyseeLecturePlayerProps {
  lectureId: string;
  title: string;
  claimId: string;
  claimName: string;
  streamData?: any; // Using any since the streamData from the server might have a different structure
  onComplete?: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

/**
 * A component for playing Odysee lectures with proper tracking and handling of unlisted videos
 */
export function OdyseeLecturePlayer({
  lectureId,
  title,
  claimId,
  claimName,
  streamData,
  onComplete,
  onError,
  className = "w-full aspect-video"
}: OdyseeLecturePlayerProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  
  // Parse stream data to a proper format
  const parsedStreamData: OdyseeStreamData = {
    originalUrl: streamData?.originalUrl || '',
    embedUrl: streamData?.embedUrl || '',
    directUrl: streamData?.directUrl || '',
    isUnlisted: !!streamData?.isUnlisted || streamData?.originalUrl?.includes('signature=') || false,
    title: title || streamData?.title || 'Odysee Lecture'
  };

  // Handle video completion
  const handleVideoEnded = () => {
    if (!isCompleted) {
      setIsCompleted(true);
      
      // Mark the lecture as completed in the database
      updateProgress(100).catch(console.error);
      
      if (onComplete) {
        onComplete();
      }
    }
  };

  // Handle player errors
  const handlePlayerError = (error: Error) => {
    setPlayerError(error.message);
    console.error("Odysee player error:", error);
    
    if (onError) {
      onError(error);
    }
  };

  // Update progress in the database
  const updateProgress = async (percentage: number) => {
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lectureId,
          percentage,
          isComplete: percentage >= 95  // Consider as complete if >95% watched
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update progress');
      }
    } catch (error) {
      console.error('Error updating lecture progress:', error);
    }
  };

  // Show error state if there's a problem
  if (playerError) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`}>
        <div className="text-center p-4">
          <p className="text-destructive font-medium mb-2">Error playing lecture</p>
          <p className="text-sm text-muted-foreground">{playerError}</p>
          <button 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            onClick={() => setPlayerError(null)}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <OdyseeStreamPlayer
      claimId={claimId}
      claimName={claimName}
      streamData={parsedStreamData}
      title={title}
      className={className}
      onEnded={handleVideoEnded}
      onError={handlePlayerError}
    />
  );
}
