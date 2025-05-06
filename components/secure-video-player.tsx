"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { trackVideoPerformance, PERFORMANCE_MONITORING_CONFIG } from "@/lib/utils/performance-monitor"
import { useVideoProgress } from "@/hooks/use-video-progress"

interface SecureVideoPlayerProps {
  lectureId: string
  title: string
  courseId?: string // Add courseId prop
  onEnded?: () => void
  onProgress?: (progress: number) => void
}

export function SecureVideoPlayer({ 
  lectureId, 
  title, 
  courseId,  // Add courseId to props
  onEnded, 
  onProgress 
}: SecureVideoPlayerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [secureUrl, setSecureUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerReadyRef = useRef(false)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const lastTimeRef = useRef<number>(0)
  
  // Initialize video progress tracking if courseId is provided
  // Force courseId to be required
  let videoProgress = null;
  if (courseId) {
    videoProgress = useVideoProgress(courseId, lectureId);
  } else {
    console.error("SecureVideoPlayer: courseId is required");
  }

  // Track whether video has started playing
  const hasStartedPlayingRef = useRef(false)
  // Store last progress update time to limit frequency
  const lastProgressUpdateRef = useRef(Date.now())
  // Track video duration
  const videoDurationRef = useRef(0)

  // Debug flags
  const [debugMessage, setDebugMessage] = useState<string | null>(null)

  const keyboardShortcuts = [
    { key: "←", description: "Rewind 10 seconds" },
    { key: "→", description: "Forward 10 seconds" },
    { key: "[", description: "Decrease speed" },
    { key: "]", description: "Increase speed" },
    { key: "Space", description: "Play/Pause" },
    { key: "M", description: "Mute/Unmute" },
    { key: "F", description: "Fullscreen" },
  ]

  const playerOptions = {
    controls: ["play-large", "play", "progress", "current-time", "mute", "volume", "fullscreen"],
    youtube: {
      enableLowLatency: true,
      autoplay: 1,
      mute: 0,
      preload: "auto",
      quality: "hd1080",
      vq: "hd1080",
      noCookie: true,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      playsinline: 1,
      disablekb: 1,
      controls: 0,
      origin: window.location.origin,
      enablejsapi: 1,
      fs: 0,
      cc_load_policy: 0,
    },
    disableContextMenu: true,
    hideControls: false,
    clickToPlay: true,
    keyboard: {
      focused: true,
      global: false,
    },
    resetOnEnd: true,
    loadSprite: false,
    tooltips: {
      controls: true,
      seek: true,
    },
  }

  // Step 1: Fetch secure video token
  useEffect(() => {
    const fetchSecureToken = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log("Fetching token for lecture:", lectureId)
        const response = await fetch(`/api/video/token?lectureId=${lectureId}`, {
          headers: { "Cache-Control": "no-cache" },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `Failed to get video access (${response.status})`)
        }

        const data = await response.json()
        if (!data.token) {
          throw new Error("Invalid video token received")
        }

        console.log("Token received successfully")

        // Set the secure URL that will be used by the iframe
        setSecureUrl(`/api/video/secure?token=${data.token}`)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching video token:", error)
        setError(error instanceof Error ? error.message : "Failed to load video")
        setLoading(false)
      }
    }

    fetchSecureToken()
  }, [lectureId])

  // Step 2: Handle messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) {
        console.log("Ignored message from different origin:", event.origin)
        return
      }

      if (event.data && event.data.event) {
        console.log("Received player event:", event.data.event, event.data)

        switch (event.data.event) {
          case "playerReady":
            playerReadyRef.current = true
            // Set playback position if we have a saved position
            if (videoProgress?.lastPosition && videoProgress.lastPosition > 0) {
              const iframe = iframeRef.current
              if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage(
                  { action: "seekTo", time: videoProgress.lastPosition },
                  window.location.origin
                )
              }
            }
            break;
          case "videoEnded":
            if (onEnded) {
              onEnded()
            }
            // Mark as completed in progress tracker
            if (videoProgress) {
              videoProgress.markAsCompleted()
              setDebugMessage("Video ended, marked as completed")
            }
            break;
          case "timeUpdate":
            // Store the duration whenever we receive it
            if (event.data.duration && event.data.duration > 0) {
              videoDurationRef.current = event.data.duration
            }
            
            if (typeof event.data.currentTime === 'number') {
              // Set flag that video has started playing
              if (!hasStartedPlayingRef.current && event.data.currentTime > 0) {
                hasStartedPlayingRef.current = true
              }
              
              lastTimeRef.current = event.data.currentTime
              
              // Don't update progress too frequently (limit to once per second)
              const now = Date.now()
              if (now - lastProgressUpdateRef.current > 1000) {
                lastProgressUpdateRef.current = now
                
                if (videoDurationRef.current > 0) {
                  const percentComplete = Math.floor((event.data.currentTime / videoDurationRef.current) * 100)
                  
                  // Update parent component via callback if provided
                  if (onProgress) {
                    onProgress(percentComplete)
                  }
                  
                  // Log progress for debugging
                  console.log(`[SecureVideoPlayer] Progress update: ${percentComplete}% at ${event.data.currentTime}s of ${videoDurationRef.current}s`)
                  
                  // Update progress tracker if available
                  if (videoProgress && hasStartedPlayingRef.current) {
                    setDebugMessage(`Updating progress: ${percentComplete}%`)
                    videoProgress.updateProgress(percentComplete, event.data.currentTime)
                  }
                }
              }
            }
            break;
          case "videoPlayed":
            setDebugInfo("Video playing")
            break;
          case "videoPaused":
            setDebugInfo("Video paused")
            // Record progress when paused
            if (videoProgress && videoDurationRef.current > 0 && lastTimeRef.current > 0) {
              const pauseProgress = Math.floor((lastTimeRef.current / videoDurationRef.current) * 100)
              videoProgress.updateProgress(pauseProgress, lastTimeRef.current)
              setDebugMessage(`Paused, updating progress: ${pauseProgress}%`)
            }
            break;
          case "playerError":
            setError(`Player error: ${event.data.message || "Unknown error"}`)
            break;
          case "speedChange":
            setPlaybackSpeed(event.data.speed)
            localStorage.setItem("preferred-speed", event.data.speed.toString())
            break;
          case "seeking":
            lastTimeRef.current = event.data.currentTime
            break;
          case "durationChange": 
            // Added explicit duration change event handler
            if (event.data.duration && event.data.duration > 0) {
              videoDurationRef.current = event.data.duration
              setDebugMessage(`Video duration updated: ${event.data.duration}s`)
            }
            break;
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [onEnded, onProgress, videoProgress])

  // Load preferred speed on mount
  useEffect(() => {
    const preferredSpeed = localStorage.getItem("preferred-speed")
    if (preferredSpeed) {
      setPlaybackSpeed(Number.parseFloat(preferredSpeed))
    }
  }, [])

  // Record final progress on unmount
  useEffect(() => {
    return () => {
      if (videoProgress && videoDurationRef.current > 0 && lastTimeRef.current > 0) {
        const finalProgress = Math.floor((lastTimeRef.current / videoDurationRef.current) * 100)
        videoProgress.updateProgress(finalProgress, lastTimeRef.current)
        setDebugMessage(`Unmounting, final progress: ${finalProgress}%`)
      }
    }
  }, [videoProgress])

  // Handle iframe load errors
  const handleIframeError = () => {
    setError("Failed to load secure player")
    setLoading(false)
  }

  // Add video performance monitoring only if enabled
  useEffect(() => {
    if (!PERFORMANCE_MONITORING_CONFIG.enabled) return

    const handleVideoPerformance = () => {
      if (iframeRef.current) {
        const iframe = iframeRef.current
        const player = iframe.contentWindow?.document.querySelector("video")

        if (player) {
          // Track initial load time
          const loadStartTime = performance.now()

          player.addEventListener("loadeddata", () => {
            const loadTime = performance.now() - loadStartTime
            trackVideoPerformance({ loadTime })
          })

          // Track buffering
          let bufferingStartTime: number | null = null

          player.addEventListener("waiting", () => {
            bufferingStartTime = performance.now()
          })

          player.addEventListener("playing", () => {
            if (bufferingStartTime) {
              const bufferingTime = performance.now() - bufferingStartTime
              trackVideoPerformance({ bufferingTime })
              bufferingStartTime = null
            }
          })

          // Track latency with configurable interval
          const trackLatency = () => {
            if (player.readyState >= 2) {
              // HAVE_CURRENT_DATA
              const latency = player.currentTime - (player as any).getStartDate?.() || 0
              trackVideoPerformance({ latency })
            }
          }

          setInterval(trackLatency, PERFORMANCE_MONITORING_CONFIG.batchTimeout)

          // Track quality changes with debounce
          let qualityChangeTimeout: NodeJS.Timeout | null = null
          player.addEventListener("qualitychange", () => {
            if (qualityChangeTimeout) {
              clearTimeout(qualityChangeTimeout)
            }
            qualityChangeTimeout = setTimeout(() => {
              const quality = (player as any).getVideoPlaybackQuality?.()?.quality || "unknown"
              trackVideoPerformance({ quality })
            }, 5000) // Debounce quality changes by 5 seconds
          })
        }
      }
    }

    // Wait for iframe to load
    if (iframeRef.current) {
      iframeRef.current.addEventListener("load", handleVideoPerformance)
    }

    return () => {
      if (iframeRef.current) {
        iframeRef.current.removeEventListener("load", handleVideoPerformance)
      }
    }
  }, [])

  // Initialize a timer to force check progress every 10 seconds
  useEffect(() => {
    if (!videoProgress || !courseId) return
    
    const forceProgressCheck = () => {
      if (videoDurationRef.current > 0 && lastTimeRef.current > 0) {
        const currentProgress = Math.floor((lastTimeRef.current / videoDurationRef.current) * 100)
        videoProgress.updateProgress(currentProgress, lastTimeRef.current)
        setDebugMessage(`Force progress check: ${currentProgress}%`)
      }
    }
    
    const interval = setInterval(forceProgressCheck, 10000)
    return () => clearInterval(interval)
  }, [videoProgress, courseId])

  if (loading) {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading secure video...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center rounded-lg">
        <div className="flex flex-col items-center gap-2 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-black w-full" style={{ paddingTop: '56.25%' }}>
      {secureUrl && (
        <iframe
          ref={iframeRef}
          src={secureUrl}
          className="absolute top-0 left-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title}
          onError={handleIframeError}
        />
      )}
      {(debugInfo || debugMessage) && process.env.NODE_ENV === "development" && (
        <div className="absolute bottom-0 left-0 bg-black/70 text-white text-xs p-1">
          {debugInfo && <div>{debugInfo}</div>}
          {debugMessage && <div className="text-green-400">{debugMessage}</div>}
        </div>
      )}
    </div>
  )
}
