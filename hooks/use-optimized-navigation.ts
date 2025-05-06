import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePrefetch } from './use-prefetch'

type NavigationOptions = {
  prefetchData?: boolean
  prefetchComponents?: boolean
  transitionDuration?: number
  cacheNavigation?: boolean
  scrollRestoration?: boolean
}

const DEFAULT_OPTIONS: NavigationOptions = {
  prefetchData: true,
  prefetchComponents: true,
  transitionDuration: 300,
  cacheNavigation: true,
  scrollRestoration: true,
}

/**
 * Hook for optimized navigation with prefetching, transitions, and state persistence
 */
export function useOptimizedNavigation(options: NavigationOptions = {}) {
  const router = useRouter()
  const { prefetch, createHoverPrefetchHandlers } = usePrefetch()
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
  const scrollPositionsRef = useRef<Record<string, number>>({})
  const currentPathRef = useRef<string>('')
  const navigationInProgressRef = useRef<boolean>(false)

  // Save scroll position when navigating away
  useEffect(() => {
    if (typeof window === 'undefined' || !mergedOptions.scrollRestoration) return

    // Save current path
    currentPathRef.current = window.location.pathname + window.location.search

    // Save scroll position before navigation
    const handleBeforeUnload = () => {
      scrollPositionsRef.current[currentPathRef.current] = window.scrollY
      
      // Store in sessionStorage for persistence across page loads
      try {
        const scrollData = JSON.stringify(scrollPositionsRef.current)
        sessionStorage.setItem('scrollPositions', scrollData)
      } catch (error) {
        console.error('Failed to save scroll positions:', error)
      }
    }

    // Load saved scroll positions from sessionStorage
    try {
      const savedScrollPositions = sessionStorage.getItem('scrollPositions')
      if (savedScrollPositions) {
        scrollPositionsRef.current = JSON.parse(savedScrollPositions)
      }
    } catch (error) {
      console.error('Failed to load scroll positions:', error)
    }

    // Restore scroll position if returning to this page
    if (scrollPositionsRef.current[currentPathRef.current] && !navigationInProgressRef.current) {
      window.scrollTo(0, scrollPositionsRef.current[currentPathRef.current])
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [mergedOptions.scrollRestoration])

  // Optimized navigation function
  const navigateTo = useCallback(
    (
      href: string,
      {
        prefetchDataFn,
        skipTransition,
        replace,
      }: {
        prefetchDataFn?: () => Promise<any>
        skipTransition?: boolean
        replace?: boolean
      } = {}
    ) => {
      // Save current scroll position
      if (mergedOptions.scrollRestoration && typeof window !== 'undefined') {
        scrollPositionsRef.current[currentPathRef.current] = window.scrollY
      }

      // Mark navigation as in progress
      navigationInProgressRef.current = true

      // If we have a data prefetch function, execute it
      if (prefetchDataFn && mergedOptions.prefetchData) {
        // Generate a cache key based on the URL
        const cacheKey = `prefetch:${href}`
        prefetch(cacheKey, prefetchDataFn)
      }

      // Apply transition effect if enabled
      if (!skipTransition && mergedOptions.transitionDuration > 0) {
        // Add transition class to body
        document.body.classList.add('page-transition-out')
        
        // Wait for transition before navigating
        setTimeout(() => {
          // Perform the navigation
          if (replace) {
            router.replace(href)
          } else {
            router.push(href)
          }
          
          // Remove transition class after navigation
          setTimeout(() => {
            document.body.classList.remove('page-transition-out')
            document.body.classList.add('page-transition-in')
            
            // Restore scroll position if needed
            if (
              mergedOptions.scrollRestoration && 
              scrollPositionsRef.current[href] !== undefined
            ) {
              window.scrollTo(0, scrollPositionsRef.current[href])
            }
            
            // Reset transition classes
            setTimeout(() => {
              document.body.classList.remove('page-transition-in')
              navigationInProgressRef.current = false
            }, mergedOptions.transitionDuration)
          }, 50) // Small delay to ensure navigation has completed
        }, mergedOptions.transitionDuration)
      } else {
        // Perform immediate navigation without transition
        if (replace) {
          router.replace(href)
        } else {
          router.push(href)
        }
        navigationInProgressRef.current = false
      }
    },
    [router, mergedOptions, prefetch]
  )

  // Create handlers for navigation with hover prefetching
  const createNavigationHandlers = useCallback(
    (
      href: string,
      {
        prefetchDataFn,
        skipTransition,
        replace,
      }: {
        prefetchDataFn?: () => Promise<any>
        skipTransition?: boolean
        replace?: boolean
      } = {}
    ) => {
      // Create hover handlers for data prefetching
      const hoverHandlers = prefetchDataFn
        ? createHoverPrefetchHandlers(`prefetch:${href}`, prefetchDataFn)
        : {}

      return {
        ...hoverHandlers,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault()
          navigateTo(href, { prefetchDataFn, skipTransition, replace })
          hoverHandlers.onClick?.()
        },
        // For Next.js prefetching of components
        ...(mergedOptions.prefetchComponents ? { prefetch: true } : {}),
      }
    },
    [navigateTo, createHoverPrefetchHandlers, mergedOptions.prefetchComponents]
  )

  return {
    navigateTo,
    createNavigationHandlers,
  }
}

export default useOptimizedNavigation
