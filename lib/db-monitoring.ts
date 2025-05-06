import { Redis } from '@upstash/redis'
import { db } from './db'

// Create Redis client for storing metrics
const redis = Redis.fromEnv()

/**
 * Database monitoring utilities
 */
const dbMonitoring = {
  /**
   * Increment counter for specific error type
   */
  trackError: async (errorType: string): Promise<void> => {
    try {
      const date = new Date().toISOString().split('T')[0] // Current date in YYYY-MM-DD format
      const key = `db:errors:${date}:${errorType}`
      
      // Increment counter for this error type
      await redis.incr(key)
      
      // Set expiry to 30 days to avoid accumulating old metrics
      await redis.expire(key, 60 * 60 * 24 * 30)
      
      // Log aggregated error counts every 5 occurrences
      const count = await redis.get<number>(key)
      if (count && count % 5 === 0) {
        console.warn(`Database error type "${errorType}" occurred ${count} times today`)
      }
    } catch (error) {
      // Don't let monitoring errors affect the application
      console.error('Failed to track database error:', error)
    }
  },
  
  /**
   * Get error counts for the specified time period
   */
  getErrorStats: async (days = 7): Promise<Record<string, number>> => {
    const stats: Record<string, number> = {}
    
    try {
      // Get all database error keys
      const keys = await redis.keys('db:errors:*')
      
      // Filter for the specified time period
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const startDateStr = startDate.toISOString().split('T')[0]
      
      // Process each key
      for (const key of keys) {
        const [_, __, dateStr, errorType] = key.split(':')
        
        // Check if the date is within our range
        if (dateStr >= startDateStr) {
          const count = await redis.get<number>(key) || 0
          
          // Group by error type
          if (!stats[errorType]) {
            stats[errorType] = 0
          }
          stats[errorType] += count
        }
      }
    } catch (error) {
      console.error('Failed to get database error stats:', error)
    }
    
    return stats
  },
  
  /**
   * Check database health and return metrics
   */
  getDatabaseHealth: async (): Promise<{
    isConnected: boolean,
    errorStats: Record<string, number>,
    connectionTime: number
  }> => {
    const startTime = Date.now()
    const isConnected = await db.checkConnection()
    const connectionTime = Date.now() - startTime
    
    // Get error stats for the last day
    const errorStats = await dbMonitoring.getErrorStats(1)
    
    return {
      isConnected,
      errorStats,
      connectionTime
    }
  }
}

export default dbMonitoring