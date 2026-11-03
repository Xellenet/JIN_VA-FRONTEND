#!/usr/bin/env node
/**
 * Unit tests for the security headers (SEC-32; 04-implementation-plan §4.1,
 * §5.5 "test-csp.mjs"; T-11 / S-8 header-presence part).
 *
 * Checks the policy builder in `src/lib/csp.ts` and the exact rules
 * `next.config.ts` hands to Next, including that Next's own route validator
 * accepts them (an invalid `source` would stop the dev server). Live-response
 * checks are QA's (S-8).
 *
 * Run: `npm run test:csp`.
 */
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const root = join(import.meta.dirname, "..")
const C = await import(pathToFileURL(join(root, "src/lib/csp.ts")).href)
const require = createRequire(join(root, "package.json"))

let passed = 0
const failures = []
function ok(name, cond, detail = "") {
  if (cond) passed++
  else failures.push(`${name}${detail ? `\n    ${detail}` : ""}`)
}

/** "a b; c d" → Map(a → [b], c → [d]) */
function parse(policy) {
  const map = new Map()
  for (const part of policy.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/)
    if (!name) continue
    ok(`directive ${name} appears once`, !map.has(name), policy)
    map.set(name, sources)
  }
  return map
}

const API = "https://api.jinva.example/api/v1"
const prod = parse(C.buildCsp({ apiUrl: API, mediaOrigins: "https://cdn.jinva.example, https://media.jinva.example/x", dev: false }))
const dev = parse(C.buildCsp({ apiUrl: "http://localhost:8000/api/v1", mediaOrigins: null, dev: true }))

// ── Required directives (production) ────────────────────────────────────────
const REQUIRED = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
  "frame-src": ["blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
}
for (const [name, sources] of Object.entries(REQUIRED)) {
  const got = prod.get(name)
  ok(`prod has ${name}`, !!got)
  for (const s of sources) ok(`prod ${name} includes ${s}`, !!got?.includes(s), JSON.stringify(got))
}

// ── Hosts the app really uses ───────────────────────────────────────────────
ok("API origin in img-src", prod.get("img-src").includes("https://api.jinva.example"))
ok("API origin in connect-src", prod.get("connect-src").includes("https://api.jinva.example"))
ok("API path is not in the policy", !prod.get("connect-src").some((s) => s.includes("/api/v1")))
ok("media origin 1 in img-src", prod.get("img-src").includes("https://cdn.jinva.example"))
ok("media origin 2 reduced to origin", prod.get("img-src").includes("https://media.jinva.example"))
ok("Google avatar host in img-src", prod.get("img-src").includes("https://lh3.googleusercontent.com"))
for (const host of C.FCM_ORIGINS) ok(`FCM ${host} in connect-src`, prod.get("connect-src").includes(host))

// ── Production never carries dev-only sources ──────────────────────────────
const prodAll = [...prod.values()].flat()
ok("no 'unsafe-eval' in production", !prodAll.includes("'unsafe-eval'"))
ok("no vercel dev script host in production", !prodAll.includes(C.VERCEL_DEV_SCRIPT_ORIGIN))
ok("no ws: in production", !prodAll.includes("ws:") && !prodAll.includes("wss:"))
ok("no wildcard source in production", !prodAll.some((s) => s === "*" || s.startsWith("*")))
ok("no http: scheme source in production", !prodAll.includes("http:") && !prodAll.includes("https:"))

// ── Dev additions ───────────────────────────────────────────────────────────
ok("dev allows 'unsafe-eval'", dev.get("script-src").includes("'unsafe-eval'"))
ok("dev allows vercel dev script", dev.get("script-src").includes(C.VERCEL_DEV_SCRIPT_ORIGIN))
ok("dev allows HMR websocket", dev.get("connect-src").includes("ws:"))
ok("dev local API origin", dev.get("connect-src").includes("http://localhost:8000"))

