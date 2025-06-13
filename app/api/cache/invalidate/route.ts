import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redis } from "@/lib/redis";

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "CREATOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: "Course ID is required" },
        { status: 400 }
      );
    }

    // Invalidate Redis cache for this course
    const cacheKey = `course:${courseId}`;
    await redis.del(cacheKey);

    console.log(`Cache invalidated for courseId: ${courseId}`);

    return NextResponse.json({ 
      success: true,
      message: `Cache invalidated for courseId: ${courseId}`
    });
  } catch (error) {
    console.error("Error invalidating cache:", error);
    return NextResponse.json(
      { success: false, error: "Failed to invalidate cache" },
      { status: 500 }
    );
  }
}
