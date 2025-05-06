import { Suspense } from "react"
import CourseEditor from "./CourseEditor"
import { Skeleton } from "@/components/ui/skeleton"

interface CourseEditorProps {
  params: {
    courseId: string
  }
}

export default async function Page({ params }: CourseEditorProps) {
  const { courseId } = await params
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-10 px-4 md:px-6">
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-40" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-[400px] w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-[200px] w-full" />
              <Skeleton className="h-[200px] w-full" />
            </div>
          </div>
        </div>
      }
    >
      <CourseEditor courseId={courseId} />
    </Suspense>
  )
}
