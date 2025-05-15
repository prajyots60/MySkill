"use client"

import { useEffect, useState, useCallback, memo, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { 
  AlertCircle, 
  ArrowLeft, 
  Edit, 
  Loader2, 
  Plus, 
  Save, 
  Trash, 
  Upload, 
  X, 
  Check, 
  ChevronsUpDown,
  BookOpen,
  VideoIcon,
  Clock,
  Eye,
  Share
} from "lucide-react"
import { SectionLectures } from "@/components/section-lectures"
import { useCourseStore } from "@/lib/store/course-store"
import { Badge } from "@/components/ui/badge"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Lecture } from "@/lib/types"

// Define a constant array of available languages
const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Tamil", label: "Tamil" },
  { value: "Telugu", label: "Telugu" },
  { value: "Marathi", label: "Marathi" },
  { value: "Bengali", label: "Bengali" },
  { value: "Gujarati", label: "Gujarati" },
  { value: "Kannada", label: "Kannada" },
  { value: "Malayalam", label: "Malayalam" },
  { value: "Punjabi", label: "Punjabi" },
  { value: "Urdu", label: "Urdu" },
  { value: "Odia", label: "Odia" },
  { value: "Assamese", label: "Assamese" },
  { value: "Sanskrit", label: "Sanskrit" },
]

interface CourseEditorProps {
  courseId: string
}

