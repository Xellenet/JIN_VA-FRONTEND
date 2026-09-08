export const DEFAULT_AUTH_REDIRECT = "/dashboard/user"

/**
 * Query marker the API layer puts on its "this session is over" redirect to
 * /login, and the one thing that stops middleware sending the request back to
 * the dashboard.
 *
 * It is not a credential and grants nothing: all it does is let someone who
 * still holds a signed `jinva_session` cookie see the login form. Every
 * /dashboard/* decision in middleware, and every real authorization check on
 * the API, is completely unaffected by it.
 */
export const SESSION_ENDED_PARAM = "session-ended"

/**
 * Query markers the settings pages put on their post-deletion redirect to
 * /login, so the confirmation the user just earned is still on screen when they
 * land there.
 *
 * A toast cannot do this job: the redirect is a hard navigation
 * (`location.href`), which tears the toast container down ~200ms after the
 * click, so the confirmation was never actually readable (qa-report.md FE-1).
 * The login form renders these as a banner instead — it persists, so a user who
 * never receives the deletion email still learns the account is recoverable and
 * how long they have.
 *
 * `RESTORABLE_UNTIL_PARAM` carries `purgeAt` from the `DELETE /users/me`
 * response verbatim (ISO 8601). It is the server-computed date the purge job
 * actually enforces and the same date the email states — never computed as
 * "+30 days" on the client (api-contract.md). Neither marker is a credential
 * and neither grants anything: the banner is plain copy about the caller's own
 * just-completed action.
 */
export const ACCOUNT_DELETED_PARAM = "account-deleted"
export const RESTORABLE_UNTIL_PARAM = "restorable-until"

/**
 * Where to land someone who has just deleted their own account: the login
 * form, marked so that (a) middleware lets the request through even though the
 * dead `jinva_session` cookie still verifies, and (b) the form shows the
 * deletion confirmation and the real restore deadline.
 *
 * Lives here rather than in each settings page so the artisan and customer
 * flows cannot drift apart on the markers.
 *
 * @param purgeAt `purgeAt` from the `DELETE /users/me` response, if present.
 */
export function loginUrlAfterAccountDeletion(purgeAt?: string): string {
  const params = new URLSearchParams({
    [SESSION_ENDED_PARAM]: "1",
    [ACCOUNT_DELETED_PARAM]: "1",
  })
  if (purgeAt) params.set(RESTORABLE_UNTIL_PARAM, purgeAt)
  return `/login?${params.toString()}`
}

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
