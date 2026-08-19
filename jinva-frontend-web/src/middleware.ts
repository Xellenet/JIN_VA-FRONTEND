import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyAuthSessionCookie } from "@/lib/session-cookie"
import { mapBackendRole } from "@/lib/auth"

/**
 * S2: auth + role enforcement for /dashboard/*.
 *
 * S1 moved access/refresh tokens to in-memory-only storage on the client, so
 * this middleware — running at the edge, outside any browser JS context —
 * cannot read a real bearer token to decide anything. Instead, it verifies
 * `jinva_session`: an httpOnly cookie the backend sets alongside the refresh
 * token on login/refresh/change-password (see
 * `JIN_VA-BACKEND/src/auth/utils/session-cookie.util.ts`), carrying
 * `{ sub, role, exp }` HMAC-signed with `SESSION_COOKIE_SECRET`. Because it's
 * httpOnly, page JS can never read or forge it, and because it's signed, this
 * middleware can trust its `role` claim without ever touching the actual JWT.
 *
 * `SESSION_COOKIE_SECRET` must be set to the SAME value here and on the
 * backend (see the frontend's `.env`) — this is the real security boundary
 * requirements.md's open question #1 asked for. Real authorization for the
 * underlying data is still enforced server-side via the bearer JWT + role
 * guards on every API call, regardless of what this middleware decides.
 */

const ROLE_HOME: Record<string, string> = {
  admin: "/dashboard/admin",
  artisan: "/dashboard/artisan",
  user: "/dashboard/user",
}

const SESSION_COOKIE_NAME = "jinva_session" // must match VARIABLES.AUTH_SESSION_COOKIE_NAME on the backend

function roleForPath(pathname: string): string | null {
  if (pathname.startsWith("/dashboard/admin")) return "admin"
  if (pathname.startsWith("/dashboard/artisan")) return "artisan"
  if (pathname.startsWith("/dashboard/user")) return "user"
  return null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value

  const isDashboard = pathname.startsWith("/dashboard")
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email")

  if (!isDashboard && !isAuthPage) {
    return NextResponse.next()
  }

  const secret = process.env.SESSION_COOKIE_SECRET
  const session = cookieValue && secret ? await verifyAuthSessionCookie(cookieValue, secret) : null
  const role = session ? mapBackendRole(session.role) : null

  if (isDashboard && !role) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  if (isDashboard && role) {
    const requiredRole = roleForPath(pathname)
    if (requiredRole && role !== requiredRole) {
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role]
      url.search = ""
      return NextResponse.redirect(url)
    }
  }

  if (isAuthPage && role) {
    const url = request.nextUrl.clone()
    url.pathname = ROLE_HOME[role] ?? "/dashboard/user"
    url.searchParams.delete("redirect")
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/forgot-password", "/reset-password/:path*", "/verify-email"],
}
