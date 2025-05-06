import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as examService from "@/lib/server/exams"
import { UserRole } from "@prisma/client"

/**
 * API endpoint to check if a user is enrolled in the course before accessing an exam
 * This function is called before loading the exam to ensure only enrolled students can access it
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized. Please log in to access this exam." }, { status: 401 })
    }
    
    const url = new URL(req.url)
    const formId = url.searchParams.get("formId")
    
    if (!formId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }
    
    // Get the exam by form ID
    const exam = await examService.getExamByFormId(formId)
    
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }
    
    // Admin and creators have full access
    if (session.user.role === UserRole.ADMIN || session.user.role === UserRole.CREATOR) {
      // Check if creator is the creator of this content
      if (session.user.role === UserRole.CREATOR && exam.contentId) {
        const content = await prisma.content.findUnique({
          where: { id: exam.contentId }
        })
        
        if (content?.creatorId !== session.user.id) {
          // Optional: You can restrict creators to only their own courses
          // Uncomment the following to enforce this restriction
          // return NextResponse.json({ error: "You don't have permission to access this exam" }, { status: 403 })
        }
      }
      
      return NextResponse.json({ authorized: true })
    }
    
    // For students, verify enrollment in the content
    if (session.user.role === UserRole.STUDENT && exam.contentId) {
      // Check if the student is enrolled in this content
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId: session.user.id,
          contentId: exam.contentId
        }
      })
      
      if (!enrollment) {
        return NextResponse.json({ 
          error: "You must be enrolled in this course to access this exam",
          contentId: exam.contentId // Include contentId for potential enrollment redirect
        }, { status: 403 })
      }
      
      return NextResponse.json({ 
        authorized: true,
        enrollment: {
          id: enrollment.id,
          enrolledAt: enrollment.enrolledAt
        }
      })
    }
    
    // If we get here, the user doesn't have access
    return NextResponse.json({ 
      error: "You don't have permission to access this exam" 
    }, { status: 403 })
    
  } catch (error: any) {
    console.error("Error in enrollment check API:", error)
    return NextResponse.json({ error: "Failed to verify enrollment" }, { status: 500 })
  }
}