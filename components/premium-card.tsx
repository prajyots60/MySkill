"use client"

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PremiumCardProps {
  children: React.ReactNode
  className?: string
  glowColor?: string
  hoverEffect?: 'glow' | 'lift' | 'tilt' | 'none'
  glowOnHover?: boolean
  tiltIntensity?: number
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  className = "",
  glowColor = "rgba(99, 102, 241, 0.4)",
  hoverEffect = "lift",
  glowOnHover = true,
  tiltIntensity = 5
}) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hoverEffect !== 'tilt') return
    
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Calculate rotation values based on mouse position
    const rotateY = ((x / rect.width) - 0.5) * tiltIntensity
    const rotateX = ((y / rect.height) - 0.5) * -tiltIntensity
    
    setRotation({ x: rotateX, y: rotateY })
  }
  
  const handleMouseEnter = () => {
    setIsHovered(true)
  }
  
  const handleMouseLeave = () => {
    setIsHovered(false)
    setRotation({ x: 0, y: 0 })
  }
  
  const getTransformStyle = () => {
    if (hoverEffect === 'tilt') {
      return {
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) ${isHovered ? 'scale(1.02)' : 'scale(1)'}`,
        transition: 'transform 0.2s ease'
      }
    }
    
    if (hoverEffect === 'lift' && isHovered) {
      return {
        transform: 'translateY(-8px)',
        transition: 'all 0.3s ease'
      }
    }
    
    return {}
  }
  
  const getHoverStyles = () => {
    const styles: React.CSSProperties = {}
    
    if (glowOnHover && isHovered) {
      styles.boxShadow = `0 10px 25px -5px ${glowColor}, 0 8px 10px -6px rgba(0, 0, 0, 0.1)`
    }
    
    return styles
  }
  
  return (
    <Card
      className={cn(
        "premium-card border overflow-hidden relative transition-all duration-300",
        {
          "hover:shadow-xl": hoverEffect !== 'none',
        },
        className
      )}
      style={{
        ...getTransformStyle(),
        ...getHoverStyles(),
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </Card>
  )
}
