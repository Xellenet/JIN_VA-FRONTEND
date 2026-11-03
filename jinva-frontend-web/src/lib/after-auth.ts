/**
 * Where to send someone once they are signed in, when they started from a
 * page that needed an account (e.g. the landing page search, which the
 * middleware turns into `/login?redirect=/dashboard/user/search?…`).
 *
 * Every target is first reduced by `safeInternalRedirect` (lib/auth.ts) to a
 * same-origin path or the fallback; this module adds the role check, so a new
 * artisan is never dropped on a client page (or the reverse), and carries the
 * target across the round trip to Google, which can't take it along.
 *
 * No `@/` imports: `scripts/test-auth-v2.mjs` imports this file directly.
 */

/** The dashboard area each self-signup role may be sent into. */
const ROLE_AREA: Record<string, string> = {
  CUSTOMER: "/dashboard/user",
  ARTISAN: "/dashboard/artisan",
}

/**
 * Whether an already-safe path is inside the given role's dashboard area
 * (`/dashboard/user`, `/dashboard/user/…`, `/dashboard/user?…`).
 */
export function belongsToRole(path: string, role: string | null | undefined): boolean {
  const area = ROLE_AREA[(role ?? "").toUpperCase()]
  if (!area) return false
  if (path === area) return true
  const next = path.charAt(area.length)
  return path.startsWith(area) && (next === "/" || next === "?" || next === "#")
}

const STORAGE_KEY = "jinva:after-auth-redirect"

/**
 * Remembers a target before leaving for Google. Only a rooted path is stored,
 * capped in length; it is checked again (safe + role) when it is read back.
 */
export function rememberAfterAuth(target: string | null | undefined): void {
  try {
    if (target && target.startsWith("/") && !target.startsWith("//") && target.length <= 512) {
      sessionStorage.setItem(STORAGE_KEY, target)
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Storage blocked: the person simply lands on their dashboard.
  }
}

/** Reads and clears the remembered target (one use only). */
export function takeAfterAuth(): string | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    return value
  } catch {
    return null
  }
}
