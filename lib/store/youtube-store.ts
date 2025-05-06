import { create } from "zustand"
import { fetchYouTubeConnectionStatus } from "@/lib/actions/safe-actions"

interface YouTubeConnectionDetails {
  channelId?: string
  channelName?: string
  thumbnailUrl?: string
  connectedAt?: string
}

interface YouTubeStore {
  connected: boolean
  loading: boolean
  error: string | null
  details: YouTubeConnectionDetails | null
  checkConnectionStatus: () => Promise<void>
}

export const useYouTubeStore = create<YouTubeStore>((set) => ({
  connected: false,
  loading: false,
  error: null,
  details: null,
  checkConnectionStatus: async () => {
    try {
      set({ loading: true, error: null })

      // Use the server action instead of direct fetch
      const result = await fetchYouTubeConnectionStatus()

      // Safely handle the response, checking if details exists
      set({
        connected: !!result?.connected,
        details: result?.details || null,
        loading: false,
        error: result?.error || null,
      })
    } catch (error) {
      console.error("Error checking YouTube connection:", error)
      set({
        error: error instanceof Error ? error.message : "Failed to check YouTube connection",
        loading: false,
      })
    }
  },
}))
