"use client"

import type React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { usePrefetch } from "@/hooks/use-prefetch"
import { forwardRef, useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface PrefetchableLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  prefetchTimeout?: number
  prefetchResources?: boolean
  prefetchOnMount?: boolean
  instantHoverLoad?: boolean
  showPrefetchIndicator?: boolean
  preloadData?: () => Promise<any>
}

export const PrefetchableLink = forwardRef<HTMLAnchorElement, PrefetchableLinkProps>(
  (
    {
      href,
      children,
      className,
      prefetchTimeout = 50, // Reduced from 100ms to 50ms for faster response
      prefetchResources = true,
      prefetchOnMount = false,
      instantHoverLoad = true,
      showPrefetchIndicator = false,
      preloadData,
      ...props
    },
    ref,
  ) => {
    const router = useRouter()
    const [isHovering, setIsHovering] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)
    const mountedRef = useRef(false)
    const { prefetch, createHoverPrefetchHandlers } = usePrefetch()
    
    const hrefString = href.toString()
    const cacheKey = `route:${hrefString}`

    // Set up prefetch handlers
    const prefetchHandlers = createHoverPrefetchHandlers(
      cacheKey,
      async () => {
        // Start preloading route data
        router.prefetch(hrefString)
        
        // If we have custom data preloading function, run it
        if (preloadData) {
          try {
            await preloadData()
          } catch (error) {
            console.debug(`Data prefetch failed for ${hrefString}:`, error)
          }
        }
        
        return true
      },
      { hoverDelay: prefetchTimeout }
    )

    // Prefetch on mount if enabled
    useEffect(() => {
      if (prefetchOnMount && !mountedRef.current) {
        mountedRef.current = true
        router.prefetch(hrefString)
        
        if (preloadData) {
          prefetch(cacheKey, preloadData)
        }
      }
    }, [prefetchOnMount, hrefString, router, prefetch, cacheKey, preloadData])

    // Handle instant loading on hover
    const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
      setIsHovering(true)
      prefetchHandlers.onMouseEnter()
      
      if (instantHoverLoad) {
        hoverTimerRef.current = setTimeout(() => {
          setIsLoading(true)
          // Preload the page in background
          router.prefetch(hrefString)
        }, 100) // Very short delay before starting to load
      }
      
      props.onMouseEnter?.(e)
    }

    const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
      setIsHovering(false)
      prefetchHandlers.onMouseLeave()
      
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      
      setIsLoading(false)
      props.onMouseLeave?.(e)
    }

    return (
      <Link
        ref={ref}
        href={href}
        prefetch={true}
        scroll={false}
        className={cn(className, {
          'is-loading': isLoading,
        })}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={(e) => {
          router.prefetch(hrefString)
          props.onFocus?.(e)
        }}
        {...props}
      >
        {children}
        {showPrefetchIndicator && isHovering && (
          <span className="ml-1 inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
        )}
      </Link>
    )
  },
)

PrefetchableLink.displayName = "PrefetchableLink"

PrefetchableLink.displayName = "PrefetchableLink"
