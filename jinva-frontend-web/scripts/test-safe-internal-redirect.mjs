#!/usr/bin/env node
/**
 * Unit test for `safeInternalRedirect` (src/lib/auth.ts) — the `?redirect=`
 * open-redirect guard on the login and restore-account paths.
 *
 * WHY THIS FILE EXISTS. F1 has now been fixed three times. The first guard was
 * a `startsWith("/") && !startsWith("//")` test that `/\evil.example` walked
 * straight through; the second resolved the target against the page origin,
 * compared origins — and then returned `pathname`, which for
 * `/..//evil.example` is the protocol-relative `"//evil.example"` *with* a
 * matching origin. Both attempts were validated by a hand-written vector list,
 * and both lists missed (security-report.md F1, both rounds). So the vectors
 * live here instead, in something that runs.
 *
 * Run: `npm run test:redirect` (part of `npm run verify`).
 *
 * There is no test runner in this package. Rather than add one for a single
 * pure function, this follows the existing `scripts/check-color-tokens.mjs`
 * convention: a plain Node script, wired to an npm script, exit 1 on failure.
 * `src/lib/auth.ts` is imported directly through Node's type stripping
 * (requires Node >= 22.6; the npm script passes the flag), so the *shipped*
 * module is under test rather than a copy of it that can drift.
 *
 * The decisive assertion is not "does it equal the fallback". It is: resolve
 * whatever comes back the way the browser will at the call site
 * (`login-form.tsx` assigns it to `globalThis.location.href`) and check the
 * origin it lands on. That is the check that would have caught attempt two,
 * because `"//evil.example"` looks like a path and resolves like an origin.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const ORIGIN = "https://app.jinva.com"
const FALLBACK = "/dashboard/user"
const EVIL = "evil.example"

// `safeInternalRedirect` reads `globalThis.location.origin` at call time; that
// is the only part of `location` it touches.
globalThis.location = { origin: ORIGIN }

const authModule = join(process.cwd(), "src", "lib", "auth.ts")
const { safeInternalRedirect } = await import(pathToFileURL(authModule).href)

/**
 * Targets that try to leave the origin. Each one must come back as the
 * fallback, so the user lands on their own role dashboard.
 *
 * Grouped by the class of trick, because the lesson from two failed fixes is
 * that enumerating members of a class is what fails. Sourced from
 * security-report.md's 42-vector sweep: the nine from the previous round,
 * control characters, percent- and double-percent-encoded separators, Unicode
 * look-alike solidi, non-ASCII whitespace, dot-segment sequences and
 * non-rooted shapes.
 */
const OFF_ORIGIN_ATTEMPTS = [
  // ── the nine vectors the previous round enumerated ───────────────────────
  ["backslash after slash", `/\\${EVIL}`],
  ["protocol-relative", `//${EVIL}`],
  ["backslash-slash", `/\\/${EVIL}`],
  ["double backslash", `\\\\${EVIL}`],
  ["absolute https", `https://${EVIL}`],
  ["absolute http", `http://${EVIL}`],
  ["javascript scheme", "javascript:alert(1)"],
  ["empty string", ""],
  ["null", null],

  // ── dot segments: the class that broke attempt two ───────────────────────
  ["dot-dot collapse", `/..//${EVIL}`],
  ["dot-dot collapse, encoded", `/%2e%2e//${EVIL}`],
  ["dot-dot collapse, mixed-case encoding", `/%2E%2e//${EVIL}`],
  ["dot-dot twice", `/../..//${EVIL}`],
  ["dot-dot after a segment", `/a/../..//${EVIL}`],
  ["single dot then dot-dot", `/./..//${EVIL}`],
  ["trailing collapse", `/${EVIL}/..//..//`],
  ["dot-dot collapse with query and fragment", `/..//${EVIL}?next=1#frag`],
  ["dot-dot collapse then a path", `/%2e%2e//${EVIL}/admin`],
  ["bare dot-dot collapse", "/..//"],
  ["dot-dot normalised away", `/a/../${EVIL}`],

  // ── ASCII control characters (the URL parser strips these) ───────────────
  ["tab", `/\t/${EVIL}`],
  ["newline", `/\n/${EVIL}`],
  ["carriage return", `/\r/${EVIL}`],
  ["NUL", `/\u0000/${EVIL}`],
  ["DEL", `/\u007f//${EVIL}`],
  ["unit separator", `/\u001f//${EVIL}`],
  ["tab then backslash", `/\t\\${EVIL}`],
  ["CRLF then protocol-relative", `/\r\n//${EVIL}`],

  // ── Unicode look-alike solidi and non-ASCII whitespace ───────────────────
  ["fullwidth solidus", `/\uff0f\uff0f${EVIL}`],
  ["division slash", `/\u2215\u2215${EVIL}`],
  ["big solidus", `/\u29f8${EVIL}`],
  ["space", `/ /${EVIL}`],
  ["no-break space", `/\u00a0//${EVIL}`],
  ["line separator", `/\u2028//${EVIL}`],
  ["ideographic space", `/\u3000//${EVIL}`],

  // ── other schemes and shapes ─────────────────────────────────────────────
  ["data scheme", "data:text/html,<script>alert(1)</script>"],
  ["vbscript scheme", "vbscript:msgbox(1)"],
  ["triple slash", `///${EVIL}`],
  ["protocol-relative with a path", `//${EVIL}/dashboard/user`],
  ["protocol-relative with userinfo", `//user@${EVIL}`],
  ["backslash with a path", `/\\${EVIL}/dashboard/user`],
  ["leading backslash-slash", `\\/${EVIL}`],
  ["not rooted", `${EVIL}/dashboard`],
  ["bare host", EVIL],
  ["undefined", undefined],
]

