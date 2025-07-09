import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import { unstable_cache } from "next/cache";

// Cache duration in seconds
const CACHE_DURATION = 60 * 30; // 30 minutes
const STALE_WHILE_REVALIDATE = 60 * 60; // 1 hour

interface RatingData {
  averageRating: number;
  totalReviews: number;
}

export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const { courseId } = await params;

    // Set cache control headers for stale-while-revalidate strategy
    const headers = new Headers();
    headers.set(
      "Cache-Control",
      `s-maxage=${CACHE_DURATION}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`
    );

    // Try to get from cache first
    const cacheKey = `course:${courseId}`;
    const cachedCourse = await redis.get(cacheKey);

    if (cachedCourse) {
      console.log("Using cached course data");
      return NextResponse.json(
        {
          course:
            typeof cachedCourse === "string"
              ? JSON.parse(cachedCourse)
              : cachedCourse,
        },
        { headers }
      );
    }

    // Check if there's an inviteToken in the query string
    const { searchParams } = new URL(request.url);
    const inviteToken = searchParams.get("inviteToken");

    let hasValidInvite = false;

    // If we have an invite token, check if it's valid
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
          // Increment usage count
          await prisma.inviteLink.update({
            where: { token: inviteToken },
            data: { usageCount: { increment: 1 } },
          });
        }
      }
    }

    // Get course from database with all related data
    const course = await prisma.content.findUnique({
      where: {
        id: courseId,
        // Access control conditions:
        // 1. Course is published AND public, OR
        // 2. User is the creator, OR
        // 3. User is an admin, OR
        // 4. User has a valid invite link for a hidden course
        OR: [
          {
            AND: [{ isPublished: true }, { visibility: "PUBLIC" }],
          },
          { creatorId: session?.user?.id },
          ...(session?.user?.role === "ADMIN" ? [{ id: courseId }] : []),
          ...(hasValidInvite ? [{ id: courseId }] : []),
        ],
      },
      include: {
        creator: true,
        sections: {
          orderBy: {
            order: "asc",
          },
          include: {
            lectures: {
              orderBy: {
                order: "asc",
              },
              include: {
                documents: true,
              },
            },
            documents: true,
          },
        },
        documents: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Always get fresh rating data directly from the database
    // This ensures we have the latest stats even if the course itself is cached
    const ratingData = await prisma.$queryRaw<RatingData[]>`
      SELECT 
        AVG(rating)::float as "averageRating",
        COUNT(*) as "totalReviews"
      FROM "Review"
      WHERE "contentId" = ${courseId}
    `;

    // Add rating data to course object
    const courseWithRating = {
      ...course,
      rating: parseFloat(ratingData[0]?.averageRating?.toFixed(1) || "0"),
      reviewCount: parseInt(ratingData[0]?.totalReviews?.toString() || "0"),
    };

    // Cache the course data
    await redis.set(cacheKey, JSON.stringify(courseWithRating), {
      ex: CACHE_DURATION + STALE_WHILE_REVALIDATE, // Total cache lifetime
    });

    return NextResponse.json({ course: courseWithRating }, { headers });
  } catch (error) {
    console.error("Error fetching course:", error);
    return NextResponse.json(
      { error: "Failed to fetch course" },
      { status: 500 }
    );
  }
}
