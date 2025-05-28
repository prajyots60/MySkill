"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  BookOpen,
  Clock,
  Users,
  Star,
  CheckCircle,
  BarChart3,
  GraduationCap,
  Calendar,
  Globe,
  Languages,
  MessageSquare,
  Share2,
  Bookmark,
  Loader2,
  Play,
  UserCheck,
  UserPlus,
  FileText,
  Gift,
  Lock,
  Facebook,
  Twitter,
  Linkedin,
  Phone,
  Mail,
  Copy,
} from "lucide-react"
import Link from "next/link"
import { SectionLectures } from "@/components/section-lectures"
import { toast } from "@/hooks/use-toast"
import type { User, Course, Section, Lecture, Document, Review, ReviewStats } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import dynamic from "next/dynamic"
import { Suspense } from "react"
import Image from "next/image"
import { useLocalStorageWithExpiry } from "@/hooks/use-local-storage"
import { useFollowData } from "@/hooks/use-follow-data"
import CourseReviews from "@/components/course-reviews"
import { CourseOverview } from "@/components/course-overview"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface CoursePageProps {
  contentId: string
}

const formatPrice = (price: number | null | undefined) => {
  if (price === null || price === undefined) return "Free"
  if (price === 0) return "Free"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

// Dynamically import non-critical components
const InstructorStats = dynamic(() => import("@/components/instructor-stats"), {
  loading: () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="min-h-[100px]">
          <CardHeader className="p-4">
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
        </Card>
      ))}
    </div>
  ),
})

const RelatedCourses = dynamic(() => import("@/components/related-courses"), {
  ssr: false,
})

