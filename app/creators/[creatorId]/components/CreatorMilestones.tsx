"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Milestone } from "../types/creator.types"
import { Calendar, Users, Video, Globe, Award, BookOpen, Medal, Clock, BarChart } from "lucide-react"

interface CreatorMilestonesProps {
  milestones: Milestone[];
  themeColor?: string;
  layout?: "horizontal" | "grid" | "timeline";
}

const CreatorMilestones: React.FC<CreatorMilestonesProps> = ({
  milestones,
  themeColor = "default",
  layout = "horizontal"
}) => {
  if (!milestones || milestones.length === 0) return null
  
  // Icon mapping for milestone icons
  const getIcon = (iconName: string) => {
    const props = { className: "h-5 w-5 mr-3" }
    
    switch (iconName.toLowerCase()) {
      case 'calendar':
        return <Calendar {...props} />
      case 'users':
        return <Users {...props} />
      case 'video':
        return <Video {...props} />
      case 'globe':
        return <Globe {...props} />
      case 'award':
        return <Award {...props} />
      case 'bookopen':
        return <BookOpen {...props} />
      case 'medal':
        return <Medal {...props} />
      case 'clock':
        return <Clock {...props} />
      case 'barchart':
        return <BarChart {...props} />
      default:
        return <Award {...props} />
    }
  }
  
  const themeColors = {
    default: "from-primary/10 to-primary/5",
    blue: "from-blue-500/10 to-blue-500/5",
    green: "from-green-500/10 to-green-500/5",
    purple: "from-purple-500/10 to-purple-500/5",
    amber: "from-amber-500/10 to-amber-500/5",
    rose: "from-rose-500/10 to-rose-500/5",
  }
  
  const colorClass = themeColors[themeColor as keyof typeof themeColors] || themeColors.default
  
  // Render milestones as a horizontal list
  if (layout === "horizontal") {
    return (
      <div className="flex flex-wrap gap-4 my-4">
        {milestones.map((milestone, index) => (
          <Card key={index} className={`bg-gradient-to-br ${colorClass} border-none`}>
            <CardContent className="flex items-center p-4">
              {getIcon(milestone.icon)}
              <span className="font-medium">{milestone.title}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  
  // Render milestones as a grid
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 my-4">
        {milestones.map((milestone, index) => (
          <Card key={index} className={`bg-gradient-to-br ${colorClass} border-none`}>
            <CardContent className="flex items-center p-4">
              {getIcon(milestone.icon)}
              <span className="font-medium">{milestone.title}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  
  // Render milestones as a timeline
  return (
    <div className="relative pl-6 space-y-6 my-4 border-l-2 border-muted">
      {milestones.map((milestone, index) => (
        <div key={index} className="relative">
          <div className="absolute -left-[25px] p-1 bg-card rounded-full border border-border">
            {getIcon(milestone.icon)}
          </div>
          <div className="pt-1.5">
            <h4 className="font-medium">{milestone.title}</h4>
          </div>
        </div>
      ))}
    </div>
  )
}

export default CreatorMilestones