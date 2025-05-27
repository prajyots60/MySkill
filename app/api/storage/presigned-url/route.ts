import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { generatePresignedUploadUrl, generateStorageKey } from "@/lib/wasabi-storage";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse the request body
    const { filename, contentType, category, expiresIn = 3600 } = await request.json();

    if (!filename || !contentType || !category) {
      return NextResponse.json(
        { message: "Missing required fields: filename, contentType, and category are required" },
        { status: 400 }
      );
    }

    // Validate content type for security
    const allowedContentTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Videos
      'video/mp4', 'video/webm', 'video/ogg',
      // Audio
      'audio/mpeg', 'audio/ogg', 'audio/wav',
      // Other
      'application/zip', 'text/plain', 'text/csv'
    ];

    if (!allowedContentTypes.includes(contentType)) {
      return NextResponse.json(
        { message: "Content type not allowed" },
        { status: 400 }
      );
    }

    // Generate a storage key based on the category, filename, and user ID
    const key = generateStorageKey(category, filename, session.user.id);

    // Get a presigned URL for direct browser upload
    const presignedData = await generatePresignedUploadUrl(key, contentType, expiresIn);

    return NextResponse.json({
      ...presignedData,
      // Add additional useful information for the client
      filename,
      contentType,
      category,
      expiresIn,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to generate presigned URL"
      },
      { status: 500 }
    );
  }
}
