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

interface ApiEnvelope<T> {
  status?: string
  statusCode?: number
  message?: string
  data?: T
  meta?: Record<string, unknown>
}

/**
 * A failed request, carrying the HTTP status alongside the user-facing message.
 *
 * `apiFetch` used to throw a bare `Error`, which meant a caller could only ever
 * show the message — there was no way to branch on *why* a call failed. Two
 * surfaces in messaging & notifications need that:
 *   - the admin dispute-conversation viewer, where a 403 means "access closed
 *     with this dispute" (api-contract.md §4) rather than a generic failure;
 *   - a deep-link first send to a recipient who doesn't exist (404), which must
 *     drop back to the conversation list instead of stranding the user in a
 *     thread addressed to nobody.
 *
 * `code`/`retryAfterSeconds` mirror the machine-readable fields
 * api-contract.md §3.1 documents on a 429. They are optional because the
 * server's global exception filter currently strips everything except
 * `message` from an HttpException body (qa-report.md B1, backend-owned) — so
 * callers must treat them as a bonus and never depend on them.
 *
 * Extends `Error`, so every existing `err instanceof Error ? err.message`
 * call site keeps working unchanged.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly retryAfterSeconds?: number

  constructor(message: string, status: number, code?: string, retryAfterSeconds?: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

async function apiFetchEnvelope<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<ApiEnvelope<T>> {
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
      throw new ApiError("Session expired. Please log in again.", 401)
    }
  }

  if (!res.ok) {
    const err: {
      message?: string | string[]
      error?: string
      retryAfterSeconds?: number
      meta?: { error?: string }
    } = await res.json().catch(() => ({ message: "Request failed" }))
    // A ValidationPipe rejection returns `message` as an array of strings.
    const message = Array.isArray(err.message) ? err.message.join(" ") : err.message
    throw new ApiError(
      message ?? `Request failed with status ${res.status}`,
      res.status,
      err.error ?? err.meta?.error,
      err.retryAfterSeconds,
    )
  }

  if (res.status === 204) return {} as ApiEnvelope<T>

  return await res.json().catch(() => ({}) as ApiEnvelope<T>)
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const body = await apiFetchEnvelope<T>(path, options)
  // Unwrap the NestJS ResponseInterceptor envelope: { statusCode, message, data }
  return (body?.data !== undefined ? body.data : (body as unknown)) as T
}

/**
 * Same as `apiFetch`, but also surfaces the envelope's `meta` block
 * (e.g. `{ total, page, limit, totalPages }` on paginated list endpoints)
 * instead of discarding it. Use this whenever a page needs real
 * pagination controls rather than just the `data` array.
 */
export async function apiFetchWithMeta<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<{ data: T; meta: Record<string, unknown> | undefined }> {
  const body = await apiFetchEnvelope<T>(path, options)
  return {
    data: (body?.data !== undefined ? body.data : (body as unknown)) as T,
    meta: body?.meta,
  }
}
