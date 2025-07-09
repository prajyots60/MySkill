import { PerformanceOptimizedLayout } from "@/components/performance-optimized-layout";
import type React from "react";

export const metadata = {
  title: "Access Denied | EduPlatform",
  description: "You don't have permission to access this content",
};

export default function AccessDeniedLayout({
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
