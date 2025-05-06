import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"  // Use the prisma import directly
import { getAuthSession } from "@/lib/auth"

// GET /api/creator/exams - Get all exams created by the current user
export async function GET(req: NextRequest) {
  try {
    // Get the current authenticated user's session
    const session = await getAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    // Fetch all exams created by this user using prisma directly
    const exams = await prisma.exam.findMany({
      where: {
        creatorId: session.user.id,
      },
      include: {
        questions: {
          select: {
            id: true,
          },
        },
        studentResponses: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transform the data to include count information
    const formattedExams = exams.map(exam => ({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      status: exam.status,
      type: exam.type,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      formId: exam.formId,
      questionCount: exam.questions.length,
      responseCount: exam.studentResponses.length,
      courseId: exam.contentId,
      sectionId: exam.sectionId,
    }))

    return NextResponse.json({
      success: true,
      exams: formattedExams,
    })
  } catch (error) {
    console.error("[CREATOR_EXAMS_GET]", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}