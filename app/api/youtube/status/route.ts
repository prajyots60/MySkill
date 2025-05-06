import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { fetchYouTubeConnectionStatus } from "@/lib/actions/safe-actions"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Use the server action to check connection status
    const result = await fetchYouTubeConnectionStatus()

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error checking YouTube connection:", error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to check YouTube connection" },
      { status: 500 },
    )
  }
}
