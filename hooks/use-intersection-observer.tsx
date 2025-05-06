"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface UseIntersectionObserverProps {
  threshold?: number | number[]
  root?: Element | null
  rootMargin?: string
  freezeOnceVisible?: boolean
}

/**
 * Custom hook for efficiently observing element visibility
 */
export function useIntersectionObserver({
  threshold = 0,
  root = null,
  rootMargin = "0%",
  freezeOnceVisible = false,
}: UseIntersectionObserverProps = {}) {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)

  const frozen = freezeOnceVisible && hasBeenVisible
  const elementRef = useRef<Element | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const updateEntry = useCallback(
    ([entry]: IntersectionObserverEntry[]) => {
      setEntry(entry)

      const isIntersecting = entry.isIntersecting
      setIsVisible(isIntersecting)

      if (isIntersecting && !hasBeenVisible) {
        setHasBeenVisible(true)
      }
    },
    [hasBeenVisible],
  )

  // Set up the observer
  useEffect(() => {
    if (frozen || !window.IntersectionObserver) return

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(updateEntry, {
      threshold,
      root,
      rootMargin,
    })

    // Observe element if available
    const currentElement = elementRef.current
    if (currentElement) {
      observerRef.current.observe(currentElement)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [threshold, root, rootMargin, frozen, updateEntry])

  // Handle element ref changes
  const setRef = useCallback(
    (element: Element | null) => {
      // Skip if element hasn't changed
      if (elementRef.current === element) return

      elementRef.current = element

      // Skip if frozen or no observer
      if (frozen || !observerRef.current) return

      // Clean up previous observation
      observerRef.current.disconnect()

      // Observe new element if available
      if (element) {
        observerRef.current.observe(element)
      }
    },
    [frozen],
  )

  return { setRef, entry, isVisible, hasBeenVisible }
}
