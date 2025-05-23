import React from 'react'
import dynamic from "next/dynamic"

// Convert loading UI to use React.createElement
const loadingSecurePlayer = () =>
  React.createElement(
    "div",
    { className: "aspect-video bg-muted flex items-center justify-center rounded-lg" },
    React.createElement(
      "div",
      { className: "flex flex-col items-center gap-2" },
      React.createElement("div", {
        className: "h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent",
      }),
      React.createElement("p", { className: "text-sm text-muted-foreground" }, "Loading secure player...")
    )
  )

export const DynamicSecureVideoPlayer = dynamic(
  () => import("@/components/secure-video-player").then((mod) => ({ default: mod.SecureVideoPlayer })),
  {
    loading: loadingSecurePlayer,
    ssr: false,
  }
)

const loadingPreviewDialog = () =>
  React.createElement("div", {
    className: "h-10 w-10 animate-pulse bg-muted rounded-md",
  })

export const DynamicVideoPreviewDialog = dynamic(
  () => import("@/components/video-preview-dialog").then((mod) => ({ default: mod.default })),
  {
    loading: loadingPreviewDialog,
    ssr: true,
  }
)

export const DynamicCourseEditor = dynamic(
  () => import("@/app/dashboard/creator/content/[courseId]/CourseEditor").then((mod) => ({ default: mod.default })),
  {
    loading: () =>
      React.createElement("div", {
        className: "h-screen w-full animate-pulse bg-muted/30",
      }),
    ssr: false,
  }
)
