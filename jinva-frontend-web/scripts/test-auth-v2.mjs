#!/usr/bin/env node
/**
 * Auth v2: the code-input logic, code sanitising, the resend countdown maths,
 * the sign-up step/draft rules and the error copy, run against the shipped
 * modules (`src/lib/auth-code.ts`, `src/lib/signup-flow.ts`,
 * `src/lib/auth-v2-errors.ts`) and the CSP builder's Turnstile entries.
 *
 * Run: `npm run test:auth-v2` (part of `npm run verify`). Same convention as
 * the other scripts: no test runner, the real modules through Node's type
 * stripping, exit 1 on failure. No network.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const lib = (...parts) => pathToFileURL(join(process.cwd(), "src", "lib", ...parts)).href
const code = await import(lib("auth-code.ts"))
const flow = await import(lib("signup-flow.ts"))
const errors = await import(lib("auth-v2-errors.ts"))
const csp = await import(lib("csp.ts"))

let failures = 0
let passed = 0
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    failures++
    console.error(`FAIL ${label}: expected ${e}, got ${a}`)
  } else passed++
}

// ── Sanitising ───────────────────────────────────────────────────────────────
check("code length", code.CODE_LENGTH, 6)
check("digits pass", code.sanitizeCode("482913"), "482913")
check("spaces dropped", code.sanitizeCode("482 913"), "482913")
check("dashes dropped", code.sanitizeCode("482-913"), "482913")
check("sentence around a code", code.sanitizeCode("Your code is 482913."), "482913")
check("letters dropped", code.sanitizeCode("4a8b2c"), "482")
check("capped at 6", code.sanitizeCode("1234567890"), "123456")
check("full-width digits", code.sanitizeCode("４８２９１３"), "482913")
check("Arabic-Indic digits", code.sanitizeCode("٤٨٢٩١٣"), "482913")
check("Devanagari digits", code.sanitizeCode("४८२९१३"), "482913")
check("mathematical bold digits", code.sanitizeCode("𝟒𝟖𝟐𝟗𝟏𝟑"), "482913")
check("empty", code.sanitizeCode(""), "")
check("superscripts are not digits", code.sanitizeCode("²³"), "")

// ── Typing ───────────────────────────────────────────────────────────────────
const E = code.emptyCode()
check("empty code", E, ["", "", "", "", "", ""])
let c = code.applyCodeInput(E, 0, "4")
check("type 1st digit", c, { digits: ["4", "", "", "", "", ""], focus: 1 })
c = code.applyCodeInput(c.digits, 1, "8")
check("type 2nd digit", c.focus, 2)
check("letter ignored", code.applyCodeInput(c.digits, 2, "x"), { digits: c.digits, focus: 2 })
const five = code.digitsFromCode("48291")
const six = code.applyCodeInput(five, 5, "3")
check("6th digit completes", code.isCodeComplete(six.digits), true)
check("focus stays on last box", six.focus, 5)
check("code string", code.codeFromDigits(six.digits), "482913")
check("incomplete is not complete", code.isCodeComplete(five), false)
check("overwrite a filled box", code.applyCodeInput(six.digits, 2, "7").digits.join(""), "487913")

// ── Paste / autofill ─────────────────────────────────────────────────────────
check("full paste in box 1", code.applyCodeInput(E, 0, "482913"), { digits: ["4", "8", "2", "9", "1", "3"], focus: 5 })
check("full paste in box 4 still fills from the start", code.applyCodeInput(E, 3, "482913").digits.join(""), "482913")
check("formatted paste", code.applyCodeInput(E, 0, " 482-913 ").digits.join(""), "482913")
check("partial paste from box 3", code.applyCodeInput(code.digitsFromCode("48"), 2, "29"), { digits: ["4", "8", "2", "9", "", ""], focus: 4 })
check("partial paste that runs off the end", code.applyCodeInput(code.digitsFromCode("4829"), 4, "1357").digits.join(""), "482913".slice(0, 4) + "13")
check("paste of junk", code.applyCodeInput(E, 0, "hello").digits, E)
check("long paste capped", code.applyCodeInput(E, 0, "48291355").digits.join(""), "482913")

// ── Backspace / delete / arrows ──────────────────────────────────────────────
const full = code.digitsFromCode("482913")
check("backspace on a filled box clears it, stays", code.applyCodeBackspace(full, 3), { digits: ["4", "8", "2", "", "1", "3"], focus: 3 })
check("backspace on an empty box clears the previous and moves back", code.applyCodeBackspace(code.digitsFromCode("48"), 2), { digits: ["4", "", "", "", "", ""], focus: 1 })
check("backspace in box 1 stays in box 1", code.applyCodeBackspace(E, 0), { digits: E, focus: 0 })
check("delete clears in place", code.applyCodeDelete(full, 0), { digits: ["", "8", "2", "9", "1", "3"], focus: 0 })
check("left", code.moveCodeFocus("ArrowLeft", 3), 2)
check("left at start", code.moveCodeFocus("ArrowLeft", 0), 0)
check("right", code.moveCodeFocus("ArrowRight", 3), 4)
check("right at end", code.moveCodeFocus("ArrowRight", 5), 5)
check("home", code.moveCodeFocus("Home", 4), 0)
check("end", code.moveCodeFocus("End", 1), 5)
check("other keys", code.moveCodeFocus("a", 1), null)
check("click past the gap lands on the first empty box", code.focusTargetFor(code.digitsFromCode("48"), 5), 2)
check("click before the gap is kept", code.focusTargetFor(code.digitsFromCode("48"), 1), 1)
check("full code keeps the chosen box", code.focusTargetFor(full, 4), 4)
check("out-of-range index is clamped", code.applyCodeInput(E, 99, "4").digits, ["", "", "", "", "", "4"])
check("bad stored digits normalised", code.applyCodeInput(["x", "8", "", "", "", ""], 0, "4").digits.join(""), "48")
check("progress empty", code.codeProgressLabel(E), "")
check("progress partial", code.codeProgressLabel(code.digitsFromCode("482")), "3 of 6 digits entered.")
check("progress full", code.codeProgressLabel(full), "All 6 digits entered.")

// ── Countdown maths ──────────────────────────────────────────────────────────
const now = Date.parse("2026-11-03T10:00:00.000Z")
check("ISO resendAvailableAt", code.resendAvailableAtMs("2026-11-03T10:00:42.000Z", now), now + 42_000)
check("missing → 60 s fallback", code.resendAvailableAtMs(null, now), now + 60_000)
check("empty → fallback", code.resendAvailableAtMs("", now), now + 60_000)
check("garbage → fallback", code.resendAvailableAtMs("soon", now), now + 60_000)
check("far future capped at 10 min", code.resendAvailableAtMs("2026-11-04T10:00:00.000Z", now), now + 600_000)
check("past stays past", code.resendAvailableAtMs("2026-11-03T09:59:00.000Z", now), now - 60_000)
check("secondsUntil rounds up", code.secondsUntil(now + 41_001, now), 42)
check("secondsUntil exact", code.secondsUntil(now + 42_000, now), 42)
check("secondsUntil past is 0", code.secondsUntil(now - 5_000, now), 0)
check("secondsUntil null is 0", code.secondsUntil(null, now), 0)
check("format 42", code.formatCountdown(42), "0:42")
check("format 75", code.formatCountdown(75), "1:15")
check("format 0", code.formatCountdown(0), "0:00")
check("format negative", code.formatCountdown(-3), "0:00")
check("format 600", code.formatCountdown(600), "10:00")
check("words 42", code.countdownWords(42), "42 seconds")
check("words 1", code.countdownWords(1), "1 second")
check("words 75", code.countdownWords(75), "1 minute 15 seconds")
check("words 120", code.countdownWords(120), "2 minutes")
check("words 0", code.countdownWords(0), "0 seconds")

// ── Sign-up steps and draft ──────────────────────────────────────────────────
check("steps", flow.SIGNUP_STEPS, ["role", "details", "code"])
check("role CUSTOMER", flow.roleFromParam("CUSTOMER"), "CUSTOMER")
check("role ARTISAN", flow.roleFromParam("ARTISAN"), "ARTISAN")
check("ADMIN is never self-registrable", flow.roleFromParam("ADMIN"), null)
check("lower-case role ignored", flow.roleFromParam("artisan"), null)
check("junk role ignored", flow.roleFromParam("<script>"), null)
const S = (step, role = null, codeEmail = null) => flow.resolveSignupStep(step, { role, codeEmail })
check("no step → role", S(null), "role")
check("unknown step → role", S("pay"), "role")
check("details without a role → role", S("details"), "role")
check("details with a role", S("details", "CUSTOMER"), "details")
check("code without an email → details", S("code", "ARTISAN"), "details")
check("code without role or email → role", S("code"), "role")
check("code with an email", S("code", "ARTISAN", "a@b.co"), "code")
check("role step always allowed", S("role", "ARTISAN", "a@b.co"), "role")
check("step numbers", flow.SIGNUP_STEPS.map(flow.signupStepNumber), [1, 2, 3])
check("artisan lands on setup", flow.homeAfterSignup("ARTISAN"), "/dashboard/artisan/setup")
check("client lands on the dashboard", flow.homeAfterSignup("CUSTOMER"), "/dashboard/user")
check("unknown role lands on the client dashboard", flow.homeAfterSignup(undefined), "/dashboard/user")

{
  const stored = flow.serializeSignupDraft({
    role: "ARTISAN",
    firstname: "Kofi",
    lastname: "Asante",
    email: "kofi@example.com",
    phoneNumber: "241234567",
    phoneCountry: "GH",
    password: "Secret@123",
    confirmPassword: "Secret@123",
    newPassword: "x",
    codeEmail: "kofi@example.com",
  })
  check("password never stored", /Secret|password/i.test(stored), false)
  const back = flow.parseSignupDraft(stored)
  check("draft round trip", [back.role, back.firstname, back.email, back.codeEmail], ["ARTISAN", "Kofi", "kofi@example.com", "kofi@example.com"])
  check("unknown keys dropped", Object.keys(back).sort(), Object.keys(flow.EMPTY_SIGNUP_DRAFT).sort())
}
check("draft ADMIN role dropped", flow.parseSignupDraft(JSON.stringify({ role: "ADMIN" })).role, null)
check("bad country falls back", flow.parseSignupDraft(JSON.stringify({ phoneCountry: "gh; x" })).phoneCountry, "GH")
check("malformed JSON → empty", flow.parseSignupDraft("{nope"), flow.EMPTY_SIGNUP_DRAFT)
check("array → empty", flow.parseSignupDraft("[1,2]"), flow.EMPTY_SIGNUP_DRAFT)
check("null → empty", flow.parseSignupDraft(null), flow.EMPTY_SIGNUP_DRAFT)
check("non-string fields → empty strings", flow.parseSignupDraft(JSON.stringify({ firstname: 5, email: {} })).firstname, "")
check("overlong field capped", flow.parseSignupDraft(JSON.stringify({ email: "a".repeat(1000) })).email.length, 320)

// ── Error copy ───────────────────────────────────────────────────────────────
const K = errors.authErrorKind
check("CODE_INVALID", K(400, "CODE_INVALID"), "code-invalid")
check("CODE_ATTEMPTS_EXCEEDED", K(400, "CODE_ATTEMPTS_EXCEEDED"), "code-locked")
check("TURNSTILE_FAILED", K(400, "TURNSTILE_FAILED"), "turnstile-failed")
check("TURNSTILE_REQUIRED", K(401, "TURNSTILE_REQUIRED"), "turnstile-required")
check("TURNSTILE_UNAVAILABLE", K(503, "TURNSTILE_UNAVAILABLE"), "turnstile-unavailable")
check("unavailable copy", errors.authErrorCopy("turnstile-unavailable"), "Our security check isn't responding right now. Try again in a moment.")
check("AUTH_RATE_LIMIT_EXCEEDED is rate-limited", K(429, "AUTH_RATE_LIMIT_EXCEEDED"), "rate-limited")
check("429", K(429, undefined), "rate-limited")
check("network", K(0, undefined), "network")
check("other", K(400, undefined), "other")
check("contract wording for a bad code", errors.authErrorCopy("code-invalid"), "That code didn't work. Check it or ask for a new one.")
check("generic sent copy", errors.AUTH_COPY.codeSentGeneric, "If an account uses this email, a code is on its way.")
check("expiry is the only time promise", errors.AUTH_COPY.codeExpiry, "It expires in 10 minutes.")
check("other has no copy", errors.authErrorCopy("other"), null)
{
  const all = Object.values(errors.AUTH_COPY).join(" ")
  check("never says escrow", /escrow/i.test(all), false)
  const timings = all.match(/\b\d+\s*(second|minute|hour|day)s?\b/gi) ?? []
  check("no time promises besides 10 minutes", timings, ["10 minutes"])
}

// ── Reading API answers ──────────────────────────────────────────────────────
check("login shape", errors.readSession({ access_token: "t", data: { role: "ARTISAN" } }), { accessToken: "t", role: "ARTISAN" })
check("nested shape", errors.readSession({ data: { access_token: "t", data: { role: "CUSTOMER" } } }), { accessToken: "t", role: "CUSTOMER" })
check("nested user key", errors.readSession({ data: { access_token: "t", user: { role: "ARTISAN" } } }), { accessToken: "t", role: "ARTISAN" })
check("no token", errors.readSession({}), { accessToken: null, role: null })
check("null body", errors.readSession(null), { accessToken: null, role: null })
check("resendAvailableAt in data", errors.readResendAvailableAt({ data: { resendAvailableAt: "2026-11-03T10:01:00Z" } }), "2026-11-03T10:01:00Z")
check("resendAvailableAt top level", errors.readResendAvailableAt({ resendAvailableAt: "x" }), "x")
check("resendAvailableAt missing", errors.readResendAvailableAt({ data: {} }), null)

// ── CSP allows Turnstile, and only where it needs to ────────────────────────
{
  const policy = csp.buildCsp({ apiUrl: "https://api.example.com/api/v1", dev: false })
  const get = (name) => policy.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${name} `))?.split(/\s+/).slice(1) ?? []
  check("script-src has Turnstile", get("script-src").includes("https://challenges.cloudflare.com"), true)
  check("frame-src has Turnstile", get("frame-src").includes("https://challenges.cloudflare.com"), true)
  check("connect-src unchanged", get("connect-src").includes("https://challenges.cloudflare.com"), false)
}

if (failures) {
  console.error(`\n${failures} auth v2 check(s) failed, ${passed} passed`)
  process.exit(1)
}
console.log(`auth v2 checks passed (${passed}): code input, sanitising, countdown, sign-up steps and draft, error copy, CSP`)
