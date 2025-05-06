import { useCallback, useRef } from 'react'
import { cacheManager } from '@/lib/cache-manager'

type PrefetchOptions = {
  ttl?: number
  hoverDelay?: number
  storage?: 'memory' | 'localStorage' | 'sessionStorage'
}

const DEFAULT_OPTIONS: PrefetchOptions = {
  ttl: 2 * 60 * 1000, // 2 minutes
  hoverDelay: 150, // ms
  storage: 'memory',
}

/**
 * Hook for prefetching data on hover or other events
 * Helps improve perceived performance by loading data before it's needed
 */
export function usePrefetch() {
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Prefetch data for a specific key
   */
  const prefetch = useCallback(
    async <T>(
      key: string,
      fetchFn: () => Promise<T>,
      options: PrefetchOptions = {}
    ): Promise<void> => {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

      try {
        await cacheManager.get<T>(key, fetchFn, {
          ttl: mergedOptions.ttl,
          staleWhileRevalidate: false,
          backgroundRefresh: false,
          storage: mergedOptions.storage,
        })
      } catch (error) {
        // Silently fail for prefetch operations
        console.debug(`Prefetch failed for key ${key}:`, error)
      }
    },
    []
  )

  /**
   * Create handlers for prefetching on hover
   */
  const createHoverPrefetchHandlers = useCallback(
    <T>(
      key: string,
      fetchFn: () => Promise<T>,
      options: PrefetchOptions = {}
    ) => {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

      return {
        onMouseEnter: () => {
          // Clear any existing timer
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current)
          }

          // Set a new timer to prefetch after a delay
          hoverTimerRef.current = setTimeout(() => {
            prefetch(key, fetchFn, mergedOptions)
          }, mergedOptions.hoverDelay)
        },
        onMouseLeave: () => {
          // Clear the timer if the user moves away before prefetch starts
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current)
            hoverTimerRef.current = null
          }
        },
        onClick: () => {
          // Clear any hover timer
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current)
            hoverTimerRef.current = null
          }
        },
      }
    },
    [prefetch]
  )

  return {
    prefetch,
    createHoverPrefetchHandlers,
  }
}

export default usePrefetch
