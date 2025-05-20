"use client"

import React, { useState, useRef, useEffect } from "react"
import { SecureVideoPlayer } from "@/components/secure-video-player"
import { PlyrComponent } from "@/components/plyr-component"
import { OdyseeLecturePlayer } from "@/components/odysee-lecture-player"
import WasabiLecturePlayer from "@/components/wasabi-lecture-player"
import { Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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

  /* Fixed-position blockers for fullscreen mode */
  #fullscreen-youtube-blocker-bottom,
  #fullscreen-youtube-blocker-top {
    position: fixed !important;
    z-index: 2147483647 !important;
    background-color: black !important;
    pointer-events: none !important;
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

  /* Fullscreen container styling */
  :fullscreen {
    background: black !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    height: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Ensure iframe is centered in fullscreen mode */
  :fullscreen .plyr__video-wrapper,
  :fullscreen iframe {
    width: 100% !important;
    height: 100% !important;
    max-height: calc(100vh - 80px) !important;
    margin: 0 auto !important;
  }
  
  /* Move controls to the absolute bottom in fullscreen */
  :fullscreen .plyr__controls {
    position: fixed !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    padding: 15px 20px !important;
    background: rgba(0, 0, 0, 0.7) !important;
    z-index: 99999 !important;
  }

  /* Video container takes full width and maintains aspect ratio */
  .video-container {
    width: 100% !important;
    height: 100% !important;
    position: relative !important;
    background-color: black !important;
  }
  
  /* In fullscreen mode, ensure the container takes the full viewport */
  :fullscreen .video-container {
    width: 100vw !important;
    height: 100vh !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null)

  // Position settings for the fullscreen button
  const buttonPositions = {
    normal: {
      top: 12,
      right: 22,
      backgroundColor: "white",
      iconColor: "text-blue-400",
      size: 24,
      zIndex: 50,
    },
    fullscreen: {
      top: 60,     // Adjust this value to move up/down
      right: 35,   // Adjust this value to move left/right
      backgroundColor: "white",
      iconColor: "text-blue-400",
      size: 24,
      zIndex: 2147483647,
    }
  }

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

  // Update button position based on fullscreen state
  useEffect(() => {
    if (!fullscreenButtonRef.current) return;
    
    const button = fullscreenButtonRef.current;
    const position = isFullscreen ? buttonPositions.fullscreen : buttonPositions.normal;
    
    if (isFullscreen) {
      // Apply fullscreen positioning
      button.style.position = 'fixed';
      button.style.top = `${position.top}px`;
      button.style.right = `${position.right}px`;
      button.style.zIndex = `${position.zIndex}`;
      button.style.backgroundColor = position.backgroundColor;
    } else {
      // Reset to normal positioning
      button.style.position = 'absolute';
      button.style.top = `${position.top}px`;
      button.style.right = `${position.right}px`;
      button.style.zIndex = `${position.zIndex}`;
      button.style.backgroundColor = position.backgroundColor;
    }
  }, [isFullscreen]);

  // Function to toggle custom DOM fullscreen
  const toggleCustomFullscreen = () => {
    if (!playerContainerRef.current) return

    if (!isFullscreen) {
      // Use the browser's standard fullscreen API to get true fullscreen
      try {
        if (playerContainerRef.current.requestFullscreen) {
          playerContainerRef.current.requestFullscreen();
        } else if ((playerContainerRef.current as any).mozRequestFullScreen) { // Firefox
          (playerContainerRef.current as any).mozRequestFullScreen();
        } else if ((playerContainerRef.current as any).webkitRequestFullscreen) { // Chrome, Safari, Opera
          (playerContainerRef.current as any).webkitRequestFullscreen();
        } else if ((playerContainerRef.current as any).msRequestFullscreen) { // IE/Edge
          (playerContainerRef.current as any).msRequestFullscreen();
        }
        
        // Add YouTube element blockers after a short delay to ensure fullscreen is active
        setTimeout(() => {
          addYouTubeBlockers();
          
          // Force Plyr controls to be visible and interactive
          const plyrControls = document.querySelectorAll('.plyr__controls');
          plyrControls.forEach(control => {
            if (control instanceof HTMLElement) {
              control.style.zIndex = '100000';
              control.style.opacity = '1';
              control.style.visibility = 'visible';
              control.style.bottom = '0';
              control.style.marginBottom = '0';
              control.style.width = '100%';
            }
          });
        }, 200);
        
        setIsFullscreen(true);
      } catch (err) {
        console.error("Error attempting to enable fullscreen:", err);
      }
    } else {
      // Exit fullscreen using the browser's API
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).mozCancelFullScreen) { // Firefox
          (document as any).mozCancelFullScreen();
        } else if ((document as any).webkitExitFullscreen) { // Chrome, Safari, Opera
          (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) { // IE/Edge
          (document as any).msExitFullscreen();
        }
        
        setIsFullscreen(false);
      } catch (err) {
        console.error("Error attempting to exit fullscreen:", err);
      }
    }
  }
  
  // Listen for fullscreen changes from any source (our button or browser controls)
  useEffect(() => {
    if (!isClient) return;
    
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = Boolean(
        document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        (document as any).mozFullScreenElement || 
        (document as any).msFullscreenElement
      );
      
      setIsFullscreen(isCurrentlyFullscreen);
      
      if (isCurrentlyFullscreen) {
        addYouTubeBlockers();
        
        // Add CSS to ensure controls are visible and properly positioned in fullscreen
        const fullscreenStyle = document.createElement('style');
        fullscreenStyle.id = 'custom-fullscreen-style';
        fullscreenStyle.textContent = `
          /* Position the controls at the very bottom of the screen */
          .plyr__controls {
            z-index: 100000 !important;
            opacity: 1 !important;
            visibility: visible !important;
            display: flex !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            padding: 15px 10px !important;
            margin: 0 !important;
            background: rgba(0, 0, 0, 0.6) !important;
            transform: none !important;
          }
          
          /* Fix individual controls positioning and interaction */
          .plyr__control {
            pointer-events: auto !important;
            opacity: 1 !important;
            position: relative !important;
            margin: 0 3px !important;
          }
          
          .plyr--full-ui input[type=range] {
            pointer-events: auto !important;
          }
          
          /* Ensure time display is visible */
          .plyr__time {
            display: inline-block !important;
            opacity: 1 !important;
          }
          
          /* Make progress bar interactive and properly sized */
          .plyr__progress {
            pointer-events: auto !important;
            flex-grow: 1 !important;
            margin: 0 10px !important;
          }
          
          /* Make volume control visible */
          .plyr__volume {
            display: inline-flex !important;
          }
          
          /* Make sure YouTube elements stay hidden */
          .ytp-youtube-button, 
          .ytp-watermark,
          .ytp-share-button-visible,
          .ytp-chrome-top-buttons {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
          }
          
          /* Hide native YouTube controls completely */
          .ytp-chrome-bottom {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
          }
          
          /* Center the video in fullscreen mode and make it take full width */
          :fullscreen .plyr__video-wrapper {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            height: 100% !important;
          }
          
          /* Ensure iframe takes full width in fullscreen */
          :fullscreen iframe {
            width: 100% !important;
            max-width: 100% !important;
          }
          
          /* Ensure video wrapper takes full width in fullscreen */
          :fullscreen .video-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
        `;
        document.head.appendChild(fullscreenStyle);
      } else {
        removeYouTubeBlockers();
        
        // Remove custom fullscreen styles
        const fullscreenStyle = document.getElementById('custom-fullscreen-style');
        if (fullscreenStyle) {
          document.head.removeChild(fullscreenStyle);
        }
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isClient]);

  // Function to add blockers for YouTube branding and copy link button
  const addYouTubeBlockers = () => {
    // Remove any existing blockers first
    removeYouTubeBlockers()
    
    // YouTube logo blocker (bottom right)
    const bottomBlocker = document.createElement('div')
    bottomBlocker.id = 'custom-fs-youtube-blocker-bottom'
    bottomBlocker.style.position = 'fixed'
    bottomBlocker.style.bottom = '0'
    bottomBlocker.style.right = '0'
    bottomBlocker.style.width = '100px'
    bottomBlocker.style.height = '50px'
    bottomBlocker.style.backgroundColor = 'black'
    bottomBlocker.style.zIndex = '99999'
    bottomBlocker.style.pointerEvents = 'none'
    document.body.appendChild(bottomBlocker)
    
    // Copy link blocker (top right)
    const topBlocker = document.createElement('div')
    topBlocker.id = 'custom-fs-youtube-blocker-top'
    topBlocker.style.position = 'fixed'
    topBlocker.style.top = '0'
    topBlocker.style.right = '0'
    topBlocker.style.width = '100px'
    topBlocker.style.height = '50px'
    topBlocker.style.backgroundColor = 'black'
    topBlocker.style.zIndex = '99999'
    topBlocker.style.pointerEvents = 'none'
    document.body.appendChild(topBlocker)
  }
  
  // Function to remove YouTube element blockers
  const removeYouTubeBlockers = () => {
    const bottomBlocker = document.getElementById('custom-fs-youtube-blocker-bottom')
    const topBlocker = document.getElementById('custom-fs-youtube-blocker-top')
    
    if (bottomBlocker) document.body.removeChild(bottomBlocker)
    if (topBlocker) document.body.removeChild(topBlocker)
  }
  
  // Clean up event listeners and blockers when component unmounts
  useEffect(() => {
    return () => {
      removeYouTubeBlockers()
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

  // Common fullscreen button position
  const position = isFullscreen ? buttonPositions.fullscreen : buttonPositions.normal;

  // Full screen button component
  const FullscreenButton = () => (
    <Button 
      ref={fullscreenButtonRef}
      onClick={toggleCustomFullscreen}
      className={`absolute p-3 rounded-lg shadow-lg z-${position.zIndex}`}
      style={{ 
        top: `${position.top}px`, 
        right: `${position.right}px`,
        backgroundColor: position.backgroundColor
      }}
      size="sm"
      variant="ghost"
    >
      {isFullscreen ? 
        <Minimize2 size={position.size} className={position.iconColor} /> : 
        <Maximize2 size={position.size} className={position.iconColor} />
      }
    </Button>
  );

  // Handle Odysee videos
  if (videoSource === 'ODYSEE' && claimId) {
    console.log("[VideoPlayer] Rendering Odysee player with claim ID:", claimId);
    return (
      <div ref={playerContainerRef} className="relative video-container w-full">
        <FullscreenButton />
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
        <FullscreenButton />
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
        <FullscreenButton />
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
    const position = isFullscreen ? buttonPositions.fullscreen : buttonPositions.normal;
    
    return (
      <div ref={playerContainerRef} className="relative video-container w-full">
        {/* Fullscreen button with dynamic positioning */}
        <Button 
          ref={fullscreenButtonRef}
          onClick={toggleCustomFullscreen}
          className={`absolute p-3 rounded-lg shadow-lg z-${position.zIndex}`}
          style={{ 
            top: `${position.top}px`, 
            right: `${position.right}px`,
            backgroundColor: position.backgroundColor
          }}
          size="sm"
          variant="ghost"
        >
          {isFullscreen ? 
            <Minimize2 size={position.size} className={position.iconColor} /> : 
            <Maximize2 size={position.size} className={position.iconColor} />
          }
        </Button>
        
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
