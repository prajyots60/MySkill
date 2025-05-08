"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { Star, MessageSquare, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Review, ReviewStats } from "@/lib/types"
import ReviewForm from "./review-form"

interface CourseReviewsProps {
  courseId: string
  isEnrolled?: boolean
}

export default function CourseReviews({ courseId, isEnrolled = false }: CourseReviewsProps) {
  const { data: session } = useSession()
  const router = useRouter()
  
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showReviewForm, setShowReviewForm] = useState(false)
  
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/courses/${courseId}/reviews`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch reviews")
        }
        
        const data = await response.json()
        
        if (data.success) {
          setReviews(data.reviews)
          setStats(data.stats)
          setUserReview(data.userReview)
        }
      } catch (error) {
        console.error("Error fetching reviews:", error)
        toast({
          title: "Error",
          description: "Failed to load course reviews",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchReviews()
  }, [courseId])
  
  const handleWriteReviewClick = () => {
    if (!session) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to write a review",
      })
      router.push(`/auth/signin?callbackUrl=/content/${courseId}`)
      return
    }
    
    if (!isEnrolled) {
      toast({
        title: "Enrollment Required",
        description: "You must be enrolled in this course to write a review",
      })
      return
    }
    
    setShowReviewForm(true)
  }
  
  const handleReviewSubmitted = async () => {
    setShowReviewForm(false)
    setIsLoading(true)
    
    try {
      const response = await fetch(`/api/courses/${courseId}/reviews`)
      
      if (!response.ok) {
        throw new Error("Failed to reload reviews")
      }
      
      const data = await response.json()
      
      if (data.success) {
        setReviews(data.reviews)
        setStats(data.stats)
        setUserReview(data.userReview)
      }
    } catch (error) {
      console.error("Error reloading reviews:", error)
    } finally {
      setIsLoading(false)
    }
  }
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-40 w-full" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-semibold">Student Reviews</h3>
          <p className="text-muted-foreground">
            {stats?.totalReviews || 0} {stats?.totalReviews === 1 ? "review" : "reviews"} for this course
          </p>
        </div>
        
        {!showReviewForm && !userReview && (
          <Button 
            onClick={handleWriteReviewClick} 
            className="whitespace-nowrap"
          >
            <Star className="mr-2 h-4 w-4" />
            Write a Review
          </Button>
        )}
        
        {!showReviewForm && userReview && (
          <Button 
            variant="outline" 
            onClick={() => setShowReviewForm(true)}
            className="whitespace-nowrap"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Edit Your Review
          </Button>
        )}
      </div>
      
      {showReviewForm && (
        <div className="mb-6">
          <ReviewForm 
            courseId={courseId} 
            existingReview={userReview}
            onReviewSubmitted={handleReviewSubmitted}
            onCancel={() => setShowReviewForm(false)}
          />
        </div>
      )}
      
      {stats && stats.totalReviews > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rating summary */}
          <div className="bg-muted/30 rounded-lg p-6 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-4xl font-bold">{stats.averageRating.toFixed(1)}</span>
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i} 
                    className={cn(
                      "h-5 w-5",
                      i < Math.round(stats.averageRating) 
                        ? "fill-yellow-400 text-yellow-400" 
                        : "text-gray-300"
                    )} 
                  />
                ))}
              </div>
            </div>
            <p className="text-muted-foreground mb-4">
              Course Rating • {stats.totalReviews} {stats.totalReviews === 1 ? "review" : "reviews"}
            </p>
          </div>
          
          {/* Rating breakdown */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center gap-3">
                <div className="w-12 text-sm">{rating} stars</div>
                <div className="h-2 bg-muted rounded-full flex-1 overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full" 
                    style={{ width: `${stats.distribution[rating]?.percentage || 0}%` }}
                  ></div>
                </div>
                <div className="w-12 text-sm text-right text-muted-foreground">
                  {stats.distribution[rating]?.percentage || 0}%
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card className="bg-muted/10">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {session ? "Be the first to review this course!" : "This course has no reviews yet."}
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Reviews list */}
      {reviews.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium">What students are saying</h4>
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage 
                          src={review.user?.image || ""} 
                          alt={review.user?.name || "Anonymous"} 
                        />
                        <AvatarFallback>
                          {review.user?.name?.substring(0, 2) || "UN"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{review.user?.name || "Anonymous"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star 
                          key={i} 
                          className={cn(
                            "h-4 w-4",
                            i < review.rating 
                              ? "fill-yellow-400 text-yellow-400" 
                              : "text-gray-300"
                          )} 
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <div className="mt-2">
                      <p className="text-sm">{review.comment}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}