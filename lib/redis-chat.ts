import { Redis } from "@upstash/redis"
import { type ChatMessage, type ChatRoom, type ChatRoomSettings, type MutedUser, type ChatParticipant, type Poll, PollStatus } from "./types"

// Create a separate Redis client for chat functionality
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_CHAT_REST_URL || "",
  token: process.env.UPSTASH_REDIS_CHAT_REST_TOKEN || "",
})

// Key prefixes for different data types
const ROOM_PREFIX = "chat:room:"
const MESSAGE_PREFIX = "chat:messages:"
const MUTED_PREFIX = "chat:muted:"
const PARTICIPANTS_PREFIX = "chat:participants:"
const POLL_PREFIX = "chat:poll:"
const RATE_LIMIT_PREFIX = "chat:ratelimit:"
const CHANNEL_PREFIX = "chat:"
const USER_SESSION_PREFIX = "chat:session:"
const ROOM_MESSAGES_PREFIX = "chat:room:messages:"

// Constants for expiration times
const MESSAGE_EXPIRY_SECONDS = 10000; // 
const ROOM_EXPIRY_SECONDS = 14400; // 4 hours
const POLL_EXPIRY_SECONDS = 300; // 5 minutes

// Add a simple in-memory cache to reduce Redis calls
const CACHE_TTL = 30000 // 30 seconds
const messageCache = new Map<string, { data: any; timestamp: number }>()
const roomCache = new Map<string, { data: ChatRoom; timestamp: number }>()
const participantCache = new Map<string, { data: ChatParticipant[]; timestamp: number }>()

// Helper function to get from cache or fetch from Redis
async function getFromCacheOrFetch<T>(
  cacheMap: Map<string, { data: T; timestamp: number }>,
  key: string,
  fetchFn: () => Promise<T>,
  ttl = CACHE_TTL,
): Promise<T> {
  const now = Date.now()
  const cached = cacheMap.get(key)

  if (cached && now - cached.timestamp < ttl) {
    return cached.data
  }

  const data = await fetchFn()
  cacheMap.set(key, { data, timestamp: now })
  return data
}

// Helper function to invalidate cache
function invalidateCache(key: string): void {
  messageCache.delete(key)
  roomCache.delete(key)
  participantCache.delete(key)
}

// Enhanced error handling wrapper for Redis operations
async function safeRedisOperation<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`${errorMessage}:`, error)
    throw new Error(errorMessage)
  }
}

// Type-safe Redis operations with proper argument handling
interface RedisValue {
  toString(): string;
}

interface RedisClient {
  lrem(key: string, count: number, value: string): Promise<number>;
  lset(key: string, index: number, value: string): Promise<string>;
  sadd(key: string, value: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  publish(channel: string, message: string): Promise<number>;
}

// Helper functions for type-safe Redis operations
async function safeLrem(key: string, value: RedisValue): Promise<number> {
  return redis.lrem(key, 0, value.toString());
}

async function safeLset(key: string, index: number, value: RedisValue): Promise<string> {
  return redis.lset(key, index, value.toString());
}

async function safeSadd(key: string, value: RedisValue): Promise<number> {
  return redis.sadd(key, value.toString());
}

async function safeHgetall<T>(key: string): Promise<Record<string, T> | null> {
  const result = await redis.hgetall(key);
  return result ? (result as Record<string, T>) : null;
}

// Chat room functions
export async function createChatRoom(lectureId: string, settings: ChatRoomSettings): Promise<ChatRoom> {
  return safeRedisOperation(async () => {
    console.log(`[Redis] Creating new chat room for lecture ${lectureId} with settings:`, JSON.stringify(settings));
    
    const roomId = `${lectureId}`
    const room: ChatRoom = {
      id: roomId,
      lectureId,
      isActive: true,
      isChatVisible: false, // Explicitly set initial visibility to false
      createdAt: new Date().toISOString(),
      settings,
      lastActivity: new Date().toISOString(),
    }

    console.log(`[Redis] New room object before saving:`, JSON.stringify(room));
    
    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(room))
    roomCache.set(roomId, { data: room, timestamp: Date.now() })
    
    console.log(`[Redis] Successfully created and stored chat room ${roomId} with isChatVisible=${room.isChatVisible}`);
    
    return room
  }, "Failed to create chat room")
}

export async function getChatRoom(roomId: string, forceRefresh: boolean = false): Promise<ChatRoom | null> {
  return safeRedisOperation(async () => {
    // If force refresh is requested, clear cache
    if (forceRefresh) {
      roomCache.delete(roomId);
      console.log(`[Redis] Force refreshing room data for ${roomId}`);
    }
    
    return getFromCacheOrFetch<ChatRoom | null>(roomCache, roomId, async () => {
      console.log(`[Redis] Fetching room ${roomId} directly from Redis`);
      const roomData = await redis.get(`${ROOM_PREFIX}${roomId}`);
      const parsedRoom = roomData ? JSON.parse(roomData as string) : null;
      
      if (parsedRoom) {
        console.log(`[Redis] Found room ${roomId}, isActive=${parsedRoom.isActive}, isChatVisible=${parsedRoom.isChatVisible}`);
      } else {
        console.log(`[Redis] Room ${roomId} not found in Redis`);
      }
      
      return parsedRoom;
    })
  }, "Failed to get chat room")
}

