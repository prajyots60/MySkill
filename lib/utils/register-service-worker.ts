/**
 * Register the service worker for offline support and performance optimization
 */

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return
  }

  // Only register in production
  if (process.env.NODE_ENV !== "production") {
    return
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered with scope:", registration.scope)

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New service worker available
                showUpdateNotification()
              }
            })
          }
        })
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error)
      })

    // Handle controller change
    let refreshing = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}

// Show notification when a new version is available
function showUpdateNotification() {
  const notification = document.createElement("div")
  notification.className =
    "fixed bottom-4 right-4 bg-primary text-primary-foreground p-4 rounded-md shadow-lg z-50 flex items-center gap-2"
  notification.innerHTML = `
    <div>New version available!</div>
    <button class="bg-primary-foreground text-primary px-2 py-1 rounded text-sm">Refresh</button>
  `

  document.body.appendChild(notification)

  // Add click handler
  const button = notification.querySelector("button")
  if (button) {
    button.addEventListener("click", () => {
      window.location.reload()
    })
  }

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification)
    }
  }, 10000)
}

// Register service worker
if (typeof window !== "undefined") {
  registerServiceWorker()
}
