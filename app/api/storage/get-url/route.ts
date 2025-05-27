import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { generatePresignedUploadUrl } from "@/lib/wasabi-storage";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse the request body
    const { key, expiresIn = 3600 } = await request.json();

    if (!key) {
      return NextResponse.json(
        { message: "Missing required field: key" },
        { status: 400 }
      );
    }

    // Generate a presigned URL for viewing/downloading the file
    const presignedData = await generatePresignedUploadUrl(key, expiresIn);

    return NextResponse.json({
      ...presignedData,
      success: true,
      expiresIn,
    });
  } catch (error) {
    console.error("Error generating presigned URL for retrieving file:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to generate presigned URL for file"
      },
      { status: 500 }
    );
  }
}