/**
 * Hostile-*looking* targets that are, in fact, ordinary rooted paths on this
 * origin: an attacker's hostname sitting in a path segment, or hidden behind a
 * percent-encoded separator. The browser resolves every one of them against
 * this origin, so they reach JinVa's own 404 (or the homepage, for the
 * fragment-only ones) and cannot navigate off-site.
 *
 * They are asserted on the property that matters — the landing origin — rather
 * than on equality with the fallback, because deciding which same-origin paths
 * are real routes is the router's job, not this guard's. This is the class
 * security-report.md F1 signed off as "inert percent-encoded path segments …
 * stay on-origin".
 */
const ON_ORIGIN_DECOYS = [
  // Double-encoded, so nothing ever decodes it back into a dot segment: the
  // single decode `searchParams.get()` performs leaves `%2e%2e`, and the URL
  // parser treats that as a literal segment. It belongs here rather than with
  // the dot-segment class it imitates — this test moved it after asserting it.
  ["dot-dot collapse, double encoded", `/%252e%252e//${EVIL}`],
  ["encoded backslash", `/%5c${EVIL}`],
  ["encoded double slash", `/%2f%2f${EVIL}`],
  ["encoded tab", `/%09/${EVIL}`],
  ["encoded newline", `/%0a//${EVIL}`],
  ["encoded NUL", `/%00//${EVIL}`],
  ["userinfo at", `/@${EVIL}`],
  ["host:port shaped", `/${EVIL}:80`],
  ["scheme inside the path", `/http://${EVIL}`],
  ["single-slash scheme", `/https:/${EVIL}`],
  ["colon first segment", `/:/${EVIL}`],
  ["fragment protocol-relative", `/#//${EVIL}`],
  ["fragment userinfo", `/#@${EVIL}`],
]

/**
 * Legitimate targets, which must survive byte-for-byte. `?redirect=` values
 * arrive already percent-decoded from `searchParams.get()`, so the
 * `%2Fdashboard%2Fartisan` that middleware.ts writes reaches this function as
 * `/dashboard/artisan`.
 */
const LEGITIMATE = [
  ["role dashboard (the value middleware sets)", "/dashboard/artisan", "/dashboard/artisan"],
  ["deep path", "/dashboard/artisan/jobs", "/dashboard/artisan/jobs"],
  ["settings tab", "/dashboard/user/settings?tab=security", "/dashboard/user/settings?tab=security"],
  [
    "query and fragment preserved",
    "/dashboard/user/jobs/12?from=email#reviews",
    "/dashboard/user/jobs/12?from=email#reviews",
  ],
  ["admin deep link", "/dashboard/admin/disputes?status=OPEN&page=2", "/dashboard/admin/disputes?status=OPEN&page=2"],
  ["root", "/", "/"],
  ["trailing slash kept", "/dashboard/user/", "/dashboard/user/"],
]

