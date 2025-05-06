import dynamic from "next/dynamic"

// Dynamic imports with optimized loading
export const DynamicSecureVideoPlayer = dynamic(
  () => import("@/components/secure-video-player").then((mod) => ({ default: mod.SecureVideoPlayer })),
  {
    loading: () => (
      <div className="aspect-video bg-muted flex items-center justify-center rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading secure player...</p>
        </div>
      </div>
    ),
    ssr: false, // Disable SSR for video player to reduce server load
  },
)

export const DynamicVideoPreviewDialog = dynamic(() => import("@/components/video-preview-dialog"), {
  loading: () => <div className="h-10 w-10 animate-pulse bg-muted rounded-md"></div>,
  ssr: true, // Enable SSR for SEO benefits
})

export const DynamicCourseEditor = dynamic(
  () => import("@/app/dashboard/creator/content/[courseId]/CourseEditor").then((mod) => ({ default: mod.default })),
  {
    loading: () => <div className="h-screen w-full animate-pulse bg-muted/30"></div>,
    ssr: false, // Disable SSR for complex editor to reduce server load
  },
)

// Add more dynamic imports as needed
