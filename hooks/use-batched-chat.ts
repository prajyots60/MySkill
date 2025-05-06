"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSocket } from "./useSocket"
import { useLocalStorage } from "./use-local-storage"
import { ChatMessage, ChatMessageType } from "@/lib/types"

const DEFAULT_BATCH_INTERVAL = 5000 // 5 seconds
const MAX_BATCH_SIZE = 20 // Maximum number of messages to batch before forced upload
const STORAGE_PREFIX = "chat_batch_"

interface UseBatchedChatOptions {
  batchInterval?: number
  maxBatchSize?: number
  autoFlush?: boolean
  debugMode?: boolean
}

export function useBatchedChat(roomId: string, userId: string, userName: string, options: UseBatchedChatOptions = {}) {
  const {
    batchInterval = DEFAULT_BATCH_INTERVAL,
    maxBatchSize = MAX_BATCH_SIZE,
    autoFlush = true,
    debugMode = false
  } = options

  // Connect to socket
  const { socket, isConnected, connectionError } = useSocket(roomId, { isRequired: true })
  
  // Local state for pending messages
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([])
  
  // Store messages in localStorage as backup
  const storageKey = `${STORAGE_PREFIX}${roomId}_${userId}`
  const [storedMessages, setStoredMessages] = useLocalStorage<ChatMessage[]>(storageKey, [])
  
  // Track last flush time
  const lastFlushTimeRef = useRef<number>(Date.now())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Debug logger
  const logDebug = useCallback((message: string, data?: any) => {
    if (debugMode) {
      console.log(`[BatchedChat] ${message}`, data || '')
    }
  }, [debugMode])

  // Initialize from localStorage on mount
  useEffect(() => {
    if (storedMessages.length > 0) {
      logDebug(`Loaded ${storedMessages.length} pending messages from localStorage`)
      setPendingMessages(storedMessages)
    }
  }, [storedMessages, logDebug])

  // Function to add a new message to the batch
  const addMessage = useCallback((content: string, type: ChatMessageType = ChatMessageType.TEXT) => {
    const newMessage: ChatMessage = {
      id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      roomId,
      userId,
      userName,
      userImage: undefined, // Will be populated by the server
      userRole: 'STUDENT', // Default role, server will verify
      content,
      type,
      isPinned: false,
      isDeleted: false,
      createdAt: new Date().toISOString()
    }
    
    // Add to local state
    setPendingMessages(prev => {
      const updated = [...prev, newMessage]
      // Also update localStorage
      setStoredMessages(updated)
      return updated
    })
    
    logDebug(`Added message to batch, now ${pendingMessages.length + 1} pending`)
    
    // Force flush if we hit max batch size
    if (pendingMessages.length + 1 >= maxBatchSize) {
      logDebug(`Reached max batch size (${maxBatchSize}), forcing flush`)
      flushMessages()
    }
    
    return newMessage
  }, [roomId, userId, userName, pendingMessages.length, maxBatchSize, setStoredMessages, logDebug])
  
  // Function to manually flush messages to the server
  const flushMessages = useCallback(() => {
    if (!socket || !isConnected) {
      logDebug('Cannot flush messages: socket not connected')
      return false
    }
    
    if (pendingMessages.length === 0) {
      logDebug('No pending messages to flush')
      return true
    }
    
    logDebug(`Flushing ${pendingMessages.length} messages to server`)
    
    // Send batch to server
    socket.emit(
      'batch-messages', 
      { 
        roomId, 
        userId, 
        messages: pendingMessages 
      },
      (response: { success?: boolean; error?: string; savedCount?: number }) => {
        if (response.success) {
          logDebug(`Successfully sent ${response.savedCount} messages to server`)
          // Clear pending messages after successful send
          setPendingMessages([])
          setStoredMessages([])
          lastFlushTimeRef.current = Date.now()
        } else {
          logDebug(`Error sending batch messages: ${response.error}`)
          // Keep messages in pending state to retry later
        }
      }
    )
    
    return true
  }, [socket, isConnected, roomId, userId, pendingMessages, setStoredMessages, logDebug])
  
  // Auto-flush messages based on interval
  useEffect(() => {
    if (!autoFlush) return
    
    // Clear any existing timeout
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
    }
    
    // Set up new timeout for auto-flushing
    flushTimeoutRef.current = setTimeout(() => {
      const timeSinceLastFlush = Date.now() - lastFlushTimeRef.current
      
      // Only flush if we have pending messages and enough time has passed
      if (pendingMessages.length > 0 && timeSinceLastFlush >= batchInterval) {
        logDebug(`Auto-flushing ${pendingMessages.length} messages after ${timeSinceLastFlush}ms`)
        flushMessages()
      }
    }, batchInterval)
    
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current)
      }
    }
  }, [pendingMessages, batchInterval, autoFlush, flushMessages, logDebug])
  
  // Flush before unmounting to avoid losing messages
  useEffect(() => {
    return () => {
      if (pendingMessages.length > 0) {
        logDebug(`Unmounting component with ${pendingMessages.length} pending messages, attempting flush`)
        flushMessages()
      }
    }
  }, [pendingMessages.length, flushMessages, logDebug])
  
  return {
    addMessage,
    flushMessages,
    pendingMessageCount: pendingMessages.length,
    isConnected,
    connectionError
  }
}