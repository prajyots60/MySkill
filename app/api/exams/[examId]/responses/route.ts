import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Get responses for an exam and grade them
export async function GET(
  req: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    // Get the current session to check if user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    const { examId } = params;

    // Verify this is a valid exam
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          include: {
            options: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ success: false, message: "Exam not found" }, { status: 404 });
    }

    // Check if user is the creator or has admin role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    const isCreator = exam.creatorId === userId;
    const isAdmin = user?.role === "ADMIN";

    // If user is not creator or admin, they can't access responses
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ success: false, message: "Not authorized to view responses" }, { status: 403 });
    }

    // Fetch all student responses for this exam with their answers
    const studentExamResponses = await prisma.studentExamResponse.findMany({
      where: { 
        examId 
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          }
        },
        responses: {
          include: {
            question: {
              include: {
                options: true,
              }
            }
          }
        }
      }
    });

    // Format the responses for the frontend
    const formattedResponses = studentExamResponses.map(response => {
      // Calculate answers with question text and other details
      const answers = response.responses.map(answer => {
        let answerText = "";
        let isCorrect = answer.isCorrect;
        
        // Format the answer text based on question type
        if (answer.textResponse) {
          // For short answer or paragraph questions
          answerText = answer.textResponse;
        } else if (answer.selectedOptionIds.length > 0) {
          // For multiple choice or checkbox questions
          const selectedOptions = answer.question.options.filter(option => 
            answer.selectedOptionIds.includes(option.id)
          );
          
          answerText = selectedOptions.map(option => option.text).join(", ");
        }
        
        return {
          questionId: answer.questionId,
          questionText: answer.question.text,
          answerText: answerText,
          isCorrect: isCorrect ?? false,
          points: answer.pointsAwarded ?? 0,
          maxPoints: answer.question.points,
        };
      });
      
      // Calculate time spent (submitTime - startTime in seconds)
      const timeSpent = response.submitTime 
        ? Math.round((new Date(response.submitTime).getTime() - new Date(response.startTime).getTime()) / 1000) 
        : 0;
      
      return {
        id: response.id,
        studentId: response.student.id,
        studentName: response.student.name || "Unknown Student",
        submittedAt: response.submitTime || response.startTime,
        score: response.score ?? 0,
        maxScore: response.maxScore ?? 0,
        timeSpent: timeSpent,
        answers: answers,
      };
    });

    // Return the formatted responses
    return NextResponse.json({ 
      success: true, 
      responses: formattedResponses 
    });
    
  } catch (error) {
    console.error("Error fetching exam responses:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch exam responses" },
      { status: 500 }
    );
  }
}