import { Suspense } from "react";
import VideoPlayerPage from "./VideoPlayerPage";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function Page({
  params,
  searchParams,
}: {
  params: { contentId: string; lectureId: string };
  searchParams: { inviteToken?: string };
}) {
  const { contentId, lectureId } = params;
  const inviteToken = searchParams.inviteToken;
  const session = await getServerSession(authOptions);

  // Check lecture preview status first (preview lectures are always accessible)
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: { isPreview: true },
  });

  if (lecture?.isPreview) {
    return (
      <Suspense fallback={<PlayerSkeleton />}>
        <VideoPlayerPage contentId={contentId} lectureId={lectureId} />
      </Suspense>
    );
  }

  // Check course visibility
  const course = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      visibility: true,
      creatorId: true,
      isPublished: true,
    },
  });

  // If course doesn't exist, redirect to 404
  if (!course) {
    return redirect("/404");
  }

  // If course is PUBLIC or the user is the creator/admin, allow access
  if (
    course.visibility === "PUBLIC" ||
    session?.user?.id === course.creatorId ||
    session?.user?.role === "ADMIN"
  ) {
    return (
      <Suspense fallback={<PlayerSkeleton />}>
        <VideoPlayerPage contentId={contentId} lectureId={lectureId} />
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
      console.log(
        `User ${session.user.id} is enrolled in course ${contentId}, granting access without invite token`
      );
      return (
        <Suspense fallback={<PlayerSkeleton />}>
          <VideoPlayerPage contentId={contentId} lectureId={lectureId} />
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
        console.log(
          `Valid invite token used for course ${contentId}, granting access`
        );
        return (
          <Suspense fallback={<PlayerSkeleton />}>
            <VideoPlayerPage contentId={contentId} lectureId={lectureId} />
          </Suspense>
        );
      } else {
        console.log(
          `Invite token expired or over usage limit: expired=${isExpired}, overUsed=${isOverUsed}`
        );
      }
    } else {
      console.log(`Invalid invite token or token for different course`);
    }
  }

  // If all checks fail, redirect to access denied page
  redirect("/access-denied");
  return (
    <Suspense fallback={<PlayerSkeleton />}>
      <VideoPlayerPage contentId={contentId} lectureId={lectureId} />
    </Suspense>
  );
}

// Loading skeleton for player page
function PlayerSkeleton() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <Skeleton className="h-[60vh] w-full mb-6" />
      <Skeleton className="h-8 w-1/3 mb-4" />
      <Skeleton className="h-4 w-full mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div>
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