export async function updateChatRoomSettings(
  roomId: string,
  settings: Partial<ChatRoomSettings>,
): Promise<ChatRoom | null> {
  return safeRedisOperation(async () => {
    const room = await getChatRoom(roomId)
    if (!room) return null

    const updatedRoom: ChatRoom = {
      ...room,
      settings: {
        ...room.settings,
        ...settings,
      },
    }

    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(updatedRoom))
    roomCache.set(roomId, { data: updatedRoom, timestamp: Date.now() })
    return updatedRoom
  }, "Failed to update chat room settings")
}

export async function toggleChatRoom(roomId: string, isActive: boolean): Promise<ChatRoom | null> {
  return safeRedisOperation(async () => {
    console.log(`[Redis] Toggling chat room ${roomId} to isActive=${isActive}`);
    
    // Force clear cache to ensure we get the most recent data
    roomCache.delete(roomId);
    
    const room = await getChatRoom(roomId);
    if (!room) {
      console.log(`[Redis] Room ${roomId} not found when toggling isActive`);
      return null;
    }

    // Create updated room with new isActive status and also update the chatEnabled setting
    const updatedRoom: ChatRoom = {
      ...room,
      isActive,
      settings: {
        ...room.settings,
        chatEnabled: isActive, // Sync chatEnabled with isActive
      },
      lastActivity: new Date().toISOString(),
    };

    console.log(`[Redis] Saving room ${roomId} with isActive=${isActive}, chatEnabled=${updatedRoom.settings.chatEnabled}`);
    
    // Persist to Redis
    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(updatedRoom));
    
    // Update cache with fresh data
    roomCache.set(roomId, { data: updatedRoom, timestamp: Date.now() });
    
    // Publish update for real-time sync
    await publishUpdate("ROOM_TOGGLED", { roomId, room: updatedRoom });
    
    return updatedRoom;
  }, "Failed to toggle chat room");
}


export async function getPinnedMessage(roomId: string): Promise<ChatMessage | null> {
  return safeRedisOperation(async () => {
    const cacheKey = `${roomId}:pinned`

    return getFromCacheOrFetch<ChatMessage | null>(messageCache, cacheKey, async () => {
      const pinnedMessage = await redis.get(`${MESSAGE_PREFIX}${roomId}:pinned`)
      return pinnedMessage ? JSON.parse(pinnedMessage as string) : null
    })
  }, "Failed to get pinned message")
}

export async function pinMessage(roomId: string, messageId: string): Promise<boolean> {
  console.log(`[Redis] Attempting to pin message ${messageId} in room ${roomId}`);
  
  // Get all messages
  const allMessages = await getMessages(roomId, 500);
  console.log(`[Redis] Retrieved ${allMessages.length} messages for room ${roomId}`);

  // Find the message to pin
  const messageToPin = allMessages.find((msg) => msg.id === messageId);
  if (!messageToPin) {
    console.log(`[Redis] Message to pin (${messageId}) not found in room ${roomId}`);
    return false;
  }

  console.log(`[Redis] Found message to pin: ${messageToPin.id} by ${messageToPin.userName}`);

  // Update the message to be pinned
  messageToPin.isPinned = true;

  // Save the pinned message
  await redis.set(`${MESSAGE_PREFIX}${roomId}:pinned`, JSON.stringify(messageToPin));
  console.log(`[Redis] Saved pinned message ${messageId} in room ${roomId}`);

  // Update the message in the list
  const messageIndex = allMessages.findIndex((msg) => msg.id === messageId);
  if (messageIndex !== -1) {
    await redis.lset(`${MESSAGE_PREFIX}${roomId}`, messageIndex, JSON.stringify(messageToPin));
    console.log(`[Redis] Updated message ${messageId} in message list at position ${messageIndex}`);
  }

  // Clear the message cache to ensure fresh data is retrieved
  messageCache.delete(`${roomId}:messages:50`);
  messageCache.delete(`${roomId}:messages:100`);
  messageCache.delete(`${roomId}:messages:500`);
  messageCache.delete(`${roomId}:pinned`);
  console.log(`[Redis] Cleared cached messages for room ${roomId}`);

  // Publish an update about the pinned message
  await publishUpdate("MESSAGE_PINNED", { roomId, message: messageToPin });
  console.log(`[Redis] Published MESSAGE_PINNED event for message ${messageId}`);

  return true;
}

export async function unpinMessage(roomId: string): Promise<boolean> {
  console.log(`[Redis] Attempting to unpin message in room ${roomId}`);
  
  // Get the pinned message
  const pinnedMessage = await getPinnedMessage(roomId)
  if (!pinnedMessage) {
    console.log(`[Redis] No pinned message found in room ${roomId}`);
    return false;
  }

  console.log(`[Redis] Found pinned message: ${pinnedMessage.id} by ${pinnedMessage.userName}`);

  // Remove the pinned message
  await redis.del(`${MESSAGE_PREFIX}${roomId}:pinned`);
  console.log(`[Redis] Removed pinned message from room ${roomId}`);

  // Update the message in the list to be unpinned
  const allMessages = await getMessages(roomId, 500);
  const messageIndex = allMessages.findIndex((msg) => msg.id === pinnedMessage.id);

  if (messageIndex !== -1) {
    pinnedMessage.isPinned = false;
    await redis.lset(`${MESSAGE_PREFIX}${roomId}`, messageIndex, JSON.stringify(pinnedMessage));
    console.log(`[Redis] Updated message ${pinnedMessage.id} in message list at position ${messageIndex}`);
  }

  // Clear the message cache to ensure fresh data is retrieved
  messageCache.delete(`${roomId}:messages:50`);
  messageCache.delete(`${roomId}:pinned`);
  
  // Publish update for real-time sync
  await publishUpdate("MESSAGE_UNPINNED", { roomId, messageId: pinnedMessage.id });
  console.log(`[Redis] Published MESSAGE_UNPINNED event for message ${pinnedMessage.id}`);

  return true;
}

