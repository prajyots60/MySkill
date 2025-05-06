import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Get exam details along with questions
export async function GET(
  request: Request,
  { params }: { params: { examId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const {examId} = await params
    
    // Fetch the exam with content relationship to check enrollment
    const exam = await prisma.exam.findUnique({
      where: {
        id: examId,
      },
      include: {
        content: true,
      }
    })

    if (!exam) {
      return NextResponse.json({ message: "Exam not found" }, { status: 404 })
    }

    const userId = session.user.id
    const userRole = session.user.role

    // Check if user has permission to access this exam:
    // 1. User is the creator of the exam
    // 2. User is an admin
    // 3. User is a student enrolled in the course and the exam is published
    const isCreator = exam.creatorId === userId
    const isAdmin = userRole === "ADMIN"
    
    // Only check enrollment for students
    let isEnrolled = false
    if (userRole === "STUDENT" && exam.content) {
      // Check if student is enrolled in the course that contains this exam
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId: userId,
          contentId: exam.content.id,
        }
      })
      
      isEnrolled = !!enrollment
    }

    // If user doesn't have permission, return error
    if (!isCreator && !isAdmin && !isEnrolled) {
      return NextResponse.json({ 
        message: "You must be enrolled in this course to access this exam" 
      }, { status: 403 })
    }

    // Get questions for the exam
    const questions = await prisma.question.findMany({
      where: {
        examId: examId,
      },
      include: {
        options: {
          orderBy: {
            order: 'asc'
          }
        }
      },
      orderBy: {
        order: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      exam,
      questions
    })
  } catch (error) {
    console.error("Error getting exam:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to get exam" },
      { status: 500 },
    )
  }
}