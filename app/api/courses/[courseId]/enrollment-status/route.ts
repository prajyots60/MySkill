import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    // No need to await params - it's already resolved
    const { courseId } = await params;
    const session = await getServerSession(authOptions);

    // Extract params from URL if provided
    const url = new URL(request.url);
    const lectureId = url.searchParams.get("lectureId");
    const timestamp = url.searchParams.get("t");
    const skipCache = url.searchParams.get("skipCache") === "true";
    const inviteToken = url.searchParams.get("inviteToken");

    // Try to get from cache first if user is logged in and not explicitly skipping cache
    // Skip cache if timestamp is present (indicates cache busting request)
    if (session?.user && !skipCache && !timestamp) {
      const cacheKey = `enrollment:${courseId}:${session.user.id}${
        lectureId ? `:${lectureId}` : ""
      }`;
      const cachedStatus = await redis.get(cacheKey);

      // Fix for JSON parsing - the Redis client already returns a parsed object
      if (cachedStatus !== null) {
        return NextResponse.json(cachedStatus);
      }
    }

    const course = await prisma.content.findUnique({
      where: { id: courseId },
      select: {
        price: true,
        creatorId: true,
        isPublished: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // If lectureId is provided, check if it's a preview lecture
    let isPreviewLecture = false;
    if (lectureId) {
      const lecture = await prisma.lecture.findUnique({
        where: { id: lectureId },
        select: { isPreview: true },
      });
      isPreviewLecture = !!lecture?.isPreview;
    }

    // Check for a valid invite token
    let hasValidInvite = false;

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
          hasValidInvite = true;
        }
      }
    }

    // If the user is not logged in
    if (!session?.user) {
      // For free courses, previews, or if the requested lecture is a preview, allow access
      if (
        course.price === 0 ||
        course.price === null ||
        isPreviewLecture ||
        hasValidInvite
      ) {
        return NextResponse.json({
          isEnrolled: false,
          isFree: course.price === 0 || course.price === null,
          isPreviewLecture,
          hasValidInvite,
        });
      }
      return NextResponse.json(
        { isEnrolled: false, requiresAuth: true },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (session.user.role === "ADMIN") {
      const response = { isEnrolled: true, isAdmin: true };
      if (session.user) {
        const cacheKey = `enrollment:${courseId}:${session.user.id}${
          lectureId ? `:${lectureId}` : ""
        }`;
        await redis.set(cacheKey, response, { ex: 3600 }); // 1 hour cache
      }
      return NextResponse.json(response);
    }

    // If the user is the creator, they have access
    if (course.creatorId === session.user.id) {
      const response = { isEnrolled: true, isCreator: true };
      const cacheKey = `enrollment:${courseId}:${session.user.id}${
        lectureId ? `:${lectureId}` : ""
      }`;
      await redis.set(cacheKey, response, { ex: 3600 }); // 1 hour cache
      return NextResponse.json(response);
    }

    // For preview lectures, allow access regardless of enrollment status
    if (isPreviewLecture) {
      const response = {
        isEnrolled: false,
        hasAccess: true,
        isPreviewLecture: true,
      };
      const cacheKey = `enrollment:${courseId}:${session.user.id}${
        lectureId ? `:${lectureId}` : ""
      }`;
      await redis.set(cacheKey, response, { ex: 3600 }); // 1 hour cache
      return NextResponse.json(response);
    }

    // For free courses, allow access regardless of enrollment status
    if (course.price === 0 || course.price === null) {
      const response = {
        isEnrolled: false,
        hasAccess: true,
        isFree: true,
      };
      const cacheKey = `enrollment:${courseId}:${session.user.id}${
        lectureId ? `:${lectureId}` : ""
      }`;
      await redis.set(cacheKey, response, { ex: 3600 }); // 1 hour cache
      return NextResponse.json(response);
    }

    // Check if user is enrolled and enrollment hasn't expired
    const now = new Date();
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: courseId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    // If the enrollment has expired, we should return additional information
    let hasExpired = false;
    if (!enrollment) {
      // Check if there is an expired enrollment
      const expiredEnrollment = await prisma.enrollment.findFirst({
        where: {
          userId: session.user.id,
          contentId: courseId,
          expiresAt: { lte: now },
        },
      });

      if (expiredEnrollment) {
        hasExpired = true;
      }
    }

    // Include valid invite information if present
    const response = {
      isEnrolled: !!enrollment || hasValidInvite, // Consider valid invite as being enrolled
      hasExpired,
      expiresAt: enrollment?.expiresAt || null,
      hasValidInvite,
      success: true, // Add success flag for better client-side handling
      timestamp: Date.now(), // Add timestamp for debugging
    };

    // Use a short cache duration when coming from payment verification or cache busting requests
    const cacheKey = `enrollment:${courseId}:${session.user.id}${
      lectureId ? `:${lectureId}` : ""
    }`;
    const cacheDuration = timestamp || skipCache ? 10 : 3600; // 10 seconds cache if from payment, otherwise 1 hour

    // Store in cache
    await redis.set(cacheKey, response, { ex: cacheDuration });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[ENROLLMENT_STATUS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
