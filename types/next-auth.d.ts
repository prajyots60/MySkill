import type { UserRole } from "@/lib/types"
import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
      onboarded: boolean
      youtubeConnected?: boolean
      accessToken?: string
    }
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    role?: UserRole
    onboarded?: boolean
    youtubeConnected?: boolean
    mobileNumber?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role?: UserRole
    onboarded?: boolean
    youtubeConnected?: boolean
  }
}
