import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { addQuestionToForm } from "@/lib/server/gforms"

// Add a question to an exam
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
      return NextResponse.json({ message: "Only creators can add questions" }, { status: 403 })
    }

    // Use await to unwrap the params object before accessing its properties
    const examId = params.examId
    
    // Check if exam exists and belongs to user
    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        creatorId: session.user.id,
      },
    })

    if (!exam) {
      return NextResponse.json({ message: "Exam not found or you don't have permission" }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    
    // Check if it's a batch request or single question
    if (Array.isArray(body)) {
      // Handle batch creation
      const questions = [];
      const errors = [];
      
      for (const questionData of body) {
        try {
          const { 
            text, 
            type, 
            required, 
            order, 
            points,
            negativeMarking,
            options 
          } = questionData;
          
          if (!text || !type) {
            errors.push({ message: "Question text and type are required", data: questionData });
            continue;
          }
          
          // Convert our question type to Google Forms question type
          let googleFormsType: "MULTIPLE_CHOICE" | "CHECKBOX" | "SHORT_ANSWER" | "PARAGRAPH" = "MULTIPLE_CHOICE";
          switch (type) {
            case "MULTIPLE_CHOICE":
              googleFormsType = "MULTIPLE_CHOICE";
              break;
            case "CHECKBOX":
              googleFormsType = "CHECKBOX";
              break;
            case "SHORT_ANSWER":
              googleFormsType = "SHORT_ANSWER";
              break;
            case "PARAGRAPH":
              googleFormsType = "PARAGRAPH";
              break;
            default:
              errors.push({ message: "Invalid question type", data: questionData });
              continue;
          }

          // Add question to Google Form
          const formResult = await addQuestionToForm(session.user.id, exam.formId, {
            text,
            type: googleFormsType,
            required: required !== false,
            options: options || [],
          });

          // Make sure questionId is a string, not an array
          const questionIdStr = Array.isArray(formResult.questionId) 
            ? formResult.questionId[0] 
            : formResult.questionId;

          // Create the question in the database
          const question = await prisma.question.create({
            data: {
              text,
              type,
              required: required !== false,
              order: order || 0,
              points: points || 1,
              negativeMarking: negativeMarking || null,
              examId,
              questionId: questionIdStr, // Ensure this is a string
            },
          });

          // If the question has options, create them in the database
          if (options && options.length > 0) {
            const optionIds = formResult.optionIds || [];
            
            // Create the options with optionIds from Google Forms
            for (let i = 0; i < options.length; i++) {
              const option = options[i];
              const optionId = optionIds[i] || `option_${i + 1}`;

              await prisma.questionOption.create({
                data: {
                  text: option.text,
                  isCorrect: option.isCorrect || false,
                  order: i,
                  questionId: question.id,
                  optionId,
                },
              });
            }
          }
          
          questions.push({
            ...question,
            options: options,
          });
        } catch (error) {
          console.error("Error processing question:", error);
          errors.push({ 
            message: error instanceof Error ? error.message : "Failed to process question", 
            data: questionData 
          });
        }
      }
      
      return NextResponse.json({
        success: true,
        questions,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      // Handle single question creation
      const { 
        text, 
        type, 
        required, 
        order, 
        points,
        negativeMarking,
        options 
      } = body;

      if (!text || !type) {
        return NextResponse.json({ message: "Question text and type are required" }, { status: 400 })
      }

      // Convert our question type to Google Forms question type
      let googleFormsType: "MULTIPLE_CHOICE" | "CHECKBOX" | "SHORT_ANSWER" | "PARAGRAPH" = "MULTIPLE_CHOICE";
      switch (type) {
        case "MULTIPLE_CHOICE":
          googleFormsType = "MULTIPLE_CHOICE";
          break;
        case "CHECKBOX":
          googleFormsType = "CHECKBOX";
          break;
        case "SHORT_ANSWER":
          googleFormsType = "SHORT_ANSWER";
          break;
        case "PARAGRAPH":
          googleFormsType = "PARAGRAPH";
          break;
        default:
          return NextResponse.json({ message: "Invalid question type" }, { status: 400 });
      }

      // Add question to Google Form
      const formResult = await addQuestionToForm(session.user.id, exam.formId, {
        text,
        type: googleFormsType,
        required: required !== false, // Default to true if not specified
        options: options || [],
      });

      // Make sure questionId is a string, not an array
      const questionIdStr = Array.isArray(formResult.questionId) 
        ? formResult.questionId[0] 
        : formResult.questionId;

      // Create the question in the database
      const question = await prisma.question.create({
        data: {
          text,
          type,
          required: required !== false,
          order: order || 0,
          points: points || 1,
          negativeMarking: negativeMarking || null,
          examId,
          questionId: questionIdStr, // Ensure this is a string
        },
      });

      // If the question has options, create them in the database
      if (options && options.length > 0) {
        const optionIds = formResult.optionIds || [];
        
        // Create the options with optionIds from Google Forms
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          const optionId = optionIds[i] || `option_${i + 1}`;

          await prisma.questionOption.create({
            data: {
              text: option.text,
              isCorrect: option.isCorrect || false,
              order: i,
              questionId: question.id,
              optionId,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        question: {
          ...question,
          options: options,
        },
      });
    }
  } catch (error) {
    console.error("Error adding question to exam:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to add question" },
      { status: 500 },
    )
  }
}

// Get questions for an exam
export async function GET(
  request: Request,
  { params }: { params: { examId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Use await to unwrap the params object before accessing its properties
    const {examId} = await params
    
    // Check if exam exists and belongs to user or user is an admin
    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        OR: [
          { creatorId: session.user.id },
          { ...(session.user.role === "ADMIN" ? {} : null) }
        ]
      }
    })

    if (!exam) {
      return NextResponse.json({ message: "Exam not found or you don't have permission" }, { status: 404 })
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
      questions
    })
  } catch (error) {
    console.error("Error getting questions:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to get questions" },
      { status: 500 },
    )
  }
}