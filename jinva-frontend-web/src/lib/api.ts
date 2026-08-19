import { persistAuthTokens, clearAuthTokens, getAccessToken } from "@/lib/auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

let refreshPromise: Promise<boolean> | null = null

async function doTokenRefresh(): Promise<boolean> {
  try {
    // The refresh token itself is never available to this code — it lives
    // only in the httpOnly cookie the backend set at login (S1).
    // `credentials: "include"` is what makes the browser attach that cookie
    // here automatically; there's nothing for this module to read or send.
    // A missing/invalid/expired cookie surfaces as a non-ok response below.
    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
    })
    if (!res.ok) return false
    const data = await res.json()
    if (!data.access_token) return false
    persistAuthTokens(data.access_token)
    return true
  } catch {
    return false
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doTokenRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

type ApiFetchOptions = RequestInit & { skipAuth?: boolean }

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth, ...init } = options
  const token = skipAuth ? null : getAccessToken()

  const isFormData = init.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const request = (): Promise<Response> =>
    fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" })

  let res = await request()

  if (res.status === 401 && !skipAuth) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      const newToken = getAccessToken()
      if (newToken) headers["Authorization"] = `Bearer ${newToken}`
      res = await request()
    }

    if (res.status === 401) {
      clearAuthTokens()
      if (typeof window !== "undefined") {
        // /auth/callback (G7) owns its own post-refresh-failure redirect so it
        // can land on "/login?error=oauth_failed" with the "something went
        // wrong" message (see google-callback.tsx's PendingState). Racing it
        // with this global hard-navigation would otherwise strip that query
        // param off the URL before PendingState's own router.replace() runs,
        // silently losing the message even though the user still lands on
        // /login safely either way. Every other route still gets the
        // hard-redirect safety net.
        if (window.location.pathname !== "/auth/callback") {
          window.location.href = "/login"
        }
      }
      throw new Error("Session expired. Please log in again.")
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }))
    throw new Error(err.message ?? `Request failed with status ${res.status}`)
  }

  const body = await res.json()

  // Unwrap the NestJS ResponseInterceptor envelope: { statusCode, message, data }
  return (body?.data !== undefined ? body.data : body) as T
}