export async function deleteMessage(roomId: string, messageId: string): Promise<boolean> {
  // Get all messages
  const allMessages = await getMessages(roomId, 500)

  // Find the message to delete
  const messageIndex = allMessages.findIndex((msg) => msg.id === messageId)
  if (messageIndex === -1) return false

  // Mark the message as deleted
  const messageToDelete = allMessages[messageIndex]
  messageToDelete.isDeleted = true
  messageToDelete.content = "[Message deleted]"

  // Update the message in the list
  await redis.lset(`${MESSAGE_PREFIX}${roomId}`, messageIndex, JSON.stringify(messageToDelete))

  // If the message was pinned, unpin it
  const pinnedMessage = await getPinnedMessage(roomId)
  if (pinnedMessage && pinnedMessage.id === messageId) {
    await unpinMessage(roomId)
  }

  return true
}

// Muted users functions
export async function muteUser(
  roomId: string,
  userId: string,
  mutedBy: string,
  durationMinutes = 10,
): Promise<MutedUser> {
  const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()

  const mutedUser: MutedUser = {
    userId,
    roomId,
    mutedUntil,
    mutedBy,
  }

  await redis.set(`${MUTED_PREFIX}${roomId}:${userId}`, JSON.stringify(mutedUser), {
    ex: durationMinutes * 60, // Auto-expire after the mute duration
  })

  return mutedUser
}

export async function unmuteUser(roomId: string, userId: string): Promise<boolean> {
  const result = await redis.del(`${MUTED_PREFIX}${roomId}:${userId}`)
  return result === 1
}

export async function isUserMuted(roomId: string, userId: string): Promise<boolean> {
  const mutedUser = await redis.get(`${MUTED_PREFIX}${roomId}:${userId}`)
  if (!mutedUser) return false

  const { mutedUntil } = JSON.parse(mutedUser as string)
  return new Date(mutedUntil) > new Date()
}

export async function getMutedUsers(roomId: string): Promise<MutedUser[]> {
  const keys = await redis.keys(`${MUTED_PREFIX}${roomId}:*`)
  if (keys.length === 0) return []

  const mutedUsers = await Promise.all(
    keys.map(async (key) => {
      const data = await redis.get(key)
      return data ? JSON.parse(data as string) : null
    }),
  )

  return mutedUsers.filter(Boolean) as MutedUser[]
}

// Participants functions
// Optimized participants functions with batched operations
export async function addParticipant(roomId: string, participant: ChatParticipant): Promise<void> {
  return safeRedisOperation(async () => {
    await redis.hset(`${PARTICIPANTS_PREFIX}${roomId}`, { [participant.userId]: JSON.stringify(participant) })
    participantCache.delete(roomId)
  }, "Failed to add participant")
}

export async function removeParticipant(roomId: string, userId: string): Promise<void> {
  await redis.hdel(`${PARTICIPANTS_PREFIX}${roomId}`, userId)
}

export async function getParticipants(roomId: string): Promise<ChatParticipant[]> {
  return safeRedisOperation(async () => {
    return getFromCacheOrFetch<ChatParticipant[]>(participantCache, roomId, async () => {
      const participants = await redis.hgetall(`${PARTICIPANTS_PREFIX}${roomId}`)
      // Handle the null case by providing an empty object as fallback
      return Object.values(participants || {}).map((p) => JSON.parse(p as string))
    })
  }, "Failed to get participants")
}

export async function updateParticipantStatus(roomId: string, userId: string, isOnline: boolean): Promise<void> {
  return safeRedisOperation(async () => {
    const participantData = await redis.hget(`${PARTICIPANTS_PREFIX}${roomId}`, userId)
    if (!participantData) return

    const participant = JSON.parse(participantData as string)
    participant.isOnline = isOnline
    participant.lastActive = new Date().toISOString()

    await redis.hset(`${PARTICIPANTS_PREFIX}${roomId}`, { [userId]: JSON.stringify(participant) })
    participantCache.delete(roomId)
  }, "Failed to update participant status")
}



export async function getPoll(roomId: string, pollId: string): Promise<Poll | null> {
  const pollData = await redis.get(`${POLL_PREFIX}${roomId}:${pollId}`)
  return pollData ? JSON.parse(pollData as string) : null
}

// Modify updatePoll to publish updates
export async function updatePoll(roomId: string, poll: Poll): Promise<void> {
  await redis.set(`${POLL_PREFIX}${roomId}:${poll.id}`, JSON.stringify(poll))
  await publishUpdate("POLL_UPDATED", { roomId, poll })
}

