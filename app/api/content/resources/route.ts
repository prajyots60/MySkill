import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { formatBytes } from "@/lib/utils/format"

// Get resources for a course, section, or lecture
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    let courseId = searchParams.get("courseId")
    const sectionId = searchParams.get("sectionId")
    const lectureId = searchParams.get("lectureId")
    
    // If we have a lectureId but no courseId, look up the courseId from the lecture
    if (lectureId && !courseId) {
      const lecture = await prisma.lecture.findUnique({
        where: { id: lectureId },
        select: { 
          section: {
            select: {
              contentId: true
            }
          }
        }
      });
      
      if (!lecture) {
        return NextResponse.json({ message: "Lecture not found" }, { status: 404 });
      }
      
      // Set courseId from the lecture's section relationship
      const contentId = lecture.section?.contentId;
      if (!contentId) {
        return NextResponse.json({ message: "Invalid lecture data" }, { status: 400 });
      }
      
      // Use the found courseId
      courseId = contentId;
    }
    
    if (!courseId) {
      return NextResponse.json({ message: "Course ID is required" }, { status: 400 })
    }
    
    // Check if user has access to the course - using Content model instead of Course
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: { creatorId: true }
    })
    
    if (!course) {
      return NextResponse.json({ message: "Course not found" }, { status: 404 })
    }
    
    const isCreator = course.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"
    
    // If not creator or admin, check if enrolled
    if (!isCreator && !isAdmin) {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          contentId: courseId, // Using contentId from the Enrollment model
          userId: session.user.id
        }
      })
      
      if (!enrollment) {
        return NextResponse.json({ message: "Not enrolled in this course" }, { status: 403 })
      }
    }
    
    // Build query based on parameters
    const query: any = { courseId }
    if (sectionId) query.sectionId = sectionId
    if (lectureId) query.lectureId = lectureId
    
    // Get resources
    const resources = await prisma.resource.findMany({
      where: query,
      orderBy: { createdAt: 'desc' }
    })
    
    // Format resources for client
    // Define interfaces for resource types
    interface PrismaResource {
      id: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      fileUrl: string;
      fileId: string;
      createdAt: Date;
    }
    
    interface FormattedResource {
      id: string;
      name: string;
      type: string;
      size: string;
      url: string;
      fileId: string;
      createdAt: string;
    }
    
    const formattedResources: FormattedResource[] = resources.map((resource: PrismaResource) => ({
      id: resource.id,
      name: resource.fileName,
      type: resource.fileType,
      size: formatBytes(resource.fileSize),
      url: resource.fileUrl,
      fileId: resource.fileId,
      createdAt: resource.createdAt.toISOString()
    }))
    
    return NextResponse.json({ 
      success: true,
      resources: formattedResources 
    })
  } catch (error) {
    console.error("Error fetching resources:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to fetch resources" },
      { status: 500 }
    )
  }
}

// Create a new resource
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    
    // Verify user is creator or admin
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Only creators can add resources" }, { status: 403 })
    }
    
    const data = await request.json()
    const { courseId, sectionId, lectureId, fileId, fileName, fileType, fileSize, fileUrl } = data
    
    if (!courseId || !fileId || !fileName) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }
    
    // Validate course exists and user is creator - using Content model instead of Course
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: { creatorId: true }
    })
    
    if (!course) {
      return NextResponse.json({ message: "Course not found" }, { status: 404 })
    }
    
    if (course.creatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Not authorized to add resources to this course" }, { status: 403 })
    }
    
    // If sectionId is provided, validate it belongs to the course
    if (sectionId) {
      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { contentId: true } // Using contentId from the Section model
      })
      
      if (!section || section.contentId !== courseId) {
        return NextResponse.json({ message: "Invalid section ID" }, { status: 400 })
      }
    }
    
    // If lectureId is provided, validate it belongs to the section
    if (lectureId && sectionId) {
      const lecture = await prisma.lecture.findUnique({
        where: { id: lectureId },
        select: { sectionId: true }
      })
      
      if (!lecture || lecture.sectionId !== sectionId) {
        return NextResponse.json({ message: "Invalid lecture ID" }, { status: 400 })
      }
    }
    
    // Create resource
    const resource = await prisma.resource.create({
      data: {
        courseId,
        sectionId: sectionId || null,
        lectureId: lectureId || null,
        fileId,
        fileName,
        fileType: fileType || '',
        fileSize: fileSize || 0,
        fileUrl
      }
    })
    
    return NextResponse.json({ 
      success: true,
      resource: {
        id: resource.id,
        name: resource.fileName,
        type: resource.fileType,
        size: formatBytes(resource.fileSize),
        url: resource.fileUrl,
        fileId: resource.fileId,
        createdAt: resource.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error("Error creating resource:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to create resource" },
      { status: 500 }
    )
  }
}