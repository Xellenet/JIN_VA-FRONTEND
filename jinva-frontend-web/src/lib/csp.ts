/**
 * Security headers for every response (SEC-32; 04-implementation-plan §4.1).
 *
 * Pure: no runtime imports, so `scripts/test-csp.mjs` runs it directly with
 * Node's type stripping and `next.config.ts` builds the real headers from it.
 *
 * What the app loads, read from the code: self-hosted Geist (no font hosts),
 * the API (`NEXT_PUBLIC_API_URL`, possibly relative under the proxy), avatars
 * and media from the API origin, extra CDN origins (`NEXT_PUBLIC_MEDIA_ORIGINS`)
 * and Google sign-in avatars (lh3.googleusercontent.com), `blob:` for private
 * media, Firebase Cloud Messaging endpoints, and Vercel Analytics (same-origin
 * in production). Paystack and Google sign-in are top-level redirects, so they
 * need no CSP entry.
 *
 * [Δ] No nonce or 'strict-dynamic' in v2: `headers()` cannot mint a
 * per-request nonce, so `script-src` keeps 'unsafe-inline'. The policy ships
 * as Report-Only until `CSP_ENFORCE=1`. Security signs this deviation off
 * before enforcement; the middleware-nonce upgrade is a tracked follow-up.
 *
 * `frame-src blob:`: the admin KYC review shows PDFs as an `<iframe>` of a
 * `blob:` object URL (`components/admin/kyc-media.tsx`). Only this origin's
 * own scripts can mint such URLs, and Chrome's PDF viewer still renders under
 * `object-src 'none'` (checked in a browser with the policy enforced).
 *
 * Cloudflare Turnstile (auth v2): the bot check on the auth pages loads its
 * script from `https://challenges.cloudflare.com` and renders its challenge in
 * an iframe from the same origin, so that one origin is in `script-src` and
 * `frame-src`. The script is only requested on auth pages, and only when
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set (components/auth/turnstile.tsx).
 *
 * Reporting: when `CSP_REPORT_URI` is set (an absolute https URL, or a
 * same-origin path), violations are sent there through `report-uri` and
 * `report-to` + `Reporting-Endpoints`. Unset, nothing is reported and the
 * Report-Only trial relies on browser consoles.
 */

export interface CspOptions {
  /** `NEXT_PUBLIC_API_URL`: absolute (`https://api.example.com/api/v1`) or relative (`/api/v1`). */
  apiUrl?: string | null
  /** Extra media/CDN origins, as an array or a comma-separated string. */
  mediaOrigins?: readonly string[] | string | null
  /** `next dev`: allows eval, the dev analytics script and the HMR websocket. */
  dev: boolean
  /** `CSP_REPORT_URI`: where violation reports go. Invalid values are ignored. */
  reportUri?: string | null
}

export const CSP_REPORT_GROUP = "csp-endpoint"

export interface HeaderRule {
  source: string
  headers: { key: string; value: string }[]
}

export const GOOGLE_AVATAR_ORIGIN = "https://lh3.googleusercontent.com"
export const FCM_ORIGINS = [
  "https://firebaseinstallations.googleapis.com",
  "https://fcmregistrations.googleapis.com",
  "https://fcm.googleapis.com",
] as const
/** Cloudflare Turnstile's script and challenge iframe. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com"
export const VERCEL_DEV_SCRIPT_ORIGIN = "https://va.vercel-scripts.com"
export const SERVICE_WORKER_PATH = "/firebase-messaging-sw.js"

/**
 * The origin of an absolute http(s) URL, or null. Relative URLs (the
 * same-origin proxy) and anything that is not http(s) give null, so a stray
 * value can never add `javascript:` or `*` to the policy.
 */
export function originOf(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  try {
    const u = new URL(trimmed)
    if (u.protocol !== "https:" && u.protocol !== "http:") return null
    if (!u.hostname || u.username || u.password) return null
    return u.origin
  } catch {
    return null
  }
}

/**
 * A report endpoint that is safe to put inside a header: an absolute https URL
 * (http only for localhost) without credentials, or a same-origin path. Any
 * whitespace, quote, comma or semicolon would let the value add directives,
 * so such values give null.
 */
export function reportEndpointOf(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null
  const v = value.trim()
  if (!v || /[\s;,"'\\]/.test(v)) return null
  if (v.startsWith("/")) return v.startsWith("//") ? null : v
  try {
    const u = new URL(v)
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1"
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null
    if (u.username || u.password) return null
    return u.href
  } catch {
    return null
  }
}

function list(value: readonly string[] | string | null | undefined): string[] {
  if (!value) return []
  const raw = typeof value === "string" ? value.split(",") : [...value]
  return raw.map((v) => v.trim()).filter(Boolean)
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))]
}

/** The policy for every page (everything except the service worker). */
export function buildCsp({ apiUrl, mediaOrigins, dev, reportUri }: CspOptions): string {
  const api = originOf(apiUrl)
  const media = list(mediaOrigins).map(originOf)

  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", unique(["'self'", "'unsafe-inline'", TURNSTILE_ORIGIN, dev ? "'unsafe-eval'" : null, dev ? VERCEL_DEV_SCRIPT_ORIGIN : null])],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", unique(["'self'", "data:", "blob:", api, GOOGLE_AVATAR_ORIGIN, ...media])],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", unique(["'self'", api, ...FCM_ORIGINS, dev ? VERCEL_DEV_SCRIPT_ORIGIN : null, dev ? "ws:" : null, dev ? "wss:" : null])],
    ["media-src", unique(["'self'", "blob:", api, ...media])],
    ["worker-src", ["'self'"]],
    ["manifest-src", ["'self'"]],
    ["frame-src", ["blob:", TURNSTILE_ORIGIN]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ]
  const report = reportEndpointOf(reportUri)
  if (report) directives.push(["report-uri", [report]], ["report-to", [CSP_REPORT_GROUP]])
  return directives.map(([name, sources]) => `${name} ${sources.join(" ")}`).join("; ")
}

/** The Firebase messaging service worker's own, narrower policy. */
export function buildServiceWorkerCsp(): string {
  return [
    "default-src 'self'",
    "script-src 'self' https://www.gstatic.com",
    "connect-src 'self' https://*.googleapis.com",
  ].join("; ")
}

/** Headers enforced on every path, Report-Only or not. */
export const ALWAYS_ON_HEADERS: readonly { key: string; value: string }[] = [
  // frame-ancestors has no effect in Report-Only, so framing is blocked here.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation=(self): post-job uses it.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
]

export function cspHeaderName(enforce: boolean): string {
  return enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"
}

/**
 * The `headers()` rules for `next.config.ts`. The page policy is applied to
 * every path except the service worker, which gets its own; the always-on
 * headers apply to both.
 */
export function securityHeaderRules(options: CspOptions & { enforce: boolean }): HeaderRule[] {
  const name = cspHeaderName(options.enforce)
  const report = reportEndpointOf(options.reportUri)
  const reporting = report ? [{ key: "Reporting-Endpoints", value: `${CSP_REPORT_GROUP}="${report}"` }] : []
  const escapedSw = SERVICE_WORKER_PATH.slice(1).replace(/\./g, "\\.")
  return [
    {
      source: `/((?!${escapedSw}$).*)`,
      headers: [{ key: name, value: buildCsp(options) }, ...reporting, ...ALWAYS_ON_HEADERS],
    },
    {
      source: SERVICE_WORKER_PATH,
      headers: [{ key: name, value: buildServiceWorkerCsp() }, ...ALWAYS_ON_HEADERS],
    },
  ]
}
