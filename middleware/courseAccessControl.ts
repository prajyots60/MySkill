import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";

export async function courseAccessControl(req: NextRequest) {
  try {
    const token = await getToken({ req });
    const url = req.nextUrl.clone();

    // Only process requests for content pages
    if (!url.pathname.startsWith("/content/")) {
      return NextResponse.next();
    }

    // Extract the courseId from the URL
    const courseId = url.pathname.replace("/content/", "");

    // Skip the middleware check for regular pages that aren't specific courses
    if (!courseId || courseId.includes("/")) {
      return NextResponse.next();
    }

    // Get the course visibility
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
      },
      select: {
        visibility: true,
        creatorId: true,
      },
    });

    // If course doesn't exist, let the application handle the 404
    if (!course) {
      return NextResponse.next();
    }

    // If the course is public, allow access
    if (course.visibility === "PUBLIC") {
      return NextResponse.next();
    }

    // If course is hidden, check if the user is the creator or admin
    if (
      token?.sub &&
      (token.sub === course.creatorId || token?.role === "ADMIN")
    ) {
      return NextResponse.next();
    }

    // Check if the user has a valid enrollment for the course
    if (token?.sub) {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId: token.sub,
          contentId: courseId,
        },
      });

      if (enrollment) {
        return NextResponse.next();
      }
    }

    // Get the inviteToken from query params if available
    const inviteToken = url.searchParams.get("inviteToken");

    if (inviteToken) {
      const invite = await prisma.inviteLink.findUnique({
        where: { token: inviteToken },
        select: {
          contentId: true,
          expiresAt: true,
          maxUsages: true,
          usageCount: true,
        },
      });

      if (invite && invite.contentId === courseId) {
        // Check if invite is not expired and under usage limit
        const isExpired =
          invite.expiresAt && new Date() > new Date(invite.expiresAt);
        const isOverUsed =
          invite.maxUsages && invite.usageCount >= invite.maxUsages;

        if (!isExpired && !isOverUsed) {
          // Allow access
          return NextResponse.next();
        }
      }
    }

    // If the user doesn't have access, redirect to the access denied page
    url.pathname = "/access-denied";
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Error in courseAccessControl middleware:", error);
    return NextResponse.next();
  }
}
