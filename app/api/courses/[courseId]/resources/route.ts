import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { listCourseResources, uploadCourseFile } from "@/lib/course-storage-utils";
import { revalidatePath } from "next/cache";

// GET /api/courses/[courseId]/resources
export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const courseId = params.courseId;
    
    // Get category from query params if available
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;

    // List resources for this course
    const result = await listCourseResources(courseId, session.user.id, category);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing course resources:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to list course resources" 
      },
      { status: 500 }
    );
  }
}

// POST /api/courses/[courseId]/resources
export async function POST(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const courseId = params.courseId;
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = formData.get("category") as string || "resources";
    const metadataStr = formData.get("metadata") as string;
    
    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }
    
    // Parse metadata if provided
    let metadata = {};
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch (e) {
        console.warn("Invalid metadata JSON:", e);
      }
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Upload the file
    const result = await uploadCourseFile(
      buffer,
      file.name,
      file.type,
      courseId,
      session.user.id,
      category as any,
      metadata as Record<string, string>
    );
    
    // Revalidate the course page
    revalidatePath(`/content/${courseId}`);
    
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Error uploading course resource:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to upload course resource" 
      },
      { status: 500 }
    );
  }
}
