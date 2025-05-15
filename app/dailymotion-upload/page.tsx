"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"

export default function DailymotionUploadPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: "",
    private: false,
    is_created_for_kids: false,
    channel: "school",
    published: true
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: string) => (checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      // Check file size (max 2GB)
      if (file.size > 2 * 1024 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 2GB",
          variant: "destructive"
        })
        return
      }
      // Check file type
      if (!file.type.startsWith('video/')) {
        toast({
          title: "Invalid file type",
          description: "Please select a video file",
          variant: "destructive"
        })
        return
      }
      setVideoFile(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!videoFile) {
      toast({
        title: "Error",
        description: "Please select a video file to upload",
        variant: "destructive"
      })
      return
    }

    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for your video",
        variant: "destructive"
      })
      return
    }
    
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
      const uploadFormData = new FormData()
      uploadFormData.append('file', videoFile)

      const xhr = new XMLHttpRequest()
      
      // Set up progress tracking
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          setUploadProgress(progress)
        }
      }

      // Create a promise to handle the upload
      const uploadPromise = new Promise<any>((resolve, reject) => {
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
      xhr.send(uploadFormData)

      // Wait for upload to complete
      const uploadResult = await uploadPromise
      
      if (!uploadResult.url) {
        throw new Error('No video URL received from upload')
      }

      // Step 3: Create the video on Dailymotion with metadata
      const createVideoFormData = new FormData()
      createVideoFormData.append('videoUrl', uploadResult.url)
      createVideoFormData.append('title', formData.title)
      createVideoFormData.append('description', formData.description)
      createVideoFormData.append('tags', formData.tags)
      createVideoFormData.append('private', formData.private.toString())
      createVideoFormData.append('is_created_for_kids', formData.is_created_for_kids.toString())
      createVideoFormData.append('channel', formData.channel)
      createVideoFormData.append('published', formData.published.toString())
      
      const createResponse = await fetch('/api/dailymotion/upload', {
        method: 'POST',
        body: createVideoFormData,
      })
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        throw new Error(errorData.error || 'Failed to create video on Dailymotion')
      }
      
      const createResult = await createResponse.json()
      
      toast({
        title: "Upload successful",
        description: `Video uploaded to Dailymotion successfully!`,
      })
      
      // Reset form
      setFormData({
        title: "",
        description: "",
        tags: "",
        private: false,
        is_created_for_kids: false,
        channel: "school",
        published: true
      })
      setVideoFile(null)
      
      // Redirect to the video page if an ID is provided
      if (createResult.video && createResult.video.id) {
        router.push(`/dashboard/creator/videos/${createResult.video.id}`)
      } else {
        router.push('/dashboard/creator/videos')
      }
      
    } catch (error) {
      console.error("Upload failed:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="container max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Upload Video to Dailymotion</CardTitle>
          <CardDescription>
            Upload your video directly to your connected Dailymotion account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Video Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Enter video title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  disabled={isUploading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Enter video description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  disabled={isUploading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  name="tags"
                  placeholder="e.g. education, science, tutorial"
                  value={formData.tags}
                  onChange={handleInputChange}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  Add relevant tags to help viewers find your video
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="private"
                  checked={formData.private}
                  onCheckedChange={handleSwitchChange("private")}
                  disabled={isUploading}
                />
                <Label htmlFor="private">Private video</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_created_for_kids"
                  checked={formData.is_created_for_kids}
                  onCheckedChange={handleSwitchChange("is_created_for_kids")}
                  disabled={isUploading}
                />
                <Label htmlFor="is_created_for_kids">Video made for kids</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={formData.published}
                  onCheckedChange={handleSwitchChange("published")}
                  disabled={isUploading}
                />
                <Label htmlFor="published">Publish immediately</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <Input
                  id="channel"
                  name="channel"
                  value={formData.channel}
                  onChange={handleInputChange}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  Default: "school"
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="video">
                  Video File <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="video"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  required
                  disabled={isUploading}
                  className="cursor-pointer"
                />
                {videoFile && (
                  <p className="text-xs text-muted-foreground">
                    Selected file: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>
            
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-xs text-center text-muted-foreground">
                  Uploading: {Math.round(uploadProgress)}%
                </p>
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.back()}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isUploading || !videoFile}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload Video"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}