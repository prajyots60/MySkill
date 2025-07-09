import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// DELETE endpoint to delete an invite link
export async function DELETE(
  request: Request,
  { params }: { params: { courseId: string; linkId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { courseId, linkId } = params;

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
        { message: "You don't have permission to modify this course" },
        { status: 403 }
      );
    }

    // Find the invite link to make sure it belongs to this course
    const inviteLink = await prisma.inviteLink.findUnique({
      where: {
        id: linkId,
      },
      select: {
        contentId: true,
      },
    });

    if (!inviteLink) {
      return NextResponse.json(
        { message: "Invite link not found" },
        { status: 404 }
      );
    }

    if (inviteLink.contentId !== courseId) {
      return NextResponse.json(
        { message: "Invite link does not belong to this course" },
        { status: 403 }
      );
    }

    // Delete the invite link
    await prisma.inviteLink.delete({
      where: {
        id: linkId,
      },
    });

    return NextResponse.json(
      { message: "Invite link deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting invite link:", error);
    return NextResponse.json(
      { message: "Failed to delete invite link" },
      { status: 500 }
    );
  }
}