// Add user vote tracking to prevent duplicate votes
export async function recordUserVote(
  roomId: string,
  pollId: string,
  userId: string,
  optionId: string,
): Promise<boolean> {
  const key = `${POLL_PREFIX}${roomId}:${pollId}:votes:${userId}`
  const alreadyVoted = await redis.exists(key)

  if (alreadyVoted) {
    return false
  }

  await redis.set(key, optionId, { ex: 86400 }) // 24 hour expiry
  return true
}

// Modify votePoll function to prevent duplicate votes
export async function votePoll(roomId: string, pollId: string, userId: string, optionId: string): Promise<Poll | null> {
  const poll = await getPoll(roomId, pollId)
  if (!poll || poll.status !== "ACTIVE") return null

  const optionIndex = poll.options.findIndex((opt) => opt.id === optionId)
  if (optionIndex === -1) return null

  // Check if user already voted
  const canVote = await recordUserVote(roomId, pollId, userId, optionId)
  if (!canVote) return poll

  poll.options[optionIndex].votes += 1
  await updatePoll(roomId, poll)
  return poll
}

// Add function to get user's vote for a poll
export async function getUserVote(roomId: string, pollId: string, userId: string): Promise<string | null> {
  const key = `${POLL_PREFIX}${roomId}:${pollId}:votes:${userId}`
  const vote = await redis.get(key)
  return vote as string | null
}

// Add function to get all votes for a poll
export async function getPollVotes(roomId: string, pollId: string): Promise<Record<string, string>> {
  const keys = await redis.keys(`${POLL_PREFIX}${roomId}:${pollId}:votes:*`)
  if (keys.length === 0) return {}

  const votes: Record<string, string> = {}

  for (const key of keys) {
    const userId = key.split(":").pop() || ""
    const optionId = await redis.get(key)
    if (optionId) {
      votes[userId] = optionId as string
    }
  }

  return votes
}



// Modify closePoll to publish updates
export async function closePoll(roomId: string, pollId: string): Promise<Poll | null> {
  const poll = await getPoll(roomId, pollId)
  if (!poll) return null

  poll.status = PollStatus.ENDED
  await updatePoll(roomId, poll)
  await publishUpdate("POLL_CLOSED", { roomId, poll })
  return poll
}

// Rate limiting functions
// Enhanced rate limiting with exponential backoff
export async function checkRateLimit(
  roomId: string,
  userId: string,
  maxMessages = 5,
  windowSeconds = 10,
): Promise<boolean> {
  return safeRedisOperation(async () => {
    const key = `${RATE_LIMIT_PREFIX}${roomId}:${userId}`
    const count = await redis.incr(key)

    // Set expiry on first increment
    if (count === 1) {
      await redis.expire(key, windowSeconds)
    }

    // If user is exceeding rate limit, increase the window exponentially
    if (count > maxMessages) {
      const currentTTL = await redis.ttl(key)
      if (currentTTL > 0) {
        // Double the window time for repeat offenders
        await redis.expire(key, currentTTL * 2)
      }
      return false
    }

    return true
  }, "Failed to check rate limit")
}

// Clean up functions
export async function cleanupChatRoom(roomId: string): Promise<void> {
  // Delete all data related to this room
  const keys = await redis.keys(`*${roomId}*`)
  if (keys.length > 0) {
    await Promise.all(keys.map((key) => redis.del(key)))
  }
}

// Add a function to get active chat rooms for a user
export async function getActiveChatRoomsForUser(userId: string): Promise<string[]> {
  return safeRedisOperation(async () => {
    // Get all participant keys
    const keys = await redis.keys(`${PARTICIPANTS_PREFIX}*`)

    // Check each room for the user
    const activeRooms: string[] = []

    for (const key of keys) {
      const roomId = key.replace(PARTICIPANTS_PREFIX, "")
      const isParticipant = await redis.hexists(key, userId)

      if (isParticipant) {
        // Check if room is active
        const room = await getChatRoom(roomId)
        if (room && room.isActive) {
          activeRooms.push(roomId)
        }
      }
    }

    return activeRooms
  }, "Failed to get active chat rooms for user")
}

// Add a function to get chat statistics
export async function getChatStatistics(roomId: string): Promise<{
  messageCount: number
  participantCount: number
  activeParticipantCount: number
}> {
  return safeRedisOperation(async () => {
    const pipeline = redis.pipeline();

    // Get message count
    pipeline.llen(`${MESSAGE_PREFIX}${roomId}`);

    // Get participants
    pipeline.hgetall(`${PARTICIPANTS_PREFIX}${roomId}`);

    const results = await pipeline.exec();

    if (!results || results.length !== 2) {
      throw new Error("Failed to get chat statistics");
    }

    // Safely cast the pipeline results with proper type checking
    const messageCount = Array.isArray(results[0]) && results[0].length > 1 ? 
      (typeof results[0][1] === 'number' ? results[0][1] : Number(results[0][1]) || 0) : 
      0;
    
    // Handle the participants data with proper type checking
    const participantsResult = Array.isArray(results[1]) && results[1].length > 1 
      ? results[1][1] 
      : null;
    const participantsData = typeof participantsResult === 'object' && participantsResult !== null 
      ? (participantsResult as Record<string, string>) 
      : {};
    const participants = Object.values(participantsData).map(p => {
      try {
        return JSON.parse(p);
      } catch (error) {
        console.error("Error parsing participant data:", error);
        return {};
      }
    });
    
    const activeParticipantCount = participants.filter((p) => p.isOnline).length;

    return {
      messageCount,
      participantCount: participants.length,
      activeParticipantCount,
    };
  }, "Failed to get chat statistics");
}

