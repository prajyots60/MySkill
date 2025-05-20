"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

export function MobileSidebarToggle({ className }: { className?: string }) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar()
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Only render on mobile and after mounting to avoid hydration mismatch
  if (!isMobile || !isMounted) {
    return null
  }
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setOpenMobile(true)}
      className={cn(
        "fixed top-3 left-3 z-50 md:hidden mobile-sidebar-toggle", 
        "bg-background/80 backdrop-blur-sm hover:bg-background/90 border shadow-sm",
        openMobile && "opacity-0 pointer-events-none",
        className
      )}
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}
