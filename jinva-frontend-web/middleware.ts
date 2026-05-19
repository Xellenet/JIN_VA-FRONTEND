import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { ACCESS_TOKEN_COOKIE, DEFAULT_AUTH_REDIRECT } from "./src/lib/auth"

const authRoutes = new Set(["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"])

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hasAccessToken = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value)
  const isAuthRoute = authRoutes.has(pathname)

  if (hasAccessToken && (isAuthRoute || pathname === "/")) {
    return NextResponse.redirect(new URL(DEFAULT_AUTH_REDIRECT, request.url))
  }

  if (!hasAccessToken && !isAuthRoute) {
    const loginUrl = new URL("/login", request.url)

    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", `${pathname}${search}`)
    }

    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
