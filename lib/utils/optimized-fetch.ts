/**
 * Optimized fetch utility with caching, deduplication, retry logic, and performance tracking
 */

import { trackApiLatency } from "./performance-monitor"

// In-memory request cache for deduplication
const requestCache = new Map<string, Promise<any>>()

// Default fetch options
const defaultOptions: RequestInit = {
  headers: {
    "Content-Type": "application/json",
  },
}

// Interface for optimized fetch options
interface OptimizedFetchOptions extends RequestInit {
  deduplicate?: boolean
  cacheTime?: number
  retries?: number
  retryDelay?: number
  priority?: "high" | "low" | "auto"
  abortSignal?: AbortSignal
  backgroundFetch?: boolean
  trackPerformance?: boolean
}

/**
 * Optimized fetch function with caching, deduplication, and retry logic
 */
export async function optimizedFetch<T = any>(url: string, options: OptimizedFetchOptions = {}): Promise<T> {
  const {
    deduplicate = true,
    cacheTime = 0,
    retries = 2,
    retryDelay = 300,
    priority = "auto",
    abortSignal,
    backgroundFetch = false,
    trackPerformance = true,
    ...fetchOptions
  } = options

  // Track performance if enabled
  const startTime = trackPerformance ? performance.now() : 0
  const endpoint = new URL(url).pathname

  // Create a cache key based on the URL and request method
  const method = fetchOptions.method || "GET"
  const cacheKey = `${method}:${url}:${JSON.stringify(fetchOptions.body || "")}`

  // For GET requests, check if we can deduplicate
  if (deduplicate && method === "GET" && requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey) as Promise<T>
  }

  // Check browser cache for GET requests
  if (method === "GET" && cacheTime > 0 && typeof window !== "undefined") {
    const cachedResponse = localStorage.getItem(`fetch:${cacheKey}`)
    if (cachedResponse) {
      try {
        const { data, timestamp } = JSON.parse(cachedResponse)
        const isValid = Date.now() - timestamp < cacheTime * 1000
        if (isValid) {
          // Track cache hit performance
          if (trackPerformance) {
            trackApiLatency(`${endpoint} (cache)`, startTime)
          }
          return data as T
        }
      } catch (error) {
        console.error("Error parsing cached response:", error)
        localStorage.removeItem(`fetch:${cacheKey}`)
      }
    }
  }

  // Set fetch priority using the Resource Hints API
  if (priority !== "auto" && "fetch" in window && "priority" in Request.prototype) {
    fetchOptions.priority = priority
  }

  // Add abort signal if provided
  if (abortSignal) {
    fetchOptions.signal = abortSignal
  }

  // Create the fetch promise with retry logic
  const fetchWithRetry = async (attemptsLeft: number): Promise<T> => {
    try {
      // Use Keep-Alive for connection reuse
      const headers = {
        ...defaultOptions.headers,
        ...fetchOptions.headers,
        Connection: "keep-alive",
      }

      const response = await fetch(url, {
        ...defaultOptions,
        ...fetchOptions,
        headers,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      const data = await response.json()

      // Cache successful GET responses
      if (method === "GET" && cacheTime > 0 && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `fetch:${cacheKey}`,
            JSON.stringify({
              data,
              timestamp: Date.now(),
            }),
          )
        } catch (e) {
          // Handle localStorage quota exceeded
          if (e instanceof DOMException && e.name === "QuotaExceededError") {
            clearOldestCacheEntries()
          }
        }
      }

      // Track API latency
      if (trackPerformance) {
        trackApiLatency(endpoint, startTime)
      }

      return data as T
    } catch (error) {
      if (attemptsLeft > 0) {
        // Wait before retrying with exponential backoff
        const delay = retryDelay * Math.pow(2, retries - attemptsLeft)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return fetchWithRetry(attemptsLeft - 1)
      }
      throw error
    }
  }

  // Store the promise in the cache for deduplication
  const fetchPromise = fetchWithRetry(retries)

  if (deduplicate && method === "GET") {
    requestCache.set(cacheKey, fetchPromise)

    // Remove from cache when resolved or rejected
    fetchPromise.finally(() => {
      setTimeout(() => {
        requestCache.delete(cacheKey)
      }, 0)
    })
  }

  // For background fetches, we don't want to block the main thread
  if (backgroundFetch && typeof window !== "undefined" && "requestIdleCallback" in window) {
    return new Promise((resolve, reject) => {
      ;(window as any).requestIdleCallback(() => {
        fetchPromise.then(resolve).catch(reject)
      })
    })
  }

  return fetchPromise
}

/**
 * Clear all cached fetch responses
 */
export function clearFetchCache() {
  if (typeof window !== "undefined") {
    // Clear browser cache
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith("fetch:")) {
        localStorage.removeItem(key)
      }
    })
  }

  // Clear in-memory cache
  requestCache.clear()
}

/**
 * Clear specific cached fetch response
 */
export function clearSpecificFetchCache(url: string, method = "GET") {
  if (typeof window !== "undefined") {
    const cacheKey = `${method}:${url}:`
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith(`fetch:${cacheKey}`)) {
        localStorage.removeItem(key)
      }
    })
  }

  // Clear from in-memory cache
  requestCache.forEach((_, key) => {
    if (key.startsWith(`${method}:${url}:`)) {
      requestCache.delete(key)
    }
  })
}

/**
 * Clear oldest cache entries when storage is full
 */
function clearOldestCacheEntries() {
  if (typeof window === "undefined") return

  const keys = Object.keys(localStorage)
  const fetchKeys = keys.filter((key) => key.startsWith("fetch:"))

  if (fetchKeys.length === 0) return

  // Get timestamps for all cache entries
  const entries = fetchKeys.map((key) => {
    try {
      const value = localStorage.getItem(key)
      if (!value) return { key, timestamp: 0 }

      const { timestamp } = JSON.parse(value)
      return { key, timestamp: timestamp || 0 }
    } catch (e) {
      return { key, timestamp: 0 }
    }
  })

  // Sort by timestamp (oldest first)
  entries.sort((a, b) => a.timestamp - b.timestamp)

  // Remove oldest 20% of entries
  const removeCount = Math.max(1, Math.ceil(entries.length * 0.2))
  entries.slice(0, removeCount).forEach((entry) => {
    localStorage.removeItem(entry.key)
  })
}

/**
 * Prefetch a URL and store in cache
 */
export function prefetchUrl(url: string, cacheTime = 60) {
  return optimizedFetch(url, {
    method: "GET",
    cacheTime,
    backgroundFetch: true,
    priority: "low",
    deduplicate: true,
  }).catch(() => {
    // Silently fail prefetch requests
  })
}

/**
 * Batch multiple fetch requests
 */
export async function batchFetch<T = any[]>(urls: string[], options: OptimizedFetchOptions = {}): Promise<T[]> {
  if (urls.length === 0) return [] as T[]

  // For small batches, just use Promise.all
  if (urls.length <= 3) {
    return Promise.all(urls.map((url) => optimizedFetch<T>(url, options)))
  }

  // For larger batches, use the batch API endpoint
  const batchOptions = {
    method: "POST",
    body: JSON.stringify({ urls }),
    ...options,
  }

  const results = await optimizedFetch<Record<string, T>>("/api/batch", batchOptions)

  // Return results in the same order as the input URLs
  return urls.map((url) => results[url])
}
