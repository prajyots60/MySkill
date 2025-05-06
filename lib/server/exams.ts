import { prisma } from "@/lib/db"
import { ExamStatus, ExamType, QuestionType } from "@prisma/client"
import { randomUUID } from "crypto"

// Types
export interface ExamData {
  title: string
  description?: string
  instructions?: string
  type?: ExamType
  passingScore?: number
  timeLimit?: number
  startDate?: Date
  endDate?: Date
  contentId?: string
  sectionId?: string
  lectureId?: string
}

export interface QuestionData {
  text: string
  type: QuestionType
  required: boolean
  points?: number
  negativeMarking?: number
  options?: {
    text: string
    isCorrect: boolean
  }[]
}

export interface ExamSubmissionData {
  examId: string
  studentId: string
  responses: {
    questionId: string
    selectedOptionIds?: string[]
    textResponse?: string
  }[]
  submitTime?: Date
}

// Create a new exam
export async function createExam(creatorId: string, examData: ExamData) {
  try {
    // Generate a unique ID to replace Google Forms formId
    const uniqueId = randomUUID()
    
    // Clean up optional fields to prevent foreign key constraint errors
    const contentId = examData.contentId && examData.contentId.trim() !== "" ? examData.contentId : null
    const sectionId = examData.sectionId && examData.sectionId.trim() !== "" ? examData.sectionId : null
    const lectureId = examData.lectureId && examData.lectureId.trim() !== "" ? examData.lectureId : null
    
    // Create the exam in our database
    const exam = await prisma.exam.create({
      data: {
        title: examData.title,
        description: examData.description || "",
        instructions: examData.instructions || "",
        type: examData.type || "QUIZ",
        status: "DRAFT",
        passingScore: examData.passingScore,
        timeLimit: examData.timeLimit,
        startDate: examData.startDate,
        endDate: examData.endDate,
        contentId: contentId,
        sectionId: sectionId,
        lectureId: lectureId,
        creatorId: creatorId,
        // Replace Google Form IDs with our own unique IDs
        formId: uniqueId,
        // formUrl field removed as it's not in the Prisma schema
      },
    })

    // Return the exam with an edit URL instead of Google Forms URL
    return {
      examId: exam.id,
      formId: exam.formId, // Our custom unique ID
      formUrl: `/exams/${exam.formId}/edit`, // URL to edit our custom form
    }
  } catch (error) {
    console.error("Error creating exam:", error)
    throw error
  }
}

// Add a question to an exam
export async function addQuestionToExam(
  examId: string, 
  questionData: QuestionData,
  order: number = 0 // Default to the first position
) {
  try {
    // Find the exam to ensure it exists
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true }
    })

    if (!exam) {
      throw new Error("Exam not found")
    }

    // Generate a unique ID for the question
    const questionUniqueId = randomUUID()
    
    // Create the question
    const question = await prisma.question.create({
      data: {
        text: questionData.text,
        type: questionData.type,
        required: questionData.required,
        order: order || exam.questions.length, // Place at the end if order not specified
        points: questionData.points || 1,
        negativeMarking: questionData.negativeMarking,
        examId: examId,
        questionId: questionUniqueId, // Our own unique ID instead of Google Forms ID
      },
    })

    // If this question has options, create them
    let optionIds: string[] = []
    
    if (questionData.options && questionData.options.length > 0) {
      const optionPromises = questionData.options.map((option, index) => {
        const optionUniqueId = randomUUID()
        optionIds.push(optionUniqueId)
        
        return prisma.questionOption.create({
          data: {
            text: option.text,
            isCorrect: option.isCorrect,
            order: index,
            questionId: question.id,
            optionId: optionUniqueId, // Our own unique ID instead of Google Forms ID
          }
        })
      })

      await Promise.all(optionPromises)
    }

    return {
      questionId: question.id,
      optionIds,
    }
  } catch (error) {
    console.error("Error adding question to exam:", error)
    throw error
  }
}

// Get an exam with its questions and options
export async function getExam(examId: string) {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    })

    if (!exam) {
      throw new Error("Exam not found")
    }

    return exam
  } catch (error) {
    console.error("Error getting exam:", error)
    throw error
  }
}

