import { create } from "zustand"
import type { Course, Section } from "@/lib/types"

interface CourseState {
  course: Course | null
  sections: Section[]
  loading: boolean
  saving: boolean
  error: string | null
  setCourse: (course: Course | null) => void
  setSections: (sections: Section[]) => void
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  setError: (error: string | null) => void
}

export const useCourseStore = create<CourseState>((set) => ({
  course: null,
  sections: [],
  loading: false,
  saving: false,
  error: null,
  setCourse: (course) => set({ course }),
  setSections: (sections) => set({ sections }),
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
  setError: (error) => set({ error }),
}))

interface UserState {
  youtubeConnected: boolean
  setYoutubeConnected: (connected: boolean) => void
}

export const useUserStore = create<UserState>((set) => ({
  youtubeConnected: false,
  setYoutubeConnected: (connected) => set({ youtubeConnected: connected }),
}))

interface UIState {
  activeTab: string
  setActiveTab: (tab: string) => void
  addingSectionId: string | null
  setAddingSectionId: (id: string | null) => void
  addingLectureToSectionId: string | null
  setAddingLectureToSectionId: (id: string | null) => void
  uploadingDocumentTo: {
    type: "course" | "section" | "lecture"
    id: string
  } | null
  setUploadingDocumentTo: (data: { type: "course" | "section" | "lecture"; id: string } | null) => void
  deleteConfirmation: {
    type: "course" | "section" | "lecture" | "document"
    id: string
    title: string
  } | null
  setDeleteConfirmation: (
    data: { type: "course" | "section" | "lecture" | "document"; id: string; title: string } | null,
  ) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: "content",
  setActiveTab: (tab) => set({ activeTab: tab }),
  addingSectionId: null,
  setAddingSectionId: (id) => set({ addingSectionId: id }),
  addingLectureToSectionId: null,
  setAddingLectureToSectionId: (id) => set({ addingLectureToSectionId: id }),
  uploadingDocumentTo: null,
  setUploadingDocumentTo: (data) => set({ uploadingDocumentTo: data }),
  deleteConfirmation: null,
  setDeleteConfirmation: (data) => set({ deleteConfirmation: data }),
}))

// Follower data store to prevent duplicate API calls
interface FollowerState {
  // Data storage
  followerCounts: Record<string, number>;
  followingStatus: Record<string, boolean>;
  
  // Request tracking to prevent duplicates
  pendingRequests: Set<string>;
  
  // Last fetch timestamp for cache invalidation
  lastFetched: Record<string, number>;
  
  // Actions
  setFollowerCount: (creatorId: string, count: number) => void;
  setFollowingStatus: (creatorId: string, isFollowing: boolean) => void;
  addPendingRequest: (creatorId: string) => void;
  removePendingRequest: (creatorId: string) => void;
  updateLastFetched: (creatorId: string) => void;
  
  // Data access with cache invalidation check
  getFollowerData: (creatorId: string) => {
    count: number | null;
    isFollowing: boolean | null;
    needsFresh: boolean;
  };
}

export const useFollowerStore = create<FollowerState>((set, get) => ({
  followerCounts: {},
  followingStatus: {},
  pendingRequests: new Set<string>(),
  lastFetched: {},
  
  setFollowerCount: (creatorId, count) => 
    set(state => ({ 
      followerCounts: { ...state.followerCounts, [creatorId]: count } 
    })),
  
  setFollowingStatus: (creatorId, isFollowing) => 
    set(state => ({ 
      followingStatus: { ...state.followingStatus, [creatorId]: isFollowing } 
    })),
  
  addPendingRequest: (creatorId) => 
    set(state => {
      const newPendingRequests = new Set(state.pendingRequests);
      newPendingRequests.add(creatorId);
      return { pendingRequests: newPendingRequests };
    }),
  
  removePendingRequest: (creatorId) => 
    set(state => {
      const newPendingRequests = new Set(state.pendingRequests);
      newPendingRequests.delete(creatorId);
      return { pendingRequests: newPendingRequests };
    }),
  
  updateLastFetched: (creatorId) => 
    set(state => ({ 
      lastFetched: { ...state.lastFetched, [creatorId]: Date.now() } 
    })),
  
  getFollowerData: (creatorId) => {
    const state = get();
    const count = state.followerCounts[creatorId] ?? null;
    const isFollowing = state.followingStatus[creatorId] ?? null;
    
    // Check if data is stale (older than 5 minutes)
    const lastFetch = state.lastFetched[creatorId] || 0;
    const needsFresh = Date.now() - lastFetch > 5 * 60 * 1000;
    
    return { count, isFollowing, needsFresh };
  }
}))
