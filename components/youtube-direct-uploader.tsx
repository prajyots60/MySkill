"use client"

import React, { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { FileVideo, Upload, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useCourseStore } from "@/lib/store/course-store"
import { v4 as uuidv4 } from "uuid"

// Helper function to convert Blob to base64 string
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64String = reader.result as string
      const base64Data = base64String.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

interface YouTubeDirectUploaderProps {
  courseId?: string
  sectionId: string
  title: string
  description?: string
  isPreview?: boolean
  file: File
  onUploadComplete?: (lectureId: string, videoId: string) => void
  onUploadError?: (error: Error) => void
  onUploadStart?: () => void
  onUploadProgress?: (progress: number) => void
}

const CHUNK_SIZE = 1024 * 1024 * 5 // 5MB chunks

export default function YouTubeDirectUploader({
  sectionId,
  title,
  description = "",
  isPreview = false,
  file,
  onUploadComplete,
  onUploadError,
  onUploadStart,
  onUploadProgress
}: YouTubeDirectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadPhase, setUploadPhase] = useState<'preparing' | 'uploading' | 'processing' | 'finalizing'>('preparing')
  const uploadRef = useRef<{ abort: () => void } | null>(null)
  const { addUpload, updateUploadProgress, updateUploadStatus } = useCourseStore()

  const handleUpload = useCallback(async () => {
    if (!file || !sectionId || !title) {
      toast({
        title: "Missing Information",
        description: "Please provide title, section, and video file",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUploading(true)
      setUploadProgress(0)
      setUploadPhase('preparing')

      // Generate a unique ID for tracking this upload
      const uploadId = uuidv4()
      addUpload({
        id: uploadId,
        type: "lecture",
        title,
      })

      if (onUploadStart) {
        onUploadStart()
      }

      // Step 1: Get upload URL from our server
      setUploadPhase('preparing')
      updateUploadProgress(uploadId, 10)
      const tokenResponse = await fetch("/api/creator/lectures/youtube-direct-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          description,
          isPrivate: true
        })
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json()
        throw new Error(error.message || "Failed to prepare upload")
      }

      const { uploadUrl, access_token } = await tokenResponse.json()

      // Step 2: Upload the file directly to YouTube in chunks
      setUploadPhase('uploading')
      updateUploadProgress(uploadId, 20)

      const fileSize = file.size
      let start = 0
      let end = Math.min(CHUNK_SIZE, fileSize)
      let chunkNumber = 0
      let videoId: string | null = null

      // Allow aborting the upload
      const abortController = new AbortController()
      uploadRef.current = {
        abort: () => abortController.abort()
      }

      while (start < fileSize) {
        // Prepare the chunk
        const chunk = file.slice(start, end)
        const chunkSize = end - start
        
        // Calculate content range header
        const contentRange = `bytes ${start}-${end - 1}/${fileSize}`
        
        try {
          // Use the proxy approach to avoid CORS issues
          // Create a FormData object to send binary data efficiently
          const formData = new FormData()
          formData.append('chunk', chunk) // Send raw binary data
          
          // Use our proxy API to avoid CORS
          const uploadChunkResponse = await fetch("/api/creator/lectures/youtube-proxy-upload", {
            method: "POST",
            headers: {
              // No need for Content-Type here, it'll be set automatically with multipart/form-data boundary
            },
            body: JSON.stringify({
              uploadUrl,
              contentRange,
              contentType: file.type,
              accessToken: access_token,
              // Convert chunk to base64 for JSON transport
              chunk: await blobToBase64(chunk)
            })
          })

          if (!uploadChunkResponse.ok) {
            const errorData = await uploadChunkResponse.json()
            throw new Error(errorData.message || "Failed to upload chunk")
          }

          // Get the proxy response which contains YouTube's response
          const proxyResponse = await uploadChunkResponse.json()
          const responseStatus = proxyResponse.status
          console.log(`Chunk ${chunkNumber} upload status:`, responseStatus)
          
          // Extract the response data
          const responseData = proxyResponse.data
          const responseText = proxyResponse.text
          
          // For the final chunk, we get back the video ID
          if (responseStatus === 200 || responseStatus === 201) {
            console.log("Final chunk upload completed successfully")
            let foundVideoId = null
            
            // Check if we have JSON data from the response
            if (responseData && responseData.id) {
              foundVideoId = responseData.id
              console.log("Found video ID in JSON response:", foundVideoId)
            } 
            // Otherwise check the text response
            else if (responseText) {
              console.log("Parsing response text for video ID")
              // Try different regex patterns to extract video ID
              let idMatch = responseText.match(/"id"\s*:\s*"([^"]+)"/)
              if (idMatch && idMatch[1]) {
                foundVideoId = idMatch[1]
                console.log("Extracted video ID (pattern 1):", foundVideoId)
              } else {
                // Try alternative formats
                idMatch = responseText.match(/videoId.*?:.*?['"](.*?)['"]/i)
                if (idMatch && idMatch[1]) {
                  foundVideoId = idMatch[1]
                  console.log("Extracted video ID (pattern 2):", foundVideoId)
                } else {
                  // Look for any 11-character ID that looks like a YouTube ID
                  idMatch = responseText.match(/[a-zA-Z0-9_-]{11}/)
                  if (idMatch && idMatch[0]) {
                    foundVideoId = idMatch[0]
                    console.log("Extracted video ID (pattern 3):", foundVideoId)
                  }
                }
              }
            }
            
            if (foundVideoId) {
              videoId = foundVideoId
              console.log("Successfully obtained YouTube video ID:", videoId)
            } else {
              console.error("Could not extract YouTube video ID from response")
              throw new Error("Could not extract YouTube video ID from upload response")
            }
            
            break
          }
        } catch (error) {
          console.error(`Error uploading chunk ${chunkNumber}:`, error)
          throw error
        }

        // Update progress
        start = end
        end = Math.min(start + CHUNK_SIZE, fileSize)
        chunkNumber++
        
        const progress = Math.round((start / fileSize) * 70) + 20
        setUploadProgress(progress)
        if (onUploadProgress) {
          onUploadProgress(progress)
        }
        updateUploadProgress(uploadId, progress)
      }

      if (!videoId) {
        throw new Error("Failed to get video ID from YouTube")
      }

      // Step 3: Register the uploaded video with our system
      setUploadPhase('finalizing')
      updateUploadProgress(uploadId, 90)
      setUploadProgress(90)
      if (onUploadProgress) {
        onUploadProgress(90)
      }

      // Log the data we're about to send to the completion API
      console.log("Sending to completion API:", {
        videoId,
        sectionId,
        title,
        description,
        isPreview,
        uploadJobId: uploadId
      });

      const completeResponse = await fetch("/api/creator/lectures/youtube-direct-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          videoId,
          sectionId,
          title,
          description,
          isPreview,
          uploadJobId: uploadId
        })
      });

      // Log full response details
      const responseText = await completeResponse.text();
      console.log("Completion API response status:", completeResponse.status);
      console.log("Completion API response:", responseText);
      
      // Parse the response text to JSON if possible
      let completeData;
      try {
        completeData = JSON.parse(responseText);
        if (!completeResponse.ok) {
          throw new Error(completeData.message || "Failed to finalize upload");
        }
      } catch (error) {
        console.error("Error parsing completion response:", error);
        throw new Error("Failed to register video metadata in database: " + responseText);
      }

      // Upload complete
      setUploadProgress(100)
      updateUploadProgress(uploadId, 100)
      updateUploadStatus(uploadId, "completed")
      if (onUploadProgress) {
        onUploadProgress(100)
      }

      toast({
        title: "Upload Complete",
        description: "Video has been uploaded successfully"
      })

      if (onUploadComplete) {
        onUploadComplete(completeData.lecture.id, videoId)
      }
    } catch (error) {
      console.error("Upload error:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to upload video"
      
      // Show a more helpful message for YouTube upload limit errors
      if (errorMessage.includes("upload limit exceeded")) {
        toast({
          title: "YouTube Upload Limit Exceeded",
          description: "Your YouTube account has reached its upload quota. You may need to wait 24 hours or use a different YouTube account.",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Upload Failed",
          description: errorMessage,
          variant: "destructive"
        })
      }

      if (onUploadError && error instanceof Error) {
        onUploadError(error)
      }
    } finally {
      setIsUploading(false)
      uploadRef.current = null
    }
  }, [
    file, 
    sectionId, 
    title, 
    description, 
    isPreview, 
    addUpload, 
    updateUploadProgress, 
    updateUploadStatus, 
    onUploadComplete, 
    onUploadError, 
    onUploadStart, 
    onUploadProgress
  ])

  // Handle canceling upload
  const handleCancel = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort()
      setIsUploading(false)
      
      toast({
        title: "Upload Canceled",
        description: "The video upload has been canceled"
      })
    }
  }, [])

  // Get current phase description
  const getPhaseDescription = () => {
    switch (uploadPhase) {
      case 'preparing':
        return 'Preparing upload...'
      case 'uploading':
        return `Uploading to YouTube... ${uploadProgress}%`
      case 'processing':
        return 'Processing video...'
      case 'finalizing':
        return 'Finalizing upload...'
      default:
        return 'Uploading...'
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        {!isUploading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileVideo className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)} • {file.type}
                </p>
              </div>
            </div>
            
            <Button 
              onClick={handleUpload} 
              className="w-full"
              disabled={isUploading || !file}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload to YouTube
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm font-medium">{getPhaseDescription()}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancel}
                disabled={uploadPhase === 'finalizing'}
              >
                Cancel
              </Button>
            </div>
            
            <Progress value={uploadProgress} />
            
            {uploadPhase === 'uploading' && (
              <p className="text-xs text-muted-foreground">
                Uploading to YouTube. Do not close this window.
              </p>
            )}
            
            {uploadPhase === 'finalizing' && (
              <p className="text-xs text-muted-foreground">
                Almost done! Registering video in your course...
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}