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
    
    // Verify that this student is enrolled in one of the creator's courses
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: studentId,
        content: {
          creatorId: session.user.id,
        },
      },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            type: true,
            sections: {
              include: {
                lectures: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Using createdAt instead of enrolledAt which doesn't exist in schema
      },
    })
    
    if (enrollments.length === 0) {
      return new NextResponse("Student not found or not enrolled in any of your courses", { status: 404 })
    }
    
    // Get student details
    const student = await prisma.user.findUnique({
      where: {
        id: studentId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        role: true,
      },
    })
    
    if (!student) {
      return new NextResponse("Student not found", { status: 404 })
    }
    
    // Calculate total lecture count across all enrolled courses
    let totalLectures = 0
    let totalCompletedLectures = 0
    
    // Process enrollments to gather course progress data
    const coursesWithProgress = []
    
    for (const enrollment of enrollments) {
      // Count lectures in this course
      let courseProgress = {
        id: enrollment.content.id,
        title: enrollment.content.title,
        thumbnail: enrollment.content.thumbnail,
        type: enrollment.content.type,
        enrolledAt: enrollment.createdAt, // Using createdAt instead of enrolledAt
        completedLectures: 0,
        totalLectures: 0,
        progress: 0,
        lastAccessed: enrollment.createdAt, // Using createdAt instead of enrolledAt
      }
      
      // Count total lectures in this course
      for (const section of enrollment.content.sections) {
        courseProgress.totalLectures += section.lectures.length
        totalLectures += section.lectures.length
        
        // Get lecture IDs for progress lookup
        const lectureIds = section.lectures.map(lecture => lecture.id)
        
        // Fetch progress data for each lecture in this course
        if (lectureIds.length > 0) {
          const lectureProgress = await prisma.progress.findMany({
            where: {
              userId: studentId,
              lectureId: {
                in: lectureIds,
              },
              isComplete: true,
            },
            orderBy: {
              updatedAt: "desc",
            },
          })
          
          courseProgress.completedLectures += lectureProgress.length
          totalCompletedLectures += lectureProgress.length
          
          // Get the most recent activity timestamp
          if (lectureProgress.length > 0) {
            const mostRecentProgress = lectureProgress[0]
            courseProgress.lastAccessed = mostRecentProgress.updatedAt
          }
        }
      }
      
      // Calculate percentage completion
      if (courseProgress.totalLectures > 0) {
        courseProgress.progress = Math.round(
          (courseProgress.completedLectures / courseProgress.totalLectures) * 100
        )
      }
      
      coursesWithProgress.push(courseProgress)
    }
    
    // Calculate average completion rate
    const overallCompletionRate = totalLectures > 0
      ? Math.round((totalCompletedLectures / totalLectures) * 100)
      : 0
    
    // Get most recent activity
    const latestProgress = await prisma.progress.findFirst({
      where: {
        userId: studentId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        updatedAt: true,
      },
    })
    
    const lastActive = latestProgress?.updatedAt || enrollments[0].createdAt // Using createdAt instead of enrolledAt
    
    // Determine student status based on recent activity (active if activity in last 30 days)
    const isActive = new Date(lastActive) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    // Prepare the complete student data
    const studentData = {
      ...student,
      enrolledAt: enrollments[0].createdAt, // Using createdAt instead of enrolledAt
      coursesEnrolled: enrollments.length,
      completionRate: overallCompletionRate,
      lastActive,
      status: isActive ? "active" : "inactive",
      courses: coursesWithProgress,
    }
    
    return NextResponse.json({
      student: studentData,
    })
  } catch (error) {
    console.error("[STUDENT_GET]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}