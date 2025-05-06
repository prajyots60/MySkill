"use client"

import { useEffect, useRef } from "react"
import "plyr/dist/plyr.css"

interface PlyrComponentProps {
  videoId: string
  title: string
  onEnded?: () => void
}

export function PlyrComponent({ videoId, title, onEnded }: PlyrComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)

  useEffect(() => {
    // Import Plyr dynamically to avoid SSR issues
    const loadPlyr = async () => {
      try {
        if (!containerRef.current) return

        const Plyr = (await import("plyr")).default

        // Clean up any existing player
        if (playerRef.current) {
          playerRef.current.destroy()
        }

        // Create YouTube player with custom options
        const player = new Plyr(containerRef.current, {
          
          autoplay: false,
          seekTime: 10,
          controls: ["play-large", "play", "progress", "current-time", "mute", "volume", "settings", "fullscreen"],
          settings: ["captions", "quality", "speed"],
          youtube: {
            noCookie: true,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            customControls: true,
            origin: window.location.origin,
            playsinline: 1,
          },
          blankVideo: "about:blank",
          disableContextMenu: true,
          hideControls: false,
        })

        // Add event listeners
        player.on("ready", () => {
          console.log("Player ready")
        })

        player.on("error", (event: any) => {
          console.error("Player error:", event)
        })

        player.on("ended", () => {
          console.log("Video ended")
          if (onEnded) onEnded()
        })

        playerRef.current = player

        // Apply custom CSS to hide YouTube branding
        const iframe = containerRef.current.querySelector("iframe")
        if (iframe) {
          iframe.style.pointerEvents = "none" // Prevent clicks on YouTube elements
        }
      } catch (err) {
        console.error("Error initializing player:", err)
      }
    }

    loadPlyr()

    // Cleanup
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [videoId, title, onEnded])

  return (
    <div
      ref={containerRef}
      data-plyr-provider="youtube"
      data-plyr-embed-id={videoId}
      className="w-full h-full no-download-video"
    ></div>
  )
}
