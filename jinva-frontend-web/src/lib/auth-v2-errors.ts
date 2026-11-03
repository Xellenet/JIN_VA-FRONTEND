/**
 * Auth v2: the words for every error the new auth endpoints can give
 * (docs/specs/auth-v2/api-contract.md), in one place so sign-up, login and
 * forgot password say the same thing.
 *
 * No `@/` imports: `scripts/test-auth-v2.mjs` imports this file directly.
 */

export const AUTH_ERROR_CODES = {
  codeInvalid: "CODE_INVALID",
  codeAttemptsExceeded: "CODE_ATTEMPTS_EXCEEDED",
  turnstileFailed: "TURNSTILE_FAILED",
  turnstileRequired: "TURNSTILE_REQUIRED",
} as const

export const AUTH_COPY = {
  /** The contract's exact sentence for a wrong or expired code. */
  codeInvalid: "That code didn't work. Check it or ask for a new one.",
  codeLocked: "That code was tried too many times, so it no longer works. Ask for a new one.",
  turnstileFailed: "The security check didn't go through. Try again.",
  turnstileRequired: "For your security, confirm you're not a robot, then log in again.",
  turnstileUnavailable: "We couldn't load the security check. Check your connection and try again.",
  rateLimited: "Too many tries for now. Wait a little, then try again.",
  network: "We couldn't reach JinVa. Check your connection and try again.",
  /** Login and forgot password answer the same way whether or not the email has an account. */
  codeSentGeneric: "If an account uses this email, a code is on its way.",
  /** The only time promise auth makes, and it is the backend's fact. */
  codeExpiry: "It expires in 10 minutes.",
} as const

export type AuthErrorKind =
  | "code-invalid"
  | "code-locked"
  | "turnstile-failed"
  | "turnstile-required"
  | "rate-limited"
  | "network"
  | "other"

/** Which kind of failure an API answer is, from `meta.error` first and the status second. */
export function authErrorKind(status: number | null | undefined, code: string | null | undefined): AuthErrorKind {
  if (code === AUTH_ERROR_CODES.codeInvalid) return "code-invalid"
  if (code === AUTH_ERROR_CODES.codeAttemptsExceeded) return "code-locked"
  if (code === AUTH_ERROR_CODES.turnstileFailed) return "turnstile-failed"
  if (code === AUTH_ERROR_CODES.turnstileRequired) return "turnstile-required"
  if (status === 429) return "rate-limited"
  if (!status) return "network"
  return "other"
}

/** The sentence for a kind, or null for "other" (the caller decides). */
export function authErrorCopy(kind: AuthErrorKind): string | null {
  switch (kind) {
    case "code-invalid":
      return AUTH_COPY.codeInvalid
    case "code-locked":
      return AUTH_COPY.codeLocked
    case "turnstile-failed":
      return AUTH_COPY.turnstileFailed
    case "turnstile-required":
      return AUTH_COPY.turnstileRequired
    case "rate-limited":
      return AUTH_COPY.rateLimited
    case "network":
      return AUTH_COPY.network
    default:
      return null
  }
}

/**
 * The session a successful code verify, password reset or login hands back.
 *
 * `POST /auth/login` answers `{ access_token, expires_at, message, data: user }`.
 * The v2 contract says code verify answers "`{ data: <same as login response> }`",
 * which could mean the token sits at the top level (as on login, after the
 * global interceptor) or one level down. Both shapes are read, so the page
 * works whichever the backend ships.
 */
export function readSession(body: unknown): { accessToken: string | null; role: string | null } {
  const b = (body ?? {}) as Record<string, unknown>
  const inner = (b.data ?? {}) as Record<string, unknown>
  const innerUser = (inner.data ?? inner.user ?? {}) as Record<string, unknown>
  const token =
    typeof b.access_token === "string"
      ? b.access_token
      : typeof inner.access_token === "string"
        ? inner.access_token
        : null
  const roleCandidates = [inner.role, innerUser.role, (b.user as Record<string, unknown> | undefined)?.role]
  const role = roleCandidates.find((r): r is string => typeof r === "string") ?? null
  return { accessToken: token, role }
}

/** `resendAvailableAt` from a code-sending answer, wherever the envelope put it. */
export function readResendAvailableAt(body: unknown): string | null {
  const b = (body ?? {}) as Record<string, unknown>
  const inner = (b.data ?? {}) as Record<string, unknown>
  const value = inner.resendAvailableAt ?? b.resendAvailableAt
  return typeof value === "string" && value ? value : null
}
