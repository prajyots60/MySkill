import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { publishForm } from "@/lib/server/gforms"

// Publish an exam to make it available to students
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
      return NextResponse.json({ message: "Only creators can publish exams" }, { status: 403 })
    }

    const {examId} = await params
    
    // Check if exam exists and belongs to user
    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        creatorId: session.user.id,
      },
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    })

    if (!exam) {
      return NextResponse.json({ message: "Exam not found or you don't have permission" }, { status: 404 })
    }

    // Make sure the exam has at least one question
    if (exam.questions.length === 0) {
      return NextResponse.json({ message: "Cannot publish an exam with no questions" }, { status: 400 })
    }

    // Publish the Google Form
    const publishResult = await publishForm(session.user.id, exam.formId)

    // Update the exam status to PUBLISHED
    const updatedExam = await prisma.exam.update({
      where: {
        id: examId,
      },
      data: {
        status: "PUBLISHED",
      },
    })

    return NextResponse.json({
      success: true,
      exam: updatedExam,
      publishedUrl: publishResult.publishedUrl
    })
  } catch (error) {
    console.error("Error publishing exam:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to publish exam" },
      { status: 500 },
    )
  }
}