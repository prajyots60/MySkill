// Dailymotion store for connection state management
import { create } from "zustand"

interface DailymotionConnectionDetails {
  userId?: string
  username?: string
  screenname?: string
  profilePictureUrl?: string
  connectedAt?: string
}

interface DailymotionStore {
  connected: boolean
  loading: boolean
  error: string | null
  details: DailymotionConnectionDetails | null
  debug?: any
  checkConnectionStatus: () => Promise<void>
}

export const useDailymotionStore = create<DailymotionStore>((set) => ({
  connected: false,
  loading: false,
  error: null,
  details: null,
  checkConnectionStatus: async () => {
    try {
      set({ loading: true, error: null })

      // Use the new direct API endpoint
      const response = await fetch("/api/dailymotion/status")
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to check Dailymotion connection: ${errorText}`)
      }
      
      const result = await response.json()
      console.log("Dailymotion status check:", result)

      // Update the store with the connection results
      set({
        connected: !!result?.connected,
        details: result?.details || null,
        loading: false,
        error: result?.error || null,
        debug: result?.debug // Store debug info
      })
      
      // If it's still not connected but we have debug info showing it should be,
      // let's force a page reload to try to fix any stale state
      if (!result?.connected && result?.debug?.dailymotionInfoExists && result?.debug?.dailymotionInfoValid) {
        // Wait a moment for the update to take effect
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    } catch (error) {
      console.error("Error checking Dailymotion connection:", error)
      set({
        error: error instanceof Error ? error.message : "Failed to check Dailymotion connection",
        loading: false,
      })
    }
  },
}))