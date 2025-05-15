import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

interface DailymotionUploadProps {
  onUploadComplete: (data: { videoUrl: string; metadata: any }) => void
  onUploadError: (error: string) => void
  metadata?: {
    title?: string;
    description?: string;
    tags?: string;
    private?: boolean;
    is_created_for_kids?: boolean;
    channel?: string;
    published?: boolean;
  }
}

export function DailymotionUpload({ 
  onUploadComplete, 
  onUploadError,
  metadata = {}
}: DailymotionUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

  const uploadVideo = async (file: File) => {
    try {
      setIsUploading(true)
      setUploadProgress(0)

      // Step 1: Get upload URL from Dailymotion
      const uploadUrlResponse = await fetch('/api/dailymotion/upload')
      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json()
        throw new Error(errorData.error || 'Failed to get upload URL')
      }
      const { uploadUrl, progressUrl } = await uploadUrlResponse.json()

      // Step 2: Upload file directly to Dailymotion
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()
      
      // Set up progress tracking
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          setUploadProgress(progress)
        }
      }

      // Create a promise to handle the upload
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              resolve(response)
            } catch (e) {
              reject(new Error('Invalid response from upload'))
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`))
          }
        }
        xhr.onerror = () => reject(new Error('Upload failed'))
      })

      // Start the upload
      xhr.open('POST', uploadUrl)
      xhr.send(formData)

      // Wait for upload to complete
      const uploadResult: any = await uploadPromise
      
      if (!uploadResult.url) {
        throw new Error('No video URL received from upload')
      }

      // Step 3: Create the video on Dailymotion
      const createVideoFormData = new FormData()
      createVideoFormData.append('videoUrl', uploadResult.url)
      
      // Add optional metadata if provided
      if (metadata.title) createVideoFormData.append('title', metadata.title)
      if (metadata.description) createVideoFormData.append('description', metadata.description)
      if (metadata.tags) createVideoFormData.append('tags', metadata.tags)
      if (metadata.private !== undefined) createVideoFormData.append('private', metadata.private.toString())
      if (metadata.is_created_for_kids !== undefined) createVideoFormData.append('is_created_for_kids', metadata.is_created_for_kids.toString())
      if (metadata.channel) createVideoFormData.append('channel', metadata.channel)
      if (metadata.published !== undefined) createVideoFormData.append('published', metadata.published.toString())
      
      // If no metadata is provided, set some defaults
      if (!metadata.title) createVideoFormData.append('title', file.name.split('.')[0])

      const createResponse = await fetch('/api/dailymotion/upload', {
        method: 'POST',
        body: createVideoFormData,
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        throw new Error(errorData.error || 'Failed to create video on Dailymotion')
      }

      const createResult = await createResponse.json()

      // Call the completion handler with both the URL and metadata
      onUploadComplete({
        videoUrl: uploadResult.url,
        metadata: createResult.video
      })

      // Show success message
      toast({
        title: "Upload Complete",
        description: "Your video has been uploaded successfully.",
      })

    } catch (error) {
      console.error('Upload error:', error)
      onUploadError(error instanceof Error ? error.message : 'Upload failed')
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'Failed to upload video',
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="video-upload"
          className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-8 h-8 mb-4 text-gray-500"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 20 16"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
              />
            </svg>
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">MP4, MOV, or AVI (MAX. 2GB)</p>
          </div>
          <input
            id="video-upload"
            type="file"
            className="hidden"
            accept="video/mp4,video/quicktime,video/x-msvideo"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                uploadVideo(file)
              }
            }}
            disabled={isUploading}
          />
        </label>
      </div>

      {isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  )
}