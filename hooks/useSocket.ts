"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { io, type Socket } from "socket.io-client"

interface UseSocketOptions {
  isRequired?: boolean;
  silentErrors?: boolean;
}

export const useSocket = (roomId?: string, options: UseSocketOptions = {}) => {
  const { isRequired = false, silentErrors = false } = options;
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Logging function that respects silent mode
  const logError = useCallback((message: string, error: any) => {
    if (!silentErrors) {
      console.error(message, error);
    }
    return error;
  }, [silentErrors]);

  useEffect(() => {
    // Skip connection if not required
    if (!isRequired && !roomId) {
      return;
    }

    // Don't try to reconnect if we've had multiple failures
    if (connectionError === "MAX_RETRIES_EXCEEDED") {
      if (!silentErrors) {
        console.log("Not attempting to reconnect - max retries exceeded");
      }
      return;
    }

    // Clear any previous errors
    setConnectionError(null);
    
    // Initialize socket connection with better error handling
    try {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
      
      const socket = io(socketUrl, {
        path: "/socket.io/",
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000, // Increase timeout for slow connections
        autoConnect: isRequired, // Only auto-connect if socket is required
      });

      socketRef.current = socket;

      // Connection events
      socket.on("connect", () => {
        setIsConnected(true);
        setConnectionError(null);
        if (!silentErrors) {
          console.log("Connected to socket server");
        }

        // Join room if provided
        if (roomId) {
          socket.emit("join-room", { roomId, lectureId: roomId });
        }
      });

      socket.on("disconnect", (reason) => {
        setIsConnected(false);
        if (!silentErrors) {
          console.log(`Disconnected from socket server: ${reason}`);
        }
        
        // Don't attempt to reconnect if the disconnect was intentional
        if (reason === "io client disconnect" || reason === "io server disconnect") {
          if (!silentErrors) {
            console.log("Intentional disconnect - not attempting reconnect");
          }
        }
      });

      socket.on("connect_error", (error) => {
        logError("Socket connection error:", error.message);
        setIsConnected(false);
        setConnectionError(error.message);
      });

      socket.on("reconnect_failed", () => {
        logError("Socket reconnection failed after maximum attempts", null);
        setConnectionError("MAX_RETRIES_EXCEEDED");
      });

      socket.on("error", (error) => {
        logError("Socket error:", error);
        setConnectionError(error.message || "Unknown socket error");
      });

      // Connect if not already connected and is required
      if (isRequired && !socket.connected) {
        socket.connect();
      }

      // Cleanup on unmount
      return () => {
        if (roomId && socket.connected) {
          socket.emit("leave-room", { roomId });
        }
        socket.disconnect();
      }
    } catch (error) {
      logError("Error initializing socket:", error);
      setConnectionError(error instanceof Error ? error.message : "Failed to initialize socket");
      return () => {}; // Return empty cleanup function
    }
  }, [roomId, connectionError, isRequired, silentErrors, logError]);

  const connect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.disconnect();
    }
  }, []);

  const sendMessage = useCallback((message: string, userId: string) => {
    if (!socketRef.current || !isConnected) {
      if (!silentErrors) {
        console.warn("Cannot send message - socket not connected");
      }
      return false;
    }
    
    if (roomId) {
      socketRef.current.emit("send-message", {
        roomId,
        message,
        userId,
      });
      return true;
    }
    return false;
  }, [isConnected, roomId, silentErrors]);

  const onMessage = useCallback((callback: (data: { message: string; userId: string; timestamp: string }) => void) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on("receive-message", callback);
    
    // Return cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.off("receive-message", callback);
      }
    };
  }, []);

  return {
    isConnected,
    connectionError,
    sendMessage,
    onMessage,
    socket: socketRef.current,
    connect,
    disconnect
  };
};
