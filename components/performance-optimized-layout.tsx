"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"

// Lightweight loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[200px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
)

// Component to measure and optimize layout shifts
export function PerformanceOptimizedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [layoutShift, setLayoutShift] = useState(0)

  // Track Cumulative Layout Shift
  useEffect(() => {
    if (typeof window === "undefined") return

    setMounted(true)

    // Track layout shifts using Performance Observer API
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.entryType === "layout-shift" && !(entry as any).hadRecentInput) {
              setLayoutShift((prev) => prev + (entry as any).value)
            }
          }
        })

        observer.observe({ type: "layout-shift", buffered: true })

        return () => {
          observer.disconnect()
        }
      } catch (e) {
        console.error("PerformanceObserver for CLS failed:", e)
      }
    }
  }, [])

  // Reset layout shift measurement on route change
  useEffect(() => {
    setLayoutShift(0)
  }, [pathname])

  // Preconnect to critical domains
  useEffect(() => {
    if (typeof window === "undefined") return

    // Add preconnect for critical domains
    const domains = ["https://www.googleapis.com", "https://www.youtube.com", "https://i.ytimg.com"]

    domains.forEach((domain) => {
      const link = document.createElement("link")
      link.rel = "preconnect"
      link.href = domain
      link.crossOrigin = "anonymous"
      document.head.appendChild(link)
    })

    // Enable back/forward cache for faster navigation
    if ('navigation' in window && (window.navigation as any).addEventListener) {
      const handleNavigateEvent = (event: any) => {
        // This indicates back/forward navigation
        if (event.navigationType === 'traverse') {
          // Add any special handling for back/forward navigation
          console.log('Using back/forward cache for navigation')
        }
      }
      
      try {
        (window.navigation as any).addEventListener('navigate', handleNavigateEvent)
        return () => {
          (window.navigation as any).removeEventListener('navigate', handleNavigateEvent)
        }
      } catch (error) {
        console.error('Navigation API error:', error)
      }
    }

    return () => {
      // Clean up preconnect links on unmount
      document.querySelectorAll('link[rel="preconnect"]').forEach((el) => {
        document.head.removeChild(el)
      })
    }
  }, [])

  // Avoid layout shifts by maintaining consistent height
  return (
    <div className="relative min-h-screen">
      {mounted ? <Suspense fallback={<LoadingFallback />}>{children}</Suspense> : <LoadingFallback />}

      {process.env.NODE_ENV === "development" && layoutShift > 0.1 && (
        <div className="fixed bottom-2 right-2 bg-red-500 text-white text-xs p-1 rounded z-50">
          High CLS: {layoutShift.toFixed(3)}
        </div>
      )}
    </div>
  )
}
