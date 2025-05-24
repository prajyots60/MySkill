/**
 * Service Worker for offline support and performance optimization
 */

// Files to precache
const PRECACHE_ASSETS = ["/favicon.ico", "/logo.png", "/placeholder.svg", "/placeholder-user.jpg"]

// Cache names
const STATIC_CACHE = "static-cache-v1"
const DYNAMIC_CACHE = "dynamic-cache-v1"
const API_CACHE = "api-cache-v1"

// Install event - precache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[Service Worker] Precaching static assets")
        return cache.addAll(PRECACHE_ASSETS)
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting()
      }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== API_CACHE) {
              console.log("[Service Worker] Removing old cache:", cacheName)
              return caches.delete(cacheName)
            }
            return Promise.resolve()
          }),
        )
      })
      .then(() => {
        // Claim clients to control all open tabs
        return self.clients.claim()
      }),
  )
})

// Helper function to determine if a request should be cached
function shouldCache(url) {
  const parsedUrl = new URL(url)

  // Don't cache auth requests
  if (parsedUrl.pathname.includes("/auth/") || parsedUrl.pathname.includes("/api/auth/")) {
    return false
  }

  // Don't cache video streaming requests
  if (parsedUrl.pathname.includes("/api/video/")) {
    return false
  }

  // Cache static assets
  if (
    parsedUrl.pathname.endsWith(".js") ||
    parsedUrl.pathname.endsWith(".css") ||
    parsedUrl.pathname.endsWith(".png") ||
    parsedUrl.pathname.endsWith(".jpg") ||
    parsedUrl.pathname.endsWith(".svg") ||
    parsedUrl.pathname.endsWith(".ico")
  ) {
    return true
  }

  // Enhanced API caching - cache more API endpoints
  if (parsedUrl.pathname.startsWith("/api/")) {
    // Only cache GET requests for read-only data that doesn't change frequently
    return (
      parsedUrl.pathname.includes("/courses/") || 
      parsedUrl.pathname.includes("/sections/") ||
      parsedUrl.pathname.includes("/creator/courses") ||
      parsedUrl.pathname.includes("/creators/") ||
      parsedUrl.pathname.includes("/progress") ||
      parsedUrl.pathname.includes("/lecture/")
    )
  }

  return false
}

// Fetch event - network first with cache fallback
self.addEventListener("fetch", (event) => {
  const request = event.request

  // Skip non-GET requests
  if (request.method !== "GET") return

  // Skip cross-origin requests
  if (new URL(request.url).origin !== location.origin) return

  // Handle navigation requests differently
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match("/") // Return cached home page as fallback
        })
    )
    return
  }

  // API requests - network first, then cache
  if (request.url.includes("/api/") && shouldCache(request.url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response
          const responseToCache = response.clone()
          
          // Cache the successful response
          caches.open(API_CACHE).then((cache) => {
            if (responseToCache.ok) {
              cache.put(request, responseToCache)
            }
          })
          
          return response
        })
        .catch(() => {
          return caches.match(request)
        })
    )
    return
  }

  // Other cacheable requests - stale-while-revalidate strategy
  if (shouldCache(request.url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Return cached response immediately if available
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            // Update the cache with the new response
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, networkResponse.clone())
            })
            return networkResponse
          })
          .catch((error) => {
            console.error("[Service Worker] Fetch failed:", error)
            // If network fails and we don't have a cached response, return offline page
            if (!cachedResponse) {
              return caches.match("/offline.html")
            }
            return cachedResponse
          })

        return cachedResponse || fetchPromise
      })
    )
    return
  }

  // Default behavior - don't interfere
})

// Handle messages from the client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
