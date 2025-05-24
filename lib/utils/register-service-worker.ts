/**
 * Service worker utilities
 * 
 * Note: This file is kept for compatibility purposes.
 * Actual service worker registration is handled by the ServiceWorkerProvider component.
 */

// This export is maintained for compatibility with existing imports
export function registerServiceWorker() {
  console.log("Service worker registration is now handled by ServiceWorkerProvider")
  return
}

// This function can be used to request an update check for the service worker
export function checkForUpdate() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.reject("Service workers not supported")
  }
  
  return navigator.serviceWorker.ready.then(registration => {
    return registration.update()
  })
}

// This function forces the waiting service worker to become active
export function skipWaiting() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.reject("Service workers not supported")
  }
  
  return navigator.serviceWorker.ready.then(registration => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      return true
    }
    return false
  })
}
