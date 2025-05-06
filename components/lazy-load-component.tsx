"use client"

import type React from "react"

import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import { useState, useEffect, Suspense } from "react"

interface LazyLoadComponentProps {
  children: React.ReactNode
  placeholder?: React.ReactNode
  threshold?: number
  rootMargin?: string
  skipLazyLoading?: boolean
}

/**
 * Component that lazy loads its children when they come into view
 */
export function LazyLoadComponent({
  children,
  placeholder,
  threshold = 0.1,
  rootMargin = "200px",
  skipLazyLoading = false,
}: LazyLoadComponentProps) {
  const [shouldRender, setShouldRender] = useState(skipLazyLoading)
  const { setRef, isVisible, hasBeenVisible } = useIntersectionObserver({
    threshold,
    rootMargin,
    freezeOnceVisible: true,
  })

  // Render immediately if skipLazyLoading is true
  useEffect(() => {
    if (skipLazyLoading) {
      setShouldRender(true)
    }
  }, [skipLazyLoading])

  // Render when visible
  useEffect(() => {
    if (isVisible || hasBeenVisible) {
      setShouldRender(true)
    }
  }, [isVisible, hasBeenVisible])

  // Default placeholder
  const defaultPlaceholder = <div className="animate-pulse bg-muted rounded-md w-full h-full min-h-[100px]"></div>

  return (
    <div ref={setRef as any}>
      {shouldRender ? (
        <Suspense fallback={placeholder || defaultPlaceholder}>{children}</Suspense>
      ) : (
        placeholder || defaultPlaceholder
      )}
    </div>
  )
}

/**
 * Higher-order component to add lazy loading to any component
 */
export function withLazyLoading<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<LazyLoadComponentProps, "children">,
) {
  return function LazyComponent(props: P) {
    return (
      <LazyLoadComponent {...options}>
        <Component {...props} />
      </LazyLoadComponent>
    )
  }
}
