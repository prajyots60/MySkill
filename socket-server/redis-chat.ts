import type { 
  ChatRoom, 
  ChatRoomSettings, 
  ChatParticipant,
  Poll,
  ChatMessage
} from "../lib/types"
import { PollStatus } from "../lib/types"
import { Server } from "socket.io"
import { Redis } from "@upstash/redis"
import * as dotenv from "dotenv"
import path from "path"

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") })

// Create a separate Redis client for chat functionality
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_CHAT_REST_URL || "",
  token: process.env.UPSTASH_REDIS_CHAT_REST_TOKEN || "",
})

// Key prefixes for different data types
const ROOM_PREFIX = "chat:room:"
const MESSAGE_PREFIX = "chat:messages:"
const PARTICIPANTS_PREFIX = "chat:participants:"
const POLL_PREFIX = "chat:poll:"
const RATE_LIMIT_PREFIX = "chat:ratelimit:"
const SESSION_PREFIX = "chat:session:"
const USER_SESSION_PREFIX = "chat:user:"

// Expiration times in seconds
const ROOM_EXPIRY_SECONDS = 4 * 60 * 60; // 4 hours

// Helper function for safe Redis operations
async function safeRedisOperation<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(errorMessage, error)
    throw error
  }
}

// Helper function to update room's last activity timestamp
export async function updateRoomActivity(roomId: string): Promise<boolean> {
  try {
    const roomKey = `${ROOM_PREFIX}${roomId}`;
    const now = new Date().toISOString();
    
    // Check if room exists
    const roomExists = await redis.exists(roomKey);
    
    if (roomExists) {
      // Update the existing room's lastActivity field
      await redis.hset(roomKey, { "lastActivity": now });
    } else {
      // Create a new room with minimal data
      await redis.hset(roomKey, {
        id: roomId,
        isActive: true,
        createdAt: now,
        lastActivity: now
      });
    }
    
    // Set expiration for room data
    await redis.expire(roomKey, ROOM_EXPIRY_SECONDS);
    
    return true;
  } catch (error) {
    console.error(`[Redis-Chat] Error updating room activity for ${roomId}:`, error);
    return false;
  }
}

// Chat room functions
export async function createChatRoom(lectureId: string, settings: ChatRoomSettings): Promise<ChatRoom> {
  return safeRedisOperation(async () => {
    const roomId = `${lectureId}`
    const room: ChatRoom = {
      id: roomId,
      lectureId,
      isActive: true,
      createdAt: new Date().toISOString(),
      settings,
      lastActivity: new Date().toISOString(),
    }

    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(room))
    return room
  }, "Failed to create chat room")
}

export async function getChatRoom(roomId: string, forceRefresh: boolean = false): Promise<ChatRoom | null> {
  return safeRedisOperation(async () => {
    // Create a default room as fallback with isActive set to true
    const defaultRoom: ChatRoom = {
      id: roomId,
      lectureId: roomId,
      isActive: true, // Always set to active
      createdAt: new Date().toISOString(),
      settings: {
        isModerated: true,
        allowPolls: true,
        slowMode: false,
        slowModeInterval: 5,
        allowLinks: true,
        allowImages: false,
        allowReplies: true,
        maxMessageLength: 500,
        chatEnabled: true
      },
      lastActivity: new Date().toISOString(),
    }
    
    // If forceRefresh is true, we'll bypass any caching mechanism
    if (forceRefresh) {
      console.log(`[Redis-Server] Force refreshing room data for ${roomId}`);
    }
    
    try {
      // Try to delete the problematic key first to avoid WRONGTYPE errors
      await redis.del(`${ROOM_PREFIX}${roomId}`)
      
      // Store the default room
      await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(defaultRoom))
      
      return defaultRoom
    } catch (error) {
      console.error("Error handling chat room:", error)
      return defaultRoom
    }
  }, "Failed to get chat room")
}

export async function toggleChatRoom(roomId: string, isActive: boolean): Promise<ChatRoom | null> {
  return safeRedisOperation(async () => {
    console.log(`[Redis-Server] Toggling chat room ${roomId} to isActive=${isActive}`);
    
    // Get the room (remove the forceRefresh parameter as it's not supported in this implementation)
    const room = await getChatRoom(roomId);
    if (!room) {
      console.log(`[Redis-Server] Room ${roomId} not found when toggling isActive`);
      return null;
    }

    // Create updated room with new isActive status and sync with chatEnabled setting
    const updatedRoom: ChatRoom = {
      ...room,
      isActive,
      settings: {
        ...room.settings,
        chatEnabled: isActive, // Keep these in sync
      },
      lastActivity: new Date().toISOString(),
    };

    console.log(`[Redis-Server] Saving room ${roomId} with isActive=${isActive}, chatEnabled=${updatedRoom.settings.chatEnabled}`);
    
    // Persist to Redis with proper key
    await redis.set(`${ROOM_PREFIX}${roomId}`, JSON.stringify(updatedRoom));
    
    return updatedRoom;
  }, "Failed to toggle chat room");
}

