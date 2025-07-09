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

export default function NotFound() {
  return (
    <div className="container max-w-4xl mx-auto py-12">
      <Card>
        <CardHeader>
          <CardTitle>Invalid Invite Link</CardTitle>
          <CardDescription>
            We couldn't find the invite link you're looking for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The invite link may have been deleted by the course creator or never
            existed.
          </p>
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
