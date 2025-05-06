"use client"

import React from "react"
import { Twitter, Youtube, Linkedin, Instagram, Globe, Facebook } from "lucide-react"

interface SocialLinksProps {
  links: Record<string, string> | null;
  size?: "small" | "default" | "large";
  theme?: "default" | "subtle" | "outline" | "solid";
}

const SocialLinks: React.FC<SocialLinksProps> = ({ 
  links, 
  size = "default", 
  theme = "default" 
}) => {
  if (!links) return null
  
  const sizeClasses = {
    small: "p-1.5",
    default: "p-2.5",
    large: "p-3.5"
  }
  
  const themeClasses = {
    default: "bg-muted hover:bg-muted/80",
    subtle: "bg-background hover:bg-muted",
    outline: "bg-transparent border hover:bg-muted/10",
    solid: "bg-primary/10 hover:bg-primary/20 text-primary"
  }
  
  const iconClass = `h-${size === "small" ? "3.5" : size === "large" ? "5" : "4"} w-${size === "small" ? "3.5" : size === "large" ? "5" : "4"}`

  const getSocialIcon = (key: string) => {
    switch (key.toLowerCase()) {
      case 'twitter':
        return <Twitter className={iconClass} />
      case 'youtube':
        return <Youtube className={iconClass} />
      case 'linkedin':
        return <Linkedin className={iconClass} />
      case 'instagram':
        return <Instagram className={iconClass} />
      case 'facebook':
        return <Facebook className={iconClass} />
      default:
        return <Globe className={iconClass} />
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {Object.entries(links).map(([key, url]) => (
        <a 
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${sizeClasses[size]} ${themeClasses[theme]} rounded-full transition-colors duration-200`}
          aria-label={`${key} profile`}
        >
          {getSocialIcon(key)}
        </a>
      ))}
    </div>
  )
}

export default SocialLinks