const failures = []
let checks = 0

/** Where `location.href = value` would actually take the browser. */
function landingOrigin(value) {
  try {
    return new URL(value, ORIGIN).origin
  } catch {
    return "<<invalid>>"
  }
}

function assertContained(label, target, result) {
  checks++
  const landed = landingOrigin(result)
  if (landed !== ORIGIN) {
    failures.push(
      `${label}: ${JSON.stringify(target)} -> ${JSON.stringify(result)} resolves to ${landed}, which is OFF-ORIGIN`,
    )
  }
  checks++
  if (typeof result !== "string" || !result.startsWith("/") || result.startsWith("//")) {
    failures.push(
      `${label}: ${JSON.stringify(target)} -> ${JSON.stringify(result)} is not a rooted single-slash path`,
    )
  }
}

for (const [label, target] of OFF_ORIGIN_ATTEMPTS) {
  const result = safeInternalRedirect(target, FALLBACK)
  checks++
  if (result !== FALLBACK) {
    failures.push(
      `off-origin/${label}: ${JSON.stringify(target)} -> ${JSON.stringify(result)}, ` +
        `expected the fallback ${JSON.stringify(FALLBACK)}`,
    )
  }
  assertContained(`off-origin/${label}`, target, result)
}

for (const [label, target] of ON_ORIGIN_DECOYS) {
  const result = safeInternalRedirect(target, FALLBACK)
  assertContained(`decoy/${label}`, target, result)
}

for (const [label, target, expected] of LEGITIMATE) {
  const result = safeInternalRedirect(target, FALLBACK)
  checks++
  if (result !== expected) {
    failures.push(
      `legitimate/${label}: ${JSON.stringify(target)} -> ${JSON.stringify(result)}, expected ${JSON.stringify(expected)}`,
    )
  }
  assertContained(`legitimate/${label}`, target, result)
}

// The fallback is caller-supplied (the role dashboard), so each role's own
// dashboard has to survive as itself — nobody may be dropped on another role's.
for (const roleDashboard of ["/dashboard/user", "/dashboard/artisan", "/dashboard/admin"]) {
  checks++
  const result = safeInternalRedirect(`//${EVIL}`, roleDashboard)
  if (result !== roleDashboard) {
    failures.push(`fallback/${roleDashboard}: expected the caller's fallback, got ${JSON.stringify(result)}`)
  }
}

// No `location` at all (SSR, or the edge middleware that also imports this
// module): the structural layer cannot run, so the guard must refuse outright
// rather than half-check.
{
  const saved = globalThis.location
  delete globalThis.location
  for (const [label, target] of [
    ["off-origin", `//${EVIL}`],
    ["legitimate", "/dashboard/artisan/jobs"],
  ]) {
    checks++
    const result = safeInternalRedirect(target, FALLBACK)
    if (result !== FALLBACK) {
      failures.push(
        `no-location/${label}: ${JSON.stringify(target)} -> ${JSON.stringify(result)}, ` +
          `expected the fallback with no origin to check against`,
      )
    }
  }
  globalThis.location = saved
}

const vectorCount = OFF_ORIGIN_ATTEMPTS.length + ON_ORIGIN_DECOYS.length

if (failures.length === 0) {
  console.log(
    `✓ safeInternalRedirect: ${checks} assertions over ${vectorCount} hostile vectors ` +
      `(${OFF_ORIGIN_ATTEMPTS.length} off-origin attempts, all falling back to the role dashboard; ` +
      `${ON_ORIGIN_DECOYS.length} on-origin decoys) and ${LEGITIMATE.length} legitimate targets. ` +
      `0 off-origin landings.`,
  )
  process.exit(0)
}

console.error(`✗ safeInternalRedirect: ${failures.length} failure(s) across ${checks} assertions.\n`)
for (const f of failures) console.error(`  ${f}`)
console.error(
  "\nThis guard is the only thing between a caller-supplied `?redirect=` and\n" +
    "`location.href` in login-form.tsx. See security-report.md F1.\n",
)
process.exit(1)
