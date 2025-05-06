"use client"

import { SessionProvider } from "next-auth/react"
import type { ReactNode } from "react"

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      // Add session configuration to reduce auth API calls
      refetchInterval={5 * 60} // Only refetch session every 5 minutes
      refetchOnWindowFocus={false} // Don't refetch on window focus
    >
      {children}
    </SessionProvider>
  )
}