// ── Relative API (same-origin proxy) and hostile values ─────────────────────
{
  const rel = parse(C.buildCsp({ apiUrl: "/api/v1", mediaOrigins: ["javascript:alert(1)", "*", "data:", "//evil.example", "ftp://x.example", "https://u:p@evil.example"], dev: false }))
  const all = [...rel.values()].flat()
  ok("relative API adds nothing", !all.some((s) => s.includes("api/v1")))
  ok("hostile media values dropped", !all.some((s) => /javascript|evil|ftp|^\*$/.test(s)), JSON.stringify(all))
  ok("originOf rejects relative", C.originOf("/api/v1") === null)
  ok("originOf rejects javascript:", C.originOf("javascript:alert(1)") === null)
  ok("originOf keeps port", C.originOf("http://localhost:8000/api/v1") === "http://localhost:8000")
  ok("policy has no newline or quote injection", !C.buildCsp({ apiUrl: "https://a.example/\n;script-src *", dev: false }).includes("\n"))
}

// ── Frames: blob: (admin KYC PDF preview, kyc-media.tsx) and Turnstile ─────
ok(
  "frame-src is exactly blob: and Turnstile",
  prod.get("frame-src").join(" ") === `blob: ${C.TURNSTILE_ORIGIN}`,
  JSON.stringify(prod.get("frame-src")),
)

// ── Cloudflare Turnstile (auth v2): its script and challenge iframe only ────
ok("Turnstile origin constant", C.TURNSTILE_ORIGIN === "https://challenges.cloudflare.com")
ok("Turnstile in prod script-src", prod.get("script-src").includes(C.TURNSTILE_ORIGIN))
ok("Turnstile in dev script-src", dev.get("script-src").includes(C.TURNSTILE_ORIGIN))
ok("Turnstile in dev frame-src", dev.get("frame-src").includes(C.TURNSTILE_ORIGIN))
ok("Turnstile not in connect-src", !prod.get("connect-src").includes(C.TURNSTILE_ORIGIN))
ok("Turnstile not in img-src", !prod.get("img-src").includes(C.TURNSTILE_ORIGIN))
ok("no other cloudflare host", !prodAll.some((s) => /cloudflare/.test(s) && s !== C.TURNSTILE_ORIGIN))
ok("object-src stays 'none'", prod.get("object-src").join(" ") === "'none'")
ok("frame-ancestors stays 'none'", prod.get("frame-ancestors").join(" ") === "'none'")

// ── Violation reporting (CSP_REPORT_URI) ────────────────────────────────────
{
  ok("no report directives by default", !prod.has("report-uri") && !prod.has("report-to"))
  const abs = parse(C.buildCsp({ apiUrl: API, dev: false, reportUri: "https://csp.jinva.example/r" }))
  ok("absolute report-uri", abs.get("report-uri")?.join(" ") === "https://csp.jinva.example/r", JSON.stringify(abs.get("report-uri")))
  ok("report-to names the group", abs.get("report-to")?.join(" ") === C.CSP_REPORT_GROUP)
  const rel = parse(C.buildCsp({ apiUrl: API, dev: false, reportUri: "/csp-report" }))
  ok("same-origin path report-uri", rel.get("report-uri")?.join(" ") === "/csp-report")
  for (const bad of ["http://evil.example/r", "//evil.example/r", "javascript:alert(1)", "https://a.example/r; script-src *", "https://a.example/r,x", "https://u:p@a.example/r", "https://a.example/\"x", " "]) {
    ok(`hostile report URI ignored: ${JSON.stringify(bad)}`, C.reportEndpointOf(bad) === null && !parse(C.buildCsp({ apiUrl: API, dev: false, reportUri: bad })).has("report-uri"))
  }
  ok("localhost http allowed for dev", C.reportEndpointOf("http://localhost:8000/r") === "http://localhost:8000/r")
  const rules = C.securityHeaderRules({ apiUrl: API, dev: false, enforce: false, reportUri: "https://csp.jinva.example/r" })
  ok("Reporting-Endpoints on the page rule", rules[0].headers.find((h) => h.key === "Reporting-Endpoints")?.value === `${C.CSP_REPORT_GROUP}="https://csp.jinva.example/r"`)
  ok("no Reporting-Endpoints without a URI", !C.securityHeaderRules({ apiUrl: API, dev: false, enforce: false }).some((r) => r.headers.some((h) => h.key === "Reporting-Endpoints")))
}

