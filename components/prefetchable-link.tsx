"use client"

import type React from "react"

import Link from "next/link"
import { usePrefetch } from "@/lib/utils/prefetch"
import { forwardRef, useState } from "react"
import { cn } from "@/lib/utils"

interface PrefetchableLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  prefetchTimeout?: number
  prefetchResources?: boolean
  showPrefetchIndicator?: boolean
}

export const PrefetchableLink = forwardRef<HTMLAnchorElement, PrefetchableLinkProps>(
  (
    {
      href,
      children,
      className,
      prefetchTimeout = 100,
      prefetchResources = false,
      showPrefetchIndicator = false,
      ...props
    },
    ref,
  ) => {
    const [isHovering, setIsHovering] = useState(false)
    const { isPrefetched, ...prefetchProps } = usePrefetch(href.toString(), {
      timeout: prefetchTimeout,
      prefetchResources,
    })

    return (
      <Link
        ref={ref}
        href={href}
        className={cn(className)}
        onMouseEnter={(e) => {
          setIsHovering(true)
          prefetchProps.onMouseEnter()
          props.onMouseEnter?.(e)
        }}
        onMouseLeave={(e) => {
          setIsHovering(false)
          prefetchProps.onMouseLeave()
          props.onMouseLeave?.(e)
        }}
        onFocus={(e) => {
          prefetchProps.onFocus()
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          prefetchProps.onBlur()
          props.onBlur?.(e)
        }}
        {...props}
      >
        {children}
        {showPrefetchIndicator && isHovering && !isPrefetched && (
          <span className="ml-1 inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
        )}
      </Link>
    )
  },
)

PrefetchableLink.displayName = "PrefetchableLink"
