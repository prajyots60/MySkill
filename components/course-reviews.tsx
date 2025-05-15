"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Rating } from "@/components/ui/rating"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star, Loader2, Edit, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"

interface Review {
  id: string
  userId: string
  userName: string
  userImage?: string
  rating: number
  comment: string
  createdAt: string
  updatedAt: string
}

interface ReviewStats {
  averageRating: number
  totalReviews: number
  distribution: {
    [key: number]: number
  }
}

interface CourseReviewsProps {
  courseId: string
  isEnrolled: boolean
}

export default function CourseReviews({ courseId, isEnrolled }: CourseReviewsProps) {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newRating, setNewRating] = useState(5)
  const [comment, setComment] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  // Fetch reviews
  useEffect(() => {
    async function fetchReviews() {
      try {
        setLoading(true)
        const response = await fetch(`/api/courses/${courseId}/reviews`)
        
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setReviews(data.reviews || [])
            setStats(data.stats || null)
            setUserReview(data.userReview || null)
          }
        }
      } catch (error) {
        console.error("Error fetching reviews:", error)
      } finally {
        setLoading(false)
      }
    }

    if (courseId) {
      fetchReviews()
    }
  }, [courseId])

  const handleSubmitReview = async () => {
    if (!session?.user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to leave a review",
        variant: "destructive"
      })
      return
    }

    if (newRating < 1) {
      toast({
        title: "Rating required",
        description: "Please select a rating",
        variant: "destructive"
      })
      return
    }

    try {
      setSubmitLoading(true)
      
      const method = isEditing ? "PUT" : "POST"
      const endpoint = isEditing 
        ? `/api/courses/${courseId}/reviews/${userReview?.id}` 
        : `/api/courses/${courseId}/reviews`
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rating: newRating,
          comment: comment.trim() || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit review")
      }

      // Update stats and reviews
      setStats(data.stats)
      
      if (isEditing) {
        // Update the existing review in the list
        setReviews(reviews.map(review => 
          review.id === userReview?.id ? data.review : review
        ))
        setUserReview(data.review)
      } else {
        // Add the new review to the list
        setReviews([data.review, ...reviews])
        setUserReview(data.review)
      }

      setDialogOpen(false)
      toast({
        title: isEditing ? "Review updated" : "Review submitted",
        description: isEditing 
          ? "Your review has been updated successfully" 
          : "Thank you for sharing your feedback!"
      })
    } catch (error) {
      console.error("Error submitting review:", error)
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Failed to submit review",
        variant: "destructive"
      })
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleEditReview = () => {
    if (userReview) {
      setNewRating(userReview.rating)
      setComment(userReview.comment)
      setIsEditing(true)
      setDialogOpen(true)
    }
  }

  const handleAddReview = () => {
    setNewRating(5)
    setComment("")
    setIsEditing(false)
    setDialogOpen(true)
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
        
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-medium text-lg">Student Feedback</h3>
          <p className="text-sm text-muted-foreground">
            {stats?.totalReviews || 0} reviews • {stats?.averageRating.toFixed(1) || "0.0"} average rating
          </p>
        </div>
        
        {session?.user && isEnrolled && (
          userReview ? (
            <Button 
              variant="outline" 
              onClick={handleEditReview}
              className="gap-2"
            >
              <Edit size={16} />
              Edit Your Review
            </Button>
          ) : (
            <Button onClick={handleAddReview} className="gap-2">
              <Star size={16} />
              Write a Review
            </Button>
          )
        )}
      </div>
      
      {/* Rating distribution */}
      {stats && (
        <div className="bg-muted/20 rounded-lg p-5 border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col items-center justify-center">
              <div className="text-5xl font-bold mb-2">{stats.averageRating.toFixed(1)}</div>
              <div className="flex mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    size={20} 
                    className={star <= Math.round(stats.averageRating) 
                      ? "text-amber-500 fill-amber-500" 
                      : "text-muted"} 
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{stats.totalReviews} ratings</p>
            </div>
            
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = stats.distribution[rating] || 0
                const percentage = stats.totalReviews ? Math.round((count / stats.totalReviews) * 100) : 0
                
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="w-12 text-sm flex items-center gap-1">
                      {rating} <Star size={12} className="fill-amber-500 text-amber-500" />
                    </div>
                    <div className="h-2 bg-muted rounded-full flex-1 overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="w-12 text-xs text-right text-muted-foreground">
                      {percentage}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* User's review */}
      {userReview && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <Avatar>
                <AvatarImage src={userReview.userImage || "/placeholder.svg"} alt={userReview.userName} />
                <AvatarFallback>{userReview.userName?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex justify-between">
                  <div className="font-medium">{userReview.userName} <Badge variant="outline">You</Badge></div>
                  <div className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(userReview.createdAt), { addSuffix: true })}
                  </div>
                </div>
                
                <div className="flex mt-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      size={16} 
                      className={star <= userReview.rating 
                        ? "text-amber-500 fill-amber-500" 
                        : "text-muted"} 
                    />
                  ))}
                </div>
                
                {userReview.comment && (
                  <p className="text-muted-foreground">{userReview.comment}</p>
                )}
                
                <div className="mt-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleEditReview}
                    className="h-8 text-xs gap-1"
                  >
                    <Edit size={12} />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Other reviews */}
      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews
            .filter(review => !userReview || review.id !== userReview.id)
            .map(review => (
              <Card key={review.id}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Avatar>
                      <AvatarImage src={review.userImage || "/placeholder.svg"} alt={review.userName} />
                      <AvatarFallback>{review.userName?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="font-medium">{review.userName}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                      
                      <div className="flex mt-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            size={16} 
                            className={star <= review.rating 
                              ? "text-amber-500 fill-amber-500" 
                              : "text-muted"} 
                          />
                        ))}
                      </div>
                      
                      {review.comment && (
                        <p className="text-muted-foreground">{review.comment}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-muted/20 rounded-lg border">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Reviews Yet</h3>
          <p className="text-muted-foreground mb-4">Be the first to review this course!</p>
          
          {session?.user && isEnrolled && !userReview && (
            <Button onClick={handleAddReview} className="gap-2">
              <Star size={16} />
              Write a Review
            </Button>
          )}
        </div>
      )}
      
      {/* Review dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Your Review" : "Write a Review"}</DialogTitle>
            <DialogDescription>
              Share your experience with this course to help other students
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rating">Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewRating(star)}
                    className="rounded-md p-1 hover:bg-muted/50 transition-colors"
                  >
                    <Star 
                      size={24} 
                      className={star <= newRating 
                        ? "text-amber-500 fill-amber-500" 
                        : "text-muted hover:text-amber-400"} 
                    />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="comment">Review (optional)</Label>
              <Textarea
                id="comment"
                placeholder="Share your thoughts about this course..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={submitLoading}>
              {submitLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Submitting..."}
                </>
              ) : (
                isEditing ? "Update Review" : "Submit Review"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}