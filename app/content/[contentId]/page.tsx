import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import CoursePage from "./CoursePage";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Make this page dynamic to avoid static rendering
export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: { contentId: string };
  searchParams: { inviteToken?: string };
}) {
  const { contentId } = params;
  const inviteToken = searchParams.inviteToken;
  const session = await getServerSession(authOptions);

  // Check course visibility
  const course = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      visibility: true,
      creatorId: true,
      isPublished: true,
    },
  });

  // If course doesn't exist, let the client component handle it
  if (!course) {
    // The client will show a "Course not found" message
    return (
      <Suspense fallback={<CoursePageSkeleton />}>
        <CoursePage contentId={contentId} />
      </Suspense>
    );
  }

  // If course is PUBLIC or the user is the creator/admin, allow access
  if (
    course.visibility === "PUBLIC" ||
    session?.user?.id === course.creatorId ||
    session?.user?.role === "ADMIN"
  ) {
    return (
      <Suspense fallback={<CoursePageSkeleton />}>
        <CoursePage contentId={contentId} />
      </Suspense>
    );
  }

  // Check for enrollment if the user is logged in
  if (session?.user) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: session.user.id,
        contentId: contentId,
      },
    });

    if (enrollment) {
      return (
        <Suspense fallback={<CoursePageSkeleton />}>
          <CoursePage contentId={contentId} />
        </Suspense>
      );
    }
  }

  // If there's an invite token, check if it's valid
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

    if (invite && invite.contentId === contentId) {
      // Check if invite is not expired and under usage limit
      const isExpired =
        invite.expiresAt && new Date() > new Date(invite.expiresAt);
      const isOverUsed =
        invite.maxUsages && invite.usageCount >= invite.maxUsages;

      if (!isExpired && !isOverUsed) {
        // Token is valid, allow access
        return (
          <Suspense fallback={<CoursePageSkeleton />}>
            <CoursePage contentId={contentId} />
          </Suspense>
        );
      }
    }
  }

  // If all checks fail, redirect to access denied page
  redirect("/access-denied");

  return (
    <Suspense fallback={<CoursePageSkeleton />}>
      <CoursePage contentId={contentId} />
    </Suspense>
  );
}

// Loading skeleton to show while checking access and loading course
function CoursePageSkeleton() {
  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-32 w-full" />

          <div className="space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>

        <div>
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
