import { WebSocketServer, WebSocket as WS } from "ws"
import type { NextRequest } from "next/server"
import { headers } from "next/headers"
import { IncomingMessage } from "http"
import { Socket as NetSocket } from "net"
import { v4 as uuidv4 } from "uuid"

// Create a more robust WebSocket server with ping/pong for connection health
const wss = new WebSocketServer({
  noServer: true,
  clientTracking: true,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    concurrencyLimit: 10,
    threshold: 1024,
  },
})

// Store client connections and their subscriptions with proper typing
interface ClientData {
  subscriptions: Set<string>
  userId?: string
  userName?: string
  lastPing: number
}

const clients = new Map<WS, ClientData>()

// Set up ping interval to detect dead connections
const pingInterval = setInterval(() => {
  const now = Date.now()
  wss.clients.forEach((ws) => {
    const clientData = clients.get(ws)
    if (!clientData) return

    // Check if client hasn't responded to ping for 30 seconds
    if (now - clientData.lastPing > 30000) {
      console.log("Client connection timed out, terminating")
      ws.terminate()
      return
    }

    // Send ping
    try {
      ws.ping()
    } catch (err) {
      console.error("Error sending ping:", err)
      ws.terminate()
    }
  })
}, 15000)

// Handle WebSocket server errors
wss.on("error", (error) => {
  console.error("WebSocket server error:", error)
})

wss.on("connection", (ws: WS) => {
  // Generate a unique client ID
  const clientId = uuidv4()
  console.log(`New WebSocket connection established: ${clientId}`)

  // Initialize client data with ping timestamp
  clients.set(ws, {
    subscriptions: new Set(),
    lastPing: Date.now(),
  })

  // Handle pong responses to track connection health
  ws.on("pong", () => {
    const clientData = clients.get(ws)
    if (clientData) {
      clientData.lastPing = Date.now()
    }
  })

  ws.on("message", (message: WS.Data) => {
    try {
      const data = JSON.parse(message.toString())
      const clientData = clients.get(ws)

      if (!clientData) {
        console.error("Client data not found for connection")
        return
      }

      // Handle authentication message
      if (data.type === "AUTH") {
        if (data.userId && data.userName) {
          clientData.userId = data.userId
          clientData.userName = data.userName
          console.log(`Client authenticated: ${data.userName} (${data.userId})`)

          // Send acknowledgment
          ws.send(
            JSON.stringify({
              type: "AUTH_SUCCESS",
              clientId,
            }),
          )
        } else {
          console.warn("Invalid authentication data received")
          ws.send(
            JSON.stringify({
              type: "AUTH_ERROR",
              error: "Invalid authentication data",
            }),
          )
        }
        return
      }

      // Handle subscription management
      switch (data.type) {
        case "SUBSCRIBE":
          if (data.lectureId) {
            clientData.subscriptions.add(data.lectureId)
            console.log(`Client ${clientId} subscribed to lecture: ${data.lectureId}`)

            // Send acknowledgment
            ws.send(
              JSON.stringify({
                type: "SUBSCRIBE_SUCCESS",
                lectureId: data.lectureId,
              }),
            )
          } else {
            ws.send(
              JSON.stringify({
                type: "ERROR",
                error: "Invalid lecture ID for subscription",
              }),
            )
          }
          break

        case "UNSUBSCRIBE":
          if (data.lectureId) {
            clientData.subscriptions.delete(data.lectureId)
            console.log(`Client ${clientId} unsubscribed from lecture: ${data.lectureId}`)

            // Send acknowledgment
            ws.send(
              JSON.stringify({
                type: "UNSUBSCRIBE_SUCCESS",
                lectureId: data.lectureId,
              }),
            )
          }
          break

        case "PING":
          // Respond to client pings
          ws.send(
            JSON.stringify({
              type: "PONG",
              timestamp: Date.now(),
            }),
          )
          break

        default:
          console.warn(`Unknown message type received: ${data.type}`)
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error)
      try {
        ws.send(
          JSON.stringify({
            type: "ERROR",
            error: "Invalid message format",
          }),
        )
      } catch (sendError) {
        console.error("Error sending error response:", sendError)
      }
    }
  })

  ws.on("close", (code, reason) => {
    const clientData = clients.get(ws)
    console.log(`WebSocket connection closed: ${clientId}, code: ${code}, reason: ${reason.toString()}`)
    clients.delete(ws)
  })

  ws.on("error", (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error)
    ws.terminate()
  })
})

// Function to broadcast status updates to subscribed clients with retry logic
export function broadcastStatusUpdate(lectureId: string, status: string) {
  if (!lectureId || !status) {
    console.error("Invalid broadcast parameters:", { lectureId, status })
    return
  }

  console.log(`Broadcasting status update for lecture ${lectureId}: ${status}`)

  const message = JSON.stringify({
    type: "STREAM_STATUS_UPDATE",
    lectureId,
    status,
    timestamp: new Date().toISOString(),
  })

  let successCount = 0
  let failureCount = 0

  clients.forEach((clientData, client) => {
    if (clientData.subscriptions.has(lectureId) && client.readyState === WS.OPEN) {
      try {
        client.send(message, (err) => {
          if (err) {
            console.error(`Error sending message to client:`, err)
            failureCount++
          } else {
            successCount++
          }
        })
      } catch (error) {
        console.error("Error broadcasting message:", error)
        failureCount++

        // Remove dead connections
        if (client.readyState !== WS.OPEN) {
          clients.delete(client)
        }
      }
    }
  })

  // Log broadcast statistics
  setTimeout(() => {
    console.log(`Broadcast complete for ${lectureId}: ${successCount} successful, ${failureCount} failed`)
  }, 100)
}

export async function GET(req: NextRequest) {
  const headersList = headers()
  const upgradeHeader = headersList.get("upgrade")?.toLowerCase()
  const connectionHeader = headersList.get("connection")?.toLowerCase()

  if (!upgradeHeader || !connectionHeader?.includes("upgrade") || upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 426 })
  }

  try {
    // Create a mock socket since NextRequest doesn't provide one directly
    const mockSocket = new NetSocket()

    // Create a mock IncomingMessage for ws library compatibility
    const mockReq = new IncomingMessage(mockSocket)

    // Convert Headers to a plain object
    const headersObject: { [key: string]: string } = {}
    headersList.forEach((value, key) => {
      headersObject[key.toLowerCase()] = value
    })

    // Assign headers to mock request
    mockReq.headers = headersObject

    // Handle the WebSocket upgrade with proper error handling
    const { socket, response } = await new Promise<{ socket: WS; response: Response }>((resolve, reject) => {
      let hasResolved = false

      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          reject(new Error("WebSocket upgrade timed out"))
        }
      }, 10000)

      try {
        wss.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0), (socket) => {
          clearTimeout(timeout)
          hasResolved = true
          resolve({ socket, response: new Response(null, { status: 101 }) })
        })
      } catch (error) {
        clearTimeout(timeout)
        if (!hasResolved) {
          reject(error)
        }
      }
    })

    return response
  } catch (error) {
    console.error("WebSocket upgrade error:", error)
    return new Response("WebSocket upgrade failed: " + (error instanceof Error ? error.message : "Unknown error"), {
      status: 500,
    })
  }
}

// Clean up resources when the module is unloaded
if (typeof window === "undefined") {
  // This will run only on the server side
  process.on("beforeExit", () => {
    clearInterval(pingInterval)
    wss.close()
  })
}
