import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LockIcon, ExternalLink } from "lucide-react";

export const metadata = {
  title: "Access Denied | EduPlatform",
  description: "You don't have permission to access this course",
};

export default function AccessDeniedPage() {
  return (
    <div className="container flex items-center justify-center min-h-[80vh] py-12">
      <Card className="max-w-md w-full mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <LockIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Access Denied</CardTitle>
          <CardDescription className="text-center">
            This is a private course that requires an invitation to access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg text-sm">
            <p>This course is not publicly available. You need either:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>A valid invite link from the course creator</li>
              <li>To be enrolled in the course</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/explore">Browse Public Courses</Link>
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/auth/signin">
              Sign In
              <ExternalLink className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
