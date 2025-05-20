"use client"

import { useState, useEffect } from 'react'
import { PanelLeft, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/ui/sidebar'

export function MobileNavHint() {
  const [showHint, setShowHint] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)
  const { isMobile } = useSidebar()
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  useEffect(() => {
    // Only proceed if component is mounted and isMobile is defined
    if (!isMounted || typeof isMobile === 'undefined') return;
    
    // Check if this is the first visit to show the hint
    const hasSeenHint = localStorage.getItem('mobile-nav-hint-seen')
    
    if (isMobile && !hasSeenHint) {
      // Show hint after a short delay for better user experience
      const timer = setTimeout(() => {
        setShowHint(true)
      }, 1500)
      
      return () => clearTimeout(timer)
    }
  }, [isMobile, isMounted])
  
  const dismissHint = () => {
    setShowHint(false)
    setHintDismissed(true)
    // Mark that user has seen the hint
    localStorage.setItem('mobile-nav-hint-seen', 'true')
  }
  
  // Don't render anything if not mounted, not on mobile or hint was dismissed
  if (!isMounted || !isMobile || hintDismissed || !showHint) {
    return null
  }
  
  return (
    <div 
      className={cn(
        "fixed top-0 left-0 w-full h-full bg-black/50 z-50 flex items-center justify-center p-4",
        "animate-in fade-in duration-300",
      )}
      onClick={dismissHint}
    >
      <div 
        className="bg-card border shadow-lg rounded-lg p-4 max-w-[280px] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center relative">
          <ArrowLeftRight className="h-6 w-6 text-primary animate-pulse" />
          <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping"></div>
        </div>
        <h3 className="font-semibold text-center">Navigation Tip</h3>
        <p className="text-sm text-center text-muted-foreground">
          Swipe right from the left edge to open the menu, or swipe left to close it.
        </p>
        <button 
          className="mt-2 w-full py-2 bg-primary text-primary-foreground rounded-md text-sm"
          onClick={dismissHint}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
