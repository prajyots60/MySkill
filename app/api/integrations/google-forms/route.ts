import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAuthUrl } from "@/lib/server/gforms";

export async function GET() {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a creator
    if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only creators can connect to Google Forms" },
        { status: 403 }
      );
    }

    // Generate OAuth URL using the server-side utility
    const authUrl = getAuthUrl(session.user.id);

    return NextResponse.json({
      authUrl,
      message: "Ready to connect to Google Forms"
    });
  } catch (error) {
    console.error("Error preparing Google Forms integration:", error);
    return NextResponse.json(
      { message: "Failed to prepare Google Forms integration" },
      { status: 500 }
    );
  }
}