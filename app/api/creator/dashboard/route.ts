import { NextResponse } from 'next/server'
import createBatch from '@/lib/utils/db-batch'
import { db } from '@/lib/db'

/**
 * API endpoint to get dashboard data for creators
 * Uses the batch utility to optimize database connections
 */
export async function GET(request: Request) {
  try {
    // Extract creator ID from request
    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')
    
    if (!creatorId) {
      return NextResponse.json(
        { error: 'Creator ID is required' },
        { status: 400 }
      )
    }
    
    // Create a batch for all dashboard queries
    const batch = createBatch()
    
    // Add all required queries to the batch
    batch.add(tx => tx.user.findUnique({
      where: { id: creatorId },
      select: { name: true, email: true, image: true }
    }))
    
    batch.add(tx => tx.content.findMany({
      where: { creatorId },
      select: { 
        id: true, 
        title: true, 
        isPublished: true,
        thumbnail: true,
        price: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    }))
    
    batch.add(tx => tx.content.count({
      where: { creatorId }
    }))
    
    batch.add(tx => tx.enrollment.count({
      where: {
        content: {
          creatorId
        }
      }
    }))
    
    // Execute all queries in a single database transaction
    const [creator, courses, coursesCount, enrollmentsCount] = await batch.execute()
    
    // Return all data in a single response
    return NextResponse.json({
      creator,
      courses,
      stats: {
        totalCourses: coursesCount,
        totalEnrollments: enrollmentsCount
      }
    })
    
  } catch (error) {
    console.error('Error fetching creator dashboard data:', error)
    
    // Track connection errors
    if (error instanceof Error && 
        (error.message.includes('connect') || 
         error.message.includes('Connection closed'))) {
      // Use the db monitoring to track this error
      const db = await import('@/lib/db')
      const dbMonitoring = await import('@/lib/db-monitoring')
      dbMonitoring.default.trackError('api_connection_error')
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}