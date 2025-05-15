// Student exam utilities

import { prisma } from "@/lib/db"

/**
 * Check if a student is enrolled in the course associated with the exam
 * @param studentId The ID of the student
 * @param examId The ID of the exam
 * @returns Boolean indicating if the student is enrolled
 */
export async function isStudentEnrolledForExam(studentId: string, examId: string): Promise<boolean> {
  // First get the exam to find the associated course
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { contentId: true }
  })

  // If exam has no associated course, enrollment check doesn't apply
  if (!exam || !exam.contentId) {
    return false
  }

  // Check if student is enrolled in the course
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: studentId,
      contentId: exam.contentId
    }
  })

  return !!enrollment
}

/**
 * Get all exams available to a student from their enrolled courses
 * @param studentId The ID of the student
 * @returns Array of exams the student has access to
 */
export async function getStudentAvailableExams(studentId: string) {
  // Get all courses the student is enrolled in
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: studentId
    },
    select: {
      contentId: true
    }
  })

  const contentIds = enrollments.map(enrollment => enrollment.contentId)

  // Skip if the student isn't enrolled in any courses
  if (contentIds.length === 0) {
    return []
  }

  // Fetch all published/closed exams from the courses the student is enrolled in
  const exams = await prisma.exam.findMany({
    where: {
      contentId: {
        in: contentIds
      },
      status: {
        in: ['PUBLISHED', 'CLOSED']
      }
    },
    include: {
      content: {
        select: {
          id: true,
          title: true
        }
      },
      studentResponses: {
        where: {
          studentId: studentId
        },
        select: {
          id: true,
          score: true,
          maxScore: true,
          passed: true,
          submitTime: true
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })

  // Transform the data to include student's attempt information
  return exams.map(exam => {
    const hasAttempted = exam.studentResponses.length > 0
    const latestResponse = hasAttempted ? exam.studentResponses[0] : null
    
    let studentScore = null
    if (latestResponse?.score !== null && latestResponse?.maxScore) {
      studentScore = Math.round((latestResponse.score / latestResponse.maxScore) * 100)
    }

    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      status: exam.status,
      type: exam.type,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      passingScore: exam.passingScore,
      timeLimit: exam.timeLimit,
      formId: exam.formId,
      contentId: exam.contentId,
      content: exam.content,
      hasAttempted,
      studentScore,
      studentPassed: latestResponse?.passed,
      attemptedAt: latestResponse?.submitTime
    }
  })
}
