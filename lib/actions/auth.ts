"use server"
import { prisma } from "@/lib/db"
import { getTempUser, deleteTempUser } from "@/lib/redis"
import type { UserRole } from "@/lib/types"
import { getAuthSession, authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"

// Complete user onboarding and create permanent user record
export async function completeUserOnboarding({
  userId,
  role,
  bio,
  mobileNumber,
}: {
  userId: string
  role: UserRole
  bio?: string
  mobileNumber?: string
}) {
  try {
    const session = await getServerSession(authOptions)

    // First check if this is a temporary user from Redis
    const tempUser = await getTempUser(userId)

    if (tempUser) {
      // This is a new user from Redis, create in database
      console.log("Creating new user from temp data:", tempUser.email)

      const newUser = await prisma.user.create({
        data: {
          id: userId,
          email: tempUser.email,
          name: tempUser.name,
          image: tempUser.image,
          role,
          bio,
          mobileNumber,
          onboarded: true,
        },
      })

      // If we have OAuth account details, create the account
      if (tempUser.provider && tempUser.providerAccountId) {
        try {
          await prisma.account.create({
            data: {
              userId: newUser.id,
              type: "oauth",
              provider: tempUser.provider,
              providerAccountId: tempUser.providerAccountId,
              access_token: tempUser.accessToken,
              refresh_token: tempUser.refreshToken,
              expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
              token_type: "Bearer",
              scope: "openid profile email",
            },
          })
        } catch (accountError) {
          console.error("Error creating account:", accountError)
          // Continue even if account creation fails
        }
      }

      // Delete temporary user data
      await deleteTempUser(userId, tempUser.email || undefined)

      // Update the session with the new user data
      await updateUserSession({
        userId: newUser.id,
        role: newUser.role,
        onboarded: true,
      })

      return { success: true, user: newUser, isNew: true }
    } else {
      // Check if this is an existing user in the database
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!existingUser) {
        // Try to create a new user with the provided ID if not found
        console.log("User not found in Redis or database, creating new user with ID:", userId)
        const newUser = await prisma.user.create({
          data: {
            id: userId,
            role,
            bio,
            mobileNumber,
            onboarded: true,
          },
        })

        // Update the session with the new user data
        await updateUserSession({
          userId: newUser.id,
          role: newUser.role,
          onboarded: true,
        })

        return { success: true, user: newUser, isNew: true }
      }

      // This is an existing user, update their role and onboarded status
      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          role,
          bio,
          mobileNumber,
          onboarded: true,
        },
      })

      // Update the session with the updated user data
      await updateUserSession({
        userId: updatedUser.id,
        role: updatedUser.role,
        onboarded: true,
      })

      return { success: true, user: updatedUser, isNew: false }
    }
  } catch (error) {
    console.error("Error completing user onboarding:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete onboarding",
    }
  }
}

// Connect YouTube account
export async function connectYouTubeAccount(userId: string) {
  try {
    // Update user's YouTube connection status
    await prisma.user.update({
      where: { id: userId },
      data: {
        youtubeConnected: true,
      },
    })

    return { success: true }
  } catch (error) {
    console.error("Error connecting YouTube account:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect YouTube account",
    }
  }
}

// Get current user session data
export async function getCurrentUser() {
  try {
    const session = await getAuthSession()

    if (!session?.user) {
      return { success: false, error: "Not authenticated" }
    }

    return {
      success: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
        onboarded: session.user.onboarded,
      },
    }
  } catch (error) {
    console.error("Error getting current user:", error)
    return { success: false, error: "Failed to get user data" }
  }
}

// Add a new function to update the user session
export async function updateUserSession({
  userId,
  role,
  onboarded,
}: {
  userId: string
  role: UserRole
  onboarded: boolean
}) {
  try {
    // Update the session by revalidating the path
    revalidatePath("/", "layout")

    return { success: true }
  } catch (error) {
    console.error("Error updating user session:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to update session" }
  }
}
