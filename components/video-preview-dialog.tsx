"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { VideoPlayer } from "@/components/video-player"
import type { Lecture } from "@/lib/types"

interface VideoPreviewDialogProps {
  lecture: Lecture | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VideoPreviewDialog({ lecture, open, onOpenChange }: VideoPreviewDialogProps) {
  if (!lecture) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden bg-black">
        <DialogHeader className="p-4 bg-background">
          <DialogTitle>{lecture.title}</DialogTitle>
        </DialogHeader>

        <div className="aspect-video">
          {lecture.videoId && (
            <VideoPlayer lectureId={lecture.id} title={lecture.title} onEnded={() => onOpenChange(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