// ── Service worker policy ───────────────────────────────────────────────────
{
  const sw = parse(C.buildServiceWorkerCsp())
  ok("SW script-src allows gstatic", sw.get("script-src")?.includes("https://www.gstatic.com"))
  ok("SW connect-src allows googleapis", sw.get("connect-src")?.includes("https://*.googleapis.com"))
  ok("SW default-src self", sw.get("default-src")?.join(" ") === "'self'")
}

// ── The header rules next.config.ts uses (T-11 / S-8 header presence) ──────
for (const enforce of [false, true]) {
  const rules = C.securityHeaderRules({ apiUrl: API, mediaOrigins: null, dev: false, enforce })
  const name = enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"
  const other = enforce ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy"
  ok(`two rules (enforce=${enforce})`, rules.length === 2)
  for (const rule of rules) {
    const keys = rule.headers.map((h) => h.key)
    ok(`${rule.source}: ${name}`, keys.includes(name))
    ok(`${rule.source}: not ${other}`, !keys.includes(other))
    const get = (k) => rule.headers.find((h) => h.key === k)?.value
    ok(`${rule.source}: X-Frame-Options DENY`, get("X-Frame-Options") === "DENY")
    ok(`${rule.source}: nosniff`, get("X-Content-Type-Options") === "nosniff")
    ok(`${rule.source}: Referrer-Policy`, get("Referrer-Policy") === "strict-origin-when-cross-origin")
    ok(`${rule.source}: Permissions-Policy`, get("Permissions-Policy") === "camera=(), microphone=(), geolocation=(self), payment=()")
  }
  ok("page rule carries frame-ancestors 'none'", rules[0].headers.find((h) => h.key === name).value.includes("frame-ancestors 'none'"))
  ok("SW rule carries the SW policy", rules[1].headers.find((h) => h.key === name).value === C.buildServiceWorkerCsp())
}

// ── Next accepts the rules, and they match the right paths ──────────────────
{
  const rules = C.securityHeaderRules({ apiUrl: API, mediaOrigins: null, dev: false, enforce: false })
  try {
    const { checkCustomRoutes } = require("next/dist/lib/load-custom-routes")
    let threw = null
    try {
      checkCustomRoutes(rules, "header")
    } catch (e) {
      threw = e
    }
    ok("Next accepts the header rules", threw === null, String(threw))

    const { pathToRegexp } = require("next/dist/compiled/path-to-regexp")
    const match = (source, path) => pathToRegexp(source, [], { strict: true, sensitive: false, delimiter: "/" }).test(path)
    const [page, sw] = rules
    for (const p of ["/", "/dashboard/user/settings", "/dashboard/user/settings?tab=payments".split("?")[0], "/_next/static/chunks/x.js", "/firebase-messaging-sw.js.map"]) {
      ok(`page policy applies to ${p}`, match(page.source, p))
      ok(`SW policy does not apply to ${p}`, !match(sw.source, p))
    }
    ok("page policy skips the SW", !match(page.source, "/firebase-messaging-sw.js"))
    ok("SW policy applies to the SW", match(sw.source, "/firebase-messaging-sw.js"))
  } catch (e) {
    failures.push(`could not load Next's route helpers: ${e}`)
  }
}

if (failures.length) {
  console.error(`test:csp — ${failures.length} failed, ${passed} passed\n`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`test:csp — all ${passed} checks passed`)
