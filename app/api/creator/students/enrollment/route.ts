import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redis, REDIS_KEYS, invalidateCache } from "@/lib/redis";

export async function DELETE(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    
    // Ensure the user is a creator
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        role: true,
      },
    });
    
    if (user?.role !== "CREATOR" && user?.role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    
    // Parse the request body
    const data = await req.json();
    const { studentId, courseId } = data;
    
    if (!studentId || !courseId) {
      return NextResponse.json({ 
        success: false, 
        message: "Student ID and Course ID are required" 
      }, { status: 400 });
    }
    
    // Check if the course belongs to this creator
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
        creatorId: session.user.id,
      },
    });
    
    if (!course) {
      return NextResponse.json({ 
        success: false, 
        message: "Course not found or you don't have permission" 
      }, { status: 404 });
    }
    
    // Check if the enrollment exists
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_contentId: {
          userId: studentId,
          contentId: courseId,
        },
      },
    });
    
    if (!enrollment) {
      return NextResponse.json({ 
        success: false, 
        message: "Enrollment not found" 
      }, { status: 404 });
    }
    
    // Delete the enrollment
    await prisma.enrollment.delete({
      where: {
        userId_contentId: {
          userId: studentId,
          contentId: courseId,
        },
      },
    });
    
    // Invalidate relevant caches
    await invalidateCache(REDIS_KEYS.USER_ENROLLMENTS(studentId));
    await invalidateCache(REDIS_KEYS.USER_ENROLLED_COURSES(studentId));
    
    // For creator's data, we need to invalidate creator courses as it might contain enrollment counts
    await invalidateCache(REDIS_KEYS.CREATOR_COURSES(session.user.id));
    
    return NextResponse.json({ 
      success: true, 
      message: "Enrollment successfully removed" 
    });
    
  } catch (error) {
    console.error("[REMOVE_ENROLLMENT]", error);
    return NextResponse.json({ 
      success: false, 
      message: "Internal Server Error" 
    }, { status: 500 });
  }
}
