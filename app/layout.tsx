import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/auth-provider"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ReactQueryProvider } from "@/lib/react-query/provider"
import { PerformanceOptimizedLayout } from "@/components/performance-optimized-layout"
import { NavigationOptimizer } from "@/components/navigation-optimizer"
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
        {/* Preconnect to critical domains */}
        <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.youtube.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="anonymous" />

        {/* Preload critical assets */}
        <link rel="preload" href="/logo.png" as="image" />

        {/* Web App Manifest for PWA */}
        <link rel="manifest" href="/manifest.json" />

        {/* DNS Prefetch for performance */}
        <link rel="dns-prefetch" href="https://www.googleapis.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
      </head>
      <body className={inter.className}>
        <ReactQueryProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <AuthProvider>
              <SidebarProvider>
                <div className="flex min-h-screen w-full overflow-hidden">
                  <AppSidebar />
                  <main className="flex-1 overflow-auto relative">
                    <PerformanceOptimizedLayout>
                      <NavigationOptimizer>
                        {children}
                      </NavigationOptimizer>
                    </PerformanceOptimizedLayout>
                  </main>
                </div>
                <Toaster />
              </SidebarProvider>
            </AuthProvider>
          </ThemeProvider>
        </ReactQueryProvider>

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
            
            // Register and optimize service worker
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                  .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                    
                    // Enable navigation preload if supported
                    if (registration.navigationPreload) {
                      registration.navigationPreload.enable().then(() => {
                        console.log('Navigation Preload enabled');
                      }).catch(err => {
                        console.error('Navigation Preload error:', err);
                      });
                    }
                  })
                  .catch(error => {
                    console.error('Service Worker registration failed:', error);
                  });
              });
            }
          `}
        </Script>
      </body>
    </html>
  )
}
