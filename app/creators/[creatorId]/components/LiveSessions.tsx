"use client"

import React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LiveSession } from "../types/creator.types"
import { formatDate, getTimeUntilSession } from "../utils/dateFormatters"
import { Clock, Calendar, Users } from "lucide-react"

interface LiveSessionsProps {
  sessions: LiveSession[];
  themeColor?: string;
}

const LiveSessions: React.FC<LiveSessionsProps> = ({
  sessions,
  themeColor = "default"
}) => {
  const router = useRouter()
  
  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">No upcoming live sessions</h3>
        <p className="text-muted-foreground mb-4">
          The creator hasn't scheduled any live sessions yet.
        </p>
      </div>
    )
  }
  
  // Sort sessions by date (upcoming first)
  const sortedSessions = [...sessions].sort((a, b) => {
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })
  
  // Group sessions by time status
  const liveSessions = sortedSessions.filter(
    session => new Date(session.startTime) <= new Date()
  )
  
  const upcomingSessions = sortedSessions.filter(
    session => new Date(session.startTime) > new Date()
  )
  
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
      {liveSessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center">
            <Badge variant="destructive" className="mr-2 px-2 py-0.5 rounded-sm text-xs uppercase">
              LIVE NOW
            </Badge>
            Live Sessions
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {liveSessions.map(session => (
              <Card 
                key={session.id} 
                className="overflow-hidden flex flex-col border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors"
              >
                <div className="relative h-40">
                  {session.thumbnail ? (
                    <Image
                      src={session.thumbnail}
                      alt={session.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant="destructive" className="animate-pulse">
                      Live Now
                    </Badge>
                  </div>
                </div>
                
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{session.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {session.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-4 pt-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Started {formatDate(session.startTime)}</span>
                  </div>
                  
                  {session.registered && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <Users className="h-4 w-4" />
                      <span>{session.registered} attending</span>
                    </div>
                  )}
                  
                  {session.category && (
                    <div className="mt-3">
                      <Badge variant="secondary" className="text-xs">
                        {session.category}
                      </Badge>
                    </div>
                  )}
                </CardContent>
                
                <CardFooter className="pt-0 mt-auto">
                  <Button 
                    className={`${buttonClass} w-full`}
                    onClick={() => router.push(`/live/${session.id}`)}
                  >
                    Join Now
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {upcomingSessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Upcoming Sessions</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {upcomingSessions.map(session => (
              <Card 
                key={session.id} 
                className="overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="relative h-40">
                  {session.thumbnail ? (
                    <Image
                      src={session.thumbnail}
                      alt={session.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-black/60 text-white hover:bg-black/70">
                      {getTimeUntilSession(session.startTime)}
                    </Badge>
                  </div>
                </div>
                
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{session.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {session.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-4 pt-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(session.startTime)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <Clock className="h-4 w-4" />
                    <span>{session.duration} minutes</span>
                  </div>
                  
                  {session.registered && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <Users className="h-4 w-4" />
                      <span>{session.registered} registered</span>
                    </div>
                  )}
                  
                  {session.category && (
                    <div className="mt-3">
                      <Badge variant="secondary" className="text-xs">
                        {session.category}
                      </Badge>
                    </div>
                  )}
                </CardContent>
                
                <CardFooter className="pt-0 mt-auto">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push(`/live/${session.id}`)}
                  >
                    Register
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveSessions