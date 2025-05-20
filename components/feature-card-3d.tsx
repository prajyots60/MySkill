"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  className?: string
  borderColor?: string
  tiltIntensity?: number
  children?: React.ReactNode
}

export const FeatureCard3D: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  className = "",
  borderColor = "indigo-500",
  tiltIntensity = 10,
  children
}) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
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
  
  return (
    <Card 
      className={cn(
        `shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden`,
        className
      )}
      style={{
        borderTopWidth: '4px',
        borderTopColor: `var(--${borderColor}, #6366f1)`,
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) ${isHovered ? 'scale(1.02)' : 'scale(1)'}`,
        transition: 'transform 0.2s ease',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <CardHeader>
        <div 
          className="h-12 w-12 mb-2 transition-transform duration-300"
          style={{ 
            transform: isHovered ? 'translateY(-5px)' : 'translateY(0px)',
            color: `var(--${borderColor}, #6366f1)`
          }}
        >
          {icon}
        </div>
        <CardTitle className="transition-colors duration-300" 
          style={{ color: isHovered ? `var(--${borderColor}, #6366f1)` : '' }}>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}
