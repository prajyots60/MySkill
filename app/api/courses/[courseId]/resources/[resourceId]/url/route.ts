import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCourseFileUrl } from "@/lib/course-storage-utils";

// GET /api/courses/[courseId]/resources/[resourceId]/url
export async function GET(
  request: Request,
  { params }: { params: { courseId: string; resourceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { resourceId } = params;
    
    // Get URL for the resource
    const { searchParams } = new URL(request.url);
    const expiresInParam = searchParams.get("expiresIn");
    const expiresIn = expiresInParam ? parseInt(expiresInParam, 10) : 3600;
    
    const result = await getCourseFileUrl(resourceId, session.user.id, expiresIn);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error getting resource URL:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to get resource URL" 
      },
      { status: 500 }
    );
  }
}
