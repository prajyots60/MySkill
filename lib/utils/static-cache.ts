import type React from "react"
/**
 * Static UI cache for frequently used UI components
 * This reduces re-renders and improves performance
 */

import { cache } from "react"

// Type for cached UI components
type CachedComponent = React.ReactNode

// Cache for UI components
const uiComponentCache = new Map<string, CachedComponent>()

// Cache expiration times (in ms)
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Cache metadata
const cacheMetadata = new Map<
  string,
  {
    timestamp: number
    hits: number
  }
>()

/**
 * Get a cached UI component
 */
export function getCachedUI(key: string): CachedComponent | undefined {
  const cached = uiComponentCache.get(key)

  if (cached) {
    // Update metadata
    const metadata = cacheMetadata.get(key)
    if (metadata) {
      metadata.hits++
      cacheMetadata.set(key, metadata)
    }
  }

  return cached
}

/**
 * Cache a UI component
 */
export function cacheUI(key: string, component: CachedComponent): void {
  uiComponentCache.set(key, component)

  // Set metadata
  cacheMetadata.set(key, {
    timestamp: Date.now(),
    hits: 0,
  })

  // Schedule cleanup
  setTimeout(() => {
    // Only remove if not accessed frequently
    const metadata = cacheMetadata.get(key)
    if (metadata && metadata.hits < 5) {
      uiComponentCache.delete(key)
      cacheMetadata.delete(key)
    } else if (metadata) {
      // Reset hits but keep in cache
      metadata.hits = 0
      cacheMetadata.set(key, metadata)
    }
  }, CACHE_TTL)
}

/**
 * Clear all cached UI components
 */
export function clearUICache(): void {
  uiComponentCache.clear()
  cacheMetadata.clear()
}

/**
 * Get or create a cached UI component
 */
export const getOrCreateCachedUI = cache((key: string, createFn: () => CachedComponent): CachedComponent => {
  const cached = getCachedUI(key)

  if (cached !== undefined) {
    return cached
  }

  const component = createFn()
  cacheUI(key, component)
  return component
})

/**
 * Memoize a function with a cache
 */
export function memoizeWithCache<T extends (...args: any[]) => any>(
  fn: T,
  keyFn: (...args: Parameters<T>) => string = (...args) => JSON.stringify(args),
): T {
  const resultCache = new Map<
    string,
    {
      result: ReturnType<T>
      timestamp: number
    }
  >()

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn(...args)
    const cached = resultCache.get(key)

    // Return cached result if valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result
    }

    // Calculate new result
    const result = fn(...args)

    // Cache result
    resultCache.set(key, {
      result,
      timestamp: Date.now(),
    })

    return result
  }) as T
}
