"use client"

import React, { useEffect, useRef, useState } from 'react'

interface AnimatedSectionProps {
  children: React.ReactNode
  className?: string
  animation?: 'fade-up' | 'fade-in' | 'slide-in' | 'none'
  delay?: number
  threshold?: number
}

export const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  className = "",
  animation = "fade-up",
  delay = 0,
  threshold = 0.2
}) => {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { 
        threshold: threshold,
        rootMargin: '0px 0px -100px 0px'
      }
    )
    
    const section = sectionRef.current
    if (section) {
      observer.observe(section)
    }
    
    return () => {
      if (section) {
        observer.unobserve(section)
      }
    }
  }, [threshold])
  
  const getAnimationStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      opacity: 0,
      transition: `all 0.7s ease-out ${delay}s`
    }
    
    if (isVisible) {
      return {
        ...baseStyle,
        opacity: 1,
        transform: 'translateY(0) translateX(0)',
        filter: 'blur(0px)'
      }
    }
    
    switch (animation) {
      case 'fade-up':
        return {
          ...baseStyle,
          transform: 'translateY(40px)'
        }
      case 'fade-in':
        return {
          ...baseStyle,
          opacity: 0
        }
      case 'slide-in':
        return {
          ...baseStyle,
          transform: 'translateX(-40px)'
        }
      default:
        return {}
    }
  }
  
  return (
    <div 
      ref={sectionRef}
      className={className}
      style={animation !== 'none' ? getAnimationStyle() : undefined}
    >
      {children}
    </div>
  )
}
