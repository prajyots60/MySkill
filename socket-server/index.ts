import express from "express"
import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import cors from "cors"
import * as dotenv from "dotenv"
import path from "path"
import { instrument } from "@socket.io/admin-ui"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import * as ChatRedis from "./redis-chat"
import { 
  ChatMessageType, 
  ChatMessage, 
  ChatParticipant, 
  Poll,
  PollStatus
} from "../lib/types"
import { prisma } from "../lib/prisma"

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") })

// Add SIGINT handler for graceful shutdown
if (process.env.NODE_ENV !== 'production') {
  process.on('SIGINT', async () => {
    console.log("Shutting down socket server...")
    
    // Disconnect from Prisma
    await prisma.$disconnect()
    console.log("Disconnected from DB")
    
    // Exit process
    process.exit(0)
  })
}

// Store active chat sessions
const activeChatSessions = new Map<string, {
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  participants: Set<string>;
  isChatVisible: boolean; // Added property to track chat visibility
}>()

// Log environment variables for debugging
console.log("Environment variables:")
console.log("SOCKET_PORT:", process.env.SOCKET_PORT)
console.log("NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL)
console.log("NEXT_PUBLIC_SOCKET_URL:", process.env.NEXT_PUBLIC_SOCKET_URL)
console.log("REDIS_URL:", process.env.UPSTASH_REDIS_CHAT_REST_URL ? "Set" : "Not set")

const app = express()
const httpServer = createServer(app)

// Add security headers with WebSocket support
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  }),
)

// Enable CORS with proper configuration for Next.js and WebSocket
app.use(
  cors({
    origin: process.env.NEXT_PUBLIC_APP_URL,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    maxAge: 86400,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
)

// Add rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
})

app.use("/api/", apiLimiter)

// Basic health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
  })
})

// Create Socket.IO instance with enhanced configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  path: "/socket.io",
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6,
  allowUpgrades: true,
  perMessageDeflate: {
    threshold: 1024,
  },
  httpCompression: {
    threshold: 1024,
  },
  cookie: {
    name: "io",
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  },
})

// Set up Socket.IO Admin UI in development
if (process.env.NODE_ENV !== "production") {
  instrument(io, {
    auth: false,
    mode: "development",
  })
}

// Add error handling
io.engine.on("connection_error", (err) => {
  console.log("Socket.IO connection error:", err.req?.url, err.code, err.message, err.context)
})

// Add connection logging
io.engine.on("connection", (socket) => {
  console.log("New connection attempt:", socket.id)
})

// Types
type SocketCallback = (response: { error?: string; success?: boolean; [key: string]: any }) => void;