// Add a function to clean up old chat data (for maintenance)
export async function cleanupOldChatData(olderThanDays = 30): Promise<number> {
  return safeRedisOperation(async () => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    // Get all room keys
    const roomKeys = await redis.keys(`${ROOM_PREFIX}*`)
    let deletedCount = 0

    for (const key of roomKeys) {
      const roomData = await redis.get(key)
      if (!roomData) continue

      const room = JSON.parse(roomData as string) as ChatRoom
      const roomDate = new Date(room.createdAt)

      if (roomDate < cutoffDate) {
        // This room is older than the cutoff, clean it up
        const roomId = room.id

        const pipeline = redis.pipeline()
        pipeline.del(key) // Delete room
        pipeline.del(`${MESSAGE_PREFIX}${roomId}`) // Delete messages
        pipeline.del(`${MESSAGE_PREFIX}${roomId}:pinned`) // Delete pinned message
        pipeline.del(`${PARTICIPANTS_PREFIX}${roomId}`) // Delete participants

        // Delete polls
        const pollKeys = await redis.keys(`${POLL_PREFIX}${roomId}:*`)
        for (const pollKey of pollKeys) {
          pipeline.del(pollKey)
        }

        // Delete muted users
        const mutedKeys = await redis.keys(`${MUTED_PREFIX}${roomId}:*`)
        for (const mutedKey of mutedKeys) {
          pipeline.del(mutedKey)
        }

        await pipeline.exec()
        deletedCount++

        // Invalidate caches
        invalidateCache(roomId)
      }
    }

    return deletedCount
  }, "Failed to clean up old chat data")
}



// Poll cleanup function
export async function cleanupOldPolls(olderThanMinutes = 5): Promise<number> {
  return safeRedisOperation(async () => {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString()
    let deletedCount = 0

    // Get all poll keys
    const pollKeys = await redis.keys(`${POLL_PREFIX}*`)

    for (const key of pollKeys) {
      const pollData = await redis.get(key)
      if (!pollData) continue

      try {
        const poll = JSON.parse(pollData as string)

        // Delete polls older than cutoff time
        if (new Date(poll.createdAt) < new Date(cutoffTime)) {
          await redis.del(key)
          deletedCount++
        }
      } catch (error) {
        console.error("Error parsing poll:", error)
      }
    }

    return deletedCount
  }, "Failed to cleanup old polls")
}



// Function to retrieve user session
export async function getUserSession(sessionId: string): Promise<any> {
  return safeRedisOperation(async () => {
    const sessionData = await redis.get(`chat:session:${sessionId}`)
    if (!sessionData) return null

    const session = JSON.parse(sessionData as string)

    // Update last active time
    await redis.set(
      `chat:session:${sessionId}`,
      JSON.stringify({
        ...session,
        lastActive: new Date().toISOString(),
      }),
      {
        ex: 60 * 60 * 24, // 24 hours
      }
    )

    return session
  }, "Failed to get user session")
}

// Function to get user's session ID
export async function getUserSessionId(userId: string): Promise<string | null> {
  return safeRedisOperation(async () => {
    const sessionId = await redis.get(`chat:user:${userId}:session`)
    return sessionId as string | null
  }, "Failed to get user session ID")
}

// Function to check if a lecture is live
export async function isLectureLive(lectureId: string): Promise<boolean> {
  return safeRedisOperation(async () => {
    const isLive = await redis.get(`lecture:${lectureId}:live`)
    return !!isLive
  }, "Failed to check if lecture is live")
}

// Function to set lecture live status
export async function setLectureLiveStatus(lectureId: string, isLive: boolean): Promise<void> {
  return safeRedisOperation(async () => {
    if (isLive) {
      await redis.set(`lecture:${lectureId}:live`, "true", {
        ex: 60 * 60 * 3, // 3 hours max live time
      })
    } else {
      await redis.del(`lecture:${lectureId}:live`)
    }
  }, "Failed to set lecture live status")
}

// Add pub/sub functionality for real-time updates
const PUBSUB_CHANNEL = "chat-updates"

// export async function publishUpdate(type: string, payload: any): Promise<void> {
//   await redis.publish(
//     PUBSUB_CHANNEL,
//     JSON.stringify({
//       type,
//       payload,
//       timestamp: new Date().toISOString(),
//     })
//   )
// }

export async function publishUpdate<T extends { roomId: string }>(
  event: string,
  data: T
): Promise<void> {
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  await redis.publish(`${CHANNEL_PREFIX}${data.roomId}`, payload);
}

