"use client"

import React from "react"
import { SecureVideoPlayer } from "@/components/secure-video-player"
import { PlyrComponent } from "@/components/plyr-component"

interface VideoPlayerProps {
  lectureId: string
  videoId?: string
  title: string
  courseId: string // Make courseId required
  startPosition?: number
  isCompleted?: boolean
  onComplete?: () => void
  onProgress?: (progress: number) => void
}

function VideoPlayer({
  lectureId,
  videoId,
  title,
  courseId, // Accept courseId 
  startPosition,
  isCompleted,
  onComplete,
  onProgress,
}: VideoPlayerProps) {
  const [isClient, setIsClient] = React.useState(false)

  // Only render on client side
  React.useEffect(() => {
    setIsClient(true)
  }, [])

  React.useEffect(() => {
    console.log("[VideoPlayer] Rendering with courseId:", courseId)
  }, [courseId])

  if (!isClient) {
    return (
      <div className="aspect-video bg-muted rounded-lg animate-pulse">
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-muted-foreground">Loading video player...</p>
        </div>
      </div>
    )
  }

  // Use secure player for course content
  if (lectureId) {
    return (
      <SecureVideoPlayer
        lectureId={lectureId}
        title={title}
        courseId={courseId} // Pass courseId to SecureVideoPlayer
        onEnded={onComplete}
        onProgress={onProgress}
      />
    )
  }

  // Use plyr for external content (YouTube, Vimeo, etc.)
  if (videoId) {
    return (
      <PlyrComponent
        videoId={videoId}
        title={title}
        onEnded={onComplete}
      />
    )
  }

  return <div>No video source provided</div>
}

export default React.memo(VideoPlayer)
