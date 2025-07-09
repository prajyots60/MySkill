import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import Link from "next/link";

interface InvitePageProps {
  params: {
    token: string;
  };
}

async function getInviteLink(token: string) {
  try {
    const inviteLink = await prisma.inviteLink.findUnique({
      where: { token },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            price: true,
            type: true,
            creatorId: true,
            creator: {
              select: {
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return inviteLink;
  } catch (error) {
    console.error("Error fetching invite link:", error);
    return null;
  }
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const session = await getServerSession(authOptions);

  // Get invite link with course data
  const inviteLink = await getInviteLink(token);

  // If no invite link found, show 404
  if (!inviteLink) {
    notFound();
  }

  // Check if link is expired
  const isExpired =
    inviteLink.expiresAt && new Date() > new Date(inviteLink.expiresAt);

  // Check if link has reached usage limit
  const isOverUsed =
    inviteLink.maxUsages && inviteLink.usageCount >= inviteLink.maxUsages;

  // If link is expired or overused, show appropriate message
  if (isExpired || isOverUsed) {
    return (
      <div className="container max-w-4xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>
              Invite Link {isExpired ? "Expired" : "No Longer Valid"}
            </CardTitle>
            <CardDescription>
              {isExpired
                ? "This invite link has expired."
                : "This invite link has reached its maximum usage limit."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Please contact the course creator for a new invite link.</p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/explore">Browse Public Courses</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Increment usage count if link is valid
  await prisma.inviteLink.update({
    where: { id: inviteLink.id },
    data: { usageCount: { increment: 1 } },
  });

  // If user is logged in and the course exists, redirect to the course page with the invite token
  if (session?.user) {
    redirect(`/content/${inviteLink.content.id}?inviteToken=${token}`);
  }

  // For non-logged in users, show course preview with signup/login prompt
  return (
    <div className="container max-w-6xl mx-auto py-12">
      <Card className="overflow-hidden">
        <div className="bg-muted h-48 relative">
          {inviteLink.content.thumbnail && (
            <img
              src={inviteLink.content.thumbnail}
              alt={inviteLink.content.title}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <CardHeader>
          <CardTitle className="text-2xl">{inviteLink.content.title}</CardTitle>
          <CardDescription>
            By {inviteLink.content.creator.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {inviteLink.content.description}
            </p>

            <div className="bg-muted p-4 rounded-lg">
              <p className="font-medium">
                You've been invited to view this private course
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in or create an account to access this course.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:w-auto" asChild>
            <Link
              href={`/auth/signin?callbackUrl=/content/${inviteLink.content.id}?inviteToken=${token}`}
            >
              Sign In
            </Link>
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" asChild>
            <Link
              href={`/auth/signup?callbackUrl=/content/${inviteLink.content.id}?inviteToken=${token}`}
            >
              Create Account
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
