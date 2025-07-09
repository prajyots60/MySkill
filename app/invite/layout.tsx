import { PerformanceOptimizedLayout } from "@/components/performance-optimized-layout";
import type React from "react";

export const metadata = {
  title: "Course Invitation | EduPlatform",
  description: "You've been invited to access a private course",
};

export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PerformanceOptimizedLayout>
      <div className="container min-h-screen flex items-center justify-center">
        {children}
      </div>
    </PerformanceOptimizedLayout>
  );
}
