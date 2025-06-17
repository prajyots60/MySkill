import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { revalidatePath } from "next/cache";
import { EnrollmentStatus } from "@prisma/client";

/**
 * Endpoint to handle cleanup of expired enrollments
 * This should be called by a scheduled cron job
 */
export async function POST(req: Request) {
  try {
    // Get Authorization header
    const authHeader = req.headers.get("Authorization");

    // Verify the request is coming from a trusted source (e.g., cron job)
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    
    // Find all expired enrollments that haven't been marked as expired yet
    const expiredEnrollments = await prisma.enrollment.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
        status: {
          not: EnrollmentStatus.EXPIRED
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
        content: {
          select: {
            id: true,
            title: true
          }
        }
      },
    });

    // Update enrollment status to EXPIRED in a transaction
    const result = await prisma.$transaction(async (tx) => {
      for (const enrollment of expiredEnrollments) {
        // Update enrollment status to EXPIRED
        await tx.enrollment.update({
          where: {
            id: enrollment.id,
          },
          data: {
            status: EnrollmentStatus.EXPIRED,
          },
        });

        // Clear Redis cache
        await redis.del(`enrollment:${enrollment.contentId}:${enrollment.userId}`);
        await redis.del(`enrollment:${enrollment.userId}:${enrollment.contentId}`);
        await redis.del(`student:enrollments:${enrollment.userId}`);

        // Revalidate paths
        revalidatePath(`/content/${enrollment.contentId}`);
        revalidatePath(`/dashboard/student`);
        revalidatePath(`/dashboard/student/my-courses`);
      }

      return expiredEnrollments;
    });

    return NextResponse.json({
      success: true,
      message: `Updated ${result.length} expired enrollments`,
      expiredEnrollments: result.map(e => ({
        user: e.user.email,
        course: e.content.title,
        enrollmentId: e.id,
        expiresAt: e.expiresAt
      }))
    });
  } catch (error) {
    console.error("Error in enrollment cleanup:", error);
    return NextResponse.json(
      { error: "Failed to process expired enrollments" },
      { status: 500 }
    );
  }
}
