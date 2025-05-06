"use client"

// This file contains client-safe auth helpers that don't import Prisma directly

import { useSession } from "next-auth/react"
import type { UserRole } from "@/lib/types"

// Helper to check if user is authenticated
export function useIsAuthenticated() {
  const { status } = useSession()
  return status === "authenticated"
}

// Helper to check if user has a specific role
export function useHasRole(role: UserRole | UserRole[]) {
  const { data: session } = useSession()

  if (!session?.user?.role) return false

  if (Array.isArray(role)) {
    return role.includes(session.user.role as UserRole)
  }

  return session.user.role === role
}

// Helper to get the default dashboard path based on user role
export function getDefaultDashboardPath(role: UserRole): string {
  switch (role) {
    case "CREATOR":
      return "/dashboard/creator"
    case "ADMIN":
      return "/dashboard/admin"
    case "STUDENT":
    default:
      return "/dashboard/student"
  }
}
