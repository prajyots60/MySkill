import { toast } from "@/hooks/use-toast"
import type { Server as NetServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import { Redis } from "@upstash/redis"
import { createAdapter } from "@socket.io/redis-adapter"
import { type ChatEvent, type ChatMessage, ChatMessageType, type ChatParticipant, type UserRole, type Poll, type PollOption, PollStatus } from "./types"
import * as ChatRedis from "./redis-chat"
import { v4 as uuidv4 } from "uuid"

let io: SocketIOServer | null = null

// Custom Redis client type that includes needed methods
interface EnhancedRedis extends Redis {
  on(event: string, listener: (error: any) => void): this;
  duplicate(): EnhancedRedis;
}

// Enhance the Socket.IO initialization with session persistence
export const initializeSocket = (server: NetServer) => {
  if (io) return io

  try {
    // Create Redis pub/sub clients for Socket.IO adapter with error handling
    const pubClient = new Redis({
      url: process.env.UPSTASH_REDIS_CHAT_REST_URL || "",
      token: process.env.UPSTASH_REDIS_CHAT_REST_TOKEN || "",
    }) as unknown as EnhancedRedis;

    pubClient.on("error", (err: any) => {
      console.error("Redis Pub Client Error:", err)
    })

    const subClient = pubClient.duplicate()

    subClient.on("error", (err: any) => {
      console.error("Redis Sub Client Error:", err)
    })

    // Create Socket.IO server with enhanced security and performance settings
    io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
      },
      path: "/api/socket",
      transports: ["websocket", "polling"],
      pingInterval: 25000,
      pingTimeout: 20000,
      connectTimeout: 30000,
      maxHttpBufferSize: 1e6, // 1MB max message size
      allowUpgrades: true,
      perMessageDeflate: {
        threshold: 1024, // Only compress messages larger than 1KB
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
        maxAge: 86400000, // 24 hours for session persistence
      },
    })

    // Set up Redis adapter for horizontal scaling with error handling
    try {
      io.adapter(createAdapter(pubClient, subClient))
      console.log("Socket.IO Redis adapter initialized successfully")
    } catch (error) {
      console.error("Failed to initialize Socket.IO Redis adapter:", error)
    }

    // Authentication middleware with proper validation and session persistence
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token
        const userId = socket.handshake.auth.userId
        const userName = socket.handshake.auth.userName
        const userRole = socket.handshake.auth.userRole
        const sessionId = socket.handshake.auth.sessionId || socket.handshake.headers.cookie?.match(/io=([^;]+)/)?.[1]

        if (!token || !userId || !userName) {
          return next(new Error("Authentication error: Missing required credentials"))
        }

        // Validate token format (basic validation)
        if (typeof token !== "string" || token.length < 10) {
          return next(new Error("Authentication error: Invalid token format"))
        }

        // Validate user ID format
        if (typeof userId !== "string" || userId.length < 5) {
          return next(new Error("Authentication error: Invalid user ID format"))
        }

        // Check for existing session
        let existingSession = null
        if (sessionId) {
          try {
            existingSession = await ChatRedis.getUserSession(sessionId)
          } catch (error) {
            console.error("Error retrieving session:", error)
          }
        }

        // If no existing session, check if user has a session
        if (!existingSession) {
          try {
            const userSessionId = await ChatRedis.getUserSessionId(userId)
            if (userSessionId) {
              existingSession = await ChatRedis.getUserSession(userSessionId)
            }
          } catch (error) {
            console.error("Error retrieving user session:", error)
          }
        }

        // Add user data to socket with sanitization
        socket.data.userId = String(userId).trim()
        socket.data.userName = String(userName).trim().substring(0, 50) // Limit username length
        socket.data.userImage = socket.handshake.auth.userImage || null
        socket.data.userRole = ["STUDENT", "CREATOR", "ADMIN"].includes(userRole) ? userRole : "STUDENT"
        socket.data.connectedAt = new Date().toISOString()
        socket.data.sessionId = existingSession?.sessionId || socket.id

        // Store session for persistence
        await ChatRedis.storeUserSession(socket.data.userId, socket.data.sessionId, {
          userName: socket.data.userName,
          userImage: socket.data.userImage,
          userRole: socket.data.userRole,
        })

        // Add rate limiting data
        socket.data.messageCount = 0
        socket.data.lastMessageTime = 0

        next()
      } catch (error) {
        console.error("Socket authentication error:", error)
        next(new Error("Authentication error: Server error during authentication"))
      }
    })

    // Connection handler with enhanced logging and security
    io.on("connection", (socket) => {
      const { userId, userName, userRole, sessionId } = socket.data
      console.log(
        `User connected: ${userId} (${userName}, ${userRole}) - Socket ID: ${socket.id}, Session ID: ${sessionId}`,
      )

      // Set up rate limiting for this socket
      const rateLimitInterval = setInterval(() => {
        socket.data.messageCount = 0
      }, 10000) // Reset message count every 10 seconds

      // Set up periodic cleanup tasks
      const cleanupInterval = setInterval(
        async () => {
          try {
            // Clean up old messages (older than 30 minutes)
            const deletedMessages = await ChatRedis.cleanupOldMessages(30)
            if (deletedMessages > 0) {
              console.log(`Cleaned up ${deletedMessages} old messages`)
            }

            // Clean up old polls (older than 5 minutes)
            const deletedPolls = await ChatRedis.cleanupOldPolls(5)
            if (deletedPolls > 0) {
              console.log(`Cleaned up ${deletedPolls} old polls`)
            }
          } catch (error) {
            console.error("Error during cleanup:", error)
          }
        },
        5 * 60 * 1000,
      ) // Run every 5 minutes

      // Join room with validation and error handling
      socket.on("join-room", async ({ roomId, lectureId }: { roomId: string; lectureId?: string }, callback?: (response: any) => void) => {
        try {
          console.log(`[Socket] JOIN-ROOM request received: roomId=${roomId}, lectureId=${lectureId}, user=${socket.data.userName}, role=${socket.data.userRole}`);
          
          if (!roomId || typeof roomId !== "string") {
            const error = "Invalid room ID provided"
            console.error(`[Socket] ${error}`, { roomId, lectureId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          // Check if lecture is live (only for non-creators/admins)
          if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
            const isLive = await ChatRedis.isLectureLive(lectureId || roomId)
            console.log(`[Socket] Checking if lecture ${lectureId || roomId} is live for non-creator: ${isLive}`)
            if (!isLive) {
              const error = "Lecture is not live"
              console.error(`[Socket] ${error}`, { roomId, lectureId })
              if (typeof callback === "function") callback({ error })
              return
            }
          }
      
          // Check if room exists
          let room = await ChatRedis.getChatRoom(roomId)
          console.log(`[Socket] Room check results:`, room ? 
            `ID: ${room.id}, isActive: ${room.isActive}, isChatVisible: ${room.isChatVisible}, createdAt: ${room.createdAt}` : 
            "room not found");
      
          // If room doesn't exist and user is creator, create it
          if (!room && socket.data.userRole === "CREATOR") {
            console.log(`[Socket] Creating new room for creator, roomId=${roomId}`);
            try {
              room = await ChatRedis.createChatRoom(lectureId || roomId, {
                isModerated: true,
                allowPolls: true,
                slowMode: false,
                slowModeInterval: 5,
                allowLinks: true,
                allowImages: true,
                allowReplies: true,
                maxMessageLength: 500,
                chatEnabled: false, // Initialize with chat disabled
              });
              
              console.log(`[Socket] Created new chat room: ${roomId}, isChatVisible=${room.isChatVisible}`);
      
              // Set lecture as live
              await ChatRedis.setLectureLiveStatus(lectureId || roomId, true);
            } catch (error) {
              console.error(`[Socket] Error creating chat room:`, error);
              if (typeof callback === "function") callback({ error: "Failed to create chat room" });
              return;
            }
          }
      
          // If room doesn't exist and user is not creator, return error
          if (!room) {
            const error = "Chat room not found"
            console.error(`[Socket] ${error}`, { roomId, lectureId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          // If room is not active and user is not creator or admin, return error
          if (!room.isActive && socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
            const error = "Chat room is not active"
            console.error(`[Socket] ${error}`, { roomId, userId: socket.data.userId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          // Check if user is muted with proper error handling
          try {
            const isMuted = await ChatRedis.isUserMuted(roomId, socket.data.userId)
            if (isMuted && socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
              socket.emit("muted", { message: "You are muted in this chat" })
            }
          } catch (error) {
            console.error("Error checking mute status:", error)
          }
      
          // Join the room
          socket.join(roomId)
          console.log(`User ${socket.data.userId} joined room ${roomId}`)
      
          // Add participant to the room
          const participant: ChatParticipant = {
            userId: socket.data.userId,
            userName: socket.data.userName,
            userImage: socket.data.userImage,
            userRole: socket.data.userRole as UserRole,
            isOnline: true,
            lastActive: new Date().toISOString(),
          }
      
          try {
            await ChatRedis.addParticipant(roomId, participant)
          } catch (error) {
            console.error("Error adding participant:", error)
          }
      
          // Get room data with error handling
          try {
            // Get recent messages with pagination
            const messages = await ChatRedis.getMessages(roomId, 50)
      
            // Get pinned message
            const pinnedMessage = await ChatRedis.getPinnedMessage(roomId)
      
            // Get active polls
            const activePolls = await ChatRedis.getActivePolls(roomId)
      
            // Get user votes for active polls
            const userVotes: Record<string, string> = {}
            for (const poll of activePolls) {
              const vote = await ChatRedis.getUserVote(roomId, poll.id, socket.data.userId)
              if (vote) {
                userVotes[poll.id] = vote
              }
            }
      
            // Get participants
            const participants = await ChatRedis.getParticipants(roomId)
      
            // Get muted users (only for moderators)
            let mutedUsers: any[] = []
            if (socket.data.userRole === "CREATOR" || socket.data.userRole === "ADMIN") {
              mutedUsers = await ChatRedis.getMutedUsers(roomId)
            }
      
            // Send room data to the user
            socket.emit("room-data", {
              room,
              messages,
              pinnedMessage,
              activePolls,
              userVotes, // Include user's votes
              participants,
              mutedUsers,
            })
      
            // Notify others that user joined
            const joinEvent: ChatEvent = {
              type: "JOIN",
              payload: participant,
              timestamp: new Date().toISOString(),
              roomId,
            }
      
            socket.to(roomId).emit("chat-event", joinEvent)
      
            // Save system message about user joining
            if (room.settings.isModerated) {
              const systemMessage: ChatMessage = {
                id: uuidv4(),
                roomId,
                userId: "system",
                userName: "System",
                userRole: "ADMIN",
                content: `${socket.data.userName} joined the chat`,
                type: ChatMessageType.SYSTEM,
                isPinned: false,
                isDeleted: false,
                createdAt: new Date().toISOString(),
              }
      
              await ChatRedis.saveMessage(systemMessage)
              io?.to(roomId).emit("new-message", systemMessage)
            }
      
            // Success callback
            if (typeof callback === "function") callback({ success: true })
          } catch (error) {
            console.error("Error fetching room data:", error)
            if (typeof callback === "function") callback({ error: "Failed to load chat data" })
          }
        } catch (error) {
          console.error("Error joining room:", error)
          if (typeof callback === "function") callback({ error: "Failed to join chat room" })
        }
      })

      // Enhanced message sending with rate limiting, content filtering, and validation
      socket.on("send-message", async ({ roomId, content, type = ChatMessageType.TEXT }: { roomId: string; content: string; type?: ChatMessageType }, callback?: (response: any) => void) => {
        try {
          // Validate room ID
          if (!roomId || typeof roomId !== "string") {
            const error = "Invalid room ID"
            console.error(error, { roomId })
            if (typeof callback === "function") callback({ error })
            return
          }

          // Get room with error handling
          let room
          try {
            room = await ChatRedis.getChatRoom(roomId)
          } catch (error) {
            console.error("Error fetching room:", error)
            if (typeof callback === "function") callback({ error: "Failed to verify chat room" })
            return
          }

          if (!room || !room.isActive) {
            const error = "Chat room is not active"
            console.error(error, { roomId })
            if (typeof callback === "function") callback({ error })
            return
          }

          // Check if user is muted
          try {
            const isMuted = await ChatRedis.isUserMuted(roomId, socket.data.userId)
            if (isMuted && socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
              const error = "You are muted in this chat"
              console.error(error, { userId: socket.data.userId, roomId })
              if (typeof callback === "function") callback({ error })
              return
            }
          } catch (error) {
            console.error("Error checking mute status:", error)
          }

          // Apply rate limiting for non-moderators
          if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
            // Socket-level rate limiting
            const now = Date.now()
            const messageInterval = now - socket.data.lastMessageTime

            // If slow mode is enabled, enforce the interval
            if (
              room.settings.slowMode &&
              messageInterval < room.settings.slowModeInterval * 1000 &&
              socket.data.lastMessageTime > 0
            ) {
              const waitTime = Math.ceil((room.settings.slowModeInterval * 1000 - messageInterval) / 1000)
              const error = `Slow mode is enabled. Please wait ${waitTime} seconds before sending another message.`
              console.warn(error, { userId: socket.data.userId, roomId })
              if (typeof callback === "function") callback({ error })
              return
            }

            // General rate limiting (5 messages per 10 seconds)
            if (socket.data.messageCount >= 5) {
              const error = "You are sending messages too quickly. Please wait a moment."
              console.warn(error, { userId: socket.data.userId, roomId })
              if (typeof callback === "function") callback({ error })
              return
            }

            // Redis-based rate limiting as a backup
            try {
              const isWithinLimit = await ChatRedis.checkRateLimit(
                roomId,
                socket.data.userId,
                room.settings.slowMode ? 1 : 5,
                room.settings.slowMode ? room.settings.slowModeInterval : 10,
              )

              if (!isWithinLimit) {
                const error = room.settings.slowMode
                  ? `Slow mode is enabled. Please wait ${room.settings.slowModeInterval} seconds between messages.`
                  : "You are sending messages too quickly. Please wait a moment."
                console.warn(error, { userId: socket.data.userId, roomId })
                if (typeof callback === "function") callback({ error })
                return
              }
            } catch (error) {
              console.error("Error checking rate limit:", error)
            }

            // Update rate limiting data
            socket.data.messageCount++
            socket.data.lastMessageTime = now
          }

          // Validate message content
          if (!content || typeof content !== "string" || content.trim() === "") {
            const error = "Message cannot be empty"
            console.error(error)
            if (typeof callback === "function") callback({ error })
            return
          }

          // Enforce maximum message length
          if (content.length > room.settings.maxMessageLength) {
            const error = `Message is too long. Maximum length is ${room.settings.maxMessageLength} characters.`
            console.error(error, { contentLength: content.length, maxLength: room.settings.maxMessageLength })
            if (typeof callback === "function") callback({ error })
            return
          }

          // Filter content if needed (basic profanity filter example)
          const profanityList = ["badword1", "badword2", "badword3"]
          let filteredContent = content

          if (room.settings.isModerated) {
            for (const word of profanityList) {
              const regex = new RegExp(`\\b${word}\\b`, "gi")
              filteredContent = filteredContent.replace(regex, "***")
            }
          }

          // Create message with sanitized data
          const message: ChatMessage = {
            id: uuidv4(),
            roomId,
            userId: socket.data.userId,
            userName: socket.data.userName,
            userImage: socket.data.userImage,
            userRole: socket.data.userRole as UserRole,
            content: filteredContent,
            type,
            isPinned: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
          }

          // Save message with error handling
          try {
            await ChatRedis.saveMessage(message)
          } catch (error) {
            console.error("Error saving message:", error)
            if (typeof callback === "function") callback({ error: "Failed to save message" })
            return
          }

          // Broadcast message to room
          io?.to(roomId).emit("new-message", message)

          // Update participant's last active time
          try {
            await ChatRedis.updateParticipantStatus(roomId, socket.data.userId, true)
          } catch (error) {
            console.error("Error updating participant status:", error)
          }

          // Success callback
          if (typeof callback === "function") callback({ success: true })
        } catch (error) {
          console.error("Error sending message:", error)
          if (typeof callback === "function") callback({ error: "Failed to send message" })
        }
      })

      // Add pin message handler
      socket.on("pin-message", async ({ roomId, messageId }: { roomId: string; messageId: string }, callback?: (response: any) => void) => {
        try {
          // Validate input
          if (!roomId || !messageId) {
            const error = "Invalid pin request: missing roomId or messageId"
            console.error(error, { roomId, messageId })
            if (typeof callback === "function") callback({ error })
            return
          }

          // Only moderators can pin messages
          if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
            const error = "Only moderators can pin messages"
            console.error(error, { userId: socket.data.userId, roomId })
            if (typeof callback === "function") callback({ error })
            return
          }

          console.log(`[Socket DEBUG] Attempting to pin message ${messageId} in room ${roomId} by user ${socket.data.userId}`);

          // Get the message to pin
          const messages = await ChatRedis.getMessages(roomId, 500)
          console.log(`[Socket DEBUG] Retrieved ${messages.length} messages from room ${roomId}`);
          
          const messageToPin = messages.find(msg => msg.id === messageId)
          
          if (!messageToPin) {
            console.error(`[Socket DEBUG] Message ${messageId} not found in retrieved messages`);
            const error = "Message not found"
            console.error(error, { messageId, roomId })
            if (typeof callback === "function") callback({ error })
            return
          }

          console.log(`[Socket DEBUG] Found message to pin: "${messageToPin.content.substring(0, 30)}..." by ${messageToPin.userName}`);

          // Pin the message
          console.log(`[Socket DEBUG] Calling ChatRedis.pinMessage for message ${messageId}`);
          const success = await ChatRedis.pinMessage(roomId, messageId)
          
          if (!success) {
            console.error(`[Socket DEBUG] ChatRedis.pinMessage returned false for message ${messageId}`);
            const error = "Failed to pin message"
            console.error(error, { messageId, roomId })
            if (typeof callback === "function") callback({ error })
            return
          }

          console.log(`[Socket DEBUG] ChatRedis.pinMessage succeeded for message ${messageId}`);

          // Update the message object
          messageToPin.isPinned = true
          
          // Broadcast the pinned message to all clients in the room
          console.log(`[Socket DEBUG] Broadcasting message-pinned event to room ${roomId}`);
          io?.to(roomId).emit("message-pinned", messageToPin)
          
          // Success callback
          console.log(`[Socket DEBUG] Sending success callback for message ${messageId}`);
          if (typeof callback === "function") callback({ success: true, message: messageToPin })
          
          console.log(`Message ${messageId} pinned in room ${roomId} by ${socket.data.userName}`)
        } catch (error) {
          console.error("[Socket DEBUG] Error in pin-message handler:", error)
          if (typeof callback === "function") callback({ error: "Failed to pin message" })
        }
      })

      // Add unpin message handler
      socket.on("unpin-message", async ({ roomId }: { roomId: string }, callback?: (response: any) => void) => {
        try {
          // Validate input
          if (!roomId) {
            const error = "Invalid unpin request: missing roomId"
            console.error(error, { roomId })
            if (typeof callback === "function") callback({ error })
            return
          }

          // Only moderators can unpin messages
          if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
            const error = "Only moderators can unpin messages"
            console.error(error, { userId: socket.data.userId, roomId })
            if (typeof callback === "function") callback({ error })
            return
          }

          // Get current pinned message for reference
          const pinnedMessage = await ChatRedis.getPinnedMessage(roomId)
          
          if (!pinnedMessage) {
            const error = "No pinned message found"
            console.error(error, { roomId })
            if (typeof callback === "function") callback({ error })
            return
          }

          // Unpin the message
          const success = await ChatRedis.unpinMessage(roomId)
          
          if (!success) {
            const error = "Failed to unpin message"
            console.error(error, { roomId })
            if (typeof callback === "function") callback({ error })
            return
          }

          // Broadcast the unpin event to all clients in the room
          io?.to(roomId).emit("message-unpinned")
          
          // Success callback
          if (typeof callback === "function") callback({ success: true })
          
          console.log(`Message unpinned in room ${roomId} by ${socket.data.userName}`)
        } catch (error) {
          console.error("Error unpinning message:", error)
          if (typeof callback === "function") callback({ error: "Failed to unpin message" })
        }
      })

      // Enhance socket.on("create-poll") with better validation and error handling
      socket.on("create-poll", async ({ roomId, question, options }: { roomId: string; question: string; options: string[] }, callback?: (response: any) => void) => {
        try {
          // Validate input
          if (!roomId || !question || !Array.isArray(options) || options.length < 2) {
            const error = "Invalid poll data: missing required fields or insufficient options"
            console.error(error, { roomId, question, optionsCount: options?.length })
            if (typeof callback === "function") callback({ error })
            return
          }

          // Validate room exists
          const room = await ChatRedis.getChatRoom(roomId)
          if (!room) {
            if (typeof callback === "function") callback({ error: "Room not found" })
            return
          }

          // Check if room settings allow polls
          if (!room.settings.allowPolls) {
            if (typeof callback === "function") callback({ error: "Polls are not allowed in this room" })
            return
          }

          // Create poll with proper data structure
          const poll: Poll = {
            id: uuidv4(),
            roomId,
            question: question.trim(),
            options: options.filter(Boolean).map((text): PollOption => ({
              id: uuidv4(),
              text: text.trim(),
              votes: 0,
            })),
            status: PollStatus.ACTIVE,
            createdAt: new Date().toISOString(),
            createdBy: socket.data.userId,
          }

          await ChatRedis.createPoll(roomId, poll)

          // Create and broadcast poll message
          const pollMessage: ChatMessage = {
            id: uuidv4(),
            roomId,
            userId: socket.data.userId,
            userName: socket.data.userName,
            userImage: socket.data.userImage,
            userRole: socket.data.userRole as UserRole,
            content: question,
            type: ChatMessageType.POLL,
            isPinned: false,
            isDeleted: false,
            poll,
            createdAt: new Date().toISOString(),
          }

          await ChatRedis.saveMessage(pollMessage)
          io?.to(roomId).emit("new-message", pollMessage)
          io?.to(roomId).emit("new-poll", poll)

          if (typeof callback === "function") callback({ success: true, pollId: poll.id })
        } catch (error) {
          console.error("Error creating poll:", error)
          if (typeof callback === "function") callback({ error: "Failed to create poll" })
        }
      })

      // Enhance socket.on("vote-poll") with better validation and error handling
      socket.on("vote-poll", async ({ roomId, pollId, optionId }: { roomId: string; pollId: string; optionId: string }, callback?: (response: any) => void) => {
        try {
          // Validate input
          if (!roomId || !pollId || !optionId) {
            const error = "Invalid vote data: missing required fields"
            console.error(error, { roomId, pollId, optionId })
            if (typeof callback === "function") callback({ error })
            return
          }

          // Get poll
          const poll = await ChatRedis.getPoll(roomId, pollId)
          if (!poll) {
            if (typeof callback === "function") callback({ error: "Poll not found" })
            return
          }

          // Check if poll is active
          if (poll.status !== PollStatus.ACTIVE) {
            if (typeof callback === "function")
              callback({
                error: "Poll is closed",
                currentPoll: poll,
                userVoted: await ChatRedis.getUserVote(roomId, pollId, socket.data.userId),
              })
            return
          }

          // Check if option exists
          const optionExists = poll.options.some((opt) => opt.id === optionId)
          if (!optionExists) {
            if (typeof callback === "function")
              callback({
                error: "Invalid option",
                currentPoll: poll,
                userVoted: await ChatRedis.getUserVote(roomId, pollId, socket.data.userId),
              })
            return
          }

          // Check if user already voted
          const existingVote = await ChatRedis.getUserVote(roomId, pollId, socket.data.userId)
          if (existingVote) {
            if (typeof callback === "function")
              callback({
                error: "You have already voted",
                currentPoll: poll,
                userVoted: existingVote,
              })
            return
          }

          // Record vote
          const updatedPoll = await ChatRedis.votePoll(roomId, pollId, socket.data.userId, optionId)
          if (!updatedPoll) {
            if (typeof callback === "function") callback({ error: "Failed to record vote" })
            return
          }

          // Broadcast updated poll
          io?.to(roomId).emit("poll-updated", updatedPoll)

          if (typeof callback === "function")
            callback({
              success: true,
              poll: updatedPoll,
              userVote: optionId,
            })
        } catch (error) {
          console.error("Error voting in poll:", error)
          if (typeof callback === "function") callback({ error: "Failed to vote in poll" })
        }
      })

      // Add a new event handler for activating the chat
      socket.on("activate-chat", async ({ roomId, lectureId }: { roomId: string; lectureId?: string }, callback?: (response: any) => void) => {
        try {
          console.log(`[Socket] Activate chat request received for room ${roomId}`);
          
          // Validate input
          if (!roomId || typeof roomId !== "string") {
            const error = "Invalid room ID"
            console.error(`[Socket] ${error}`, { roomId, lectureId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          // Only creators and admins can activate chat
          if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
            const error = "Only creators can activate chat"
            console.error(`[Socket] ${error}`, { userId: socket.data.userId, userRole: socket.data.userRole, roomId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          // Check if room exists
          let room = await ChatRedis.getChatRoom(roomId)
          console.log(`[Socket] Room found for activation:`, room ? `Room ID: ${room.id}, isActive: ${room.isActive}, isChatVisible: ${room.isChatVisible}` : "null");
          
          if (!room) {
            const error = "Chat room not found"
            console.error(`[Socket] ${error}`, { roomId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          // Update chat visibility
          console.log(`[Socket] Calling toggleChatVisibility to set visibility to true for room ${roomId}`);
          room = await ChatRedis.toggleChatVisibility(roomId, true)
          if (!room) {
            const error = "Failed to activate chat"
            console.error(`[Socket] ${error}`, { roomId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          console.log(`[Socket] Chat successfully activated for room ${roomId} by ${socket.data.userName} (${socket.data.userId})`);
      
          // Broadcast chat visibility update to all clients in the room
          io?.to(roomId).emit("chat-visibility-update", { isVisible: true, roomId })
          console.log(`[Socket] Broadcast chat-visibility-update event with isVisible=true to room ${roomId}`);
      
          // Send success response
          if (typeof callback === "function") {
            console.log(`[Socket] Sending success callback for activate-chat for room ${roomId}`);
            callback({ success: true })
          }
        } catch (error) {
          console.error(`[Socket] Error activating chat for room ${roomId}:`, error)
          if (typeof callback === "function") callback({ error: "Failed to activate chat" })
        }
      })
      
      // Add a new event handler for deactivating the chat
      socket.on("deactivate-chat", async ({ roomId }: { roomId: string }, callback?: (response: any) => void) => {
        try {
          // Validate input
          if (!roomId || typeof roomId !== "string") {
            const error = "Invalid room ID"
            console.error(error, { roomId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          // Only creators and admins can end chat
          if (socket.data.userRole !== "CREATOR" && socket.data.userRole !== "ADMIN") {
            const error = "Only creators can end chat"
            console.error(error, { userId: socket.data.userId, roomId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          // Check if room exists
          let room = await ChatRedis.getChatRoom(roomId)
          if (!room) {
            const error = "Chat room not found"
            console.error(error, { roomId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          // Update chat visibility
          room = await ChatRedis.toggleChatVisibility(roomId, false)
          if (!room) {
            const error = "Failed to end chat"
            console.error(error, { roomId })
            if (typeof callback === "function") callback({ error })
            return
          }
      
          console.log(`Chat deactivated for room ${roomId} by ${socket.data.userName} (${socket.data.userId})`)
      
          // Broadcast chat visibility update to all clients in the room
          io?.to(roomId).emit("chat-visibility-update", { isVisible: false, roomId })
      
          // Send success response
          if (typeof callback === "function") callback({ success: true })
        } catch (error) {
          console.error("Error deactivating chat:", error)
          if (typeof callback === "function") callback({ error: "Failed to end chat" })
        }
      })
      
      // Add these new event listeners for pinned message updates
      socket.on("message-pinned", (message: ChatMessage) => {
        console.log("[Socket] Message pinned event received:", message.id);
      });

      socket.on("message-unpinned", () => {
        console.log("[Socket] Message unpinned event received");
      });

      // Other event handlers with improved error handling and validation...

      // Leave room with proper cleanup
      socket.on("leave-room", async ({ roomId }: { roomId: string }) => {
        try {
          if (!roomId || typeof roomId !== "string") {
            console.error("Invalid room ID for leave-room event", { roomId })
            return
          }

          socket.leave(roomId)
          console.log(`User ${socket.data.userId} left room ${roomId}`)

          // Update participant status
          try {
            await ChatRedis.updateParticipantStatus(roomId, socket.data.userId, false)
          } catch (error) {
            console.error("Error updating participant status:", error)
          }

          // Notify others that user left
          const leaveEvent: ChatEvent = {
            type: "LEAVE",
            payload: {
              userId: socket.data.userId,
              userName: socket.data.userName,
            },
            timestamp: new Date().toISOString(),
            roomId,
          }

          socket.to(roomId).emit("chat-event", leaveEvent)

          // Get room
          let room
          try {
            room = await ChatRedis.getChatRoom(roomId)
          } catch (error) {
            console.error("Error fetching room:", error)
            return
          }

          // Save system message about user leaving
          if (room && room.settings.isModerated) {
            const systemMessage: ChatMessage = {
              id: uuidv4(),
              roomId,
              userId: "system",
              userName: "System",
              userRole: "ADMIN",
              content: `${socket.data.userName} left the chat`,
              type: ChatMessageType.SYSTEM,
              isPinned: false,
              isDeleted: false,
              createdAt: new Date().toISOString(),
            }

            try {
              await ChatRedis.saveMessage(systemMessage)
              io?.to(roomId).emit("new-message", systemMessage)
            } catch (error) {
              console.error("Error saving system message:", error)
            }
          }
        } catch (error) {
          console.error("Error leaving room:", error)
        }
      })

      // Disconnect handler with proper cleanup
      socket.on("disconnect", () => {
        clearInterval(rateLimitInterval)
        clearInterval(cleanupInterval)
      })

      socket.on("disconnect", async (reason: string) => {
        console.log(`User disconnected: ${socket.data.userId}, reason: ${reason}`)

        // Clear rate limit interval
        clearInterval(rateLimitInterval)

        // Get all rooms the socket was in
        const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id)

        // Update participant status in all rooms
        for (const roomId of rooms) {
          try {
            await ChatRedis.updateParticipantStatus(roomId as string, socket.data.userId, false)

            // Notify others that user left
            const leaveEvent: ChatEvent = {
              type: "LEAVE",
              payload: {
                userId: socket.data.userId,
                userName: socket.data.userName,
              },
              timestamp: new Date().toISOString(),
              roomId: roomId as string,
            }

            socket.to(roomId).emit("chat-event", leaveEvent)

            // Add system message about disconnection
            const room = await ChatRedis.getChatRoom(roomId as string)
            if (room && room.settings.isModerated) {
              const systemMessage: ChatMessage = {
                id: uuidv4(),
                roomId: roomId as string,
                userId: "system",
                userName: "System",
                userRole: "ADMIN",
                content: `${socket.data.userName} disconnected`,
                type: ChatMessageType.SYSTEM,
                isPinned: false,
                isDeleted: false,
                createdAt: new Date().toISOString(),
              }

              await ChatRedis.saveMessage(systemMessage)
              io?.to(roomId).emit("new-message", systemMessage)
            }
          } catch (error) {
            console.error(`Error handling disconnect for room ${roomId}:`, error)
          }
        }
      })
    })

    return io
  } catch (error) {
    console.error("Error initializing Socket.IO:", error)
    throw error
  }
}

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized")
  }
  return io
}

export default {
  initializeSocket,
  getIO,
}

class LiveStreamSocket {
  private socket: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout = 1000 // Start with 1 second
  private listeners: Map<string, Set<(status: string) => void>> = new Map()

  constructor() {
    if (typeof window !== "undefined") {
      this.connect()
    }
  }

  private connect() {
    try {
      // Use secure WebSocket if the site is served over HTTPS
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      this.socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`)

      this.socket.onopen = () => {
        console.log("WebSocket connected")
        this.reconnectAttempts = 0
        this.reconnectTimeout = 1000
      }

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === "STREAM_STATUS_UPDATE") {
            const { lectureId, status } = data
            this.notifyListeners(lectureId, status)
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      }

      this.socket.onclose = () => {
        console.log("WebSocket disconnected")
        this.handleReconnect()
      }

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error)
      }
    } catch (error) {
      console.error("Error creating WebSocket:", error)
      this.handleReconnect()
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)
        this.reconnectAttempts++
        this.reconnectTimeout *= 2 // Exponential backoff
        this.connect()
      }, this.reconnectTimeout)
    } else {
      toast({
        title: "Connection Error",
        description: "Failed to maintain live stream connection. Please refresh the page.",
        variant: "destructive",
      })
    }
  }

  public subscribe(lectureId: string, callback: (status: string) => void) {
    if (!this.listeners.has(lectureId)) {
      this.listeners.set(lectureId, new Set())
    }
    this.listeners.get(lectureId)?.add(callback)

    // Send subscription message
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "SUBSCRIBE",
          lectureId,
        }),
      )
    }
  }

  public unsubscribe(lectureId: string, callback: (status: string) => void) {
    this.listeners.get(lectureId)?.delete(callback)
    if (this.listeners.get(lectureId)?.size === 0) {
      this.listeners.delete(lectureId)

      // Send unsubscribe message
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "UNSUBSCRIBE",
            lectureId,
          }),
        )
      }
    }
  }

  private notifyListeners(lectureId: string, status: string) {
    this.listeners.get(lectureId)?.forEach((callback) => callback(status))
  }
}

// Export a singleton instance
export const liveStreamSocket = new LiveStreamSocket()
