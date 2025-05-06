"use client"

import { useCourseStore } from "@/lib/store/course-store"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Loader2, FileVideo, FileText, X } from "lucide-react"
import { useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"

export function UploadStatus() {
  const { activeUploads, removeUpload } = useCourseStore()
  const { toast } = useToast()

  // Show completion toast when upload completes
  useEffect(() => {
    activeUploads.forEach((upload) => {
      if (upload.status === "completed") {
        toast({
          title: "Upload Complete",
          description: `${upload.title} has been uploaded successfully.`,
          duration: 5000,
        })
        // Remove the upload after showing the toast
        setTimeout(() => removeUpload(upload.id), 5000)
      } else if (upload.status === "failed") {
        toast({
          title: "Upload Failed",
          description: upload.error || "Failed to upload content. Please try again.",
          variant: "destructive",
          duration: 5000,
        })
        // Remove the failed upload after showing the toast
        setTimeout(() => removeUpload(upload.id), 5000)
      }
    })
  }, [activeUploads, toast, removeUpload])

  // Handle canceling an upload
  const handleCancelUpload = async (uploadId: string) => {
    try {
      // Call the DELETE endpoint to cancel the upload
      const response = await fetch(`/api/creator/lectures/upload?jobId=${uploadId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to cancel upload")
      }

      // Remove the upload from the UI
      removeUpload(uploadId)

      toast({
        title: "Upload Canceled",
        description: "The upload has been canceled successfully.",
        duration: 3000,
      })
    } catch (error) {
      console.error("Error canceling upload:", error)
      toast({
        title: "Error",
        description: "Failed to cancel upload. Please try again.",
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  if (activeUploads.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {activeUploads.map((upload) => (
        <div key={upload.id} className="bg-background border rounded-lg shadow-lg p-4 w-80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {upload.type === "lecture" ? <FileVideo className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              <span className="font-medium truncate">{upload.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {upload.status === "uploading" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {upload.status === "processing" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {upload.status === "completed" && <CheckCircle2 className="h-3 w-3 text-green-500 mr-1" />}
                {upload.status === "failed" && <XCircle className="h-3 w-3 text-red-500 mr-1" />}
                {upload.status.charAt(0).toUpperCase() + upload.status.slice(1)}
              </Badge>
              {(upload.status === "uploading" || upload.status === "processing") && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCancelUpload(upload.id)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <Progress value={upload.progress} className="h-2" />
          <div className="text-xs text-muted-foreground mt-1">{upload.progress}% complete</div>
        </div>
      ))}
    </div>
  )
}
