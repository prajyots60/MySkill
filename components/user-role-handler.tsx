"use client"

import { useSession } from "next-auth/react"
import { useEffect } from "react"

export function UserRoleHandler() {
  const { data: session, status } = useSession()
  
  // Update body data-role attribute based on user role
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (status === "authenticated" && session?.user?.role) {
        document.body.setAttribute("data-role", session.user.role.toLowerCase())
      } else {
        // Default to student if no role or not authenticated
        document.body.setAttribute("data-role", "student")
      }
    }
    
    return () => {
      if (typeof document !== "undefined") {
        document.body.removeAttribute("data-role")
      }
    }
  }, [session?.user?.role, status])

  // This component doesn't render anything
  return null
}
