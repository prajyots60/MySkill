"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Badge as BadgeType } from "../types/creator.types"
import { 
  Award, Heart, TrendingUp, Star, 
  Trophy, Zap, Shield, BookOpen, 
  Crown, Diamond, Medal
} from "lucide-react"

interface CreatorBadgesProps {
  badges: BadgeType[];
  size?: "small" | "default" | "large";
  layout?: "horizontal" | "vertical" | "grid";
}

const CreatorBadges: React.FC<CreatorBadgesProps> = ({ 
  badges,
  size = "default",
  layout = "horizontal"
}) => {
  if (!badges || !badges.length) return null
  
  const sizeClasses = {
    small: "text-xs py-0.5 px-2",
    default: "text-sm py-1 px-3",
    large: "text-base py-1.5 px-4"
  }
  
  const getBadgeIcon = (iconName: string) => {
    const iconProps = { 
      className: `mr-1 ${size === "small" ? "h-3 w-3" : size === "large" ? "h-5 w-5" : "h-4 w-4"}`,
      strokeWidth: size === "small" ? 2.5 : 2
    }
    
    switch (iconName.toLowerCase()) {
      case 'award':
        return <Award {...iconProps} />
      case 'heart':
        return <Heart {...iconProps} />
      case 'trendingup':
        return <TrendingUp {...iconProps} />
      case 'star':
        return <Star {...iconProps} />
      case 'trophy':
        return <Trophy {...iconProps} />
      case 'zap':
        return <Zap {...iconProps} />
      case 'shield':
        return <Shield {...iconProps} />
      case 'bookopen':
        return <BookOpen {...iconProps} />
      case 'crown':
        return <Crown {...iconProps} />
      case 'diamond':
        return <Diamond {...iconProps} />
      case 'lightning':
        return <Zap {...iconProps} />
      case 'medal':
        return <Medal {...iconProps} />
      default:
        return <Award {...iconProps} />
    }
  }
  
  const getBadgeColor = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      green: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
      teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
      cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    }
    
    return colorMap[color.toLowerCase()] || "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20"
  }
  
  const layoutClasses = {
    horizontal: "flex flex-wrap gap-2",
    vertical: "flex flex-col gap-2",
    grid: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
  }
  
  return (
    <div className={layoutClasses[layout]}>
      {badges.map((badge, index) => (
        <Badge 
          key={index}
          variant="outline"
          className={`flex items-center gap-1 border ${sizeClasses[size]} ${getBadgeColor(badge.color)}`}
        >
          {getBadgeIcon(badge.icon)}
          <span>{badge.title}</span>
        </Badge>
      ))}
    </div>
  )
}

export default CreatorBadges