"use client"

import React, { useState, useRef, useEffect } from "react"
import { SecureVideoPlayer } from "@/components/secure-video-player"
import { PlyrComponent } from "@/components/plyr-component"
import { OdyseeLecturePlayer } from "@/components/odysee-lecture-player"
import WasabiLecturePlayer from "@/components/wasabi-lecture-player"
import { cn } from "@/lib/utils"

interface VideoPlayerProps {
  lectureId: string
  videoId?: string
  title: string
  courseId: string
  startPosition?: number
  isCompleted?: boolean
  onComplete?: () => void
  onProgress?: (progress: number) => void
  videoSource?: 'YOUTUBE' | 'ODYSEE' | 'WASABI'
  claimId?: string  // For Odysee videos
  claimName?: string  // For Odysee videos
  streamData?: any  // Additional Odysee stream data
  isEncrypted?: boolean  // For Wasabi encrypted videos
  encryptionKey?: string  // Encryption key for Wasabi videos
}

// Direct CSS styles for the video player
const videoPlayerStyles = `
  /* Center the video vertically */
  .plyr {
    margin: 0 auto !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
  }

  /* Ensure controls are at the very bottom with extra margin */
  .plyr__controls {
    bottom: 0 !important;
    margin-bottom: 0 !important;
    width: 100% !important;
  }

  /* Hide YouTube elements */
  .ytp-youtube-button, 
  .ytp-watermark,
  .ytp-share-button-visible,
  .ytp-chrome-top-buttons {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
  }

  /* Video wrapper styles to center vertically */
  .video-wrapper {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    width: 100% !important;
    height: 100% !important;
    padding: 0 !important;
  }

  /* Video container takes full width and maintains aspect ratio */
  .video-container {
    width: 100% !important;
    height: 100% !important;
    position: relative !important;
    background-color: black !important;
  }
`;

function VideoPlayer({
  lectureId,
  videoId,
  title,
  courseId,
  startPosition,
  isCompleted,
  onComplete,
  onProgress,
  videoSource,
  claimId,
  claimName,
  streamData,
  isEncrypted,
  encryptionKey
}: VideoPlayerProps) {
  const [isClient, setIsClient] = useState(false)
  const playerContainerRef = useRef<HTMLDivElement>(null)

  // Only render on client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    console.log("[VideoPlayer] Rendering with courseId:", courseId)
    console.log("[VideoPlayer] Video type:", videoSource, "VideoId:", videoId, "ClaimId:", claimId)
  }, [courseId, videoSource, videoId, claimId])

  // Add custom CSS for video positioning
  useEffect(() => {
    if (!isClient) return;
    
    const styleElement = document.createElement('style');
    styleElement.textContent = videoPlayerStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      if (styleElement.parentNode) {
        document.head.removeChild(styleElement);
      }
    };
  }, [isClient]);

  // Just keep the client-side rendering effect
  useEffect(() => {
    // Clean up styles when component unmounts
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  if (!isClient) {
    return (
      <div className="aspect-video bg-muted rounded-lg animate-pulse">
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-muted-foreground">Loading video player...</p>
        </div>
      </div>
    )
  }

  // No custom fullscreen button needed as we're using Plyr's built-in controls

  // Handle Odysee videos
  if (videoSource === 'ODYSEE' && claimId) {
    console.log("[VideoPlayer] Rendering Odysee player with claim ID:", claimId);
    return (
      <div ref={playerContainerRef} className="relative video-container w-full">
        <OdyseeLecturePlayer
          lectureId={lectureId}
          title={title}
          claimId={claimId}
          claimName={claimName || ""}
          streamData={streamData}
          onComplete={onComplete}
          onError={(error) => console.error("Odysee player error:", error)}
        />
      </div>
    )
  }

  // Handle Wasabi videos
  if (videoSource === 'WASABI' && videoId) {
    console.log("[VideoPlayer] Rendering Wasabi player with video ID:", videoId);
    return (
      <div ref={playerContainerRef} className="relative video-container w-full">
        <WasabiLecturePlayer
          videoId={videoId}
          title={title}
          isEncrypted={isEncrypted}
          className="w-full h-full"
          autoplay={false}
          onProgress={onProgress}
          onComplete={onComplete}
        />
      </div>
    )
  }

  // Use secure player for course content with YouTube videos
  if (lectureId) {
    return (
      <div ref={playerContainerRef} className="relative video-container w-full">
        <SecureVideoPlayer
          lectureId={lectureId}
          title={title}
          courseId={courseId}
          onEnded={onComplete}
          onProgress={onProgress}
        />
      </div>
    )
  }

  // Use plyr for external content (YouTube, Vimeo, etc.)
  if (videoId) {
    return (
      <div ref={playerContainerRef} className="relative video-container w-full">
        <PlyrComponent
          videoId={videoId}
          title={title}
          onEnded={onComplete}
        />
      </div>
    )
  }

  return <div>No video source provided</div>
}

export default React.memo(VideoPlayer)
