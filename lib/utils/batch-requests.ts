/**
 * Utility for batching multiple API requests into a single request
 * to reduce network overhead and improve performance
 */

type BatchRequestItem = {
  id: string
  path: string
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: any
}

type BatchResponse = {
  [id: string]: {
    status: number
    data: any
  }
}

// In-memory queue for batching requests
let requestQueue: BatchRequestItem[] = []
let batchTimer: NodeJS.Timeout | null = null
const BATCH_DELAY = 50 // ms to wait before sending batch

/**
 * Add a request to the batch queue
 */
export function queueRequest<T = any>(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: any,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(2, 9)

    // Add to queue
    requestQueue.push({
      id,
      path,
      method,
      body,
    })

    // Set up batch timer if not already running
    if (!batchTimer) {
      batchTimer = setTimeout(() => processBatch(), BATCH_DELAY)
    }

    // Set up listener for this specific request
    const handleResponse = (event: CustomEvent<BatchResponse>) => {
      const response = event.detail[id]
      if (response) {
        if (response.status >= 200 && response.status < 300) {
          resolve(response.data)
        } else {
          reject(new Error(`Request failed with status ${response.status}`))
        }
        // Remove listener after handling
        window.removeEventListener("batchResponse", handleResponse as EventListener)
      }
    }

    // Listen for batch response
    window.addEventListener("batchResponse", handleResponse as EventListener)
  })
}

/**
 * Process all queued requests as a single batch
 */
async function processBatch() {
  if (requestQueue.length === 0) return

  // Clear timer
  if (batchTimer) {
    clearTimeout(batchTimer)
    batchTimer = null
  }

  // Get current queue and reset
  const currentBatch = [...requestQueue]
  requestQueue = []

  try {
    // Send batch request
    const response = await fetch("/api/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests: currentBatch }),
    })

    if (!response.ok) {
      throw new Error(`Batch request failed: ${response.status}`)
    }

    const batchResponse: BatchResponse = await response.json()

    // Dispatch event with responses
    window.dispatchEvent(new CustomEvent("batchResponse", { detail: batchResponse }))
  } catch (error) {
    console.error("Batch request failed:", error)

    // Dispatch individual errors for each request
    const errorResponse: BatchResponse = {}
    currentBatch.forEach((request) => {
      errorResponse[request.id] = {
        status: 500,
        data: { error: "Batch request failed" },
      }
    })

    window.dispatchEvent(new CustomEvent("batchResponse", { detail: errorResponse }))
  }
}

/**
 * Force process any pending batch requests immediately
 */
export function flushBatchQueue() {
  if (requestQueue.length > 0) {
    if (batchTimer) {
      clearTimeout(batchTimer)
      batchTimer = null
    }
    processBatch()
  }
}

// Automatically flush queue on page navigation
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushBatchQueue)
}