// Message functions with optimized Redis operations
export async function saveMessage(message: ChatMessage): Promise<void> {
  return safeRedisOperation(async () => {
    const { roomId } = message;
    const messageKey = `${MESSAGE_PREFIX}${roomId}`;
    const messageStr = JSON.stringify(message);

    try {
      // First, check if the key exists and delete it if it's not a list
      const keyType = await redis.type(messageKey);
      if (keyType !== 'list' && keyType !== 'none') {
        console.log(`Deleting incompatible key ${messageKey} of type ${keyType}`);
        await redis.del(messageKey);
      }

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
      // First check if the room key exists and is a hash
      const roomKey = `${ROOM_PREFIX}${roomId}`;
      const roomKeyType = await redis.type(roomKey);
      
      if (roomKeyType === 'hash') {
        await redis.hset(roomKey, { "lastActivity": new Date().toISOString() });
      } else {
        // If it's not a hash, delete it and create a new room object
        if (roomKeyType !== 'none') {
          await redis.del(roomKey);
        }
        
        // Create a default room
        const defaultRoom: ChatRoom = {
          id: roomId,
          lectureId: roomId,
          isActive: true,
          createdAt: new Date().toISOString(),
          settings: {
            isModerated: true,
            allowPolls: true,
            slowMode: false,
            slowModeInterval: 5,
            allowLinks: true,
            allowImages: false,
            allowReplies: true,
            maxMessageLength: 500,
            chatEnabled: true
          },
          lastActivity: new Date().toISOString(),
        };
        
        await redis.set(roomKey, JSON.stringify(defaultRoom));
      }
    } catch (error) {
      console.error("Error in saveMessage:", error);
      throw error;
    }
  }, "Failed to save message");
}

export async function getMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
  return safeRedisOperation(async () => {
    try {
      // First, check if the key exists and is a list
      const messageKey = `${MESSAGE_PREFIX}${roomId}`;
      const keyType = await redis.type(messageKey);
      
      if (keyType !== 'list') {
        // If not a list, delete it to avoid WRONGTYPE errors
        if (keyType !== 'none') {
          console.log(`Deleting incompatible key ${messageKey} of type ${keyType}`);
          await redis.del(messageKey);
        }
        return [];
      }
      
      const messagesRaw = await redis.lrange(messageKey, 0, limit - 1);
      
      if (!messagesRaw || messagesRaw.length === 0) {
        return [];
      }
      
      // Parse messages and handle potential JSON parsing errors
      const messages: ChatMessage[] = [];
      for (const msgRaw of messagesRaw) {
        try {
          // Check if value is already an object
          if (typeof msgRaw === 'object' && msgRaw !== null) {
            messages.push(msgRaw as unknown as ChatMessage);
          } else {
            // Try to parse string value
            messages.push(JSON.parse(msgRaw as string) as ChatMessage);
          }
        } catch (error) {
          console.error("Failed to parse message:", error);
          console.error("Problematic value:", msgRaw);
          console.error("Type of value:", typeof msgRaw);
          // Skip invalid messages
        }
      }
      
      // Sort messages by timestamp (newest first in Redis, oldest first for display)
      return messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (error) {
      console.error("Error in getMessages:", error);
      return [];
    }
  }, "Failed to get messages");
}

// Participant functions
export async function addParticipant(roomId: string, participant: ChatParticipant): Promise<void> {
  return safeRedisOperation(async () => {
    const key = `${PARTICIPANTS_PREFIX}${roomId}`
    const field = participant.userId
    const value = JSON.stringify({
      ...participant,
      lastActive: new Date().toISOString(),
    })
    
    await redis.hset(key, { [field]: value })
  }, "Failed to add participant")
}

export async function getParticipants(roomId: string): Promise<ChatParticipant[]> {
  return safeRedisOperation(async () => {
    const participants = await redis.hgetall(`${PARTICIPANTS_PREFIX}${roomId}`)
    if (!participants) return []
    
    const result: ChatParticipant[] = [];
    for (const [_, value] of Object.entries(participants)) {
      try {
        // Check if value is already an object
        if (typeof value === 'object' && value !== null) {
          result.push(value as unknown as ChatParticipant);
        } else {
          // Try to parse string value
          result.push(JSON.parse(value as string) as ChatParticipant);
        }
      } catch (error) {
        console.error("Failed to parse participant:", error);
        console.error("Problematic value:", value);
        console.error("Type of value:", typeof value);
      }
    }
    return result;
  }, "Failed to get participants")
}

