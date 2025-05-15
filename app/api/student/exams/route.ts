import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getStudentAvailableExams } from "@/lib/server/student-exams"

// GET /api/student/exams - Get all exams available to the student from enrolled courses
export async function GET(req: NextRequest) {
  try {
    // Get the current authenticated user's session
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    // Use the utility function to get the student's available exams
    const exams = await getStudentAvailableExams(session.user.id)

    return NextResponse.json({
      success: true,
      exams
    })
  } catch (error) {
    console.error("Error fetching student exams:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch exams" },
      { status: 500 }
    )
  }
}
