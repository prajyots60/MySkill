import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import * as examService from "@/lib/server/exams"
import { prisma } from "@/lib/db"
import { Content, Exam, Question, QuestionOption } from "@prisma/client"

// Define interface for the completion status
interface CompletionStatus {
  completed: boolean;
  score: number | null;
  maxScore: number | null;
  passed: boolean | null;
  completedAt: Date | null;
}

// Define the ExamWithDetails interface that should come from examService
// We'll define it here since it's apparently not exported from the service
interface ExamWithDetails extends Exam {
  questions?: (Question & {
    options: QuestionOption[];
  })[];
  content?: Content & {
    courseId?: string;
  };
}

// Define interface to extend the exam object
interface ExamWithCompletionStatus extends ExamWithDetails {
  completionStatus?: CompletionStatus;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const data = await req.json()
    const { examId, responses } = data
    
    if (!examId || !responses) {
      return NextResponse.json({ error: "Exam ID and responses are required" }, { status: 400 })
    }
    
    // Check if the user is enrolled in the course containing the exam
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { content: true }
    }) as ExamWithDetails
    
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }
    
    // For students, verify enrollment before allowing submission
    if (session.user.role === "STUDENT" && exam.content) {
      const contentId = exam.content.id
      
      if (contentId) {
        const enrollment = await prisma.enrollment.findFirst({
          where: {
            userId: session.user.id,
            contentId: contentId
          }
        })
        
        if (!enrollment) {
          return NextResponse.json({ 
            error: "You must be enrolled in this course to submit this exam" 
          }, { status: 403 })
        }
      }
    }
    
    // Pass the student's user ID and responses to the submission function
    const result = await examService.submitExamResponse({
      examId,
      studentId: session.user.id,
      responses,
      submitTime: new Date(),
    })
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error in exam submission API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const url = new URL(req.url)
    const formId = url.searchParams.get("formId")
    
    if (!formId) {
      return NextResponse.json({ error: "Form ID is required" }, { status: 400 })
    }
    
    // Get the exam by its form ID
    const exam = await examService.getExamByFormId(formId) as ExamWithCompletionStatus
    
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }
    
    // For students, verify enrollment before allowing access
    if (session.user.role === "STUDENT" && exam.content) {
      const contentId = exam.content.id
      
      if (contentId) {
        const enrollment = await prisma.enrollment.findFirst({
          where: {
            userId: session.user.id,
            contentId: contentId
          }
        })
        
        if (!enrollment) {
          return NextResponse.json({ 
            error: "You must be enrolled in this course to access this exam" 
          }, { status: 403 })
        }
      }
    }
    
    // Check if user has completed this exam (for both students and instructors)
    const existingResponse = await examService.getStudentExamResponse(exam.id, session.user.id)
    const hasCompleted = !!existingResponse
    
    // If user is a student and has already taken this exam, return a completion response
    // but also allow them to iterate/retake the exam
    if (session.user.role === "STUDENT" && hasCompleted) {
      return NextResponse.json(
        { 
          message: "You have already completed this exam. Would you like to continue to iterate?", 
          alreadyCompleted: true,
          canIterate: true,  // Add this flag to indicate iteration is allowed
          completionStatus: {
            completed: true,
            score: existingResponse.score,
            maxScore: existingResponse.maxScore,
            passed: existingResponse.passed,
            completedAt: existingResponse.submitTime
          }
        }
      )
    }
    
    // Strip out the correct answers if this is a student viewing the exam to take it
    if (session.user.role === "STUDENT") {
      if (exam.questions) {
        exam.questions = exam.questions.map(question => {
          if (question.options) {
            // Create new options array with the correct type that excludes isCorrect
            const newOptions = question.options.map(option => {
              const { isCorrect, ...rest } = option
              return rest as QuestionOption
            })
            
            // Replace the options with the new array
            return {
              ...question,
              options: newOptions
            }
          }
          return question
        })
      }
    }
    
    // Add completion badge information to the exam response for instructors
    if (session.user.role !== "STUDENT" && hasCompleted) {
      exam.completionStatus = {
        completed: true,
        score: existingResponse.score,
        maxScore: existingResponse.maxScore,
        passed: existingResponse.passed,
        completedAt: existingResponse.submitTime
      }
    }
    
    return NextResponse.json(exam)
  } catch (error: any) {
    console.error("Error in exam API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}