// Enhanced message functions with proper type handling
export async function saveMessage(message: ChatMessage): Promise<void> {
  return safeRedisOperation(async () => {
    const { roomId } = message;
    const messageKey = `${MESSAGE_PREFIX}${roomId}`;
    const messageStr = JSON.stringify(message);

    // Use pipeline to reduce network roundtrips
    const pipeline = redis.pipeline();

    // Save message to the list of messages for the room
    pipeline.lpush(messageKey, messageStr);

    // If message is pinned, save it separately
    if (message.isPinned) {
      pipeline.set(`${messageKey}:pinned`, messageStr);
    }

    // Trim the message list to keep only the last 500 messages
    pipeline.ltrim(messageKey, 0, 499);

    // Set expiry for messages (30 minutes)
    pipeline.expire(messageKey, 30 * 60);

    await pipeline.exec();

    // Update room's last activity timestamp
    await redis.hset(`${ROOM_PREFIX}${roomId}`, { "lastActivity": new Date().toISOString() });

    // Publish update for real-time sync
    await publishUpdate("NEW_MESSAGE", message);
  }, "Failed to save message")
}

// Get messages with proper sorting and formatting
export async function getMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
  return safeRedisOperation(async () => {
    const cacheKey = `${roomId}:messages:${limit}`;
    
    return getFromCacheOrFetch<ChatMessage[]>(
      messageCache,
      cacheKey,
      async () => {
        const messagesRaw = await redis.lrange(`${MESSAGE_PREFIX}${roomId}`, 0, limit - 1);
        
        if (!messagesRaw || messagesRaw.length === 0) {
          return [];
        }
        
        // Parse messages and handle potential JSON parsing errors
        const messages: ChatMessage[] = [];
        for (const msgRaw of messagesRaw) {
          try {
            const msg = JSON.parse(msgRaw as string) as ChatMessage;
            messages.push(msg);
          } catch (error) {
            console.error("Failed to parse message:", error);
            // Skip invalid messages
          }
        }
        
        // Sort messages by timestamp (newest first in Redis, oldest first for display)
        return messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      },
      5000 // 5 seconds cache for messages
    );
  }, "Failed to get messages")
}

// Create or update a poll with proper validation and expiration
export async function createPoll(roomId: string, poll: Poll): Promise<void> {
  return safeRedisOperation(async () => {
    // Ensure the poll has the required fields
    const completePool: Poll = {
      ...poll,
      roomId,
      createdAt: poll.createdAt || new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes expiration
    };

    const pollKey = `${POLL_PREFIX}${roomId}:${poll.id}`;
    
    // Save the poll with an expiration of 5 minutes
    await redis.set(
      pollKey, 
      JSON.stringify(completePool), 
      { ex: 5 * 60 } // 5 minutes TTL
    );

    // Add to active polls list if active
    if (poll.status === "ACTIVE") {
      await safeSadd(`${POLL_PREFIX}${roomId}:active`, poll.id);
    }
    
    // Publish poll creation event
    await publishUpdate("POLL_CREATED", { roomId, poll: completePool });
  }, "Failed to create/update poll")
}

// Get active polls with proper validation
export async function getActivePolls(roomId: string): Promise<Poll[]> {
  return safeRedisOperation(async () => {
    const pollIds = await redis.smembers(`${POLL_PREFIX}${roomId}:active`);
    if (!pollIds.length) return [];

    const polls: Poll[] = [];
    for (const pollId of pollIds) {
      const pollData = await redis.get(`${POLL_PREFIX}${roomId}:${pollId}`);
      if (pollData) {
        try {
          const poll = JSON.parse(pollData as string) as Poll;
          if (poll.status === 'ACTIVE') {
            polls.push(poll);
          }
        } catch (error) {
          console.error('Error parsing poll data:', error);
        }
      }
    }
    return polls;
  }, "Failed to get active polls");
}

// Add user vote with proper validation and duplicate prevention
export async function addUserVote(roomId: string, pollId: string, userId: string, choice: number): Promise<void> {
  return safeRedisOperation(async () => {
    const key = `${POLL_PREFIX}${roomId}:${pollId}:votes`;
    const userVoteKey = `${key}:${userId}`;
    
    // Check if user has already voted
    const existingVote = await redis.exists(userVoteKey);
    if (existingVote) {
      throw new Error("User has already voted");
    }
    
    // Record user's vote
    const pipeline = redis.pipeline();
    pipeline.hincrby(key, choice.toString(), 1);
    pipeline.set(userVoteKey, choice.toString(), { ex: 60 * 60 }); // 1 hour expiry for vote tracking
    await pipeline.exec();
    
    // Get the updated poll to publish
    const poll = await getPoll(roomId, pollId);
    if (poll) {
      await publishUpdate("POLL_UPDATED", { roomId, poll });
    }
  }, "Failed to add user vote")
}

