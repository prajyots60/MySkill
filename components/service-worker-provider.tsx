'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/utils/register-service-worker'

export function ServiceWorkerProvider() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker on client side
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope)
            
            // Enable navigation preload if supported
            if (registration.navigationPreload) {
              registration.navigationPreload.enable().then(() => {
                console.log('Navigation Preload enabled')
              }).catch(err => {
                console.error('Navigation Preload error:', err)
              })
            }
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available - show update notification
                    const notification = document.createElement('div')
                    notification.className = 'fixed bottom-4 right-4 bg-primary text-primary-foreground p-4 rounded-md shadow-lg z-50 flex items-center gap-2'
                    notification.innerHTML = `
                      <div>New version available!</div>
                      <button class="bg-primary-foreground text-primary px-2 py-1 rounded text-sm">Refresh</button>
                    `
                    document.body.appendChild(notification)
                    
                    // Add click handler
                    const button = notification.querySelector('button')
                    if (button) {
                      button.addEventListener('click', () => {
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
                })
              }
            })
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error)
          })
      })
      
      // Handle controller change
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    }
  }, [])

  return null
}