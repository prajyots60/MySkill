"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AnimatedButtonProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'premium' | 'glow' | 'gradient' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  onClick?: () => void
  href?: string
  asChild?: boolean
  disabled?: boolean
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  className,
  variant = "default",
  size = "default",
  onClick,
  href,
  asChild,
  disabled,
  ...props
}) => {
  const getVariantClasses = (): string => {
    switch (variant) {
      case 'premium':
        return 'button-3d bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
      case 'glow':
        return 'glow-button bg-gradient-to-r from-violet-600 to-indigo-600 text-white relative overflow-hidden'
      case 'gradient':
        return 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
      case 'outline':
        return 'bg-transparent border-2 border-indigo-500 text-indigo-500 hover:bg-indigo-500 hover:text-white'
      case 'ghost':
        return 'bg-transparent hover:bg-indigo-100 text-indigo-600'
      default:
        return ''
    }
  }
  
  return (
    <Button
      className={cn(
        "transition-all duration-300 overflow-hidden group relative",
        getVariantClasses(),
        className
      )}
      size={size}
      onClick={onClick}
      asChild={asChild}
      disabled={disabled}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {variant === 'premium' && (
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          {children}
        </>
      )}
    </Button>
  )
}
