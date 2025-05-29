import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";  // Fixed the import to use the correct path
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { invalidateCache, REDIS_KEYS } from "@/lib/redis";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "CREATOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studentEmail, courseId } = await req.json();

    if (!studentEmail || !courseId) {
      return NextResponse.json({ error: "Student email and course ID are required" }, { status: 400 });
    }

    // Verify course exists and creator owns it
    const course = await prisma.content.findUnique({
      where: { id: courseId },
    });
    
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    
    if (course.creatorId !== session.user.id) {
      return NextResponse.json({ error: "You can only add students to your own courses" }, { status: 403 });
    }

    // Verify student existence
    const student = await prisma.user.findUnique({
      where: { email: studentEmail },
    });

    if (!student) {
      return NextResponse.json({ 
        error: "Student not found", 
        status: "NOT_FOUND" 
      }, { status: 404 });
    }

    if (student.role !== "STUDENT") {
      return NextResponse.json({ 
        error: "Email does not belong to a student account", 
        status: "INVALID_ROLE" 
      }, { status: 400 });
    }

    // Check if the student is already enrolled
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        userId: student.id,
        contentId: courseId,
      },
    });

    if (existingEnrollment) {
      return NextResponse.json({ 
        error: "Student is already enrolled in this course",
        status: "ALREADY_ENROLLED"
      }, { status: 400 });
    }

    // Enroll the student - only use fields defined in the schema
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: student.id,
        contentId: courseId,
        status: "ACTIVE",  // Adding status field which exists in the schema
        price: course.price || 0,  // Include price information from the course
      },
    });

    // Invalidate caches
    await invalidateCache(REDIS_KEYS.USER_ENROLLMENTS(student.id));
    await invalidateCache(REDIS_KEYS.COURSE_ENROLLMENTS(courseId));

    return NextResponse.json({ 
      message: "Student successfully enrolled", 
      enrollment,
      student: {
        id: student.id,
        name: student.name,
        email: student.email
      }
    });
  } catch (error: any) {
    console.error("Error in add-student API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}