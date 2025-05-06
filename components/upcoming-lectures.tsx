"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Calendar, 
  Clock, 
  Video, 
  AlertCircle, 
  Bell,
  BellOff,
  ArrowRight,
  Check,
  CircleDot,
  ExternalLink
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { format, formatDistance, formatDistanceToNow, isPast, isFuture, isToday, isTomorrow } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { UpcomingEvent } from "@/lib/actions/events"
import { getStudentUpcomingEvents, getCreatorUpcomingEvents, setEventReminder, getEventCalendarData } from "@/lib/actions/events"
import { useSocket } from "@/hooks/useSocket"
import type { Socket } from "socket.io-client"

// Extend Window interface to include io property
declare global {
  interface Window {
    io?: {
      socket?: Socket;
    };
  }
}

interface UpcomingLecturesProps {
  variant?: "student" | "creator"
  limit?: number
  showTitle?: boolean
  className?: string
}

export function UpcomingLectures({ 
  variant = "student", 
  limit = 5,
  showTitle = true,
  className
}: UpcomingLecturesProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  // Use our enhanced useSocket hook with silent error handling since websocket is optional here
  const { socket, isConnected, connect } = useSocket(undefined, { 
    silentErrors: true
  })
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [userTimeZone, setUserTimeZone] = useState<string>("UTC")
  
  // Function to detect user's timezone
  useEffect(() => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      setUserTimeZone(timezone)
    } catch (error) {
      console.error("Failed to detect timezone:", error)
    }
  }, [])

  // Fetch upcoming events
  const fetchEvents = useCallback(async () => {
    if (!session?.user?.id) return
    
    try {
      setLoading(true)
      
      const fetchFunction = variant === "creator" 
        ? getCreatorUpcomingEvents 
        : getStudentUpcomingEvents
        
      const result = await fetchFunction({
        limit,
        timeZone: userTimeZone
      })
      
      if (result.success) {
        setUpcomingEvents(result.events)
      } else {
        // Enhanced error handling to prevent JSON serialization issues
        let errorMessage = "Failed to load upcoming events";
        // Use type assertion to tell TypeScript that error property exists
        const errorResult = result as { success: false; error?: unknown };
        if (errorResult.error) {
          if (typeof errorResult.error === 'string') {
            errorMessage = errorResult.error;
          } else if (errorResult.error instanceof Error) {
            errorMessage = errorResult.error.message;
          } else if (typeof errorResult.error === 'object') {
            try {
              errorMessage = JSON.stringify(result.error);
            } catch (e) {
              // If JSON stringifying fails, use a generic message
              errorMessage = "Unknown error occurred";
            }
          }
        }
        
        console.error("Error fetching upcoming events:", errorMessage)
        toast({
          title: "Error",
          description: "Failed to load upcoming events",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error fetching upcoming events:", 
        error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, variant, limit, userTimeZone, toast])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Listen for real-time updates when an event goes live
  useEffect(() => {
    if (!socket) return;
    
    const handleLectureStatusUpdate = (data: { 
      lectureId: string, 
      status: 'SCHEDULED' | 'LIVE' | 'ENDED' 
    }) => {
      setUpcomingEvents(prev => prev.map(event => 
        event.id === data.lectureId 
          ? { ...event, status: data.status } 
          : event
      ));
      
      // Show toast notification when a lecture goes live
      if (data.status === 'LIVE') {
        const event = upcomingEvents.find(e => e.id === data.lectureId);
        if (event) {
          toast({
            title: "Lecture is Live!",
            description: `${event.title} has started.`,
            action: (
              <Button 
                variant="default" 
                size="sm" 
                asChild
                className="bg-primary text-primary-foreground"
              >
                <Link href={`/content/${event.courseId}/player/${event.id}`}>
                  Join Now
                </Link>
              </Button>
            ),
          });
        }
      }
    };
    
    // Add event listener
    socket.on("lecture-status-update", handleLectureStatusUpdate);
    
    // Cleanup on unmount
    return () => {
      socket.off("lecture-status-update", handleLectureStatusUpdate);
    };
  }, [socket, upcomingEvents, toast]);

  // Toggle reminder for an event
  const toggleReminder = async (eventId: string, currentState: boolean) => {
    try {
      const result = await setEventReminder(eventId, !currentState)
      
      if (result.success) {
        // Update local state
        setUpcomingEvents(prev => prev.map(event => 
          event.id === eventId 
            ? { ...event, isReminded: !currentState } 
            : event
        ))
        
        toast({
          title: currentState ? "Reminder Removed" : "Reminder Set",
          description: currentState 
            ? "You will no longer receive notifications for this event" 
            : "You will be notified before this event starts",
        })
      } else {
        // Enhanced error handling similar to fetchEvents
        let errorMessage = "Failed to update reminder";
        // Use type assertion to tell TypeScript that error property exists
        const errorResult = result as { success: false; error?: unknown };
        if (errorResult.error) {
          if (typeof errorResult.error === 'string') {
            errorMessage = errorResult.error;
          } else if (errorResult.error instanceof Error) {
            errorMessage = errorResult.error.message;
          } else if (typeof errorResult.error === 'object') {
            try {
              errorMessage = JSON.stringify(errorResult.error);
            } catch (e) {
              errorMessage = "Unknown error occurred";
            }
          }
        }
        console.error("Error toggling reminder:", errorMessage);
        toast({
          title: "Error",
          description: "Failed to update reminder",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error toggling reminder:", 
        error instanceof Error ? error.message : "Unknown error")
      toast({
        title: "Error",
        description: "Failed to update reminder",
        variant: "destructive"
      })
    }
  }

  // Add to calendar
  const addToCalendar = async (eventId: string, calendarType: 'google' | 'outlook' | 'ical') => {
    try {
      const result = await getEventCalendarData(eventId, calendarType)
      
      if (result.success && result.calendarUrl) {
        window.open(result.calendarUrl, '_blank')
      } else {
        // Enhanced error handling similar to other functions
        let errorMessage = "Failed to generate calendar link";
        if (!result.success && 'error' in result) {
          const errorResult = result as { success: false; error?: unknown };
          if (errorResult.error) {
            if (typeof errorResult.error === 'string') {
              errorMessage = errorResult.error;
            } else if (errorResult.error instanceof Error) {
              errorMessage = errorResult.error.message;
            } else if (typeof errorResult.error === 'object') {
              try {
                errorMessage = JSON.stringify(errorResult.error);
              } catch (e) {
                errorMessage = "Unknown error occurred";
              }
            }
          }
        }
        console.error("Error adding to calendar:", errorMessage);
        toast({
          title: "Error",
          description: "Failed to add event to calendar",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error adding to calendar:", 
        error instanceof Error ? error.message : "Unknown error")
      toast({
        title: "Error",
        description: "Failed to add event to calendar",
        variant: "destructive"
      })
    }
  }

  // Format scheduled time for display
  const formatScheduledTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      
      if (isToday(date)) {
        return `Today at ${format(date, 'h:mm a')}`
      } else if (isTomorrow(date)) {
        return `Tomorrow at ${format(date, 'h:mm a')}`
      } else {
        return `${format(date, 'EEE, MMM d')} at ${format(date, 'h:mm a')}`
      }
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Invalid date"
    }
  }

  // Format time until event
  const formatTimeUntil = (dateString: string) => {
    try {
      const date = new Date(dateString)
      
      if (isPast(date)) {
        return "Started " + formatDistanceToNow(date, { addSuffix: true })
      } else {
        return "Starts " + formatDistanceToNow(date, { addSuffix: true })
      }
    } catch (error) {
      console.error("Error calculating time until:", error)
      return "Unknown"
    }
  }

  return (
    <Card className={cn("h-auto", className)}>
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {variant === "creator" ? "Your Upcoming Sessions" : "Upcoming Live Classes"}
          </CardTitle>
          <CardDescription>
            {variant === "creator" 
              ? "Live sessions you're scheduled to teach" 
              : "Upcoming live sessions from your enrolled courses"}
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={showTitle ? "p-0" : "pt-0 px-0"}>
        {loading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : upcomingEvents.length > 0 ? (
          <div className="max-h-[350px] overflow-y-auto">
            {upcomingEvents.map((event) => (
              <div 
                key={event.id} 
                className="p-4 border-b last:border-0 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{event.title}</h4>
                      {event.status === "LIVE" && (
                        <Badge className="bg-red-500 hover:bg-red-600 gap-1">
                          <CircleDot className="h-2 w-2 animate-pulse" />
                          LIVE
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{event.courseName}</p>
                    
                    {event.creatorName && variant === "student" && (
                      <div className="flex items-center mt-2 text-xs text-muted-foreground">
                        <Avatar className="h-4 w-4 mr-1">
                          <AvatarImage src={event.creatorImage || ""} />
                          <AvatarFallback>{event.creatorName[0]}</AvatarFallback>
                        </Avatar>
                        <span>{event.creatorName}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center flex-wrap gap-3 mt-2">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{formatScheduledTime(event.scheduledAt)}</span>
                      </div>
                      
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>{formatTimeUntil(event.scheduledAt)}</span>
                      </div>
                      
                      {event.duration && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span>{event.duration} min</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 items-end">
                    <Button
                      asChild
                      variant={event.status === "LIVE" ? "default" : "outline"}
                      size="sm"
                      className={event.status === "LIVE" ? "bg-red-500 hover:bg-red-600" : ""}
                    >
                      <Link href={`/content/${event.courseId}/player/${event.id}`}>
                        <Video className="h-3 w-3 mr-1" />
                        {event.status === "LIVE" ? "Join Now" : "View Details"}
                      </Link>
                    </Button>
                    
                    {variant === "student" && event.status === "SCHEDULED" && (
                      <div className="flex gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => toggleReminder(event.id, Boolean(event.isReminded))}
                              >
                                {event.isReminded ? (
                                  <BellOff className="h-3 w-3" />
                                ) : (
                                  <Bell className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {event.isReminded ? "Remove reminder" : "Set reminder"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <DropdownMenu>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Calendar className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                Add to calendar
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => addToCalendar(event.id, 'google')}>
                              Google Calendar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => addToCalendar(event.id, 'outlook')}>
                              Outlook Calendar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => addToCalendar(event.id, 'ical')}>
                              iCal File
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center">
            <Video className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {variant === "creator" 
                ? "You don't have any upcoming sessions scheduled" 
                : "No upcoming live sessions from your courses"}
            </p>
            {variant === "creator" && (
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/dashboard/creator/content/create">
                  Schedule a Session
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
      {upcomingEvents.length > 0 && (
        <CardFooter className="pt-0">
          <Button variant="link" size="sm" className="ml-auto" asChild>
            <Link href={variant === "creator" ? "/dashboard/creator/calendar" : "/dashboard/student/calendar"}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
