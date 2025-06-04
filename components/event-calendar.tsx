"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
  X,
} from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isPast, isFuture, isSameDay, parseISO, addMonths, getMonth, getYear, startOfWeek, endOfWeek } from "date-fns"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  const [showEventModal, setShowEventModal] = useState(false)
  
  // Filter state
  const [view, setView] = useState<"calendar" | "list">("calendar")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SCHEDULED" | "LIVE" | "ENDED" | "PUBLISHED" | "CLOSED">("ALL")
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
  }, [searchParams])    // Memoize the fetchEvents function to prevent unnecessary recreations
  const fetchEvents = useCallback(async (shouldShowLoading = true) => {
    if (!session?.user?.id) return
    
    try {
      if (shouldShowLoading) {
        setLoading(true)
      }
      
      // Prepare date ranges for the calendar view
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      
      // For calendar view, we need to fetch events for all visible days
      // including days from adjacent months that appear in the calendar
      const startDate = view === "calendar" ? startOfWeek(monthStart) : monthStart
      const endDate = view === "calendar" ? endOfWeek(monthEnd) : monthEnd
      
      // Choose the right fetch function based on variant
      const fetchFunction = variant === "creator" 
        ? getCreatorUpcomingEvents 
        : getStudentUpcomingEvents
      
      // Set up query parameters
      const queryOptions: any = {
        timeZone: userTimeZone,
        view: view,
      }
      
      // Only set status filter if it's a valid LiveStatus for lectures
      // For exam-specific statuses, we'll filter them on the client side
      if (statusFilter !== "PUBLISHED" && statusFilter !== "CLOSED") {
        queryOptions.status = statusFilter
      } else {
        // For exam-specific filters, we need to fetch ALL events and filter them here
        queryOptions.status = "ALL"
      }
      
      // For calendar view, fetch the entire month
      if (view === "calendar") {
        queryOptions.startDate = startDate
        queryOptions.endDate = endDate
        queryOptions.limit = 100 // Higher limit for calendar view
      } 
      // For list view, use pagination and ensure we include some date range
      else {
        queryOptions.page = currentPage
        queryOptions.limit = ITEMS_PER_PAGE
        // Also include date filter in list view to ensure we get both events and exams
        queryOptions.startDate = new Date() // Default to today
        // If a specific date is selected, use that as a starting point
        if (selectedDate) {
          queryOptions.startDate = selectedDate
        }
        // Set end date to far in the future to get upcoming events
        const futureDate = new Date()
        futureDate.setFullYear(futureDate.getFullYear() + 1)
        queryOptions.endDate = futureDate
      }
      
      const result = await fetchFunction(queryOptions)
      
      if (result.success) {
        // Filter by search query if present
        let filteredEvents = result.events
        
        // Display message if no events found initially
        if (filteredEvents.length === 0 && view === "list") {
          console.log("No events returned from server for list view");
        }
        
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase()
          filteredEvents = filteredEvents.filter((event: UpcomingEvent) => 
            event.title.toLowerCase().includes(query) ||
            event.courseName.toLowerCase().includes(query) ||
            (event.creatorName && event.creatorName.toLowerCase().includes(query))
          )
        }
        
        // Additional filtering for exam statuses when needed
        if (statusFilter === "PUBLISHED" || statusFilter === "CLOSED") {
          filteredEvents = filteredEvents.filter((event: UpcomingEvent) => 
            event.type === "EXAM" && event.status === statusFilter
          )
        }
        
        // Handle status mapping for live events if the server expects different values
        // This ensures we're sending valid enum values to the Prisma query
        
        // Use functional update to ensure we don't set state with the same reference
        setEvents(prevEvents => {
          // Only update if events have actually changed
          if (JSON.stringify(prevEvents) !== JSON.stringify(filteredEvents)) {
            return filteredEvents;
          }
          return prevEvents;
        });
        
        // Calculate total pages for list view
        if (view === "list") {
          if (result.total) {
            // Server provided total count
            setTotalPages(Math.ceil(result.total / ITEMS_PER_PAGE))
          } else {
            // Calculate from the filtered results if server didn't provide total
            setTotalPages(Math.ceil(filteredEvents.length / ITEMS_PER_PAGE))
          }
          
          // Additional check for no results
          if (filteredEvents.length === 0) {
            console.log("No events after filtering for list view. Query params:", queryOptions)
          }
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
      
      // Check if it's a Prisma validation error for status
      if (error instanceof Error && error.message.includes("Invalid value for argument `liveStatus`")) {
        toast({
          title: "Filter Error",
          description: "The selected status filter is not compatible with this view. Please try a different filter.",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to load events",
          variant: "destructive"
        })
      }
    } finally {
      if (shouldShowLoading) {
        setLoading(false)
      }
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

  // Update URL when filters change - using a ref to track previous URL to avoid unnecessary updates
  const previousUrlRef = useRef<string>("")
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  const updateUrl = useCallback(() => {
    const params = new URLSearchParams()
    
    if (view !== "calendar") params.set("view", view)
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    if (searchQuery.trim()) params.set("query", searchQuery)
    if (currentPage > 1) params.set("page", currentPage.toString())
    if (selectedDate) params.set("date", format(selectedDate, "yyyy-MM-dd"))
    
    const newUrl = `${window.location.pathname}?${params.toString()}`
    
    // Only update URL if it's actually different to avoid unnecessary navigation
    if (newUrl !== previousUrlRef.current) {
      previousUrlRef.current = newUrl
      
      // Use replaceState for date clicks to avoid adding to browser history
      if (selectedDate) {
        window.history.replaceState({}, '', newUrl)
      } else {
        router.push(newUrl, { scroll: false })
      }
    }
  }, [view, statusFilter, searchQuery, currentPage, selectedDate, router])

  // Debounce URL updates to prevent rapid fire updates with a longer delay
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Set a new timer
    debounceTimerRef.current = setTimeout(() => {
      updateUrl()
    }, 300) // Longer delay to better batch changes
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
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

  // Memoize events for a particular day to prevent unnecessary calculations
  const getEventsForDay = useCallback((date: Date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.scheduledAt)
      return isSameDay(eventDate, date)
    })
  }, [events])

  const handleDateClick = useCallback((date: Date) => {
    // Don't update if it's the same date to prevent unnecessary re-renders
    if (selectedDate && isSameDay(selectedDate, date)) {
      // Just toggle the modal if it's already selected
      setShowEventModal(!showEventModal)
      return
    }
    
    // Update the selectedDate
    setSelectedDate(date)
    
    // Check if the date has events and show modal if it does
    const dateEvents = getEventsForDay(date)
    if (dateEvents.length > 0) {
      setShowEventModal(true)
    }
  }, [selectedDate, showEventModal, getEventsForDay])

  // Handle search
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1) // Reset to first page on new search
    
    // Use a background fetch to avoid showing loading state for quick searches
    fetchEvents(false)
  }, [fetchEvents])

  // Calendar calculation
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    // Calculate the start of the week for the first day of the month
    const weekStart = startOfWeek(start, { weekStartsOn: 0 }) // Sunday as the first day of the week
    // Calculate the end of the week for the last day of the month
    const weekEnd = endOfWeek(end, { weekStartsOn: 0 }) // Sunday as the first day of the week
    
    // Create an array of days from the start of the week to the end of the week
    return eachDayOfInterval({ start: weekStart, end: weekEnd })
  }, [currentDate])

  // Filter events for the selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    return getEventsForDay(selectedDate)
  }, [selectedDate, events, getEventsForDay])

  // Format date for display
  const formatEventDate = (dateString: string) => {
    const date = parseISO(dateString)
    return format(date, "EEE, MMM d, yyyy h:mm a")
  }

  // Format event status for display
  const formatEventStatus = (status: string, type: string) => {
    if (type === "EXAM") {
      switch (status) {
        case "PUBLISHED":
          return <Badge className="bg-blue-500">Available</Badge>
        case "CLOSED":
          return <Badge variant="secondary">Closed</Badge>
        case "DRAFT":
          return <Badge variant="outline">Draft</Badge>
        default:
          return null
      }
    } else {
      // For regular events (LIVE type)
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
  }

  // Check if exam can be accessed based on scheduled date
  const canAccessExam = (scheduledAt: string): boolean => {
    try {
      const examDate = new Date(scheduledAt);
      const now = new Date();
      return isPast(examDate) || isToday(examDate);
    } catch (error) {
      console.error("Error checking exam access date:", error);
      return false; // Default to preventing access if there's an error
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-2">
        <h2 className="text-2xl font-bold tracking-tight">
          {variant === "creator" ? "Your Events & Exams Calendar" : "Events & Exams Calendar"}
        </h2>
        
        <div className="flex gap-2">
          <Tabs 
            value={view} 
            onValueChange={(v) => {
              const newView = v as "calendar" | "list";
              // Only update if view actually changed
              if (newView !== view) {
                setView(newView);
                setCurrentPage(1); // Reset to first page on view change
              }
            }}
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
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/dashboard/creator/content/upload">
                  <Plus className="h-4 w-4 mr-1" />
                  Schedule Event
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/creator/exams">
                  <Plus className="h-4 w-4 mr-1" />
                  Create Exam
                </Link>
              </Button>
            </div>
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
              onChange={(e) => {
                const newValue = e.target.value;
                setSearchQuery(newValue);
                // If search query is empty, trigger search automatically
                if (newValue === '' && searchQuery !== '') {
                  // Small delay to allow state to update
                  setTimeout(() => handleSearch(new Event('submit') as any), 0);
                }
              }}
            />
          </div>
          <Button type="submit" variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        
        <div className="flex items-center gap-2">
          <Select 
            value={statusFilter} 
            onValueChange={(value) => {
              const newStatus = value as "ALL" | "SCHEDULED" | "LIVE" | "ENDED" | "PUBLISHED" | "CLOSED";
              // Only update if status actually changed
              if (newStatus !== statusFilter) {
                setStatusFilter(newStatus);
                setCurrentPage(1); // Reset to first page on filter change
              }
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="LIVE">Live Now</SelectItem>
              <SelectItem value="SCHEDULED">Upcoming</SelectItem>
              <SelectItem value="ENDED">Ended</SelectItem>
              <SelectItem value="PUBLISHED">Available Exams</SelectItem>
              <SelectItem value="CLOSED">Closed Exams</SelectItem>
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
                                  // Live events
                                  event.type === "LIVE" && event.status === "LIVE" && "bg-red-500/10 text-red-700 dark:text-red-400",
                                  event.type === "LIVE" && event.status === "SCHEDULED" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                                  event.type === "LIVE" && event.status === "ENDED" && "bg-gray-500/10 text-gray-700 dark:text-gray-400",
                                  // Exam events
                                  event.type === "EXAM" && event.status === "PUBLISHED" && "bg-purple-500/10 text-purple-700 dark:text-purple-400",
                                  event.type === "EXAM" && event.status === "CLOSED" && "bg-gray-500/10 text-gray-700 dark:text-gray-400",
                                  event.type === "EXAM" && event.status === "DRAFT" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                                )}
                              >
                                {event.type === "EXAM" ? "📝 " : ""}{event.title}
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
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Upcoming Events & Exams</CardTitle>
              <CardDescription>
                {statusFilter === "ALL" 
                  ? "All events and exams" 
                  : statusFilter === "LIVE" 
                    ? "Currently live events" 
                    : statusFilter === "SCHEDULED" 
                      ? "Upcoming scheduled events"
                      : statusFilter === "PUBLISHED"
                        ? "Available exams"
                        : statusFilter === "CLOSED"
                          ? "Closed exams"
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
                            ? "Schedule events or create exams to see them here"
                            : "Enroll in courses with live sessions or exams to see them here"}
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
                                <div className="font-medium flex items-center gap-1">
                                  {event.type === "EXAM" && <span title="Exam">📝</span>}
                                  {event.title}
                                </div>
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
                              {event.type === "EXAM" && event.timeLimit ? (
                                <div className="text-xs text-muted-foreground">
                                  Duration: {event.timeLimit} minutes
                                </div>
                              ) : event.duration ? (
                                <div className="text-xs text-muted-foreground">
                                  Duration: {event.duration} minutes
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {event.type === "LIVE" && event.status === "LIVE" && (
                                  <CircleDot className="h-3 w-3 text-red-500 animate-pulse" />
                                )}
                                {formatEventStatus(event.status, event.type)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                asChild
                                variant={event.status === "LIVE" ? "default" : "outline"}
                                size="sm"
                                className={event.status === "LIVE" ? "bg-red-500 hover:bg-red-600" : ""}
                              >
                                <Link href={event.type === "EXAM" 
                                  ? (canAccessExam(event.scheduledAt) ? `/exams/${event.formId}` : "#") 
                                  : `/content/${event.courseId}/player/${event.id}`}
                                  onClick={(e) => {
                                    // Prevent navigation if exam isn't available yet
                                    if (event.type === "EXAM" && !canAccessExam(event.scheduledAt)) {
                                      e.preventDefault();
                                      toast({
                                        title: "Exam not available yet",
                                        description: `This exam will be available on ${formatEventDate(event.scheduledAt)}`,
                                        variant: "default"
                                      });
                                    }
                                  }}
                                >
                                  {event.type === "EXAM" 
                                    ? (canAccessExam(event.scheduledAt) ? "Take Exam" : "Not Available Yet")
                                    : event.status === "LIVE" ? "Join Now" : "View Details"}
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

      {/* Event Details Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
            </DialogTitle>
            <DialogDescription>
              {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''} scheduled for this day
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 max-h-[60vh] overflow-y-auto py-4">
            {selectedDateEvents.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-muted-foreground">No events scheduled for this day</p>
              </div>
            ) : (
              selectedDateEvents.map((event, idx) => (
                <div 
                  key={idx} 
                  className="border rounded-md p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-medium text-base flex items-center gap-1.5">
                          {event.type === "EXAM" && <span title="Exam">📝</span>}
                          {event.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          {formatEventStatus(event.status, event.type)}
                          <span className="text-sm text-muted-foreground">{event.courseName}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-md p-3 text-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{format(parseISO(event.scheduledAt), 'h:mm a')}</span>
                      </div>
                      
                      {(event.type === "EXAM" && event.timeLimit) || event.duration ? (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Duration:</span>
                          <span>{event.type === "EXAM" && event.timeLimit ? event.timeLimit : event.duration} minutes</span>
                        </div>
                      ) : null}
                      
                      {event.type === "EXAM" && event.endDate && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Available until:</span>
                          <span>{format(parseISO(event.endDate), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      )}
                      
                      {/* Creator info if available */}
                      {event.creatorName && variant === "student" && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-muted-foreground">Creator:</span>
                          <div className="flex items-center gap-1">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={event.creatorImage || ""} />
                              <AvatarFallback>{event.creatorName[0]}</AvatarFallback>
                            </Avatar>
                            <span>{event.creatorName}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-end">
                      <Button
                        asChild
                        variant={event.status === "LIVE" ? "default" : "outline"}
                        className={event.status === "LIVE" ? "bg-red-500 hover:bg-red-600" : ""}
                      >
                        <Link href={event.type === "EXAM" 
                          ? (canAccessExam(event.scheduledAt) ? `/exams/${event.formId}` : "#") 
                          : `/content/${event.courseId}/player/${event.id}`}
                          onClick={(e) => {
                            // Prevent navigation if exam isn't available yet
                            if (event.type === "EXAM" && !canAccessExam(event.scheduledAt)) {
                              e.preventDefault();
                              toast({
                                title: "Exam not available yet",
                                description: `This exam will be available on ${formatEventDate(event.scheduledAt)}`,
                                variant: "default"
                              });
                            }
                          }}
                        >
                          {event.type === "EXAM" 
                            ? (canAccessExam(event.scheduledAt) ? "Take Exam" : "Not Available Yet")
                            : event.status === "LIVE" ? "Join Now" : "View Details"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEventModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}