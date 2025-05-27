import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import createBatch from "@/lib/utils/db-batch"

import dbMonitoring from "@/lib/db-monitoring"

export async function GET(
  request: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const {contentId} = await params
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    
    // Create a batch for related content queries
    const batch = createBatch()
    
    // Add all queries to the batch
    batch.add(tx => tx.content.findUnique({
      where: { id: contentId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
            bio: true,
          },
        },
      },
    }))
    
    // If user is logged in, check enrollment in same batch
    if (userId) {
      batch.add(tx => tx.enrollment.findUnique({
        where: {
          userId_contentId: {
            userId,
            contentId,
          },
        },
      }))
    }
    
    // Get top-level sections
    batch.add(tx => tx.section.findMany({
      where: { contentId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        order: true,
        _count: {
          select: { lectures: true }
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
    
    // Check if content is published or if user is creator
    if (!content.isPublished && content.creatorId !== userId) {
      return NextResponse.json(
        { error: "Content not available" },
        { status: 403 }
      )
    }
    
    return NextResponse.json({
      content,
      isEnrolled: !!enrollment,
      sections,
    })
    
  } catch (error) {
    console.error("Error fetching content:", error)
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      dbMonitoring.trackError('content_connection_error')
    }
    
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    )
  }
}