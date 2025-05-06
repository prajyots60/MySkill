"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { io, type Socket } from "socket.io-client"
import { useToast } from "@/hooks/use-toast"
import {
  type ChatMessage,
  ChatMessageType,
  type ChatParticipant,
  type ChatRoom,
  type MutedUser,
  type Poll,
  PollStatus,
  type UserRole,
  type ChatEvent,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Send,
  Settings,
  Users,
  Pin,
  Trash2,
  MoreVertical,
  MessageSquare,
  VolumeX,
  Volume2,
  PlusCircle,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart,
  User,
  Shield,
  ShieldAlert,
  MessageSquareOff,
  MessageSquarePlus,
  PinOff,
  Megaphone,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

interface LiveChatProps {
  lectureId: string
  isCreator: boolean
  isAdmin: boolean
}

// PinnedMessageBanner component for a more prominent display
const PinnedMessageBanner = ({ 
  message, 
  onUnpin, 
  isCreatorOrAdmin 
}: { 
  message: ChatMessage; 
  onUnpin: () => void; 
  isCreatorOrAdmin: boolean;
}) => {
  return (
    <div className="bg-primary/10 border-l-4 border-primary rounded-md p-3 mb-4 relative shadow-sm">
      <div className="flex items-start">
        <Pin className="h-4 w-4 text-primary mt-0.5 mr-2 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            <span className="text-xs text-primary font-medium">Pinned Message</span>
            <span className="text-xs text-muted-foreground ml-2">
              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
            </span>
          </div>
          <div className="flex items-center">
            <Avatar className="h-5 w-5 mr-1">
              <AvatarImage src={message.userImage || "/placeholder.svg"} />
              <AvatarFallback>{message.userName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium mr-1 truncate">{message.userName}</span>
            {message.userRole === "CREATOR" && (
              <Badge variant="default" className="bg-primary text-primary-foreground text-xs">
                Instructor
              </Badge>
            )}
          </div>
          <p className="text-sm mt-1 break-words">{message.content}</p>
        </div>
        {isCreatorOrAdmin && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-2 right-2 h-7 w-7" 
            onClick={(e) => {
              e.stopPropagation();
              onUnpin();
            }}
          >
            <PinOff className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export function LiveChat({ lectureId, isCreator, isAdmin }: LiveChatProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [participants, setParticipants] = useState<ChatParticipant[]>([])
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([])
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null)
  const [activePolls, setActivePolls] = useState<Poll[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPollDialog, setShowPollDialog] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""])
  const [userVotes, setUserVotes] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<string>("chat")
  const [isCreatingPoll, setIsCreatingPoll] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [isLectureLive, setIsLectureLive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [screenWidth, setScreenWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 0);
  const isMobile = screenWidth < 768; // md breakpoint
  // Adding an initial connection state to prevent premature display of "Chat Not Started"
  const [initializing, setInitializing] = useState(true)

  const isModeratorOrAdmin = isCreator || isAdmin

  // Settings form schema
  const settingsFormSchema = z.object({
    isModerated: z.boolean(),
    allowPolls: z.boolean(),
    slowMode: z.boolean(),
    slowModeInterval: z.number().min(1).max(60),
    allowLinks: z.boolean(),
    allowImages: z.boolean(),
    allowReplies: z.boolean(),
    maxMessageLength: z.number().min(50).max(1000),
  })

  const settingsForm = useForm<z.infer<typeof settingsFormSchema>>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      isModerated: true,
      allowPolls: true,
      slowMode: false,
      slowModeInterval: 5,
      allowLinks: true,
      allowImages: true,
      allowReplies: true,
      maxMessageLength: 500,
    },
  })

  // State to track if the lecture is ready to show for students
  const [isLectureChatVisible, setIsLectureChatVisible] = useState(false)
  // Add debug states
  const [debugState, setDebugState] = useState<{
    receivedRoomData: boolean,
    lastRoomData: any | null,
    lastJoinResponse: any | null,
  }>({
    receivedRoomData: false,
    lastRoomData: null,
    lastJoinResponse: null,
  })

  // Load session ID from localStorage for persistence
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedSessionId = localStorage.getItem(`chat-session-${session?.user?.id}`)
      if (storedSessionId) {
        setSessionId(storedSessionId)
      }
    }
  }, [session?.user?.id])

  // Update the useEffect for socket connection to properly handle reconnection and authentication
  useEffect(() => {
    if (!session?.user || !lectureId) return

    // Create a function to establish socket connection with proper auth
    const connectSocket = () => {
      console.log("[LiveChat] Attempting to connect to socket server. isCreator:", isCreator, "isAdmin:", isAdmin);

      const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
        path: "/socket.io",  // Fix the socket path to match server configuration
        auth: {
          token: session.user.accessToken,
          userId: session.user.id,
          userName: session.user.name,
          userImage: session.user.image,
          userRole: session.user.role,
          sessionId: sessionId,
        },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: true,
      })

      // Connection events with better error handling
      socketInstance.on("connect", () => {
        console.log("[LiveChat] Socket connected successfully with ID:", socketInstance.id);
        setConnected(true)
        setIsLoading(false)

        // Store session ID for persistence
        if (socketInstance.id) {
          const newSessionId = sessionId || socketInstance.id
          localStorage.setItem(`chat-session-${session.user.id}`, newSessionId)
          setSessionId(newSessionId)
        }

        // Join the chat room
        console.log("[LiveChat] Emitting join-room event for lectureId:", lectureId);
        socketInstance.emit(
          "join-room",
          {
            roomId: lectureId,
            lectureId,
          },
          (response: { error?: string; success?: boolean; isChatActive?: boolean; isChatVisible?: boolean }) => {
            console.log("[LiveChat] join-room response:", response);
            
            // Mark initialization as complete regardless of the response
            setInitializing(false);
            
            setDebugState(prev => ({
              ...prev,
              lastJoinResponse: response
            }));

            if (response?.error) {
              console.error("[LiveChat] Error joining room:", response.error)
              toast({
                title: "Connection Error",
                description: response.error,
                variant: "destructive",
              })
            } else if (response?.success) {
              console.log("[LiveChat] Successfully joined room. isChatActive:", response.isChatActive, "isChatVisible:", response.isChatVisible);
              
              if (isCreator || isAdmin) {
                setIsLectureLive(true)
              }
              
              // Set chat visibility based on server response
              if (response.isChatVisible) {
                console.log("[LiveChat] Setting chat visible based on server response");
                setIsLectureChatVisible(true)
              } else {
                console.log("[LiveChat] Setting chat not visible based on server response");
                setIsLectureChatVisible(false)
              }
            }
          }
        )
      })

      socketInstance.on("connect_error", (error) => {
        console.error("Socket connection error:", error.message)
        setIsLoading(false)
        setConnected(false)
        setInitializing(false) // Make sure to set initializing to false on error too
        toast({
          title: "Connection Error",
          description: `Failed to connect: ${error.message}`,
          variant: "destructive",
        })
      })

      socketInstance.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason)
        setConnected(false)

        // Show toast only for unexpected disconnections
        if (reason !== "io client disconnect") {
          toast({
            title: "Disconnected",
            description: "Chat connection lost. Attempting to reconnect...",
            variant: "destructive",
          })
        }
      })

      socketInstance.on("error", (error) => {
        console.error("Socket error:", error)
        toast({
          title: "Error",
          description: typeof error === "string" ? error : error.message || "An error occurred",
          variant: "destructive",
        })
      })

      // Improved room data handling with validation
      socketInstance.on("room-data", (data: { 
        room?: ChatRoom; 
        messages?: ChatMessage[]; 
        pinnedMessage?: ChatMessage; 
        activePolls?: Poll[]; 
        userVotes?: Record<string, string>;
        participants?: ChatParticipant[];
        mutedUsers?: MutedUser[];
      }) => {
        console.log("[LiveChat] Received room data:", JSON.stringify({
          roomId: data.room?.id,
          isActive: data.room?.isActive,
          isChatVisible: data.room?.isChatVisible,
          messageCount: data.messages?.length,
          participantCount: data.participants?.length
        }));

        // Mark initialization as complete once we get room data
        setInitializing(false);

        setDebugState(prev => ({
          ...prev,
          receivedRoomData: true,
          lastRoomData: {
            roomId: data.room?.id,
            isActive: data.room?.isActive,
            isChatVisible: data.room?.isChatVisible,
          }
        }));

        if (!data || !data.room) {
          console.error("[LiveChat] Invalid room data received")
          toast({
            title: "Error",
            description: "Invalid chat data received",
            variant: "destructive",
          })
          return
        }

        setRoom(data.room)
        setIsLectureLive(true)
        
        // Check visibility state from room data
        if (data.room.isChatVisible !== undefined) {
          console.log("[LiveChat] Setting isChatVisible to", data.room.isChatVisible, "from room-data event");
          setIsLectureChatVisible(data.room.isChatVisible);
        }

        if (Array.isArray(data.messages)) {
          setMessages(data.messages)
        }

        setPinnedMessage(data.pinnedMessage || null)

        if (Array.isArray(data.activePolls)) {
          setActivePolls(data.activePolls)
        }

        if (data.userVotes && typeof data.userVotes === "object") {
          setUserVotes(data.userVotes)
        }

        if (Array.isArray(data.participants)) {
          setParticipants(data.participants)
        }

        if (Array.isArray(data.mutedUsers)) {
          setMutedUsers(data.mutedUsers)
          // Check if current user is muted
          const userMuted = data.mutedUsers.some((u: MutedUser) => u.userId === session?.user?.id)
          setIsMuted(userMuted)
        }

        // Update settings form values with validation
        if (data.room?.settings) {
          settingsForm.reset({
            isModerated: Boolean(data.room.settings.isModerated),
            allowPolls: Boolean(data.room.settings.allowPolls),
            slowMode: Boolean(data.room.settings.slowMode),
            slowModeInterval: Number(data.room.settings.slowModeInterval) || 5,
            allowLinks: Boolean(data.room.settings.allowLinks),
            allowImages: Boolean(data.room.settings.allowImages),
            allowReplies: Boolean(data.room.settings.allowReplies),
            maxMessageLength: Number(data.room.settings.maxMessageLength) || 500,
          })
        }

        setIsLoading(false)
      })

      // Message handling with validation and deduplication
      const receivedMessageIds = new Set()

      socketInstance.on("new-message", (message: ChatMessage) => {
        if (!message || !message.id) {
          console.error("Invalid message received:", message)
          return
        }

        // Prevent duplicate messages
        if (receivedMessageIds.has(message.id)) {
          return
        }

        receivedMessageIds.add(message.id)

        // Add message with optimistic rendering
        setMessages((prev) => {
          // Check if message already exists
          if (prev.some((m) => m.id === message.id)) {
            return prev
          }
          return [...prev, message]
        })

        // Auto-scroll to bottom for new messages
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      })

      // Other event handlers with improved error handling...
      socketInstance.on("message-pinned", (message: ChatMessage) => {
        console.log(`[LiveChat] Received message-pinned event for message ${message.id}`);
        
        // Set the pinned message in state
        setPinnedMessage(message);
        
        // Update the message in the messages list
        setMessages((prev) => prev.map((msg) => 
          msg.id === message.id ? { ...msg, isPinned: true } : msg
        ));
        
        toast({
          title: "Message Pinned",
          description: "A message has been pinned to the chat",
        });
      });

      socketInstance.on("message-unpinned", () => {
        console.log("[LiveChat] Received message-unpinned event");
        
        // Clear the pinned message
        setPinnedMessage(null);
        
        // Remove pinned status from all messages
        setMessages((prev) => prev.map((msg) => 
          msg.isPinned ? { ...msg, isPinned: false } : msg
        ));
        
        toast({
          title: "Message Unpinned",
          description: "The pinned message has been removed",
        });
      });

      socketInstance.on("new-poll", (poll: Poll) => {
        if (!poll || !poll.id) {
          console.error("Invalid poll received:", poll)
          return
        }

        setActivePolls((prev) => [...prev, poll])
      })

      // Enhanced poll update handling
      socketInstance.on("poll-updated", (updatedPoll: Poll) => {
        if (!updatedPoll || !updatedPoll.id) {
          console.error("Invalid poll update received:", updatedPoll)
          return
        }

        setActivePolls((prev) => prev.map((poll) => (poll.id === updatedPoll.id ? updatedPoll : poll)))
      })

      socketInstance.on("poll-closed", (updatedPoll: Poll) => {
        if (!updatedPoll || !updatedPoll.id) {
          console.error("Invalid poll closure received:", updatedPoll)
          return
        }

        console.log("Received closed poll with data:", updatedPoll)
        
        // Find the current poll to ensure we have the latest vote data
        setActivePolls((prev) => {
          const currentPolls = [...prev]
          const pollIndex = currentPolls.findIndex(p => p.id === updatedPoll.id)
          
          if (pollIndex !== -1) {
            // Preserve the existing options/votes data while updating the status
            const existingPoll = currentPolls[pollIndex]
            
            // If the updated poll has vote data, use it; otherwise keep existing vote data
            const hasVoteData = updatedPoll.options && updatedPoll.options.some(opt => opt.votes > 0)
            
            currentPolls[pollIndex] = {
              ...updatedPoll,
              options: hasVoteData ? updatedPoll.options : existingPoll.options
            }
          }
          
          return currentPolls
        })
      })

      socketInstance.on("user-muted", (mutedUser: MutedUser) => {
        if (!mutedUser || !mutedUser.userId) {
          console.error("Invalid mute event received:", mutedUser)
          return
        }

        setMutedUsers((prev) => [...prev, mutedUser])

        if (mutedUser.userId === session.user.id) {
          setIsMuted(true)
          toast({
            title: "You have been muted",
            description: `You have been muted until ${new Date(mutedUser.mutedUntil).toLocaleTimeString()}`,
            variant: "destructive",
          })
        }
      })

      socketInstance.on("user-unmuted", ({ userId }) => {
        if (!userId) {
          console.error("Invalid unmute event received")
          return
        }

        setMutedUsers((prev) => prev.filter((user) => user.userId !== userId))

        if (userId === session.user.id) {
          setIsMuted(false)
          toast({
            title: "You have been unmuted",
            description: "You can now send messages again",
          })
        }
      })

      socketInstance.on("room-settings-updated", (updatedRoom: ChatRoom) => {
        if (!updatedRoom || !updatedRoom.id) {
          console.error("Invalid room settings update received:", updatedRoom)
          return
        }

        setRoom(updatedRoom)

        if (updatedRoom.settings) {
          settingsForm.reset(updatedRoom.settings)
        }
      })

      socketInstance.on("room-toggled", (updatedRoom: ChatRoom) => {
        if (!updatedRoom || !updatedRoom.id) {
          console.error("Invalid room toggle event received:", updatedRoom)
          return
        }

        setRoom(updatedRoom)
        
        // Persist state whenever we receive an update from the server
        persistRoomState(updatedRoom.id, updatedRoom.isActive);

        toast({
          title: updatedRoom.isActive ? "Chat Enabled" : "Chat Disabled",
          description: updatedRoom.isActive
            ? "The instructor has enabled the chat"
            : "The instructor has disabled the chat",
        })
      })

      socketInstance.on("room-disabled", () => {
        toast({
          title: "Chat Disabled",
          description: "The chat has been disabled by the instructor.",
          variant: "default",
        })
      })

      socketInstance.on("lecture-live-status", ({ isLive }) => {
        setIsLectureLive(isLive)

        if (!isLive) {
          toast({
            title: "Lecture Ended",
            description: "The live lecture has ended.",
            variant: "default",
          })
        } else {
          toast({
            title: "Lecture Started",
            description: "The lecture is now live.",
            variant: "default",
          })
        }
      })

      socketInstance.on("chat-event", (event: ChatEvent) => {
        if (!event || !event.type) {
          console.error("Invalid chat event received:", event)
          return
        }

        if (event.type === "JOIN") {
          setParticipants((prev) => {
            const exists = prev.some((p) => p.userId === event.payload.userId)
            if (exists) {
              return prev.map((p) =>
                p.userId === event.payload.userId ? { ...p, isOnline: true, lastActive: event.timestamp } : p,
              )
            }
            return [...prev, event.payload]
          })
        } else if (event.type === "LEAVE") {
          setParticipants((prev) =>
            prev.map((p) =>
              p.userId === event.payload.userId ? { ...p, isOnline: false, lastActive: event.timestamp } : p,
            ),
          )
        }
      })

      // Add listener for chat visibility updates
      socketInstance.on("chat-visibility-update", ({ isVisible, roomId }) => {
        console.log("[LiveChat] Received chat-visibility-update:", isVisible, "for room", roomId);
        setIsLectureChatVisible(isVisible);
        if (isVisible) {
          toast({
            title: "Chat Available",
            description: "The instructor has made the chat available",
          });
        } else {
          toast({
            title: "Chat Hidden",
            description: "The instructor has temporarily hidden the chat",
          });
        }
      });

      return socketInstance
    }

    // Initialize socket connection
    const socketInstance = connectSocket()
    setSocket(socketInstance)

    // Set a timeout to ensure initializing state doesn't get stuck
    const initTimeout = setTimeout(() => {
      setInitializing(false);
    }, 5000); // 5 seconds max for initialization

    // Cleanup function with proper socket disconnection
    return () => {
      clearTimeout(initTimeout);
      
      if (socketInstance) {
        console.log("Cleaning up socket connection")

        // Leave room before disconnecting
        socketInstance.emit("leave-room", { roomId: lectureId })

        // Properly remove all listeners to prevent memory leaks
        socketInstance.off("connect")
        socketInstance.off("disconnect")
        socketInstance.off("connect_error")
        socketInstance.off("error")
        socketInstance.off("room-data")
        socketInstance.off("new-message")
        socketInstance.off("message-pinned")
        socketInstance.off("message-unpinned")
        socketInstance.off("message-deleted")
        socketInstance.off("new-poll")
        socketInstance.off("poll-updated")
        socketInstance.off("poll-closed")
        socketInstance.off("user-muted")
        socketInstance.off("user-unmuted")
        socketInstance.off("room-settings-updated")
        socketInstance.off("room-toggled")
        socketInstance.off("room-disabled")
        socketInstance.off("lecture-live-status")
        socketInstance.off("chat-event")
        socketInstance.off("chat-visibility-update")

        // Disconnect socket
        socketInstance.disconnect()
      }

      // Add cleanup for new event listeners
      socketInstance.off("poll-updated")
    }
  }, [session, lectureId, toast, sessionId, isCreator, isAdmin])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Update the handleSendMessage function with better error handling and rate limiting
  const handleSendMessage = () => {
    if (!socket || !connected || !newMessage.trim() || isMuted) return

    // Prevent sending if chat is disabled by creator
    if (!room?.isActive) {
      toast({
        title: "Chat Disabled",
        description: "The instructor has disabled chat messages",
        variant: "destructive",
      })
      return
    }

    // Prevent sending if the message is too long
    if (room?.settings?.maxMessageLength && newMessage.length > room.settings.maxMessageLength) {
      toast({
        title: "Message Too Long",
        description: `Messages cannot exceed ${room.settings.maxMessageLength} characters`,
        variant: "destructive",
      })
      return
    }

    // Disable the button during sending to prevent double-sends
    const sendButton = document.getElementById("send-message-button") as HTMLButtonElement
    if (sendButton) sendButton.disabled = true

    // Send with timeout for error handling
    const timeout = setTimeout(() => {
      toast({
        title: "Message Sending Failed",
        description: "Your message could not be sent. Please try again.",
        variant: "destructive",
      })
      if (sendButton) sendButton.disabled = false
    }, 5000)

    socket.emit(
      "send-message",
      {
        roomId: lectureId,
        content: newMessage,
        type: ChatMessageType.TEXT,
      },
      (response: any) => {
        clearTimeout(timeout)
        if (sendButton) sendButton.disabled = false

        if (response?.error) {
          toast({
            title: "Error",
            description: response.error,
            variant: "destructive",
          })
        } else {
          // Clear input only on successful send
          setNewMessage("")
        }
      },
    )
  }

  // Handle creating a poll
  const handleCreatePoll = () => {
    if (!socket || !connected || !pollQuestion.trim() || pollOptions.filter(Boolean).length < 2) return

    // Validate question length
    if (pollQuestion.trim().length < 3) {
      toast({
        title: "Invalid Question",
        description: "Poll question must be at least 3 characters long",
        variant: "destructive",
      })
      return
    }

    // Validate options
    const validOptions = pollOptions.filter((opt) => opt.trim().length >= 1)
    if (validOptions.length < 2) {
      toast({
        title: "Invalid Options",
        description: "You need at least 2 valid options for a poll",
        variant: "destructive",
      })
      return
    }

    setIsCreatingPoll(true)

    socket.emit(
      "create-poll",
      {
        roomId: lectureId,
        question: pollQuestion,
        options: validOptions,
      },
      (response: any) => {
        setIsCreatingPoll(false)

        if (response?.error) {
          toast({
            title: "Error",
            description: response.error,
            variant: "destructive",
          })
        } else if (response?.success) {
          setPollQuestion("")
          setPollOptions(["", ""])
          setShowPollDialog(false)

          toast({
            title: "Poll Created",
            description: "Your poll has been created successfully",
            variant: "default",
          })
        }
      },
    )
  }

  // Handle voting on a poll
  const handleVotePoll = (pollId: string, optionId: string) => {
    if (!socket || !connected) return

    // Check if poll is closed or user already voted
    const poll = activePolls.find(p => p.id === pollId)
    if (!poll || poll.status === PollStatus.ENDED) {
      toast({
        title: "Cannot vote",
        description: "This poll has been closed",
        variant: "destructive",
      })
      return
    }

    if (userVotes[pollId]) {
      toast({
        title: "Already voted",
        description: "You have already voted on this poll",
        variant: "destructive",
      })
      return
    }

    // Optimistic update
    setActivePolls((prev) =>
      prev.map((poll) => {
        if (poll.id === pollId) {
          return {
            ...poll,
            options: poll.options.map((opt) => ({
              ...opt,
              votes: opt.id === optionId ? opt.votes + 1 : opt.votes,
            })),
          }
        }
        return poll
      }),
    )

    setUserVotes((prev) => ({ ...prev, [pollId]: optionId }))

    // Send to server with reconciliation
    socket.emit(
      "vote-poll",
      {
        roomId: lectureId,
        pollId,
        optionId,
      },
      (response: any) => {
        if (response?.error) {
          // Revert optimistic update if error
          toast({
            title: "Error",
            description: response.error,
            variant: "destructive",
          })

          // Reset state based on server data
          if (response.currentPoll) {
            setActivePolls((prev) => prev.map((poll) => (poll.id === pollId ? response.currentPoll : poll)))

            if (response.userVoted) {
              // If user already voted for a different option
              setUserVotes((prev) => ({ ...prev, [pollId]: response.userVoted }))
            } else {
              // If user hasn't voted yet
              setUserVotes((prev) => {
                const newVotes = { ...prev }
                delete newVotes[pollId]
                return newVotes
              })
            }
          }
        } else if (response?.success) {
          // Update with server data to ensure consistency
          if (response.poll) {
            setActivePolls((prev) => prev.map((poll) => (poll.id === pollId ? response.poll : poll)))
          }

          if (response.userVote) {
            setUserVotes((prev) => ({ ...prev, [pollId]: response.userVote }))
          }
        }
      },
    )
  }

  // Handle closing a poll
  const handleClosePoll = (pollId: string) => {
    if (!socket || !connected) return

    // Show loading toast
    toast({
      title: "Closing poll...",
      description: "Please wait while we close the poll.",
    })

    // Find the current poll to preserve its data
    const currentPoll = activePolls.find(p => p.id === pollId)
    if (!currentPoll) {
      toast({
        title: "Error",
        description: "Poll not found",
        variant: "destructive",
      })
      return
    }

    socket.emit(
      "close-poll",
      {
        roomId: lectureId,
        pollId,
      },
      (response: any) => {
        if (response?.error) {
          toast({
            title: "Error",
            description: response.error || "Failed to close poll",
            variant: "destructive",
          })
        } else if (response?.success) {
          toast({
            title: "Poll closed",
            description: "The poll has been closed successfully.",
          })
          
          // Update the poll status in the UI immediately while preserving votes
          setActivePolls((prev) =>
            prev.map((p) =>
              p.id === pollId
                ? { ...p, status: PollStatus.ENDED, endedAt: new Date().toISOString() }
                : p
            )
          )
          
          // Remove the poll from UI after a short delay
          setTimeout(() => {
            setActivePolls((prev) => prev.filter((p) => p.id !== pollId))
          }, 5000) // 5 seconds delay to allow users to see the final results
        }
      }
    )
  }

  // Add a new function to ensure pinned message appears in UI and localStorage
  const forcePinnedMessageUpdate = (message: ChatMessage) => {
    console.log(`[LiveChat DEBUG] Forcing pinned message update with message ID: ${message.id}`);
    
    // Create a properly pinned message
    const pinnedMessage = {
      ...message,
      isPinned: true
    };
    
    // Update the state directly
    setPinnedMessage(pinnedMessage);
    
    // Also update in messages list
    setMessages((prev) => prev.map((msg) => 
      msg.id === message.id ? { ...msg, isPinned: true } : msg
    ));
    
    // Store the pinned message in localStorage for persistence
    try {
      localStorage.setItem(`pinned-message-${lectureId}`, JSON.stringify(pinnedMessage));
      console.log(`[LiveChat DEBUG] Pinned message stored in localStorage`);
    } catch (err) {
      console.error(`[LiveChat DEBUG] Failed to store pinned message in localStorage:`, err);
    }
    
    return pinnedMessage;
  }

  // Update handlePinMessage to ensure UI updates properly
  const handlePinMessage = (messageId: string) => {
    console.log(`[PIN DEBUG] handlePinMessage called with messageId: ${messageId}`);
    
    if (!socket || !connected) {
      console.error("[LiveChat DEBUG] Cannot pin message: No socket connection");
      toast({
        title: "Connection Error",
        description: "Cannot pin message. Please check your connection.",
        variant: "destructive",
      });
      return;
    }
  
    // Show loading toast
    toast({
      title: "Pinning message...",
      description: "Please wait while we pin the message",
      variant: "default",
    });
  
    // Find the message to pin in our local state
    const messageToPin = messages.find(msg => msg.id === messageId);
    if (!messageToPin) {
      console.error(`[LiveChat DEBUG] Message with ID ${messageId} not found in messages array`);
      toast({
        title: "Error",
        description: "Could not find the message to pin",
        variant: "destructive",
      });
      return;
    }
  
    console.log(`[LiveChat DEBUG] Found message to pin: ${JSON.stringify(messageToPin)}`);
    
    // First, apply the pinned message change locally to ensure immediate UI update
    const updatedPinnedMessage = forcePinnedMessageUpdate(messageToPin);
    
    // Then communicate with the server for persistence
    socket.emit(
      "pin-message",
      {
        roomId: lectureId,
        messageId,
      },
      (response: { error?: string; success?: boolean; message?: ChatMessage }) => {
        console.log("[LiveChat DEBUG] Received pin-message callback response:", JSON.stringify(response));
        
        if (response?.error) {
          console.error(`[LiveChat DEBUG] Error pinning message: ${response.error}`);
          
          // If server-side pinning fails, use our local forcePinMessage as fallback
          console.log("[LiveChat DEBUG] Attempting to force-pin message through direct Redis call");
          
          socket.emit(
            "force-pin-message",
            {
              roomId: lectureId,
              message: updatedPinnedMessage // Send the already locally updated message
            },
            (forcePinResponse: { success?: boolean; error?: string }) => {
              if (forcePinResponse?.success) {
                console.log("[LiveChat DEBUG] Force pin message succeeded");
                toast({
                  title: "Message Pinned",
                  description: "The message has been pinned successfully",
                  variant: "default",
                });
              } else {
                console.error("[LiveChat DEBUG] Force pin message failed:", forcePinResponse?.error);
                toast({
                  title: "Error",
                  description: forcePinResponse?.error || "Failed to pin message",
                  variant: "destructive",
                });
              }
            }
          );
        } else if (response?.success) {
          console.log("[LiveChat DEBUG] Pin message success response received");
          
          if (response.message) {
            console.log("[LiveChat DEBUG] Setting pinned message from callback response");
            // Just to be extra sure, update again
            forcePinnedMessageUpdate(response.message);
          }
          
          toast({
            title: "Message Pinned",
            description: "The message has been pinned successfully",
            variant: "default",
          });
        }
      }
    );
  };

  // Update the handleUnpinMessage function with better error handling, cleanup, and deduplication
  const handleUnpinMessage = () => {
    if (!socket || !connected) {
      toast({
        title: "Connection Error",
        description: "Cannot unpin message. Please check your connection.",
        variant: "destructive",
      });
      return;
    }

    // First, perform local update to ensure immediate UI response
    const previousPinnedMessage = pinnedMessage;
    
    // Update local UI state immediately
    setPinnedMessage(null);
    
    // Also update in messages list to ensure consistency
    setMessages((prev) => {
      // First remove any isPinned flags
      const updatedMessages = prev.map((msg) => 
        msg.isPinned ? { ...msg, isPinned: false } : msg
      );
      
      // Now remove duplicate messages (same id) and messages older than 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const seenIds = new Set();
      
      return updatedMessages.filter(message => {
        // Skip if we've already seen this ID
        if (seenIds.has(message.id)) {
          return false;
        }
        
        // Add this ID to our seen set
        seenIds.add(message.id);
        
        // Keep message if it's newer than 30 minutes or it's pinned
        const isRecent = new Date(message.createdAt) > new Date(thirtyMinutesAgo);
        return isRecent || message.isPinned;
      });
    });
    
    // Clean up localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`pinned-message-${lectureId}`);
    }

    // Show loading toast
    toast({
      title: "Unpinning message...",
      description: "Please wait while we unpin the message",
      variant: "default",
    });

    socket.emit(
      "unpin-message",
      {
        roomId: lectureId,
      },
      (response: { error?: string; success?: boolean }) => {
        if (response?.error) {
          // Restore previous state if server fails
          setPinnedMessage(previousPinnedMessage);
          if (previousPinnedMessage) {
            setMessages((prev) => prev.map((msg) => 
              msg.id === previousPinnedMessage.id ? { ...msg, isPinned: true } : msg
            ));
            // Restore localStorage
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(`pinned-message-${lectureId}`, JSON.stringify(previousPinnedMessage));
              } catch (err) {
                console.error('[LiveChat] Failed to restore pinned message in localStorage', err);
              }
            }
          }
          
          toast({
            title: "Error",
            description: response.error,
            variant: "destructive",
          });
        } else if (response?.success) {
          toast({
            title: "Message Unpinned",
            description: "The message has been unpinned",
            variant: "default",
          });
          
          // Broadcast the update to all clients to ensure consistency
          broadcastPinnedMessageState(null);
        }
      }
    );
  };

  // Handle deleting a message
  const handleDeleteMessage = (messageId: string) => {
    if (!socket || !connected) return

    socket.emit("delete-message", {
      roomId: lectureId,
      messageId,
    })
  }

  // Handle muting a user
  const handleMuteUser = (userId: string, durationMinutes = 10) => {
    if (!socket || !connected) return

    socket.emit("mute-user", {
      roomId: lectureId,
      userId,
      durationMinutes,
    })
  }

  // Handle unmuting a user
  const handleUnmuteUser = (userId: string) => {
    if (!socket || !connected) return

    socket.emit("unmute-user", {
      roomId: lectureId,
      userId,
    })
  }

  // Handle updating room settings
  const handleUpdateSettings = (values: z.infer<typeof settingsFormSchema>) => {
    if (!socket || !connected) return

    socket.emit("update-room-settings", {
      roomId: lectureId,
      settings: values,
    })

    setShowSettings(false)
    toast({
      title: "Settings Updated",
      description: "Chat settings have been updated successfully.",
    })
  }

  // Add a new function to handle the storage of chat room state for better persistence
  const persistRoomState = (roomId: string, isActive: boolean) => {
    if (typeof window === 'undefined') return;
    const key = `chat-room-active-${roomId}`;
    localStorage.setItem(key, isActive.toString());
    // Dispatch a storage event to notify other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key,
      newValue: isActive.toString(),
      storageArea: localStorage
    }));
  };

  // Update handleToggleRoom function to use the new persistence function
  const handleToggleRoom = (isActive: boolean) => {
    if (!socket || !connected) return;
  
    socket.emit("toggle-room", {
      roomId: lectureId,
      isActive,
    });
    
    // Persist the state immediately without waiting for server response
    persistRoomState(lectureId, isActive);
    
    // Update local state
    if (room) {
      setRoom({
        ...room,
        isActive
      });
    }
  }

  // Handle toggling the chat room
  const handleToggleRoomOld = (isActive: boolean) => {
    if (!socket || !connected) return

    socket.emit("toggle-room", {
      roomId: lectureId,
      isActive,
    })
  }

  // Handle starting/ending the lecture
  const handleToggleLecture = (isLive: boolean) => {
    if (!socket || !connected) return

    socket.emit("toggle-lecture", {
      lectureId,
      isLive,
    }, (response: { error?: string; success?: boolean }) => {
      if (response?.error) {
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive",
        });
      } else if (response?.success) {
        setIsLectureLive(isLive);
        
        // When ending a lecture, also deactivate the chat
        if (!isLive) {
          setIsLectureChatVisible(false);
          toast({
            title: "Lecture Ended",
            description: "The lecture and chat have been ended.",
          });
        } else {
          toast({
            title: "Lecture Started",
            description: "The lecture is now live. You can activate the chat when ready.",
          });
        }
      }
    });
  }

  // Handle starting the chat (for creators/admins only)
  const handleActivateChat = () => {
    if (!socket || !connected) return;

    socket.emit("activate-chat", {
      roomId: lectureId,
      lectureId,
    }, (response: { error?: string; success?: boolean }) => {
      if (response?.error) {
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive",
        });
      } else if (response?.success) {
        setIsLectureChatVisible(true);
        toast({
          title: "Chat Activated",
          description: "Live chat is now visible to all participants",
        });
      }
    });
  };

  // Handle deactivating the chat (hiding it from students but keeping the lecture live)
  const handleDeactivateChat = () => {
    if (!socket || !connected) return;
  
    console.log("[LiveChat] Sending deactivate-chat event for roomId:", lectureId);
  
    setIsLoading(true);
  
    socket.emit("deactivate-chat", {
      roomId: lectureId
    }, (response: { error?: string; success?: boolean }) => {
      setIsLoading(false);
      
      if (response?.error) {
        console.error("[LiveChat] Error deactivating chat:", response.error);
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive",
        });
      } else if (response?.success) {
        console.log("[LiveChat] Chat successfully deactivated");
        setIsLectureChatVisible(false);
        
        // Store state immediately in localStorage for cross-tab persistence
        localStorage.setItem(`lecture-chat-visibility-${lectureId}`, 'false');
        
        toast({
          title: "Chat Deactivated",
          description: "Live chat is now hidden from participants",
        });
      }
    });
  };

  // Add a poll option
  const addPollOption = () => {
    setPollOptions([...pollOptions, ""])
  }

  // Remove a poll option
  const removePollOption = (index: number) => {
    if (pollOptions.length <= 2) return
    const newOptions = [...pollOptions]
    newOptions.splice(index, 1)
    setPollOptions(newOptions)
  }

  // Update a poll option
  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions]
    newOptions[index] = value
    setPollOptions(newOptions)
  }

  // Get user role badge
  const getUserRoleBadge = (role: UserRole) => {
    switch (role) {
      case "CREATOR":
        return (
          <Badge variant="default" className="bg-primary text-primary-foreground">
            Instructor
          </Badge>
        )
      case "ADMIN":
        return (
          <Badge variant="default" className="bg-destructive text-destructive-foreground">
            Admin
          </Badge>
        )
      default:
        return null
    }
  }

  // Get user role icon
  const getUserRoleIcon = (role: UserRole) => {
    switch (role) {
      case "CREATOR":
        return <Shield className="h-3 w-3 text-primary" />
      case "ADMIN":
        return <ShieldAlert className="h-3 w-3 text-destructive" />
      default:
        return <User className="h-3 w-3 text-muted-foreground" />
    }
  }

  // Format message timestamp
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return format(date, "h:mm a")
  }

  // Check if user is muted
  const isUserMuted = (userId: string) => {
    return mutedUsers.some((user) => user.userId === userId)
  }

  // Get online participant count
  const getOnlineParticipantCount = () => {
    return participants.filter((p) => p.isOnline).length
  }

  // Mobile view handling with proper state management
  const handleCloseMobileChat = () => {
    setShowMobileChat(false);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle tab switching / component unmounting to persist state
  useEffect(() => {
    // Only run this effect on client-side
    if (typeof window === 'undefined') return;
    
    // Define the storage key for this lecture's chat visibility state
    const visibilityStorageKey = `lecture-chat-visibility-${lectureId}`;
    
    // When component mounts, check if we have a stored visibility state
    const storedVisibilityState = localStorage.getItem(visibilityStorageKey);
    if (storedVisibilityState) {
      console.log(`[LiveChat] Loading stored visibility state for lecture ${lectureId}: ${storedVisibilityState}`);
      // Update state with stored value (only on mount)
      const storedValue = storedVisibilityState === 'true';
      // Only set state if it's different from current state to avoid loops
      if (storedValue !== isLectureChatVisible) {
        setIsLectureChatVisible(storedValue);
      }
    }
    
    // Store visibility state when it changes, but not on every render
    const handleStorageUpdate = () => {
      localStorage.setItem(visibilityStorageKey, isLectureChatVisible.toString());
      console.log(`[LiveChat] Stored visibility state for lecture ${lectureId}: ${isLectureChatVisible}`);
    };
    
    // Add a custom event listener for our own state changes
    window.addEventListener('beforeunload', handleStorageUpdate);
    
    return () => {
      // Clean up event listener
      window.removeEventListener('beforeunload', handleStorageUpdate);
      
      // Store state on unmount
      handleStorageUpdate();
    };
  }, [lectureId]); // Remove isLectureChatVisible from dependencies to prevent loops

  // Add a storage event listener to detect changes in other tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Function to handle storage events from other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === `chat-room-active-${lectureId}`) {
        const isActive = event.newValue === 'true';
        console.log(`[LiveChat] Detected room state change in another tab: ${isActive}`);
        
        // Update local state to match storage
        if (room && room.isActive !== isActive) {
          setRoom({
            ...room,
            isActive
          });
        }
      }
    };
    
    // Check localStorage on mount
    const storedState = localStorage.getItem(`chat-room-active-${lectureId}`);
    if (storedState !== null && room) {
      const isActive = storedState === 'true';
      console.log(`[LiveChat] Loading stored room state: ${isActive}`);
      if (room.isActive !== isActive) {
        setRoom({
          ...room,
          isActive
        });
      }
    }
    
    // Listen for changes in other tabs
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [lectureId, room]);

  // Add this useEffect to restore pinned message from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !pinnedMessage) {
      console.log('[LiveChat DEBUG] Checking localStorage for pinned message');
      try {
        const storedPinnedMessage = localStorage.getItem(`pinned-message-${lectureId}`);
        if (storedPinnedMessage) {
          console.log('[LiveChat DEBUG] Found stored pinned message in localStorage');
          const parsedMessage = JSON.parse(storedPinnedMessage);
          setPinnedMessage(parsedMessage);
        }
      } catch (error) {
        console.error('[LiveChat DEBUG] Error reading pinned message from localStorage:', error);
      }
    }
  }, [lectureId, pinnedMessage]);

  // Add a function to handle the broadcast of pinned message updates to ensure all users see the same state
  const broadcastPinnedMessageState = (message: ChatMessage | null) => {
    if (!socket || !connected) return;

    socket.emit("broadcast-pinned-message-state", {
      roomId: lectureId,
      pinnedMessage: message
    }, (response: { error?: string; success?: boolean }) => {
      if (response?.error) {
        console.error("[LiveChat] Error broadcasting pinned message state:", response.error);
      } else {
        console.log("[LiveChat] Successfully broadcast pinned message state:", message ? message.id : "null");
      }
    });
  };
  
  // Add a listener for pinned message state updates in the useEffect for socket connection
  useEffect(() => {
    if (!socket) return;

    // Listen for pinned message state broadcasts
    socket.on("pinned-message-state-update", (data: { pinnedMessage: ChatMessage | null }) => {
      console.log("[LiveChat] Received pinned message state update:", 
        data.pinnedMessage ? `Message ID: ${data.pinnedMessage.id}` : "No pinned message");
      
      // Update local state
      if (data.pinnedMessage) {
        setPinnedMessage(data.pinnedMessage);
        // Also mark the message as pinned in the regular messages list
        setMessages((prev) => prev.map((msg) => 
          msg.id === data.pinnedMessage?.id ? { ...msg, isPinned: true } : msg
        ));
        
        // Store in localStorage for persistence
        try {
          localStorage.setItem(`pinned-message-${lectureId}`, JSON.stringify(data.pinnedMessage));
        } catch (err) {
          console.error('[LiveChat] Error storing pinned message in localStorage:', err);
        }
      } else {
        // Clear pinned message
        setPinnedMessage(null);
        // Remove pinned status from all messages
        setMessages((prev) => prev.map((msg) => 
          msg.isPinned ? { ...msg, isPinned: false } : msg
        ));
        // Clear localStorage
        localStorage.removeItem(`pinned-message-${lectureId}`);
      }
    });

    return () => {
      socket.off("pinned-message-state-update");
    };
  }, [socket, lectureId]);

  // Add a useEffect to clean up old messages every 5 minutes
  useEffect(() => {
    if (!messages.length) return;
    
    // Function to remove messages older than 30 minutes
    const cleanupOldMessages = () => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      setMessages((prev) => {
        // Keep only messages that are pinned or newer than 30 minutes
        return prev.filter(message => {
          // Always keep pinned messages regardless of age
          if (message.isPinned) return true;
          
          // Remove old messages
          const isRecent = new Date(message.createdAt) > new Date(thirtyMinutesAgo);
          return isRecent;
        });
      });
      
      console.log("[LiveChat] Cleaned up messages older than 30 minutes");
    };
    
    // Initial cleanup when component mounts
    cleanupOldMessages();
    
    // Set up interval to run cleanup every 5 minutes
    const cleanupInterval = setInterval(cleanupOldMessages, 5 * 60 * 1000);
    
    // Clean up interval on component unmount
    return () => clearInterval(cleanupInterval);
  }, [messages.length]); // Only re-setup when messages array length changes

  // Update the loading check to include the initializing state
  if (isLoading || initializing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If lecture is not live and user is not creator/admin, show appropriate message
  if (!isLectureLive && !isCreator && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <MessageSquareOff className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Chat Not Available</h3>
        <p className="text-muted-foreground text-center">
          The lecture is not live yet. Chat will be available when the instructor starts the lecture.
        </p>
      </div>
    )
  }

  // If creator/admin and lecture is not live, show option to start
  if (!isLectureLive && (isCreator || isAdmin)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Chat Not Started</h3>
        <p className="text-muted-foreground text-center mb-4">
          The live chat for this lecture has not been started yet.
        </p>
        <Button 
          onClick={() => {
            // Set a default lecture ID if none is provided
            const currentLectureId = lectureId || 'default-lecture';
            
            if (socket && connected) {
              handleToggleLecture(true);
            } else {
              toast({
                title: "Connection Error",
                description: "Cannot start the lecture. Please try again.",
                variant: "destructive",
              });
            }
          }}
        >
          Start Live Lecture
        </Button>
      </div>
    )
  }

  // If lecture is live but chat is not visible to students yet (only for non-admin/non-creator users)
  if (isLectureLive && !isLectureChatVisible && !isCreator && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <MessageSquareOff className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Chat Coming Soon</h3>
        <p className="text-muted-foreground text-center">
          The instructor has not activated the chat yet. Please wait for the instructor to enable chat functionality.
        </p>
      </div>
    )
  }

  // If lecture is live but chat not activated yet (only for admin/creator)
  if (isLectureLive && !isLectureChatVisible && (isCreator || isAdmin)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Activate Live Chat</h3>
        <p className="text-muted-foreground text-center mb-4">
          The lecture is live but chat is not visible to participants yet. Activate it when you're ready to allow student interaction.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <Button onClick={handleActivateChat}>
            Activate Live Chat
          </Button>
        </div>
      </div>
    )
  }

  // Ensure room is not null before rendering the main chat UI
  if (!room) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Main chat UI - used for both students and creators, with permissions handled via props
  return (
    <div>
      {/* Mobile Chat Toggle */}
      <div className="lg:hidden fixed bottom-20 right-4 z-40">
        <Button
          variant="default"
          size="icon"
          className="rounded-full shadow-lg"
          onClick={() => setShowMobileChat(true)}
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile Chat Sheet */}
      <Sheet open={showMobileChat} onOpenChange={setShowMobileChat}>
        <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col">
          <SheetHeader className="px-4 py-2 border-b">
            <div className="flex justify-between items-center">
              <SheetTitle>Live Chat</SheetTitle>
              <Button variant="ghost" size="icon" onClick={handleCloseMobileChat}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SheetDescription>
              {room?.isActive ? "Chat with other participants" : "Chat is currently disabled"}
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="px-4 pt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="polls" disabled={!room?.settings?.allowPolls}>
                    Polls {activePolls.length > 0 && `(${activePolls.length})`}
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col mt-0">
                <div className="px-4 py-2 flex-1 overflow-hidden flex flex-col">
                  {/* Pinned Message */}
                  {pinnedMessage && (
                    <PinnedMessageBanner 
                      message={pinnedMessage} 
                      onUnpin={handleUnpinMessage} 
                      isCreatorOrAdmin={isModeratorOrAdmin} 
                    />
                  )}
                  
                  {/* Messages */}
                  <ScrollArea className="flex-1 pr-2">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No messages yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4 pb-4">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.userId === session?.user?.id ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`rounded-lg p-3 max-w-[85%] break-words ${
                                message.userId === session?.user?.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              } ${message.isDeleted ? "opacity-60" : ""}`}
                            >
                              {message.userId !== session?.user?.id && (
                                <div className="flex items-center mb-1">
                                  <Avatar className="h-5 w-5 mr-1">
                                    <AvatarImage src={message.userImage || "/placeholder.svg"} />
                                    <AvatarFallback>{message.userName.charAt(0).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-medium">{message.userName}</span>
                                </div>
                              )}
                              <p className="text-sm">{message.content}</p>
                              <div className="mt-1 flex justify-between items-center">
                                <span className="text-xs opacity-70">
                                  {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                                </span>
                                {!message.isDeleted && isModeratorOrAdmin && (
                                  <div className="flex gap-1">
                                    {!message.isPinned && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => handlePinMessage(message.id)}
                                      >
                                        <Pin className="h-3 w-3" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-destructive"
                                      onClick={() => handleDeleteMessage(message.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>
                </div>
                
                {/* Message Input */}
                <div className="p-4 border-t mt-auto">
                  {room?.isActive ? (
                    isMuted ? (
                      <div className="bg-destructive/10 text-destructive text-sm p-2 rounded-md">
                        You are muted and cannot send messages
                      </div>
                    ) : (
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendMessage();
                        }}
                        className="flex gap-2"
                      >
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1"
                          disabled={!connected || isLoading}
                        />
                        <Button 
                          type="submit" 
                          size="icon"
                          disabled={!connected || isLoading || !newMessage.trim()}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </form>
                    )
                  ) : (
                    <div className="bg-muted text-muted-foreground text-sm p-2 rounded-md">
                      Chat is currently disabled by the instructor
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="polls" className="flex-1 overflow-hidden flex flex-col p-4 mt-0">
                {isModeratorOrAdmin && (
                  <Button variant="outline" onClick={() => setShowPollDialog(true)} className="mb-4">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create Poll
                  </Button>
                )}
                
                <ScrollArea className="flex-1">
                  {activePolls.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <BarChart className="h-12 w-12 mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">No active polls</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activePolls.map((poll) => (
                        <div key={poll.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium">{poll.question}</h4>
                            {isCreator && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleClosePoll(poll.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="space-y-2 mt-4">
                            {poll.options.map((option) => {
                              const totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes, 0);
                              const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                              const userVoted = userVotes[poll.id] === option.id;
                              
                              return (
                                <div key={option.id} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">{option.text}</span>
                                    <span className="text-sm font-medium">{percentage}%</span>
                                  </div>
                                  <div className="relative h-8">
                                    <Progress value={percentage} className="h-8" />
                                    <div 
                                      className="absolute inset-0 flex items-center justify-between px-3" 
                                      style={{ zIndex: 1 }}
                                    >
                                      <span className="text-xs font-medium text-white">
                                        {option.votes} votes
                                      </span>
                                      <Button
                                        variant={userVoted ? "default" : "outline"}
                                        size="sm"
                                        className={`h-6 text-xs ${userVoted ? "bg-primary text-primary-foreground" : ""}`}
                                        disabled={Boolean(userVotes[poll.id]) || poll.status === PollStatus.ENDED}
                                        onClick={() => handleVotePoll(poll.id, option.id)}
                                      >
                                        {userVoted ? "Voted" : "Vote"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Chat */}
      <div className="hidden lg:flex h-full flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center">
            <h3 className="font-medium">Live Chat</h3>
            <Badge variant="outline" className="ml-2">
              {getOnlineParticipantCount()} online
            </Badge>
          </div>
          {isModeratorOrAdmin && (
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setShowParticipants(true)}>
                      <Users className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Participants</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant={room.isActive ? "ghost" : "default"}
                    size="sm"
                    className={room.isActive ? "" : "bg-green-500 hover:bg-green-600"}
                  >
                    {room.isActive ? "Disable Chat" : "Enable Chat"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{room.isActive ? "Disable Chat?" : "Enable Chat?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {room.isActive
                        ? "This will disable the chat for all participants. They will no longer be able to send messages."
                        : "This will enable the chat for all participants. They will be able to send messages."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleToggleRoom(!room.isActive)}>
                      {room.isActive ? "Disable" : "Enable"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Chat Visibility Toggle Button for Creator/Admin */}
              {(isCreator || isAdmin) && isLectureChatVisible && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      End Chat
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>End Chat?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will hide the chat from students, but keep the lecture live. You can reactivate it later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeactivateChat}>Deactivate</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* End Lecture Button removed as it is not needed */}
            </div>
          )}
        </div>

        {/* Pinned Message */}
        {pinnedMessage && (
          <PinnedMessageBanner 
            message={pinnedMessage} 
            onUnpin={handleUnpinMessage} 
            isCreatorOrAdmin={isModeratorOrAdmin} 
          />
        )}

        {/* Chat Content */}
        <Tabs defaultValue="chat" className="flex-1 flex flex-col" onValueChange={setActiveTab}>
          <TabsList className="px-4 pt-2 border-b rounded-none justify-start">
            <TabsTrigger value="chat" className="data-[state=active]:bg-muted/50">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="polls" className="data-[state=active]:bg-muted/50">
              <BarChart className="h-4 w-4 mr-2" />
              Polls
              {activePolls.filter((p) => p.status === PollStatus.ACTIVE).length > 0 && (
                <Badge variant="default" className="ml-2 bg-primary text-primary-foreground">
                  {activePolls.filter((p) => p.status === PollStatus.ACTIVE).length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col p-0 m-0">
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <MessageSquarePlus className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No messages yet</h3>
                  <p className="text-muted-foreground">Be the first to send a message in this chat!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* First render pinned message separately using the PinnedMessageBanner component */}
                  {messages.map((message) => {
                    // Skip messages that match the pinned message ID to avoid duplicates
                    if (pinnedMessage && message.id === pinnedMessage.id) {
                      return null;
                    }
                    
                    return (
                      <div key={message.id} className="group">
                        {message.type === ChatMessageType.SYSTEM ? (
                          <div className="flex justify-center">
                            <div className="bg-muted/30 text-xs text-muted-foreground py-1 px-3 rounded-full">
                              {message.content}
                            </div>
                          </div>
                        ) : message.type === ChatMessageType.POLL ? (
                          // ... existing poll message rendering
                          <div className="bg-muted/20 rounded-lg p-3">
                            <div className="flex items-start">
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarImage src={message.userImage || "/placeholder.svg"} />
                                <AvatarFallback>{message.userName.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                {/* ... rest of poll content ... */}
                                <div className="flex items-center">
                                  <span className="font-medium text-sm">{message.userName}</span>
                                  {getUserRoleBadge(message.userRole)}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {formatMessageTime(message.createdAt)}
                                  </span>
                                </div>
                                <div className="mt-1">
                                  <div className="font-medium mb-2">{message.poll?.question}</div>
                                  {/* ... rest of poll content ... */}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : message.type === ChatMessageType.ANNOUNCEMENT ? (
                          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                            <div className="flex items-start">
                              <Megaphone className="h-5 w-5 text-primary mr-2 mt-0.5" />
                              <div>
                                <div className="flex items-center">
                                  <span className="font-medium text-sm">{message.userName}</span>
                                  {getUserRoleBadge(message.userRole)}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {formatMessageTime(message.createdAt)}
                                  </span>
                                </div>
                                <div className="mt-1 font-medium">{message.content}</div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex group">
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarImage src={message.userImage || "/placeholder.svg"} />
                              <AvatarFallback>{message.userName.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center">
                                <span className="font-medium text-sm">{message.userName}</span>
                                {getUserRoleBadge(message.userRole)}
                                <span className="text-xs text-muted-foreground ml-2">
                                  {formatMessageTime(message.createdAt)}
                                </span>
                              </div>
                              <div className={`mt-1 ${message.isDeleted ? "text-muted-foreground italic" : ""}`}>
                                {message.content}
                              </div>
                            </div>
                            {!message.isDeleted && isModeratorOrAdmin && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {!message.isPinned ? (
                                    <DropdownMenuItem onClick={() => {
                                      console.log(`[Pin DEBUG] Pin button clicked for message ID: ${message.id}`);
                                      handlePinMessage(message.id);
                                    }}>
                                      <Pin className="h-4 w-4 mr-2" />
                                      Pin Message
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => {
                                      console.log(`[Pin DEBUG] Unpin button clicked for pinnedMessage`);
                                      handleUnpinMessage();
                                    }}>
                                      <PinOff className="h-4 w-4 mr-2" />
                                      Unpin Message
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleDeleteMessage(message.id)}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Message
                                  </DropdownMenuItem>
                                  {message.userId !== session?.user?.id &&
                                    message.userRole !== "CREATOR" &&
                                    message.userRole !== "ADMIN" && (
                                      <>
                                        <DropdownMenuSeparator />
                                        {!isUserMuted(message.userId) ? (
                                          <DropdownMenuItem onClick={() => handleMuteUser(message.userId)}>
                                            <VolumeX className="h-4 w-4 mr-2" />
                                            Mute User
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem onClick={() => handleUnmuteUser(message.userId)}>
                                            <Volume2 className="h-4 w-4 mr-2" />
                                            Unmute User
                                          </DropdownMenuItem>
                                        )}
                                      </>
                                    )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-3 border-t">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={isMuted ? "You are muted" : room.isActive ? "Type a message..." : "Chat is disabled"}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={isMuted || !room.isActive}
                  className="flex-1"
                />
                <Button
                  id="send-message-button"
                  size="icon"
                  disabled={!newMessage.trim() || isMuted || !room.isActive}
                  onClick={handleSendMessage}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {isModeratorOrAdmin && room.settings.allowPolls && (
                <div className="mt-2 flex justify-end">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowPollDialog(true)}>
                    <BarChart className="h-3 w-3 mr-1" />
                    Create Poll
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="polls" className="flex-1 flex flex-col p-0 m-0">
            <ScrollArea className="flex-1 p-4">
              {activePolls.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <BarChart className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No polls yet</h3>
                  {isModeratorOrAdmin && room.settings.allowPolls ? (
                    <div>
                      <p className="text-muted-foreground mb-4">Create a poll to gather feedback from participants.</p>
                      <Button onClick={() => setShowPollDialog(true)}>Create Poll</Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No polls have been created for this session yet.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Polls</h3>
                    {isModeratorOrAdmin && room.settings.allowPolls && (
                      <Button variant="outline" size="sm" onClick={() => setShowPollDialog(true)}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        New Poll
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {activePolls.map((poll) => {
                      const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0)

                      return (
                        <div
                          key={poll.id}
                          className={`border rounded-lg p-4 ${
                            poll.status === PollStatus.ACTIVE ? "border-primary/20 bg-primary/5" : "border-muted"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <BarChart
                                className={`h-4 w-4 mr-2 ${
                                  poll.status === PollStatus.ACTIVE ? "text-primary" : "text-muted-foreground"
                                }`}
                              />
                              <h4 className="font-medium">{poll.question}</h4>
                            </div>
                            <Badge
                              variant={poll.status === PollStatus.ACTIVE ? "default" : "outline"}
                              className={poll.status === PollStatus.ACTIVE ? "bg-primary text-primary-foreground" : ""}
                            >
                              {poll.status === PollStatus.ACTIVE ? "Active" : "Closed"}
                            </Badge>
                          </div>

                          <div className="space-y-3 mb-4">
                            {poll.options.map((option: { id: string; text: string; votes: number }) => {
                              const percentage =
                                totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0
                              const isVoted = userVotes[poll.id] === option.id
                              const isDisabled =
                                poll.status === PollStatus.ENDED ||
                                userVotes[poll.id] !== undefined

                              return (
                                <div key={option.id} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <Button
                                        variant={isVoted ? "default" : "outline"}
                                        size="sm"
                                        className={`text-xs h-7 ${
                                          isVoted ? "bg-primary text-primary-foreground" : ""
                                        }`}
                                        disabled={isDisabled}
                                        onClick={() => handleVotePoll(poll.id, option.id)}
                                      >
                                        {isVoted && <CheckCircle className="h-3 w-3 mr-1" />}
                                        {option.text}
                                      </Button>
                                      <span className="text-xs ml-2">
                                        {option.votes} {option.votes === 1 ? "vote" : "votes"}
                                      </span>
                                    </div>
                                    <span className="text-xs font-medium">{percentage}%</span>
                                  </div>
                                  <Progress value={percentage} className="h-1" />
                                </div>
                              )
                            })}
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>
                                Created{" "}
                                {formatDistanceToNow(new Date(poll.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            <div>
                              {totalVotes} {totalVotes === 1 ? "vote" : "votes"} total
                            </div>
                          </div>

                          {isModeratorOrAdmin && poll.status === PollStatus.ACTIVE && (
                            <div className="mt-3 flex justify-end">
                              <Button variant="outline" size="sm" onClick={() => handleClosePoll(poll.id)}>
                                Close Poll
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Participants Sheet */}
      <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Participants</SheetTitle>
            <SheetDescription>
              {getOnlineParticipantCount()} of {participants.length} online
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <div className="space-y-4">
              {participants.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No participants yet</p>
                </div>
              ) : (
                <>
                  {/* Moderators */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Moderators</h4>
                    <div className="space-y-2">
                      {participants
                        .filter((p) => p.userRole === "CREATOR" || p.userRole === "ADMIN")
                        .map((participant) => (
                          <div
                            key={participant.userId}
                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                          >
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarImage src={participant.userImage || "/placeholder.svg"} />
                                <AvatarFallback>{participant.userName.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center">
                                  <span className="font-medium text-sm">{participant.userName}</span>
                                  {getUserRoleBadge(participant.userRole)}
                                </div>
                                <div className="flex items-center text-xs text-muted-foreground">
                                  {getUserRoleIcon(participant.userRole)}
                                  <span className="ml-1">
                                    {participant.userRole === "CREATOR" ? "Instructor" : "Admin"}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant={participant.isOnline ? "default" : "outline"}
                              className={participant.isOnline ? "bg-green-500 text-white border-none" : ""}
                            >
                              {participant.isOnline ? "Online" : "Offline"}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Students */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Students</h4>
                    <div className="space-y-2">
                      {participants
                        .filter((p) => p.userRole !== "CREATOR" && p.userRole !== "ADMIN")
                        .map((participant) => (
                          <div
                            key={participant.userId}
                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                          >
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarImage src={participant.userImage || "/placeholder.svg"} />
                                <AvatarFallback>{participant.userName.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-medium text-sm">{participant.userName}</span>
                                <div className="flex items-center text-xs text-muted-foreground">
                                  {getUserRoleIcon(participant.userRole)}
                                  <span className="ml-1">Student</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={participant.isOnline ? "default" : "outline"}
                                className={participant.isOnline ? "bg-green-500 text-white border-none" : ""}
                              >
                                {participant.isOnline ? "Online" : "Offline"}
                              </Badge>
                              {isModeratorOrAdmin && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {!isUserMuted(participant.userId) ? (
                                      <DropdownMenuItem onClick={() => handleMuteUser(participant.userId)}>
                                        <VolumeX className="h-4 w-4 mr-2" />
                                        Mute User
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => handleUnmuteUser(participant.userId)}>
                                        <Volume2 className="h-4 w-4 mr-2" />
                                        Unmute User
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chat Settings</DialogTitle>
          </DialogHeader>
          <Form {...settingsForm}>
            <form onSubmit={settingsForm.handleSubmit(handleUpdateSettings)} className="space-y-4">
              <FormField
                control={settingsForm.control}
                name="isModerated"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Moderation</FormLabel>
                      <FormDescription>Show system messages for chat events</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={settingsForm.control}
                name="allowPolls"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Allow Polls</FormLabel>
                      <FormDescription>Enable polls in this chat room</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={settingsForm.control}
                name="slowMode"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Slow Mode</FormLabel>
                      <FormDescription>Limit how often users can send messages</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {settingsForm.watch("slowMode") && (
                <FormField
                  control={settingsForm.control}
                  name="slowModeInterval"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Slow Mode Interval (seconds)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            min={1}
                            max={60}
                            step={1}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>1s</span>
                            <span>{field.value}s</span>
                            <span>60s</span>
                          </div>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={settingsForm.control}
                name="allowLinks"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Allow Links</FormLabel>
                      <FormDescription>Allow users to share links in chat</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={settingsForm.control}
                name="allowImages"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Allow Images</FormLabel>
                      <FormDescription>Allow users to share images in chat</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={settingsForm.control}
                name="allowReplies"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Allow Replies</FormLabel>
                      <FormDescription>Allow users to reply to messages</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={settingsForm.control}
                name="maxMessageLength"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Maximum Message Length</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Slider
                          min={50}
                          max={1000}
                          step={50}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>50</span>
                          <span>{field.value} characters</span>
                          <span>1000</span>
                        </div>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Poll Dialog */}
      <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Poll</DialogTitle>
            <DialogDescription>Create a poll to gather feedback from participants</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                placeholder="Enter your question"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-2">
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => updatePollOption(index, e.target.value)}
                    />
                    {index > 1 && (
                      <Button variant="ghost" size="icon" type="button" onClick={() => removePollOption(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {pollOptions.length < 6 && (
                <Button variant="outline" type="button" size="sm" className="mt-2" onClick={addPollOption}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPollDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePoll}
              disabled={!pollQuestion.trim() || pollOptions.filter(Boolean).length < 2 || isCreatingPoll}
            >
              {isCreatingPoll ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Creating...
                </>
              ) : (
                "Create Poll"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
