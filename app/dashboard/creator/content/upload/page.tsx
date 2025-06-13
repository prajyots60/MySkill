"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
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
import { ArrowLeft, Calendar, Clock, FileVideo, Loader2, Upload, Video, AlertCircle, Copy, Cloud, ShieldCheck, Link2, CheckCircle, Shield, Info as InfoIcon, Key as KeyIcon, Link as LinkIcon } from "lucide-react"
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
import { NextGenWasabiUploader } from "@/components/next-gen-wasabi-uploader"

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
  
  // Function to invalidate content page cache for a specific course
  const invalidateContentCache = useCallback(async (courseId: string) => {
    try {
      console.log("Invalidating cache for course:", courseId);
      
      // Call our direct cache invalidation API to clear Redis cache and revalidate Next.js paths
      const cacheResponse = await fetch(`/api/cache/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ courseId })
      });
      
      if (!cacheResponse.ok) {
        console.error("Failed to invalidate cache:", await cacheResponse.text());
      } else {
        console.log("Cache invalidation completed");
      }
    } catch (error) {
      console.error("Error invalidating cache:", error);
      // Don't throw - we don't want to block the UI flow if cache invalidation fails
    }
  }, []);

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
        // Add cache-busting parameter to ensure we get fresh data
        const timestamp = new Date().getTime()
        const response = await fetch(`/api/creator/courses?t=${timestamp}`)

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

  // Update the handleVideoUpload function to properly upload videos
  const handleVideoUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    // Only validate YouTube connection for YouTube uploads
    if (videoSource === "youtube" && !youtubeConnected) {
      toast({
        title: "YouTube Not Connected",
        description: "Please connect your YouTube account before uploading videos to YouTube",
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
                    odyseeUrl: "", // Add the missing odyseeUrl property
                  })

                  if (fileInputRef.current) {
                    fileInputRef.current.value = ""
                  }

                  // Invalidate cache for the course content
                  await invalidateContentCache(selectedCourse)

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
                                odyseeUrl: "",
                              })

                              if (fileInputRef.current) {
                                fileInputRef.current.value = ""
                              }

                              // Invalidate cache for the course content
                              await invalidateContentCache(selectedCourse)

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
    } else if (videoSource === "odysee") {
      // Direct API call for Odysee videos
      try {
        if (!videoForm.odyseeUrl.trim()) {
          throw new Error("Please enter an Odysee video URL");
        }

        // Create payload for Odysee API
        const payload = {
          url: videoForm.odyseeUrl,
          title: videoForm.title,
          description: videoForm.description || "",
          sectionId: selectedSection,
          isPreview: videoForm.isPreview
        };

        // Send the Odysee video data to the API
        const response = await fetch('/api/videos/odysee', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add Odysee video');
        }

        const result = await response.json();
        
        // Show success message
        toast({
          title: "Success",
          description: "Odysee video has been added to your course",
        });

        // Reset form after successful submission
        setVideoForm({
          title: "",
          description: "",
          isPreview: false,
          file: null,
          odyseeUrl: "",
        });
        
        // Invalidate cache for the course content before redirecting
        await invalidateContentCache(selectedCourse);

        // Redirect to course page
        router.push(`/dashboard/creator/content/${selectedCourse}`);
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to add Odysee video",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
        setUploadProgress(0);
      }
    } else {
      // For any other source we don't handle yet
      setLoading(false);
    }
  }

  // Update the handleLiveStreamCreate function to properly create live streams
  const handleLiveStreamCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    // Live streams require YouTube connection
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
    <div className="container mx-auto py-10 px-4 md:px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent dark:from-primary/10 dark:via-transparent dark:to-transparent pointer-events-none rounded-xl"></div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70 dark:from-primary dark:to-primary/80">Upload Content</h1>
            <p className="text-muted-foreground mt-2">Add videos or live streams to your courses</p>
          </div>
          <Button variant="ghost" onClick={() => router.push("/dashboard/creator")} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </div>

        {/* Only show YouTube warning when YouTube is the selected video source */}
        {videoSource === "youtube" && !youtubeConnected && uploadType === "video" && (
          <Card className="mb-8 overflow-hidden border border-amber-200/50 bg-gradient-to-r from-amber-50 to-amber-50/50 dark:from-amber-950/40 dark:to-amber-950/20 dark:border-amber-800/50 shadow-md">
            <div className="absolute inset-0 bg-amber-100/20 dark:bg-amber-900/10 z-0"></div>
            <CardContent className="p-6 flex items-start gap-4 relative z-10">
              <div className="p-2 bg-amber-100 rounded-full dark:bg-amber-900/40">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-amber-800 dark:text-amber-300 mb-1">YouTube Connection Required</h3>
                <p className="text-amber-700 dark:text-amber-400 mb-4 leading-relaxed">
                  To upload videos to YouTube, you need to connect your YouTube account first.
                </p>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => router.push("/dashboard/creator/service-connections")}
                  className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 dark:shadow-amber-900/30"
                >
                  <Link2 className="mr-2 h-4 w-4" /> Connect YouTube Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Show YouTube warning for live streams */}
        {uploadType === "live" && !youtubeConnected && (
          <Card className="mb-8 overflow-hidden border border-amber-200/50 bg-gradient-to-r from-amber-50 to-amber-50/50 dark:from-amber-950/40 dark:to-amber-950/20 dark:border-amber-800/50 shadow-md">
            <div className="absolute inset-0 bg-amber-100/20 dark:bg-amber-900/10 z-0"></div>
            <CardContent className="p-6 flex items-start gap-4 relative z-10">
              <div className="p-2 bg-amber-100 rounded-full dark:bg-amber-900/40">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-amber-800 dark:text-amber-300 mb-1">YouTube Connection Required</h3>
                <p className="text-amber-700 dark:text-amber-400 mb-4 leading-relaxed">
                  To create live streams, you need to connect your YouTube account first.
                </p>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => router.push("/dashboard/creator/service-connections")}
                  className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 dark:shadow-amber-900/30"
                >
                  <Link2 className="mr-2 h-4 w-4" /> Connect YouTube Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-primary/10 bg-gradient-to-b from-card/80 to-card shadow-lg shadow-primary/5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50 pointer-events-none"></div>
            <CardHeader className="relative z-10 border-b border-primary/10 pb-6">
              <CardTitle className="flex items-center text-xl font-semibold">
                <CheckCircle className="h-5 w-5 mr-2 text-primary" />
                Select Course & Section
              </CardTitle>
              <CardDescription>Choose where to add your content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10 pt-6">
              <div className="space-y-2">
                <Label htmlFor="course" className="text-sm font-medium flex items-center">
                  Course <span className="text-primary ml-1">*</span>
                </Label>
                <Select value={selectedCourse} onValueChange={handleCourseChange} disabled={fetchingCourses}>
                  <SelectTrigger id="course" className="bg-background border-input/80 hover:border-primary/50 transition-colors">
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
                {selectedCourse && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" /> Course selected
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="section" className="text-sm font-medium flex items-center">
                  Section <span className="text-primary ml-1">*</span>
                </Label>
                <Select
                  value={selectedSection}
                  onValueChange={setSelectedSection}
                  disabled={!selectedCourse || fetchingSections}
                >
                  <SelectTrigger id="section" className="bg-background border-input/80 hover:border-primary/50 transition-colors">
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
                {selectedSection && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" /> Section selected
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs value={uploadType} onValueChange={(value) => setUploadType(value as "video" | "live")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-background/30 p-1 rounded-lg shadow-md shadow-primary/5 border border-primary/10">
              <TabsTrigger value="video" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300">
                <FileVideo className="h-4 w-4" /> Upload Video
              </TabsTrigger>
              <TabsTrigger value="live" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300">
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

                    <div className="space-y-6">
                      <div>
                        <Label className="text-base font-medium mb-4 block">Video Source</Label>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* First group: YouTube & Odysee */}
                          <div className="space-y-3 border border-primary/10 rounded-lg p-4 bg-gradient-to-b from-background to-primary/5 dark:from-background dark:to-primary/10">
                            <h4 className="font-medium text-sm text-primary/70 uppercase tracking-wide">Standard Options</h4>
                            <div className="space-y-3">
                              <div className={`flex items-center p-3 rounded-md cursor-pointer transition-all ${videoSource === 'youtube' ? 'bg-primary/10 border border-primary/20' : 'hover:bg-primary/5 border border-transparent'}`}
                                   onClick={() => setVideoSource("youtube")}>
                                <input
                                  type="radio"
                                  id="sourceYoutube"
                                  name="videoSource"
                                  className="form-radio h-4 w-4 text-primary focus:ring-primary"
                                  checked={videoSource === "youtube"}
                                  onChange={() => setVideoSource("youtube")}
                                />
                                <Label htmlFor="sourceYoutube" className="cursor-pointer ml-3 flex items-center">
                                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z" fill="#FF0000"/>
                                    <path d="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z" fill="#fff"/>
                                  </svg>
                                  Upload to YouTube
                                </Label>
                              </div>
                              
                              <div className={`flex items-center p-3 rounded-md cursor-pointer transition-all ${videoSource === 'odysee' ? 'bg-primary/10 border border-primary/20' : 'hover:bg-primary/5 border border-transparent'}`}
                                   onClick={() => setVideoSource("odysee")}>
                                <input
                                  type="radio"
                                  id="sourceOdysee"
                                  name="videoSource"
                                  className="form-radio h-4 w-4 text-primary focus:ring-primary"
                                  checked={videoSource === "odysee"}
                                  onChange={() => setVideoSource("odysee")}
                                />
                                <Label htmlFor="sourceOdysee" className="cursor-pointer ml-3 flex items-center">
                                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12.71 2.29a1 1 0 00-1.42 0l-9 9a1 1 0 000 1.42A1 1 0 003 13h1v7a2 2 0 002 2h12a2 2 0 002-2v-7h1a1 1 0 00.71-1.71z" fill="#FF5500"/>
                                  </svg>
                                  Odysee Video URL
                                </Label>
                              </div>
                            </div>
                          </div>
                          
                          {/* Second group: Wasabi */}
                          <div className="space-y-3 border border-green-600/20 dark:border-green-400/20 rounded-lg p-4 bg-gradient-to-b from-green-50/40 to-green-100/40 dark:from-green-900/10 dark:to-green-800/20 relative overflow-hidden">
                            <div className="absolute -top-6 -right-6 w-12 h-12 bg-green-100 dark:bg-green-700/20 rounded-full"></div>
                            <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-green-100 dark:bg-green-700/20 rounded-full"></div>
                            
                            <h4 className="font-medium text-sm text-green-700 dark:text-green-400 uppercase tracking-wide flex items-center">
                              <Shield className="h-4 w-4 mr-1" /> Premium Security
                              <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-400 text-xs rounded-full">
                                PRO
                              </span>
                            </h4>
                            
                            <div className={`flex items-center p-3 rounded-md cursor-pointer transition-all ${videoSource === 'wasabi' ? 'bg-green-100/60 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50' : 'hover:bg-green-50 dark:hover:bg-green-900/20 border border-transparent'}`}
                                 onClick={() => setVideoSource("wasabi")}>
                              <input
                                type="radio"
                                id="sourceWasabi"
                                name="videoSource"
                                className="form-radio h-4 w-4 text-green-600 focus:ring-green-500"
                                checked={videoSource === "wasabi"}
                                onChange={() => setVideoSource("wasabi")}
                              />
                              <Label htmlFor="sourceWasabi" className="cursor-pointer ml-3">
                                <div className="flex items-center">
                                  <Cloud className="h-5 w-5 mr-2 text-green-600 dark:text-green-500" /> 
                                  <span>Advanced Secure Storage</span>
                                </div>
                                <div className="ml-7 mt-1 flex flex-wrap gap-2">
                                  <span className="inline-flex items-center px-2 py-0.5 bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-300 text-xs rounded-md">
                                    <ShieldCheck className="h-3 w-3 mr-0.5" /> Enhanced Encryption
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 text-xs rounded-md">
                                    Adaptive Chunking
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 text-xs rounded-md">
                                    Up to 20GB
                                  </span>
                                </div>
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {(videoSource === "youtube" || videoSource === "wasabi") && (
                        <div className="border rounded-lg p-5 bg-muted/30">
                          <div className="flex items-center mb-3">
                            <div className={`p-2 rounded-full mr-3 ${videoSource === "wasabi" ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400" : "bg-primary/10 text-primary"}`}>
                              <Upload className="h-5 w-5" />
                            </div>
                            <div>
                              <Label htmlFor="videoFile" className="text-base font-medium">
                                Video File <span className="text-destructive">*</span>
                              </Label>
                              <p className="text-sm text-muted-foreground">Select the video file to upload</p>
                            </div>
                          </div>
                          
                          <div className="mt-3 space-y-4">
                            <div className="relative">
                              <Input
                                id="videoFile"
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleFileChange}
                                disabled={loading}
                                required={videoSource === "youtube" || videoSource === "wasabi"}
                                className={`pl-4 py-2 cursor-pointer file:mr-4 file:py-2 file:px-4 
                                file:rounded-md file:border-0 file:text-sm file:font-semibold file:h-auto
                                h-auto flex items-center
                                ${videoSource === "wasabi" ? 
                                  "file:bg-green-600 file:text-white hover:file:bg-green-700" : 
                                  "file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"}`}
                              />
                            </div>
                            
                            <div className={`rounded-md p-3 ${videoSource === "wasabi" ? "bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900" : "bg-primary/5 dark:bg-primary/10 border border-primary/10"}`}>
                              <p className="text-xs flex flex-wrap gap-y-1">
                                <span className="font-medium mr-2 flex items-center">
                                  <CheckCircle className="h-3 w-3 mr-1" /> Supported formats:
                                </span>
                                MP4, MOV, AVI, etc.
                                
                                {videoSource === "wasabi" ? (
                                  <>
                                    <span className="w-full mt-1 flex flex-wrap gap-1">
                                      <span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 dark:bg-green-800/60 text-green-800 dark:text-green-300 text-xs rounded">
                                        <ShieldCheck className="h-3 w-3 mr-0.5" /> AES-GCM encryption
                                      </span>
                                      <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800/60 text-blue-800 dark:text-blue-300 text-xs rounded">
                                        <CheckCircle className="h-3 w-3 mr-0.5" /> Resumable uploads
                                      </span>
                                      <span className="inline-flex items-center px-1.5 py-0.5 bg-purple-100 dark:bg-purple-800/60 text-purple-800 dark:text-purple-300 text-xs rounded">
                                        <CheckCircle className="h-3 w-3 mr-0.5" /> Up to 20GB files
                                      </span>
                                    </span>
                                  </>
                                ) : (
                                  <span className="inline-flex items-center ml-2 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-800/60 text-amber-800 dark:text-amber-300 text-xs rounded">
                                    <CheckCircle className="h-3 w-3 mr-0.5" /> Max 2GB
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 p-3 border rounded-md bg-muted/30 shadow-sm">
                      <Switch
                        id="videoIsPreview"
                        checked={videoForm.isPreview}
                        onCheckedChange={handleVideoPreviewToggle}
                        disabled={loading}
                        className={videoForm.isPreview ? "bg-primary border-primary" : ""}
                      />
                      <div>
                        <Label htmlFor="videoIsPreview" className="font-medium cursor-pointer">
                          Make this video available as a preview
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Preview videos can be watched by non-enrolled students to promote your course
                        </p>
                      </div>
                    </div>                      {/* Show the YouTube direct uploader when a file is selected */}
                    {videoForm.file && videoSource === "youtube" && (
                      <YouTubeDirectUploader
                        sectionId={selectedSection}
                        title={videoForm.title}
                        description={videoForm.description}
                        isPreview={videoForm.isPreview}
                        file={videoForm.file}
                        onUploadProgress={(progress) => setUploadProgress(progress)}
                        onCacheInvalidateNeeded={invalidateContentCache}
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
                          
                          // Add a small delay and then redirect to the course page
                          setTimeout(() => {
                            router.push(`/dashboard/creator/content/${selectedCourse}`);
                          }, 1500);
                        }}
                      />
                    )}
                    
                    {/* Show the optimized NextGen Wasabi uploader when a file is selected */}
                    {videoForm.file && videoSource === "wasabi" && (
                      <NextGenWasabiUploader
                        sectionId={selectedSection}
                        title={videoForm.title}
                        description={videoForm.description}
                        isPreview={videoForm.isPreview}
                        file={videoForm.file}
                        enableEncryption={false}
                        onCacheInvalidateNeeded={invalidateContentCache}
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
                            title: "Optimized Upload Complete",
                            description: "Your video has been uploaded with advanced encryption and optimized chunking.",
                          });

                          // Add a small delay and then redirect to the course page
                          setTimeout(() => {
                            router.push(`/dashboard/creator/content/${selectedCourse}`);
                          }, 1500);
                        }}
                        onUploadProgress={(progress) => {
                          setUploadProgress(progress);
                        }}
                      />
                    )}
                    
                    {/* Show Odysee uploader for Odysee source */}
                    {videoSource === "odysee" && (
                      <div className="space-y-5">
                        <div className="border rounded-lg p-5 bg-muted/30">
                          <div className="flex items-center mb-4">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-full mr-3">
                              <Link2 className="h-5 w-5" />
                            </div>
                            <div>
                              <Label htmlFor="odyseeUrl" className="text-base font-medium">
                                Odysee Video URL <span className="text-destructive">*</span>
                              </Label>
                              <p className="text-sm text-muted-foreground">Paste the URL of your Odysee video</p>
                            </div>
                          </div>
                          
                          <div className="mt-3 space-y-3">
                            <Input
                              id="odyseeUrl"
                              name="odyseeUrl"
                              placeholder="https://odysee.com/@channel/video-name"
                              value={videoForm.odyseeUrl}
                              onChange={handleVideoFormChange}
                              disabled={loading}
                              required
                              className="border-input/80 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
                            />
                            
                            <div className="rounded-md p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900">
                              <p className="text-xs text-muted-foreground flex items-center">
                                <InfoIcon className="h-3.5 w-3.5 mr-1.5 text-orange-500" />
                                Make sure the video is public or unlisted on Odysee for proper embedding
                              </p>
                            </div>
                          </div>
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
                            className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20"
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
                      </div>
                    )}

                    {uploadProgress > 0 && !videoForm.file && (
                      <div className="border rounded-lg p-4 bg-background shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center">
                            <div className="animate-pulse mr-3 w-7 h-7 flex items-center justify-center rounded-full bg-primary/20">
                              <Upload className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium text-sm">Video Upload in Progress</h4>
                              <p className="text-xs text-muted-foreground">Please don't close this window</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold bg-primary/10 px-2 py-0.5 rounded-md text-primary">
                            {uploadProgress}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500 ease-in-out"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 italic text-center">
                          {uploadProgress < 30 ? "Preparing upload..." : 
                           uploadProgress < 70 ? "Uploading video content..." : 
                           "Finishing upload and processing..."}
                        </p>
                      </div>
                    )}

                    {!videoForm.file && videoSource !== "odysee" && (
                      <div className="flex justify-end mt-6">
                        <Button 
                          type="submit" 
                          disabled={
                            loading || 
                            !selectedSection || 
                            !videoForm.title.trim() ||
                            (videoSource === "youtube" && !youtubeConnected) ||
                            (videoSource === "wasabi" && !videoForm.file)
                          }
                          className={`py-6 px-8 text-base transition-all duration-300 shadow-lg
                            ${videoSource === "wasabi" ? 
                              "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-green-500/20" : 
                              "bg-gradient-to-r from-primary to-primary/90 hover:from-primary hover:to-primary text-primary-foreground shadow-primary/20"
                            }`}
                        >
                          {loading ? (
                            <>
                              <div className="flex items-center">
                                <div className="mr-3 relative">
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                  <div className="absolute inset-0 animate-ping rounded-full border border-white/30 opacity-75"></div>
                                </div>
                                <div>
                                  <span>Uploading...</span>
                                  <span className="block text-xs opacity-90">Please wait</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center">
                                <div className="mr-3 relative">
                                  <Upload className="h-5 w-5" />
                                  <div className="absolute inset-0 animate-ping rounded-full border border-white/30 opacity-75 duration-1000"></div>
                                </div>
                                <div>
                                  <span>{videoSource === "wasabi" ? "Select Video for Optimized Upload" : "Upload Video"}</span>
                                  <span className="block text-xs opacity-90">{selectedSection ? "Ready to upload" : "Select a section first"}</span>
                                </div>
                              </div>
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
              <Card className="border border-primary/10 bg-gradient-to-b from-card/80 to-card shadow-lg shadow-primary/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50 pointer-events-none"></div>
                <CardHeader className="relative z-10 border-b border-primary/10 pb-6">
                  <CardTitle className="flex items-center text-xl font-semibold">
                    <Video className="h-5 w-5 mr-2 text-red-500" />
                    Go Live
                  </CardTitle>
                  <CardDescription>Create a live stream or schedule one for later</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10 pt-6">
                  <form onSubmit={handleLiveStreamCreate} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="liveTitle" className="text-sm font-medium flex items-center">
                        Title <span className="text-destructive ml-1">*</span>
                      </Label>
                      <Input
                        id="liveTitle"
                        name="title"
                        placeholder="Enter live stream title"
                        value={liveForm.title}
                        onChange={handleLiveFormChange}
                        disabled={loading}
                        required
                        className="bg-background border-input/80 hover:border-primary/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="liveDescription" className="text-sm font-medium">Description</Label>
                      <Textarea
                        id="liveDescription"
                        name="description"
                        placeholder="Enter live stream description"
                        value={liveForm.description}
                        onChange={handleLiveFormChange}
                        disabled={loading}
                        rows={3}
                        className="bg-background border-input/80 hover:border-primary/50 transition-colors resize-none"
                      />
                    </div>

                    <div className="border rounded-lg p-5 bg-muted/30">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                            <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <Label htmlFor="isScheduled" className="text-base font-medium">Stream Timing</Label>
                            <p className="text-sm text-muted-foreground">Go live now or schedule for later</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="isScheduled"
                            checked={liveForm.isScheduled}
                            onCheckedChange={handleScheduledToggle}
                            disabled={loading}
                            className={liveForm.isScheduled ? "bg-purple-600 border-purple-600" : ""}
                          />
                          <Label htmlFor="isScheduled" className={`font-medium ${liveForm.isScheduled ? "text-purple-600 dark:text-purple-400" : ""}`}>
                            Schedule for later
                          </Label>
                        </div>
                      </div>

                      {liveForm.isScheduled ? (
                        <div className="mt-4 space-y-4 border rounded-lg p-4 bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="scheduledDate" className="text-sm font-medium flex items-center">
                                Schedule Date <span className="text-destructive ml-1">*</span>
                              </Label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-500" />
                                <Input
                                  id="scheduledDate"
                                  name="scheduledDate"
                                  type="date"
                                  value={liveForm.scheduledDate}
                                  onChange={handleLiveFormChange}
                                  disabled={loading}
                                  required={liveForm.isScheduled}
                                  className="pl-10 border-purple-200 dark:border-purple-800 focus:border-purple-400 dark:focus:border-purple-600"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="scheduledTime" className="text-sm font-medium flex items-center">
                                Schedule Time <span className="text-destructive ml-1">*</span>
                              </Label>
                              <div className="relative">
                                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-500" />
                                <Input
                                  id="scheduledTime"
                                  name="scheduledTime"
                                  type="time"
                                  value={liveForm.scheduledTime}
                                  onChange={handleLiveFormChange}
                                  disabled={loading}
                                  required={liveForm.isScheduled}
                                  className="pl-10 border-purple-200 dark:border-purple-800 focus:border-purple-400 dark:focus:border-purple-600"
                                />
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center mt-2">
                            <InfoIcon className="h-3.5 w-3.5 mr-1.5" />
                            Students will be notified about the scheduled live stream
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm italic text-muted-foreground mt-2 flex items-center">
                          <InfoIcon className="h-4 w-4 mr-1.5" />
                          Your stream will be created for immediate broadcasting
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 p-3 border rounded-md bg-muted/30 shadow-sm">
                      <Switch
                        id="liveIsPreview"
                        checked={liveForm.isPreview}
                        onCheckedChange={handleLivePreviewToggle}
                        disabled={loading}
                        className={liveForm.isPreview ? "bg-primary border-primary" : ""}
                      />
                      <div>
                        <Label htmlFor="liveIsPreview" className="font-medium cursor-pointer">
                          Make this live stream available as a preview
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Preview streams can be watched by non-enrolled students to promote your course
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end mt-6 pt-4 border-t border-primary/5">
                      <Button 
                        type="submit" 
                        disabled={loading || !selectedSection || (!youtubeConnected && uploadType === "live")}
                        className={`py-6 px-8 text-base transition-all duration-300 shadow-lg
                          ${liveForm.isScheduled ? 
                            "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-purple-500/20" : 
                            "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white shadow-red-500/20"
                          }`}
                      >
                        {loading ? (
                          <>
                            <div className="flex items-center">
                              <div className="mr-3 relative">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <div className="absolute inset-0 animate-ping rounded-full border border-white/30 opacity-75"></div>
                              </div>
                              <div>
                                <span>Creating...</span>
                                <span className="block text-xs opacity-90">Please wait</span>
                              </div>
                            </div>
                          </>
                        ) : liveForm.scheduledDate && liveForm.scheduledTime ? (
                          <>
                            <div className="flex items-center">
                              <div className="mr-3 relative">
                                <Calendar className="h-5 w-5" />
                                <div className="absolute inset-0 animate-ping rounded-full border border-white/30 opacity-75 duration-1000"></div>
                              </div>
                              <div>
                                <span>Schedule Live Stream</span>
                                <span className="block text-xs opacity-90">{liveForm.scheduledDate} at {liveForm.scheduledTime}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center">
                              <div className="mr-3 relative">
                                <Video className="h-5 w-5" />
                                <div className="absolute inset-0 animate-ping rounded-full border border-white/30 opacity-75 duration-1000"></div>
                              </div>
                              <div>
                                <span>Create Live Stream</span>
                                <span className="block text-xs opacity-90">{selectedSection ? "Ready to go live" : "Select a section first"}</span>
                              </div>
                            </div>
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
          <Card className="sticky top-6 border-primary/10 shadow-xl shadow-primary/5 bg-gradient-to-b from-background to-card overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-primary"></div>
            <CardHeader className="pb-3 border-b border-primary/10">
              <CardTitle className="flex items-center text-xl">
                <span className="bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">Upload Tips</span>
                <span className="ml-2 inline-block px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-md">PRO TIPS</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              <div className="relative pl-8 pr-3 py-3 rounded-md bg-background border border-primary/5 shadow-sm">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-400 to-blue-600 rounded-l-md"></div>
                <div className="absolute left-3 top-3">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
                    <FileVideo className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-medium text-base ml-8 mb-2 text-blue-700 dark:text-blue-500">Video Upload</h3>
                <ul className="list-none space-y-1.5 text-sm">
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-blue-500 mt-0.5 flex-shrink-0" />
                    Use high-quality video with good lighting and clear audio
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-blue-500 mt-0.5 flex-shrink-0" />
                    Keep file size under 2GB for faster uploads (20GB for Wasabi)
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-blue-500 mt-0.5 flex-shrink-0" />
                    Recommended resolution: 1080p (1920x1080) or 720p (1280x720)
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-blue-500 mt-0.5 flex-shrink-0" />
                    Supported formats: MP4, MOV, AVI, etc.
                  </li>
                </ul>
              </div>

              <div className="relative pl-8 pr-3 py-3 rounded-md bg-background border border-primary/5 shadow-sm">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-400 to-purple-600 rounded-l-md"></div>
                <div className="absolute left-3 top-3">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md">
                    <Video className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-medium text-base ml-8 mb-2 text-purple-700 dark:text-purple-500">Live Streaming</h3>
                <ul className="list-none space-y-1.5 text-sm">
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-purple-500 mt-0.5 flex-shrink-0" />
                    Test your internet connection before going live
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-purple-500 mt-0.5 flex-shrink-0" />
                    Recommended upload speed: at least 5 Mbps
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-purple-500 mt-0.5 flex-shrink-0" />
                    Use a wired connection for better stability
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-purple-500 mt-0.5 flex-shrink-0" />
                    Schedule streams in advance to notify your students
                  </li>
                </ul>
              </div>

              <div className="relative pl-8 pr-3 py-3 rounded-md bg-background border border-primary/5 shadow-sm">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-green-400 to-green-600 rounded-l-md"></div>
                <div className="absolute left-3 top-3">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-md">
                    <Shield className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-medium text-base ml-8 mb-2 text-green-700 dark:text-green-500">Content Security</h3>
                <ul className="list-none space-y-1.5 text-sm">
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-500 mt-0.5 flex-shrink-0" />
                    All videos are uploaded as unlisted on YouTube
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-500 mt-0.5 flex-shrink-0" />
                    Only enrolled students can access your content
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-500 mt-0.5 flex-shrink-0" />
                    Our platform prevents unauthorized downloads
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-500 mt-0.5 flex-shrink-0" />
                    Content is only accessible through our secure player
                  </li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="pt-2 pb-5">
              <Button 
                variant="outline" 
                className="w-full border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                onClick={() => router.push("/dashboard/creator")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      </div>

      {/* Stream Data Dialog */}
      <Dialog open={streamDataDialogOpen} onOpenChange={setStreamDataDialogOpen}>
        <DialogContent className="sm:max-w-md bg-gradient-to-b from-background to-background/90 border border-primary/20 shadow-xl shadow-primary/5">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-purple-500 to-primary"></div>
          
          <DialogHeader className="pb-4 border-b border-primary/10">
            <DialogTitle className="flex items-center text-xl">
              <Video className="h-5 w-5 mr-2 text-red-500" />
              Live Stream Information
            </DialogTitle>
            <DialogDescription>
              Use these details to connect your streaming software (OBS, Streamlabs, etc.)
            </DialogDescription>
          </DialogHeader>

          {streamData && (
            <div className="space-y-5 py-5">
              <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-sm flex items-center">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md mr-2">
                      <LinkIcon className="h-3 w-3" />
                    </div>
                    Stream URL
                  </Label>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs rounded-full">Required</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input value={streamData.streamUrl} readOnly className="font-mono text-sm bg-background border-blue-200 dark:border-blue-800" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(streamData.streamUrl)}
                    title="Copy to clipboard"
                    className="border-blue-200 hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900/30"
                  >
                    <Copy className="h-4 w-4 text-blue-600" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3 bg-muted/30 p-4 rounded-lg border-2 border-red-100 dark:border-red-900/50">
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-sm flex items-center">
                    <div className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md mr-2">
                      <KeyIcon className="h-3 w-3" />
                    </div>
                    Stream Key
                  </Label>
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs rounded-full">Secret</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input value={streamData.streamKey} readOnly type="password" className="font-mono text-sm bg-background border-red-200 dark:border-red-800" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(streamData.streamKey)}
                    title="Copy to clipboard"
                    className="border-red-200 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/30"
                  >
                    <Copy className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center">
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  Keep this key secret. Anyone with this key can stream to your channel.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-sm flex items-center">
                      <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md mr-2">
                        <InfoIcon className="h-3 w-3" />
                      </div>
                      Stream ID
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={streamData.streamId} readOnly className="font-mono text-sm text-xs bg-background border-purple-200 dark:border-purple-800" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(streamData.streamId)}
                      title="Copy to clipboard"
                      className="border-purple-200 hover:bg-purple-100 dark:border-purple-800 dark:hover:bg-purple-900/30"
                    >
                      <Copy className="h-4 w-4 text-purple-600" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-sm flex items-center">
                      <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-md mr-2">
                        <InfoIcon className="h-3 w-3" />
                      </div>
                      Broadcast ID
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={streamData.broadcastId} readOnly className="font-mono text-sm text-xs bg-background border-green-200 dark:border-green-800" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(streamData.broadcastId)}
                      title="Copy to clipboard"
                      className="border-green-200 hover:bg-green-100 dark:border-green-800 dark:hover:bg-green-900/30"
                    >
                      <Copy className="h-4 w-4 text-green-600" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between pt-4 border-t border-primary/10">
            <Button variant="outline" onClick={() => setStreamDataDialogOpen(false)} className="border-primary/20 hover:bg-primary/5">
              Close
            </Button>
            <Button 
              onClick={() => router.push(`/dashboard/creator/content/${selectedCourse}`)}
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20"
            >
              <CheckCircle className="mr-2 h-4 w-4" /> Go to Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
