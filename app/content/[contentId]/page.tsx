import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import CoursePage from "./CoursePage"

export default async function Page({ params }: { params: { contentId: string } }) {
  const { contentId } = await params

  return (
    <Suspense
      fallback={
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
      }
    >
      <CoursePage contentId={contentId} />
    </Suspense>
  )
}
