import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function LoadingInvitePage() {
  return (
    <div className="container max-w-6xl mx-auto py-12">
      <Card className="overflow-hidden">
        <div className="bg-muted h-48 relative">
          <Skeleton className="h-full w-full" />
        </div>
        <CardHeader>
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />

            <div className="bg-muted p-4 rounded-lg">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </CardFooter>
      </Card>
    </div>
  );
}