export async function updateParticipantStatus(roomId: string, userId: string, isOnline: boolean): Promise<void> {
  return safeRedisOperation(async () => {
    const key = `${PARTICIPANTS_PREFIX}${roomId}`
    const participantData = await redis.hget(key, userId)
    if (!participantData) return

    const participant = JSON.parse(participantData as string)
    const updatedParticipant = {
      ...participant,
      isOnline,
      lastActive: new Date().toISOString(),
    }

    await redis.hset(key, { [userId]: JSON.stringify(updatedParticipant) })
  }, "Failed to update participant status")
}

// Poll functions with proper validation
export async function createPoll(roomId: string, poll: Poll): Promise<void> {
  return safeRedisOperation(async () => {
    // Ensure the poll has the required fields
    const completePoll: Poll = {
      ...poll,
      roomId,
      createdAt: poll.createdAt || new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes expiration
    };

    const pollKey = `${POLL_PREFIX}${roomId}:${poll.id}`;
    
    // Save the poll with an expiration of 5 minutes
    await redis.set(
      pollKey, 
      JSON.stringify(completePoll), 
      { ex: 5 * 60 } // 5 minutes TTL
    );

    // Add to active polls list if active
    if (poll.status === PollStatus.ACTIVE) {
      await redis.sadd(`${POLL_PREFIX}${roomId}:active`, poll.id);
    }
  }, "Failed to create poll")
}

export async function getActivePolls(roomId: string): Promise<Poll[]> {
  return safeRedisOperation(async () => {
    try {
      const activePollsKey = `${POLL_PREFIX}${roomId}:active`;
      const keyType = await redis.type(activePollsKey);
      
      // If not a set, delete it to avoid WRONGTYPE errors
      if (keyType !== 'set' && keyType !== 'none') {
        console.log(`Deleting incompatible key ${activePollsKey} of type ${keyType}`);
        await redis.del(activePollsKey);
        return [];
      }
      
      const pollIds = await redis.smembers(activePollsKey);
      if (!pollIds || pollIds.length === 0) return [];

      const polls: Poll[] = [];
      for (const pollId of pollIds) {
        const pollData = await redis.get(`${POLL_PREFIX}${roomId}:${pollId}`);
        if (pollData) {
          try {
            // Check if value is already an object
            if (typeof pollData === 'object' && pollData !== null) {
              polls.push(pollData as unknown as Poll);
            } else {
              // Try to parse string value
              polls.push(JSON.parse(pollData as string) as Poll);
            }
          } catch (error) {
            console.error("Failed to parse poll:", error);
            console.error("Problematic value:", pollData);
            console.error("Type of value:", typeof pollData);
          }
        }
      }

      return polls;
    } catch (error) {
      console.error("Error in getActivePolls:", error);
      return [];
    }
  }, "Failed to get active polls");
}

export async function getPoll(roomId: string, pollId: string): Promise<Poll | null> {
  return safeRedisOperation(async () => {
    try {
      const pollKey = `${POLL_PREFIX}${roomId}:${pollId}`;
      const pollData = await redis.get(pollKey);
      if (!pollData) return null;

      try {
        // Check if value is already an object
        if (typeof pollData === 'object' && pollData !== null) {
          return pollData as unknown as Poll;
        } else {
          // Try to parse string value
          return JSON.parse(pollData as string) as Poll;
        }
      } catch (error) {
        console.error("Failed to parse poll:", error);
        console.error("Problematic value:", pollData);
        console.error("Type of value:", typeof pollData);
        return null;
      }
    } catch (error) {
      console.error("Error in getPoll:", error);
      return null;
    }
  }, "Failed to get poll");
}

export async function updatePoll(roomId: string, poll: Poll): Promise<void> {
  return safeRedisOperation(async () => {
    try {
      const pollKey = `${POLL_PREFIX}${roomId}:${poll.id}`;
      
      // Check if the key exists and delete it if it's not a string
      const keyType = await redis.type(pollKey);
      if (keyType !== 'string' && keyType !== 'none') {
        console.log(`Deleting incompatible key ${pollKey} of type ${keyType}`);
        await redis.del(pollKey);
      }
      
      // Save the updated poll
      await redis.set(
        pollKey,
        JSON.stringify(poll),
        {
          ex: 60 * 60 // 1 hour expiry
        }
      );
      
      // If poll is active, add to active polls set
      if (poll.status === PollStatus.ACTIVE) {
        const activePollsKey = `${POLL_PREFIX}${roomId}:active`;
        
        // Check if the active polls key exists and is a set
        const activeKeyType = await redis.type(activePollsKey);
        if (activeKeyType !== 'set' && activeKeyType !== 'none') {
          console.log(`Deleting incompatible active polls key ${activePollsKey} of type ${activeKeyType}`);
          await redis.del(activePollsKey);
        }
        
        // Add poll to active polls set
        await redis.sadd(activePollsKey, poll.id);
      } 
      // If poll is ended, remove from active polls set
      else if (poll.status === PollStatus.ENDED) {
        await redis.srem(`${POLL_PREFIX}${roomId}:active`, poll.id);
      }
      
      console.log(`Poll ${poll.id} updated with status ${poll.status}`);
    } catch (error) {
      console.error(`Error updating poll ${poll.id}:`, error);
      throw error;
    }
  }, "Failed to update poll");
}

