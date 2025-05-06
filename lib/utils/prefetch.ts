"use client"

/**
 * Enhanced utility for prefetching pages on hover to improve perceived performance
 */

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { prefetchUrl } from "./optimized-fetch"

// Track prefetched URLs to avoid duplicate prefetches
const prefetchedUrls = new Set<string>()

// Track URLs that are currently being prefetched
const prefetchingUrls = new Set<string>()

// Track user navigation patterns
const navigationHistory: string[] = []
const MAX_HISTORY_LENGTH = 20

// Prediction model weights
const RECENCY_WEIGHT = 0.6
const FREQUENCY_WEIGHT = 0.4

// Add URL to navigation history
export function trackNavigation(url: string) {
  if (typeof window === "undefined") return

  // Add to history
  navigationHistory.unshift(url)

  // Trim history
  if (navigationHistory.length > MAX_HISTORY_LENGTH) {
    navigationHistory.pop()
  }

  // Store in localStorage
  try {
    localStorage.setItem("nav_history", JSON.stringify(navigationHistory))
  } catch (e) {
    // Ignore storage errors
  }
}

// Load navigation history from localStorage
if (typeof window !== "undefined") {
  try {
    const storedHistory = localStorage.getItem("nav_history")
    if (storedHistory) {
      const parsed = JSON.parse(storedHistory)
      if (Array.isArray(parsed)) {
        navigationHistory.push(...parsed)
      }
    }
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Predict next pages based on navigation history
 */
function predictNextPages(): string[] {
  if (navigationHistory.length < 2) return []

  const currentPage = navigationHistory[0]
  const patterns: Record<string, { count: number; lastSeen: number }> = {}

  // Analyze patterns
  for (let i = 1; i < navigationHistory.length; i++) {
    const prevPage = navigationHistory[i]
    const nextPage = navigationHistory[i - 1]

    if (prevPage === currentPage && nextPage !== currentPage) {
      if (!patterns[nextPage]) {
        patterns[nextPage] = { count: 0, lastSeen: i }
      }

      patterns[nextPage].count++
      patterns[nextPage].lastSeen = Math.min(patterns[nextPage].lastSeen, i)
    }
  }

  // Calculate scores
  const scores = Object.entries(patterns).map(([url, data]) => {
    const recencyScore = 1 / (data.lastSeen + 1)
    const frequencyScore = data.count / navigationHistory.length

    return {
      url,
      score: recencyScore * RECENCY_WEIGHT + frequencyScore * FREQUENCY_WEIGHT,
    }
  })

  // Sort by score and return top 3
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.url)
}

/**
 * Hook to prefetch a page when hovering over a link
 */
export function usePrefetch(
  url: string,
  options?: {
    timeout?: number
    prefetchResources?: boolean
    priority?: "high" | "low"
  },
) {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isPrefetched, setIsPrefetched] = useState(prefetchedUrls.has(url))

  const prefetch = useCallback(() => {
    if (prefetchedUrls.has(url) || prefetchingUrls.has(url)) return

    // Mark as being prefetched
    prefetchingUrls.add(url)

    // Use router.prefetch if available
    if (typeof router.prefetch === "function") {
      router.prefetch(url)

      // Also prefetch API data if needed
      if (options?.prefetchResources) {
        // Extract courseId or other IDs from URL
        const matches = url.match(/\/content\/([^/]+)/)
        if (matches && matches[1]) {
          const courseId = matches[1]
          prefetchUrl(`/api/courses/${courseId}`, 300)
        }
      }

      // Mark as prefetched
      prefetchedUrls.add(url)
      prefetchingUrls.delete(url)
      setIsPrefetched(true)
    } else {
      // Fallback to fetch
      fetch(url, {
        method: "HEAD",
        priority: options?.priority || "low",
      })
        .then(() => {
          prefetchedUrls.add(url)
          setIsPrefetched(true)
        })
        .catch(() => {
          // Silently fail - this is just an optimization
        })
        .finally(() => {
          prefetchingUrls.delete(url)
        })
    }
  }, [router, url, options])

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    // Add a small delay to avoid prefetching on accidental hovers
    timeoutRef.current = setTimeout(() => {
      prefetch()
    }, options?.timeout || 100)
  }, [prefetch, options?.timeout])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleMouseEnter,
    onBlur: handleMouseLeave,
    isPrefetched,
  }
}

/**
 * Prefetch multiple URLs in the background
 */
export function prefetchPages(urls: string[]) {
  if (typeof window === "undefined") return

  // Use requestIdleCallback for better performance
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      urls.forEach((url) => {
        if (!prefetchedUrls.has(url) && !prefetchingUrls.has(url)) {
          prefetchingUrls.add(url)

          fetch(url, { method: "HEAD", priority: "low" })
            .then(() => {
              prefetchedUrls.add(url)
            })
            .catch(() => {
              // Silently fail
            })
            .finally(() => {
              prefetchingUrls.delete(url)
            })
        }
      })
    })
  } else {
    // Fallback to setTimeout
    setTimeout(() => {
      urls.forEach((url) => {
        if (!prefetchedUrls.has(url) && !prefetchingUrls.has(url)) {
          prefetchingUrls.add(url)

          fetch(url, { method: "HEAD" })
            .then(() => {
              prefetchedUrls.add(url)
            })
            .catch(() => {
              // Silently fail
            })
            .finally(() => {
              prefetchingUrls.delete(url)
            })
        }
      })
    }, 1000)
  }
}

/**
 * Component props for prefetchable links
 */
export function getPrefetchProps(
  url: string,
  options?: {
    timeout?: number
    prefetchResources?: boolean
  },
) {
  return usePrefetch(url, options)
}

/**
 * Intelligent prefetching based on user navigation patterns
 */
export function useIntelligentPrefetch() {
  useEffect(() => {
    if (typeof window === "undefined") return

    // Prefetch predicted pages when idle
    const prefetchPredicted = () => {
      const predictedPages = predictNextPages()
      if (predictedPages.length > 0) {
        prefetchPages(predictedPages)
      }
    }

    // Use requestIdleCallback if available
    if ("requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(prefetchPredicted, { timeout: 2000 })
      return () => (window as any).cancelIdleCallback(id)
    } else {
      // Fallback to setTimeout
      const id = setTimeout(prefetchPredicted, 2000)
      return () => clearTimeout(id)
    }
  }, [])
}

// Initialize intelligent prefetching
if (typeof window !== "undefined") {
  // Track page navigations
  const originalPushState = history.pushState
  history.pushState = function (state, title, url) {
    originalPushState.call(this, state, title, url)
    if (url) {
      trackNavigation(url.toString())
    }
  }

  // Also track initial page load
  trackNavigation(window.location.pathname)
}
