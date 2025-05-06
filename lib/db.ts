import prisma, { checkDbConnection, retryDbConnection } from './prisma'
import dbMonitoring from './db-monitoring'
import { cache } from 'react'

/**
 * Optimized database client for Neon serverless database
 */
export const db = {
  /**
   * Execute a database operation with improved error handling
   * 
   * @param operation Function that executes a database operation
   * @returns Promise resolving to the operation result
   */
  query: async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation()
    } catch (error: any) {
      // Handle connection errors with Neon serverless
      if (error?.message?.includes('connect') || 
          error?.message?.includes('reach database') ||
          error?.message?.includes('Connection closed') ||
          error?.code === 'P1001' || 
          error?.code === 'P1002') {
        
        // Track the error for monitoring
        const errorType = error?.message?.includes('Connection closed') 
          ? 'connection_closed'
          : error?.code || 'connection_error'
        dbMonitoring.trackError(errorType)
        
        console.error('Database connection error:', error.message)
        
        // Try to reconnect once before failing
        try {
          // Quick connection check
          const connected = await checkDbConnection()
          if (!connected) {
            // Only wait a short time for reconnection in request context
            await retryDbConnection(2, 1000)
          }
          // Retry the operation
          return await operation()
        } catch (retryError) {
          console.error('Failed to recover database connection:', retryError)
          throw error // Throw original error if retry fails
        }
      }
      throw error
    }
  },
  
  /**
   * Check if database is reachable
   */
  checkConnection: async (): Promise<boolean> => {
    return await checkDbConnection()
  },
  
  /**
   * Get database health metrics
   */
  getHealth: async () => {
    return await dbMonitoring.getDatabaseHealth()
  },
  
  // Direct Prisma client access
  prisma
}

// Create cached versions of common queries for better performance
export const getCachedUser = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
  })
})

export const getCachedCourse = cache(async (courseId: string) => {
  return prisma.content.findUnique({
    where: { id: courseId },
  })
})

// Export for compatibility with existing code
export { prisma }
export default db
