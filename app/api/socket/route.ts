import { type NextRequest, NextResponse } from "next/server"

// This is a dummy route handler to make Next.js recognize the /api/socket path
// The actual Socket.IO server is initialized in the middleware.ts file
export async function GET(req: NextRequest) {
  return new NextResponse("Socket.IO server endpoint", { status: 200 })
}