// Get an exam by its form ID (the unique ID we generated)
export async function getExamByFormId(formId: string) {
  try {
    const exam = await prisma.exam.findFirst({
      where: { formId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    })

    if (!exam) {
      throw new Error("Exam not found")
    }

    return exam
  } catch (error) {
    console.error("Error getting exam by form ID:", error)
    throw error
  }
}

// Update an exam
export async function updateExam(examId: string, examData: Partial<ExamData>) {
  try {
    const exam = await prisma.exam.update({
      where: { id: examId },
      data: examData,
    })

    return exam
  } catch (error) {
    console.error("Error updating exam:", error)
    throw error
  }
}

// Delete a question from an exam
export async function deleteQuestion(questionId: string) {
  try {
    await prisma.question.delete({
      where: { id: questionId },
    })

    return true
  } catch (error) {
    console.error("Error deleting question:", error)
    throw error
  }
}

// Publish an exam (change status from DRAFT to PUBLISHED)
export async function publishExam(examId: string) {
  try {
    const exam = await prisma.exam.update({
      where: { id: examId },
      data: { status: "PUBLISHED" },
    })

    // Create the published URL (user-facing URL to take the exam)
    const publishedUrl = `/exams/${exam.formId}/take`

    return {
      publishedUrl,
    }
  } catch (error) {
    console.error("Error publishing exam:", error)
    throw error
  }
}

// Close an exam to new responses
export async function closeExam(examId: string) {
  try {
    const exam = await prisma.exam.update({
      where: { id: examId },
      data: { status: "CLOSED" },
    })

    return true
  } catch (error) {
    console.error("Error closing exam:", error)
    throw error
  }
}

// Submit an exam response
export async function submitExamResponse(submissionData: ExamSubmissionData) {
  try {
    // Generate a response ID
    const responseId = randomUUID()
    
    // Get the exam to calculate max score
    const exam = await prisma.exam.findUnique({
      where: { id: submissionData.examId },
      include: { 
        questions: { 
          include: { 
            options: true 
          } 
        } 
      },
    })

    if (!exam) {
      throw new Error("Exam not found")
    }

    // Calculate max possible score
    const maxScore = exam.questions.reduce((total, q) => total + (q.points || 1), 0)
    
    // Check if a student response already exists
    const existingResponse = await prisma.studentExamResponse.findUnique({
      where: {
        examId_studentId: {
          examId: submissionData.examId,
          studentId: submissionData.studentId
        }
      },
      include: {
        responses: true
      }
    })

    // If an existing response is found, reject the submission
    if (existingResponse) {
      throw new Error("You have already submitted this exam")
    }

    // Create a new student exam response
    const studentResponse = await prisma.studentExamResponse.create({
      data: {
        examId: submissionData.examId,
        studentId: submissionData.studentId,
        submitTime: submissionData.submitTime || new Date(),
        maxScore,
        responseId, // Our custom unique ID
      },
    })

    // Create each question response and calculate the score
    let totalScore = 0

    const responsePromises = submissionData.responses.map(async (response) => {
      // Find the corresponding question
      const question = exam.questions.find(q => q.id === response.questionId)
      
      if (!question) {
        throw new Error(`Question ${response.questionId} not found in exam`)
      }

      // Determine if the response is correct
      let isCorrect: boolean | null = null
      let pointsAwarded: number | null = null

      if (question.type === 'MULTIPLE_CHOICE') {
        // For multiple choice, check if they selected the correct option
        if (response.selectedOptionIds && response.selectedOptionIds.length === 1) {
          const correctOption = question.options.find(opt => opt.isCorrect)
          isCorrect = correctOption ? response.selectedOptionIds[0] === correctOption.id : false
          pointsAwarded = isCorrect ? (question.points || 1) : (question.negativeMarking ? -1 * question.negativeMarking : 0)
        } else {
          isCorrect = false
          pointsAwarded = question.negativeMarking ? -1 * question.negativeMarking : 0
        }
      } else if (question.type === 'CHECKBOX') {
        // For checkbox, they need to select all correct options and no incorrect ones
        const correctOptionIds = question.options.filter(opt => opt.isCorrect).map(opt => opt.id)
        const incorrectOptionIds = question.options.filter(opt => !opt.isCorrect).map(opt => opt.id)
        
        // Check if they selected all correct options
        const allCorrectSelected = correctOptionIds.every(id => 
          response.selectedOptionIds ? response.selectedOptionIds.includes(id) : false
        )
        
        // Check if they selected any incorrect options
        const noIncorrectSelected = incorrectOptionIds.every(id => 
          response.selectedOptionIds ? !response.selectedOptionIds.includes(id) : true
        )
        
        isCorrect = allCorrectSelected && noIncorrectSelected
        pointsAwarded = isCorrect ? (question.points || 1) : (question.negativeMarking ? -1 * question.negativeMarking : 0)
      } else if (question.type === 'SHORT_ANSWER' || question.type === 'PARAGRAPH') {
        // Text responses need manual grading, set to null
        isCorrect = null
        pointsAwarded = null
      }

      // Add to total score if points were awarded
      if (pointsAwarded !== null) {
        totalScore += pointsAwarded
      }

      // Create the question response
      return prisma.questionResponse.create({
        data: {
          studentExamResponseId: studentResponse.id,
          questionId: response.questionId,
          selectedOptionIds: response.selectedOptionIds || [],
          textResponse: response.textResponse,
          isCorrect,
          pointsAwarded,
        },
      })
    })

    await Promise.all(responsePromises)

    // Update the student exam response with the score
    // Only do this for exams that don't have text questions requiring manual grading
    const hasTextQuestions = exam.questions.some(q => 
      q.type === 'SHORT_ANSWER' || q.type === 'PARAGRAPH'
    )

    if (!hasTextQuestions) {
      // Make sure total score isn't negative
      if (totalScore < 0) totalScore = 0
      
      // Calculate if student passed
      const passed = exam.passingScore 
        ? (totalScore / maxScore * 100) >= exam.passingScore 
        : null

      await prisma.studentExamResponse.update({
        where: { id: studentResponse.id },
        data: {
          score: totalScore,
          passed,
        },
      })
    }

    return {
      responseId: studentResponse.id,
      score: !hasTextQuestions ? totalScore : null,
      maxScore,
      passed: !hasTextQuestions && exam.passingScore 
        ? (totalScore / maxScore * 100) >= exam.passingScore 
        : null,
      requiresGrading: hasTextQuestions,
    }
  } catch (error) {
    console.error("Error submitting exam response:", error)
    throw error
  }
}

// Get exam responses
export async function getExamResponses(examId: string) {
  try {
    const responses = await prisma.studentExamResponse.findMany({
      where: { examId },
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
            question: true,
          }
        }
      },
      orderBy: { submitTime: 'desc' },
    })

    return responses
  } catch (error) {
    console.error("Error getting exam responses:", error)
    throw error
  }
}

