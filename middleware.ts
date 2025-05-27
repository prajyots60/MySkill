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
  const token = await getToken({ req: request as any })

  // Redirect logged-in users from authentication pages to appropriate dashboard based on role
  if ((pathname === "/auth/signin" || pathname === "/auth/signup") && token) {
    const role = token.role as string
    if (role === "CREATOR") {
      return NextResponse.redirect(new URL("/dashboard/creator", request.url))
    } else {
      return NextResponse.redirect(new URL("/dashboard/student", request.url))
    }
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
      const url = new URL("/auth/signin", request.url)
      url.searchParams.set("callbackUrl", request.url)
      return NextResponse.redirect(url)
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