export async function closePoll(roomId: string, pollId: string): Promise<void> {
  return safeRedisOperation(async () => {
    try {
      // First check if the poll exists
      const pollKey = `${POLL_PREFIX}${roomId}:${pollId}`;
      const pollExists = await redis.exists(pollKey);
      
      if (pollExists) {
        // Delete the poll
        await redis.del(pollKey);
        console.log(`Poll ${pollId} removed from Redis`);
        
        // Also remove from active polls list
        const activePollsKey = `${POLL_PREFIX}${roomId}:active`;
        await redis.srem(activePollsKey, pollId);
        console.log(`Poll ${pollId} removed from active polls list`);
        
        // Remove any vote records associated with this poll
        const voteKeys = await redis.keys(`${POLL_PREFIX}${roomId}:${pollId}:vote:*`);
        if (voteKeys && voteKeys.length > 0) {
          for (const voteKey of voteKeys) {
            await redis.del(voteKey);
          }
          console.log(`Removed ${voteKeys.length} vote records for poll ${pollId}`);
        }
        
        // Remove any other metadata related to this poll
        const metaKeys = await redis.keys(`${POLL_PREFIX}${roomId}:${pollId}:*`);
        if (metaKeys && metaKeys.length > 0) {
          for (const metaKey of metaKeys) {
            await redis.del(metaKey);
          }
          console.log(`Removed ${metaKeys.length} metadata records for poll ${pollId}`);
        }
      } else {
        console.log(`Poll ${pollId} not found in Redis`);
      }
    } catch (error) {
      console.error(`Error closing poll ${pollId}:`, error);
      throw error;
    }
  }, "Failed to close poll");
}

