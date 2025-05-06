import type React from "react"

import { UploadStatus } from "@/components/upload-status"

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
      <UploadStatus />
    </div>
  )
}
