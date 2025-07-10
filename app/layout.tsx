import type { Metadata } from "next"
import React from "react"
import { Inter } from "next/font/google"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/auth-provider"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileNavigation } from "@/components/mobile-navigation"
import { MobileNavigationProgress } from "@/components/mobile-navigation-progress"
import { SidebarTouchHandler } from "@/components/sidebar-touch-handler"
import { MobileNavHint } from "@/components/mobile-nav-hint"
import { ReactQueryProvider } from "@/lib/react-query/provider"
import { PerformanceOptimizedLayout } from "@/components/performance-optimized-layout"
import { NavigationOptimizer } from "@/components/navigation-optimizer"
import { UploadManagerProvider } from "@/components/upload-manager-provider"
import { UserRoleHandler } from "@/components/user-role-handler"
import { ServiceWorkerProvider } from "@/components/service-worker-provider"
import { NetworkProvider } from "@/components/network-provider"
import Script from "next/script"

const inter = Inter({
  subsets: ["latin"],
  display: "swap", // Optimize font loading
  preload: true, // Preload font
})

export const metadata: Metadata = {
  title: "EduTube - YouTube-Powered Educational Platform",
  description: "Launch, manage, and monetize your video courses without paying for video hosting",
  generator: "v0.dev",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "EduTube - YouTube-Powered Educational Platform",
    description: "Launch, manage, and monetize your video courses without paying for video hosting",
    siteName: "EduTube",
  },
  twitter: {
    card: "summary_large_image",
    title: "EduTube - YouTube-Powered Educational Platform",
    description: "Launch, manage, and monetize your video courses without paying for video hosting",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google-adsense-account" content="ca-pub-3925803581025669" />
        
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3925803581025669"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        
        {/* Preconnect to critical domains */}
        <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.youtube.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="anonymous" />

        {/* Preload critical assets */}
        <link rel="preload" href="/logo.png" as="image" />
        
        {/* Premium animations stylesheet */}
        <link rel="stylesheet" href="/styles/premium-animations.css" />
        
        {/* Light theme fixes stylesheet */}
        <link rel="stylesheet" href="/styles/light-theme-fixes.css" />
        <link rel="stylesheet" href="/styles/light-theme-additional.css" />
        
        {/* Mobile sidebar styles */}
        <link rel="stylesheet" href="/styles/mobile-sidebar.css" />
        <link rel="stylesheet" href="/styles/mobile-content.css" />
        <link rel="stylesheet" href="/styles/navbar-fix.css" />

        {/* Web App Manifest for PWA */}
        <link rel="manifest" href="/manifest.json" />

        {/* DNS Prefetch for performance */}
        <link rel="dns-prefetch" href="https://www.googleapis.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
      </head>
      <body className={inter.className}>
        <ReactQueryProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <AuthProvider>
              <SidebarProvider>
                <UserRoleHandler />
                {/* Service Worker Registration */}
                <ServiceWorkerProvider />
                <NetworkProvider>
                  <SidebarTouchHandler>
                    <div className="flex min-h-screen w-full overflow-hidden">
                      <AppSidebar />
                      <main className="flex-1 overflow-auto relative">
                        <MobileNavigationProgress />
                        <MobileNavigation />
                        <MobileNavHint />
                        <PerformanceOptimizedLayout>
                          <NavigationOptimizer>
                            <UploadManagerProvider>
                              {/* Dynamic import of mobile sidebar toggle to avoid hydration issues */}
                              {typeof window !== 'undefined' && (
                                <React.Suspense fallback={null}>
                                  {/* @ts-ignore - Dynamic import */}
                                  {(() => {
                                    const MobileSidebarToggle = require('@/components/mobile-sidebar-toggle').MobileSidebarToggle;
                                    return <MobileSidebarToggle />;
                                  })()}
                                </React.Suspense>
                              )}
                              {children}
                            </UploadManagerProvider>
                          </NavigationOptimizer>
                        </PerformanceOptimizedLayout>
                      </main>
                    </div>
                    <Toaster />
                  </SidebarTouchHandler>
                </NetworkProvider>
              </SidebarProvider>
            </AuthProvider>
          </ThemeProvider>
        </ReactQueryProvider>

        <SpeedInsights />

        {/* Inline critical JS for performance */}
        <Script id="performance-optimization" strategy="beforeInteractive">
          {`
            // Mark navigation start for performance measurement
            window.perfStart = performance.now();
            
            // Check for saved theme to prevent flash of wrong theme
            try {
              const savedTheme = localStorage.getItem('theme');
              if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              }
            } catch (e) {}
          `}
        </Script>

      </body>
    </html>
  )
}
