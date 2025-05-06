"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import {
  Calendar,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Calendar as CalendarIcon,
  ListFilter,
  CheckCircle2,
  CircleDot,
  CalendarDays,
  LayoutGrid,
  LayoutList,
} from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isPast, isFuture, isSameDay, parseISO, addMonths, getMonth, getYear } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Toggle } from "@/components/ui/toggle"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UpcomingEvent, getCreatorUpcomingEvents, getStudentUpcomingEvents } from "@/lib/actions/events"
import { useToast } from "@/hooks/use-toast"
import { UpcomingLectures } from "./upcoming-lectures"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

interface EventCalendarProps {
  variant?: "student" | "creator"
}

export function EventCalendar({ variant = "student" }: EventCalendarProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [events, setEvents] = useState<UpcomingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [userTimeZone, setUserTimeZone] = useState<string>("UTC")
  
  // Filter state
  const [view, setView] = useState<"calendar" | "list">("calendar")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SCHEDULED" | "LIVE" | "ENDED">("ALL")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const ITEMS_PER_PAGE = 10
  
  // Function to detect user's timezone
  useEffect(() => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      setUserTimeZone(timezone)
    } catch (error) {
      console.error("Failed to detect timezone:", error)
    }
  }, [])

  // Set initial values from URL parameters if they exist
  useEffect(() => {
    if (searchParams) {
      const viewParam = searchParams.get("view") as "calendar" | "list" | null
      const statusParam = searchParams.get("status") as "ALL" | "SCHEDULED" | "LIVE" | "ENDED" | null
      const queryParam = searchParams.get("query")
      const pageParam = searchParams.get("page")
      const dateParam = searchParams.get("date")
      
      if (viewParam && (viewParam === "calendar" || viewParam === "list")) setView(viewParam)
      if (statusParam) setStatusFilter(statusParam)
      if (queryParam) setSearchQuery(queryParam)
      if (pageParam && !isNaN(parseInt(pageParam))) setCurrentPage(parseInt(pageParam))
      if (dateParam) {
        try {
          const parsedDate = parseISO(dateParam)
          setCurrentDate(parsedDate)
          setSelectedDate(parsedDate)
        } catch (error) {
          console.error("Invalid date parameter:", error)
        }
      }
    }
  }, [searchParams])

  // Fetch events data
  const fetchEvents = useCallback(async () => {
    if (!session?.user?.id) return
    
    try {
      setLoading(true)
      
      // Prepare date ranges for the calendar view
      const startDate = startOfMonth(currentDate)
      const endDate = endOfMonth(currentDate)
      
      // Choose the right fetch function based on variant
      const fetchFunction = variant === "creator" 
        ? getCreatorUpcomingEvents 
        : getStudentUpcomingEvents
      
      // Set up query parameters
      const queryOptions: any = {
        timeZone: userTimeZone,
        status: statusFilter,
      }
      
      // For calendar view, fetch the entire month
      if (view === "calendar") {
        queryOptions.startDate = startDate
        queryOptions.endDate = endDate
        queryOptions.limit = 100 // Higher limit for calendar view
      } 
      // For list view, use pagination
      else {
        queryOptions.page = currentPage
        queryOptions.limit = ITEMS_PER_PAGE
      }
      
      const result = await fetchFunction(queryOptions)
      
      if (result.success) {
        // Filter by search query if present
        let filteredEvents = result.events
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase()
          filteredEvents = filteredEvents.filter(event => 
            event.title.toLowerCase().includes(query) ||
            event.courseName.toLowerCase().includes(query) ||
            (event.creatorName && event.creatorName.toLowerCase().includes(query))
          )
        }
        
        setEvents(filteredEvents)
        
        // Calculate total pages for list view
        if (view === "list" && result.total) {
          setTotalPages(Math.ceil(result.total / ITEMS_PER_PAGE))
        }
      } else {
        console.error("Error fetching events:", result.error)
        toast({
          title: "Error",
          description: "Failed to load events",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error fetching events:", error)
    } finally {
      setLoading(false)
    }
  }, [
    session?.user?.id, 
    variant, 
    currentDate, 
    userTimeZone, 
    statusFilter, 
    view, 
    currentPage, 
    searchQuery, 
    toast
  ])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Update URL when filters change
  const updateUrl = useCallback(() => {
    const params = new URLSearchParams()
    
    if (view !== "calendar") params.set("view", view)
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    if (searchQuery.trim()) params.set("query", searchQuery)
    if (currentPage > 1) params.set("page", currentPage.toString())
    if (selectedDate) params.set("date", format(selectedDate, "yyyy-MM-dd"))
    
    const newUrl = `${window.location.pathname}?${params.toString()}`
    router.push(newUrl, { scroll: false })
  }, [view, statusFilter, searchQuery, currentPage, selectedDate, router])

  useEffect(() => {
    updateUrl()
  }, [view, statusFilter, searchQuery, currentPage, selectedDate, updateUrl])

  // Handle date navigation
  const handlePreviousMonth = () => {
    setCurrentDate(prev => addMonths(prev, -1))
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1))
    setSelectedDate(null)
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(prevDate => 
      isSameDay(date, prevDate as Date) ? null : date
    )
  }

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1) // Reset to first page on new search
    fetchEvents()
  }

  // Calendar calculation
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  // Filter events for a particular day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.scheduledAt)
      return isSameDay(eventDate, date)
    })
  }

  // Filter events for the selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    return getEventsForDay(selectedDate)
  }, [selectedDate, events])

  // Format date for display
  const formatEventDate = (dateString: string) => {
    const date = parseISO(dateString)
    return format(date, "EEE, MMM d, yyyy h:mm a")
  }

  // Format event status for display
  const formatEventStatus = (status: string) => {
    switch (status) {
      case "LIVE":
        return <Badge className="bg-red-500">Live Now</Badge>
      case "SCHEDULED":
        return <Badge variant="outline">Upcoming</Badge>
      case "ENDED":
        return <Badge variant="secondary">Ended</Badge>
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-2">
        <h2 className="text-2xl font-bold tracking-tight">
          {variant === "creator" ? "Your Events Calendar" : "Event Calendar"}
        </h2>
        
        <div className="flex gap-2">
          <Tabs 
            value={view} 
            onValueChange={(v) => setView(v as "calendar" | "list")}
            className="w-auto"
          >
            <TabsList className="grid w-[180px] grid-cols-2">
              <TabsTrigger value="calendar" className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-1">
                <LayoutList className="h-4 w-4" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {variant === "creator" && (
            <Button asChild>
              <Link href="/dashboard/creator/content/upload">
                <Plus className="h-4 w-4 mr-1" />
                Schedule Event
              </Link>
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search events..."
              className="pl-8 w-full sm:w-[250px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        
        <div className="flex items-center gap-2">
          <Select 
            value={statusFilter} 
            onValueChange={(value) => setStatusFilter(value as any)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="LIVE">Live Now</SelectItem>
              <SelectItem value="SCHEDULED">Upcoming</SelectItem>
              <SelectItem value="ENDED">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        {view === "calendar" ? (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="font-medium text-lg">
                    {format(currentDate, 'MMMM yyyy')}
                  </h3>
                  <Button variant="outline" size="icon" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setCurrentDate(new Date())
                    setSelectedDate(null)
                  }}
                >
                  Today
                </Button>
              </div>
            </CardHeader>
            
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div 
                        key={day} 
                        className="text-center text-xs font-medium text-muted-foreground p-2"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, i) => {
                      const dayEvents = getEventsForDay(day)
                      const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                      return (
                        <div
                          key={i}
                          className={cn(
                            "border rounded-md min-h-24 p-1",
                            !isSameMonth(day, currentDate) && "bg-muted/30",
                            isToday(day) && "border-primary",
                            isSelected && "border-primary bg-primary/5",
                            "cursor-pointer hover:bg-muted/50 transition-colors"
                          )}
                          onClick={() => handleDateClick(day)}
                        >
                          <div className="flex justify-between items-start">
                            <span className={cn(
                              "text-xs font-medium",
                              isToday(day) && "text-primary font-bold",
                              !isSameMonth(day, currentDate) && "text-muted-foreground"
                            )}>
                              {format(day, 'd')}
                            </span>
                            {dayEvents.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {dayEvents.length}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="mt-1 space-y-1 overflow-hidden">
                            {dayEvents.slice(0, 2).map((event, idx) => (
                              <div 
                                key={idx}
                                className={cn(
                                  "text-xs truncate rounded px-1 py-0.5",
                                  event.status === "LIVE" && "bg-red-500/10 text-red-700 dark:text-red-400",
                                  event.status === "SCHEDULED" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                                  event.status === "ENDED" && "bg-gray-500/10 text-gray-700 dark:text-gray-400"
                                )}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-muted-foreground text-center">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
            
            {selectedDate && (
              <CardFooter className="flex-col items-stretch border-t p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">
                    Events for {format(selectedDate, 'MMMM d, yyyy')}
                  </h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedDate(null)}
                  >
                    Clear
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedDateEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No events scheduled for this day
                    </p>
                  ) : (
                    selectedDateEvents.map((event, idx) => (
                      <div 
                        key={idx} 
                        className="border rounded-md p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-medium">{event.title}</h5>
                              {formatEventStatus(event.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">{event.courseName}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{format(parseISO(event.scheduledAt), 'h:mm a')}</span>
                              {event.duration && (
                                <span>({event.duration} min)</span>
                              )}
                            </div>
                          </div>
                          
                          <Button
                            asChild
                            variant={event.status === "LIVE" ? "default" : "outline"}
                            size="sm"
                            className={event.status === "LIVE" ? "bg-red-500 hover:bg-red-600" : ""}
                          >
                            <Link href={`/content/${event.courseId}/player/${event.id}`}>
                              {event.status === "LIVE" ? "Join Now" : "View"}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardFooter>
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>
                {statusFilter === "ALL" 
                  ? "All scheduled and live events" 
                  : statusFilter === "LIVE" 
                    ? "Currently live events" 
                    : statusFilter === "SCHEDULED" 
                      ? "Upcoming scheduled events"
                      : "Past events"}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {events.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <h3 className="font-medium text-lg mb-1">No events found</h3>
                      <p className="text-sm text-muted-foreground">
                        {searchQuery 
                          ? "Try adjusting your search or filters" 
                          : variant === "creator"
                            ? "Schedule your first event to see it here"
                            : "Enroll in courses with live sessions to see them here"}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{event.title}</div>
                                <div className="text-sm text-muted-foreground">{event.courseName}</div>
                                {variant === "student" && event.creatorName && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Avatar className="h-4 w-4">
                                      <AvatarImage src={event.creatorImage || ""} />
                                      <AvatarFallback>{event.creatorName[0]}</AvatarFallback>
                                    </Avatar>
                                    <span>{event.creatorName}</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatEventDate(event.scheduledAt)}
                              {event.duration && (
                                <div className="text-xs text-muted-foreground">
                                  Duration: {event.duration} minutes
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {event.status === "LIVE" && (
                                  <CircleDot className="h-3 w-3 text-red-500 animate-pulse" />
                                )}
                                {formatEventStatus(event.status)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                asChild
                                variant={event.status === "LIVE" ? "default" : "outline"}
                                size="sm"
                                className={event.status === "LIVE" ? "bg-red-500 hover:bg-red-600" : ""}
                              >
                                <Link href={`/content/${event.courseId}/player/${event.id}`}>
                                  {event.status === "LIVE" ? "Join Now" : "View Details"}
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </CardContent>
            
            {/* Pagination controls */}
            {events.length > 0 && totalPages > 1 && (
              <CardFooter className="flex justify-between border-t px-6 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardFooter>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}