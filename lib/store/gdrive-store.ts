// Google Drive store for connection state management
import { create } from "zustand"
import { fetchGDriveConnectionStatus } from "@/lib/actions/safe-actions"

interface GDriveConnectionDetails {
  email?: string
  name?: string
  profileImage?: string
  connectedAt?: string
  storageQuota?: {
    limit?: string
    usage?: string
    usageInDrive?: string
  }
}

interface GDriveStore {
  connected: boolean
  loading: boolean
  error: string | null
  details: GDriveConnectionDetails | null
  checkConnectionStatus: () => Promise<void>
}

export const useGDriveStore = create<GDriveStore>((set) => ({
  connected: false,
  loading: false,
  error: null,
  details: null,
  checkConnectionStatus: async () => {
    try {
      set({ loading: true, error: null })

      // Use the server action instead of direct fetch
      const result = await fetchGDriveConnectionStatus()

      // Safely handle the response, checking if details exists
      set({
        connected: !!result?.connected,
        details: result?.details || null,
        loading: false,
        error: result?.error || null,
      })
    } catch (error) {
      console.error("Error checking Google Drive connection:", error)
      set({
        error: error instanceof Error ? error.message : "Failed to check Google Drive connection",
        loading: false,
      })
    }
  },
}))