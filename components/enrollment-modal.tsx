"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

interface EnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseTitle: string
  price: number
}

export function EnrollmentModal({ isOpen, onClose, courseId, courseTitle, price }: EnrollmentModalProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleEnroll = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to enroll in the course")
      }

      toast({
        title: "Success",
        description: "You have successfully enrolled in the course!",
      })

      // Refresh the page to show the lecture content
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to enroll in the course. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Enroll in {courseTitle}</DialogTitle>
          <DialogDescription>
            To access this lecture, you need to enroll in the course. The course price is ${price}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleEnroll} disabled={isLoading}>
            {isLoading ? "Enrolling..." : `Enroll for $${price}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
