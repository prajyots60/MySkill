import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EnrollmentStatus } from "@prisma/client";

/**
 * API endpoint to get enrollment statistics for a specific course
 */
export async function GET(
  req: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const { courseId } = params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify if the user is the creator of this course
    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: { creatorId: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isCreator = course.creatorId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "You don't have permission to access this data" },
        { status: 403 }
      );
    }

    // Get current date
    const now = new Date();
    
    // Get enrollments data with different statuses
    const [activeEnrollments, expiredEnrollments, activeButExpiringSoon] = await Promise.all([
      prisma.enrollment.count({
        where: {
          contentId: courseId,
          status: EnrollmentStatus.ACTIVE,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      }),
      prisma.enrollment.count({
        where: {
          contentId: courseId,
          status: EnrollmentStatus.EXPIRED,
        },
      }),
      prisma.enrollment.count({
        where: {
          contentId: courseId,
          status: EnrollmentStatus.ACTIVE,
          expiresAt: {
            gt: now,
            lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          },
        },
      }),
    ]);

    // Get total enrollments
    const totalEnrollments = await prisma.enrollment.count({
      where: {
        contentId: courseId,
      },
    });

    // Get users who didn't renew after expiration
    const notRenewedCount = await prisma.enrollment.count({
      where: {
        contentId: courseId,
        status: EnrollmentStatus.EXPIRED,
        // No subsequent active enrollment exists
        NOT: {
          userId: {
            in: await prisma.enrollment
              .findMany({
                where: {
                  contentId: courseId,
                  status: EnrollmentStatus.ACTIVE,
                },
                select: {
                  userId: true,
                },
              })
              .then((entries) => entries.map((e) => e.userId)),
          },
        },
      },
    });

    // Calculate renewal rate
    const renewalRate = expiredEnrollments > 0 
      ? ((expiredEnrollments - notRenewedCount) / expiredEnrollments) * 100
      : 0;

    // Get recent expired enrollments for notification
    const recentlyExpired = await prisma.enrollment.findMany({
      where: {
        contentId: courseId,
        status: EnrollmentStatus.EXPIRED,
        expiresAt: {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // In the last 7 days
        },
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        expiresAt: "desc",
      },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalEnrollments,
        activeEnrollments,
        expiredEnrollments,
        expiringSoon: activeButExpiringSoon,
        renewalRate: renewalRate.toFixed(2),
        recentlyExpired,
      },
    });
  } catch (error) {
    console.error("Error fetching enrollment statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrollment statistics" },
      { status: 500 }
    );
  }
}
