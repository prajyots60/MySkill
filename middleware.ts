import { type NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

// List of routes that should be restricted based on user role
const creatorOnlyRoutes = [
  '/dashboard/creator',
  '/dashboard/creator/content',
  '/dashboard/creator/students',
  '/dashboard/creator/earnings',
  '/dashboard/creator/calendar',
  '/dashboard/creator/analytics',
  '/dashboard/creator/add-student',
  '/dashboard/creator/service-connections',
]

const studentOnlyRoutes = [
  '/dashboard/student',
  '/dashboard/student/my-courses',
  '/dashboard/student/saved',
  '/dashboard/student/calendar',
  '/dashboard/student/exams',
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  // Securely retrieve the token with secure: true option which is important for cross-domain in production
  const token = await getToken({ 
    req: request as any,
    secureCookie: process.env.NODE_ENV === 'production'
  })

  // Enhanced logging for debugging auth flow
  console.log(`[Middleware] Path: ${pathname}, Has Token: ${!!token}, Role: ${token?.role || 'none'}`)

  // Redirect logged-in users from authentication pages to appropriate dashboard based on role
  if ((pathname === "/auth/signin" || pathname === "/auth/signup") && token) {
    const role = token.role as string
    const destination = role === "CREATOR" ? "/dashboard/creator" : "/dashboard/student"
    
    // Create absolute URL for consistent behavior across environments
    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin
    const redirectUrl = new URL(destination, baseUrl)
    
    console.log(`[Middleware] Redirecting to: ${redirectUrl.toString()}`)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect logged-in users from home page to appropriate dashboard based on role
  if (pathname === "/" && token) {
    const role = token.role as string
    if (role === "CREATOR") {
      return NextResponse.redirect(new URL("/dashboard/creator", request.url))
    } else {
      return NextResponse.redirect(new URL("/dashboard/student", request.url))
    }
  }

  // Protect routes that require authentication
  if (
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/content") ||
    pathname?.startsWith("/api/creator") ||
    pathname?.startsWith("/api/student")
  ) {
    if (!token) {
      // Create absolute URL for signin redirect
      const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin
      const signinUrl = new URL("/auth/signin", baseUrl)
      
      // Encode the callback URL
      signinUrl.searchParams.set("callbackUrl", request.url)
      console.log(`[Middleware] Redirecting unauthenticated user to: ${signinUrl.toString()}`)
      return NextResponse.redirect(signinUrl)
    }
  }

  // Enforce role-based access to routes
  if (token) {
    const userRole = token.role as string
    
    // Check for route access based on role
    if (
      creatorOnlyRoutes.some(route => pathname?.startsWith(route)) &&
      userRole !== 'CREATOR' &&
      userRole !== 'ADMIN'
    ) {
      // Redirect students attempting to access creator routes to student dashboard
      return NextResponse.redirect(new URL('/dashboard/student', request.url))
    }

    if (
      studentOnlyRoutes.some(route => pathname?.startsWith(route)) &&
      userRole !== 'STUDENT' &&
      userRole !== 'ADMIN'
    ) {
      // Redirect creators attempting to access student routes to creator dashboard
      return NextResponse.redirect(new URL('/dashboard/creator', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/auth/signin", "/auth/signup", "/dashboard/:path*", "/content/:path*", "/api/creator/:path*", "/api/student/:path*"],
}
