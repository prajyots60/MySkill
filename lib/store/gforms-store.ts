import { create } from "zustand"
import { persist } from "zustand/middleware"

interface GFormsState {
  connected: boolean
  token: string | null
  expiry: number | null
  loading: boolean
  error: string | null
  checkConnectionStatus: () => Promise<void>
  connect: (token: string, expiry: number) => void
  disconnect: () => void
}

export const useGFormsStore = create<GFormsState>()(
  persist(
    (set, get) => ({
      connected: false,
      token: null,
      expiry: null,
      loading: false,
      error: null,
      
      // Check if the integration is connected
      checkConnectionStatus: async () => {
        set({ loading: true, error: null })
        
        try {
          // Make API call to check connection status
          const response = await fetch('/api/integrations/google-forms/status')
          
          if (!response.ok) {
            throw new Error('Failed to check Google Forms connection')
          }
          
          const data = await response.json()
          set({ 
            connected: data.connected, 
            token: data.token || null,
            expiry: data.expiry || null,
            loading: false 
          })
        } catch (error) {
          console.error('Error checking Google Forms connection:', error)
          set({ 
            connected: false, 
            token: null,
            expiry: null,
            loading: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
      },
      
      // Connect Google Forms
      connect: (token: string, expiry: number) => {
        set({ 
          connected: true, 
          token, 
          expiry,
          error: null 
        })
      },
      
      // Disconnect Google Forms
      disconnect: () => {
        set({ 
          connected: false, 
          token: null, 
          expiry: null 
        })
      }
    }),
    {
      name: "gforms-storage", // Name for the persisted state
    }
  )
)