import type { UserRole } from "../types"

export function getRedirectPathForRole(role: UserRole): string {
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
