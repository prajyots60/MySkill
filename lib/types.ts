import type { ContentType, LectureType, LiveStatus } from "@prisma/client"

// User roles - only STUDENT, CREATOR, and ADMIN
export type UserRole = "STUDENT" | "CREATOR" | "ADMIN"

// Content types
export type { ContentType, LectureType, LiveStatus }

// Temporary user data stored in Redis during onboarding
export interface TempUserData {
  id: string
  name: string | null
  email: string | null
  image: string | null
  provider: string
  providerAccountId?: string
  accessToken?: string
  refreshToken?: string
  createdAt: Date
  expiresAt: Date
  isTemporary?: boolean
  role?: UserRole
  onboarded?: boolean
}

export interface User {
  id: string
  name: string | null
  email: string | null
  image?: string | null
  role: UserRole
  bio?: string | null
  socialLinks?: Record<string, string> | null
  createdAt: Date
  onboarded: boolean
  youtubeConnected?: boolean
  followers?: number
  creatorProfile?: CreatorProfile | null
}

export interface Course {
  id: string
  title: string
  description: string
  thumbnail?: string | null
  type?: ContentType
  price?: number | null
  isPublished?: boolean
  createdAt?: Date
  updatedAt?: Date
  tags: string[]
  creatorId?: string
  creatorName?: string
  creatorImage?: string | null
  enrollmentCount?: number
  sections?: Section[]
  documents?: Document[]
  creator?: {
    id: string
    name: string | null
    image?: string | null
  }
  _count?: {
    enrollments: number
  }
  // Additional fields for UI display
  rating?: number
  lectureCount?: number
  totalDuration?: string
  level?: string | null
}

export interface Section {
  id: string
  title: string
  description?: string | null
  order: number
  contentId: string
  lectures: Lecture[]
  documents?: Document[]
}

export interface Lecture {
  id: string
  title: string
  description?: string | null
  order: number
  type: LectureType
  videoId?: string | null
  duration?: number | null
  isPreview: boolean
  createdAt: Date
  updatedAt: Date
  liveStatus?: LiveStatus | null
  scheduledAt?: Date | null
  startedAt?: Date | null
  endedAt?: Date | null
  streamData?: Record<string, any> | null
  sectionId: string
  documents?: Document[]
}

export interface Document {
  id: string
  title: string
  description?: string | null
  url: string
  type: string
  size: number
  createdAt: Date
  updatedAt: Date
  contentId?: string | null
  sectionId?: string | null
  lectureId?: string | null
  creatorId: string
}

export interface Enrollment {
  id: string
  enrolledAt: Date
  userId: string
  contentId: string
}

// Update the Progress interface to include timeSpentSeconds
export interface Progress {
  id: string
  percentage: number
  isComplete: boolean
  updatedAt: Date
  userId: string
  lectureId: string
  timeSpentSeconds?: number
}

// Update the UserProgress interface to include more fields
export interface UserProgress {
  courseId: string
  completedLectures: number
  totalLectures: number
  percentage: number
  lastAccessed: Date | null
  nextLecture?: {
    id: string
    title: string
    sectionId?: string
  } | null
  totalTimeSpent?: number
}

export enum ChatMessageType {
  TEXT = "TEXT",
  POLL = "POLL",
  SYSTEM = "SYSTEM",
  ANNOUNCEMENT = "ANNOUNCEMENT",
}

export enum PollStatus {
  ACTIVE = "ACTIVE",
  ENDED = "ENDED", // Changed from CLOSED to ENDED for consistency
}

export interface PollOption {
  id: string
  text: string
  votes: number
}

export interface Poll {
  id: string
  roomId: string // Added roomId for better reference
  question: string
  options: PollOption[]
  status: PollStatus
  createdAt: string
  createdBy: string
  endedAt?: string // Added to track when poll was ended
  expiresAt?: string // Added to track expiration time
}

export interface ChatMessage {
  id: string
  roomId: string
  userId: string
  userName: string
  userImage?: string
  userRole: UserRole
  content: string
  type: ChatMessageType
  isPinned: boolean
  pinnedAt?: string // Added to track when message was pinned
  isDeleted: boolean
  poll?: Poll
  createdAt: string
  updatedAt?: string
  metadata?: {
    // Added metadata for extensibility
    deleted?: boolean
    edited?: boolean
    pinned?: boolean
    system?: boolean
  }
}

export interface ChatRoom {
  id: string
  lectureId: string
  isActive: boolean
  isChatVisible?: boolean // Controls visibility of chat to students
  createdAt: string
  lastActivity: string // Make lastActivity required by removing the optional marker
  settings: ChatRoomSettings
}

export interface ChatRoomSettings {
  isModerated: boolean
  allowPolls: boolean
  slowMode: boolean
  slowModeInterval: number
  allowLinks: boolean
  allowImages: boolean
  allowReplies: boolean
  maxMessageLength: number
  chatEnabled: boolean // Added to control chat visibility
}

export interface MutedUser {
  userId: string
  roomId: string
  mutedUntil: string
  mutedBy: string
  reason?: string // Added reason for moderation transparency
}

export interface ChatParticipant {
  userId: string
  userName: string
  userImage?: string
  userRole: UserRole
  isOnline: boolean
  lastActive: string
  sessionId?: string // Added for session persistence
}

export type ChatEvent = {
  type:
    | "JOIN"
    | "LEAVE"
    | "MESSAGE"
    | "PIN"
    | "UNPIN"
    | "DELETE"
    | "MUTE"
    | "UNMUTE"
    | "POLL_CREATE"
    | "POLL_VOTE"
    | "POLL_CLOSE"
    | "CHAT_ENABLED" // Added to enable/disable chat
    | "CHAT_DISABLED" // Added to enable/disable chat
  payload: any
  timestamp: string
  roomId: string // Added for better event routing
}

export interface Comment {
  id: string
  text: string
  createdAt: Date
  updatedAt?: Date
  userId: string
  user?: {
    id: string
    name: string | null
    image?: string | null
  }
  parentId?: string | null
  replies?: Comment[]
}

export interface CreatorProfile {
  id: string
  userId: string
  coverImage?: string | null
  tagline?: string | null
  customTitle?: string | null
  expertise?: string[]
  location?: string | null
  website?: string | null
  education?: string | null
  achievements?: string | null
  yearsTeaching?: string | null
  languages?: string[]
  categories?: string[]
  institutionName?: string | null
  institutionDescription?: string | null
  institutionWebsite?: string | null
  themeColor?: string | null
  milestones?: any | null
  badges?: any | null
  testimonials?: any | null
  resources?: any | null
  resourcesDescription?: string | null
  customSections?: any | null
  verified?: boolean
  showResources?: boolean
  socialLinks?: Record<string, string> | null
  createdAt?: Date
  updatedAt?: Date
}

// Review types
export interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  contentId: string;
  user?: {
    id: string;
    name: string;
    image: string;
  };
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  distribution: {
    [key: number]: {
      count: number;
      percentage: number;
    };
  };
}

export interface ReviewsResponse {
  success: boolean;
  reviews: Review[];
  stats: ReviewStats;
  userReview: Review | null;
}
