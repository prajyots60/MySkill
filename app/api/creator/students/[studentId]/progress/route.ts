import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params
    
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
    
    // Ensure the user is a creator
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
    })
    
    if (user?.role !== "CREATOR") {
      return new NextResponse("Forbidden", { status: 403 })
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get("courseId")
    
    if (!courseId) {
      return new NextResponse("Course ID is required", { status: 400 })
    }
    
    // Verify that this is the creator's course
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
        creatorId: session.user.id,
      },
      include: {
        sections: {
          include: {
            lectures: {
              select: {
                id: true,
                title: true,
                order: true,
                duration: true,
                type: true,
                videoId: true,
                isPreview: true,
              },
            },
          },
        },
      },
    })
    
    if (!course) {
      return new NextResponse("Course not found or you don't have access", { status: 404 })
    }
    
    // Verify that the student is enrolled in this course
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_contentId: {
          userId: studentId,
          contentId: courseId,
        },
      },
    })
    
    if (!enrollment) {
      return new NextResponse("Student is not enrolled in this course", { status: 404 })
    }
    
    // Flatten lectures for easier progress tracking
    const lectures = course.sections.flatMap(section => 
      section.lectures.map(lecture => ({
        ...lecture,
        sectionId: section.id,
        sectionTitle: section.title,
      }))
    ).sort((a, b) => {
      // Sort by section order first, then by lecture order
      const sectionA = course.sections.find(s => s.id === a.sectionId)
      const sectionB = course.sections.find(s => s.id === b.sectionId)
      
      if (sectionA?.order !== sectionB?.order) {
        return (sectionA?.order || 0) - (sectionB?.order || 0)
      }
      
      return a.order - b.order
    })
    
    // Get progress for all lectures in this course for this student
    const progress = await prisma.progress.findMany({
      where: {
        userId: studentId,
        lecture: {
          section: {
            contentId: courseId,
          },
        },
      },
    })
    
    // Map progress to lectures
    const lecturesWithProgress = lectures.map(lecture => {
      const lectureProgress = progress.find(p => p.lectureId === lecture.id)
      return {
        ...lecture,
        progress: lectureProgress ? {
          percentage: lectureProgress.percentage,
          isComplete: lectureProgress.isComplete,
          timeSpentSeconds: lectureProgress.timeSpentSeconds,
          updatedAt: lectureProgress.updatedAt,
        } : {
          percentage: 0,
          isComplete: false,
          timeSpentSeconds: 0,
          updatedAt: null,
        },
      }
    })
    
    // Calculate overall course progress
    const completedLectures = progress.filter(p => p.isComplete).length
    const totalLectures = lectures.length
    const overallProgress = totalLectures > 0 
      ? Math.round((completedLectures / totalLectures) * 100) 
      : 0
    
    // Get the most recent progress update
    const latestProgress = progress.length > 0 
      ? progress.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0].updatedAt 
      : enrollment.enrolledAt
    
    // Calculate time spent
    const totalTimeSpent = progress.reduce((total, p) => total + p.timeSpentSeconds, 0)
    
    return NextResponse.json({
      progress: {
        courseId,
        studentId,
        enrolledAt: enrollment.enrolledAt,
        completedLectures,
        totalLectures,
        overallProgress,
        lastActive: latestProgress,
        totalTimeSpentSeconds: totalTimeSpent,
        lectures: lecturesWithProgress,
      },
    })
  } catch (error) {
    console.error("[STUDENT_PROGRESS_GET]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}