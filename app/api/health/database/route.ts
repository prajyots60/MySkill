import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * API endpoint to check database health and connection metrics
 */
export async function GET() {
  try {
    // Get database health metrics
    const health = await db.getHealth()
    
    // Get total request count and success rate
    const metrics = await db.query(async () => {
      return await db.prisma.$queryRaw`
        SELECT 
          (SELECT COUNT(*) FROM "_prisma_migrations") as migration_count,
          current_setting('max_connections') as max_connections,
          (SELECT COUNT(*) FROM pg_stat_activity WHERE backend_type = 'client backend') as active_connections
      `
    }).catch(() => null)

    return NextResponse.json({
      status: 'success',
      data: {
        ...health,
        dbMetrics: metrics ? metrics[0] : null
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error checking database health:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to check database health',
        error: (error as Error).message
      },
      { status: 500 }
    )
  }
}