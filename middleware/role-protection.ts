import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

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

const adminOnlyRoutes = [
  '/dashboard/admin',
]

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  // Skip middleware for api routes and public assets
  if (
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/fonts') ||
    request.nextUrl.pathname.startsWith('/images') ||
    request.nextUrl.pathname.startsWith('/styles') ||
    request.nextUrl.pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Get the user's token from the session
  const token = await getToken({ req: request })
  const userRole = token?.role || 'STUDENT'

  // Check for route access based on role
  if (
    creatorOnlyRoutes.some(route => request.nextUrl.pathname.startsWith(route)) &&
    userRole !== 'CREATOR' &&
    userRole !== 'ADMIN'
  ) {
    // Redirect students attempting to access creator routes to student dashboard
    return NextResponse.redirect(new URL('/dashboard/student', request.url))
  }

  if (
    studentOnlyRoutes.some(route => request.nextUrl.pathname.startsWith(route)) &&
    userRole !== 'STUDENT' &&
    userRole !== 'ADMIN'
  ) {
    // Redirect creators attempting to access student routes to creator dashboard
    return NextResponse.redirect(new URL('/dashboard/creator', request.url))
  }

  if (
    adminOnlyRoutes.some(route => request.nextUrl.pathname.startsWith(route)) &&
    userRole !== 'ADMIN'
  ) {
    // Redirect non-admins attempting to access admin routes to their respective dashboard
    const redirectUrl = userRole === 'CREATOR' ? '/dashboard/creator' : '/dashboard/student'
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }

  // Allow the request to proceed if no restrictions apply
  return NextResponse.next()
}

export const config = {
  // Apply this middleware to all routes except those we explicitly skip
  matcher: [
    '/((?!api|_next|fonts|images|styles|favicon).*)',
  ],
}
