"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function InviteErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container max-w-4xl mx-auto py-12">
      <Card>
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            We couldn't process this invite link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The invite link you're trying to access may be invalid or there was
            a problem with our server.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/explore">Browse Public Courses</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
