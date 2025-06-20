import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NotificationType } from "@prisma/client"

export async function POST(request: Request) {
  try {
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

    const { sectionId, lectureTitle } = await request.json()

    if (!sectionId || !lectureTitle) {
      return new NextResponse("Section ID and lecture title are required", { status: 400 })
    }

    // Get the section with course info
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            enrollments: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    if (!section) {
      return new NextResponse("Section not found", { status: 404 })
    }

    // Get all enrolled students for this course
    const enrolledStudents = section.content.enrollments.map(enrollment => enrollment.userId)

    // Create notifications for all enrolled students
    await prisma.notification.createMany({
      data: enrolledStudents.map(studentId => ({
        userId: studentId,
        type: NotificationType.LECTURE_ADDED,
        title: "New Content Available",
        message: `New lecture "${lectureTitle}" has been added to ${section.content.title}`,
        contentId: section.content.id,
        read: false,
      })),
    })

    return NextResponse.json({
      success: true,
      message: "Notifications sent successfully",
      notificationCount: enrolledStudents.length,
    })
  } catch (error) {
    console.error("[NOTIFICATIONS_NEW_CONTENT_POST]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
} 