"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { parseOdyseeUrl, getOdyseeEmbedUrl } from '@/lib/odysee-helpers'
// Removed Plyr CSS import as we're using direct iframe approach

interface OdyseePlyrProps {
  url?: string
  claimId?: string
  claimName?: string
  title?: string
  onEnded?: () => void
  onReady?: () => void
  onError?: (error: Error) => void
  autoPlay?: boolean
  customEndScreen?: boolean
  className?: string
}

export function OdyseePlyr({ 
  url,
  claimId, 
  claimName, 
  title = "Odysee Video",
  onEnded,
  onReady,
  onError,
  autoPlay = false,
  customEndScreen = true,
  className = ""
}: OdyseePlyrProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  
  // State for tracking time and displaying custom end screen
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showEndScreen, setShowEndScreen] = useState(false)
  
  // References for tracking play state and time
  const videoStartTime = useRef<number | null>(null)
  const isPaused = useRef<boolean>(true)
  const totalPausedTime = useRef<number>(0)
  const lastPauseTime = useRef<number | null>(null)
  const timeInterval = useRef<NodeJS.Timeout | null>(null)
  const lastTimeUpdate = useRef<number>(0)

  // Function to update current time based on our manual tracking
  const updateManualTime = useCallback(() => {
    if (!videoStartTime.current || isPaused.current) return;
    
    const now = Date.now();
    const elapsedSinceStart = (now - videoStartTime.current) / 1000;
    const adjustedTime = elapsedSinceStart - (totalPausedTime.current / 1000);
    
    // Only update if it's reasonably different from the last time
    if (Math.abs(adjustedTime - lastTimeUpdate.current) > 0.5) {
      setCurrentTime(adjustedTime);
      lastTimeUpdate.current = adjustedTime;
    }
    
    // Check if we're 5 seconds from the end and should show custom end screen
    if (customEndScreen && duration > 0 && (duration - adjustedTime <= 5) && !showEndScreen) {
      console.log("Showing custom end screen - 5 seconds before end", {
        duration,
        adjustedTime,
        timeRemaining: duration - adjustedTime
      });
      if (playerRef.current) {
        // We don't actually pause the video since we can't control the iframe,
        // but we show our overlay on top
        playerRef.current.pause();
      }
      setShowEndScreen(true);
    }
  }, [duration, customEndScreen, showEndScreen]);

  // Setup regular interval to check time
  useEffect(() => {
    if (timeInterval.current) {
      clearInterval(timeInterval.current);
    }
    
    // Create an interval that updates more frequently as we approach the end
    // This ensures more precision with the end screen timing
    timeInterval.current = setInterval(() => {
      // If we're getting close to the end (within 15 seconds), update more frequently
      if (duration > 0 && (duration - currentTime) < 15) {
        if (timeInterval.current) {
          clearInterval(timeInterval.current);
          timeInterval.current = setInterval(() => {
            updateManualTime();
          }, 250); // Update 4 times per second when close to the end
        }
      } else {
        updateManualTime();
      }
    }, 1000);
    
    return () => {
      if (timeInterval.current) {
        clearInterval(timeInterval.current);
      }
    };
  }, [updateManualTime, duration, currentTime]);

  useEffect(() => {
    // Function to get the embed URL
    const getEmbedUrl = () => {
      try {
        if (url) {
          const parsedData = parseOdyseeUrl(url)
          if (parsedData) {
            return parsedData.embedUrl
          }
          throw new Error("Invalid Odysee URL")
        } else if (claimId && claimName) {
          return getOdyseeEmbedUrl(claimName, claimId)
        }
        throw new Error("Either URL or both claimId and claimName must be provided")
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Failed to parse Odysee URL";
        setError(errorMsg)
        onError?.(e instanceof Error ? e : new Error(errorMsg))
        return null
      }
    }

    // Simplified player loader - using direct iframe approach for reliability
    const loadPlayer = async () => {
      try {
        console.log('Starting OdyseePlyr initialization with simplified approach...')
        if (!containerRef.current) {
          console.error('Container ref not available')
          return
        }

        // Get the embed URL
        const embedUrl = getEmbedUrl()
        if (!embedUrl) {
          console.error('Failed to get embed URL')
          return
        }
        
        console.log('Got embed URL:', embedUrl)
        setIsLoading(true)
        
        // Create a clean container for the player
        containerRef.current.innerHTML = ''
        
        // Create a direct iframe for reliability - we'll handle our custom end screen separately
        const iframe = document.createElement('iframe')
        
        // Add autoplay parameter if needed and other parameters to improve playback and control
        const embedUrlWithParams = `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}${autoPlay ? 'autoplay=1' : ''}&api=true&controls=true`
        
        // Configure iframe for proper display
        iframe.src = embedUrlWithParams
        iframe.allowFullscreen = true
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        iframe.style.position = 'absolute'
        iframe.style.top = '0'
        iframe.style.left = '0'
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        iframe.style.border = 'none'
        iframe.style.aspectRatio = '16/9' // Force proper aspect ratio
        iframe.title = title
        iframe.id = `odysee-player-${Date.now()}`
        iframe.setAttribute('allowtransparency', 'true')
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms allow-presentation')
        
        // Disable all external navigation from the iframe
        iframe.addEventListener('load', function() {
          try {
            // Instead of blocking all clicks, we'll let the player work
            console.log('Odysee iframe loaded - enabling player controls');
            
            // Check if the player loaded correctly
            setTimeout(() => {
              try {
                // Create smaller invisible overlays just for the logo/branding areas
                const logoBlocker = document.createElement('div');
                logoBlocker.style.position = 'absolute';
                logoBlocker.style.top = '0';
                logoBlocker.style.right = '0';
                logoBlocker.style.width = '50px';
                logoBlocker.style.height = '50px';
                logoBlocker.style.zIndex = '3';
                logoBlocker.style.pointerEvents = 'auto'; // Block only logo clicks
                
                const nameBlocker = document.createElement('div');
                nameBlocker.style.position = 'absolute';
                nameBlocker.style.top = '0';
                nameBlocker.style.left = '0';
                nameBlocker.style.width = '150px';
                nameBlocker.style.height = '50px';
                nameBlocker.style.zIndex = '3';
                nameBlocker.style.pointerEvents = 'auto'; // Block only name clicks
                
                // Add these specific blockers
                aspectRatioWrapper.appendChild(logoBlocker);
                aspectRatioWrapper.appendChild(nameBlocker);
              } catch (e) {
                console.warn('Failed to create specific blockers:', e);
              }
            }, 1000);
          } catch (e) {
            console.warn('Could not configure iframe after load:', e);
          }
        });
        
        // Create a wrapper with aspect ratio container to ensure proper display
        const aspectRatioWrapper = document.createElement('div');
        aspectRatioWrapper.className = 'aspect-ratio-container';
        aspectRatioWrapper.style.position = 'relative';
        aspectRatioWrapper.style.paddingBottom = '56.25%'; // 16:9 aspect ratio
        aspectRatioWrapper.style.height = '0';
        aspectRatioWrapper.style.overflow = 'hidden';
        
        // Add iframe directly to the container
        aspectRatioWrapper.appendChild(iframe);
        containerRef.current.appendChild(aspectRatioWrapper);
        
        // Store iframe reference
        iframeRef.current = iframe;
        
        // Add a brand blocker overlay to prevent clicks on the top navigation elements
        const brandBlockers = document.createElement('div');
        brandBlockers.className = 'odysee-brand-blockers';
        brandBlockers.style.position = 'absolute';
        brandBlockers.style.top = '0';
        brandBlockers.style.left = '0';
        brandBlockers.style.width = '100%';
        brandBlockers.style.height = '60px'; // Block top navigation bar
        brandBlockers.style.zIndex = '2'; // Lower z-index to not interfere with controls
        brandBlockers.style.pointerEvents = 'none'; // Don't block interaction with video controls
        
        // Add specific logo blockers for top right and top left areas
        const topLeftBlock = document.createElement('div');
        topLeftBlock.className = 'odysee-topleft-blocker';
        topLeftBlock.style.position = 'absolute';
        topLeftBlock.style.top = '0';
        topLeftBlock.style.left = '0';
        topLeftBlock.style.width = '150px';
        topLeftBlock.style.height = '60px';
        topLeftBlock.style.zIndex = '2';
        topLeftBlock.style.pointerEvents = 'none'; // Changed to none to allow controls to work
        
        const topRightBlock = document.createElement('div');
        topRightBlock.className = 'odysee-topright-blocker';
        topRightBlock.style.position = 'absolute';
        topRightBlock.style.top = '0';
        topRightBlock.style.right = '0';
        topRightBlock.style.width = '150px';
        topRightBlock.style.height = '60px';
        topRightBlock.style.zIndex = '2';
        topRightBlock.style.pointerEvents = 'none'; // Changed to none to allow controls to work
        
        // Add the brand blockers to the container
        containerRef.current.appendChild(brandBlockers);
        containerRef.current.appendChild(topLeftBlock);
        containerRef.current.appendChild(topRightBlock);

        // Apply custom CSS to ensure proper display and end screen styling
        const customCSS = `
          .aspect-ratio-container {
            position: relative; 
            padding-bottom: 56.25%;
            height: 0; 
            overflow: hidden;
            max-width: 100%;
            background: #000;
          }
          
          .aspect-ratio-container iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: 0;
          }
          
          .custom-end-screen {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            z-index: 20; /* Higher z-index to ensure it's above all player elements */
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            text-align: center;
            padding: 2rem;
            animation: fadeIn 0.5s ease-in-out;
            pointer-events: all; /* Ensure buttons are clickable */
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .custom-end-screen h2 {
            font-size: 1.8rem;
            margin-bottom: 1.5rem;
            font-weight: bold;
          }
          .custom-end-screen p {
            margin-bottom: 2rem;
            opacity: 0.9;
            font-size: 1.1rem;
            max-width: 80%;
            line-height: 1.5;
          }
          .custom-end-screen-buttons {
            display: flex;
            gap: 1.5rem;
          }
          .custom-end-screen-button {
            background: rgba(26, 175, 255, 0.9);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 500;
            font-size: 1rem;
          }
          .custom-end-screen-button:hover {
            background: rgba(26, 175, 255, 1);
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          }
          .debug-info {
            position: absolute;
            top: 0;
            right: 0;
            background: rgba(0,0,0,0.6);
            color: white;
            padding: 4px 8px;
            font-size: 10px;
            z-index: 100;
          }
          
          /* Odysee brand blocker styles */
          .odysee-brand-blockers {
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            background: transparent;
          }
          .odysee-topleft-blocker,
          .odysee-topright-blocker {
            pointer-events: none;
            background: transparent;
          }
        `
        
        // Add style element to head
        const styleEl = document.createElement('style')
        styleEl.textContent = customCSS
        document.head.appendChild(styleEl)
        
        console.log('Using direct iframe approach instead of Plyr')
        setIsLoading(false)
        
        // Set up manual time tracking
        const startTimeTracking = () => {
          videoStartTime.current = Date.now()
          isPaused.current = false
          totalPausedTime.current = 0
          lastPauseTime.current = null
        }
        
        // Define function to reset time tracking
        const resetTimeTracking = () => {
          videoStartTime.current = Date.now()
          isPaused.current = false
          totalPausedTime.current = 0
          lastPauseTime.current = null
        }

        // Start time tracking when iframe loads
        iframe.onload = () => {
          console.log('Odysee iframe loaded')
          resetTimeTracking()
          
          // Try to load metadata from Odysee
          setTimeout(() => {
            // Attempt to determine video duration through multiple methods
            try {
              // Try to inspect iframe content (may fail due to cross-origin)
              if (iframe.contentWindow && iframe.contentWindow.document) {
                const videoElement = iframe.contentWindow.document.querySelector('video');
                if (videoElement) {
                  setDuration(videoElement.duration);
                  console.log('Got video duration from iframe:', videoElement.duration);
                }
              }
            } catch (e) {
              console.log('Unable to access iframe content due to cross-origin policy');
            }
            
            // If duration is still 0, use a reasonable default (for our end screen timing)
            if (duration === 0) {
              // Fallback to estimating - typically videos are 5-15 minutes
              const estimatedDuration = 600; // 10 minutes as fallback
              console.log('Using estimated duration:', estimatedDuration);
              setDuration(estimatedDuration);
            }
          }, 2000); // Wait 2 seconds after load to try to get metadata
          
          // Store a simple player reference for our custom controls
          playerRef.current = {
            play: () => {
              try {
                if (iframeRef.current) {
                  // Send a postMessage to try to play the video
                  iframeRef.current.contentWindow?.postMessage({ action: 'play' }, '*');
                  // Also try focusing which might trigger autoplay
                  iframeRef.current.focus();
                  isPaused.current = false;
                }
              } catch (e) {
                console.warn('Error playing iframe:', e);
              }
            },
            pause: () => {
              try {
                if (iframeRef.current) {
                  // Send a postMessage to try to pause the video
                  iframeRef.current.contentWindow?.postMessage({ action: 'pause' }, '*');
                }
              } catch (e) {
                console.warn('Error pausing iframe:', e);
              }
              
              // Track pause state manually
              isPaused.current = true;
              if (lastPauseTime.current === null) {
                lastPauseTime.current = Date.now();
              }
            },
            restart: () => {
              if (iframeRef.current) {
                // Reload the iframe to restart the video
                const currentSrc = iframeRef.current.src;
                iframeRef.current.src = currentSrc;
                resetTimeTracking();
              }
            }
          }
          
          setIsLoading(false)
          setPlayerReady(true)
          onReady?.()
        }
        
        // Add message event listener to try to capture video events
        const messageHandler = (event) => {
          // Try to detect video play/pause events from Odysee
          try {
            if (event.data && typeof event.data === 'object') {
              // Log received messages for debugging
              if (process.env.NODE_ENV === 'development') {
                console.log('Message from iframe:', event.data);
              }
              
              // Check for play event patterns
              if (event.data.event === 'play' || 
                  (event.data.info && event.data.info.playerState === 'playing')) {
                isPaused.current = false
                if (lastPauseTime.current) {
                  totalPausedTime.current += Date.now() - lastPauseTime.current
                  lastPauseTime.current = null
                }
              }
              
              // Check for pause event patterns
              if (event.data.event === 'pause' || 
                  (event.data.info && event.data.info.playerState === 'paused')) {
                isPaused.current = true
                lastPauseTime.current = Date.now()
              }
              
              // Check for ended event patterns
              if (event.data.event === 'ended' || 
                  (event.data.info && event.data.info.playerState === 'ended')) {
                if (customEndScreen) {
                  setShowEndScreen(true)
                }
                onEnded?.()
              }
              
              // Try to capture time updates
              if (event.data.currentTime && !isNaN(event.data.currentTime)) {
                setCurrentTime(event.data.currentTime);
                
                // Also check if we should show end screen
                if (customEndScreen && 
                    event.data.duration && 
                    !isNaN(event.data.duration) && 
                    event.data.duration > 0 && 
                    (event.data.duration - event.data.currentTime <= 5) && 
                    !showEndScreen) {
                  console.log("Showing custom end screen from postMessage time", {
                    messageDuration: event.data.duration,
                    messageCurrentTime: event.data.currentTime,
                    timeRemaining: event.data.duration - event.data.currentTime
                  });
                  setShowEndScreen(true);
                }
              }
              
              // Update duration if available
              if (event.data.duration && !isNaN(event.data.duration) && event.data.duration > 0) {
                setDuration(event.data.duration);
              }
            }
          } catch (e) {
            console.warn('Error handling iframe message:', e)
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Return cleanup function
        return () => {
          window.removeEventListener('message', messageHandler);
        };

      } catch (err) {
        console.error("Error initializing Odysee player:", err);
        setIsLoading(false);
        setError('Failed to initialize player: ' + (err instanceof Error ? err.message : String(err)));
        onError?.(err instanceof Error ? err : new Error('Failed to initialize player'));
      }
    }

    // Run the player initialization
    loadPlayer()

    // Cleanup
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch (e) {
          console.warn('Error destroying player on cleanup:', e)
        }
        playerRef.current = null
      }
      if (timeInterval.current) {
        clearInterval(timeInterval.current);
      }
    }
  }, [url, claimId, claimName, title, onEnded, onError, onReady, autoPlay, customEndScreen])

  // Helper functions for custom end screen
  const handleContinue = () => {
    setShowEndScreen(false);
    if (playerRef.current) {
      // Let the video continue
      isPaused.current = false;
      if (lastPauseTime.current) {
        totalPausedTime.current += Date.now() - lastPauseTime.current;
        lastPauseTime.current = null;
      }
    }
    onEnded?.();
  }

  const handleRestart = () => {
    setShowEndScreen(false);
    if (playerRef.current) {
      playerRef.current.restart();
    }
    // Reset time tracking
    if (videoStartTime.current) {
      videoStartTime.current = Date.now();
      totalPausedTime.current = 0;
      lastPauseTime.current = null;
      isPaused.current = false;
    }
    setCurrentTime(0);
  }

  // Calculate time remaining
  const remainingTime = Math.max(0, duration - currentTime);
  const formattedRemaining = isFinite(remainingTime) ? 
    `${Math.floor(remainingTime / 60)}:${Math.floor(remainingTime % 60).toString().padStart(2, '0')}` : '0:00';      const [showDebug, setShowDebug] = useState(false);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="ml-2 text-sm">Loading video...</p>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 p-4 z-10">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-10 w-10 text-red-500 mb-2" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <h3 className="text-lg font-semibold text-center">Video Error</h3>
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      )}
      
      {/* Custom end screen */}
      {customEndScreen && showEndScreen && (
        <div className="custom-end-screen" style={{ pointerEvents: "auto" }}>
          <h2>Thank You for Watching!</h2>
          <p>We hope you enjoyed this video and found it valuable. If you have any questions or want to learn more, check out our other resources below.</p>
          <div className="custom-end-screen-buttons">
            <button className="custom-end-screen-button" onClick={handleContinue}>
              Continue
            </button>
            <button className="custom-end-screen-button" onClick={handleRestart}>
              Watch Again
            </button>
          </div>
        </div>
      )}
      
      {/* Debug timer information - can be toggled for troubleshooting */}
      <button 
        onClick={() => setShowDebug(!showDebug)} 
        className="absolute top-0 right-0 bg-black/50 text-white text-xs p-1 z-50"
        style={{ fontSize: '10px' }}
      >
        DBG
      </button>
      
      {showDebug && (
        <div className="absolute top-0 left-0 bg-black/70 text-white p-2 z-50 text-xs">
          Time: {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / 
          {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')} 
          (Remaining: {formattedRemaining})
          <br />
          Player: {playerRef.current ? 'Initialized' : 'Not initialized'}
          <br />
          Controls: {playerRef.current?.elements?.controls ? 'Found' : 'Missing'}
        </div>
      )}
      
      <div
        ref={containerRef}
        className="w-full h-full odysee-player plyr-wrapper"
        style={{ 
          position: 'relative', 
          overflow: 'hidden', 
          background: '#000',
          minHeight: '240px'  // Ensure minimum height for controls to display properly
        }}
      ></div>
    </div>
  )
}