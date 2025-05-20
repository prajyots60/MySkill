"use client"

import { useRef, useEffect, useState } from 'react'
import { useSidebar } from '@/components/ui/sidebar'

// Swipe sensitivity - lower number = more sensitive
const SWIPE_THRESHOLD = 50

export function SidebarTouchHandler({ children }: { children: React.ReactNode }) {
  const { setOpenMobile, openMobile, isMobile } = useSidebar()
  const touchStartXRef = useRef<number | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  useEffect(() => {
    // Only process on mobile and after mounting
    if (!isMounted || typeof isMobile === 'undefined' || !isMobile) return
    
    // Add a class to the main content element when sidebar is open
    const mainElement = document.querySelector('main')
    if (mainElement) {
      if (openMobile) {
        mainElement.classList.add('mobile-content-shifted')
      } else {
        mainElement.classList.remove('mobile-content-shifted')
      }
    }
    
    // Handler for touch start
    const handleTouchStart = (e: TouchEvent) => {
      touchStartXRef.current = e.touches[0].clientX
    }
    
    // Handler for touch move - to detect swipe gesture
    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartXRef.current === null) return
      
      const touchEndX = e.touches[0].clientX
      const diff = touchStartXRef.current - touchEndX
      
      // If swiping left (closing)
      if (diff > SWIPE_THRESHOLD && openMobile) {
        setOpenMobile(false)
        touchStartXRef.current = null
      }
      
      // If swiping right (opening) - detect swipes from left edge of screen
      if (diff < -SWIPE_THRESHOLD && !openMobile && touchStartXRef.current < 30) {
        setOpenMobile(true)
        touchStartXRef.current = null
      }
    }
    
    // Handler for touch end
    const handleTouchEnd = () => {
      touchStartXRef.current = null
    }
    
    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
    
    return () => {
      // Remove event listeners on cleanup
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      
      // Clean up classes
      const mainElement = document.querySelector('main')
      if (mainElement) {
        mainElement.classList.remove('mobile-content-shifted')
      }
    }
  }, [isMounted, isMobile, openMobile, setOpenMobile])
  
  return <>{children}</>
}
