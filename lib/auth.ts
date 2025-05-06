import { PrismaAdapter } from "@auth/prisma-adapter"
import type { NextAuthOptions } from "next-auth"
import { getServerSession } from "next-auth/next"
import GoogleProvider from "next-auth/providers/google"
import { v4 as uuidv4 } from "uuid"

import { prisma } from "@/lib/db"
import type { UserRole, TempUserData } from "@/lib/types"
import { storeTempUser } from "@/lib/redis"

// This file should only be imported on the server side
// It contains server-only code that uses Prisma directly

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Only request basic profile info during signup/signin
          scope: "openid email profile",
          prompt: "select_account",
          access_type: "online",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.onboarded = token.onboarded as boolean
        session.user.youtubeConnected = token.youtubeConnected as boolean
      }
      return session
    },
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.role = user.role
        token.onboarded = user.onboarded
        token.youtubeConnected = false // Default value

        // Check if user has YouTube connected
        if (user.id) {
          const userAccount = await prisma.account.findFirst({
            where: {
              userId: user.id,
              provider: "google",
              scope: {
                contains: "youtube",
              },
            },
          })
          token.youtubeConnected = !!userAccount
        }
      }

      // Update token if session is updated
      if (trigger === "update" && session) {
        if (session.user?.role) {
          token.role = session.user.role
        }
        if (session.user?.onboarded !== undefined) {
          token.onboarded = session.user.onboarded
        }
        if (session.user?.youtubeConnected !== undefined) {
          token.youtubeConnected = session.user.youtubeConnected
        }
      }

      return token
    },
    async signIn({ user, account, profile }) {
      try {
        if (!user.email) {
          return "/auth/error?error=missing_email"
        }

        // Check if user exists in the database
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, onboarded: true },
        })

        // If user exists and has completed onboarding, proceed normally
        if (existingUser && existingUser.onboarded) {
          return true
        }

        // If user exists but hasn't completed onboarding, redirect to onboarding
        if (existingUser && !existingUser.onboarded) {
          return `/onboarding?userId=${existingUser.id}`
        }

        // New user, store in Redis first
        const tempUserId = uuidv4()
        const tempUserData: TempUserData = {
          id: tempUserId,
          name: user.name || null,
          email: user.email || null,
          image: user.image || null,
          provider: account?.provider || "google",
          providerAccountId: account?.providerAccountId,
          accessToken: account?.access_token,
          refreshToken: account?.refresh_token,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          isTemporary: true,
        }

        // Store in Redis
        await storeTempUser(tempUserData)

        // Redirect to onboarding
        return `/onboarding?userId=${tempUserId}&isNew=true`
      } catch (error) {
        console.error("Error in signIn callback:", error)
        return "/auth/error?error=database_error"
      }
    },
    async redirect({ url, baseUrl }) {
      // Handle OAuthAccountNotLinked error more gracefully
      if (url.includes("error=OAuthAccountNotLinked")) {
        // Redirect to the sign-in page with the error parameter
        return `${baseUrl}/auth/signin?error=OAuthAccountNotLinked`
      }
      
      // Standard redirect handling
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
}

export const getAuthSession = () => getServerSession(authOptions)