// Rate limiting with improved implementation for real-time chat
export async function checkRateLimit(
  roomId: string, 
  userId: string, 
  maxMessages = 5, 
  windowSeconds = 10
): Promise<boolean> {
  return safeRedisOperation(async () => {
    const key = `${RATE_LIMIT_PREFIX}${roomId}:${userId}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Get all messages in the time window
    const messages = await redis.lrange(key, 0, -1);
    const recentMessages = messages
      .filter(msg => parseInt(msg as string) > windowStart);

    // Add current message timestamp
    await redis.lpush(key, now.toString());
    await redis.expire(key, windowSeconds);

    return recentMessages.length < maxMessages;
  }, "Failed to check rate limit");
}

// Session persistence functions
export async function storeUserSession(userId: string, sessionId: string, data: any): Promise<void> {
  return safeRedisOperation(async () => {
    const sessionData = {
      userId,
      data,
      lastActive: new Date().toISOString(),
    };
    
    // Store session with TTL (24 hours)
    await redis.set(
      `${SESSION_PREFIX}${sessionId}`, 
      JSON.stringify(sessionData),
      { ex: 60 * 60 * 24 } // 24 hours
    );
    
    // Link user to session
    await redis.set(
      `${USER_SESSION_PREFIX}${userId}:session`, 
      sessionId,
      { ex: 60 * 60 * 24 } // 24 hours
    );
  }, "Failed to store user session");
}

export async function getUserSession(sessionId: string): Promise<any> {
  return safeRedisOperation(async () => {
    const data = await redis.get(`${SESSION_PREFIX}${sessionId}`);
    return data ? JSON.parse(data as string) : null;
  }, "Failed to get user session");
}

// Cleanup functions
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

export async function cleanupOldPolls(olderThanMinutes = 5): Promise<number> {
  return safeRedisOperation(async () => {
    const now = Date.now();
    const cutoff = now - olderThanMinutes * 60 * 1000;
    let totalDeleted = 0;

    const roomKeys = await redis.keys(`${ROOM_PREFIX}*`);
    
    for (const roomKey of roomKeys) {
      const roomId = roomKey.replace(ROOM_PREFIX, '');
      const activePolls = await getActivePolls(roomId);
      
      const oldPolls = activePolls.filter(poll => 
        new Date(poll.createdAt).getTime() < cutoff || poll.status === PollStatus.ENDED
      );

      if (oldPolls.length > 0) {
        const pipeline = redis.pipeline();
        for (const poll of oldPolls) {
          pipeline.del(`${POLL_PREFIX}${roomId}:${poll.id}`);
          pipeline.srem(`${POLL_PREFIX}${roomId}:active`, poll.id);
          totalDeleted++;
        }
        await pipeline.exec();
      }
    }
    
    console.log(`Cleaned up ${totalDeleted} old polls`);
    return totalDeleted;
  }, "Failed to cleanup old polls");
}

export async function cleanupInactiveRooms(olderThanHours = 24): Promise<number> {
  return safeRedisOperation(async () => {
    const now = Date.now();
    const cutoff = now - olderThanHours * 60 * 60 * 1000;
    let totalDeleted = 0;

    // Get all chat room keys
    const roomKeys = await redis.keys(`${ROOM_PREFIX}*`);
    console.log(`[Redis-Cleanup] Found ${roomKeys.length} chat rooms to check for inactivity`);
    
    // Process rooms in batches to avoid overwhelming Redis
    for (const roomKey of roomKeys) {
      try {
        const roomId = roomKey.replace(ROOM_PREFIX, '');
        const roomData = await redis.get(roomKey);
        
        if (!roomData) continue;
        
        let room: ChatRoom;
        try {
          // Parse the room data
          if (typeof roomData === 'object' && roomData !== null) {
            room = roomData as unknown as ChatRoom;
          } else {
            room = JSON.parse(roomData as string) as ChatRoom;
          }
          
          // Check if the room is inactive based on lastActivity timestamp
          const lastActivityTime = new Date(room.lastActivity).getTime();
          if (lastActivityTime < cutoff) {
            console.log(`[Redis-Cleanup] Room ${roomId} inactive since ${room.lastActivity}, cleaning up`);
            
            // Mark the room as inactive but don't delete it
            room.isActive = false;
            await redis.set(roomKey, JSON.stringify(room));
            
            // Optional: Don't delete the messages, but set a shorter expiry on them
            const messageKey = `${MESSAGE_PREFIX}${roomId}`;
            const messageKeyExists = await redis.exists(messageKey);
            
            if (messageKeyExists) {
              await redis.expire(messageKey, 24 * 60 * 60); // 24 hour expiry on messages
              console.log(`[Redis-Cleanup] Set 24h expiry on messages for inactive room ${roomId}`);
            }
            
            // Clean up participants for this room
            const participantsKey = `${PARTICIPANTS_PREFIX}${roomId}`;
            await redis.del(participantsKey);
            
            totalDeleted++;
          }
        } catch (error) {
          console.error(`[Redis-Cleanup] Error processing room ${roomId}:`, error);
        }
      } catch (error) {
        console.error(`[Redis-Cleanup] Error cleaning up room:`, error);
      }
    }
    
    console.log(`[Redis-Cleanup] Marked ${totalDeleted} inactive rooms`);
    return totalDeleted;
  }, "Failed to cleanup inactive rooms");
}

export async function cleanupSessions(olderThanHours = 24): Promise<number> {
  return safeRedisOperation(async () => {
    const now = Date.now();
    const cutoff = now - olderThanHours * 60 * 60 * 1000;
    let totalDeleted = 0;

    // Get all session keys
    const sessionKeys = await redis.keys(`${SESSION_PREFIX}*`);
    console.log(`[Redis-Cleanup] Found ${sessionKeys.length} sessions to check for expiry`);
    
    for (const sessionKey of sessionKeys) {
      try {
        const sessionData = await redis.get(sessionKey);
        if (!sessionData) continue;
        
        try {
          // Parse the session data
          const session = JSON.parse(sessionData as string);
          const lastActiveTime = new Date(session.lastActive).getTime();
          
          // Check if session is older than the cutoff
          if (lastActiveTime < cutoff) {
            console.log(`[Redis-Cleanup] Session ${sessionKey} inactive since ${session.lastActive}, removing`);
            
            // Delete the session
            await redis.del(sessionKey);
            
            // Also remove user session link if it exists
            if (session.userId) {
              await redis.del(`${USER_SESSION_PREFIX}${session.userId}:session`);
            }
            
            totalDeleted++;
          }
        } catch (parseError) {
          console.error(`[Redis-Cleanup] Error parsing session data:`, parseError);
          // Delete invalid sessions
          await redis.del(sessionKey);
          totalDeleted++;
        }
      } catch (error) {
        console.error(`[Redis-Cleanup] Error cleaning up session:`, error);
      }
    }
    
    console.log(`[Redis-Cleanup] Removed ${totalDeleted} expired sessions`);
    return totalDeleted;
  }, "Failed to cleanup sessions");
}

// Enhanced setupCleanupJobs function with additional cleanup tasks
export function setupCleanupJobs(io: Server): void {
  console.log("[Redis-Server] Setting up scheduled cleanup jobs...");
  
  // Run message cleanup every 5 minutes
  setInterval(async () => {
    try {
      const deletedMessages = await cleanupOldMessages(30); // 30 minutes
      console.log(`[Redis-Cleanup] Deleted ${deletedMessages} old messages`);
    } catch (error) {
      console.error("[Redis-Cleanup] Error in message cleanup job:", error);
    }
  }, 5 * 60 * 1000);
  
  // Run poll cleanup every 5 minutes
  setInterval(async () => {
    try {
      const deletedPolls = await cleanupOldPolls(5); // 5 minutes
      console.log(`[Redis-Cleanup] Deleted ${deletedPolls} old polls`);
      
      // Notify all rooms about poll cleanup
      if (deletedPolls > 0) {
        const rooms = await io.fetchSockets();
        for (const socket of rooms) {
          const roomId = socket.data.roomId;
          if (roomId) {
            socket.emit("polls-cleaned");
          }
        }
      }
    } catch (error) {
      console.error("[Redis-Cleanup] Error in poll cleanup job:", error);
    }
  }, 5 * 60 * 1000);
  
  // Run inactive room cleanup every 6 hours
  setInterval(async () => {
    try {
      const inactiveRooms = await cleanupInactiveRooms(24); // 24 hours
      console.log(`[Redis-Cleanup] Marked ${inactiveRooms} rooms as inactive`);
    } catch (error) {
      console.error("[Redis-Cleanup] Error in room cleanup job:", error);
    }
  }, 6 * 60 * 60 * 1000);
  
  // Run session cleanup every 12 hours
  setInterval(async () => {
    try {
      const expiredSessions = await cleanupSessions(24); // 24 hours
      console.log(`[Redis-Cleanup] Removed ${expiredSessions} expired sessions`);
    } catch (error) {
      console.error("[Redis-Cleanup] Error in session cleanup job:", error);
    }
  }, 12 * 60 * 60 * 1000);
  
  console.log("[Redis-Server] Cleanup jobs scheduled successfully");
}

export async function setChatVisibility(roomId: string, isVisible: boolean): Promise<void> {
  return safeRedisOperation(async () => {
    console.log(`[RedisServer] Setting chat visibility for room ${roomId} to ${isVisible}`);
    
    try {
      // First, check if the chat session exists in Redis
      const chatSessionKey = `${ROOM_PREFIX}${roomId}`;
      const chatSessionExists = await redis.exists(chatSessionKey);
      
      if (chatSessionExists) {
        // Get the existing chat room
        const roomData = await redis.get(chatSessionKey);
        if (roomData) {
          let room: ChatRoom;
          
          try {
            // Parse the room data
            if (typeof roomData === 'object' && roomData !== null) {
              room = roomData as unknown as ChatRoom;
            } else {
              room = JSON.parse(roomData as string) as ChatRoom;
            }
            
            console.log(`[RedisServer] Existing room data: isActive=${room.isActive}, isChatVisible=${room.isChatVisible}`);
            
            // Update the chat visibility setting
            room = {
              ...room,
              isChatVisible: isVisible,
              lastActivity: new Date().toISOString(),
            };
            
            // Save the updated room
            console.log(`[RedisServer] Saving updated room data with isChatVisible=${room.isChatVisible}`);
            await redis.set(chatSessionKey, JSON.stringify(room));
            
            console.log(`[RedisServer] Chat visibility for room ${roomId} set to ${isVisible}`);
          } catch (error) {
            console.error("[RedisServer] Error parsing room data:", error);
            throw error;
          }
        }
      } else {
        // Create a new room with the visibility setting
        console.log(`[RedisServer] Room ${roomId} doesn't exist, creating new room with visibility=${isVisible}`);
        const newRoom: ChatRoom = {
          id: roomId,
          lectureId: roomId,
          isActive: true,
          isChatVisible: isVisible,
          createdAt: new Date().toISOString(),
          settings: {
            isModerated: true,
            allowPolls: true,
            slowMode: false,
            slowModeInterval: 5,
            allowLinks: true,
            allowImages: false,
            allowReplies: true,
            maxMessageLength: 500,
            chatEnabled: true
          },
          lastActivity: new Date().toISOString(),
        };
        
        // Save the new room
        await redis.set(chatSessionKey, JSON.stringify(newRoom));
        console.log(`[RedisServer] Created new room ${roomId} with chat visibility set to ${isVisible}`);
      }
    } catch (error) {
      console.error(`[RedisServer] Error setting chat visibility for room ${roomId}:`, error);
      throw error;
    }
  }, "Failed to set chat visibility");
}

