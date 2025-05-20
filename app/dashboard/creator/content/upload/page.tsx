"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Calendar, Clock, FileVideo, Loader2, Upload, Video, AlertCircle, Copy, Cloud, ShieldCheck } from "lucide-react"
import { useYouTubeStore } from "@/lib/store/youtube-store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCourseStore } from "@/lib/store/course-store"
import YouTubeDirectUploader from "@/components/youtube-direct-uploader"
import { OdyseeVideoUploader } from "@/components/odysee-components"
import WasabiVideoUploader from "@/components/wasabi-video-uploader"
import { BackgroundWasabiUploader } from "@/components/background-wasabi-uploader"

export default function UploadContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get courseId and sectionId from URL if available
  const urlCourseId = searchParams.get("courseId")
  const urlSectionId = searchParams.get("sectionId")

  // Use our YouTube store with optimized connection check
  const { connected: youtubeConnected, loading: checkingConnection, checkConnectionStatus } = useYouTubeStore()

  // State for selected video source
  const [selectedCourse, setSelectedCourse] = useState(urlCourseId || "")
  const [selectedSection, setSelectedSection] = useState(urlSectionId || "")
  const [courses, setCourses] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchingCourses, setFetchingCourses] = useState(false)
  const [fetchingSections, setFetchingSections] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadType, setUploadType] = useState<"video" | "live">("video")
  const [connectionChecked, setConnectionChecked] = useState(false)
  const [videoSource, setVideoSource] = useState<"youtube" | "odysee" | "wasabi">("youtube")

  // Unified video upload form state for all video sources
  const [videoForm, setVideoForm] = useState({
    title: "",
    description: "",
    isPreview: false,
    file: null as File | null,
    odyseeUrl: "", // For Odysee video URL input
  })

  // Reset all form fields when video source changes
  useEffect(() => {
    // Keep the title and description when switching, but reset the file and odyseeUrl
    setVideoForm(prev => ({ 
      ...prev,
      file: null,
      odyseeUrl: ""
    }));
    
    // Reset file input element if switching from file-based upload
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [videoSource]);

  // Live stream form state
  const [liveForm, setLiveForm] = useState({
    title: "",
    description: "",
    isPreview: false,
    scheduledDate: "",
    scheduledTime: "",
    isScheduled: false,
  })

  const [streamDataDialogOpen, setStreamDataDialogOpen] = useState(false)
  const [streamData, setStreamData] = useState<{
    streamId: string
    streamKey: string
    streamUrl: string
    broadcastId: string
  } | null>(null)

  // Check YouTube connection status only once when component mounts
  useEffect(() => {
    if (status === "authenticated" && !connectionChecked) {
      checkConnectionStatus()
      setConnectionChecked(true)
    }
  }, [status, connectionChecked, checkConnectionStatus])

  // Fetch courses when component mounts
  useEffect(() => {
    const fetchCourses = async () => {
      if (status !== "authenticated") return

      try {
        setFetchingCourses(true)
        const response = await fetch("/api/creator/courses")

        if (!response.ok) {
          throw new Error("Failed to fetch courses")
        }

        const data = await response.json()

        if (data.success) {
          setCourses(data.courses || [])

          // If we have a courseId from URL, fetch its sections
          if (urlCourseId) {
            handleCourseChange(urlCourseId)
          }
        } else {
          throw new Error(data.message || "Failed to fetch courses")
        }
      } catch (error) {
        console.error("Error fetching courses:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch courses",
          variant: "destructive",
        })
        setCourses([])
      } finally {
        setFetchingCourses(false)
        setLoading(false)
      }
    }

    fetchCourses()
  }, [status, toast, urlCourseId, urlSectionId])

  // Fetch sections when a course is selected
  const handleCourseChange = async (courseId: string) => {
    setSelectedCourse(courseId)
    
    // Only reset the selected section if we don't have one from the URL
    // or if we're changing to a different course than what was initially loaded
    if (!urlSectionId || (urlCourseId && courseId !== urlCourseId)) {
      setSelectedSection("")
    }

    try {
      setFetchingSections(true)
      const response = await fetch(`/api/creator/courses/${courseId}/sections`)

      if (!response.ok) {
        throw new Error("Failed to fetch sections")
      }

      const data = await response.json()

      if (data.success) {
        setSections(data.sections || [])
      } else {
        throw new Error(data.message || "Failed to fetch sections")
      }
    } catch (error) {
      console.error("Error fetching sections:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch sections",
        variant: "destructive",
      })
      setSections([])
    } finally {
      setFetchingSections(false)
    }
  }

  // Handle video file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoForm({
        ...videoForm,
        file: e.target.files[0],
      })
    }
  }

  // Handle video form input changes
  const handleVideoFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setVideoForm({
      ...videoForm,
      [name]: value,
    })
  }

  // Handle video preview toggle
  const handleVideoPreviewToggle = (checked: boolean) => {
    setVideoForm({
      ...videoForm,
      isPreview: checked,
    })
  }

  // Handle live form input changes
  const handleLiveFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setLiveForm({
      ...liveForm,
      [name]: value,
    })
  }

  // Handle live preview toggle
  const handleLivePreviewToggle = (checked: boolean) => {
    setLiveForm({
      ...liveForm,
      isPreview: checked,
    })
  }

  // Handle scheduled toggle
  const handleScheduledToggle = (checked: boolean) => {
    setLiveForm({
      ...liveForm,
      isScheduled: checked,
      // Clear date and time if switching to immediate
      scheduledDate: checked ? liveForm.scheduledDate : "",
      scheduledTime: checked ? liveForm.scheduledTime : "",
    })
  }

  // Update the handleVideoUpload function to properly upload videos to YouTube
  const handleVideoUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    // For YouTube uploads, validate connection
    if (videoSource === "youtube" && !youtubeConnected) {
      toast({
        title: "YouTube Not Connected",
        description: "Please connect your YouTube account before uploading videos",
        variant: "destructive",
      })
      router.push("/dashboard/creator/service-connections")
      return
    }

    if (!selectedSection) {
      toast({
        title: "Error",
        description: "Please select a section",
        variant: "destructive",
      })
      return
    }

    // Common validation for all video sources
    if (!videoForm.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title",
        variant: "destructive",
      })
      return
    }

    // Validation specific to upload methods that need files
    if ((videoSource === "youtube" || videoSource === "wasabi") && !videoForm.file) {
      // For Wasabi, we only show this error if they try to submit the form
      // The form button is already disabled when no file is selected
      // But as extra validation, we check here too
      toast({
        title: "Error",
        description: "Please select a video file",
        variant: "destructive",
      })
      return
    }
    
    // Validation specific to Odysee
    if (videoSource === "odysee" && !videoForm.odyseeUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter an Odysee video URL",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setUploadProgress(0)

    // For Wasabi uploads, we need to prevent form submission as the WasabiVideoUploader component will handle it
    if (videoSource === "wasabi") {
      setLoading(false);
      // Since we want to use the WasabiVideoUploader component's handling, 
      // we shouldn't actually submit the form through the normal flow
      e.preventDefault();
      // Don't return here so the WasabiVideoUploader component can handle it
    }
    
    // YouTube uploads require file upload
    if (videoSource === "youtube") {
      try {
        // Create FormData for file upload
        const formData = new FormData()
        formData.append("sectionId", selectedSection)
        formData.append("title", videoForm.title)
        formData.append("description", videoForm.description || "")
        formData.append("isPreview", videoForm.isPreview.toString())
        
        // Only append file for YouTube uploads (guaranteed to exist due to earlier validation)
        if (videoForm.file) {
          formData.append("videoFile", videoForm.file)
        }

        // Upload the video
        const response = await fetch("/api/creator/lectures/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Failed to upload video")
        }

        const result = await response.json()

        if (result.success) {
          // Add the upload to the course store for tracking
          const { addUpload, updateUploadProgress, updateUploadStatus } = useCourseStore.getState()
          const uploadId = result.jobId

          addUpload({
            id: uploadId,
            type: "lecture",
            title: videoForm.title,
          })

          // Start polling for upload status with a smarter strategy
          let pollCount = 0
          const maxPollCount = 180 // Maximum number of polls (30 minutes with 10-second interval)

          const pollInterval = setInterval(async () => {
            pollCount++

            // If we've been polling for too long, stop and show an error
            if (pollCount > maxPollCount) {
              clearInterval(pollInterval)
              updateUploadStatus(
                uploadId,
                "failed",
                "Upload timed out. Please check your course page to see if the video was uploaded.",
              )
              setLoading(false)
              return
            }

            try {
              const statusResponse = await fetch(`/api/creator/lectures/upload?jobId=${uploadId}`)

              if (!statusResponse.ok) {
                if (statusResponse.status === 404) {
                  // Job not found, but this might be temporary during server restart
                  console.log("Job not found, will retry...")
                  return
                }
                throw new Error("Failed to check upload status")
              }

              const statusResult = await statusResponse.json()

              if (statusResult.success) {
                const { status, progress, error } = statusResult.job

                // Update progress
                updateUploadProgress(uploadId, progress)

                // Update status
                if (status === "completed") {
                  updateUploadStatus(uploadId, "completed")
                  clearInterval(pollInterval)

                  // Reset form
                  setVideoForm({
                    title: "",
                    description: "",
                    isPreview: false,
                    file: null,
                  })

                  if (fileInputRef.current) {
                    fileInputRef.current.value = ""
                  }

                  // Redirect to course page
                  router.push(`/dashboard/creator/content/${selectedCourse}`)
                } else if (status === "failed") {
                  updateUploadStatus(uploadId, "failed", error)
                  clearInterval(pollInterval)
                  setLoading(false)
                } else if (status === "processing") {
                  // If we're in the processing stage, we can reduce polling frequency
                  // This is especially useful during the YouTube upload which can take a while
                  if (progress > 20 && progress < 80) {
                    // During the main upload phase, poll less frequently
                    clearInterval(pollInterval)
                    setTimeout(() => {
                      // Resume polling after 30 seconds
                      const newInterval = setInterval(async () => {
                        // Reuse the same polling logic
                        try {
                          const newStatusResponse = await fetch(`/api/creator/lectures/upload?jobId=${uploadId}`)
                          if (!newStatusResponse.ok) return

                          const newStatusResult = await newStatusResponse.json()
                          if (newStatusResult.success) {
                            const { status, progress, error } = newStatusResult.job
                            updateUploadProgress(uploadId, progress)

                            if (status === "completed") {
                              updateUploadStatus(uploadId, "completed")
                              clearInterval(newInterval)

                              // Reset form and redirect
                              setVideoForm({
                                title: "",
                                description: "",
                                isPreview: false,
                                file: null,
                              })

                              if (fileInputRef.current) {
                                fileInputRef.current.value = ""
                              }

                              router.push(`/dashboard/creator/content/${selectedCourse}`)
                            } else if (status === "failed") {
                              updateUploadStatus(uploadId, "failed", error)
                              clearInterval(newInterval)
                              setLoading(false)
                            }
                          }
                        } catch (error) {
                          console.error("Error checking upload status:", error)
                        }
                      }, 50000) // Poll every 50 seconds during the main upload phase
                    }, 50000)
                  }
                }
              }
            } catch (error) {
              console.error("Error checking upload status:", error)
              // Don't update status here, just log the error and continue polling
            }
          }, 30000) // Poll every 30 seconds initially

          toast({
            title: "Upload Started",
            description: "Your video is being uploaded in the background. You can continue working while it uploads.",
          })

          setLoading(false)
        } else {
          throw new Error(result.error || "Failed to upload video")
        }
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to upload video",
          variant: "destructive",
        })
        setLoading(false)
        setUploadProgress(0)
      }
    } else {
      // For Odysee, we don't do anything here as the OdyseeVideoUploader component handles the upload
      setLoading(false)
    }
  }

  // Update the handleLiveStreamCreate function to properly create live streams
  const handleLiveStreamCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!youtubeConnected) {
      toast({
        title: "YouTube Not Connected",
        description: "Please connect your YouTube account before creating a live stream",
        variant: "destructive",
      })
      router.push("/dashboard/creator/service-connections")
      return
    }

    if (!selectedSection) {
      toast({
        title: "Error",
        description: "Please select a section",
        variant: "destructive",
      })
      return
    }

    if (!liveForm.title) {
      toast({
        title: "Error",
        description: "Please enter a title",
        variant: "destructive",
      })
      return
    }

    // Validate scheduled date and time if isScheduled is true
    if (liveForm.isScheduled && (!liveForm.scheduledDate || !liveForm.scheduledTime)) {
      toast({
        title: "Error",
        description: "Please select both date and time for scheduled live stream",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      // Prepare scheduled date - use current date/time if not scheduled
      let scheduledAt: string | undefined
      if (liveForm.isScheduled && liveForm.scheduledDate && liveForm.scheduledTime) {
        scheduledAt = `${liveForm.scheduledDate}T${liveForm.scheduledTime}`
      } else {
        // Set current date and time for immediate start
        const now = new Date()
        scheduledAt = now.toISOString()
      }

      // Create the live stream
      const response = await fetch("/api/creator/lectures/live", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sectionId: selectedSection,
          title: liveForm.title,
          description: liveForm.description,
          isPreview: liveForm.isPreview,
          scheduledAt,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to create live stream")
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Success",
          description: scheduledAt ? "Live stream scheduled successfully" : "Live stream created successfully",
        })

        // Store stream data for display
        setStreamData({
          streamId: result.streamId,
          streamKey: result.streamKey,
          streamUrl: result.streamUrl,
          broadcastId: result.broadcastId,
        })

        // Show stream data dialog
        setStreamDataDialogOpen(true)

        // Reset form
        setLiveForm({
          title: "",
          description: "",
          isPreview: false,
          scheduledDate: "",
          scheduledTime: "",
          isScheduled: false,
        })
      } else {
        throw new Error(result.error || "Failed to create live stream")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create live stream",
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

  if (status === "loading") {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (status === "unauthenticated" || (session?.user?.role !== "CREATOR" && session?.user?.role !== "ADMIN")) {
    router.push("/auth/signin")
    return null
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <h1 className="text-3xl font-bold mb-6">Upload Content</h1>

      {!youtubeConnected && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-amber-800 dark:text-amber-300">YouTube Connection Required</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                To upload videos or create live streams, you need to connect your YouTube account first.
              </p>
              <Button variant="default" size="sm" onClick={() => router.push("/dashboard/creator/service-connections")}>
                Connect YouTube Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Course & Section</CardTitle>
              <CardDescription>Choose where to add your content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="course">Course</Label>
                <Select value={selectedCourse} onValueChange={handleCourseChange} disabled={fetchingCourses}>
                  <SelectTrigger id="course">
                    <SelectValue placeholder={fetchingCourses ? "Loading courses..." : "Select a course"} />
                  </SelectTrigger>
                  <SelectContent>
                    {fetchingCourses ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading courses...</span>
                      </div>
                    ) : courses.length > 0 ? (
                      courses.map((course: any) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No courses found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <Select
                  value={selectedSection}
                  onValueChange={setSelectedSection}
                  disabled={!selectedCourse || fetchingSections}
                >
                  <SelectTrigger id="section">
                    <SelectValue
                      placeholder={
                        fetchingSections
                          ? "Loading sections..."
                          : selectedCourse
                            ? "Select a section"
                            : "Select a course first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {fetchingSections ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading sections...</span>
                      </div>
                    ) : sections.length > 0 ? (
                      sections.map((section: any) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.title}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        {selectedCourse ? "No sections found" : "Select a course first"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Tabs value={uploadType} onValueChange={(value) => setUploadType(value as "video" | "live")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="video" className="flex items-center gap-2">
                <FileVideo className="h-4 w-4" /> Upload Video
              </TabsTrigger>
              <TabsTrigger value="live" className="flex items-center gap-2">
                <Video className="h-4 w-4" /> Go Live
              </TabsTrigger>
            </TabsList>

            <TabsContent value="video" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Video</CardTitle>
                  <CardDescription>Upload a pre-recorded video to your course</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleVideoUpload} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="videoTitle">
                        Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="videoTitle"
                        name="title"
                        placeholder="Enter video title"
                        value={videoForm.title}
                        onChange={handleVideoFormChange}
                        disabled={loading}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="videoDescription">Description</Label>
                      <Textarea
                        id="videoDescription"
                        name="description"
                        placeholder="Enter video description"
                        value={videoForm.description}
                        onChange={handleVideoFormChange}
                        disabled={loading}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label>Video Source</Label>
                        <div className="flex mt-2 space-x-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="sourceYoutube"
                              name="videoSource"
                              className="form-radio h-4 w-4 text-primary focus:ring-primary"
                              checked={videoSource === "youtube"}
                              onChange={() => setVideoSource("youtube")}
                            />
                            <Label htmlFor="sourceYoutube" className="cursor-pointer">Upload to YouTube</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="sourceOdysee"
                              name="videoSource"
                              className="form-radio h-4 w-4 text-primary focus:ring-primary"
                              checked={videoSource === "odysee"}
                              onChange={() => setVideoSource("odysee")}
                            />
                            <Label htmlFor="sourceOdysee" className="cursor-pointer">Odysee Video URL</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="sourceWasabi"
                              name="videoSource"
                              className="form-radio h-4 w-4 text-primary focus:ring-primary"
                              checked={videoSource === "wasabi"}
                              onChange={() => setVideoSource("wasabi")}
                            />
                            <Label htmlFor="sourceWasabi" className="cursor-pointer flex items-center">
                              <Cloud className="h-4 w-4 mr-1" /> Secure Storage
                              <span className="ml-1 p-1 bg-green-100 text-green-800 text-xs rounded-md flex items-center">
                                <ShieldCheck className="h-3 w-3 mr-0.5" /> Encrypted
                              </span>
                            </Label>
                          </div>
                        </div>
                      </div>

                      {(videoSource === "youtube" || videoSource === "wasabi") && (
                        <div className="space-y-2">
                          <Label htmlFor="videoFile">
                            Video File <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="videoFile"
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleFileChange}
                            disabled={loading}
                            required={videoSource === "youtube" || videoSource === "wasabi"}
                          />
                          <p className="text-xs text-muted-foreground">
                            {videoSource === "wasabi" ? (
                              <>
                                Supported formats: MP4, MOV, AVI, etc. 
                                <span className="font-medium text-green-600 dark:text-green-400"> Videos will be encrypted and stored securely. Up to 10GB supported.</span>
                              </>
                            ) : (
                              <>
                                Supported formats: MP4, MOV, AVI, etc. 
                                <span className="font-medium text-green-600 dark:text-green-400"> Video size should be less than 2GB</span>
                              </>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="videoIsPreview"
                        checked={videoForm.isPreview}
                        onCheckedChange={handleVideoPreviewToggle}
                        disabled={loading}
                      />
                      <Label htmlFor="videoIsPreview">
                        Make this video available as a preview
                      </Label>
                    </div>                      {/* Show the YouTube direct uploader when a file is selected */}
                    {videoForm.file && videoSource === "youtube" && (
                      <YouTubeDirectUploader
                        sectionId={selectedSection}
                        title={videoForm.title}
                        description={videoForm.description}
                        isPreview={videoForm.isPreview}
                        file={videoForm.file}
                        onUploadProgress={(progress) => setUploadProgress(progress)}
                        onUploadComplete={(lectureId, videoId) => {
                          // Reset form - this will hide the uploader component
                          setVideoForm({
                            title: "",
                            description: "",
                            isPreview: false,
                            file: null,
                            odyseeUrl: "",
                          });
                          
                          // Clear the file input field
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                      />
                    )}
                    
                    {/* Show the Wasabi video uploader when a file is selected */}
                    {videoForm.file && videoSource === "wasabi" && (
                      <BackgroundWasabiUploader
                        sectionId={selectedSection}
                        title={videoForm.title}
                        description={videoForm.description}
                        isPreview={videoForm.isPreview}
                        file={videoForm.file}
                        enableEncryption={true}
                        onUploadComplete={(lectureId, fileKey) => {
                          // Reset form - this will hide the uploader component
                          setVideoForm({
                            title: "",
                            description: "",
                            isPreview: false,
                            file: null,
                            odyseeUrl: "",
                          });
                          
                          // Clear the file input field
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                          
                          // Set loading to false to ensure UI is reset
                          setLoading(false);
                          setUploadProgress(0);
                          
                          toast({
                            title: "Upload Started in Background",
                            description: "Your video is now uploading in the background. You can monitor progress in the upload manager.",
                          });
                        }}
                      />
                    )}
                    
                    {/* Show Odysee uploader for Odysee source */}
                    {videoSource === "odysee" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="odyseeUrl">Odysee Video URL<span className="text-destructive">*</span></Label>
                          <Input
                            id="odyseeUrl"
                            name="odyseeUrl"
                            placeholder="Paste Odysee video URL here..."
                            value={videoForm.odyseeUrl}
                            onChange={handleVideoFormChange}
                            disabled={loading}
                            required
                          />
                        </div>
                        
                        <div className="flex justify-end">
                          <Button 
                            type="submit" 
                            disabled={
                              loading || 
                              !selectedSection || 
                              !videoForm.title.trim() ||
                              !videoForm.odyseeUrl.trim()
                            }
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Add Odysee Video
                              </>
                            )}
                          </Button>
                        </div>
                        
                        <OdyseeVideoUploader
                          sectionId={selectedSection}
                          title={videoForm.title}
                          description={videoForm.description}
                          isPreview={videoForm.isPreview}
                          initialUrl={videoForm.odyseeUrl}
                          onUploadComplete={() => {
                            // Reset form
                            setVideoForm({
                              title: "",
                              description: "",
                              isPreview: false,
                              file: null,
                              odyseeUrl: "",
                            });
                          }}
                        />
                      </div>
                    )}

                    {uploadProgress > 0 && !videoForm.file && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Uploading...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300 ease-in-out"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {!videoForm.file && videoSource !== "odysee" && (
                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={
                            loading || 
                            !selectedSection || 
                            !videoForm.title.trim() ||
                            (videoSource === "youtube" && !youtubeConnected) ||
                            (videoSource === "wasabi" && !videoForm.file)
                          }
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              {videoSource === "wasabi" ? "Select Video to Upload" : "Upload Video"}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="live" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Go Live</CardTitle>
                  <CardDescription>Create a live stream or schedule one for later</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLiveStreamCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="liveTitle">
                        Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="liveTitle"
                        name="title"
                        placeholder="Enter live stream title"
                        value={liveForm.title}
                        onChange={handleLiveFormChange}
                        disabled={loading}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="liveDescription">Description</Label>
                      <Textarea
                        id="liveDescription"
                        name="description"
                        placeholder="Enter live stream description"
                        value={liveForm.description}
                        onChange={handleLiveFormChange}
                        disabled={loading}
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isScheduled"
                        checked={liveForm.isScheduled}
                        onCheckedChange={handleScheduledToggle}
                        disabled={loading}
                      />
                      <Label htmlFor="isScheduled">Schedule for later</Label>
                    </div>

                    {liveForm.isScheduled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="scheduledDate">
                            Schedule Date <span className="text-destructive">*</span>
                          </Label>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                            <Input
                              id="scheduledDate"
                              name="scheduledDate"
                              type="date"
                              value={liveForm.scheduledDate}
                              onChange={handleLiveFormChange}
                              disabled={loading}
                              required={liveForm.isScheduled}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="scheduledTime">
                            Schedule Time <span className="text-destructive">*</span>
                          </Label>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                            <Input
                              id="scheduledTime"
                              name="scheduledTime"
                              type="time"
                              value={liveForm.scheduledTime}
                              onChange={handleLiveFormChange}
                              disabled={loading}
                              required={liveForm.isScheduled}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="liveIsPreview"
                        checked={liveForm.isPreview}
                        onCheckedChange={handleLivePreviewToggle}
                        disabled={loading}
                      />
                      <Label htmlFor="liveIsPreview">Make this live stream available as a preview</Label>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={loading || !selectedSection || !youtubeConnected}>
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : liveForm.scheduledDate && liveForm.scheduledTime ? (
                          <>
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule Live Stream
                          </>
                        ) : (
                          <>
                            <Video className="mr-2 h-4 w-4" />
                            Create Live Stream
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Video Upload</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Use high-quality video with good lighting and clear audio</li>
                  <li>Keep file size under 2GB for faster uploads</li>
                  <li>Recommended resolution: 1080p (1920x1080) or 720p (1280x720)</li>
                  <li>Supported formats: MP4, MOV, AVI, etc.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Live Streaming</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Test your internet connection before going live</li>
                  <li>Recommended upload speed: at least 5 Mbps</li>
                  <li>Use a wired connection for better stability</li>
                  <li>Schedule streams in advance to notify your students</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Content Security</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>All videos are uploaded as unlisted on YouTube</li>
                  <li>Only enrolled students can access your content</li>
                  <li>Our platform prevents unauthorized downloads</li>
                  <li>Content is only accessible through our secure player</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => router.push("/dashboard/creator")}>
                Back to Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Stream Data Dialog */}
      <Dialog open={streamDataDialogOpen} onOpenChange={setStreamDataDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Live Stream Information</DialogTitle>
            <DialogDescription>
              Use these details to connect your streaming software (OBS, Streamlabs, etc.)
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
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setStreamDataDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => router.push(`/dashboard/creator/content/${selectedCourse}`)}>Go to Course</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
