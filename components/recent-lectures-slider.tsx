"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Play } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"

interface RecentLecture {
  id: string
  title: string
  thumbnail?: string
  videoId?: string
  videoSource?: string
  createdAt: string
  courseName: string
  courseId: string
}

// Helper function to get thumbnail URL based on video source
const getThumbnailUrl = (lecture: RecentLecture): string => {
  // If there's a direct thumbnail URL, use it
  if (lecture.thumbnail) return lecture.thumbnail
  
  // If no videoId, return placeholder
  if (!lecture.videoId) return "/placeholder-video.svg"
  
  // Handle different video sources
  switch(lecture.videoSource) {
    case "YOUTUBE":
      return `https://img.youtube.com/vi/${lecture.videoId}/mqdefault.jpg`
    case "WASABI":
      return "/placeholder-video.svg"
    case "DAILYMOTION":
      return `https://www.dailymotion.com/thumbnail/video/${lecture.videoId}`
    default:
      return "/placeholder-video.svg"
  }
}

// Helper function to format time difference in a human-readable way
const formatTimeDifference = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`
  }
  
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  }
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

export function RecentLecturesSlider() {
  const [recentLectures, setRecentLectures] = useState<RecentLecture[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const sliderRef = useRef<HTMLDivElement>(null)

  // Function to scroll the slider
  const scrollSlider = (direction: "left" | "right") => {
    if (!sliderRef.current) return
    
    const scrollAmount = direction === "left" ? -320 : 320
    sliderRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" })
  }

  useEffect(() => {
    const fetchRecentLectures = async () => {
      try {
        setLoading(true)
        // Create a timestamp for cache-busting
        const cacheBustTimestamp = new Date().getTime().toString()
        
        const response = await fetch("/api/student/recent-lectures", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "X-Cache-Bust": cacheBustTimestamp
          },
        })

        const data = await response.json()

        if (!response.ok) {
          console.error("API error:", data.error || data.message)
          throw new Error(data.message || "Failed to fetch recent lectures")
        }

        if (!data.success) {
          console.error("API returned success=false:", data.error || data.message)
          throw new Error(data.message || "Failed to fetch recent lectures")
        }

        // Make sure we always have an array, even if the API returns null or undefined
        setRecentLectures(Array.isArray(data.lectures) ? data.lectures : [])
      } catch (error) {
        console.error("Error fetching recent lectures:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load recent lectures. Please try again later.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchRecentLectures()
  }, [])

  // Set up automatic sliding if there are more than 3 lectures
  useEffect(() => {
    if (recentLectures.length <= 3) return
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex + 1 >= recentLectures.length ? 0 : prevIndex + 1
        
        if (sliderRef.current) {
          const cardWidth = 280 // approximate width of a card + margin
          sliderRef.current.scrollTo({ left: nextIndex * cardWidth, behavior: "smooth" })
        }
        
        return nextIndex
      })
    }, 5000) // Change slide every 5 seconds
    
    return () => clearInterval(interval)
  }, [recentLectures.length])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Recently Added Lectures</h2>
        </div>
        <div className="flex gap-4 overflow-hidden py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="min-w-[280px] w-[280px] shadow-md border border-border/40 rounded-lg overflow-hidden">
              <div className="h-36 bg-muted animate-pulse rounded-t-lg"></div>
              <CardContent className="p-4">
                <div className="h-5 w-4/5 bg-muted animate-pulse mb-2 rounded-md"></div>
                <div className="h-4 w-2/3 bg-muted animate-pulse rounded-md"></div>
                <div className="flex justify-between mt-4">
                  <div className="h-3 w-1/3 bg-muted animate-pulse rounded-full"></div>
                  <div className="h-4 w-12 bg-muted/40 animate-pulse rounded-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (recentLectures.length === 0) {
    return null // Don't render anything if there are no recent lectures
  }

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Recently Added Lectures</h2>
        {recentLectures.length > 3 && (
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 rounded-full"
              onClick={() => scrollSlider("left")}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous</span>
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 rounded-full"
              onClick={() => scrollSlider("right")}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next</span>
            </Button>
          </div>
        )}
      </div>
      
      <div 
        className="grid grid-flow-col auto-cols-[85%] sm:auto-cols-[45%] md:auto-cols-[30%] lg:auto-cols-[23%] gap-4 overflow-x-auto hide-scrollbar py-1 snap-x snap-mandatory"
        ref={sliderRef}
      >
        {recentLectures.map((lecture, index) => (
          <Card 
            key={lecture.id} 
            className={cn(
              "w-full shadow-md hover:shadow-lg transition-all duration-200 border border-border/40 rounded-lg overflow-hidden snap-start",
              currentIndex === index && "ring-2 ring-green-500/50 border-green-500/30"
            )}
          >
            <Link href={`/content/${lecture.courseId}/player/${lecture.id}`} className="block">
              <div className="relative h-36 overflow-hidden rounded-t-lg">
                <img 
                  src={getThumbnailUrl(lecture)} 
                  alt={lecture.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-60"></div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                  <div className="h-12 w-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                    <Play className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                  {lecture.videoSource || "VIDEO"}
                </div>
              </div>
            </Link>
            <CardContent className="p-4">
              <Link href={`/content/${lecture.courseId}/player/${lecture.id}`} className="block">
                <h3 className="font-medium line-clamp-1 hover:text-primary transition-colors">
                  {lecture.title}
                </h3>
                <div className="flex items-center mt-1.5 mb-1">
                  <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                  <p className="text-sm text-muted-foreground line-clamp-1 flex-1">
                    {lecture.courseName}
                  </p>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-muted-foreground">
                    Added {formatTimeDifference(new Date(lecture.createdAt))}
                  </p>
                  <div className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-medium border border-green-500/20">
                    New
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
