"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"

// Simplified progress tracking hook
export function useVideoProgress(courseId: string, lectureId: string) {
  const { data: session } = useSession()
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load completion status on mount
  useEffect(() => {
    const fetchProgress = async () => {
      if (!session?.user?.id) return

      try {
        const response = await fetch(`/api/progress?lectureId=${lectureId}`)
        if (response.ok) {
          const data = await response.json()
          setCompleted(data.isComplete || false)
        }
      } catch (error) {
        console.error("Error fetching progress:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProgress()
  }, [lectureId, session?.user?.id])

  // Mark lecture as completed
  const markAsCompleted = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      setCompleted(true)

      await fetch("/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lectureId,
          isComplete: true,
        }),
      })
    } catch (error) {
      console.error("Error marking lecture as completed:", error)
      setCompleted(false)
    }
  }, [lectureId, session?.user?.id])

  // Get course completion percentage
  const getCourseCompletion = useCallback(async () => {
    if (!session?.user?.id) return 0

    try {
      const response = await fetch(`/api/progress?courseId=${courseId}`)
      if (response.ok) {
        const data = await response.json()
        return data.progress?.percentage || 0
      }
      return 0
    } catch (error) {
      console.error("Error calculating course completion:", error)
      return 0
    }
  }, [courseId, session?.user?.id])

  return {
    completed,
    loading,
    markAsCompleted,
    getCourseCompletion,
  }
}
