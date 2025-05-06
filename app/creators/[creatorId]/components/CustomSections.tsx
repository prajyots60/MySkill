"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomSection } from "../types/creator.types"

interface CustomSectionsProps {
  sections: CustomSection[];
  themeColor?: string;
}

const CustomSections: React.FC<CustomSectionsProps> = ({
  sections,
  themeColor = "default"
}) => {
  if (!sections || sections.length === 0) return null
  
  // Theme color classes
  const themeColors = {
    default: "from-primary/5 to-transparent",
    blue: "from-blue-500/5 to-transparent",
    green: "from-green-500/5 to-transparent",
    purple: "from-purple-500/5 to-transparent",
    amber: "from-amber-500/5 to-transparent",
    rose: "from-rose-500/5 to-transparent",
  }
  
  const gradientClass = themeColors[themeColor as keyof typeof themeColors] || themeColors.default
  
  return (
    <div className="space-y-8">
      {sections.map((section, index) => (
        <Card 
          key={index} 
          className={`bg-gradient-to-r ${gradientClass} border-transparent`}
        >
          <CardHeader>
            <CardTitle className="text-xl">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, '<br />') }}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default CustomSections