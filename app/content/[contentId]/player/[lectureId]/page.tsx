import { Suspense } from "react"
import VideoPlayerPage from "./VideoPlayerPage"
import { Skeleton } from "@/components/ui/skeleton"

export default async function Page({ params }: { params: { contentId: string; lectureId: string } }) {
  const { contentId, lectureId } = await params
  return (
    <Suspense
      fallback={
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
      }
    >
      <VideoPlayerPage contentId={contentId} lectureId={lectureId} />
    </Suspense>
  )
}
