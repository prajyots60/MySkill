import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { cacheManager, CacheOptions } from '@/lib/cache-manager'

interface QueryOptions extends CacheOptions {
  enabled?: boolean
  refetchInterval?: number | false
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
  prefetch?: boolean
  // suspense property removed to match React Query v5+ changes
}

const DEFAULT_OPTIONS: QueryOptions = {
  enabled: true,
  refetchInterval: false,
  refetchOnWindowFocus: false, // Changed from true to false
  refetchOnReconnect: false, // Changed from true to false
  staleWhileRevalidate: true,
  backgroundRefresh: true,
  storage: 'memory',
  ttl: 15 * 60 * 1000, // 15 minutes (increased from 5 minutes)
}

// Track all in-flight query keys across hook instances to avoid duplicate requests during strict mode rerenders
const globalInFlightQueries = new Map<string, Promise<any>>()

/**
 * Hook for optimized data fetching with caching, background refresh, and more
 * Inspired by react-query but with more control over caching strategies
 */
export function useOptimizedQuery<T = any, E = any>(
  queryKey: string | (() => string | null),
  queryFn: () => Promise<T>,
  options: QueryOptions = {}
) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<E | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefetching, setIsRefetching] = useState<boolean>(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastFocusRef = useRef<number>(Date.now())
  const queryKeyRef = useRef<string | null>(null)
  const mountedRef = useRef<boolean>(true)
  const fetchCountRef = useRef<number>(0)

  // Resolve the query key - memoize this to prevent unnecessary re-fetches due to function identity changes
  const resolvedQueryKey = useMemo(() => {
    return typeof queryKey === 'function' ? queryKey() : queryKey
  }, [queryKey])
  
  // Cleanup function for interval
  const clearRefetchInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Main fetch function - optimized to prevent duplicate requests
  const fetchData = useCallback(async (isInitialLoad = false) => {
    if (!resolvedQueryKey) return
    
    try {
      if (isInitialLoad) {
        setIsLoading(true)
      } else {
        setIsRefetching(true)
      }

      // Check for globally in-flight queries first to avoid duplicate requests during strict mode double-renders
      if (globalInFlightQueries.has(resolvedQueryKey)) {
        const result = await globalInFlightQueries.get(resolvedQueryKey)
        if (mountedRef.current) {
          setData(result)
          setError(null)
          mergedOptions.onSuccess?.(result)
        }
        return result
      }

      // Create the fetch promise
      const fetchPromise = cacheManager.get<T>(
        resolvedQueryKey,
        queryFn,
        {
          ttl: mergedOptions.ttl,
          staleWhileRevalidate: mergedOptions.staleWhileRevalidate,
          backgroundRefresh: mergedOptions.backgroundRefresh,
          refreshThreshold: mergedOptions.refreshThreshold,
          storage: mergedOptions.storage,
        }
      )

      // Store it globally to deduplicate concurrent requests
      globalInFlightQueries.set(resolvedQueryKey, fetchPromise)
      
      const result = await fetchPromise
      
      if (mountedRef.current) {
        setData(result)
        setError(null)
        mergedOptions.onSuccess?.(result)
      }
      
      // Remove from global in-flight queries after a delay
      // This prevents immediate refetching in strict mode but allows future fetches
      setTimeout(() => {
        globalInFlightQueries.delete(resolvedQueryKey)
      }, 100)
      
      return result
    } catch (err) {
      if (mountedRef.current) {
        setError(err as E)
        mergedOptions.onError?.(err)
      }
      // Remove from global in-flight on error
      globalInFlightQueries.delete(resolvedQueryKey)
      throw err
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        setIsRefetching(false)
      }
    }
  }, [resolvedQueryKey, queryFn, mergedOptions])

  // Refetch data manually
  const refetch = useCallback(async () => {
    if (!resolvedQueryKey) return
    
    // Invalidate the cache to force a fresh fetch
    cacheManager.invalidate(resolvedQueryKey)
    return fetchData(false)
  }, [resolvedQueryKey, fetchData])

  // Setup refetch interval
  useEffect(() => {
    if (!resolvedQueryKey || !mergedOptions.enabled || !mergedOptions.refetchInterval) {
      clearRefetchInterval()
      return
    }

    clearRefetchInterval()
    intervalRef.current = setInterval(() => {
      fetchData(false)
    }, mergedOptions.refetchInterval)

    return clearRefetchInterval
  }, [resolvedQueryKey, mergedOptions.enabled, mergedOptions.refetchInterval, fetchData, clearRefetchInterval])

  // Handle window focus events for refetching
  useEffect(() => {
    if (typeof window === 'undefined' || !mergedOptions.refetchOnWindowFocus) return

    const onFocus = () => {
      const now = Date.now()
      const timeSinceLastFocus = now - lastFocusRef.current
      
      // Only refetch if it's been more than 5 seconds since last focus
      // This prevents multiple refetches when switching between tabs quickly
      if (timeSinceLastFocus > 5000) {
        fetchData(false)
      }
      
      lastFocusRef.current = now
    }

    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [mergedOptions.refetchOnWindowFocus, fetchData])

  // Handle network reconnect events
  useEffect(() => {
    if (typeof window === 'undefined' || !mergedOptions.refetchOnReconnect) return

    const onOnline = () => {
      fetchData(false)
    }

    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
    }
  }, [mergedOptions.refetchOnReconnect, fetchData])

  // Limit fetch count in development mode to prevent strict mode double-fetching
  const shouldFetch = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      if (fetchCountRef.current > 0) {
        return false
      }
      fetchCountRef.current++
      
      // Reset fetch count after rendering cycle completes
      setTimeout(() => {
        fetchCountRef.current = 0
      }, 100)
    }
    return true
  }, [])

  // Initial data fetch
  useEffect(() => {
    // Set mounted status for cleaning up async actions
    mountedRef.current = true
    
    // Skip if query key is null or disabled
    if (!resolvedQueryKey || !mergedOptions.enabled) {
      setIsLoading(false)
      return
    }

    // Skip refetch if query key hasn't changed
    if (queryKeyRef.current === resolvedQueryKey && data !== undefined) {
      return
    }

    // Limit fetch count in dev mode to prevent strict mode double-fetching
    if (!shouldFetch()) {
      return
    }

    queryKeyRef.current = resolvedQueryKey
    fetchData(true)
    
    return () => {
      mountedRef.current = false
    }
  }, [resolvedQueryKey, mergedOptions.enabled, fetchData, shouldFetch, data])

  // Prefetch data if needed
  useEffect(() => {
    if (mergedOptions.prefetch && resolvedQueryKey) {
      cacheManager.get<T>(
        resolvedQueryKey,
        queryFn,
        {
          ttl: mergedOptions.ttl,
          staleWhileRevalidate: false,
          backgroundRefresh: false,
          storage: mergedOptions.storage,
        }
      ).catch(() => {
        // Silently fail for prefetch
      })
    }
  }, [resolvedQueryKey, queryFn, mergedOptions.prefetch, mergedOptions.ttl, mergedOptions.storage])

  return {
    data,
    error,
    isLoading,
    isRefetching,
    refetch,
    setData: (newData: T) => {
      setData(newData)
      if (resolvedQueryKey) {
        cacheManager.set(resolvedQueryKey, newData, {
          ttl: mergedOptions.ttl,
          storage: mergedOptions.storage,
        })
      }
    },
  }
}

export default useOptimizedQuery
