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
self.addEventListener("install", (event: any) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[Service Worker] Precaching static assets")
        return cache.addAll(PRECACHE_ASSETS)
      })
      .then(() => {
        // Skip waiting to activate immediately
        return (self as any).skipWaiting()
      }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event: any) => {
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
        return (self as any).clients.claim()
      }),
  )
})

// Helper function to determine if a request should be cached
function shouldCache(url: string): boolean {
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
self.addEventListener("fetch", (event: any) => {
  const request = event.request

  // Skip non-GET requests
  if (request.method !== "GET") return

  // Enable navigation preload if supported - this makes navigation requests significantly faster
  if (request.mode === 'navigate' && (self as any).registration.navigationPreload) {
    event.respondWith(
      (async () => {
        try {
          // Try to use navigation preload response if available
          const preloadResponse = await event.preloadResponse
          if (preloadResponse) {
            // Cache this response for faster back/forward navigation
            const cache = await caches.open(DYNAMIC_CACHE)
            cache.put(request.url, preloadResponse.clone())
            return preloadResponse
          }
          
          // If no preload response, check the cache first 
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            // Clone the cached response so we can update it in the background
            const responseToReturn = cachedResponse.clone()
            
            // Revalidate the cache in the background
            fetch(request)
              .then(response => {
                if (response.ok) {
                  const cache = caches.open(DYNAMIC_CACHE)
                  cache.then(c => c.put(request.url, response))
                }
              })
              .catch(() => {}) // Ignore errors on background refresh
              
            return responseToReturn
          }
          
          // If not in cache, get from network
          const networkResponse = await fetch(event.request)
          
          // Cache navigation responses for faster future navigations
          const cache = await caches.open(DYNAMIC_CACHE)
          cache.put(request.url, networkResponse.clone())
          
          return networkResponse
        } catch (error) {
          // Fallback to whatever is in the cache
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            return cachedResponse
          }
          
          // If nothing in the cache, try the offline page
          return caches.match('/offline')
        }
      })()
    )
    return
  }
  if (!request.url.startsWith(self.location.origin)) return

  // Determine which strategy to use
  if (shouldCache(request.url)) {
    const parsedUrl = new URL(request.url)
    
    // For specific API endpoints that don't change frequently, use cache-first strategy
    if (
      parsedUrl.pathname.includes("/api/creator/courses") ||
      parsedUrl.pathname.includes("/api/creators/") ||
      parsedUrl.pathname.includes("/api/courses/")
    ) {
      event.respondWith(
        caches.open(API_CACHE).then((cache) => {
          return cache.match(request).then((cacheResponse) => {
            // Return cached response if available
            if (cacheResponse) {
              // In the background, fetch new data and update cache
              fetch(request)
                .then((networkResponse) => {
                  if (networkResponse.ok) {
                    cache.put(request, networkResponse.clone())
                  }
                })
                .catch(() => {
                  // Silently fail background fetch
                })
              
              return cacheResponse
            }
            
            // If not in cache, fetch from network and cache
            return fetch(request)
              .then((networkResponse) => {
                if (networkResponse.ok) {
                  cache.put(request, networkResponse.clone())
                }
                return networkResponse
              })
              .catch(() => {
                // Fallback for non-cached content
                return new Response(JSON.stringify({ error: "Network error, unable to fetch data" }), {
                  headers: { "Content-Type": "application/json" }
                })
              })
          })
        })
      )
    } 
    // For other cacheable requests, use stale-while-revalidate
    else {
      event.respondWith(
        caches
          .open(request.url.includes("/api/") ? API_CACHE : DYNAMIC_CACHE)
          .then((cache) => {
            return fetch(request)
              .then((networkResponse) => {
                // Clone the response before using it
                const clonedResponse = networkResponse.clone()

                // Only cache successful responses
                if (networkResponse.ok) {
                  cache.put(request, clonedResponse)
                }

                return networkResponse
              })
              .catch(() => {
                // If network fails, try from cache
                return cache.match(request).then((cacheResponse) => {
                  return cacheResponse || Promise.reject("no-match")
                })
              })
          })
          .catch(() => {
            // Fallback for non-cached content
            return caches.match("/offline.html")
          })
      )
    }
  }
})

// Background sync for offline operations
self.addEventListener("sync", (event: any) => {
  if (event.tag === "sync-progress") {
    event.waitUntil(syncProgress())
  }
})

// Sync progress data when online
async function syncProgress() {
  try {
    // Get stored progress data from IndexedDB
    const db = await openDatabase()
    const tx = db.transaction("offlineProgress", "readonly")
    const store = tx.objectStore("offlineProgress")
    const progressItems = await store.getAll()

    // Process each item
    for (const item of progressItems) {
      try {
        // Try to sync with server
        const response = await fetch("/api/progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(item),
        })

        if (response.ok) {
          // Remove from IndexedDB if successful
          const deleteTx = db.transaction("offlineProgress", "readwrite")
          const deleteStore = deleteTx.objectStore("offlineProgress")
          await deleteStore.delete(item.id)
        }
      } catch (error) {
        console.error("Failed to sync progress item:", error)
      }
    }
  } catch (error) {
    console.error("Error in syncProgress:", error)
  }
}

// Open IndexedDB
function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("eduplatform", 1)

    request.onupgradeneeded = (event) => {
      const db = request.result
      if (!db.objectStoreNames.contains("offlineProgress")) {
        db.createObjectStore("offlineProgress", { keyPath: "id" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Listen for push notifications
self.addEventListener("push", (event: any) => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body,
    icon: "/logo.png",
    badge: "/badge.png",
    data: {
      url: data.url,
    },
  }

  event.waitUntil((self as any).registration.showNotification(data.title, options))
})

// Handle notification clicks
self.addEventListener("notificationclick", (event: any) => {
  event.notification.close()

  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      (self as any).clients.matchAll({ type: "window" }).then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url === event.notification.data.url && "focus" in client) {
            return client.focus()
          }
        }

        // Otherwise open a new window
        if ((self as any).clients.openWindow) {
          return (self as any).clients.openWindow(event.notification.data.url)
        }
      }),
    )
  }
})