// Memoized components
const CoursePreview = memo(function CoursePreview({ course }: { course: any }) {
  return (
    <Card className="overflow-hidden border-2 border-primary/10 shadow-md">
      <div className="relative">
        {/* Thumbnail with status badge overlay */}
        <div className="aspect-video w-full overflow-hidden bg-muted">
          {course.thumbnail ? (
            <img
              src={course.thumbnail || "/placeholder.svg"}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              loading="lazy"
              onError={(e) => {
                console.error("Failed to load thumbnail:", course.thumbnail)
                e.currentTarget.src = "/placeholder.svg?height=400&width=600"
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/5 to-primary/20">
              <img
                src="/placeholder.svg?height=400&width=600"
                alt="Course thumbnail placeholder"
                className="h-full w-full object-cover opacity-50"
              />
            </div>
          )}
        </div>
        
        {/* Status badge */}
        {course.courseStatus && (
          <div className="absolute right-3 top-3">
            <Badge className="bg-primary/90 text-xs font-medium uppercase tracking-wider text-primary-foreground">
              {course.courseStatus === "UPCOMING" ? "Upcoming" : 
               course.courseStatus === "ONGOING" ? "Ongoing" : "Completed"}
            </Badge>
          </div>
        )}
        
        {/* Published status badge */}
        <div className="absolute left-3 top-3">
          <Badge 
            variant={course.isPublished ? "default" : "outline"} 
            className={`text-xs font-medium ${course.isPublished ? "bg-green-500/90 text-white" : "border-yellow-500 text-yellow-500"}`}
          >
            {course.isPublished ? "Published" : "Draft"}
          </Badge>
        </div>
      </div>

      <CardHeader className="pb-2 pt-4">
        <CardTitle className="line-clamp-1 text-xl">{course.title}</CardTitle>
        <CardDescription className="line-clamp-2 mt-1 text-sm text-muted-foreground">
          {course.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pb-0">
        {/* Course tags */}
        {course.tags && course.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {course.tags.map((tag: string) => (
              <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {/* Course details grid */}
        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3 text-sm">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">Price</p>
            <p className="font-semibold">
              {course.price && course.price > 0 ? `₹${course.price.toFixed(2)}` : "Free"}
            </p>
          </div>
          
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">Delivery Mode</p>
            <p className="font-semibold">
              {course.deliveryMode === "VIDEO" ? "Video" : 
               course.deliveryMode === "LIVE" ? "Live" : "Hybrid"}
            </p>
          </div>
          
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">Access Period</p>
            <p className="font-semibold">{course.accessDuration || 12} Months</p>
          </div>
          
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">Content Type</p>
            <p className="capitalize font-semibold">{course.type?.toLowerCase()}</p>
          </div>
        </div>
        
        {/* Languages */}
        {course.languages && course.languages.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Available in</p>
            <div className="flex flex-wrap gap-1.5">
              {course.languages.map((language: string) => (
                <Badge key={language} variant="secondary" className="text-xs">
                  {language}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Stats summary */}
        <div className="flex items-center justify-between border-t py-3 text-sm">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span>{course.sections?.length || 0} Sections</span>
          </div>
          <div className="flex items-center gap-1.5">
            <VideoIcon className="h-4 w-4 text-muted-foreground" />
            <span>
              {course.sections?.reduce((acc: number, section: any) => acc + (section.lectures?.length || 0), 0) || 0} Lectures
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="grid grid-cols-2 gap-2 pt-4">
        <Button variant="outline" className="w-full" asChild>
          <a href={`/content/${course.id}`} target="_blank" rel="noopener noreferrer">
            <Eye className="mr-2 h-4 w-4" /> Preview
          </a>
        </Button>
        <Button className="w-full" disabled={!course.isPublished}>
          <Share className="mr-2 h-4 w-4" /> Share
        </Button>
      </CardFooter>
    </Card>
  )
})

const QuickActions = memo(function QuickActions({
  courseId,
  onAddSection,
  onUploadDocument,
}: {
  courseId: string
  onAddSection: () => void
  onUploadDocument: () => void
}) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          className="w-full"
          onClick={() => router.push(`/dashboard/creator/content/upload?courseId=${courseId}`)}
        >
          <Upload className="mr-2 h-4 w-4" /> Upload Content
        </Button>
        <Button variant="outline" className="w-full" onClick={onAddSection}>
          <Plus className="mr-2 h-4 w-4" /> Add Section
        </Button>
        <Button variant="outline" className="w-full" onClick={onUploadDocument}>
          <Upload className="mr-2 h-4 w-4" /> Upload Document
        </Button>
      </CardContent>
    </Card>
  )
})

export default function CourseEditor({ courseId }: CourseEditorProps) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { toast } = useToast()

  // Use Zustand store
  const {
    course,
    sections,
    loading,
    saving,
    activeTab,
    courseForm,
    newSectionTitle,
    newSectionDescription,
    addingSectionId,
    addingLectureToSectionId,
    newLectureTitle,
    newLectureDescription,
    newLectureIsPreview,
    uploadingDocumentTo,
    newDocumentTitle,
    newDocumentDescription,
    newDocumentFile,
    deleteConfirmation,
    setCourse,
    setSections,
    setLoading,
    setSaving,
    setActiveTab,
    setCourseForm,
    setNewSectionTitle,
    setNewSectionDescription,
    setAddingSectionId,
    setAddingLectureToSectionId,
    setNewLectureTitle,
    setNewLectureDescription,
    setNewLectureIsPreview,
    setUploadingDocumentTo,
    setNewDocumentTitle,
    setNewDocumentDescription,
    setNewDocumentFile,
    setDeleteConfirmation,
    fetchCourse,
    handleCourseFormChange,
    handleCourseTypeChange,
    handleCoursePublishedToggle,
    handleSaveCourse,
    handleDeleteCourse,
    handleAddSection,
    handleDeleteSection,
    handleEditSection,
    handleAddLecture,
    handleDeleteLecture,
    handleUploadDocument,
    handleDeleteDocument,
    handleEditLecture,
  } = useCourseStore()

  // Local state for editing lectures
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null)
  const [editLectureTitle, setEditLectureTitle] = useState("")
  const [editLectureDescription, setEditLectureDescription] = useState("")
  const [editLectureIsPreview, setEditLectureIsPreview] = useState(false)

  // State for custom duration selection
  const [customDuration, setCustomDuration] = useState(false)

  useEffect(() => {
    // Check if the accessDuration is one of the predefined options or custom
    if (courseForm.accessDuration && !["3", "6", "12"].includes(courseForm.accessDuration)) {
      setCustomDuration(true)
    }
  }, [courseForm.accessDuration])

  // Handler for select changes
  const handleSelectChange = (name: string, value: string) => {
    if (name === "accessDuration" && value === "custom") {
      setCustomDuration(true)
      return
    }
    
    if (name === "accessDuration") {
      setCustomDuration(false)
    }
    
    setCourseForm({ ...courseForm, [name]: value })
  }
  
  // Function to toggle language selection
  const toggleLanguage = (value: string) => {
    if (!courseForm.languages) {
      setCourseForm({ ...courseForm, languages: [value] })
      return
    }
    
    if (courseForm.languages.includes(value)) {
      setCourseForm({ 
        ...courseForm, 
        languages: courseForm.languages.filter(lang => lang !== value)
      })
    } else {
      setCourseForm({ 
        ...courseForm, 
        languages: [...courseForm.languages, value]
      })
    }
  }
  
  // Function to remove a language
  const removeLanguage = (value: string) => {
    if (!courseForm.languages) return
    
    setCourseForm({
      ...courseForm,
      languages: courseForm.languages.filter(lang => lang !== value)
    })
  }

  // Fetch course data on mount
  useEffect(() => {
    if (courseId) {
      fetchCourse(courseId)
    }
  }, [courseId, fetchCourse])

  // Prefetch related pages on mount for faster navigation
  useEffect(() => {
    const prefetchPages = async () => {
      // Prefetch upload page
      const uploadUrl = `/dashboard/creator/content/upload?courseId=${courseId}`
      await fetch(uploadUrl, { method: "HEAD" })

      // Prefetch dashboard
      await fetch("/dashboard/creator", { method: "HEAD" })
    }

    prefetchPages()
  }, [courseId])

  // Edit lecture
  const onEditLecture = useCallback(
    (lectureId: string) => {
      if (!course) return

      const lecture = course.sections?.flatMap((s) => s.lectures).find((l) => l.id === lectureId)

      if (lecture) {
        setEditingLecture(lecture)
        setEditLectureTitle(lecture.title)
        setEditLectureDescription(lecture.description || "")
        setEditLectureIsPreview(lecture.isPreview)
      }
    },
    [course],
  )

  // Save lecture
  const onSaveLecture = useCallback(async () => {
    if (!editingLecture) return

    try {
      const success = await handleEditLecture(
        editingLecture.id,
        editLectureTitle,
        editLectureDescription,
        editLectureIsPreview,
      )

      if (success) {
        toast({
          title: "Success",
          description: "Lecture updated successfully",
        })
        setEditingLecture(null)
      } else {
        toast({
          title: "Error",
          description: "Failed to update lecture",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lecture",
        variant: "destructive",
      })
    }
  }, [editingLecture, editLectureTitle, editLectureDescription, editLectureIsPreview, handleEditLecture, toast])

  // Handle edit lecture click
  const handleEditLectureClick = useCallback(
    (lectureId: string) => {
      const lecture = sections.flatMap((s) => s.lectures).find((l) => l.id === lectureId)
      if (lecture) {
        setEditingLecture(lecture)
        setEditLectureTitle(lecture.title)
        setEditLectureDescription(lecture.description || "")
        setEditLectureIsPreview(lecture.isPreview)
      }
    },
    [sections],
  )

  // Memoize sections to prevent unnecessary re-renders
  const memoizedSections = useMemo(() => sections, [sections])

  // Add these new handlers
  const handleAddSectionClick = async () => {
    const success = await handleAddSection(courseId)
    if (success) {
      // Reset all section-related state
      setAddingSectionId(null)
      setNewSectionTitle("")
      setNewSectionDescription("")
    }
  }

  const handleDeleteSectionClick = async (sectionId: string, title: string) => {
    setDeleteConfirmation({ type: "section", id: sectionId, title })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return

    let success = false
    switch (deleteConfirmation.type) {
      case "course":
        success = await handleDeleteCourse(courseId)
        break
      case "section":
        success = await handleDeleteSection(deleteConfirmation.id)
        break
      case "lecture":
        success = await handleDeleteLecture(deleteConfirmation.id)
        break
      case "document":
        success = await handleDeleteDocument(deleteConfirmation.id)
        break
    }

    if (success) {
      setDeleteConfirmation(null)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-40" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[400px] w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated" || (session?.user?.role !== "CREATOR" && session?.user?.role !== "ADMIN")) {
    router.push("/auth/signin")
    return null
  }

  if (!course) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 text-center">
        <h1 className="text-3xl font-bold mb-6">Course Not Found</h1>
        <p className="mb-6">The course you are looking for does not exist or has been removed.</p>
        <Button asChild>
          <a href="/dashboard/creator">Back to Dashboard</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => router.push("/dashboard/creator")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Edit Course</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={courseForm.isPublished ? "default" : "outline"}
            onClick={() => handleCoursePublishedToggle(!courseForm.isPublished)}
          >
            {courseForm.isPublished ? "Published" : "Draft"}
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              setDeleteConfirmation({
                type: "course",
                id: courseId,
                title: course.title,
              })
            }
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Course Content</h2>
                <Button onClick={() => router.push(`/dashboard/creator/content/upload?courseId=${courseId}`)}>
                  <Upload className="mr-2 h-4 w-4" /> Upload Content
                </Button>
              </div>

              {sections.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <div className="rounded-full bg-muted p-3 mb-4">
                      <Plus className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No sections yet</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Start by adding a section to organize your course content
                    </p>
                    <Button onClick={() => setAddingSectionId(courseId)}>Add Section</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {sections.map((section) => (
                    <SectionLectures
                      key={section.id}
                      section={section}
                      showEditControls={true}
                      courseId={courseId}
                      onAddLecture={(sectionId) => setAddingLectureToSectionId(sectionId)}
                      onEditLecture={handleEditLectureClick}
                      onDeleteSection={handleDeleteSectionClick}
                      onEditSection={handleEditSection}
                      onDeleteLecture={(lectureId) =>
                        setDeleteConfirmation({ type: "lecture", id: lectureId, title: "this lecture" })
                      }
                    />
                  ))}
                </div>
              )}

              <div className="flex justify-center">
                <Button variant="outline" onClick={() => setAddingSectionId(courseId)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Course Details</CardTitle>
                  <CardDescription>Update your course information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      name="title"
                      value={courseForm.title}
                      onChange={handleCourseFormChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Description <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={courseForm.description}
                      onChange={handleCourseFormChange}
                      rows={5}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input
                      id="tags"
                      name="tags"
                      placeholder="e.g., web development, javascript, react"
                      value={courseForm.tags}
                      onChange={handleCourseFormChange}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Content Type</Label>
                      <Select value={courseForm.type} onValueChange={handleCourseTypeChange}>
                        <SelectTrigger id="type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COURSE">Course</SelectItem>
                          <SelectItem value="EVENT">Event</SelectItem>
                          <SelectItem value="SHOW">Show</SelectItem>
                          <SelectItem value="PODCAST">Podcast</SelectItem>
                          <SelectItem value="PERFORMANCE">Performance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="price">Price (Rs.)</Label>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={courseForm.price}
                        onChange={handleCourseFormChange}
                      />
                      <p className="text-xs text-muted-foreground">Set to 0 for free content</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="courseStatus">Course Status</Label>
                      <Select 
                        value={courseForm.courseStatus} 
                        onValueChange={(value) => handleSelectChange("courseStatus", value)}
                      >
                        <SelectTrigger id="courseStatus">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UPCOMING">Upcoming</SelectItem>
                          <SelectItem value="ONGOING">Ongoing</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="deliveryMode">Mode of Delivery</Label>
                      <Select 
                        value={courseForm.deliveryMode} 
                        onValueChange={(value) => handleSelectChange("deliveryMode", value)}
                      >
                        <SelectTrigger id="deliveryMode">
                          <SelectValue placeholder="Select delivery mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VIDEO">Video</SelectItem>
                          <SelectItem value="LIVE">Live</SelectItem>
                          <SelectItem value="HYBRID">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="languages">Course Languages</Label>
                      <div className="w-full">
                        {/* Display selected languages as badges */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {courseForm.languages?.map(language => (
                            <Badge key={language} variant="secondary" className="px-2 py-1">
                              {language}
                              <button
                                type="button"
                                className="ml-1 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                onClick={() => removeLanguage(language)}
                              >
                                <X className="h-3 w-3" />
                                <span className="sr-only">Remove {language}</span>
                              </button>
                            </Badge>
                          ))}
                        </div>
                        
                        {/* Language selector dropdown */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              Add Languages
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search language..." />
                              <CommandEmpty>No language found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {LANGUAGES.map(language => (
                                  <CommandItem
                                    key={language.value}
                                    value={language.value}
                                    onSelect={() => toggleLanguage(language.value)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        courseForm.languages?.includes(language.value) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {language.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-muted-foreground mt-1">Select all languages available for this course</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="accessDuration">
                        Access Duration <span className="text-destructive">*</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Select 
                          value={customDuration ? "custom" : courseForm.accessDuration} 
                          onValueChange={(value) => handleSelectChange("accessDuration", value)}
                        >
                          <SelectTrigger id="accessDuration">
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 Months</SelectItem>
                            <SelectItem value="6">6 Months</SelectItem>
                            <SelectItem value="12">12 Months</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {customDuration && (
                          <div className="flex items-center">
                            <Input
                              id="customDuration"
                              name="accessDuration"
                              type="number"
                              min="1"
                              placeholder="Enter months"
                              value={courseForm.accessDuration}
                              onChange={handleCourseFormChange}
                              className="w-full"
                              required
                            />
                            <span className="ml-2 text-sm">months</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">How long students can access this course after enrollment</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isPublished"
                      checked={courseForm.isPublished}
                      onCheckedChange={handleCoursePublishedToggle}
                    />
                    <Label htmlFor="isPublished">Publish immediately</Label>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => handleSaveCourse(courseId)} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Course Documents</CardTitle>
                  <CardDescription>Manage documents attached to this course</CardDescription>
                </CardHeader>
                <CardContent>
                  {course.documents && course.documents.length > 0 ? (
                    <div className="space-y-2">
                      {course.documents.map((document) => (
                        <div
                          key={document.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-sm font-medium">{document.title}</p>
                              {document.description && (
                                <p className="text-xs text-muted-foreground">{document.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDeleteConfirmation({
                                  type: "document",
                                  id: document.id,
                                  title: document.title,
                                })
                              }
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <a href={document.url} target="_blank" rel="noopener noreferrer">
                                <Edit className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-muted/50 rounded-md">
                      <p className="text-sm text-muted-foreground">No documents attached to this course</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setUploadingDocumentTo({
                        type: "course",
                        id: courseId,
                      })
                    }
                  >
                    <Upload className="mr-2 h-4 w-4" /> Upload Document
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          {course && <CoursePreview course={course} />}

          <QuickActions
            courseId={courseId}
            onAddSection={() => setAddingSectionId(courseId)}
            onUploadDocument={() =>
              setUploadingDocumentTo({
                type: "course",
                id: courseId,
              })
            }
          />
        </div>
      </div>

      {/* Add Section Dialog */}
      <Dialog
        open={addingSectionId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddingSectionId(null)
            setNewSectionTitle("")
            setNewSectionDescription("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Section</DialogTitle>
            <DialogDescription>Sections help you organize your course content into logical groups</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sectionTitle">
                Section Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sectionTitle"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g., Introduction, Advanced Topics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sectionDescription">Description (Optional)</Label>
              <Textarea
                id="sectionDescription"
                value={newSectionDescription}
                onChange={(e) => setNewSectionDescription(e.target.value)}
                placeholder="Briefly describe what this section covers"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddingSectionId(null)
                setNewSectionTitle("")
                setNewSectionDescription("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddSectionClick} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Section"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lecture Dialog */}
      <Dialog
        open={addingLectureToSectionId !== null}
        onOpenChange={(open) => !open && setAddingLectureToSectionId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Lecture</DialogTitle>
            <DialogDescription>Add a placeholder lecture that you can upload content to later</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lectureTitle">
                Lecture Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lectureTitle"
                value={newLectureTitle}
                onChange={(e) => setNewLectureTitle(e.target.value)}
                placeholder="e.g., Introduction to HTML"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lectureDescription">Description (Optional)</Label>
              <Textarea
                id="lectureDescription"
                value={newLectureDescription}
                onChange={(e) => setNewLectureDescription(e.target.value)}
                placeholder="Briefly describe what this lecture covers"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="lectureIsPreview" checked={newLectureIsPreview} onCheckedChange={setNewLectureIsPreview} />
              <Label htmlFor="lectureIsPreview">Make this lecture available as a preview</Label>
            </div>
            <div className="bg-muted p-4 rounded-md">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  This will create a placeholder lecture. To add video content, use the Upload Content button.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingLectureToSectionId(null)}>
              Cancel
            </Button>
            <Button onClick={handleAddLecture} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Lecture"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lecture Dialog */}
      <Dialog open={editingLecture !== null} onOpenChange={(open) => !open && setEditingLecture(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lecture</DialogTitle>
            <DialogDescription>Update the lecture details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editLectureTitle">
                Lecture Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editLectureTitle"
                value={editLectureTitle}
                onChange={(e) => setEditLectureTitle(e.target.value)}
                placeholder="e.g., Introduction to HTML"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editLectureDescription">Description (Optional)</Label>
              <Textarea
                id="editLectureDescription"
                value={editLectureDescription}
                onChange={(e) => setEditLectureDescription(e.target.value)}
                placeholder="Briefly describe what this lecture covers"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="editLectureIsPreview"
                checked={editLectureIsPreview}
                onCheckedChange={setEditLectureIsPreview}
              />
              <Label htmlFor="editLectureIsPreview">Make this lecture available as a preview</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLecture(null)}>
              Cancel
            </Button>
            <Button onClick={onSaveLecture} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmation(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {deleteConfirmation?.type}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="font-medium">{deleteConfirmation?.title}</p>
            {deleteConfirmation?.type === "course" && (
              <p className="text-sm text-destructive mt-2">
                This will permanently delete the course and all its content, including sections, lectures, and
                documents.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmation(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
