"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/auth"
import { prisma } from "@/lib/db"
import { redis } from "@/lib/redis"
import type { UserRole } from "@/lib/types"

export async function getUserById(userId: string) {
  try {
    // Check cache first
    const cachedUser = await redis.get(`user:${userId}`)
    if (cachedUser) {
      try {
        return {
          success: true,
          user: JSON.parse(cachedUser as string),
          source: "cache",
        }
      } catch (e) {
        // If parsing fails, delete the invalid cache
        await redis.del(`user:${userId}`)
      }
    }

    // Query database with all needed fields for YouTube
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          where: {
            provider: "google-youtube",
          },
          select: {
            refresh_token: true,
            access_token: true,
            expires_at: true,
          },
        },
      },
    })

    if (!user) {
      return { success: false, error: "User not found" }
    }

    // Transform the data for caching
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      youtubeConnected: user.youtubeConnected && user.accounts.length > 0 && !!user.accounts[0]?.refresh_token,
      refreshToken: user.accounts[0]?.refresh_token || null,
      // Include other fields you need
    }

    // Cache the result
    await redis.set(`user:${userId}`, JSON.stringify(userData), {
      ex: 60 * 10, // Cache for 10 minutes
    })

    return {
      success: true,
      user: userData,
      source: "db",
    }
  } catch (error) {
    console.error("Error in getUserById:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Update user role during onboarding
export async function updateUserRole({
  userId,
  role,
  bio,
}: {
  userId: string
  role: UserRole
  bio?: string
}) {
  try {
    // During onboarding, we allow the user to set their own role
    // This is a special case where we don't need to check permissions
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        role,
        bio,
        onboarded: true,
      },
    })

    // Invalidate cache
    await redis.del(`user:${userId}`)

    revalidatePath("/dashboard/student")
    revalidatePath("/dashboard/creator")
    revalidatePath("/dashboard/admin")

    return { success: true, user: updatedUser }
  } catch (error) {
    console.error("Error updating user role:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to update user role" }
  }
}

// Get user profile
export async function getUserProfile(userId: string) {
  try {
    // Try to get from cache first
    const cachedUser = await redis.get(`user:${userId}`)
    if (cachedUser) {
      return { success: true, user: JSON.parse(cachedUser as string) }
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        bio: true,
        mobileNumber: true,
        socialLinks: true,
        createdAt: true,
        onboarded: true,
        _count: {
          select: {
            contents: true,
            enrollments: true,
          },
        },
      },
    })

    if (!user) {
      throw new Error("User not found")
    }

    // Transform the data
    const transformedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      bio: user.bio,
      mobileNumber: user.mobileNumber,
      socialLinks: user.socialLinks,
      createdAt: user.createdAt,
      onboarded: user.onboarded,
      contentCount: user._count.contents,
      enrollmentCount: user._count.enrollments,
    }

    // Cache the results
    await redis.set(`user:${userId}`, JSON.stringify(transformedUser), {
      ex: 60 * 5, // 5 minutes
    })

    return { success: true, user: transformedUser }
  } catch (error) {
    console.error("Error getting user profile:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to get user profile" }
  }
}

// Update user profile
export async function updateUserProfile({
  userId,
  name,
  bio,
  mobileNumber,
  socialLinks,
}: {
  userId: string
  name?: string
  bio?: string
  mobileNumber?: string
  socialLinks?: Record<string, string>
}) {
  try {
    const session = await getServerSession(authOptions)

    // Check if the user is updating their own profile or is an admin
    const isOwnProfile = session?.user?.id === userId
    const isAdmin = session?.user?.role === "ADMIN"

    if (!isOwnProfile && !isAdmin) {
      throw new Error("You don't have permission to update this user")
    }

    // Update the user in the database
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
        bio,
        mobileNumber,
        socialLinks,
      },
    })

    // Invalidate cache
    await redis.del(`user:${userId}`)

    revalidatePath("/settings")
    revalidatePath(`/profile/${userId}`)

    return { success: true, user: updatedUser }
  } catch (error) {
    console.error("Error updating user profile:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to update user profile" }
  }
}

// Check if user has YouTube connected
export async function checkYouTubeConnection(userId: string) {
  try {
    // Try to get from cache first
    const cachedStatus = await redis.get(`youtube:connection:${userId}`)
    if (cachedStatus) {
      return { success: true, connected: cachedStatus === "true" }
    }

    // Check if user has a Google account with YouTube scope
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google-youtube", // Changed from "google" to "google-youtube"
      },
    })

    const isConnected = !!account

    // Cache the result
    await redis.set(`youtube:connection:${userId}`, isConnected.toString(), {
      ex: 60 * 60, // 1 hour
    })

    return { success: true, connected: isConnected }
  } catch (error) {
    console.error("Error checking YouTube connection:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to check YouTube connection" }
  }
}
