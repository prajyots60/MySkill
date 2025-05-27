import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth" 
import createBatch from "@/lib/utils/db-batch"
import { db } from "@/lib/db"
import dbMonitoring from "@/lib/db-monitoring"
import { Prisma } from "@prisma/client"

// Define types for our section and lecture data with progress information
type LectureWithProgress = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  type: string;
  duration: number | null;
  isPreview: boolean;
  progress?: Array<{
    isComplete: boolean;
    percentage: number;
    timeSpentSeconds: number | null;
  }>;
}

type SectionWithLectures = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lectures: LectureWithProgress[];
}

export async function GET(
  request: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const contentId = params.contentId
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    
    // Create a batch for all related queries
    const batch = createBatch()
    
    // First, check if the user has access to this content
    batch.add(tx => tx.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        isPublished: true,
        creatorId: true,
        price: true,
      }
    }))
    
    // If user is logged in, check enrollment
    if (userId) {
      batch.add(tx => tx.enrollment.findUnique({
        where: {
          userId_contentId: {
            userId,
            contentId
          }
        },
        select: { id: true }
      }))
    }
    
    // Get all sections with lectures in a single query
    batch.add(tx => tx.section.findMany({
      where: { contentId },
      orderBy: { order: "asc" },
      include: {
        lectures: {
          orderBy: { order: "asc" },
          include: {
            // If user is logged in, get their progress
            ...(userId ? {
              progress: {
                where: { userId },
                select: {
                  isComplete: true,
                  percentage: true,
                  timeSpentSeconds: true
                }
              }
            } : {})
          }
        }
      }
    }))
    
    // Execute all queries in a single database transaction
    const results = await batch.execute()
    const content = results[0]
    const enrollment = userId ? results[1] : null
    const sections = results[userId ? 2 : 1]
    
    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }
    
    // Check user's access rights
    const userIsCreator = userId === content.creatorId
    const contentIsFree = content.price === 0 || content.price === null
    const userIsEnrolled = !!enrollment
    
    // Only allow access if the course is published and the user has access
    const hasAccess = 
      content.isPublished && (userIsCreator || contentIsFree || userIsEnrolled)
    
    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }
    
    // Process sections to format output and include progress data
    const processedSections = sections.map((section: SectionWithLectures) => {
      const processedLectures = section.lectures.map((lecture: LectureWithProgress) => {
        const userProgress = lecture.progress?.[0] || null
        
        return {
          id: lecture.id,
          title: lecture.title,
          description: lecture.description,
          order: lecture.order,
          type: lecture.type,
          duration: lecture.duration,
          isPreview: lecture.isPreview,
          progress: userProgress ? {
            isComplete: userProgress.isComplete,
            percentage: userProgress.percentage,
            timeSpentSeconds: userProgress.timeSpentSeconds || 0
          } : null
        }
      })
      
      return {
        id: section.id,
        title: section.title,
        description: section.description,
        order: section.order,
        lectures: processedLectures
      }
    })
    
    return NextResponse.json({
      sections: processedSections
    })
    
  } catch (error) {
    console.error("Error fetching sections:", error)
    
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('sections_connection_error')
    }
    
    return NextResponse.json(
      { error: "Failed to fetch sections data" },
      { status: 500 }
    )
  }
}