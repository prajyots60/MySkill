"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Review } from "@/lib/types"

interface ReviewFormProps {
  courseId: string
  existingReview?: Review | null
  onReviewSubmitted?: () => void
  onCancel?: () => void
}

export default function ReviewForm({ courseId, existingReview, onReviewSubmitted, onCancel }: ReviewFormProps) {
  const { data: session } = useSession()
  const router = useRouter()
  
  const [rating, setRating] = useState<number>(existingReview?.rating || 0)
  const [comment, setComment] = useState<string>(existingReview?.comment || "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hoverRating, setHoverRating] = useState<number>(0)
  
  const handleStarClick = (selectedRating: number) => {
    setRating(selectedRating)
  }
  
  const handleStarHover = (hoveredRating: number) => {
    setHoverRating(hoveredRating)
  }
  
  const handleStarLeave = () => {
    setHoverRating(0)
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!session) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to submit a review",
      })
      router.push(`/auth/signin?callbackUrl=/content/${courseId}`)
      return
    }
    
    if (rating < 1) {
      toast({
        title: "Rating Required",
        description: "Please select a star rating before submitting",
        variant: "destructive",
      })
      return
    }
    
    try {
      setIsSubmitting(true)
      
      const response = await fetch(`/api/courses/${courseId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rating, comment }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to submit review")
      }
      
      toast({
        title: data.isUpdate ? "Review Updated" : "Review Submitted",
        description: data.isUpdate 
          ? "Your review has been updated successfully" 
          : "Thank you for your feedback!",
      })
      
      // Optional callback when review is submitted successfully
      if (onReviewSubmitted) {
        onReviewSubmitted()
      }
      
      // Refresh the page to show the updated review
      router.refresh()
    } catch (error) {
      console.error("Error submitting review:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit review",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleDelete = async () => {
    if (!existingReview) return
    
    if (!confirm("Are you sure you want to delete your review?")) {
      return
    }
    
    try {
      setIsSubmitting(true)
      
      const response = await fetch(`/api/courses/${courseId}/reviews`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to delete review")
      }
      
      toast({
        title: "Review Deleted",
        description: "Your review has been removed successfully",
      })
      
      // Reset form fields
      setRating(0)
      setComment("")
      
      // Optional callback when review is deleted successfully
      if (onReviewSubmitted) {
        onReviewSubmitted()
      }
      
      // Refresh the page to show the updated review list
      router.refresh()
    } catch (error) {
      console.error("Error deleting review:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete review",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const renderStars = () => {
    return Array.from({ length: 5 }).map((_, index) => {
      const starValue = index + 1
      const isFilled = (hoverRating || rating) >= starValue
      
      return (
        <Star
          key={starValue}
          className={cn(
            "h-8 w-8 cursor-pointer transition-all",
            isFilled
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300 dark:text-gray-600"
          )}
          onClick={() => handleStarClick(starValue)}
          onMouseEnter={() => handleStarHover(starValue)}
          onMouseLeave={handleStarLeave}
        />
      )
    })
  }
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle>{existingReview ? "Edit Your Review" : "Write a Review"}</CardTitle>
        <CardDescription>
          {existingReview
            ? "Update your rating and feedback for this course"
            : "Share your experience with other students"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm text-muted-foreground">Select your rating:</p>
            <div className="flex items-center space-x-1">
              {renderStars()}
            </div>
            {rating > 0 && (
              <p className="text-sm font-medium">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Write your review (optional):</p>
            <Textarea
              placeholder="Share your experience with this course..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div>
            {existingReview && (
              <Button 
                type="button" 
                variant="outline" 
                className="text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Delete Review
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isSubmitting || rating < 1}
            >
              {isSubmitting 
                ? "Submitting..." 
                : existingReview 
                  ? "Update Review" 
                  : "Submit Review"}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}