"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"

interface LectureProgress {
  lectureId: string
  progress: number
  position: number
  completed: boolean
  lastUpdated: number
}

interface CourseProgress {
  [courseId: string]: LectureProgress[]
}

export function useVideoProgress(courseId: string, lectureId: string) {
  const { data: session } = useSession()
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [lastPosition, setLastPosition] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Use refs to track the latest values without causing re-renders
  const progressRef = useRef(progress)
  const completedRef = useRef(completed)
  const lastPositionRef = useRef(lastPosition)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialLoadRef = useRef(false)

  // Update refs when state changes
  useEffect(() => {
    progressRef.current = progress
    completedRef.current = completed
    lastPositionRef.current = lastPosition
  }, [progress, completed, lastPosition])

  // Load progress from localStorage on mount only
  useEffect(() => {
    if (initialLoadRef.current) return
    initialLoadRef.current = true

    try {
      const storedProgress = localStorage.getItem("course-progress")
      if (!storedProgress) {
        setInitialLoadDone(true)
        return
      }

      const courseProgress: CourseProgress = JSON.parse(storedProgress)
      const lectureProgress = courseProgress[courseId]?.find((item) => item.lectureId === lectureId)

      if (lectureProgress) {
        setProgress(lectureProgress.progress)
        setCompleted(lectureProgress.completed)
        setLastPosition(lectureProgress.position)
      }

      setInitialLoadDone(true)
    } catch (error) {
      console.error("Error loading progress:", error)
      setInitialLoadDone(true)
    }
  }, [courseId, lectureId])

  // Sync with server if user is authenticated - ONCE on mount
  useEffect(() => {
    if (!session?.user?.id || !initialLoadDone) return

    let isMounted = true
    let syncAttempted = false

    const syncWithServer = async () => {
      if (syncAttempted) return
      syncAttempted = true

      try {
        // Fetch progress from server
        const response = await fetch(`/api/progress?lectureId=${lectureId}`)

        if (!isMounted) return

        if (response.ok) {
          const data = await response.json()

          if (data.progress) {
            // Only update if server progress is higher
            if (data.progress.percentage > progressRef.current) {
              setProgress(data.progress.percentage)
            }

            if (data.progress.isComplete && !completedRef.current) {
              setCompleted(data.progress.isComplete)
            }
          }
        }
      } catch (error) {
        console.error("Error syncing progress with server:", error)
      }
    }

    syncWithServer()

    return () => {
      isMounted = false
    }
  }, [lectureId, session?.user?.id, initialLoadDone])

  // Update progress in localStorage
  const updateLocalStorage = useCallback(
    (newProgress: number, isCompleted: boolean, position = 0) => {
      try {
        const storedProgress = localStorage.getItem("course-progress")
        const courseProgress: CourseProgress = storedProgress ? JSON.parse(storedProgress) : {}

        // Initialize course array if it doesn't exist
        if (!courseProgress[courseId]) {
          courseProgress[courseId] = []
        }

        // Find existing lecture progress
        const lectureIndex = courseProgress[courseId].findIndex((item) => item.lectureId === lectureId)

        const updatedProgress: LectureProgress = {
          lectureId,
          progress: newProgress,
          position: position || lastPositionRef.current,
          completed: isCompleted,
          lastUpdated: Date.now(),
        }

        // Update or add lecture progress
        if (lectureIndex !== -1) {
          courseProgress[courseId][lectureIndex] = updatedProgress
        } else {
          courseProgress[courseId].push(updatedProgress)
        }

        // Save to localStorage
        localStorage.setItem("course-progress", JSON.stringify(courseProgress))
      } catch (error) {
        console.error("Error updating progress in localStorage:", error)
      }
    },
    [courseId, lectureId],
  )

  // Update progress on server - debounced
  const syncWithServerDebounced = useCallback(
    async (newProgress: number, isCompleted: boolean) => {
      if (!session?.user?.id || syncing) return

      setSyncing(true)

      try {
        await fetch("/api/progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lectureId,
            percentage: newProgress,
            isComplete: isCompleted,
          }),
        })
      } catch (error) {
        console.error("Error syncing progress with server:", error)
      } finally {
        setSyncing(false)
      }
    },
    [lectureId, session?.user?.id, syncing],
  )

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Update progress
  const updateProgress = useCallback(
    (newProgress: number, position = 0) => {
      // Don't update if already completed
      if (completedRef.current) return

      // Mark as completed if progress is >= 90%
      const isCompleted = newProgress >= 90

      setProgress(newProgress)
      setLastPosition(position)

      if (isCompleted && !completedRef.current) {
        setCompleted(true)
      }

      // Update localStorage
      updateLocalStorage(newProgress, isCompleted, position)

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Debounce server sync to prevent too many requests
      debounceTimerRef.current = setTimeout(() => {
        // Sync with server if significant change (every 10%) or completed
        if (Math.abs(newProgress - progressRef.current) >= 10 || isCompleted) {
          syncWithServerDebounced(newProgress, isCompleted)
        }
      }, 1000)
    },
    [updateLocalStorage, syncWithServerDebounced],
  )

  // Mark lecture as completed
  const markAsCompleted = useCallback(() => {
    setCompleted(true)
    setProgress(100)

    // Update localStorage
    updateLocalStorage(100, true)

    // Sync with server
    syncWithServerDebounced(100, true)
  }, [updateLocalStorage, syncWithServerDebounced])

  // Get course completion percentage
  const getCourseCompletion = useCallback(
    (totalLectures: number) => {
      if (totalLectures === 0) return 0

      try {
        const storedProgress = localStorage.getItem("course-progress")
        if (!storedProgress) return 0

        const courseProgress: CourseProgress = JSON.parse(storedProgress)
        const courseLectures = courseProgress[courseId] || []

        const completedLectures = courseLectures.filter((item) => item.completed).length

        return Math.round((completedLectures / totalLectures) * 100)
      } catch (error) {
        console.error("Error calculating course completion:", error)
        return 0
      }
    },
    [courseId],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  return {
    progress,
    completed,
    lastPosition,
    updateProgress,
    markAsCompleted,
    getCourseCompletion,
  }
}
