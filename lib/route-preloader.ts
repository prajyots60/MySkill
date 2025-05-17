"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

type RoutePattern = {
  path: string
  preloadFn?: () => Promise<any>
}

// Routes that should be preloaded automatically when a user enters the app
const INITIAL_PRELOAD_ROUTES: RoutePattern[] = [
  { path: "/dashboard/student" },
  { path: "/dashboard/creator" },
  { path: "/explore" },
]

/**
 * Defines relationships between routes, where if a user visits route A,
 * we should preload routes B, C, etc. that they're likely to visit next
 */
const ROUTE_RELATIONSHIPS: Record<string, RoutePattern[]> = {
  "/": [
    { path: "/explore" },
    { path: "/auth/signin" },
  ],
  "/dashboard/student": [
    { path: "/dashboard/student/my-courses" },
    { path: "/dashboard/student/saved" },
    { path: "/dashboard/student/exams" },
  ],
  "/dashboard/creator": [
    { path: "/dashboard/creator/content/create" },
    { path: "/dashboard/creator/content/upload" },
    { path: "/dashboard/creator/exams" },
  ],
  "/dashboard/creator/exams": [
    { path: "/dashboard/creator/exams/create" },
    { path: "/dashboard/creator/students" },
  ],
}

/**
 * Hook that preloads related routes based on the current route
 */
export function useRoutePreloader() {
  const router = useRouter()
  const hasInitialLoadedRef = useRef(false)
  
  useEffect(() => {
    if (typeof window === "undefined") return
    
    // Get current path
    const currentPath = window.location.pathname
    
    // Load initial routes on first page load
    if (!hasInitialLoadedRef.current) {
      hasInitialLoadedRef.current = true
      
      // Delay the initial preload slightly to prioritize current page resources
      setTimeout(() => {
        INITIAL_PRELOAD_ROUTES.forEach(route => {
          if (route.path !== currentPath) {
            router.prefetch(route.path)
            
            if (route.preloadFn) {
              try {
                route.preloadFn()
              } catch (error) {
                console.debug(`Initial preload failed for ${route.path}:`, error)
              }
            }
          }
        })
      }, 2000) // 2 second delay for initial preload
    }
    
    // Preload related routes for current path
    const relatedRoutes = ROUTE_RELATIONSHIPS[currentPath] || []
    
    // Stagger the preloads to avoid overwhelming the browser
    relatedRoutes.forEach((route, index) => {
      setTimeout(() => {
        router.prefetch(route.path)
        
        if (route.preloadFn) {
          try {
            route.preloadFn()
          } catch (error) {
            console.debug(`Related route preload failed for ${route.path}:`, error)
          }
        }
      }, index * 300) // Stagger by 300ms per route
    })
    
  }, [router])
  
  return null
}

/**
 * Component that preloads routes based on the current path
 */
export function RoutePreloader() {
  useRoutePreloader()
  return null
}
