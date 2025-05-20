"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

export interface UploadTask {
  id: string
  file: File | null // Can be null if we're only tracking the task but not the actual file (for restarts)
  title: string
  description?: string
  sectionId: string
  isPreview: boolean
  status: "queued" | "uploading" | "paused" | "completed" | "failed" | "canceled"
  progress: number
  url?: string
  key?: string
  error?: string
  fileKey?: string
  createdAt: number
  updatedAt: number
  category?: string
  metadata?: Record<string, string>
  videoSource: "youtube" | "odysee" | "wasabi"
  isRestartable: boolean
  lectureId?: string // Store the created lecture ID after successful upload
}

interface UploadStore {
  uploads: Record<string, UploadTask>
  activeUploadId: string | null
  
  // Actions
  addUpload: (upload: Omit<UploadTask, "createdAt" | "updatedAt">) => string
  removeUpload: (id: string) => void
  updateUploadProgress: (id: string, progress: number) => void
  updateUploadStatus: (id: string, status: UploadTask["status"], error?: string) => void
  setActiveUpload: (id: string | null) => void
  updateUploadMetadata: (id: string, metadata: Partial<UploadTask>) => void
  clearCompletedUploads: () => void
  hasActiveUploads: () => boolean
}

export const useUploadStore = create<UploadStore>()(
  persist(
    immer((set, get) => ({
      uploads: {},
      activeUploadId: null,
      
      addUpload: (upload) => {
        const id = upload.id;
        set((state) => {
          state.uploads[id] = {
            ...upload,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          
          // If no active upload, set this as active
          if (!state.activeUploadId) {
            state.activeUploadId = id;
          }
          
          return state;
        });
        return id;
      },
      
      removeUpload: (id) => {
        set((state) => {
          delete state.uploads[id];
          
          // If this was the active upload, set a new active upload
          if (state.activeUploadId === id) {
            const pendingUploads = Object.entries(state.uploads)
              .filter(([_, upload]) => upload.status === "queued")
              .sort((a, b) => a[1].createdAt - b[1].createdAt);
              
            state.activeUploadId = pendingUploads.length > 0 ? pendingUploads[0][0] : null;
          }
          
          return state;
        });
      },
      
      updateUploadProgress: (id, progress) => {
        set((state) => {
          if (state.uploads[id]) {
            state.uploads[id].progress = progress;
            state.uploads[id].updatedAt = Date.now();
          }
          return state;
        });
      },
      
      updateUploadStatus: (id, status, error) => {
        set((state) => {
          if (state.uploads[id]) {
            state.uploads[id].status = status;
            state.uploads[id].updatedAt = Date.now();
            
            if (error) {
              state.uploads[id].error = error;
            }
            
            // If completed or failed, make room for next upload
            if (status === "completed" || status === "failed" || status === "canceled") {
              if (state.activeUploadId === id) {
                const pendingUploads = Object.entries(state.uploads)
                  .filter(([_, upload]) => upload.status === "queued")
                  .sort((a, b) => a[1].createdAt - b[1].createdAt);
                  
                state.activeUploadId = pendingUploads.length > 0 ? pendingUploads[0][0] : null;
              }
            }
          }
          return state;
        });
      },
      
      setActiveUpload: (id) => {
        set((state) => {
          state.activeUploadId = id;
          return state;
        });
      },
      
      updateUploadMetadata: (id, metadata) => {
        set((state) => {
          if (state.uploads[id]) {
            state.uploads[id] = {
              ...state.uploads[id],
              ...metadata,
              updatedAt: Date.now(),
            };
          }
          return state;
        });
      },
      
      clearCompletedUploads: () => {
        set((state) => {
          const newUploads: Record<string, UploadTask> = {};
          
          Object.entries(state.uploads).forEach(([id, upload]) => {
            if (upload.status !== "completed") {
              newUploads[id] = upload;
            }
          });
          
          state.uploads = newUploads;
          return state;
        });
      },
      
      hasActiveUploads: () => {
        const state = get();
        return Object.values(state.uploads).some(
          upload => upload.status === "uploading" || upload.status === "queued"
        );
      }
    })),
    {
      name: "eduplatform-uploads",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        // Don't persist the actual File objects to localStorage
        const uploads = { ...state.uploads };
        
        Object.keys(uploads).forEach(uploadId => {
          if (uploads[uploadId].file) {
            uploads[uploadId] = { 
              ...uploads[uploadId], 
              file: null,
              isRestartable: true 
            };
          }
        });
        
        return {
          ...state,
          uploads
        };
      },
    }
  )
);