export async function forcePinMessage(roomId: string, message: ChatMessage): Promise<boolean> {
  return safeRedisOperation(async () => {
    console.log(`[Redis-Server] Force pinning message ${message.id} in room ${roomId}`);
    
    try {
      // Ensure the message is marked as pinned
      const messageToPin = {
        ...message,
        isPinned: true
      };
      
      // Save the pinned message
      await redis.set(`${MESSAGE_PREFIX}${roomId}:pinned`, JSON.stringify(messageToPin));
      console.log(`[Redis-Server] Saved pinned message ${message.id} in room ${roomId}`);
      
      // Try to update the message in the messages list if it exists
      try {
        const allMessages = await getMessages(roomId, 500);
        const messageIndex = allMessages.findIndex((msg) => msg.id === message.id);
        
        if (messageIndex !== -1) {
          // Check if the key exists and is a list
          const messageKey = `${MESSAGE_PREFIX}${roomId}`;
          const keyType = await redis.type(messageKey);
          
          if (keyType === 'list') {
            // Update the message in the list to have isPinned=true
            await redis.lset(messageKey, messageIndex, JSON.stringify(messageToPin));
            console.log(`[Redis-Server] Updated message ${message.id} in message list at position ${messageIndex}`);
          } else {
            console.log(`[Redis-Server] Key ${messageKey} is not a list (type: ${keyType}), skipping list update`);
          }
        } else {
          console.log(`[Redis-Server] Message ${message.id} not found in messages list, adding it`);
          // Add the message to the list if it doesn't exist
          await redis.lpush(`${MESSAGE_PREFIX}${roomId}`, JSON.stringify(messageToPin));
        }
      } catch (listError) {
        // If updating the list fails, it's not critical - we still have the pinned message separately
        console.error(`[Redis-Server] Error updating message in list: ${listError}`);
      }
      
      console.log(`[Redis-Server] Successfully force-pinned message ${message.id}`);
      return true;
    } catch (error) {
      console.error(`[Redis-Server] Error in forcePinMessage:`, error);
      return false;
    }
  }, "Failed to force pin message");
}

