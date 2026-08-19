export const DEFAULT_AUTH_REDIRECT = "/dashboard/user"

// ---------------------------------------------------------------------------
// S1: in-memory access-token storage only.
//
// The access token is held in a module-level variable and is NEVER written
// to document.cookie, localStorage, or sessionStorage — closing the XSS
// exposure where any script running on the page could previously read it
// straight out of document.cookie.
//
// The refresh token is no longer handled by the frontend at all: the
// backend sets it exclusively via an httpOnly `Set-Cookie` on login/refresh/
// change-password (see JIN_VA-BACKEND/src/auth/utils/refresh-cookie.util.ts)
// and never returns it in the JSON body. It is invisible to JS by
// construction — the browser attaches it automatically (via
// `credentials: "include"`, see lib/api.ts) on every request to the API
// origin, including the silent-refresh call, with nothing for this module
// to store or read.
//
// Trade-off: since the access token lives in memory only, a full page
// reload / new tab starts with no access token until the first API call
// triggers a silent refresh (see api.ts's 401-retry path / auth-context.tsx).
// ---------------------------------------------------------------------------
let inMemoryAccessToken: string | null = null

export function persistAuthTokens(accessToken: string) {
  inMemoryAccessToken = accessToken
}

/** Clears the in-memory access token (logout, or no valid session found). */
export function clearAuthTokens() {
  inMemoryAccessToken = null
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken
}

/** Maps backend role enum to frontend role string */
export function mapBackendRole(role: string): "admin" | "artisan" | "user" {
  if (role === "ADMIN") return "admin"
  if (role === "ARTISAN") return "artisan"
  return "user"
}

/**
 * Returns the dashboard base path for a frontend-mapped role
 * ("admin" | "artisan" | "user", i.e. the shape returned by `mapBackendRole`
 * and stored on `User.role` in auth-context.tsx).
 */
export function dashboardPathForFrontendRole(role: "admin" | "artisan" | "user"): string {
  if (role === "admin") return "/dashboard/admin"
  if (role === "artisan") return "/dashboard/artisan"
  return "/dashboard/user"
}

/** Returns the dashboard base path for a given raw backend role string. */
export function dashboardPathForRole(role: string): string {
  return dashboardPathForFrontendRole(mapBackendRole(role))
}
