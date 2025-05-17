// Add message handler for route prefetching
self.addEventListener("message", (event: any) => {
  // Skip waiting message to update service worker
  if (event.data && event.data.type === "SKIP_WAITING") {
    (self as any).skipWaiting()
  }
  
  // Prefetch routes message
  if (event.data && event.data.type === "PREFETCH_ROUTES") {
    const routes = event.data.routes || []
    if (routes.length === 0) return
    
    // Prefetch and cache these routes in the background
    caches.open(DYNAMIC_CACHE).then(cache => {
      routes.forEach((route: string) => {
        // Only prefetch routes that aren't already cached
        caches.match(route).then(response => {
          if (!response) {
            console.log('[Service Worker] Prefetching route:', route)
            fetch(route)
              .then(response => {
                if (response.ok) {
                  cache.put(route, response)
                }
              })
              .catch(() => {
                // Ignore errors during prefetch
              })
          }
        })
      })
    })
  }
})
