"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export function MobileNavigationProgress() {
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [isLoading, setIsLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [lastPathname, setLastPathname] = useState("")

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    // Track page changes to show loading state
    if (pathname !== lastPathname && lastPathname !== "") {
      setIsLoading(true)
      
      // Hide progress after transition completes
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 500)
      
      return () => clearTimeout(timer)
    }
    
    setLastPathname(pathname)
  }, [pathname, lastPathname])

  // Don't render anything during SSR or on desktop
  if (!isMounted || !isMobile) return null

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 h-0.5 z-[60] bg-primary/0 md:hidden",
        "transition-all duration-300",
        isLoading ? "opacity-100 bg-primary/60" : "opacity-0"
      )}
    >
      <div 
        className={cn(
          "h-full bg-primary w-1/3",
          "animate-slide-right",
          isLoading ? "opacity-100" : "opacity-0"
        )} 
      />
    </div>
  )
}
