"use client"

import { RoutePreloader } from "@/lib/route-preloader"
import { prefetchRelatedRoutes, setupIdlePrefetching } from "@/lib/route-prefetcher-utils"
import { usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"

// CSS transitions for page navigation
const pageTransitionStyles = `
.page-transition-enter {
  opacity: 0;
  transform: translateY(5px);
}

.page-transition-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}

.page-transition-exit {
  opacity: 1;
  transform: translateY(0);
}

.page-transition-exit-active {
  opacity: 0;
  transform: translateY(-5px);
  transition: opacity 100ms ease-in, transform 100ms ease-in;
}
`

export function NavigationOptimizer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isFirstRender, setIsFirstRender] = useState(true)
  const prevPathname = useRef<string | null>(null)
  
  // Disable animation on first render to prevent initial page transition
  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false)
    }
  }, [isFirstRender])
  
  // Set up idle prefetching and prefetch related routes
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // If this is a new navigation (not first render), prefetch related routes
    if (prevPathname.current && prevPathname.current !== pathname) {
      prefetchRelatedRoutes()
    }
    
    // Update previous pathname
    prevPathname.current = pathname
    
    // Set up idle prefetching
    const cleanup = setupIdlePrefetching()
    
    return cleanup
  }, [pathname])
  
  return (
    <>
      {/* Add the route preloader component */}
      <RoutePreloader />
      
      {/* Add page transition styles */}
      <style jsx global>{pageTransitionStyles}</style>
      
      {/* Wrap children in a div that can be animated during page transitions */}
      <div 
        key={pathname}
        className={`page-content ${!isFirstRender ? 'page-transition-enter page-transition-enter-active' : ''}`}
      >
        {children}
      </div>
    </>
  )
}
