"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
import { redis } from "@/lib/redis"
import { format, addHours, isBefore, isAfter, parseISO } from "date-fns"
import { toZonedTime } from "date-fns-tz"

// Ensure we have a Prisma instance
let prisma: PrismaClient

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient()
} else {
  // In development, use global to prevent multiple instances during hot reloading
  if (!global.prisma) {
    global.prisma = new PrismaClient()
  }
  prisma = global.prisma
}

// Cache key prefixes
const UPCOMING_CREATOR_EVENTS_CACHE_KEY = "creator:upcoming-events"
const UPCOMING_STUDENT_EVENTS_CACHE_KEY = "student:upcoming-events"

// Cache duration in seconds (10 minutes)
const CACHE_DURATION = 60 * 10

// Types for event responses
export interface UpcomingEvent {
  id: string
  title: string
  type: "LIVE"
  status: "SCHEDULED" | "LIVE" | "ENDED"
  scheduledAt: string
  courseId: string
  courseName: string
  sectionId: string
  sectionName: string
  creatorId: string
  creatorName: string | null
  creatorImage: string | null
  duration?: number | null
  isReminded?: boolean
}

interface EventQueryOptions {
  page?: number
  limit?: number
  startDate?: Date
  endDate?: Date
  status?: "SCHEDULED" | "LIVE" | "ENDED" | "ALL"
  timeZone?: string
}

