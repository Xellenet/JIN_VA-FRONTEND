import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const ACCESS_TOKEN_COOKIE = "jinva_access_token"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value

  const isDashboard = pathname.startsWith("/dashboard")
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email")

  if (isDashboard && !token) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && token) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard/user"
    url.searchParams.delete("redirect")
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/forgot-password", "/reset-password/:path*", "/verify-email"],
}
