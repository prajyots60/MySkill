"use client"

/**
 * Utility for communicating with the service worker to prefetch routes
 */

export function prefetchRoutes(routes: string[]) {
  if (!routes || routes.length === 0) return

  // Make sure service worker is supported and registered
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      // Send message to service worker to prefetch routes
      navigator.serviceWorker.controller.postMessage({
        type: 'PREFETCH_ROUTES',
        routes,
      })
    } catch (error) {
      console.error('Failed to send prefetch message to service worker:', error)
    }
  }
}

/**
 * Prefetch multiple routes in the background, prioritizing by importance
 * @param routes Routes to prefetch, in order of priority
 */
export function prefetchRoutesWithPriority(routes: string[]) {
  if (!routes || routes.length === 0) return
  
  // Start with a delay to prioritize current page load
  setTimeout(() => {
    // For the highest priority route, use both service worker and Next.js prefetching
    if (routes.length > 0) {
      prefetchRoutes([routes[0]])
      
      // Inject a prefetch link element for top priority route
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = routes[0]
      document.head.appendChild(link)
    }
    
    // For remaining routes, stagger them to avoid overwhelming the browser
    if (routes.length > 1) {
      setTimeout(() => {
        prefetchRoutes(routes.slice(1))
      }, 2000) // 2 second delay for lower priority routes
    }
  }, 1000) // 1 second initial delay
}

/**
 * Intelligently prefetch routes related to the current route
 */
export function prefetchRelatedRoutes() {
  if (typeof window === 'undefined') return
  
  const currentPath = window.location.pathname
  
  // Define related routes based on current path
  const relatedRoutes: Record<string, string[]> = {
    '/': ['/explore', '/auth/signin'],
    '/explore': ['/dashboard/student', '/dashboard/creator'],
    '/dashboard/student': [
      '/dashboard/student/my-courses',
      '/dashboard/student/saved',
      '/dashboard/student/exams',
    ],
    '/dashboard/creator': [
      '/dashboard/creator/content/create',
      '/dashboard/creator/exams',
      '/dashboard/creator/analytics',
    ],
    '/dashboard/creator/exams': [
      '/dashboard/creator/exams/create',
      '/dashboard/creator/students',
    ],
  }
  
  // Get routes related to current path
  const routesToPrefetch = relatedRoutes[currentPath] || []
  
  if (routesToPrefetch.length > 0) {
    prefetchRoutesWithPriority(routesToPrefetch)
  }
}

/**
 * Hook that intelligently prefetches routes when the user has been idle on a page
 */
export function setupIdlePrefetching() {
  if (typeof window === 'undefined') return
  
  let idleTimeout: number | null = null
  
  // Set up idle detection
  const resetIdleTimer = () => {
    if (idleTimeout) {
      window.clearTimeout(idleTimeout)
    }
    
    // After 3 seconds of inactivity, prefetch related routes
    idleTimeout = window.setTimeout(() => {
      prefetchRelatedRoutes()
    }, 3000)
  }
  
  // Reset timer when user interacts with the page
  window.addEventListener('mousemove', resetIdleTimer)
  window.addEventListener('keypress', resetIdleTimer)
  window.addEventListener('scroll', resetIdleTimer)
  window.addEventListener('touchstart', resetIdleTimer)
  
  // Start the idle timer
  resetIdleTimer()
  
  // Return cleanup function
  return () => {
    if (idleTimeout) {
      window.clearTimeout(idleTimeout)
    }
    window.removeEventListener('mousemove', resetIdleTimer)
    window.removeEventListener('keypress', resetIdleTimer)
    window.removeEventListener('scroll', resetIdleTimer)
    window.removeEventListener('touchstart', resetIdleTimer)
  }
}