export async function getPinnedMessage(roomId: string): Promise<ChatMessage | null> {
  return safeRedisOperation(async () => {
    try {
      const pinnedMessageKey = `${MESSAGE_PREFIX}${roomId}:pinned`;
      const pinnedMessage = await redis.get(pinnedMessageKey);
      
      if (!pinnedMessage) {
        console.log(`[Redis-Server] No pinned message found for room ${roomId}`);
        return null;
      }
      
      try {
        // Check if value is already an object
        if (typeof pinnedMessage === 'object' && pinnedMessage !== null) {
          console.log(`[Redis-Server] Found pinned message for room ${roomId}`);
          return pinnedMessage as unknown as ChatMessage;
        } else {
          // Try to parse string value
          const parsed = JSON.parse(pinnedMessage as string) as ChatMessage;
          console.log(`[Redis-Server] Found pinned message for room ${roomId}`);
          return parsed;
        }
      } catch (error) {
        console.error("[Redis-Server] Failed to parse pinned message:", error);
        console.error("[Redis-Server] Problematic value:", pinnedMessage);
        console.error("[Redis-Server] Type of value:", typeof pinnedMessage);
        return null;
      }
    } catch (error) {
      console.error("[Redis-Server] Error in getPinnedMessage:", error);
      return null;
    }
  }, "Failed to get pinned message");
}

