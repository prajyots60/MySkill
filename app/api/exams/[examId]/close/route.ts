import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { closeForm } from "@/lib/server/gforms"

// Close an exam to prevent new submissions
export async function POST(
  request: Request,
  { params }: { params: { examId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can close exams" }, { status: 403 })
    }

    const examId = params.examId
    
    // Check if exam exists and belongs to user
    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        creatorId: session.user.id,
      }
    })

    if (!exam) {
      return NextResponse.json({ message: "Exam not found or you don't have permission" }, { status: 404 })
    }

    // Close the Google Form
    await closeForm(session.user.id, exam.formId)

    // Update the exam status to CLOSED
    const updatedExam = await prisma.exam.update({
      where: {
        id: examId,
      },
      data: {
        status: "CLOSED",
      },
    })

    return NextResponse.json({
      success: true,
      exam: updatedExam
    })
  } catch (error) {
    console.error("Error closing exam:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to close exam" },
      { status: 500 },
    )
  }
}