"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileVideo,
  Play,
  Clock,
  Lock,
  Eye,
  CheckCircle,
  ExternalLink,
  Radio,
  FileText,
  Copy,
  Trash2,
  Pencil,
  Calendar,
} from "lucide-react"
import type { Lecture } from "@/lib/types"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useCourseStore } from "@/lib/store/course-store"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface LectureCardProps {
  lecture: Lecture
  isCreator: boolean
  courseId: string
  isEnrolled?: boolean
  isFreeCourse?: boolean
  onEdit?: () => void
  onPreview?: () => void
  onDelete?: () => void
}

export function LectureCard({
  lecture,
  isCreator,
  courseId,
  isEnrolled = false,
  isFreeCourse = false,
  onEdit,
  onPreview,
  onDelete,
}: LectureCardProps) {
  const { toast } = useToast()
  const router = useRouter()
  const { handleDeleteLecture } = useCourseStore()
  const [streamDataDialogOpen, setStreamDataDialogOpen] = useState(false)
  const [streamData, setStreamData] = useState<{
    streamId: string
    streamKey: string
    streamUrl: string
    broadcastId: string
  } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Determine if the lecture is accessible - lecture.isPreview should grant access regardless of enrollment status
  const isAccessible = isCreator || lecture.isPreview || isEnrolled || isFreeCourse

  // Handle preview click
  const handlePreview = () => {
    if (!isAccessible) {
      toast({
        title: "Access Denied",
        description: "Please enroll in the course to access this lecture.",
        variant: "destructive",
      })
      return
    }

    if (lecture.type === "LIVE") {
      // Always redirect to player for live lectures, regardless of status
      router.push(`/content/${courseId}/player/${lecture.id}`)

      // Show informational toast based on status
      if (lecture.liveStatus === "SCHEDULED" && lecture.scheduledAt) {
        const scheduledTime = new Date(lecture.scheduledAt)
        if (scheduledTime > new Date()) {
          toast({
            title: "Scheduled Live",
            description: `This live lecture is scheduled for ${scheduledTime.toLocaleString()}`,
          })
        }
      }
    } else {
      router.push(`/content/${courseId}/player/${lecture.id}`)
    }
  }

  // Check if lecture is completed from localStorage
  const isCompleted = () => {
    try {
      const progressData = localStorage.getItem("course-progress")
      if (!progressData) return false

      const courseProgress = JSON.parse(progressData)
      const courseLectures = courseProgress[courseId] || []
      const lectureProgress = courseLectures.find((item: any) => item.lectureId === lecture.id)

      return lectureProgress?.completed || false
    } catch (error) {
      console.error("Error checking completion status:", error)
      return false
    }
  }

  // Get thumbnail URL based on video source
  const getThumbnailUrl = () => {
    // For YouTube videos, use the standard YouTube thumbnail URL
    if (lecture.videoSource === 'YOUTUBE' && lecture.videoId) {
      return `https://img.youtube.com/vi/${lecture.videoId}/mqdefault.jpg`;
    }
    
    // For Odysee videos
    if (lecture.videoSource === 'ODYSEE' && lecture.claimId) {
      // Try to get thumbnail from streamData if available
      if (lecture.streamData && typeof lecture.streamData === 'object') {
        if ('thumbnailUrl' in lecture.streamData && lecture.streamData.thumbnailUrl) {
          return lecture.streamData.thumbnailUrl as string;
        }
      }
      
      // Fallback to a generic thumbnail for Odysee videos
      return "/images/odysee-thumbnail-placeholder.svg";
    }
    
    // Default case: no thumbnail available
    return null;
  }

  const thumbnailUrl = getThumbnailUrl()
  const completed = isCompleted()

  // Function to fetch stream data
  const fetchStreamData = async () => {
    if (!lecture.id) return

    setLoading(true)
    try {
      const response = await fetch(`/api/creator/lectures/${lecture.id}/stream-data`)

      if (!response.ok) {
        throw new Error("Failed to fetch stream data")
      }

      const data = await response.json()

      if (data.success) {
        setStreamData({
          streamId: data.streamId,
          streamKey: data.streamKey,
          streamUrl: data.streamUrl,
          broadcastId: data.broadcastId,
        })
        setStreamDataDialogOpen(true)
      } else {
        throw new Error(data.error || "Failed to fetch stream data")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch stream data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Function to copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    })
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)

      // Use the handleDeleteLecture function from the course store
      const success = await handleDeleteLecture(lecture.id)

      if (success) {
        toast({
          title: "Success",
          description: "Lecture deleted successfully",
        })

        // Call the onDelete callback to update parent state
        if (onDelete) {
          onDelete()
        }

        // Refresh the current route
        router.refresh()
      } else {
        throw new Error("Failed to delete lecture")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete lecture",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  // Add periodic status check for live lectures
  useEffect(() => {
    if (lecture.type === "LIVE" && lecture.liveStatus !== "ENDED") {
      let checkCount = 0
      const maxChecks = 120 // Maximum 1 hour of checks (30s * 120 = 3600s)

      const interval = setInterval(async () => {
        try {
          // Stop checking if we've reached the maximum number of checks
          if (checkCount >= maxChecks) {
            clearInterval(interval)
            return
          }

          const response = await fetch(`/api/creator/lectures/${lecture.id}/status`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
          })

          if (response.ok) {
            const data = await response.json()
            // Stop checking if the stream has ended
            if (data.lecture.liveStatus === "ENDED") {
              clearInterval(interval)
            }
            router.refresh()
          }

          checkCount++
        } catch (error) {
          console.error("Error checking stream status:", error)
          // Stop checking if we encounter errors
          clearInterval(interval)
        }
      }, 90000) // Check every 90 seconds

      return () => clearInterval(interval)
    }
  }, [lecture.id, lecture.type, lecture.liveStatus, router])

  return (
    <>
      <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200 group h-full flex flex-col">
        <div className="relative aspect-video bg-muted/50" onClick={handlePreview}>
          {/* Thumbnail */}
          {thumbnailUrl ? (
            <div className="relative w-full h-full">
              <Image
                src={thumbnailUrl || "/placeholder.svg"}
                alt={lecture.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/5">
              <FileVideo className="h-12 w-12 text-muted-foreground opacity-50" />
            </div>
          )}

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="secondary" size="icon" className="rounded-full h-12 w-12" disabled={!isAccessible}>
              {isAccessible ? <Play className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
            </Button>
          </div>

          {/* Live badge */}
          {lecture.type === "LIVE" && (
            <div className="absolute top-2 left-2 z-20">
              <Badge
                variant="outline"
                className={cn(
                  "flex items-center gap-1.5 text-white px-2.5 py-1 text-xs font-medium shadow-sm",
                  lecture.liveStatus === "LIVE" && "bg-red-500/90 border-red-500",
                  lecture.liveStatus === "SCHEDULED" && "bg-yellow-500/90 border-yellow-500",
                  lecture.liveStatus === "ENDED" && "bg-gray-500/90 border-gray-500",
                  !lecture.liveStatus && "bg-blue-500/90 border-blue-500",
                )}
              >
                <Radio className={cn("h-2.5 w-2.5", lecture.liveStatus === "LIVE" && "animate-pulse")} />
                <span>
                  {lecture.liveStatus === "LIVE" && "Live Now"}
                  {lecture.liveStatus === "SCHEDULED" &&
                    lecture.scheduledAt &&
                    new Date(lecture.scheduledAt) > new Date() &&
                    "Scheduled"}
                  {lecture.liveStatus === "SCHEDULED" &&
                    lecture.scheduledAt &&
                    new Date(lecture.scheduledAt) <= new Date() &&
                    "Starting Soon"}
                  {lecture.liveStatus === "ENDED" && "Ended"}
                  {!lecture.liveStatus && "Not Started"}
                </span>
              </Badge>
            </div>
          )}

          {/* Preview badge */}
          {lecture.isPreview && (
            <div className="absolute top-2 right-2 z-20">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="default" className="flex items-center bg-primary/90 text-white p-1.5 shadow-sm">
                      <Eye className="h-3 w-3" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Preview Available</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* Completed badge */}
          {completed && (
            <div className="absolute top-2 right-2 z-20">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="flex items-center bg-green-500/90 text-white border-green-500 p-1.5 shadow-sm"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Completed</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>

        <CardContent className="p-4 flex-grow flex flex-col">
          <div className="flex flex-col gap-1 flex-grow">
            <h3 className="font-medium line-clamp-1">{lecture.title}</h3>
            {lecture.description && <p className="text-sm text-muted-foreground line-clamp-2">{lecture.description}</p>}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 py-2 px-4 border-t">
          <div className="flex items-start justify-between w-full">
            <div className="flex flex-col gap-1">
              {lecture.type === "LIVE" && lecture.liveStatus === "SCHEDULED" && lecture.scheduledAt && (
                <>
                  <Badge variant="outline" className="flex items-center gap-1 text-xs w-fit">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(lecture.scheduledAt).toLocaleDateString()}</span>
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1 text-xs w-fit">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(lecture.scheduledAt).toLocaleTimeString()}</span>
                  </Badge>
                </>
              )}
              {lecture.documents && lecture.documents.length > 0 && (
                <Badge variant="outline" className="flex items-center gap-1 w-fit">
                  <FileText className="h-3 w-3" />
                  {lecture.documents.length}
                </Badge>
              )}
            </div>

            {lecture.type === "LIVE" && isCreator && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation()
                  fetchStreamData()
                }}
                title="View Stream Data"
              >
                <Radio className="h-4 w-4" />
              </Button>
            )}
          </div>

          {isCreator && (
            <div className="flex items-center justify-center w-full gap-6">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <Link href={`/content/${courseId}/player/${lecture.id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Lecture</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {onEdit && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit()
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edit Lecture</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete Lecture</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Stream Data Dialog */}
      <Dialog open={streamDataDialogOpen} onOpenChange={setStreamDataDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Live Stream Information</DialogTitle>
            <DialogDescription>
              {lecture.liveStatus === "SCHEDULED"
                ? "Save these details for when you're ready to start streaming"
                : "Use these details to connect your streaming software (OBS, Streamlabs, etc.)"}
            </DialogDescription>
          </DialogHeader>

          {streamData && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Stream URL</Label>
                <div className="flex items-center gap-2">
                  <Input value={streamData.streamUrl} readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(streamData.streamUrl)}
                    title="Copy to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Stream Key</Label>
                <div className="flex items-center gap-2">
                  <Input value={streamData.streamKey} readOnly type="password" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(streamData.streamKey)}
                    title="Copy to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Keep this key secret. Anyone with this key can stream to your channel.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Stream ID</Label>
                <div className="flex items-center gap-2">
                  <Input value={streamData.streamId} readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(streamData.streamId)}
                    title="Copy to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Broadcast ID</Label>
                <div className="flex items-center gap-2">
                  <Input value={streamData.broadcastId} readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(streamData.broadcastId)}
                    title="Copy to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {lecture.liveStatus === "SCHEDULED" && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Scheduled Stream</h4>
                  <p className="text-sm text-muted-foreground">
                    This stream is scheduled for {formatDate(lecture.scheduledAt!.toString())}. You can access these
                    stream details anytime before the scheduled time.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setStreamDataDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lecture</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lecture? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
