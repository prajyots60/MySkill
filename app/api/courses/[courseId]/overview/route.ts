import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/courses/[courseId]/overview - Get course overview content
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const {courseId} = await params
    
    // Validate course ID
    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      )
    }
    
    // Fetch the course overview content
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: { 
        richContent: true,
        isPublished: true,
        creatorId: true 
      }
    })
    
    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      )
    }
    
    // Return the content - richContent is already a JSON field so we don't need to stringify it again
    return NextResponse.json({
      content: course.richContent || null
    })
    
  } catch (error) {
    console.error('Error fetching course overview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch course overview' },
      { status: 500 }
    )
  }
}

// POST /api/courses/[courseId]/overview - Update course overview content
export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check authentication
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const courseId = params.courseId
    
    // Validate course ID
    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      )
    }
    
    // Get request body
    const { content } = await request.json()
    
    // Validate content
    if (content === undefined) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }
    
    // Check if the course exists and if the user is the creator
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: { creatorId: true }
    })
    
    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      )
    }
    
    // Verify that the user is the creator or an admin
    if (course.creatorId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'You do not have permission to update this course' },
        { status: 403 }
      )
    }
    
    // Update the course overview content
    // Since richContent is a Json field, we're saving the HTML content as JSON
    await prisma.content.update({
      where: { id: courseId },
      data: {
        richContent: content,
        updatedAt: new Date() // Update the updatedAt timestamp
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Course overview updated successfully'
    })
    
  } catch (error) {
    console.error('Error updating course overview:', error)
    return NextResponse.json(
      { error: `Failed to update course overview: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}