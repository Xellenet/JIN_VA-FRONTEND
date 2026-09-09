import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyAuthSessionCookie } from "@/lib/session-cookie"
import { mapBackendRole, SESSION_ENDED_PARAM } from "@/lib/auth"

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

// Dev-only fallback, kept byte-for-byte identical to the backend's
// getSessionSecret() (JIN_VA-BACKEND/src/auth/utils/session-cookie.util.ts).
// Without this, an unset SESSION_COOKIE_SECRET here (even if the backend is
// happily using its own matching fallback) makes `secret` undefined below,
// which makes every single session — Google OAuth or plain email/password,
// brand-new account or existing — silently fail verification and bounce
// straight back to /login, regardless of how valid the cookie actually is.
// Production must still set the real shared secret explicitly on both sides.
const DEV_SESSION_SECRET_FALLBACK = "dev-only-insecure-session-secret-change-me"

function getSessionSecret(): string | undefined {
  const secret = process.env.SESSION_COOKIE_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === "production") return undefined
  return DEV_SESSION_SECRET_FALLBACK
}

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

  const secret = getSessionSecret()
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

  // A verifiable session cookie normally means "you're already signed in", and
  // /login is then pointless, so send them home.
  //
  // Two things narrow that rule, and both exist because a *verifiable* cookie
  // is not the same as a live session: `DELETE /users/me` revokes the tokens
  // but emits no Set-Cookie, and a soft-deleted principal can no longer reach
  // `POST /auth/logout` to clear it, so the cookie keeps verifying here for its
  // full 7-day lifetime with nothing alive behind it (qa-report.md B4 /
  // security-report.md L2 — backend-owned; this middleware has to cope until
  // it lands).
  //
  // 1. `?session-ended=1` — set by lib/api.ts when the API refuses that
  //    session. Without the exception this redirect and that one chase each
  //    other and the user can never reach the login form, i.e. can never
  //    restore the account they just deleted. The marker is not a credential
  //    and the /dashboard/* checks above are untouched by it.
  //
  // 2. The bounce applies to /login ONLY. It used to cover every auth page,
  //    which meant a dead-but-signed cookie also swallowed /signup,
  //    /forgot-password, /reset-password and /verify-email — so the
  //    "create a new account" escape hatch the closed-recovery-window banner
  //    offers led straight back to /login, and password reset was unreachable
  //    too, for up to 7 days (qa-report.md FE-2). "You're already signed in"
  //    is only ever a complete answer on /login: /signup is a legitimate thing
  //    for a signed-in person to open, and /reset-password + /verify-email are
  //    reached by clicking a link in an email, where silently redirecting to a
  //    dashboard discards the token in the URL.
  if (
    pathname === "/login" &&
    role &&
    request.nextUrl.searchParams.get(SESSION_ENDED_PARAM) !== "1"
  ) {
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
