import { PrismaClient } from '@prisma/client'
import prisma from '../prisma'

type BatchOptions = {
  timeout?: number; // Timeout in milliseconds
  maxWait?: number; // Max wait time
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
}

/**
 * Utility to batch database operations within a single transaction
 * This significantly reduces connection overhead for related operations
 */
export class BatchedQueries {
  private operations: Array<(tx: PrismaClient) => Promise<any>> = []
  private options: BatchOptions;
  
  constructor(options: BatchOptions = {}) {
    this.options = options;
  }
  
  /**
   * Add an operation to the batch
   * @param operation Function that takes the transaction client and returns a promise
   */
  add<T>(operation: (tx: PrismaClient) => Promise<T>): void {
    this.operations.push(operation)
  }
  
  /**
   * Execute all batched operations in a single transaction
   * @returns Promise resolving to an array of results from each operation
   */
  async execute(): Promise<any[]> {
    // No operations, return empty result
    if (this.operations.length === 0) {
      return []
    }
    
    // Single operation, execute directly
    if (this.operations.length === 1) {
      return [await this.operations[0](prisma)]
    }
    
    // Multiple operations, use transaction with the specified options
    return prisma.$transaction(async (tx) => {
      const results = []
      for (const operation of this.operations) {
        results.push(await operation(tx))
      }
      return results
    }, this.options)
  }
  
  /**
   * Clear all pending operations
   */
  clear(): void {
    this.operations = []
  }
  
  /**
   * Get the number of pending operations
   */
  get size(): number {
    return this.operations.length
  }
}

/**
 * Create a new batched queries instance
 * 
 * Example usage:
 * ```
 * const batch = createBatch({ timeout: 5000 })
 * batch.add(tx => tx.user.findUnique({ where: { id: userId } }))
 * batch.add(tx => tx.content.findUnique({ where: { id: contentId } }))
 * const [user, content] = await batch.execute()
 * ```
 */
export function createBatch(options: BatchOptions = {}): BatchedQueries {
  return new BatchedQueries(options)
}

export default createBatch