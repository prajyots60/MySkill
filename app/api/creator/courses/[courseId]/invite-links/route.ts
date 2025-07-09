import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

// GET endpoint to list all invite links for a course
export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = await params;

    // Get the course to check permissions
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      select: {
        creatorId: true,
      },
    });

    if (!course) {
      return NextResponse.json(
        { message: "Course not found" },
        { status: 404 }
      );
    }

    // Check if user is the creator or an admin
    if (course.creatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { message: "You don't have permission to access this course" },
        { status: 403 }
      );
    }

    // Get all invite links for this course
    const inviteLinks = await prisma.inviteLink.findMany({
      where: {
        contentId: courseId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ inviteLinks });
  } catch (error) {
    console.error("Error getting invite links:", error);
    return NextResponse.json(
      { message: "Failed to get invite links" },
      { status: 500 }
    );
  }
}

// POST endpoint to create a new invite link
export async function POST(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = params;

    // Get the course to check permissions
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      select: {
        creatorId: true,
        visibility: true,
      },
    });

    if (!course) {
      return NextResponse.json(
        { message: "Course not found" },
        { status: 404 }
      );
    }

    // Check if user is the creator or an admin
    if (course.creatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { message: "You don't have permission to modify this course" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { expiresAt, maxUsages } = body;

    // Generate a unique token for the invite link
    const token = randomUUID();

    // Create the invite link
    const inviteLink = await prisma.inviteLink.create({
      data: {
        token,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxUsages,
        contentId: courseId,
      },
    });

    // If course is not already hidden, set it to hidden
    if (course.visibility !== "HIDDEN") {
      await prisma.content.update({
        where: {
          id: courseId,
        },
        data: {
          visibility: "HIDDEN",
        },
      });
    }

    return NextResponse.json({ inviteLink }, { status: 201 });
  } catch (error) {
    console.error("Error creating invite link:", error);
    return NextResponse.json(
      { message: "Failed to create invite link" },
      { status: 500 }
    );
  }
}