// Cleanup old messages with proper performance optimization
export async function cleanupOldMessages(olderThanMinutes = 30): Promise<number> {
  return safeRedisOperation(async () => {
    const now = Date.now();
    const cutoff = now - olderThanMinutes * 60 * 1000;
    let totalDeleted = 0;

    const roomKeys = await redis.keys(`${ROOM_PREFIX}*`);
    
    for (const roomKey of roomKeys) {
      const roomId = roomKey.replace(ROOM_PREFIX, '');
      const messages = await getMessages(roomId, 1000);
      
      // Get the pinned message so we don't delete it
      const pinnedMessageKey = `${MESSAGE_PREFIX}${roomId}:pinned`;
      const pinnedMessageData = await redis.get(pinnedMessageKey);
      let pinnedMessageId = null;
      
      if (pinnedMessageData) {
        try {
          const pinnedMessage = typeof pinnedMessageData === 'object' 
            ? pinnedMessageData as unknown as ChatMessage 
            : JSON.parse(pinnedMessageData as string) as ChatMessage;
          
          pinnedMessageId = pinnedMessage.id;
          console.log(`[Redis] Found pinned message ${pinnedMessageId} for room ${roomId}, will preserve it`);
        } catch (error) {
          console.error(`[Redis] Error parsing pinned message for room ${roomId}:`, error);
        }
      }
      
      // Filter out messages that are too old AND not pinned
      const oldMessages = messages.filter(msg => 
        new Date(msg.createdAt).getTime() < cutoff && msg.id !== pinnedMessageId && !msg.isPinned
      );

      if (oldMessages.length > 0) {
        const pipeline = redis.pipeline();
        for (const msg of oldMessages) {
          pipeline.lrem(`${MESSAGE_PREFIX}${roomId}`, 0, JSON.stringify(msg));
          totalDeleted++;
        }
        await pipeline.exec();
      }
    }
    
    console.log(`Cleaned up ${totalDeleted} old messages (excluding pinned messages)`);
    return totalDeleted;
  }, "Failed to cleanup old messages");
}

// Store user session for persistence with proper TTL
export async function storeUserSession(userId: string, sessionId: string, data: any): Promise<void> {
  return safeRedisOperation(async () => {
    const sessionData = {
      userId,
      data,
      lastActive: new Date().toISOString(),
    };
    
    // Store session with TTL (24 hours)
    await redis.set(
      `chat:session:${sessionId}`, 
      JSON.stringify(sessionData),
      { ex: 60 * 60 * 24 }
    );
    
    // Link user to session
    await redis.set(
      `chat:user:${userId}:session`, 
      sessionId,
      { ex: 60 * 60 * 24 }
    );
  }, "Failed to store user session");
}

// Enhanced cleanup jobs
export async function setupCleanupJobs(): Promise<void> {
  // Run message cleanup every 5 minutes
  setInterval(async () => {
    try {
      const deletedMessages = await cleanupOldMessages(30); // 30 minutes
      console.log(`Cleanup job: Deleted ${deletedMessages} old messages`);
    } catch (error) {
      console.error("Error in message cleanup job:", error);
    }
  }, 5 * 60 * 1000);
  
  // Run poll cleanup every 5 minutes
  setInterval(async () => {
    try {
      const deletedPolls = await cleanupOldPolls(5); // 5 minutes
      console.log(`Cleanup job: Deleted ${deletedPolls} old polls`);
    } catch (error) {
      console.error("Error in poll cleanup job:", error);
    }
  }, 5 * 60 * 1000);
  
  console.log("Cleanup jobs scheduled");
}

// Function to toggle chat visibility (visible to students)
export async function toggleChatVisibility(roomId: string, isVisible: boolean): Promise<ChatRoom | null> {
  return safeRedisOperation(async () => {
    console.log(`[Redis] Toggling chat visibility for room ${roomId} to ${isVisible}`);
    
    const room = await getChatRoom(roomId)
    if (!room) {
      console.log(`[Redis] Room ${roomId} not found when toggling visibility`);
      return null;
    }

    console.log(`[Redis] Current room state before visibility change:`, JSON.stringify(room));
    
    const updatedRoom: ChatRoom = {
      ...room,
      isChatVisible: isVisible,
      lastActivity: new Date().toISOString(),
    }

    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(updatedRoom))
    roomCache.set(roomId, { data: updatedRoom, timestamp: Date.now() })
    
    console.log(`[Redis] Updated room state after visibility change:`, JSON.stringify(updatedRoom));
    
    // Publish update for real-time sync
    await publishUpdate("CHAT_VISIBILITY_UPDATED", {
      roomId,
      isChatVisible: isVisible,
      timestamp: new Date().toISOString(),
    })
    
    return updatedRoom
  }, "Failed to toggle chat visibility")
}

// Function to check if lecture chat is visible
export async function isLectureChatVisible(lectureId: string): Promise<boolean> {
  return safeRedisOperation(async () => {
    const room = await getChatRoom(lectureId)
    console.log(`[Redis] Checking if lecture ${lectureId} chat is visible:`, room?.isChatVisible === true);
    return room?.isChatVisible === true
  }, "Failed to check lecture chat visibility")
}

// Add a function to directly set pinnedMessage in the client
export async function forcePinMessage(roomId: string, message: ChatMessage): Promise<boolean> {
  try {
    console.log(`[Redis] Force pinning message ${message.id} in room ${roomId}`);
    
    // Ensure the message is marked as pinned
    const messageToPin = {
      ...message,
      isPinned: true
    };
    
    // Save the pinned message
    await redis.set(`${MESSAGE_PREFIX}${roomId}:pinned`, JSON.stringify(messageToPin));
    
    // Update the message in the messages list if it exists
    const allMessages = await getMessages(roomId, 500);
    const messageIndex = allMessages.findIndex((msg) => msg.id === message.id);
    
    if (messageIndex !== -1) {
      await redis.lset(`${MESSAGE_PREFIX}${roomId}`, messageIndex, JSON.stringify(messageToPin));
      console.log(`[Redis] Updated message ${message.id} in message list at position ${messageIndex}`);
    }
    
    // Clear the message cache
    messageCache.delete(`${roomId}:messages:50`);
    messageCache.delete(`${roomId}:messages:100`);
    messageCache.delete(`${roomId}:messages:500`);
    messageCache.delete(`${roomId}:pinned`);
    
    // Publish an update about the pinned message
    await publishUpdate("MESSAGE_PINNED", { roomId, message: messageToPin });
    
    console.log(`[Redis] Successfully force-pinned message ${message.id}`);
    return true;
  } catch (error) {
    console.error(`[Redis] Error in forcePinMessage:`, error);
    return false;
  }
}

