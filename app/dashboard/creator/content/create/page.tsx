"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Upload } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ContentType, CourseStatus, DeliveryMode } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

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

export default function CreateCourse() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "COURSE" as ContentType,
    price: "0",
    isPublished: false,
    tags: "",
    courseStatus: "UPCOMING" as CourseStatus,
    deliveryMode: "VIDEO" as DeliveryMode,
    accessDuration: "12", // Default 12 months
    languages: ["English"], // Changed from single language to multiple languages array
  })

  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customDuration, setCustomDuration] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    if (name === "accessDuration" && value === "custom") {
      setCustomDuration(true)
      return
    }
    
    if (name === "accessDuration") {
      setCustomDuration(false)
    }
    
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setThumbnail(file)

      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setThumbnailPreview(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Function to handle adding and removing languages
  const toggleLanguage = (value: string) => {
    setFormData(prev => {
      const { languages } = prev;
      
      if (languages.includes(value)) {
        // Remove the language if it already exists
        return { ...prev, languages: languages.filter(lang => lang !== value) };
      } else {
        // Add the language if it doesn't exist
        return { ...prev, languages: [...languages, value] };
      }
    });
  }
  
  // Function to remove a language from the selection
  const removeLanguage = (value: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter(lang => lang !== value)
    }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.description || !formData.accessDuration) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Create FormData for file upload
      const formDataToSend = new FormData()
      formDataToSend.append("title", formData.title)
      formDataToSend.append("description", formData.description)
      formDataToSend.append("type", formData.type)
      formDataToSend.append("price", formData.price)
      formDataToSend.append("isPublished", formData.isPublished.toString())
      formDataToSend.append("tags", formData.tags)
      formDataToSend.append("courseStatus", formData.courseStatus)
      formDataToSend.append("deliveryMode", formData.deliveryMode)
      formDataToSend.append("accessDuration", formData.accessDuration)
      
      // Handle multiple languages
      formData.languages.forEach(lang => {
        formDataToSend.append("languages", lang)
      })

      if (thumbnail) {
        formDataToSend.append("thumbnail", thumbnail)
      }

      // Send the request to create course
      const response = await fetch("/api/creator/courses", {
        method: "POST",
        body: formDataToSend,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to create course")
      }

      const result = await response.json()

      toast({
        title: "Success",
        description: "Course created successfully",
      })

      // Redirect to the course edit page
      router.push(`/dashboard/creator/content/${result.courseId}`)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create course. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
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
      <h1 className="text-3xl font-bold mb-6">Create New Course</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Details</CardTitle>
                <CardDescription>Provide the basic information about your course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g., Complete Web Development Bootcamp"
                    value={formData.title}
                    onChange={handleInputChange}
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
                    placeholder="Describe your course in detail..."
                    value={formData.description}
                    onChange={handleInputChange}
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
                    value={formData.tags}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Content Type</Label>
                    <Select value={formData.type} onValueChange={(value) => handleSelectChange("type", value)}>
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
                      value={formData.price}
                      onChange={handleInputChange}
                    />
                    <p className="text-xs text-muted-foreground">Set to 0 for free content</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="courseStatus">Course Status</Label>
                    <Select 
                      value={formData.courseStatus} 
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
                      value={formData.deliveryMode} 
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
                        {formData.languages.map(language => (
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
                                      formData.languages.includes(language.value) ? "opacity-100" : "opacity-0"
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
                        value={customDuration ? "custom" : formData.accessDuration} 
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
                            value={formData.accessDuration}
                            onChange={handleInputChange}
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
                    checked={formData.isPublished}
                    onCheckedChange={(checked) => handleSwitchChange("isPublished", checked)}
                  />
                  <Label htmlFor="isPublished">Publish immediately</Label>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Thumbnail</CardTitle>
                <CardDescription>Upload a thumbnail image for your course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg aspect-video overflow-hidden bg-muted/50 flex items-center justify-center">
                  {thumbnailPreview ? (
                    <img
                      src={thumbnailPreview || "/placeholder.svg"}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No thumbnail uploaded</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="thumbnail">Upload Thumbnail</Label>
                  <Input id="thumbnail" type="file" accept="image/*" onChange={handleThumbnailChange} />
                  <p className="text-xs text-muted-foreground">Recommended size: 1280x720px (16:9)</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardFooter className="flex flex-col gap-2">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Course
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