// Grade a text response
export async function gradeTextResponse(
  responseId: string,
  questionId: string,
  isCorrect: boolean,
  pointsAwarded: number
) {
  try {
    // Update the question response
    await prisma.questionResponse.update({
      where: {
        id: responseId,
      },
      data: {
        isCorrect,
        pointsAwarded,
      },
    })

    // Get all graded responses for this student submission
    const studentExamResponse = await prisma.questionResponse.findFirst({
      where: {
        id: responseId,
      },
      select: {
        studentExamResponseId: true,
      },
    })

    if (!studentExamResponse) {
      throw new Error("Response not found")
    }

    // Calculate the updated total score
    const allResponses = await prisma.questionResponse.findMany({
      where: {
        studentExamResponseId: studentExamResponse.studentExamResponseId,
      },
    })

    // Calculate the new total score
    const newTotalScore = allResponses.reduce((total, response) => {
      return total + (response.pointsAwarded || 0)
    }, 0)

    // Get the exam to check if student passed
    const examResponse = await prisma.studentExamResponse.findUnique({
      where: { id: studentExamResponse.studentExamResponseId },
      include: { exam: true },
    })

    // Calculate if student passed based on passing score
    const passed = examResponse?.exam.passingScore && examResponse.maxScore
      ? (newTotalScore / examResponse.maxScore * 100) >= examResponse.exam.passingScore
      : null

    // Update the student exam response with the new score
    await prisma.studentExamResponse.update({
      where: { id: studentExamResponse.studentExamResponseId },
      data: {
        score: newTotalScore,
        passed,
      },
    })

    return {
      newScore: newTotalScore,
      passed,
    }
  } catch (error) {
    console.error("Error grading text response:", error)
    throw error
  }
}

// Get a specific student's exam response
export async function getStudentExamResponse(examId: string, studentId: string) {
  try {
    const response = await prisma.studentExamResponse.findUnique({
      where: {
        examId_studentId: {
          examId: examId,
          studentId: studentId
        }
      }
    })
    
    return response
  } catch (error) {
    console.error("Error getting student exam response:", error)
    throw error
  }
}