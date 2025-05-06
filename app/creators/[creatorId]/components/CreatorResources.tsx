"use client"

import React from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Resource } from "../types/creator.types"
import { Download, ExternalLink, FileText, Video, Bookmark } from "lucide-react"

interface CreatorResourcesProps {
  resources: Resource[];
  description?: string;
  cta?: string;
  ctaLink?: string;
  themeColor?: string;
}

const CreatorResources: React.FC<CreatorResourcesProps> = ({
  resources,
  description,
  cta,
  ctaLink,
  themeColor = "default"
}) => {
  if (!resources || resources.length === 0) return null
  
  // Get icon based on resource type/extension
  const getResourceIcon = (resource: Resource) => {
    const url = resource.url.toLowerCase()
    
    if (url.includes('pdf')) {
      return <FileText className="h-10 w-10 text-red-500" />
    } else if (url.includes('doc') || url.includes('docx')) {
      return <FileText className="h-10 w-10 text-blue-500" />
    } else if (url.includes('xls') || url.includes('xlsx') || url.includes('csv')) {
      return <FileText className="h-10 w-10 text-green-500" />
    } else if (url.includes('ppt') || url.includes('pptx')) {
      return <FileText className="h-10 w-10 text-orange-500" />
    } else if (url.includes('mp4') || url.includes('mov') || url.includes('avi') || url.includes('webm')) {
      return <Video className="h-10 w-10 text-purple-500" />
    } else {
      return <Bookmark className="h-10 w-10 text-gray-500" />
    }
  }
  
  // Theme color classes for buttons
  const themeClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    blue: "bg-blue-500 text-white hover:bg-blue-600",
    green: "bg-green-500 text-white hover:bg-green-600",
    purple: "bg-purple-500 text-white hover:bg-purple-600",
    amber: "bg-amber-500 text-white hover:bg-amber-600",
    rose: "bg-rose-500 text-white hover:bg-rose-600",
  }
  
  const buttonClass = themeClasses[themeColor as keyof typeof themeClasses] || themeClasses.default
  
  return (
    <div className="space-y-8">
      {description && (
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-muted-foreground">{description}</p>
          
          {cta && ctaLink && (
            <Button asChild className={`mt-4 ${buttonClass}`}>
              <Link href={ctaLink}>
                {cta}
              </Link>
            </Button>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.map((resource, index) => (
          <Card key={index} className="flex flex-col h-full">
            <CardHeader>
              <div className="flex justify-center mb-4">
                {getResourceIcon(resource)}
              </div>
              <CardTitle className="text-center text-lg">{resource.title}</CardTitle>
              <CardDescription className="text-center">
                {resource.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow"></CardContent>
            <CardFooter>
              <Button 
                asChild 
                className={`w-full ${buttonClass}`}
              >
                <a 
                  href={resource.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  download={resource.url.includes('pdf') || resource.url.includes('doc')}
                >
                  {resource.url.includes('pdf') || resource.url.includes('doc') ? (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {resource.buttonText || "Download"}
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {resource.buttonText || "View Resource"}
                    </>
                  )}
                </a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default CreatorResources