// Get upcoming events for a creator
export async function getCreatorUpcomingEvents(options: EventQueryOptions = {}) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    const {
      page = 1,
      limit = 5,
      startDate = new Date(),
      endDate,
      status = "ALL",
      timeZone = "UTC",
    } = options

    // Try to get from cache first if no special options are provided
    if (page === 1 && limit === 5 && !endDate && status === "ALL") {
      const cacheKey = `${UPCOMING_CREATOR_EVENTS_CACHE_KEY}:${session.user.id}`
      const cachedEvents = await redis.get(cacheKey)
      
      if (cachedEvents) {
        try {
          // Handle both string and object cases
          const events = typeof cachedEvents === 'string' 
            ? JSON.parse(cachedEvents)
            : cachedEvents;
          return { success: true, events }
        } catch (parseError) {
          console.error("Error parsing cached events:", parseError);
          // Continue to fetch fresh data
        }
      }
    }

    // Build query conditions
    const whereConditions: any = {
      type: "LIVE",
      section: {
        content: {
          creatorId: session.user.id,
        },
      },
    }

    // Filter by status
    if (status !== "ALL") {
      whereConditions.liveStatus = status
    }

    // Filter by date range
    if (status === "SCHEDULED" || status === "ALL") {
      whereConditions.scheduledAt = {
        gte: startDate,
      }
      
      if (endDate) {
        whereConditions.scheduledAt.lte = endDate
      }
    }

    // Query the database
    const lectures = await prisma.lecture.findMany({
      where: whereConditions,
      orderBy: [
        { liveStatus: { sort: "asc", nulls: "last" } }, // SCHEDULED first, then LIVE, then ENDED
        { scheduledAt: "asc" }, // Closest scheduled time first
      ],
      include: {
        section: {
          select: {
            id: true,
            title: true,
            content: {
              select: {
                id: true,
                title: true,
                creator: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // Get event reminders separately for type safety
    const eventReminders = session.user.id 
      ? await prisma.eventReminder.findMany({
          where: { 
            userId: session.user.id,
            lectureId: { in: lectures.map(lecture => lecture.id) }
          }
        })
      : []

    // Count total for pagination
    const total = await prisma.lecture.count({
      where: whereConditions,
    })

    // Transform the data
    const events: UpcomingEvent[] = lectures.map((lecture: any) => ({
      id: lecture.id,
      title: lecture.title,
      type: "LIVE",
      status: lecture.liveStatus || "SCHEDULED",
      scheduledAt: formatDateToTimeZone(lecture.scheduledAt, timeZone),
      courseId: lecture.section.content.id,
      courseName: lecture.section.content.title,
      sectionId: lecture.section.id,
      sectionName: lecture.section.title,
      creatorId: lecture.section.content.creator.id,
      creatorName: lecture.section.content.creator.name,
      creatorImage: lecture.section.content.creator.image,
      duration: lecture.duration,
      isReminded: eventReminders.some(reminder => reminder.lectureId === lecture.id),
    }))

    // Cache the results if this is the default query
    if (page === 1 && limit === 5 && !endDate && status === "ALL") {
      const cacheKey = `${UPCOMING_CREATOR_EVENTS_CACHE_KEY}:${session.user.id}`
      await redis.set(cacheKey, JSON.stringify(events), {
        ex: CACHE_DURATION,
      })
    }

    return { success: true, events, total }
  } catch (error) {
    console.error("Error getting creator upcoming events:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get upcoming events" 
    }
  }
}

// Get upcoming events for a student
export async function getStudentUpcomingEvents(options: EventQueryOptions = {}) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    const {
      page = 1,
      limit = 5,
      startDate = new Date(),
      endDate,
      status = "ALL",
      timeZone = "UTC",
    } = options

    // Try to get from cache first if no special options are provided
    if (page === 1 && limit === 5 && !endDate && status === "ALL") {
      const cacheKey = `${UPCOMING_STUDENT_EVENTS_CACHE_KEY}:${session.user.id}`
      const cachedEvents = await redis.get(cacheKey)
      
      if (cachedEvents) {
        try {
          // Handle both string and object cases
          const events = typeof cachedEvents === 'string' 
            ? JSON.parse(cachedEvents)
            : cachedEvents;
          return { success: true, events }
        } catch (parseError) {
          console.error("Error parsing cached events:", parseError);
          // Continue to fetch fresh data
        }
      }
    }

    // Build query conditions
    const whereConditions: any = {
      type: "LIVE",
      section: {
        content: {
          enrollments: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    }

    // Filter by status for live lectures
    if (status !== "ALL") {
      whereConditions.liveStatus = status
    } else {
      // For ALL, include both SCHEDULED (future) and LIVE
      whereConditions.OR = [
        { liveStatus: "SCHEDULED", scheduledAt: { gte: startDate } },
        { liveStatus: "LIVE" },
      ]
    }

    // Additional date filtering for SCHEDULED status
    if (status === "SCHEDULED") {
      whereConditions.scheduledAt = {
        gte: startDate,
      }
      
      if (endDate) {
        whereConditions.scheduledAt.lte = endDate
      }
    }

    // Query the database
    const lectures = await prisma.lecture.findMany({
      where: whereConditions,
      orderBy: [
        { liveStatus: { sort: "asc", nulls: "last" } }, // LIVE first, then SCHEDULED
        { scheduledAt: "asc" }, // Closest scheduled time first
      ],
      include: {
        section: {
          select: {
            id: true,
            title: true,
            content: {
              select: {
                id: true,
                title: true,
                creator: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // Get event reminders separately for type safety
    const eventReminders = session.user.id 
      ? await prisma.eventReminder.findMany({
          where: { 
            userId: session.user.id,
            lectureId: { in: lectures.map(lecture => lecture.id) }
          }
        })
      : []

    // Count total for pagination
    const total = await prisma.lecture.count({
      where: whereConditions,
    })

    // Transform the data
    const events: UpcomingEvent[] = lectures.map((lecture: any) => ({
      id: lecture.id,
      title: lecture.title,
      type: "LIVE",
      status: lecture.liveStatus || "SCHEDULED",
      scheduledAt: formatDateToTimeZone(lecture.scheduledAt, timeZone),
      courseId: lecture.section.content.id,
      courseName: lecture.section.content.title,
      sectionId: lecture.section.id,
      sectionName: lecture.section.title,
      creatorId: lecture.section.content.creator.id,
      creatorName: lecture.section.content.creator.name,
      creatorImage: lecture.section.content.creator.image,
      duration: lecture.duration,
      isReminded: eventReminders.some(reminder => reminder.lectureId === lecture.id),
    }))

    // Cache the results if this is the default query
    if (page === 1 && limit === 5 && !endDate && status === "ALL") {
      const cacheKey = `${UPCOMING_STUDENT_EVENTS_CACHE_KEY}:${session.user.id}`
      await redis.set(cacheKey, JSON.stringify(events), {
        ex: CACHE_DURATION,
      })
    }

    return { success: true, events, total }
  } catch (error) {
    console.error("Error getting student upcoming events:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get upcoming events" 
    }
  }
}

// Set a reminder for an event
export async function setEventReminder(lectureId: string, remind: boolean = true) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if the lecture exists and user is enrolled
    const lecture = await prisma.lecture.findFirst({
      where: {
        id: lectureId,
        section: {
          content: {
            OR: [
              { creatorId: session.user.id },
              {
                enrollments: {
                  some: {
                    userId: session.user.id,
                  },
                },
              },
            ],
          },
        },
      },
      include: {
        section: {
          select: {
            contentId: true
          }
        }
      }
    })

    if (!lecture) {
      throw new Error("Lecture not found or you don't have access")
    }

    if (remind) {
      // Add reminder (or do nothing if already reminded)
      await prisma.eventReminder.upsert({
        where: {
          userId_lectureId: {
            userId: session.user.id,
            lectureId: lectureId,
          },
        },
        update: {},
        create: {
          userId: session.user.id,
          lectureId: lectureId,
        },
      })
    } else {
      // Remove reminder
      await prisma.eventReminder.deleteMany({
        where: {
          userId: session.user.id,
          lectureId: lectureId,
        },
      })
    }

    // Invalidate cache
    const cacheKey = `${UPCOMING_STUDENT_EVENTS_CACHE_KEY}:${session.user.id}`
    await redis.del(cacheKey)

    // Revalidate paths
    revalidatePath('/dashboard/student')
    revalidatePath(`/content/${lecture.section.contentId}/player/${lectureId}`)

    return { success: true }
  } catch (error) {
    console.error("Error setting event reminder:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to set reminder" 
    }
  }
}

// Add event to calendar
export async function getEventCalendarData(lectureId: string, format: 'google' | 'ical' | 'outlook' = 'google') {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Get lecture with related data
    const lecture = await prisma.lecture.findFirst({
      where: {
        id: lectureId,
        section: {
          content: {
            OR: [
              { creatorId: session.user.id },
              {
                enrollments: {
                  some: {
                    userId: session.user.id,
                  },
                },
              },
            ]
          }
        }
      },
      include: {
        section: {
          select: {
            title: true,
            content: {
              select: {
                id: true,
                title: true,
                creator: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!lecture) {
      throw new Error("Lecture not found or you don't have access")
    }

    if (!lecture.scheduledAt) {
      throw new Error("This lecture doesn't have a scheduled time")
    }

    // Create calendar event data
    const startTime = new Date(lecture.scheduledAt)
    const endTime = lecture.duration 
      ? new Date(startTime.getTime() + lecture.duration * 60 * 1000) 
      : new Date(startTime.getTime() + 60 * 60 * 1000) // Default 1 hour if no duration
    
    const eventTitle = `${lecture.title} - ${lecture.section.content.title}`
    const eventDescription = `Live session by ${lecture.section.content.creator.name || 'Instructor'}\n\n${lecture.description || ''}`
    const eventLocation = `${process.env.NEXT_PUBLIC_APP_URL}/content/${lecture.section.content.id}/player/${lecture.id}`
    
    // Format based on calendar type
    let calendarUrl = ''
    
    if (format === 'google') {
      // Google Calendar format
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: eventTitle,
        details: eventDescription,
        location: eventLocation,
        dates: `${formatForCalendar(startTime)}/${formatForCalendar(endTime)}`
      })
      calendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`
    } 
    else if (format === 'outlook') {
      // Outlook Web format
      const params = new URLSearchParams({
        subject: eventTitle,
        body: eventDescription,
        location: eventLocation,
        startdt: formatForOutlook(startTime),
        enddt: formatForOutlook(endTime)
      })
      calendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
    }
    // For iCal, we'd typically generate a file to download, but we'll return a placeholder URL
    else if (format === 'ical') {
      calendarUrl = `/api/calendar/ical?lectureId=${lectureId}`
    }
    
    return { 
      success: true, 
      calendarUrl,
      eventData: {
        title: eventTitle,
        description: eventDescription,
        location: eventLocation,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }
    }
  } catch (error) {
    console.error("Error getting calendar data:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get calendar data" 
    }
  }
}

// Helper function to format dates for calendar links
function formatForCalendar(date: Date): string {
  return date.toISOString().replace(/-|:|\.\d+/g, '')
}

function formatForOutlook(date: Date): string {
  return date.toISOString().substring(0, 19)
}

// Helper function to format date with timezone
function formatDateToTimeZone(date: Date | string | null, timeZone: string = 'UTC'): string {
  if (!date) return ''
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  try {
    const zonedDate = toZonedTime(dateObj, timeZone)
    return zonedDate.toISOString()
  } catch (error) {
    console.error("Error converting timezone:", error)
    return dateObj.toISOString()
  }
}