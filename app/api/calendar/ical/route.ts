import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { format, addMinutes } from "date-fns"

// Generate iCal file content
function generateICalContent(event: {
  title: string
  description: string
  location: string
  startTime: Date
  endTime: Date
  organizer: { name: string; email: string }
}) {
  // Format dates for iCal
  const formatDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss'Z'")
  }

  const startTimeStr = formatDate(event.startTime)
  const endTimeStr = formatDate(event.endTime)
  const now = formatDate(new Date())

  // Create iCal content
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EduPlatform//NONSGML v1.0//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${Date.now()}@eduplatform.com
DTSTAMP:${now}
DTSTART:${startTimeStr}
DTEND:${endTimeStr}
SUMMARY:${event.title}
DESCRIPTION:${event.description.replace(/\n/g, '\\n')}
LOCATION:${event.location}
STATUS:CONFIRMED
ORGANIZER;CN=${event.organizer.name}:mailto:${event.organizer.email || 'noreply@eduplatform.com'}
END:VEVENT
END:VCALENDAR`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Get lectureId from query
    const searchParams = request.nextUrl.searchParams
    const lectureId = searchParams.get("lectureId")

    if (!lectureId) {
      return new NextResponse("Lecture ID is required", { status: 400 })
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
            ],
          },
        },
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
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!lecture) {
      return new NextResponse("Lecture not found or you don't have access", { status: 404 })
    }

    if (!lecture.scheduledAt) {
      return new NextResponse("This lecture doesn't have a scheduled time", { status: 400 })
    }

    // Create calendar event data
    const startTime = new Date(lecture.scheduledAt)
    const endTime = lecture.duration 
      ? addMinutes(startTime, lecture.duration)
      : addMinutes(startTime, 60) // Default 1 hour if no duration
    
    const eventTitle = `${lecture.title} - ${lecture.section.content.title}`
    const eventDescription = `Live session by ${lecture.section.content.creator.name || 'Instructor'}\n\n${lecture.description || ''}`
    const eventLocation = `${process.env.NEXT_PUBLIC_APP_URL}/content/${lecture.section.content.id}/player/${lecture.id}`
    
    // Generate iCal content
    const iCalContent = generateICalContent({
      title: eventTitle,
      description: eventDescription,
      location: eventLocation,
      startTime,
      endTime,
      organizer: {
        name: lecture.section.content.creator.name || 'Instructor',
        email: lecture.section.content.creator.email || '',
      },
    })

    // Set headers for file download
    const fileName = `${lecture.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_event.ics`
    const headers = {
      'Content-Type': 'text/calendar',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    }

    return new NextResponse(iCalContent, { headers })
  } catch (error) {
    console.error("Error generating iCal file:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}