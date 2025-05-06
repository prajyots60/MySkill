"use client"

import type React from "react"

import { useState, useEffect, useRef, memo } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface OptimizedImageProps extends Omit<React.ComponentProps<typeof Image>, "onLoad" | "onError"> {
  fallbackSrc?: string
  lowQualitySrc?: string
  loadingClassName?: string
  errorClassName?: string
  withBlur?: boolean
}

const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  width,
  height,
  fallbackSrc = "/placeholder.svg",
  lowQualitySrc,
  className,
  loadingClassName,
  errorClassName,
  withBlur = true,
  priority = false,
  ...props
}: OptimizedImageProps) {
  const [loading, setLoading] = useState(!priority)
  const [error, setError] = useState(false)
  const [blurDataURL, setBlurDataURL] = useState<string | undefined>(undefined)
  const imageRef = useRef<HTMLImageElement>(null)

  // Generate blur data URL for small images
  useEffect(() => {
    if (withBlur && lowQualitySrc) {
      setBlurDataURL(lowQualitySrc)
    } else if (withBlur && typeof src === "string" && !blurDataURL) {
      // Only generate blur for string URLs, not StaticImageData
      const generateBlurPlaceholder = async () => {
        try {
          // Simple blur placeholder (in production, you'd use a proper placeholder service)
          setBlurDataURL(
            `data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#cccccc"/></svg>`,
          )
        } catch (err) {
          console.error("Failed to generate blur placeholder:", err)
        }
      }

      generateBlurPlaceholder()
    }
  }, [src, width, height, withBlur, lowQualitySrc, blurDataURL])

  // Check if image is already cached
  useEffect(() => {
    if (priority || typeof src !== "string") return

    const img = document.createElement("img")
    img.src = src as string

    if (img.complete) {
      setLoading(false)
    }
  }, [src, priority])

  // Handle image load
  const handleLoad = () => {
    setLoading(false)
    setError(false)
  }

  // Handle image error
  const handleError = () => {
    setLoading(false)
    setError(true)
    console.error(`Failed to load image: ${src}`)
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {loading && !priority && (
        <div
          className={cn(
            "absolute inset-0 bg-muted/30 animate-pulse flex items-center justify-center",
            loadingClassName,
          )}
          style={{ backdropFilter: "blur(5px)" }}
        />
      )}

      <Image
        ref={imageRef}
        src={error ? fallbackSrc : src}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "transition-opacity duration-300",
          loading && !priority ? "opacity-0" : "opacity-100",
          error && errorClassName,
        )}
        onLoad={handleLoad}
        onError={handleError}
        placeholder={blurDataURL ? "blur" : "empty"}
        blurDataURL={blurDataURL}
        priority={priority}
        {...props}
      />
    </div>
  )
})

export { OptimizedImage }
