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
