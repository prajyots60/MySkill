"use client"

import React, { useEffect, useRef, useState } from 'react'

interface AnimatedHeadingProps {
  title: string
  subtitle?: string
  className?: string
  animationType?: 'fade' | 'slide' | 'split'
  accentColor?: string
  highlight?: boolean
}

export const AnimatedHeading: React.FC<AnimatedHeadingProps> = ({
  title,
  subtitle,
  className = "",
  animationType = "slide",
  accentColor = "bg-gradient-to-r from-indigo-500 to-purple-600",
  highlight = false
}) => {
  const headingRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      })
    }, {
      threshold: 0.1
    })
    
    if (headingRef.current) {
      observer.observe(headingRef.current)
    }
    
    return () => {
      if (headingRef.current) {
        observer.unobserve(headingRef.current)
      }
    }
  }, [])
  
  const getFadeClass = () => {
    switch (animationType) {
      case 'fade':
        return 'opacity-0 transition-opacity duration-1000 ' + (isVisible ? 'opacity-100' : '')
      case 'slide':
        return 'opacity-0 -translate-y-10 transition-all duration-700 ' + (isVisible ? 'opacity-100 translate-y-0' : '')
      case 'split':
        return 'transition-all duration-700 overflow-hidden ' + (isVisible ? 'opacity-100' : 'opacity-0')
      default:
        return ''
    }
  }
  
  return (
    <div ref={headingRef} className={`text-center mb-12 ${className}`}>
      <div className={`relative inline-block ${getFadeClass()}`}>
        <h2 className={`text-3xl md:text-4xl font-extrabold ${highlight ? `${accentColor} text-transparent bg-clip-text` : ''}`}>
          {title}
        </h2>
        {highlight && (
          <div className="absolute -bottom-3 left-0 right-0 mx-auto h-1 w-1/3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 opacity-70"></div>
        )}
      </div>
      
      {subtitle && (
        <p className={`text-center text-muted-foreground max-w-2xl mx-auto mt-4 ${getFadeClass()}`} style={{ transitionDelay: '0.2s' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
