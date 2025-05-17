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
  ExternalLink,
  BookOpen,
  CalendarDays,
  ClipboardCheck
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
  limit = 3, // Reduce default limit to 3 for dashboard view
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

  // Format exam due date
  const formatDueDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      
      if (isToday(date)) {
        return `today, ${format(date, 'h:mm a')}`
      } else if (isTomorrow(date)) {
        return `tomorrow, ${format(date, 'h:mm a')}`
      } else {
        return format(date, 'MMM d, h:mm a')
      }
    } catch (error) {
      console.error("Error formatting due date:", error)
      return "Unknown"
    }
  }

  // Check if exam can be accessed based on scheduled date
  const canAccessExam = (scheduledAt: string): boolean => {
    try {
      const examDate = new Date(scheduledAt);
      const now = new Date();
      return now >= examDate; // Changed to a more straightforward comparison
    } catch (error) {
      console.error("Error checking exam access date:", error);
      return false; // Default to preventing access if there's an error
    }
  }

  return (
    <Card className={cn("h-auto shadow-sm", className)}>
      {showTitle && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {variant === "creator" ? "Your Upcoming Sessions" : "Upcoming Events"}
              </CardTitle>
              <CardDescription>
                {variant === "creator" 
                  ? "Live sessions you're scheduled to teach" 
                  : "Classes & exams from your enrolled courses"}
              </CardDescription>
            </div>
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
      )}
      <CardContent className={showTitle ? "p-0" : "pt-0 px-0"}>
        {loading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex space-y-2 items-start">
                <Skeleton className="h-6 w-6 rounded-md mr-2" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-1/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
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
                      {/* Event type icon based on type */}
                      <span className={cn(
                        "p-1 rounded-md flex items-center justify-center",
                        event.type === "EXAM" 
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      )}>
                        {event.type === "EXAM" ? (
                          <ClipboardCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Video className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <h4 className="font-medium text-sm">{event.title}</h4>
                      {event.status === "LIVE" && (
                        <Badge className="bg-red-500 hover:bg-red-600 gap-1">
                          <CircleDot className="h-2 w-2 animate-pulse" />
                          LIVE
                        </Badge>
                      )}
                      {event.type === "EXAM" && event.status === "PUBLISHED" && (
                        canAccessExam(event.scheduledAt) ?
                          <Badge className="bg-purple-500 hover:bg-purple-600 text-white">Available</Badge> :
                          <Badge variant="secondary" className="bg-violet-100 text-violet-700 hover:bg-violet-200 border-violet-300">Upcoming</Badge>
                      )}
                      {event.type === "EXAM" && event.status === "CLOSED" && (
                        <Badge variant="outline">Closed</Badge>
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
                      
                      {event.type === "EXAM" && event.timeLimit ? (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span>{event.timeLimit} min time limit</span>
                        </div>
                      ) : event.duration && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span>{event.duration} min</span>
                        </div>
                      )}

                      {event.type === "EXAM" && event.endDate && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3 mr-1" />
                          <span>Due {formatDueDate(event.endDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 items-end">
                    <Button
                      asChild={canAccessExam(event.scheduledAt) || event.type !== "EXAM"}
                      variant={event.status === "LIVE" ? "default" : "outline"}
                      size="sm"
                      disabled={event.type === "EXAM" && !canAccessExam(event.scheduledAt)}
                      onClick={event.type === "EXAM" && !canAccessExam(event.scheduledAt) ? () => {
                        toast({
                          title: "Exam not available yet",
                          description: `This exam will be available on ${formatScheduledTime(event.scheduledAt)}`,
                          variant: "default"
                        });
                      } : undefined}
                      className={cn(
                        event.status === "LIVE" ? "bg-red-500 hover:bg-red-600" : "",
                        event.type === "EXAM" && canAccessExam(event.scheduledAt) ? 
                          "text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100 hover:text-purple-800 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/40" : 
                          event.type === "EXAM" && !canAccessExam(event.scheduledAt) ? 
                            "text-slate-500 border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed" : 
                            ""
                      )}
                    >
                      {event.type === "EXAM" && !canAccessExam(event.scheduledAt) ? (
                        <>
                          <Calendar className="h-3 w-3 mr-1" />
                          Not Available Yet
                        </>
                      ) : (
                        <Link href={event.type === "EXAM" 
                          ? `/exams/${event.formId}` 
                          : `/content/${event.courseId}/player/${event.id}`}
                        >
                          {event.type === "EXAM" ? (
                            <>
                              <BookOpen className="h-3 w-3 mr-1" />
                              {event.status === "PUBLISHED" ? "Take Exam" : "View Exam"}
                            </>
                          ) : (
                            <>
                              <Video className="h-3 w-3 mr-1" />
                              {event.status === "LIVE" ? "Join Now" : "View Details"}
                            </>
                          )}
                        </Link>
                      )}
                    </Button>
                    
                    {variant === "student" && event.type === "LIVE" && event.status === "SCHEDULED" && (
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
                        
                        {event.type === "LIVE" && (
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
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center">
            <div className="flex justify-center mb-2">
              <div className="bg-muted/30 rounded-full p-2">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {variant === "creator" 
                ? "You don't have any upcoming sessions scheduled" 
                : "No upcoming events or exams from your courses"}
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
          <Button variant="link" size="sm" className="ml-auto flex items-center" asChild>
            <Link href={variant === "creator" ? "/dashboard/creator/calendar" : "/dashboard/student/calendar"}>
              View Calendar <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
