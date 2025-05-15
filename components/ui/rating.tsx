"use client"

import { useState, forwardRef } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface RatingProps {
  value?: number
  max?: number
  onChange?: (value: number) => void
  className?: string
  disabled?: boolean
  readOnly?: boolean
  size?: "sm" | "md" | "lg"
}

const starSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
}

const Rating = forwardRef<HTMLDivElement, RatingProps>(
  ({ value = 0, max = 5, onChange, className, disabled = false, readOnly = false, size = "md" }, ref) => {
    const [hoverValue, setHoverValue] = useState<number | null>(null)
    
    const handleClick = (index: number) => {
      if (disabled || readOnly) return
      // Toggle between clearing the rating and setting it if clicking on the same star
      onChange?.(value === index ? 0 : index)
    }
    
    const handleMouseEnter = (index: number) => {
      if (disabled || readOnly) return
      setHoverValue(index)
    }
    
    const handleMouseLeave = () => {
      if (disabled || readOnly) return
      setHoverValue(null)
    }
    
    const starSize = starSizes[size]
    
    return (
      <div
        ref={ref}
        className={cn("flex", className)}
        onMouseLeave={handleMouseLeave}
        aria-disabled={disabled}
      >
        {Array.from({ length: max }).map((_, index) => {
          const starValue = index + 1
          const isFilled = (hoverValue !== null ? starValue <= hoverValue : starValue <= value)
          
          return (
            <button
              key={index}
              type="button"
              className={cn(
                "rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", 
                (!disabled && !readOnly) && "hover:scale-110 transition-transform cursor-pointer",
                (disabled || readOnly) && "cursor-default"
              )}
              onClick={() => handleClick(starValue)}
              onMouseEnter={() => handleMouseEnter(starValue)}
              disabled={disabled || readOnly}
              aria-label={`${starValue} star${starValue === 1 ? "" : "s"}`}
            >
              <Star 
                className={cn(
                  starSize,
                  "transition-colors",
                  isFilled ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30",
                  (!disabled && !readOnly && !isFilled) && "hover:text-amber-400",
                  disabled && "opacity-50"
                )} 
              />
            </button>
          )
        })}
      </div>
    )
  }
)

Rating.displayName = "Rating"

export { Rating }