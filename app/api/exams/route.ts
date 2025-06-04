import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import * as examService from "@/lib/server/exams"
import { ExamType, QuestionType } from "@prisma/client"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { action, ...data } = await req.json()
    
    // Check if user is authorized to create/manage exams
    // Typically creators or admins can create exams
    if (!["CREATOR", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Not authorized to create exams" }, { status: 403 })
    }
    
    switch (action) {
      case "create": {
        const { title, description, instructions, type = "QUIZ", passingScore, timeLimit, startDate, endDate, contentId, sectionId, lectureId } = data
        
        if (!title) {
          return NextResponse.json({ error: "Title is required" }, { status: 400 })
        }
        
        const exam = await examService.createExam(session.user.id, {
          title,
          description,
          instructions,
          type: type as ExamType,
          passingScore: passingScore ? parseInt(passingScore) : undefined,
          timeLimit: timeLimit ? parseInt(timeLimit) : undefined,
          // Parse dates with timezone information preserved
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          contentId,
          sectionId,
          lectureId,
        })
        
        return NextResponse.json(exam)
      }
      
      case "addQuestion": {
        const { examId, question } = data
        
        if (!examId || !question) {
          return NextResponse.json({ error: "Exam ID and question data are required" }, { status: 400 })
        }
        
        const result = await examService.addQuestionToExam(examId, {
          text: question.text,
          type: question.type as QuestionType,
          required: question.required,
          points: question.points,
          negativeMarking: question.negativeMarking,
          options: question.options,
        }, question.order)
        
        return NextResponse.json(result)
      }
      
      case "publish": {
        const { examId } = data
        
        if (!examId) {
          return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
        }
        
        const result = await examService.publishExam(examId)
        return NextResponse.json(result)
      }
      
      case "close": {
        const { examId } = data
        
        if (!examId) {
          return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
        }
        
        const result = await examService.closeExam(examId)
        return NextResponse.json(result)
      }        case "update": {
        const { examId, ...examData } = data
        
        if (!examId) {
          return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
        }
        
        // Convert date strings to Date objects if provided, preserving the exact time
        if (examData.startDate) examData.startDate = new Date(examData.startDate)
        if (examData.endDate) examData.endDate = new Date(examData.endDate)
        
        const result = await examService.updateExam(examId, examData)
        return NextResponse.json(result)
      }
      
      case "deleteQuestion": {
        const { questionId } = data
        
        if (!questionId) {
          return NextResponse.json({ error: "Question ID is required" }, { status: 400 })
        }
        
        const result = await examService.deleteQuestion(questionId)
        return NextResponse.json({ success: result })
      }
      
      case "getResponses": {
        const { examId } = data
        
        if (!examId) {
          return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
        }
        
        const responses = await examService.getExamResponses(examId)
        return NextResponse.json(responses)
      }
      
      case "gradeTextResponse": {
        const { responseId, questionId, isCorrect, pointsAwarded } = data
        
        if (!responseId || !questionId || isCorrect === undefined || pointsAwarded === undefined) {
          return NextResponse.json({ error: "All grading fields are required" }, { status: 400 })
        }
        
        const result = await examService.gradeTextResponse(responseId, questionId, isCorrect, pointsAwarded)
        return NextResponse.json(result)
      }
      
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error: any) {
    console.error("Error in exam API:", error)
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
    const examId = url.searchParams.get("examId")
    const formId = url.searchParams.get("formId")
    
    if (!examId && !formId) {
      return NextResponse.json({ error: "Exam ID or Form ID is required" }, { status: 400 })
    }
    
    let exam

    if (examId) {
      exam = await examService.getExam(examId)
    } else if (formId) {
      exam = await examService.getExamByFormId(formId)
    }
    
    return NextResponse.json(exam)
  } catch (error: any) {
    console.error("Error in exam API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}