// Socket.IO event handlers
io.on("connection", (socket) => {
  const { userId, userName, userRole } = socket.handshake.auth

  if (!userId || !userName) {
    socket.disconnect()
    return
  }

  // Store user data in socket
  socket.data = {
    userId,
    userName,
    userRole: userRole || "STUDENT",
    userImage: socket.handshake.auth.userImage,
    connectedAt: new Date().toISOString(),
    rooms: new Set(),
    messageCount: 0,
    lastMessageTime: 0,
  }

  // Store session for persistence
  ChatRedis.storeUserSession(socket.data.userId, socket.id, {
    userName: socket.data.userName,
    userImage: socket.data.userImage,
    userRole: socket.data.userRole,
  }).then(() => {
    console.log(`User connected: ${socket.data.userName} (${socket.data.userId})`)
  }).catch((error: Error) => {
    console.error("Error storing user session:", error)
    socket.disconnect()
  })

  // Start chat session (only for lecture creators)
  socket.on("start-chat", async (data: { lectureId: string }, callback: SocketCallback) => {
    try {
      const { lectureId } = data

      if (socket.data.userRole !== "CREATOR") {
        callback({ error: "Only lecture creators can start the chat" })
        return
      }

      // Create or update chat session
      activeChatSessions.set(lectureId, {
        isActive: true,
        createdBy: socket.data.userId,
        createdAt: new Date().toISOString(),
        participants: new Set([socket.data.userId]),
        isChatVisible: true // Creators who start chat should have it visible
      })

      // Notify all users in the room that chat has started
      io.to(lectureId).emit("chat-started", {
        lectureId,
        startedBy: {
          userId: socket.data.userId,
          userName: socket.data.userName
        },
        timestamp: new Date().toISOString()
      })

      callback({ success: true })
    } catch (error) {
      console.error("Error starting chat:", error)
      callback({ error: "Failed to start chat" })
    }
  })

  // Join a room with validation and error handling
  socket.on("join-room", async (data: { roomId: string; lectureId?: string }, callback?: SocketCallback) => {
    try {
      console.log(`[Socket-Server] JOIN-ROOM request received: roomId=${data.roomId}, lectureId=${data.lectureId}, user=${socket.data.userName}, role=${socket.data.userRole}`);
      
      const { roomId } = data
      // We're using lectureId in the log but not in the code, so removing variable declaration to fix TS error
      
      // Validate data
      if (!roomId) {
        console.error("[Socket-Server] Invalid room ID in join-room event")
        callback?.({ error: "Room ID is required" })
        return
      }
      
      // Initialize rooms Set if it doesn't exist
      if (!socket.data.rooms) {
        socket.data.rooms = new Set<string>()
      }
      
      // Check if chat is active for this lecture
      let chatSession = activeChatSessions.get(roomId)
      
      // If no chat session exists, create one and set it to active but NOT visible
      if (!chatSession) {
        console.log(`[Socket-Server] Creating new chat session for room ${roomId}. User role: ${socket.data.userRole}`)
        chatSession = {
          isActive: true, // Default to active
          createdBy: socket.data.userId,
          createdAt: new Date().toISOString(),
          participants: new Set([socket.data.userId]),
          isChatVisible: false // Default to NOT visible - creator must explicitly activate
        }
        activeChatSessions.set(roomId, chatSession)
      } else {
        // Ensure existing chat session is active
        console.log(`[Socket-Server] Using existing chat session for room ${roomId}. isActive: ${chatSession.isActive}, isChatVisible: ${chatSession.isChatVisible}`)
        chatSession.participants.add(socket.data.userId)
        activeChatSessions.set(roomId, chatSession)
      }
      
      const isChatActive = chatSession.isActive
      const isChatVisible = chatSession.isChatVisible ?? false // Default to not visible

      console.log(`[Socket-Server] Chat status for room ${roomId}: isActive=${isChatActive}, isChatVisible=${isChatVisible}`)
      
      // Join the room
      socket.join(roomId)
      socket.data.rooms.add(roomId)
      console.log(`[Socket-Server] User ${socket.data.userName} (${socket.data.userId}) joined room ${roomId}`)

      // Create participant object
      const participant = {
        userId: socket.data.userId,
        userName: socket.data.userName,
        userImage: socket.data.userImage,
        userRole: socket.data.userRole,
        isOnline: true,
        lastActive: new Date().toISOString(),
      }

      // Add participant to Redis
      await ChatRedis.addParticipant(roomId, participant)

      // Get room data from Redis
      const roomData = await ChatRedis.getChatRoom(roomId) || {
        id: roomId,
        isActive: isChatActive,
        createdAt: chatSession?.createdAt || new Date().toISOString(),
        settings: {
          allowChat: true,
          allowPolls: true,
          allowFiles: false,
          moderationEnabled: true,
          slowMode: false,
          slowModeInterval: 5,
          chatEnabled: true
        },
        lastActivity: new Date().toISOString(),
      }

      // Get participants from Redis and in-memory
      let participants: ChatParticipant[] = []
      try {
        // Get participants from Redis
        const redisParticipants = await ChatRedis.getParticipants(roomId)
        
        // Combine with active participants from memory
        const activeParticipantIds = Array.from(chatSession.participants)
        
        // Update online status for participants
        participants = redisParticipants.map(p => ({
          ...p,
          isOnline: activeParticipantIds.includes(p.userId)
        }))
        
        // Add current participant if not already in the list
        if (!participants.some(p => p.userId === participant.userId)) {
          participants.push(participant)
        }
        
        // Broadcast participant joined event to other users in the room
        socket.to(roomId).emit("chat-event", {
          type: "JOIN",
          payload: participant,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error("Error getting participants:", error)
        participants = [participant] // Fallback to just the current user
      }

      // Get recent messages and send them to the user
      let messages: ChatMessage[] = []
      try {
        messages = await ChatRedis.getMessages(roomId, 100)
        if (messages && messages.length > 0) {
          // Send all messages to the user who just joined
          socket.emit("chat-history", messages)
        }
      } catch (error) {
        console.error("Error fetching chat history:", error)
      }

      // Get active polls and send them to the user
      let polls: Poll[] = []
      try {
        polls = await ChatRedis.getActivePolls(roomId)
        if (polls && polls.length > 0) {
          // Send active polls to the user who just joined
          socket.emit("active-polls", polls)
        }
      } catch (error) {
        console.error("Error fetching active polls:", error)
      }

      // Send room data to the client
      socket.emit("room-data", {
        room: roomData,
        messages: messages,
        participants: participants,
        activePolls: polls,
        chatEnabled: true
      })

      // Send success response with chat status
      callback?.({
        success: true,
        roomId,
        isChatActive: isChatActive,
        isChatVisible: isChatVisible, // Include visibility status in the response
        chatStatus: {
          isActive: isChatActive,
          createdBy: chatSession?.createdBy,
          createdAt: chatSession?.createdAt,
          participantCount: chatSession?.participants.size || 0
        }
      })
    } catch (error) {
      console.error("Error joining room:", error)
      callback?.({ error: "Failed to join room" })
    }
  })

  // Handle messages with rate limiting
  socket.on("send-message", async (data: { roomId: string; content: string; type: ChatMessageType }, callback?: SocketCallback) => {
    try {
      const now = Date.now()
      const messageInterval = now - socket.data.lastMessageTime

      // Check if chat is active
      let chatSession = activeChatSessions.get(data.roomId)
      
      // If no chat session exists, create one and set it to active
      if (!chatSession) {
        chatSession = {
          isActive: true, // Set to active by default
          createdBy: socket.data.userId,
          createdAt: new Date().toISOString(),
          participants: new Set([socket.data.userId]),
          isChatVisible: socket.data.userRole === "CREATOR" || socket.data.userRole === "ADMIN" ? true : false // Only visible by default for creators/admins
        }
        activeChatSessions.set(data.roomId, chatSession)
      }
      
      // Ensure chat session is active
      chatSession.isActive = true

      // Rate limiting: max 10 messages per 10 seconds
      if (socket.data.messageCount >= 10 && messageInterval < 10000) {
        callback?.({ error: "Rate limit exceeded. Please wait before sending more messages." })
        return
      }

      socket.data.messageCount++
      socket.data.lastMessageTime = now

      // Create message object
      const message = {
        id: Date.now().toString(),
        roomId: data.roomId,
        userId: socket.data.userId,
        userName: socket.data.userName,
        userImage: socket.data.userImage,
        userRole: socket.data.userRole,
        content: data.content,
        type: data.type || ChatMessageType.TEXT,
        isPinned: false,
        isDeleted: false,
        createdAt: new Date().toISOString()
      }

      // Save message to Redis
      await ChatRedis.saveMessage(message)

      // Broadcast message to room - use new-message event to match client expectations
      io.to(data.roomId).emit("new-message", message)
      
      // Send success response
      callback?.({ success: true, message })
    } catch (error) {
      console.error("Error handling message:", error)
      
      // Still try to send the message to clients even if Redis storage failed
      try {
        if (data && data.content && data.roomId) {
          const fallbackMessage = {
            id: Date.now().toString(),
            roomId: data.roomId,
            userId: socket.data.userId,
            userName: socket.data.userName,
            userImage: socket.data.userImage,
            userRole: socket.data.userRole,
            content: data.content,
            type: data.type || ChatMessageType.TEXT,
            isPinned: false,
            isDeleted: false,
            createdAt: new Date().toISOString()
          }
          
          // Broadcast fallback message to room
          io.to(data.roomId).emit("new-message", fallbackMessage)
          
          // Send success response with fallback message
          callback?.({ success: true, message: fallbackMessage })
          return
        }
      } catch (fallbackError) {
        console.error("Error sending fallback message:", fallbackError)
      }
      
      callback?.({ error: "Failed to send message" })
    }
  })

  // Handle poll creation
  socket.on("create-poll", async (data: { roomId: string; question: string; options: string[] }, callback?: SocketCallback) => {
    try {
      const { roomId, question, options } = data
      
      // Check if chat is active
      const chatSession = activeChatSessions.get(roomId)
      if (!chatSession?.isActive) {
        callback?.({ error: "Chat is not active" })
        return
      }
      
      // Validate input
      if (!question || question.trim().length < 3) {
        callback?.({ error: "Poll question must be at least 3 characters long" })
        return
      }
      
      if (!options || options.length < 2) {
        callback?.({ error: "Poll must have at least 2 options" })
        return
      }
      
      // Create poll object
      const poll = {
        id: Date.now().toString(),
        roomId,
        createdBy: socket.data.userId,
        creatorName: socket.data.userName,
        question,
        options: options.map((text, index) => ({
          id: `option-${index + 1}`,
          text,
          votes: 0
        })),
        status: PollStatus.ACTIVE,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
      }
      
      // Save poll to Redis
      await ChatRedis.createPoll(roomId, poll)
      
      // Broadcast poll to room
      io.to(roomId).emit("new-poll", poll)
      
      // Send success response
      callback?.({ success: true, poll })
      
      console.log(`New poll created in room ${roomId} by ${socket.data.userName} (${socket.data.userId})`)
      
      // Set a timeout to automatically close the poll after 5 minutes
      setTimeout(async () => {
        try {
          // Get the poll from Redis to check if it's still active
          const currentPoll = await ChatRedis.getPoll(roomId, poll.id)
          
          // Only close if the poll exists and is still active
          if (currentPoll && currentPoll.status === PollStatus.ACTIVE) {
            // Close the poll
            currentPoll.status = PollStatus.ENDED
            currentPoll.endedAt = new Date().toISOString()
            
            // Update poll in Redis
            await ChatRedis.updatePoll(roomId, currentPoll)
            
            // Broadcast poll closed to room
            io.to(roomId).emit("poll-closed", currentPoll)
            
            console.log(`Poll ${poll.id} automatically closed after 5 minutes`)
          }
        } catch (error) {
          console.error("Error auto-closing poll:", error)
        }
      }, 5 * 60 * 1000) // 5 minutes
      
    } catch (error) {
      console.error("Error creating poll:", error)
      callback?.({ error: "Failed to create poll" })
    }
  })

  // Handle poll closing
  socket.on("close-poll", async (data: { roomId: string; pollId: string }, callback?: SocketCallback) => {
    try {
      const { roomId, pollId } = data
      
      // Only allow creators or admins to close polls
      if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
        callback?.({ error: "Only lecture creators or admins can close polls" })
        return
      }
      
      // Get the poll from Redis
      const poll = await ChatRedis.getPoll(roomId, pollId)
      
      if (!poll) {
        callback?.({ error: "Poll not found" })
        return
      }
      
      console.log("Current poll before closing:", JSON.stringify(poll, null, 2))
      
      // Update poll status without modifying the votes
      const updatedPoll = {
        ...poll,
        status: PollStatus.ENDED,
        endedAt: new Date().toISOString()
      }
      
      console.log("Updated poll after closing:", JSON.stringify(updatedPoll, null, 2))
      
      // Update poll in Redis
      await ChatRedis.updatePoll(roomId, updatedPoll)
      
      // Broadcast poll closed to room
      io.to(roomId).emit("poll-closed", updatedPoll)
      
      // Send success response
      callback?.({ success: true, poll: updatedPoll })
      
      console.log(`Poll ${pollId} closed by ${socket.data.userName} (${socket.data.userId})`)
      
      // Schedule poll removal after a short delay (e.g., 10 seconds)
      // This gives clients time to see the "Poll closed" message before it disappears
      setTimeout(async () => {
        try {
          // Remove poll from Redis
          await ChatRedis.closePoll(roomId, pollId)
          
          // Notify clients that the poll has been removed
          io.to(roomId).emit("poll-removed", { pollId })
          
          console.log(`Poll ${pollId} removed from Redis after delay`)
        } catch (error) {
          console.error("Error removing poll after delay:", error)
        }
      }, 10000) // 10 seconds delay
    } catch (error) {
      console.error("Error closing poll:", error)
      callback?.({ error: "Failed to close poll" })
    }
  })

  // Add handler for toggling room active status
  socket.on("toggle-room", async (data: { roomId: string; isActive: boolean }, callback?: SocketCallback) => {
    try {
      const { roomId, isActive } = data;
      
      console.log(`[Socket-Server] TOGGLE-ROOM request received: roomId=${roomId}, isActive=${isActive}, user=${socket.data.userName}, role=${socket.data.userRole}`);
      
      // Only allow creators or admins to toggle room status
      if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
        callback?.({ error: "Only lecture creators or admins can enable/disable chat" });
        return;
      }
      
      // Get or create chat session
      let chatSession = activeChatSessions.get(roomId);
      if (!chatSession) {
        chatSession = {
          isActive,
          createdBy: socket.data.userId,
          createdAt: new Date().toISOString(),
          participants: new Set([socket.data.userId]),
          isChatVisible: socket.data.userRole === "CREATOR" || socket.data.userRole === "ADMIN" ? true : false
        };
        activeChatSessions.set(roomId, chatSession);
      } else {
        chatSession.isActive = isActive;
        chatSession.participants.add(socket.data.userId);
        activeChatSessions.set(roomId, chatSession);
      }
      
      // Get existing room or create a new one
      let room = await ChatRedis.getChatRoom(roomId) || {
        id: roomId,
        lectureId: roomId,
        isActive,
        createdAt: chatSession?.createdAt || new Date().toISOString(),
        settings: {
          allowChat: true,
          allowPolls: true,
          allowFiles: false,
          moderationEnabled: true,
          slowMode: false,
          slowModeInterval: 5,
          chatEnabled: isActive
        },
        lastActivity: new Date().toISOString()
      };
      
      // Update room active status
      room.isActive = isActive;
      
      // Also update settings.chatEnabled to match isActive status
      if (room.settings) {
        room.settings.chatEnabled = isActive;
      }
      
      // Update room in Redis for persistence
      await ChatRedis.toggleChatRoom(roomId, isActive);
      
      console.log(`[Socket-Server] Room ${roomId} toggled: isActive=${isActive}, chatEnabled=${room.settings?.chatEnabled}`);
      
      // Broadcast room update to all clients in the room
      io.to(roomId).emit("room-toggled", room);
      
      // Send success response
      callback?.({ success: true });
      
      console.log(`Chat room ${roomId} ${isActive ? 'enabled' : 'disabled'} by ${socket.data.userName} (${socket.data.userId})`);
    } catch (error) {
      console.error("Error toggling room:", error);
      callback?.({ error: "Failed to toggle room status" });
    }
  });

  // Handle activating chat for students (making chat visible)
  socket.on("activate-chat", async (data: { roomId: string }, callback?: SocketCallback) => {
    try {
      const { roomId } = data;
      
      // Validate data
      if (!roomId) {
        callback?.({ error: "Room ID is required" });
        return;
      }
      
      // Only allow creators or admins to activate chat
      if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
        callback?.({ error: "Only lecture creators or admins can activate chat" });
        return;
      }
      
      // Get or create chat session
      let chatSession = activeChatSessions.get(roomId);
      if (!chatSession) {
        chatSession = {
          isActive: true,
          createdBy: socket.data.userId,
          createdAt: new Date().toISOString(),
          participants: new Set([socket.data.userId]),
          isChatVisible: true
        };
        activeChatSessions.set(roomId, chatSession);
      } else {
        // Set chat visibility to true
        chatSession.isChatVisible = true;
        activeChatSessions.set(roomId, chatSession);
      }
      
      console.log(`Chat visibility activated for room ${roomId} by ${socket.data.userName} (${socket.data.userId})`);
      
      // Store chat visibility in Redis for persistence
      await ChatRedis.setChatVisibility(roomId, true);
      
      // Broadcast chat visibility update to all clients in the room
      io.to(roomId).emit("chat-visibility-update", { isVisible: true });
      
      // Send success response
      callback?.({ success: true });
    } catch (error) {
      console.error("Error activating chat:", error);
      callback?.({ error: "Failed to activate chat" });
    }
  });

  socket.on("deactivate-chat", async (data: { roomId: string }, callback?: SocketCallback) => {
    try {
      const { roomId } = data;
      
      console.log(`[Socket-Server] DEACTIVATE-CHAT request received: roomId=${roomId}, user=${socket.data.userName}, role=${socket.data.userRole}`);
      
      // Validate data
      if (!roomId) {
        console.error("[Socket-Server] Invalid room ID in deactivate-chat event");
        callback?.({ error: "Room ID is required" });
        return;
      }
      
      // Only allow creators or admins to end chat
      if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
        console.error(`[Socket-Server] Unauthorized deactivation attempt: User role: ${socket.data.userRole}`);
        callback?.({ error: "Only lecture creators or admins can end chat" });
        return;
      }
      
      // Get chat session
      let chatSession = activeChatSessions.get(roomId);
      if (!chatSession) {
        console.log(`[Socket-Server] No active chat session found for room ${roomId}, creating a new one with visibility=false`);
        chatSession = {
          isActive: true,
          createdBy: socket.data.userId,
          createdAt: new Date().toISOString(),
          participants: new Set([socket.data.userId]),
          isChatVisible: false
        };
        activeChatSessions.set(roomId, chatSession);
      } else {
        // Set chat visibility to false
        console.log(`[Socket-Server] Updating existing chat session: changing visibility from ${chatSession.isChatVisible} to false`);
        chatSession.isChatVisible = false;
        activeChatSessions.set(roomId, chatSession);
      }
      
      console.log(`[Socket-Server] Chat visibility deactivated for room ${roomId} by ${socket.data.userName} (${socket.data.userId})`);
      
      // Store chat visibility in Redis for persistence
      await ChatRedis.setChatVisibility(roomId, false);
      
      // Broadcast chat visibility update to all clients in the room
      io.to(roomId).emit("chat-visibility-update", { isVisible: false });
      
      // Send success response
      callback?.({ success: true });
    } catch (error) {
      console.error("[Socket-Server] Error deactivating chat:", error);
      callback?.({ error: "Failed to end chat" });
    }
  });

  // Handle pinning messages
  socket.on("pin-message", async (data: { roomId: string; messageId: string }, callback?: SocketCallback) => {
    try {
      const { roomId, messageId } = data;
      
      // Only allow creators or admins to pin messages
      if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
        callback?.({ error: "Only lecture creators or admins can pin messages" });
        return;
      }
      
      console.log(`[Socket-Server] Attempting to pin message ${messageId} in room ${roomId}`);
      
      // Pin the message in Redis
      const success = await ChatRedis.pinMessage(roomId, messageId);
      
      if (!success) {
        console.log(`[Socket-Server] Failed to pin message ${messageId} in room ${roomId}`);
        callback?.({ error: "Failed to pin message. The message may not exist." });
        return;
      }
      
      // Get the updated pinned message
      const pinnedMessage = await ChatRedis.getPinnedMessage(roomId);
      
      if (!pinnedMessage) {
        console.log(`[Socket-Server] No pinned message found after pinning ${messageId}`);
        callback?.({ error: "Message was pinned but couldn't be retrieved" });
        return;
      }
      
      console.log(`[Socket-Server] Message ${messageId} pinned successfully`);
      
      // Broadcast the pinned message to the room
      io.to(roomId).emit("message-pinned", pinnedMessage);
      
      // Send success response
      callback?.({ success: true, message: pinnedMessage });
    } catch (error) {
      console.error("Error pinning message:", error);
      callback?.({ error: "Failed to pin message" });
    }
  });

  // Add new forcePinMessage handler 
  socket.on("force-pin-message", async (data: { roomId: string; message: ChatMessage }, callback?: SocketCallback) => {
    try {
      const { roomId, message } = data;
      
      // Only allow creators or admins to pin messages
      if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
        callback?.({ error: "Only lecture creators or admins can pin messages" });
        return;
      }
      
      console.log(`[Socket-Server] Force-pinning message ${message.id} in room ${roomId}`);
      
      // Use the forcePinMessage function to directly pin the message
      const success = await ChatRedis.forcePinMessage(roomId, message);
      
      if (!success) {
        console.log(`[Socket-Server] Failed to force-pin message ${message.id} in room ${roomId}`);
        callback?.({ error: "Failed to force-pin message" });
        return;
      }
      
      // Get the pinned message to verify it worked
      const pinnedMessage = await ChatRedis.getPinnedMessage(roomId);
      
      console.log(`[Socket-Server] Message ${message.id} force-pinned successfully`);
      
      // Broadcast the pinned message to the room
      io.to(roomId).emit("message-pinned", pinnedMessage || message);
      
      // Send success response
      callback?.({ success: true, message: pinnedMessage || message });
    } catch (error) {
      console.error("Error force-pinning message:", error);
      callback?.({ error: "Failed to force-pin message" });
    }
  });

  // Handle unpinning messages
  socket.on("unpin-message", async (data: { roomId: string }, callback?: SocketCallback) => {
    try {
      const { roomId } = data;
      
      // Only allow creators or admins to unpin messages
      if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
        callback?.({ error: "Only lecture creators or admins can unpin messages" });
        return;
      }
      
      // Unpin the message in Redis
      const success = await ChatRedis.unpinMessage(roomId);
      
      if (!success) {
        callback?.({ error: "Failed to unpin message. There may not be a pinned message." });
        return;
      }
      
      // Broadcast the unpin event to the room
      io.to(roomId).emit("message-unpinned", { roomId });
      
      // Send success response
      callback?.({ success: true });
    } catch (error) {
      console.error("Error unpinning message:", error);
      callback?.({ error: "Failed to unpin message" });
    }
  });

  // Handle batched messages with optimized performance
  socket.on("batch-messages", async (data: { roomId: string; userId: string; messages: ChatMessage[] }, callback?: SocketCallback) => {
    try {
      const { roomId, userId, messages } = data
      
      if (!Array.isArray(messages) || messages.length === 0) {
        callback?.({ error: "No messages to process" })
        return
      }
      
      console.log(`[Socket-Server] Processing batch of ${messages.length} messages for room ${roomId}`)
      
      // Verify user ID matches socket user ID for security
      if (userId !== socket.data.userId) {
        callback?.({ error: "User ID mismatch" })
        return
      }
      
      // Check if chat is active and visible
      let chatSession = activeChatSessions.get(roomId)
      if (!chatSession) {
        chatSession = {
          isActive: true,
          createdBy: socket.data.userId,
          createdAt: new Date().toISOString(),
          participants: new Set([socket.data.userId]),
          isChatVisible: socket.data.userRole === "CREATOR" || socket.data.userRole === "ADMIN"
        }
        activeChatSessions.set(roomId, chatSession)
      }
      
      // Normalize and validate all messages before processing
      const normalizedMessages = messages.map(message => ({
        ...message,
        id: message.id || `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        roomId,
        userId: socket.data.userId, // Ensure userId matches the sender
        userName: socket.data.userName, // Use authenticated username
        userImage: socket.data.userImage, // Use authenticated user image
        userRole: socket.data.userRole, // Use authenticated user role
        createdAt: message.createdAt || new Date().toISOString(),
        isPinned: false,
        isDeleted: false
      }))
      
      // Check rate limits based on total message count in batch
      const now = Date.now()
      const messageInterval = now - socket.data.lastMessageTime
      
      // Rate limiting: Check if user is sending too many messages
      // Allow 3x the normal rate for batched messages since they're more efficient
      const effectiveBatchSize = Math.min(normalizedMessages.length, 30) // Cap at 30 messages
      if (socket.data.messageCount >= 30 && messageInterval < 10000) {
        callback?.({ error: "Rate limit exceeded. Please wait before sending more messages." })
        return
      }
      
      // Update rate limiting data
      socket.data.messageCount += effectiveBatchSize
      socket.data.lastMessageTime = now
      
      // Process the batch efficiently using the Redis batch function
      const savedMessages = await ChatRedis.saveBatchMessages(roomId, normalizedMessages)
      
      // Broadcast messages to room
      if (savedMessages && savedMessages.length > 0) {
        // Use a more efficient broadcast method for batch messages
        // Group messages into a single "batch-messages" event rather than separate "new-message" events
        io.to(roomId).emit("batch-messages", {
          messages: savedMessages,
          timestamp: new Date().toISOString()
        })
      }
      
      // Send success response
      callback?.({ 
        success: true, 
        savedCount: savedMessages.length,
        rateLimitInfo: {
          messageCount: socket.data.messageCount,
          lastMessageTime: socket.data.lastMessageTime
        }
      })
      
      // Reset rate limit after a delay if this was a large batch
      if (normalizedMessages.length > 10) {
        setTimeout(() => {
          socket.data.messageCount = Math.max(0, socket.data.messageCount - 5)
        }, 5000) // After 5 seconds, reduce the message count by 5
      }
      
    } catch (error) {
      console.error("Error processing batch messages:", error)
      callback?.({ error: "Failed to process batch messages" })
    }
  })

  // Handle batched messages for improved performance
  socket.on("batch-messages", async (data: { roomId: string; messages: ChatMessage[] }, callback?: SocketCallback) => {
    try {
      const { roomId, messages } = data;
      
      // Validate input
      if (!roomId || !Array.isArray(messages) || messages.length === 0) {
        callback?.({ error: "Invalid batch messages data" });
        return;
      }
      
      console.log(`[Socket-Server] Received batch of ${messages.length} messages for room ${roomId}`);
      
      // Check if chat is active
      const chatSession = activeChatSessions.get(roomId);
      if (!chatSession?.isActive) {
        callback?.({ error: "Chat is not active" });
        return;
      }
      
      // Process the messages in a batch
      const savedMessages = await ChatRedis.saveBatchMessages(roomId, messages.map(msg => ({
        ...msg,
        userId: socket.data.userId,
        userName: socket.data.userName,
        userImage: socket.data.userImage || "",
        userRole: socket.data.userRole
      })));
      
      if (savedMessages.length === 0) {
        callback?.({ error: "Failed to save batch messages" });
        return;
      }
      
      // Broadcast messages to room
      io.to(roomId).emit("batch-messages-received", savedMessages);
      
      // Update user's message count for rate limiting
      socket.data.messageCount += savedMessages.length;
      socket.data.lastMessageTime = Date.now();
      
      // Send success response
      callback?.({ success: true, messageCount: savedMessages.length });
      
      console.log(`[Socket-Server] Successfully processed batch of ${savedMessages.length} messages for room ${roomId}`);
    } catch (error) {
      console.error("Error handling batch messages:", error);
      callback?.({ error: "Failed to process batch messages" });
    }
  });

  // Clean up on disconnect - consolidated with other disconnect handlers
  socket.on("disconnect", async (reason) => {
    console.log(`User disconnected: ${socket.data.userName} (${socket.data.userId}), reason: ${reason || "unknown"}`)
    
    // Remove participant from active chat sessions
    socket.data.rooms?.forEach((roomId: string) => {
      const chatSession = activeChatSessions.get(roomId)
      if (chatSession) {
        chatSession.participants.delete(socket.data.userId)
        if (chatSession.participants.size === 0) {
          activeChatSessions.delete(roomId)
        } else {
          activeChatSessions.set(roomId, chatSession)
        }
      }
    })
  })
})

// Error handling middleware
app.use((error: Error, _req: express.Request, res: express.Response) => {
  console.error("Server error:", error)
  res.status(500).json({ error: "Internal server error" })
})

const port = process.env.SOCKET_PORT || 3001

// Initialize cleanup jobs
ChatRedis.setupCleanupJobs(io);

// Set up a scheduled job to clean up old chat data
const CHAT_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
setInterval(async () => {
  try {
    console.log("[Socket-Server] Running scheduled Redis cleanup job");
    const deletedMessages = await ChatRedis.cleanupOldMessages(60); // Clean messages older than 60 minutes
    const deletedPolls = await ChatRedis.cleanupOldPolls(10); // Clean polls older than 10 minutes
    const deletedSessions = await ChatRedis.cleanupSessions(24 * 60); // Clean sessions older than 24 hours
    
    console.log(`[Socket-Server] Cleanup job completed: Deleted ${deletedMessages} messages, ${deletedPolls} polls, ${deletedSessions} sessions`);
  } catch (error) {
    console.error("[Socket-Server] Error in scheduled cleanup job:", error);
  }
}, CHAT_CLEANUP_INTERVAL);

// Start the server
httpServer.listen(Number(port), "0.0.0.0", () => {
  console.log(`Socket.IO server running on port ${port}`)
  console.log(`CORS origin: ${process.env.NEXT_PUBLIC_APP_URL}`)
  console.log(`Socket URL: ${process.env.NEXT_PUBLIC_SOCKET_URL}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`Server ready to accept connections`)
})
