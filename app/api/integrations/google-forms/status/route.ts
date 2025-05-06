import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if user has Google Forms connected
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
        scope: {
          contains: "forms.body"
        }
      },
    });

    return NextResponse.json({
      connected: !!account,
      accountId: account?.id || null,
      lastUpdated: account?.updated_at || null
    });
  } catch (error) {
    console.error("Error checking Google Forms status:", error);
    return NextResponse.json(
      { message: "Failed to check Google Forms integration status" },
      { status: 500 }
    );
  }
}