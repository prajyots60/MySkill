"use client"

import type React from "react"

import { useEffect, useState, useRef, memo } from "react"
import { getCachedUI, cacheUI } from "@/lib/utils/static-cache"

interface StaticUICacheProps {
  cacheKey: string
  children: React.ReactNode
  ttl?: number // Time to live in ms
}

/**
 * Component that caches its children to prevent unnecessary re-renders
 */
export const StaticUICache = memo(function StaticUICache({
  cacheKey,
  children,
  ttl = 5 * 60 * 1000, // 5 minutes default
}: StaticUICacheProps) {
  const [cachedContent, setCachedContent] = useState<React.ReactNode | null>(null)
  const mountedRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // On mount, check for cached content
  useEffect(() => {
    mountedRef.current = true

    // Try to get from cache
    const cached = getCachedUI(cacheKey)

    if (cached !== undefined) {
      setCachedContent(cached)
    } else {
      // Cache the children
      cacheUI(cacheKey, children)
      setCachedContent(children)
    }

    // Set up cache expiration
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        // Update cache with latest children
        cacheUI(cacheKey, children)
        setCachedContent(children)
      }
    }, ttl)

    return () => {
      mountedRef.current = false
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [cacheKey, children, ttl])

  // Force update if children change significantly
  useEffect(() => {
    // This is a simple way to detect major changes
    // For more complex scenarios, you might want to implement
    // a deep comparison or use a hash function
    const childrenString = JSON.stringify(children)
    const cachedString = JSON.stringify(cachedContent)

    if (
      cachedContent !== null &&
      childrenString.length !== cachedString.length &&
      Math.abs(childrenString.length - cachedString.length) > 50
    ) {
      // Significant change detected, update cache
      cacheUI(cacheKey, children)
      setCachedContent(children)
    }
  }, [cacheKey, children, cachedContent])

  return <>{cachedContent || children}</>
})

/**
 * Higher-order component to add static caching to any component
 */
export function withStaticCache<P extends object>(
  Component: React.ComponentType<P>,
  getCacheKey: (props: P) => string,
) {
  return function CachedComponent(props: P) {
    const cacheKey = getCacheKey(props)

    return (
      <StaticUICache cacheKey={cacheKey}>
        <Component {...props} />
      </StaticUICache>
    )
  }
}
