/**
 * S2: verifies the `jinva_session` cookie set by the backend
 * (`JIN_VA-BACKEND/src/auth/utils/session-cookie.util.ts`) — an httpOnly,
 * HMAC-signed cookie carrying `{ sub, role, exp }`. This is a genuine
 * server-issued, tamper-evident signal (unlike a plain script-set cookie):
 * middleware can trust `role` here because forging it requires knowing
 * SESSION_COOKIE_SECRET, which must match the backend's value exactly.
 *
 * Format (see the backend util for the authoritative definition):
 *   `${base64url(JSON.stringify({ sub, role, exp }))}.${hmacSha256Base64Url(body)}`
 *
 * Implemented with Web Crypto (not `node:crypto`) because Next.js middleware
 * runs in the Edge runtime, which has no Node crypto module.
 */

export interface AuthSessionPayload {
  sub: number
  role: string
  exp: number
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ])
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message))
  return bytesToBase64Url(new Uint8Array(signature))
}

/**
 * Verifies the cookie's HMAC signature and expiry. Returns the decoded
 * payload only if the signature matches and it hasn't expired — otherwise
 * null (treated as "not authenticated" by the caller).
 */
export async function verifyAuthSessionCookie(
  cookieValue: string,
  secret: string,
): Promise<AuthSessionPayload | null> {
  const dot = cookieValue.lastIndexOf(".")
  if (dot === -1) return null
  const body = cookieValue.slice(0, dot)
  const signature = cookieValue.slice(dot + 1)

  const expectedSignature = await hmacSha256Base64Url(secret, body)
  if (expectedSignature !== signature) return null

  try {
    const json = new TextDecoder().decode(base64UrlToBytes(body))
    const payload = JSON.parse(json) as AuthSessionPayload
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null
    if (!payload.role) return null
    return payload
  } catch {
    return null
  }
}