export async function pinMessage(roomId: string, messageId: string): Promise<boolean> {
  return safeRedisOperation(async () => {
    console.log(`[Redis-Server] Attempting to pin message ${messageId} in room ${roomId}`);
    
    try {
      // Get all messages
      const allMessages = await getMessages(roomId, 500);
      console.log(`[Redis-Server] Retrieved ${allMessages.length} messages for room ${roomId}`);

      // Find the message to pin
      const messageToPin = allMessages.find((msg) => msg.id === messageId);
      if (!messageToPin) {
        console.log(`[Redis-Server] Message to pin (${messageId}) not found in room ${roomId}`);
        return false;
      }

      console.log(`[Redis-Server] Found message to pin: ${messageToPin.id} by ${messageToPin.userName}`);

      // Update the message to be pinned
      messageToPin.isPinned = true;

      // Save the pinned message
      await redis.set(`${MESSAGE_PREFIX}${roomId}:pinned`, JSON.stringify(messageToPin));
      console.log(`[Redis-Server] Saved pinned message ${messageId} in room ${roomId}`);

      // Update the message in the list
      try {
        const messageIndex = allMessages.findIndex((msg) => msg.id === messageId);
        if (messageIndex !== -1) {
          // Check if the key exists and is a list
          const messageKey = `${MESSAGE_PREFIX}${roomId}`;
          const keyType = await redis.type(messageKey);
          
          if (keyType === 'list') {
            await redis.lset(messageKey, messageIndex, JSON.stringify(messageToPin));
            console.log(`[Redis-Server] Updated message ${messageId} in message list at position ${messageIndex}`);
          } else {
            console.log(`[Redis-Server] Key ${messageKey} is not a list (type: ${keyType}), skipping list update`);
          }
        }
      } catch (listError) {
        // If updating the list fails, it's not critical - we still have the pinned message separately
        console.error(`[Redis-Server] Error updating message in list: ${listError}`);
      }

      console.log(`[Redis-Server] Successfully pinned message ${messageId}`);
      return true;
    } catch (error) {
      console.error(`[Redis-Server] Error in pinMessage:`, error);
      return false;
    }
  }, "Failed to pin message");
}

export async function unpinMessage(roomId: string): Promise<boolean> {
  return safeRedisOperation(async () => {
    console.log(`[Redis-Server] Attempting to unpin message in room ${roomId}`);
    
    try {
      // Get the pinned message
      const pinnedMessage = await getPinnedMessage(roomId);
      if (!pinnedMessage) {
        console.log(`[Redis-Server] No pinned message found in room ${roomId}`);
        return false;
      }

      console.log(`[Redis-Server] Found pinned message: ${pinnedMessage.id} by ${pinnedMessage.userName}`);

      // Remove the pinned message
      await redis.del(`${MESSAGE_PREFIX}${roomId}:pinned`);
      console.log(`[Redis-Server] Removed pinned message from room ${roomId}`);

      // Update the message in the list to be unpinned
      try {
        const allMessages = await getMessages(roomId, 500);
        const messageIndex = allMessages.findIndex((msg) => msg.id === pinnedMessage.id);

        if (messageIndex !== -1) {
          // Update the isPinned flag
          pinnedMessage.isPinned = false;
          
          // Check if the key exists and is a list
          const messageKey = `${MESSAGE_PREFIX}${roomId}`;
          const keyType = await redis.type(messageKey);
          
          if (keyType === 'list') {
            await redis.lset(messageKey, messageIndex, JSON.stringify(pinnedMessage));
            console.log(`[Redis-Server] Updated message ${pinnedMessage.id} in message list at position ${messageIndex}`);
          } else {
            console.log(`[Redis-Server] Key ${messageKey} is not a list (type: ${keyType}), skipping list update`);
          }
        }
      } catch (listError) {
        // If updating the list fails, it's not critical - the pinned message has been removed
        console.error(`[Redis-Server] Error updating message in list: ${listError}`);
      }

      console.log(`[Redis-Server] Successfully unpinned message from room ${roomId}`);
      return true;
    } catch (error) {
      console.error(`[Redis-Server] Error in unpinMessage:`, error);
      return false;
    }
  }, "Failed to unpin message");
}

/**
 * Save multiple messages in a single batch operation
 * This is significantly more efficient than saving messages one by one
 */
export async function saveBatchMessages(roomId: string, messages: ChatMessage[]): Promise<ChatMessage[]> {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  try {
    const messagesKey = `${MESSAGE_PREFIX}${roomId}`;
    const pipeline = redis.pipeline();
    const savedMessages: ChatMessage[] = [];
    const now = new Date().toISOString();

    // Process all messages in a single pipeline to reduce network overhead
    for (const message of messages) {
      // Ensure message has required fields
      const normalizedMessage = {
        ...message,
        id: message.id || `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        roomId,
        createdAt: message.createdAt || now,
        isPinned: false,
        isDeleted: false
      };

      // Add message to Redis list
      pipeline.lpush(messagesKey, JSON.stringify(normalizedMessage));
      savedMessages.push(normalizedMessage);
    }

    // Set expiration on the messages key if not already set
    pipeline.expire(messagesKey, 30 * 60);

    // Update room's last activity timestamp
    await updateRoomActivity(roomId);

    // Execute all Redis commands in a single operation
    await pipeline.exec();

    // Only trim if we saved more than 10 messages to reduce operations
    if (messages.length > 10) {
      // Trim the list to keep it at a reasonable size (separate operation)
      await redis.ltrim(messagesKey, 0, 499);
    }

    return savedMessages;
  } catch (error) {
    console.error(`[Redis-Chat] Error saving batch messages for room ${roomId}:`, error);
    return [];
  }
}
