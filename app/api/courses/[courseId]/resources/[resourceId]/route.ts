import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { deleteCourseFile } from "@/lib/course-storage-utils";
import { revalidatePath } from "next/cache";

// DELETE /api/courses/[courseId]/resources/[resourceId]
export async function DELETE(
  request: Request,
  { params }: { params: { courseId: string; resourceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { courseId, resourceId } = params;
    
    // Delete the resource
    const result = await deleteCourseFile(resourceId, session.user.id);
    
    // Revalidate the course page
    revalidatePath(`/content/${courseId}`);
    
    return NextResponse.json({
      success: true,
      resourceId
    });
  } catch (error) {
    console.error("Error deleting course resource:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to delete course resource" 
      },
      { status: 500 }
    );
  }
}
