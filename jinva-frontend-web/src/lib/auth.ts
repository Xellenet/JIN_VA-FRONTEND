export const ACCESS_TOKEN_COOKIE = "jinva_access_token"
export const REFRESH_TOKEN_COOKIE = "jinva_refresh_token"
export const DEFAULT_AUTH_REDIRECT = "/dashboard/user"

const baseCookieAttributes = ["Path=/", "SameSite=Lax"]

if (process.env.NODE_ENV === "production") {
  baseCookieAttributes.push("Secure")
}

export function persistAuthTokens(accessToken: string, refreshToken: string, rememberMe = false) {
  const expires = rememberMe ? `; Max-Age=${60 * 60 * 24 * 30}` : ""

  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(accessToken)}; ${baseCookieAttributes.join("; ")}${expires}`
  document.cookie = `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(refreshToken)}; ${baseCookieAttributes.join("; ")}${expires}`
}

export function clearAuthTokens() {
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  document.cookie = `${REFRESH_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function getAccessToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${ACCESS_TOKEN_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function getRefreshToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${REFRESH_TOKEN_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Maps backend role enum to frontend role string */
export function mapBackendRole(role: string): "admin" | "artisan" | "user" {
  if (role === "ADMIN") return "admin"
  if (role === "ARTISAN") return "artisan"
  return "user"
}

/** Returns the dashboard base path for a given role */
export function dashboardPathForRole(role: string): string {
  if (role === "ADMIN") return "/dashboard/admin"
  if (role === "ARTISAN") return "/dashboard/artisan"
  return "/dashboard/user"
}
