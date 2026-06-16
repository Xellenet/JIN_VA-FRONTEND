import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, persistAuthTokens, clearAuthTokens } from "@/lib/auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

let refreshPromise: Promise<boolean> | null = null

async function doTokenRefresh(): Promise<boolean> {
  const refreshToken = readCookie(REFRESH_TOKEN_COOKIE)
  if (!refreshToken) return false

  try {
    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return false
    const data = await res.json()
    if (!data.access_token) return false
    persistAuthTokens(data.access_token, data.refresh_token ?? refreshToken)
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
  const token = skipAuth ? null : readCookie(ACCESS_TOKEN_COOKIE)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const request = (): Promise<Response> =>
    fetch(`${API_BASE}${path}`, { ...init, headers })

  let res = await request()

  if (res.status === 401 && !skipAuth) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      const newToken = readCookie(ACCESS_TOKEN_COOKIE)
      if (newToken) headers["Authorization"] = `Bearer ${newToken}`
      res = await request()
    }

    if (res.status === 401) {
      clearAuthTokens()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
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
