"use client"

import { create } from "zustand"

interface DocumentState {
  title: string
  description: string
  file: File | null
  uploading: boolean
  progress: number
  error: string | null

  // Actions
  setTitle: (title: string) => void
  setDescription: (description: string) => void
  setFile: (file: File | null) => void
  setUploading: (uploading: boolean) => void
  setProgress: (progress: number) => void
  setError: (error: string | null) => void
  reset: () => void

  // Upload function
  uploadDocument: (params: {
    type: "course" | "section" | "lecture"
    id: string
  }) => Promise<boolean>
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  title: "",
  description: "",
  file: null,
  uploading: false,
  progress: 0,
  error: null,

  // Actions
  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),
  setFile: (file) => set({ file }),
  setUploading: (uploading) => set({ uploading }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      title: "",
      description: "",
      file: null,
      uploading: false,
      progress: 0,
      error: null,
    }),

  // Upload function
  uploadDocument: async (params) => {
    const { title, description, file } = get()

    if (!title.trim()) {
      set({ error: "Title is required" })
      return false
    }

    if (!file) {
      set({ error: "File is required" })
      return false
    }

    try {
      set({ uploading: true, progress: 0, error: null })

      // Create a simulated progress update
      const progressInterval = setInterval(() => {
        set((state) => ({
          progress: state.progress >= 95 ? 95 : state.progress + 5,
        }))
      }, 200)

      // Create FormData for file upload
      const formData = new FormData()
      formData.append("title", title)
      formData.append("description", description || "")
      formData.append("file", file)

      if (params.type === "course") {
        formData.append("contentId", params.id)
      } else if (params.type === "section") {
        formData.append("sectionId", params.id)
      } else if (params.type === "lecture") {
        formData.append("lectureId", params.id)
      }

      // Upload the document
      const response = await fetch("/api/creator/documents", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      set({ progress: 100 })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to upload document")
      }

      const result = await response.json()

      if (result.success) {
        // Reset form
        get().reset()
        return true
      } else {
        throw new Error(result.error || "Failed to upload document")
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to upload document",
        uploading: false,
      })
      return false
    }
  },
}))
