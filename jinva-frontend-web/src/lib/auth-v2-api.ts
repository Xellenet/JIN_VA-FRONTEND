import { ApiError } from "@/lib/api"
import { readResendAvailableAt } from "@/lib/auth-v2-errors"

/**
 * Auth v2 calls (docs/specs/auth-v2/api-contract.md). All are pre-session, so
 * they go straight to `fetch` rather than `apiFetch`: a 401 here is an answer
 * about the request (wrong password, TURNSTILE_REQUIRED), never "your session
 * ended", and must not trigger api.ts's refresh-and-redirect.
 *
 * `credentials: "include"` so the session cookies a successful verify, reset
 * or login sets land in the browser, exactly as on `POST /auth/login`.
 *
 * Every failure is an `ApiError` carrying `meta.error` as `code` and
 * `meta.retryAfterSeconds`; a dropped connection is an `ApiError` with
 * status 0, so callers have one shape to branch on.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

export type CodePurpose = "signup" | "login"

export async function postAuth<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<T> {
  // Never send an empty Turnstile field: with no site key there is no token,
  // and the backend skips the check when its own secret is unset.
  const payload = Object.fromEntries(Object.entries(body).filter(([k, v]) => !(k === "turnstileToken" && !v)))
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ApiError("Network error", 0)
  }
  const data = (await res.json().catch(() => ({}))) as {
    message?: string | string[]
    error?: string
    meta?: { error?: string; retryAfterSeconds?: number }
    data?: unknown
  }
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message.join(" ") : data.message
    throw new ApiError(
      message || `Request failed with status ${res.status}`,
      res.status,
      data.meta?.error ?? data.error,
      data.meta?.retryAfterSeconds,
      data.data,
    )
  }
  return data as T
}

export interface RegisterInput {
  firstname: string
  middlename?: string
  lastname: string
  email: string
  phoneNumber: string
  password: string
  role: "CUSTOMER" | "ARTISAN"
  turnstileToken?: string
}

/** 201 `{ data: { email, resendAvailableAt } }`; the same for a new or an existing email. */
export async function register(input: RegisterInput): Promise<{ resendAvailableAt: string | null }> {
  const body = await postAuth("/auth/register", { ...input })
  return { resendAvailableAt: readResendAvailableAt(body) }
}

export async function requestCode(input: {
  email: string
  purpose: CodePurpose
  turnstileToken?: string
}): Promise<{ resendAvailableAt: string | null }> {
  const body = await postAuth("/auth/code/request", input)
  return { resendAvailableAt: readResendAvailableAt(body) }
}

/** Starts a session: the answer has the login response's shape (see `readSession`). */
export function verifyCode(input: { email: string; code: string; purpose: CodePurpose }): Promise<unknown> {
  return postAuth("/auth/code/verify", input)
}

export async function forgotPassword(input: {
  email: string
  turnstileToken?: string
}): Promise<{ resendAvailableAt: string | null }> {
  const body = await postAuth("/auth/password/forgot", input)
  return { resendAvailableAt: readResendAvailableAt(body) }
}

/** Signs in and signs every other device out. */
export function resetPasswordWithCode(input: { email: string; code: string; newPassword: string }): Promise<unknown> {
  return postAuth("/auth/password/reset", input)
}
