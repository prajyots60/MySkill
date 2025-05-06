import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

// Export the NextAuth handler for both GET and POST requests
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

// Prevent Next.js from trying to generate static paths for this dynamic route
export const dynamic = 'force-dynamic'
