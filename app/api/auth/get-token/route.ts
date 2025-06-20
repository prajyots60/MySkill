import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // For development/testing purposes only
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        token: session,
        note: "This endpoint is only available in development mode"
      })
    }

    return new NextResponse("Endpoint disabled in production", { status: 403 })
  } catch (error) {
    console.error("[GET_TOKEN_ERROR]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
} 