export async function saveBatchMessages(roomId: string, messages: ChatMessage[]): Promise<ChatMessage[]> {
  try {
    if (!roomId || !Array.isArray(messages) || messages.length === 0) {
      console.error("[Redis-Chat] Invalid input for saveBatchMessages");
      return [];
    }
    
    // Update room activity
    await updateRoomActivity(roomId);
    
    // Sort messages by timestamp to ensure correct order
    const sortedMessages = [...messages].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });
    
    // Generate Redis pipeline commands
    const pipeline = redis.pipeline();
    const now = new Date().toISOString();
    
    // Process each message
    for (const message of sortedMessages) {
      // Ensure message has required fields
      if (!message.id) {
        message.id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      if (!message.createdAt) {
        message.createdAt = now;
      }
      
      const messageKey = `${MESSAGE_PREFIX}${roomId}:${message.id}`;
      
      // Add message to Redis hash
      pipeline.hset(messageKey, {
        id: message.id,
        roomId: roomId,
        userId: message.userId,
        userName: message.userName,
        userImage: message.userImage || "",
        userRole: message.userRole || "STUDENT",
        content: message.content,
        type: message.type || "TEXT",
        isPinned: message.isPinned || false,
        isDeleted: message.isDeleted || false,
        createdAt: message.createdAt
      });
      
      // Set message expiration
      pipeline.expire(messageKey, MESSAGE_EXPIRY_SECONDS);
      
      // Add message ID to room's message list with proper parameter format
      // Fix: Use object format for zadd parameters instead of array
      pipeline.zadd(ROOM_MESSAGES_PREFIX + roomId, {
        score: Date.now(),
        member: message.id
      });
    }
    
    // Set expiration for the room's message list
    pipeline.expire(`${ROOM_MESSAGES_PREFIX}${roomId}`, ROOM_EXPIRY_SECONDS);
    
    // Execute all Redis commands in a single operation
    await pipeline.exec();
    
    console.log(`[Redis-Chat] Successfully saved batch of ${sortedMessages.length} messages for room ${roomId}`);
    
    return sortedMessages;
  } catch (error) {
    console.error(`[Redis-Chat] Error saving batch messages for room ${roomId}:`, error);
    return [];
  }
}

/**
 * Update the last activity timestamp for a chat room
 * This helps track active rooms and allows for proper cleanup of inactive ones
 * @param roomId The ID of the room to update
 */
export async function updateRoomActivity(roomId: string): Promise<void> {
  try {
    const room = await getChatRoom(roomId);
    if (!room) {
      console.error(`[Redis-Chat] Attempted to update activity for non-existent room ${roomId}`);
      return;
    }
    
    // Update the room's last activity timestamp
    const updatedRoom = {
      ...room,
      lastActivity: new Date().toISOString()
    };
    
    // Save the updated room data
    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(updatedRoom));
    
    // Update the cache to avoid refetching
    roomCache.set(roomId, { data: updatedRoom, timestamp: Date.now() });
    
    // Set/refresh expiration for room data
    await redis.expire(`${ROOM_PREFIX}${roomId}`, ROOM_EXPIRY_SECONDS);
    
    // Also update expiration for associated message lists
    await redis.expire(`${ROOM_MESSAGES_PREFIX}${roomId}`, ROOM_EXPIRY_SECONDS);
    
    console.log(`[Redis-Chat] Updated activity timestamp for room ${roomId}`);
  } catch (error) {
    console.error(`[Redis-Chat] Error updating room activity for ${roomId}:`, error);
  }
}

// Function to clean up old sessions
export async function cleanupSessions(olderThanMinutes = 60): Promise<number> {
  return safeRedisOperation(async () => {
    const now = Date.now();
    const cutoff = now - olderThanMinutes * 60 * 1000;
    let deletedCount = 0;

    // Get all session keys
    const sessionKeys = await redis.keys(`${USER_SESSION_PREFIX}*`);
    const pipeline = redis.pipeline();
    
    for (const key of sessionKeys) {
      const sessionData = await redis.get(key);
      if (!sessionData) continue;
      
      try {
        const session = JSON.parse(sessionData as string);
        const lastActiveTime = new Date(session.lastActive).getTime();
        
        // Delete sessions that haven't been active since the cutoff time
        if (lastActiveTime < cutoff) {
          pipeline.del(key);
          
          // Also remove the user-to-session mapping if it exists
          if (session.userId) {
            pipeline.del(`chat:user:${session.userId}:session`);
          }
          
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error parsing session data for key ${key}:`, error);
      }
    }
    
    // Execute all deletions in batch if there are any
    if (deletedCount > 0) {
      await pipeline.exec();
    }
    
    console.log(`[Redis-Chat] Cleaned up ${deletedCount} old chat sessions (older than ${olderThanMinutes} minutes)`);
    return deletedCount;
  }, "Failed to clean up old sessions");
}
