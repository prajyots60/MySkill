import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const data = await req.json();
    const { 
      userId, 
      courseId, 
      lectureId, 
      violationType, 
      warningCount, 
      isBanned, 
      timestamp 
    } = data;

    // Validate userId matches session user
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "User ID mismatch" }, { status: 403 });
    }

    // Skip for creators and admins (double-check server-side)
    if (session.user.role === "CREATOR" || session.user.role === "ADMIN") {
      return NextResponse.json({ status: "ignored" });
    }

    // Record the violation in the database
    const securityViolation = await prisma.securityViolation.create({
      data: {
        userId,
        courseId,
        lectureId,
        violationType,
        warningCount,
        timestamp: new Date(timestamp),
      },
    });

    // If user is banned, update their account status
    if (isBanned) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          securityStatus: "BANNED",
          banReason: "Multiple developer tools violations",
          bannedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      status: "success",
      violation: securityViolation,
      userBanned: isBanned,
    });
  } catch (error) {
    console.error("Error recording security violation:", error);
    return NextResponse.json(
      { error: "Failed to record security violation" },
      { status: 500 }
    );
  }
}