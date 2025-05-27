import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { deleteFromWasabi } from "@/lib/wasabi-storage";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse the request body
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json(
        { message: "Missing required field: key" },
        { status: 400 }
      );
    }

    // Check if the key follows the user's path pattern or user is admin
    const isUserFile = key.includes(`/users/${session.user.id}/`);
    const isAdmin = session.user.role === "ADMIN";
    
    if (!isUserFile && !isAdmin) {
      return NextResponse.json(
        { message: "You don't have permission to delete this file" },
        { status: 403 }
      );
    }

    // Delete the file from Wasabi
    const result = await deleteFromWasabi(key);

    return NextResponse.json({
      ...result,
      success: true,
    });
  } catch (error) {
    console.error("Error deleting file from Wasabi:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to delete file"
      },
      { status: 500 }
    );
  }
}
