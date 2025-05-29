import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
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
    
    // Define the base filter for enrollments
    let filter: any = {
      content: {
        creatorId: session.user.id,
      },
    }
    
    // Add course filter if provided
    if (courseId) {
      filter.contentId = courseId
    }
    
    // Get all enrollments for the creator's courses with student details
    const enrollments = await prisma.enrollment.findMany({
      where: filter,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
          },
        },
        content: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Using createdAt instead of enrolledAt
      },
    })
    
    // Process the enrollments to create a student-centric view
    const studentMap = new Map()
    
    for (const enrollment of enrollments) {
      const { user, content, createdAt } = enrollment // Using createdAt instead of enrolledAt
      
      if (!studentMap.has(user.id)) {
        studentMap.set(user.id, {
          id: user.id,
          name: user.name,
          email: user.email || "",
          image: user.image || "",
          enrolledAt: createdAt, // Using createdAt instead of enrolledAt
          coursesEnrolled: [],
          totalCoursesEnrolled: 0,
          lastActive: null,
          status: "active", // Default status, can be refined later
        })
      }
      
      const student = studentMap.get(user.id)
      student.totalCoursesEnrolled += 1
      
      // Add course to the student's enrolled courses
      student.coursesEnrolled.push({
        id: content.id,
        title: content.title,
        enrolledAt: createdAt, // Using createdAt instead of enrolledAt
      })
      
      // Update last enrolled date if this is more recent
      if (new Date(createdAt) > new Date(student.enrolledAt)) {
        student.enrolledAt = createdAt // Using createdAt instead of enrolledAt
      }
    }
    
    // Convert the map to an array of students
    const students = Array.from(studentMap.values())
    
    // Add progress data for each student
    for (const student of students) {
      // Get the most recent progress data for this student (to determine last active)
      const latestProgress = await prisma.progress.findFirst({
        where: {
          userId: student.id,
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          updatedAt: true,
        },
      })
      
      // Calculate average completion rate across all courses
      const progressData = await prisma.progress.groupBy({
        by: ["userId"],
        where: {
          userId: student.id,
        },
        _avg: {
          percentage: true,
        },
      })
      
      // Update student data with progress information
      student.lastActive = latestProgress?.updatedAt || student.enrolledAt
      student.completionRate = progressData[0]?._avg.percentage || 0
      student.status = new Date(student.lastActive) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
        ? "active" 
        : "inactive"
    }
    
    return NextResponse.json({
      students,
    })
  } catch (error) {
    console.error("[STUDENTS_GET]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}