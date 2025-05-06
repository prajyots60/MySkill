"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Loader2,
  Save,
  Upload,
  Trash,
  Globe,
  Mail,
  Shield,
  CreditCard,
  Youtube,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  AlertCircle,
  Plus,
  X,
  School,
  Award,
  ChevronDown,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useYouTubeStore } from "@/lib/store/youtube-store"
import { updateCreatorProfile } from "@/app/creators/[creatorId]/actions/get-creator"

// Define the available theme colors for creator profiles
const themeColors = [
  { value: "default", label: "Default (Blue)" },
  { value: "purple", label: "Purple" },
  { value: "green", label: "Green" },
  { value: "red", label: "Red" },
  { value: "pink", label: "Pink" },
  { value: "amber", label: "Amber" },
  { value: "teal", label: "Teal" },
  { value: "indigo", label: "Indigo" },
]

export default function CreatorSettingsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  // Use YouTube store
  const { connected: youtubeConnected } = useYouTubeStore()

  // Form states
  const [profileForm, setProfileForm] = useState({
    // Basic information
    name: session?.user?.name || "",
    bio: "I'm a passionate educator with over 10 years of experience in web development and software engineering.",
    website: "https://yourwebsite.com",
    location: "San Francisco, CA",
    profileImage: session?.user?.image || "/placeholder.svg?height=100&width=100",
    
    // Advanced creator profile fields
    coverImages: ["", "", ""], // Changed from coverImage to coverImages array with 3 empty slots
    tagline: "Empowering students through knowledge and practical skills",
    customTitle: "Your specialized teaching focus here",
    themeColor: "default",
    
    // Expertise and categories
    expertise: [] as string[],
    newExpertise: "",
    categories: [] as string[],
    newCategory: "",
    languages: [] as string[],
    newLanguage: "",
    
    // Achievements and education
    yearsTeaching: "",
    education: "",
    achievements: "",
    
    // Institution details
    institutionName: "",
    institutionDescription: "",
    institutionWebsite: "",
    
    // Custom sections
    customSections: [{
      title: "",
      content: ""
    }],
    
    // Resources
    showResources: false,
    resourcesDescription: "",
    resources: [{
      title: "",
      description: "",
      url: "",
      buttonText: ""
    }]
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailNewSale: true,
    emailNewReview: true,
    emailNewStudent: false,
    emailMarketing: false,
    browserNewSale: true,
    browserNewReview: true,
    browserNewStudent: true,
  })

  const [privacySettings, setPrivacySettings] = useState({
    showProfilePublicly: true,
    showSocialLinks: true,
    allowStudentMessages: true,
    showRevenueStats: false,
  })

  const [socialLinks, setSocialLinks] = useState({
    youtube: "https://youtube.com/yourchannel",
    twitter: "https://twitter.com/yourhandle",
    facebook: "https://facebook.com/yourpage",
    instagram: "https://instagram.com/yourprofile",
    linkedin: "https://linkedin.com/in/yourprofile",
    website: "https://yourpersonalwebsite.com",
  })

  // Fetch creator profile data when the component mounts
  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (session?.user?.id) {
        try {
          const response = await fetch(`/api/creators/${session.user.id}/profile`)
          if (response.ok) {
            const data = await response.json()
            if (data.creator) {
              // Update form state with fetched data
              setProfileForm(prev => ({
                ...prev,
                name: data.creator.name || prev.name,
                bio: data.creator.bio || prev.bio,
                profileImage: data.creator.image || prev.profileImage,
                coverImages: data.creator.coverImages || prev.coverImages,
                tagline: data.creator.tagline || prev.tagline,
                customTitle: data.creator.customTitle || prev.customTitle,
                themeColor: data.creator.themeColor || "default",
                expertise: data.creator.expertise || [],
                categories: data.creator.categories || [],
                languages: data.creator.languages || [],
                yearsTeaching: data.creator.yearsTeaching || "",
                education: data.creator.education || "",
                achievements: data.creator.achievements || "",
                institutionName: data.creator.institutionName || "",
                institutionDescription: data.creator.institutionDescription || "",
                institutionWebsite: data.creator.institutionWebsite || "",
                website: data.creator.website || prev.website,
                location: data.creator.location || prev.location,
                customSections: data.creator.customSections?.length 
                  ? data.creator.customSections 
                  : [{title: "", content: ""}],
                showResources: data.creator.showResources || false,
                resourcesDescription: data.creator.resourcesDescription || "",
                resources: data.creator.resources?.length
                  ? data.creator.resources
                  : [{title: "", description: "", url: "", buttonText: ""}]
              }))
              
              // Update social links if available
              if (data.creator.socialLinks) {
                setSocialLinks(prev => ({
                  ...prev,
                  ...data.creator.socialLinks
                }))
              }
            }
          }
        } catch (error) {
          console.error("Error fetching creator profile:", error)
        }
      }
    }
    
    fetchCreatorProfile()
  }, [session?.user?.id])

  const handleProfileFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setProfileForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSocialLinksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSocialLinks((prev) => ({ ...prev, [name]: value }))
  }

  const handleNotificationToggle = (setting: keyof typeof notificationSettings) => {
    setNotificationSettings((prev) => ({ ...prev, [setting]: !prev[setting] }))
  }

  const handlePrivacyToggle = (setting: keyof typeof privacySettings) => {
    setPrivacySettings((prev) => ({ ...prev, [setting]: !prev[setting] }))
  }

  const handleAddExpertise = () => {
    if (profileForm.newExpertise.trim()) {
      setProfileForm(prev => ({
        ...prev,
        expertise: [...prev.expertise, prev.newExpertise.trim()],
        newExpertise: ""
      }))
    }
  }

  const handleRemoveExpertise = (index: number) => {
    setProfileForm(prev => ({
      ...prev,
      expertise: prev.expertise.filter((_, i) => i !== index)
    }))
  }

  const handleAddCategory = () => {
    if (profileForm.newCategory.trim()) {
      setProfileForm(prev => ({
        ...prev,
        categories: [...prev.categories, prev.newCategory.trim()],
        newCategory: ""
      }))
    }
  }

  const handleRemoveCategory = (index: number) => {
    setProfileForm(prev => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index)
    }))
  }

  const handleAddLanguage = () => {
    if (profileForm.newLanguage.trim()) {
      setProfileForm(prev => ({
        ...prev,
        languages: [...prev.languages, profileForm.newLanguage.trim()],
        newLanguage: ""
      }))
    }
  }

  const handleRemoveLanguage = (index: number) => {
    setProfileForm(prev => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index)
    }))
  }

  const handleAddCustomSection = () => {
    setProfileForm(prev => ({
      ...prev,
      customSections: [...prev.customSections, { title: "", content: "" }]
    }))
  }

  const handleUpdateCustomSection = (index: number, field: string, value: string) => {
    setProfileForm(prev => {
      const updatedSections = [...prev.customSections]
      updatedSections[index] = {
        ...updatedSections[index],
        [field]: value
      }
      return { ...prev, customSections: updatedSections }
    })
  }

  const handleRemoveCustomSection = (index: number) => {
    setProfileForm(prev => ({
      ...prev,
      customSections: prev.customSections.filter((_, i) => i !== index)
    }))
  }

  const handleAddResource = () => {
    setProfileForm(prev => ({
      ...prev,
      resources: [...prev.resources, { title: "", description: "", url: "", buttonText: "" }]
    }))
  }

  const handleUpdateResource = (index: number, field: string, value: string) => {
    setProfileForm(prev => {
      const updatedResources = [...prev.resources]
      updatedResources[index] = {
        ...updatedResources[index],
        [field]: value
      }
      return { ...prev, resources: updatedResources }
    })
  }

  const handleRemoveResource = (index: number) => {
    setProfileForm(prev => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index)
    }))
  }

  const handleToggleResources = (value: boolean) => {
    setProfileForm(prev => ({
      ...prev,
      showResources: value
    }))
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    
    try {
      // Filter out empty custom sections and resources
      const filteredCustomSections = profileForm.customSections
        .filter(section => section.title.trim() && section.content.trim())
      
      const filteredResources = profileForm.resources
        .filter(resource => resource.title.trim() && resource.url.trim())
      
      // Prepare social links
      const preparedSocialLinks = {
        youtube: socialLinks.youtube,
        twitter: socialLinks.twitter,
        facebook: socialLinks.facebook,
        instagram: socialLinks.instagram,
        linkedin: socialLinks.linkedin,
        website: socialLinks.website,
      }
    
      // Call the server action to update the profile
      const result = await updateCreatorProfile({
        name: profileForm.name,
        bio: profileForm.bio,
        image: profileForm.profileImage,
        coverImages: profileForm.coverImages,
        tagline: profileForm.tagline,
        customTitle: profileForm.customTitle,
        expertise: profileForm.expertise,
        location: profileForm.location,
        website: profileForm.website,
        education: profileForm.education,
        achievements: profileForm.achievements,
        yearsTeaching: profileForm.yearsTeaching,
        languages: profileForm.languages,
        categories: profileForm.categories,
        institutionName: profileForm.institutionName,
        institutionDescription: profileForm.institutionDescription,
        institutionWebsite: profileForm.institutionWebsite,
        themeColor: profileForm.themeColor,
        socialLinks: preparedSocialLinks,
        customSections: filteredCustomSections,
        showResources: profileForm.showResources,
        resourcesDescription: profileForm.resourcesDescription,
        resources: filteredResources
      })
      
      if (result.success) {
        toast({
          title: "Profile updated",
          description: "Your creator profile has been updated successfully.",
        })
      } else {
        toast({
          title: "Update failed",
          description: result.error || "Failed to update profile. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error saving profile:", error)
      toast({
        title: "Update failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    setSaving(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    toast({
      title: "Notification settings updated",
      description: "Your notification preferences have been saved.",
    })

    setSaving(false)
  }

  const handleSavePrivacy = async () => {
    setSaving(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    toast({
      title: "Privacy settings updated",
      description: "Your privacy settings have been saved.",
    })

    setSaving(false)
  }

  const handleSaveSocialLinks = async () => {
    setSaving(true)

    try {
      // Call the server action to update just the social links
      const result = await updateCreatorProfile({
        socialLinks: {
          youtube: socialLinks.youtube,
          twitter: socialLinks.twitter,
          facebook: socialLinks.facebook,
          instagram: socialLinks.instagram,
          linkedin: socialLinks.linkedin,
          website: socialLinks.website,
        }
      })
      
      if (result.success) {
        toast({
          title: "Social links updated",
          description: "Your social media links have been saved.",
        })
      } else {
        toast({
          title: "Update failed",
          description: result.error || "Failed to update social links. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error saving social links:", error)
      toast({
        title: "Update failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin")
    return null
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Creator Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="w-full sm:w-auto flex flex-wrap">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
              <TabsTrigger value="social">Social Links</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">Creator Profile</h2>
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save All Changes
                    </>
                  )}
                </Button>
              </div>

              <p className="text-muted-foreground mb-4">
                Complete your profile to showcase your expertise, build trust with students, and increase visibility on the platform.
                <br/>Fields with <span className="text-red-500">*</span> are shown prominently on your public profile.
              </p>
              
              <Accordion type="multiple" defaultValue={["basicInfo"]} className="w-full">
                <AccordionItem value="basicInfo" className="border rounded-lg mb-4">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center">
                      <span className="text-lg font-medium">Basic Information</span>
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Required</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4 border-t">
                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex flex-col items-center gap-2">
                          <Avatar className="h-24 w-24">
                            <AvatarImage src={profileForm.profileImage || "/placeholder.svg"} alt={profileForm.name} />
                            <AvatarFallback>{profileForm.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="gap-1">
                              <Upload className="h-4 w-4" />
                              <span>Upload</span>
                            </Button>
                          </div>
                          <p className="text-xs text-center text-muted-foreground">
                            Profile picture (1:1 ratio)
                          </p>
                        </div>

                        <div className="space-y-4 flex-1">
                          <div className="space-y-2">
                            <Label htmlFor="name">
                              Display Name <span className="text-red-500">*</span>
                            </Label>
                            <Input 
                              id="name" 
                              name="name" 
                              value={profileForm.name} 
                              onChange={handleProfileFormChange}
                            />
                            <p className="text-xs text-muted-foreground">
                              This is the name that will be displayed on your creator profile
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="bio">
                              Bio <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                              id="bio"
                              name="bio"
                              value={profileForm.bio}
                              onChange={handleProfileFormChange}
                              rows={4}
                            />
                            <p className="text-xs text-muted-foreground">
                              Brief description that appears on your public profile (300 characters max)
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            name="location"
                            value={profileForm.location}
                            onChange={handleProfileFormChange}
                            placeholder="City, Country"
                          />
                          <p className="text-xs text-muted-foreground">
                            Your city and country (displays on your public profile)
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="website">Website</Label>
                          <div className="flex">
                            <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <Input
                              id="website"
                              name="website"
                              value={profileForm.website}
                              onChange={handleProfileFormChange}
                              className="rounded-l-none"
                              placeholder="https://your-website.com"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Your personal or business website
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="profileAppearance" className="border rounded-lg mb-4">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center">
                      <span className="text-lg font-medium">Profile Appearance</span>
                      <span className="ml-2 text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded">Visual Impact</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4 border-t">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>
                          Cover Images (Up to 3) <span className="text-red-500">*</span>
                        </Label>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="coverImage1" className="text-sm text-muted-foreground">Cover Image 1 (Primary)</Label>
                            <Input 
                              id="coverImage1"
                              value={profileForm.coverImages[0]}
                              onChange={(e) => setProfileForm(prev => {
                                const newCoverImages = [...prev.coverImages]
                                newCoverImages[0] = e.target.value
                                return { ...prev, coverImages: newCoverImages }
                              })} 
                              placeholder="https://example.com/your-cover-image.jpg"
                            />
                          </div>

                          <div>
                            <Label htmlFor="coverImage2" className="text-sm text-muted-foreground">Cover Image 2 (Optional)</Label>
                            <Input 
                              id="coverImage2"
                              value={profileForm.coverImages[1]}
                              onChange={(e) => setProfileForm(prev => {
                                const newCoverImages = [...prev.coverImages]
                                newCoverImages[1] = e.target.value
                                return { ...prev, coverImages: newCoverImages }
                              })} 
                              placeholder="https://example.com/your-second-cover-image.jpg"
                            />
                          </div>

                          <div>
                            <Label htmlFor="coverImage3" className="text-sm text-muted-foreground">Cover Image 3 (Optional)</Label>
                            <Input 
                              id="coverImage3"
                              value={profileForm.coverImages[2]}
                              onChange={(e) => setProfileForm(prev => {
                                const newCoverImages = [...prev.coverImages]
                                newCoverImages[2] = e.target.value
                                return { ...prev, coverImages: newCoverImages }
                              })} 
                              placeholder="https://example.com/your-third-cover-image.jpg"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Banner images for your profile hero section (recommended size: 1500×500px). Up to 3 images will be shown as a carousel.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="tagline">
                          Tagline <span className="text-red-500">*</span>
                        </Label>
                        <Input 
                          id="tagline" 
                          name="tagline"
                          value={profileForm.tagline}
                          onChange={handleProfileFormChange}
                          placeholder="A short, catchy phrase describing your teaching"
                        />
                        <p className="text-xs text-muted-foreground">
                          A short phrase that appears below your name (60 characters max)
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="customTitle">Custom Welcome Title</Label>
                        <Input 
                          id="customTitle" 
                          name="customTitle"
                          value={profileForm.customTitle}
                          onChange={handleProfileFormChange}
                          placeholder="Welcome to [Your Name]'s Academy"
                        />
                        <p className="text-xs text-muted-foreground">
                          A custom title for your creator page that appears in the hero section
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="themeColor">Theme Color</Label>
                        <Select 
                          name="themeColor" 
                          value={profileForm.themeColor}
                          onValueChange={(value) => setProfileForm(prev => ({ ...prev, themeColor: value }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a theme color" />
                          </SelectTrigger>
                          <SelectContent>
                            {themeColors.map(color => (
                              <SelectItem key={color.value} value={color.value}>
                                {color.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          The main color scheme for your creator profile
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="expertise" className="border rounded-lg mb-4">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center">
                      <span className="text-lg font-medium">Expertise & Categories</span>
                      <span className="ml-2 text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded">Searchability</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4 border-t">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label>
                          Areas of Expertise <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {profileForm.expertise.map((item, index) => (
                            <Badge key={index} variant="secondary" className="text-sm py-1.5">
                              {item}
                              <button
                                type="button"
                                onClick={() => handleRemoveExpertise(index)}
                                className="ml-2 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            id="newExpertise"
                            name="newExpertise"
                            value={profileForm.newExpertise}
                            onChange={handleProfileFormChange}
                            placeholder="E.g., Machine Learning"
                            className="flex-1"
                          />
                          <Button type="button" variant="outline" onClick={handleAddExpertise}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Your specific areas of expertise (e.g., 'Machine Learning', 'Web Development')
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <Label>
                          Teaching Categories <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {profileForm.categories.map((category, index) => (
                            <Badge key={index} variant="secondary" className="text-sm py-1.5">
                              {category}
                              <button
                                type="button"
                                onClick={() => handleRemoveCategory(index)}
                                className="ml-2 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            id="newCategory"
                            name="newCategory"
                            value={profileForm.newCategory}
                            onChange={handleProfileFormChange}
                            placeholder="E.g., Computer Science"
                            className="flex-1"
                          />
                          <Button type="button" variant="outline" onClick={handleAddCategory}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Subject categories you teach (e.g., 'Computer Science', 'Data Analysis')
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <Label>Languages</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {profileForm.languages.map((language, index) => (
                            <Badge key={index} variant="secondary" className="text-sm py-1.5">
                              {language}
                              <button
                                type="button"
                                onClick={() => handleRemoveLanguage(index)}
                                className="ml-2 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            id="newLanguage"
                            name="newLanguage"
                            value={profileForm.newLanguage}
                            onChange={handleProfileFormChange}
                            placeholder="E.g., English"
                            className="flex-1"
                          />
                          <Button type="button" variant="outline" onClick={handleAddLanguage}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Languages you teach in (e.g., 'English', 'Spanish')
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="credentials" className="border rounded-lg mb-4">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center">
                      <span className="text-lg font-medium">Credentials & Experience</span>
                      <span className="ml-2 text-xs bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded">Credibility</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4 border-t">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="yearsTeaching">
                          Years of Teaching Experience <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="yearsTeaching"
                          name="yearsTeaching"
                          value={profileForm.yearsTeaching}
                          onChange={handleProfileFormChange}
                          placeholder="E.g., 5+"
                        />
                        <p className="text-xs text-muted-foreground">
                          How many years you've been teaching (e.g., '5+', '10+')
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="education">Education</Label>
                        <Textarea
                          id="education"
                          name="education"
                          value={profileForm.education}
                          onChange={handleProfileFormChange}
                          placeholder="Ph.D. in Computer Science, Stanford University
M.S. in Data Science, MIT
B.Tech in Computer Engineering, IIT"
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                          Your educational background (degrees, institutions). Put each entry on a new line.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="achievements">Achievements & Certifications</Label>
                        <Textarea
                          id="achievements"
                          name="achievements"
                          value={profileForm.achievements}
                          onChange={handleProfileFormChange}
                          placeholder="Microsoft Certified Trainer 2023
Best Online Educator Award 2022
Author of 'Modern Data Engineering' textbook"
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                          Notable professional achievements, awards, or certifications. Put each entry on a new line.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="institution" className="border rounded-lg mb-4">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center">
                      <span className="text-lg font-medium">Institution Information</span>
                      <span className="ml-2 text-xs bg-gray-500/10 text-gray-600 px-2 py-0.5 rounded">Optional</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4 border-t">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="institutionName">Institution Name</Label>
                        <div className="flex">
                          <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                            <School className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <Input
                            id="institutionName"
                            name="institutionName"
                            value={profileForm.institutionName}
                            onChange={handleProfileFormChange}
                            className="rounded-l-none"
                            placeholder="E.g., Bright Minds Academy"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Name of your teaching institution or organization (if applicable)
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="institutionDescription">Institution Description</Label>
                        <Textarea
                          id="institutionDescription"
                          name="institutionDescription"
                          value={profileForm.institutionDescription}
                          onChange={handleProfileFormChange}
                          rows={3}
                          placeholder="Describe your institution or organization"
                        />
                        <p className="text-xs text-muted-foreground">
                          Brief description of your institution (200 characters max)
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="institutionWebsite">Institution Website</Label>
                        <Input
                          id="institutionWebsite"
                          name="institutionWebsite"
                          value={profileForm.institutionWebsite}
                          onChange={handleProfileFormChange}
                          placeholder="https://institution-website.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          Official website of your institution
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="customSections" className="border rounded-lg mb-4">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center">
                      <span className="text-lg font-medium">Custom Profile Sections</span>
                      <span className="ml-2 text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded">Personalization</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4 border-t">
                    {profileForm.customSections.map((section, index) => (
                      <div key={index} className="pt-2 pb-4 border-b last:border-0 space-y-3">
                        <div className="flex justify-between items-center">
                          <Label htmlFor={`customSectionTitle-${index}`}>Section {index + 1}</Label>
                          {profileForm.customSections.length > 1 && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleRemoveCustomSection(index)}
                            >
                              <Trash className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>
                        
                        <Input
                          id={`customSectionTitle-${index}`}
                          value={section.title}
                          onChange={(e) => handleUpdateCustomSection(index, 'title', e.target.value)}
                          placeholder="Section Title (e.g., Teaching Philosophy)"
                        />
                        
                        <Textarea
                          value={section.content}
                          onChange={(e) => handleUpdateCustomSection(index, 'content', e.target.value)}
                          rows={4}
                          placeholder="Section content..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Custom content that will appear in a dedicated section on your profile
                        </p>
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddCustomSection}
                      className="w-full mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Section
                    </Button>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="resources" className="border rounded-lg mb-4">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center">
                      <span className="text-lg font-medium">Free Resources</span>
                      <span className="ml-2 text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded">Value Add</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4 border-t">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="showResources">Display Resources Section</Label>
                          <p className="text-xs text-muted-foreground">
                            Show a dedicated section for free resources on your profile
                          </p>
                        </div>
                        <Switch
                          id="showResources"
                          checked={profileForm.showResources}
                          onCheckedChange={handleToggleResources}
                        />
                      </div>
                      
                      {profileForm.showResources && (
                        <>
                          <div className="space-y-2 mt-4">
                            <Label htmlFor="resourcesDescription">Resources Section Description</Label>
                            <Textarea
                              id="resourcesDescription"
                              name="resourcesDescription"
                              value={profileForm.resourcesDescription}
                              onChange={handleProfileFormChange}
                              rows={2}
                              placeholder="E.g., Free educational resources to supplement your learning journey."
                            />
                            <p className="text-xs text-muted-foreground">
                              Brief introduction to your free resources section
                            </p>
                          </div>
                          
                          {profileForm.resources.map((resource, index) => (
                            <div key={index} className="pt-2 pb-4 border-b last:border-0 space-y-3">
                              <div className="flex justify-between items-center">
                                <Label>Resource {index + 1}</Label>
                                {profileForm.resources.length > 1 && (
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleRemoveResource(index)}
                                  >
                                    <Trash className="h-4 w-4 mr-1" />
                                    Remove
                                  </Button>
                                )}
                              </div>
                              
                              <div className="space-y-3">
                                <Input
                                  value={resource.title}
                                  onChange={(e) => handleUpdateResource(index, 'title', e.target.value)}
                                  placeholder="Resource Title"
                                />
                                
                                <Textarea
                                  value={resource.description}
                                  onChange={(e) => handleUpdateResource(index, 'description', e.target.value)}
                                  rows={2}
                                  placeholder="Brief description of this resource"
                                />
                                
                                <Input
                                  value={resource.url}
                                  onChange={(e) => handleUpdateResource(index, 'url', e.target.value)}
                                  placeholder="Resource URL (link to download or access)"
                                />
                                
                                <Input
                                  value={resource.buttonText}
                                  onChange={(e) => handleUpdateResource(index, 'buttonText', e.target.value)}
                                  placeholder="Button text (e.g., 'Download PDF', 'Access Resource')"
                                />
                              </div>
                            </div>
                          ))}
                          
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddResource}
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Another Resource
                          </Button>
                        </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>Manage which emails you receive</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNewSale">New Sale</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive an email when someone purchases your course
                      </p>
                    </div>
                    <Switch
                      id="emailNewSale"
                      checked={notificationSettings.emailNewSale}
                      onCheckedChange={() => handleNotificationToggle("emailNewSale")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNewReview">New Review</Label>
                      <p className="text-sm text-muted-foreground">Receive an email when someone reviews your course</p>
                    </div>
                    <Switch
                      id="emailNewReview"
                      checked={notificationSettings.emailNewReview}
                      onCheckedChange={() => handleNotificationToggle("emailNewReview")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNewStudent">New Student</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive an email when someone enrolls in your course
                      </p>
                    </div>
                    <Switch
                      id="emailNewStudent"
                      checked={notificationSettings.emailNewStudent}
                      onCheckedChange={() => handleNotificationToggle("emailNewStudent")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailMarketing">Marketing Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive emails about platform updates and creator tips
                      </p>
                    </div>
                    <Switch
                      id="emailMarketing"
                      checked={notificationSettings.emailMarketing}
                      onCheckedChange={() => handleNotificationToggle("emailMarketing")}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Browser Notifications</CardTitle>
                  <CardDescription>Manage in-app notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="browserNewSale">New Sale</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive a notification when someone purchases your course
                      </p>
                    </div>
                    <Switch
                      id="browserNewSale"
                      checked={notificationSettings.browserNewSale}
                      onCheckedChange={() => handleNotificationToggle("browserNewSale")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="browserNewReview">New Review</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive a notification when someone reviews your course
                      </p>
                    </div>
                    <Switch
                      id="browserNewReview"
                      checked={notificationSettings.browserNewReview}
                      onCheckedChange={() => handleNotificationToggle("browserNewReview")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="browserNewStudent">New Student</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive a notification when someone enrolls in your course
                      </p>
                    </div>
                    <Switch
                      id="browserNewStudent"
                      checked={notificationSettings.browserNewStudent}
                      onCheckedChange={() => handleNotificationToggle("browserNewStudent")}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveNotifications} disabled={saving}>
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
            </TabsContent>

            <TabsContent value="privacy" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Privacy Settings</CardTitle>
                  <CardDescription>Control your profile visibility and data sharing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="showProfilePublicly">Public Profile</Label>
                      <p className="text-sm text-muted-foreground">Make your profile visible to everyone</p>
                    </div>
                    <Switch
                      id="showProfilePublicly"
                      checked={privacySettings.showProfilePublicly}
                      onCheckedChange={() => handlePrivacyToggle("showProfilePublicly")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="showSocialLinks">Show Social Links</Label>
                      <p className="text-sm text-muted-foreground">
                        Display your social media links on your public profile
                      </p>
                    </div>
                    <Switch
                      id="showSocialLinks"
                      checked={privacySettings.showSocialLinks}
                      onCheckedChange={() => handlePrivacyToggle("showSocialLinks")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="allowStudentMessages">Student Messages</Label>
                      <p className="text-sm text-muted-foreground">Allow students to send you direct messages</p>
                    </div>
                    <Switch
                      id="allowStudentMessages"
                      checked={privacySettings.allowStudentMessages}
                      onCheckedChange={() => handlePrivacyToggle("allowStudentMessages")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="showRevenueStats">Revenue Statistics</Label>
                      <p className="text-sm text-muted-foreground">
                        Show your revenue statistics on your public profile
                      </p>
                    </div>
                    <Switch
                      id="showRevenueStats"
                      checked={privacySettings.showRevenueStats}
                      onCheckedChange={() => handlePrivacyToggle("showRevenueStats")}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSavePrivacy} disabled={saving}>
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
                  <CardTitle>Data & Security</CardTitle>
                  <CardDescription>Manage your account security and data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Two-Factor Authentication</h3>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                    <Button variant="outline" className="gap-2">
                      <Shield className="h-4 w-4" />
                      <span>Enable 2FA</span>
                    </Button>
                  </div>

                  <div className="pt-4 space-y-2">
                    <h3 className="text-lg font-medium">Download Your Data</h3>
                    <p className="text-sm text-muted-foreground">Get a copy of all your data on the platform</p>
                    <Button variant="outline">Request Data Export</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="social" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Social Media Links</CardTitle>
                  <CardDescription>Connect your social media accounts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="youtube">YouTube</Label>
                    <div className="flex">
                      <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                        <Youtube className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="youtube"
                        name="youtube"
                        value={socialLinks.youtube}
                        onChange={handleSocialLinksChange}
                        className="rounded-l-none"
                        placeholder="https://youtube.com/c/yourchannel"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your YouTube channel where you share educational content
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter</Label>
                    <div className="flex">
                      <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                        <Twitter className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="twitter"
                        name="twitter"
                        value={socialLinks.twitter}
                        onChange={handleSocialLinksChange}
                        className="rounded-l-none"
                        placeholder="https://twitter.com/yourhandle"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your Twitter profile for announcements and engagement
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <div className="flex">
                      <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                        <Facebook className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="facebook"
                        name="facebook"
                        value={socialLinks.facebook}
                        onChange={handleSocialLinksChange}
                        className="rounded-l-none"
                        placeholder="https://facebook.com/yourpage"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your Facebook page or profile
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <div className="flex">
                      <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                        <Instagram className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="instagram"
                        name="instagram"
                        value={socialLinks.instagram}
                        onChange={handleSocialLinksChange}
                        className="rounded-l-none"
                        placeholder="https://instagram.com/yourprofile"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your Instagram profile for visual content
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <div className="flex">
                      <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted">
                        <Linkedin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="linkedin"
                        name="linkedin"
                        value={socialLinks.linkedin}
                        onChange={handleSocialLinksChange}
                        className="rounded-l-none"
                        placeholder="https://linkedin.com/in/yourprofile"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your professional LinkedIn profile
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveSocialLinks} disabled={saving}>
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
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium">Creator Account</h3>
                  <p className="text-sm text-muted-foreground">Active since {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`p-2 ${youtubeConnected ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"} rounded-full`}
                >
                  <Youtube
                    className={`h-5 w-5 ${youtubeConnected ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}
                  />
                </div>
                <div>
                  <h3 className="font-medium">YouTube Connection</h3>
                  <p className="text-sm text-muted-foreground">{youtubeConnected ? "Connected" : "Not connected"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium">Payment Method</h3>
                  <p className="text-sm text-muted-foreground">Bank Account (••••4567)</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium">Public Profile</h3>
                  <p className="text-sm text-muted-foreground">
                    <a href={`/creators/${session?.user?.id}`} className="text-primary hover:underline">
                      View your public profile
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {!youtubeConnected && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-amber-800 dark:text-amber-300">YouTube Connection Required</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                    To upload videos or create live streams, you need to connect your YouTube account first.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => router.push("/dashboard/creator/service-connections")}
                  >
                    Connect YouTube Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>Irreversible account actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Delete Creator Account</h3>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete your creator account and all associated content.
                </p>
                <Button variant="destructive">Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
