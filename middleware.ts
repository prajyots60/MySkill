import { type NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { parse } from "url"

export async function middleware(request: NextRequest) {
  const { pathname } = parse(request.url)
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

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/auth/signin", "/auth/signup", "/dashboard/:path*", "/content/:path*", "/api/creator/:path*", "/api/student/:path*"],
}
