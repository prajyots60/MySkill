"use client"

import type React from "react"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState, useRef, useEffect } from "react"

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  // Use ref to avoid recreating QueryClient on each render
  const queryClientRef = useRef<QueryClient | null>(null)

  // Create QueryClient only once
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          // Optimize for performance
          staleTime: 300 * 1000, // 5 minutes
          gcTime: 15 * 60 * 1000, // 15 minutes
          refetchOnWindowFocus: false, // Disable refetch on window focus
          refetchOnReconnect: false, // Disable refetch on reconnect
          retry: 1, // Only retry once
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
          // Deduplication is critical to prevent duplicate requests
          refetchOnMount: false, // Prevent refetch when component mounts
          // Note: suspense option removed as it must be specified per-query in v5+
        },
        mutations: {
          retry: 1,
          retryDelay: 1000,
        },
      },
    })
  }

  // Only load DevTools in development and client-side
  const [showDevtools, setShowDevtools] = useState(false)

  useEffect(() => {
    // Only load in development
    if (process.env.NODE_ENV === "development") {
      setShowDevtools(true)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClientRef.current}>
      {children}
      {showDevtools && <ReactQueryDevtools initialIsOpen={false} position="bottom" />}
    </QueryClientProvider>
  )
}