// Fix CourseResources component import
const CourseResources = dynamic(() => import("@/components/course-resources").then(mod => mod.default), {
  loading: () => (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-32 mb-2" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  ),
})

export default function CoursePage({ contentId }: CoursePageProps) {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [course, setCourse] = useState<Course | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isBookmarking, setIsBookmarking] = useState(false)
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [cachedFollowerData, setCachedFollowerData] = useLocalStorageWithExpiry(
    `creator-followers-${course?.creatorId || "unknown"}`,
    { followerCount: 0 },
    15 // Cache for 15 minutes
  )
  const [followerCount, setFollowerCount] = useState(cachedFollowerData.followerCount)

  // Handle enrollment
  const handleEnroll = async () => {
    if (!session) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to enroll in this course",
      })
      router.push(`/auth/signin?callbackUrl=/content/${contentId}`)
      return
    }

    try {
      setIsEnrolling(true)

      const response = await fetch(`/api/courses/${contentId}/enrollment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to enroll")
      }

      setIsEnrolled(true)

      toast({
        title: "Successfully Enrolled!",
        description: "You can now access all course content",
        variant: "default",
      })

      // Redirect to first lecture if available
      if (sections.length > 0 && sections[0].lectures.length > 0) {
        router.push(`/content/${contentId}/player/${sections[0].lectures[0].id}`)
      }
    } catch (error) {
      console.error("Failed to enroll:", error)
      toast({
        title: "Enrollment Failed",
        description: error instanceof Error ? error.message : "Failed to enroll in course",
        variant: "destructive",
      })
    } finally {
      setIsEnrolling(false)
    }
  }

  // Check enrollment status
  const checkEnrollmentStatus = async () => {
    try {
      const response = await fetch(`/api/courses/${contentId}/enrollment`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setIsEnrolled(data.isEnrolled)
      }
    } catch (error) {
      console.error("Error checking enrollment status:", error)
    }
  }

  // Check bookmark status
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (session?.user) {
        try {
          const response = await fetch(`/api/courses/${contentId}/bookmark`)
          const data = await response.json()
          if (response.ok) {
            setIsBookmarked(data.isBookmarked)
          }
        } catch (error) {
          console.error("Error checking bookmark status:", error)
        }
      }
    }

    checkBookmarkStatus()
  }, [contentId, session?.user])

  // Handle bookmark toggle
  const toggleBookmark = async () => {
    if (!session) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to bookmark this course",
      })
      router.push(`/auth/signin?callbackUrl=/content/${contentId}`)
      return
    }

    try {
      setIsBookmarking(true)
      const response = await fetch(`/api/courses/${contentId}/bookmark`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to toggle bookmark")
      }

      setIsBookmarked(data.isBookmarked)
      toast({
        title: data.isBookmarked ? "Added to bookmarks" : "Removed from bookmarks",
        description: data.isBookmarked ? "Course added to your bookmarks" : "Course removed from your bookmarks",
      })
    } catch (error) {
      console.error("Failed to toggle bookmark:", error)
      toast({
        title: "Action Failed",
        description: error instanceof Error ? error.message : "Failed to toggle bookmark",
        variant: "destructive",
      })
    } finally {
      setIsBookmarking(false)
    }
  }

  // Fetch course data
  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        setLoading(true)
        const [courseResponse, enrollmentResponse, reviewsResponse] = await Promise.all([
          fetch(`/api/courses/${contentId}`),
          fetch(`/api/courses/${contentId}/enrollment`),
          fetch(`/api/courses/${contentId}/reviews`)
        ])

        if (!courseResponse.ok) {
          throw new Error("Failed to load course")
        }

        const courseData = await courseResponse.json()
        setCourse(courseData.course)
        setSections(courseData.course.sections || [])

        if (enrollmentResponse.ok) {
          const enrollmentData = await enrollmentResponse.json()
          setIsEnrolled(enrollmentData.isEnrolled)
        }

        // Process reviews data
        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json()
          if (reviewsData.success) {
            setStats(reviewsData.stats)
            setUserReview(reviewsData.userReview)
          }
        }

        // Only fetch related courses if user is a student
        if (session?.user?.role === "STUDENT") {
          try {
            const relatedResponse = await fetch(`/api/courses/${contentId}/related`)
            if (relatedResponse.ok) {
              const relatedData = await relatedResponse.json()
              // Handle related courses data if needed
            }
          } catch (error) {
            console.error("Error fetching related courses:", error)
          }
        }

        setLoading(false)
      } catch (error) {
        console.error("Error loading course data:", error)
        setError(error instanceof Error ? error.message : "Failed to load course")
        setLoading(false)
      }
    }

    if (contentId) {
      fetchCourseData()
    }
  }, [contentId, session?.user?.role])

  useEffect(() => {
    if (session?.user && contentId) {
      checkEnrollmentStatus()
    }
  }, [session, contentId])

  useEffect(() => {
    async function fetchFollowerCount() {
      if (!course?.creatorId) return
      try {
        // Use the existing follow endpoint that returns follower count
        const response = await fetch(`/api/users/${course.creatorId}/follow`)
        const data = await response.json()
        if (response.ok && data.followerCount !== undefined) {
          setFollowerCount(data.followerCount)
          setCachedFollowerData({ followerCount: data.followerCount })
        }
      } catch (error) {
        console.error("Error fetching follower count:", error)
      }
    }
    fetchFollowerCount()
  }, [course?.creatorId])

  const getTotalLectures = () => {
    return sections.reduce((total, section) => total + section.lectures.length, 0)
  }

  const getTotalDuration = () => {
    const totalSeconds = sections.reduce((total, section) => {
      return (
        total +
        section.lectures.reduce((sectionTotal, lecture) => {
          return sectionTotal + (lecture.duration || 0)
        }, 0)
      )
    }, 0)

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)

    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }
  
  // Handle sharing functionality
  const handleShare = (platform: string) => {
    if (!course) return
    
    // Get the current URL for sharing
    const currentUrl = typeof window !== 'undefined' 
      ? window.location.href 
      : `${process.env.NEXT_PUBLIC_APP_URL || ''}/content/${contentId}`;
      
    const courseTitle = encodeURIComponent(course.title);
    const courseDesc = encodeURIComponent(course.description || "Check out this course!");
    
    switch (platform) {
      case "facebook":
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`, "_blank");
        break;
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}&text=${courseTitle}`, "_blank");
        break;
      case "linkedin":
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`, "_blank");
        break;
      case "whatsapp":
        window.open(`https://api.whatsapp.com/send?text=${courseTitle}%20-%20${encodeURIComponent(currentUrl)}`, "_blank");
        break;
      case "gmail":
        window.open(`https://mail.google.com/mail/u/0/?view=cm&fs=1&to=&su=${courseTitle}&body=${courseDesc}%0A%0A${encodeURIComponent(currentUrl)}&tf=1`, "_blank");
        break;
      case "email":
        window.open(`mailto:?subject=${courseTitle}&body=${courseDesc}%0A%0A${encodeURIComponent(currentUrl)}`, "_blank");
        break;
      case "copy":
        if (navigator.clipboard) {
          navigator.clipboard.writeText(currentUrl)
            .then(() => {
              toast({
                title: "Link Copied!",
                description: "Course link has been copied to your clipboard",
                variant: "default",
              });
            })
            .catch((err) => {
              console.error("Failed to copy: ", err);
              toast({
                title: "Copy Failed",
                description: "Could not copy the link. Please try again.",
                variant: "destructive",
              });
            });
        } else {
          // Fallback for browsers without clipboard API
          const textArea = document.createElement("textarea");
          textArea.value = currentUrl;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            toast({
              title: "Link Copied!",
              description: "Course link has been copied to your clipboard",
              variant: "default",
            });
          } catch (err) {
            console.error("Fallback: Failed to copy: ", err);
            toast({
              title: "Copy Failed",
              description: "Could not copy the link. Please try again.",
              variant: "destructive",
            });
          }
          document.body.removeChild(textArea);
        }
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen pb-12">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background pt-8 pb-12 border-b">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="lg:w-2/3 space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-6 w-20" />
                    ))}
                  </div>
                  <Skeleton className="h-12 w-3/4" />
                  <Skeleton className="h-24 w-full" />
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:w-1/3">
                <Card className="overflow-hidden border-none shadow-lg">
                  <div className="aspect-video relative">
                    <Skeleton className="absolute inset-0" />
                  </div>
                  <CardContent className="p-6">
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                      <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        ))}
                      </div>
                      <Skeleton className="h-10 w-full" />
                      <div className="grid grid-cols-2 gap-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 text-center">
        <h1 className="text-3xl font-bold mb-6">Error Loading Course</h1>
        <p className="mb-6">{error}</p>
        <Button asChild>
          <Link href="/explore">Browse Courses</Link>
        </Button>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 text-center">
        <h1 className="text-3xl font-bold mb-6">Course Not Found</h1>
        <p className="mb-6">The course you are looking for does not exist or has been removed.</p>
        <Button asChild>
          <Link href="/explore">Browse Courses</Link>
        </Button>
      </div>
    )
  }

  const isCreator = session?.user?.id === course.creatorId
  const isAdmin = session?.user?.role === "ADMIN"
  const hasAccess = isEnrolled || isCreator || isAdmin

  return (
    <div className="bg-background min-h-screen pb-12">
      {/* Hero section with gradient background */}
      <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-background pt-6 md:pt-10 pb-12 border-b">
        <div className="container mx-auto px-4 md:px-6">
          {/* Course header section */}
          <div className="flex flex-col md:flex-row gap-6 md:gap-12">
            {/* Left content - course details */}
            <div className="w-full lg:w-7/12 space-y-5">
              {/* Course category tags */}
              <div className="flex flex-wrap gap-2">
                {course.tags && course.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors border-none">
                    {tag}
                  </Badge>
                ))}
        
              </div>
              
              {/* Course title and description */}
              <div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3">{course.title}</h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">{course.description}</p>
              </div>
              
              {/* Key stats banner */}                  <div className="flex flex-wrap items-center gap-4 mt-2 bg-background/40 backdrop-blur-sm p-3 rounded-lg border border-border/30">
                <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-full">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-medium">{stats?.averageRating?.toFixed(1) || "0.0"}</span>
                  <span className="text-sm text-muted-foreground ml-1">
                    ({stats?.totalReviews || 0} reviews)
                  </span>
                </div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{course._count?.enrollments || 0} students enrolled</span>
                </div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span>{getTotalLectures()} lectures</span>
                </div>

              </div>
              
              {/* Instructor section */}
              <div className="flex items-center gap-4 bg-background/40 backdrop-blur-sm p-4 rounded-lg border border-border/30">
                <Link href={`/creators/${course.creatorId}`} className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 border-2 border-primary/20">
                    <AvatarImage
                      src={course.creator?.image || "/placeholder.svg"}
                      alt={course.creator?.name || ""}
                      className="object-cover"
                      width={56}
                      height={56}
                    />
                    <AvatarFallback>{course.creator?.name?.charAt(0) || "C"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-lg">{course.creator?.name}</div>
                    <p className="text-sm text-muted-foreground">Course Instructor</p>
                  </div>
                </Link>
                
                <div className="ml-auto flex flex-col md:flex-row items-start md:items-center gap-3">
                  <div className="text-sm text-muted-foreground flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {followerCount} followers
                  </div>
                  
                  {session?.user && course?.creatorId !== session.user.id && (
                    <FollowButton
                      creatorId={course.creatorId}
                      onFollowChange={(isFollowing, count) => {
                        setFollowerCount(count)
                      }}
                    />
                  )}
                </div>
              </div>
              
              {/* What you'll learn section - preview on desktop */}
              <div className="hidden md:block bg-background/40 backdrop-blur-sm p-4 rounded-lg border border-border/30">
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <CheckCircle className="h-5 w-5 text-primary mr-2" />
                  What you'll learn
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    "Understand the fundamentals of HTML, CSS, and JavaScript",
                    "Build responsive websites from scratch",
                    "Create interactive web pages with JavaScript",
                    "Implement modern CSS layouts using Flexbox and Grid",
                  ].slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right content - course card */}
            <div className="w-full lg:w-5/12">
              <div className="sticky top-4">
                <Card className="overflow-hidden border-none shadow-xl">
                  {/* Course thumbnail with overlay */}
                  <div className="aspect-video overflow-hidden relative">
                    <Image
                      src={course.thumbnail || "/placeholder.svg"}
                      alt={course.title}
                      width={640}
                      height={360}
                      className="object-cover transition-transform hover:scale-105 duration-700"
                      priority
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx4eHRoaHSQtJSAyVC08MTY3LjIyOkFTRjo9Tj4yMkhiSk46X2FfYDlMY1hgiV9fYW3/2wBDARUXFx4aHR4eHV9BNzJBX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX1//wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                    />
                    
                    {/* Play preview button overlay */}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => {
                      // Preview video handler
                      toast({
                        title: "Coming Soon",
                        description: "Video preview will be available soon"
                      })
                    }}>
                      <div className="h-16 w-16 rounded-full bg-primary/80 text-white flex items-center justify-center">
                        <Play className="h-8 w-8 ml-1" />
                      </div>
                    </div>
                  </div>

                  {/* Card content */}
                  <CardContent className="p-6 bg-card">
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <p className="text-3xl font-bold">{course.price ? formatPrice(course.price) : "Free"}</p>
                          {course.originalPrice && course.originalPrice > (course.price ?? 0) && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground line-through">{formatPrice(course.originalPrice)}</span>
                              <Badge variant="destructive" className="bg-red-500">
                                {Math.round((1 - ((course.price ?? 0) / (course.originalPrice ?? 1))) * 100)}% off
                              </Badge>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleBookmark}
                          disabled={isBookmarking}
                          className="text-muted-foreground hover:text-primary"
                        >
                          {isBookmarking ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Bookmark className={`h-5 w-5 ${isBookmarked ? "fill-current" : ""}`} />
                          )}
                        </Button>
                      </div>
                      
                    </div>

                    {/* Course features */}
                    <div className="space-y-4 text-sm mb-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {course.courseStatus && (
                          <Badge variant="outline" className={cn(
                            "px-2 py-0.5",
                            course.courseStatus === "UPCOMING" && "bg-blue-500/10 text-blue-500 border-blue-200",
                            course.courseStatus === "ONGOING" && "bg-green-500/10 text-green-500 border-green-200",
                            course.courseStatus === "COMPLETED" && "bg-amber-500/10 text-amber-500 border-amber-200"
                          )}>
                            <Calendar className="h-3.5 w-3.5 mr-1" />
                            {course.courseStatus.charAt(0) + course.courseStatus.slice(1).toLowerCase()}
                          </Badge>
                        )}
                        
                        {course.deliveryMode && (
                          <Badge variant="outline" className={cn(
                            "px-2 py-0.5",
                            course.deliveryMode === "VIDEO" && "bg-blue-500/10 text-blue-500 border-blue-200",
                            course.deliveryMode === "LIVE" && "bg-red-500/10 text-red-500 border-red-200",
                            course.deliveryMode === "HYBRID" && "bg-purple-500/10 text-purple-500 border-purple-200"
                          )}>
                            {course.deliveryMode === "VIDEO" && "Pre-recorded"}
                            {course.deliveryMode === "LIVE" && "Live Sessions"}
                            {course.deliveryMode === "HYBRID" && "Hybrid Format"}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        <span>Available on web and mobile</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Languages className="h-4 w-4 text-primary" />
                        <span>
                          {course.language ? course.language : "English"}
                        </span>
                      </div>
                      
                      {course.accessDuration && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <span>Access for {course.accessDuration} {course.accessDuration === 1 ? "month" : "months"}</span>
                        </div>
                      )}
                      
                     
                    </div>

                    {/* Call to action */}
                    <Button
                      size="lg"
                      className="w-full gap-2 mb-4"
                      onClick={course.price === 0 ? handleEnroll : () => router.push("/paid")}
                      disabled={isEnrolling}
                    >
                      {isEnrolling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enrolling...
                        </>
                      ) : isEnrolled ? (
                        <>
                          <Play className="h-4 w-4" />
                          Start Learning
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4" />
                          {course.price === 0 ? "Enroll Now - Free" : `Enroll Now • ${formatPrice(course.price)}`}
                        </>
                      )}
                    </Button>

                    {/* Action buttons - Share only */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full gap-2">
                          <Share2 className="h-4 w-4" />
                          <span>Share</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-56">
                        <DropdownMenuLabel>Share this course</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleShare("facebook")}
                          className="cursor-pointer"
                        >
                          <div className="bg-blue-600 rounded-full h-5 w-5 flex items-center justify-center mr-2">
                            <Facebook className="h-3 w-3 text-white" />
                          </div>
                          <span>Facebook</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleShare("twitter")}
                          className="cursor-pointer"
                        >
                          <div className="bg-sky-500 rounded-full h-5 w-5 flex items-center justify-center mr-2">
                            <Twitter className="h-3 w-3 text-white" />
                          </div>
                          <span>Twitter</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleShare("linkedin")}
                          className="cursor-pointer"
                        >
                          <div className="bg-blue-700 rounded-full h-5 w-5 flex items-center justify-center mr-2">
                            <Linkedin className="h-3 w-3 text-white" />
                          </div>
                          <span>LinkedIn</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleShare("whatsapp")}
                          className="cursor-pointer"
                        >
                          <div className="bg-green-500 rounded-full h-5 w-5 flex items-center justify-center mr-2">
                            <Phone className="h-3 w-3 text-white" />
                          </div>
                          <span>WhatsApp</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleShare("gmail")}
                          className="cursor-pointer"
                        >
                          <div className="bg-red-500 rounded-full h-5 w-5 flex items-center justify-center mr-2">
                            <Mail className="h-3 w-3 text-white" />
                          </div>
                          <span>Gmail</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleShare("email")}
                          className="cursor-pointer"
                        >
                          <div className="bg-gray-500 rounded-full h-5 w-5 flex items-center justify-center mr-2">
                            <Mail className="h-3 w-3 text-white" />
                          </div>
                          <span>Email</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleShare("copy")}
                          className="cursor-pointer"
                        >
                          <div className="bg-primary/10 rounded-full h-5 w-5 flex items-center justify-center mr-2">
                            <Copy className="h-3 w-3 text-primary" />
                          </div>
                          <span>Copy Link</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Suspense fallback={<Skeleton className="h-[200px]" />}>
              <Tabs defaultValue="curriculum" className="space-y-6">
                <TabsList className="bg-muted/50 p-1 inline-flex h-12 items-center justify-center rounded-md w-full lg:w-auto overflow-x-auto">
                  <TabsTrigger value="curriculum" className="rounded-sm data-[state=active]:bg-background">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Curriculum
                  </TabsTrigger>
                  <TabsTrigger value="overview" className="rounded-sm data-[state=active]:bg-background">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="resources" 
                    className="rounded-sm data-[state=active]:bg-background"
                    disabled={(course.price ?? 0) > 0 && !hasAccess}
                  >
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Resources
                      {(course.price ?? 0) > 0 && !hasAccess && (
                        <Lock className="h-3 w-3 ml-2 text-muted-foreground" />
                      )}
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="reviews" className="rounded-sm data-[state=active]:bg-background">
                    <Star className="h-4 w-4 mr-2" />
                    Reviews
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="curriculum" className="space-y-6">
                  <Card className="border-none shadow-md">
                    <CardHeader className="bg-muted/30">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center">
                          <BookOpen className="h-5 w-5 mr-2 text-primary" />
                          Course Content
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/50 px-3 py-1.5 rounded-full">
                          <BookOpen className="h-4 w-4" />
                          <span>{getTotalLectures()} lectures</span>
                        </div>
                      </div>
                      <CardDescription>
                        {sections.length} sections • {hasAccess ? "Full access" : "Preview available"}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4">
                      {sections.length === 0 ? (
                        <div className="text-center py-12 bg-muted/30 rounded-lg">
                          <p className="text-muted-foreground">No content available for this course yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {sections.map((section, index) => (
                            <Card key={section.id} className="overflow-hidden border shadow-sm">
                              <CardHeader className="bg-muted/20 py-3 px-4">
                                <div className="flex justify-between items-center">
                                  <CardTitle className="text-lg font-medium flex items-center">
                                    <span className="bg-primary/10 text-primary h-6 w-6 rounded-full flex items-center justify-center text-sm mr-2">
                                      {index + 1}
                                    </span>
                                    {section.title}
                                  </CardTitle>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                      {section.lectures.length} {section.lectures.length === 1 ? "lecture" : "lectures"}
                                    </Badge>
                                    {section.lectures.length > 0 && (
                                      <div className="text-xs text-muted-foreground">
                                        {Math.floor(section.lectures.reduce((total, lecture) => total + (lecture.duration || 0), 0) / 60)} min
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="p-0">
                                <SectionLectures
                                  section={section}
                                  courseId={contentId}
                                  isEnrolled={isEnrolled || isCreator || isAdmin}
                                  isFreeCourse={course.price === 0 || course.price === null}
                                  showEditControls={isCreator}
                                  onAddLecture={isCreator ? () => {/* ... */} : undefined}
                                  onEditLecture={isCreator ? () => {/* ... */} : undefined}
                                  onDeleteLecture={isCreator ? () => {/* ... */} : undefined}
                                />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="overview">
                  <CourseOverview 
                    courseId={contentId}
                    isCreator={isCreator}
                  />
                </TabsContent>

                <TabsContent value="resources" className="space-y-6">
                  {(course.price ?? 0) > 0 && !hasAccess ? (
                    <Card className="border-none shadow-md">
                      <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                          <Lock className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold">Resources Locked</h3>
                        <p className="text-muted-foreground max-w-md">
                          Course resources are only available to enrolled students. Enroll in this course to access downloadable materials, code samples, and other resources.
                        </p>
                        <Button 
                          className="mt-2 gap-2"
                          onClick={course.price === 0 ? handleEnroll : () => router.push("/paid")}
                        >
                          <BookOpen className="h-4 w-4" />
                          Enroll Now • {formatPrice(course.price)}
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-none shadow-md">
                      <CardHeader className="bg-muted/30">
                        <CardTitle className="flex items-center">
                          <FileText className="h-5 w-5 mr-2 text-primary" />
                          Course Resources
                        </CardTitle>
                        <CardDescription>
                          {isCreator 
                            ? "Manage downloadable resources for this course" 
                            : "Download materials provided by the instructor"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        <CourseResources 
                          courseId={contentId} 
                          isCreator={isCreator} 
                          title="Course Resources" 
                          description="General materials for the entire course"
                        />
                        
                        {sections.length > 0 && (
                          <div className="space-y-4 mt-8">
                            <h3 className="text-xl font-semibold flex items-center">
                              <FileText className="h-5 w-5 text-primary mr-2" />
                              Section Resources
                            </h3>
                            <div className="grid gap-6 md:grid-cols-2">
                              {sections.map((section) => (
                                <CourseResources
                                  key={section.id}
                                  courseId={contentId}
                                  sectionId={section.id}
                                  isCreator={isCreator}
                                  title={`Section: ${section.title}`}
                                  description="Materials specific to this section"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="reviews">
                  <Card className="border-none shadow-md">
                    <CardHeader className="bg-muted/30">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center">
                          <Star className="h-5 w-5 mr-2 text-primary" />
                          Student Reviews
                        </CardTitle>
                        <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-full">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="font-medium">{stats?.averageRating.toFixed(1) || "0.0"}</span>
                          <span className="text-sm text-muted-foreground ml-1">
                            ({stats?.totalReviews || 0} reviews)
                          </span>
                        </div>
                      </div>
                      <CardDescription>See what students are saying about this course</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <CourseReviews courseId={contentId} isEnrolled={isEnrolled} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </Suspense>
          </div>

          <div className="lg:col-span-1 space-y-6">
            {/* Featured instructor card */}
            <Card className="border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg">About the Instructor</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex flex-col items-center text-center">
                  <Link href={`/creators/${course.creatorId}`} className="mb-3">
                    <Avatar className="h-20 w-20 border-2 border-primary/20">
                      <AvatarImage
                        src={course.creator?.image || "/placeholder.svg"}
                        alt={course.creator?.name || ""}
                        className="object-cover"
                      />
                      <AvatarFallback>{course.creator?.name?.charAt(0) || "C"}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <Link href={`/creators/${course.creatorId}`}>
                    <h3 className="font-medium text-lg mb-1">{course.creator?.name}</h3>
                  </Link>
                  <p className="text-sm text-muted-foreground mb-3">
                    {(course.creator as any)?.title || "Course Instructor"}
                  </p>
                  <div className="flex items-center justify-center gap-3 mb-4 text-sm">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-amber-500 fill-current mr-1" />
                      <span className="font-medium">{stats?.averageRating.toFixed(1) || "0.0"}</span>
                    </div>
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 text-muted-foreground mr-1" />
                      <span>3 Courses</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-muted-foreground mr-1" />
                      <span>{followerCount} students</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4">
                    {(course.creator as any)?.bio || 
                    "Experienced instructor passionate about teaching and helping students master new skills."}
                  </p>
                  
                  <div className="w-full">
                    <Link href={`/creators/${course.creatorId}`}>
                      <Button variant="outline" className="w-full">View Profile</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Related courses */}
            {session?.user?.role === "STUDENT" && (
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <RelatedCourses courseId={contentId} />
              </Suspense>
            )}
            
            {/* Course guarantees */}
            <Card className="border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 py-4">
                <CardTitle className="text-lg flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-primary" />
                  Course Guarantees
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <ul className="space-y-4">
                  <li className="flex gap-3">
                    <div className="bg-primary/10 rounded-full p-1 h-7 w-7 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Lifetime Access</h4>
                      <p className="text-sm text-muted-foreground">Learn at your own pace with unlimited access</p>
                    </div>
                  </li>
                  
                  <li className="flex gap-3">
                    <div className="bg-primary/10 rounded-full p-1 h-7 w-7 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Certificate of Completion</h4>
                      <p className="text-sm text-muted-foreground">Receive a certificate when you complete the course</p>
                    </div>
                  </li>
                  
                  <li className="flex gap-3">
                    <div className="bg-primary/10 rounded-full p-1 h-7 w-7 flex items-center justify-center shrink-0">
                      <Globe className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Mobile Access</h4>
                      <p className="text-sm text-muted-foreground">Learn on any device - desktop, tablet, or mobile</p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

interface FollowButtonProps {
  creatorId?: string
  onFollowChange: (isFollowing: boolean, followerCount: number) => void
}

function FollowButton({ creatorId, onFollowChange }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { data: session } = useSession()

  useEffect(() => {
    async function checkFollowStatus() {
      if (!creatorId || !session?.user) return

      try {
        const response = await fetch(`/api/users/${creatorId}/follow`)
        const data = await response.json()
        setIsFollowing(data.isFollowing)
        if (data.followerCount !== undefined) {
          onFollowChange(data.isFollowing, data.followerCount)
        }
      } catch (error) {
        console.error("Error checking follow status:", error)
      }
    }

    checkFollowStatus()
  }, [creatorId, session?.user, onFollowChange])

  const handleFollow = async () => {
    if (!creatorId || !session?.user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to follow this instructor",
      })
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch(`/api/users/${creatorId}/follow`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to update follow status")
      }

      setIsFollowing(data.isFollowing)
      if (data.followerCount !== undefined) {
        onFollowChange(data.isFollowing, data.followerCount)
      }

      toast({
        title: data.isFollowing ? "Following" : "Unfollowed",
        description: data.isFollowing ? "You are now following this instructor" : "You have unfollowed this instructor",
      })
    } catch (error) {
      console.error("Error toggling follow:", error)
      toast({
        title: "Action Failed",
        description: error instanceof Error ? error.message : "Failed to update follow status",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleFollow}
      disabled={isLoading}
      className={cn("gap-2", isFollowing && "bg-primary/10 text-primary hover:bg-primary/20")}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        isFollowing ? (
          <UserCheck className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )
      )}
      {isFollowing ? "Following" : "Follow"}
    </Button>
  )
}
