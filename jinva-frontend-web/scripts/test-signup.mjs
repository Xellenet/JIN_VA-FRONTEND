#!/usr/bin/env node
/**
 * Sign-up form v2: the password generator and checklist, username sanitising
 * and the phone trunk-0 rule, run against the shipped modules
 * (`src/lib/password-rules.ts`, `src/lib/username.ts`, `src/lib/phone.ts`).
 *
 * Run: `npm run test:signup` (part of `npm run verify`). Same convention as
 * `scripts/test-phone-number.mjs`: no test runner, the real modules imported
 * through Node's type stripping, exit 1 on failure. No network.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const lib = (...parts) => pathToFileURL(join(process.cwd(), "src", "lib", ...parts)).href
const rules = await import(lib("password-rules.ts"))
const username = await import(lib("username.ts"))
const phone = await import(lib("phone.ts"))

let failures = 0
const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures++
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// ── The rule itself: identical to the backend's PASSWORD_REGEX ──────────────
const BACKEND_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,128}$/
check("pattern source matches the backend", rules.PASSWORD_PATTERN.source, BACKEND_PASSWORD_REGEX.source)
check("symbols are exactly ! @ # $ % ^ & *", rules.PASSWORD_SYMBOLS, "!@#$%^&*")
check("symbols text lists them all", rules.PASSWORD_SYMBOLS_TEXT, "! @ # $ % ^ & *")
check(
  "passwordrules attribute",
  rules.PASSWORD_RULES_ATTRIBUTE,
  "minlength: 8; maxlength: 128; required: lower; required: upper; required: digit; required: [!@#$%^&*]; allowed: lower, upper, digit, [!@#$%^&*];",
)

// ── Generator: 1,000 suggestions ─────────────────────────────────────────────
const allowed = new Set(rules.PASSWORD_ALPHABET)
check("alphabet size (26+26+10+8)", allowed.size, 70)
const seen = new Map()
let generated = 0
for (let i = 0; i < 1000; i++) {
  const p = rules.generateStrongPassword()
  generated++
  if (p.length !== 16) check(`generation ${i} length`, p.length, 16)
  if (!rules.PASSWORD_PATTERN.test(p)) check(`generation ${i} passes PASSWORD_PATTERN (${p})`, false, true)
  if (!BACKEND_PASSWORD_REGEX.test(p)) check(`generation ${i} passes the backend regex`, false, true)
  for (const c of p) {
    if (!allowed.has(c)) check(`generation ${i} uses only the allowed set`, c, "an allowed character")
    seen.set(c, (seen.get(c) ?? 0) + 1)
  }
  if (!rules.passwordRuleStates(p).every((r) => r.met)) check(`generation ${i} meets every checklist rule`, false, true)
}
check("1,000 generations ran", generated, 1000)
// 16,000 characters over 70: each is expected ~229 times. Every one must turn
// up, and none should be wildly over- or under-represented.
check("every allowed character appears", seen.size, 70)
const counts = [...seen.values()]
check("no character below 120 or above 360", counts.every((n) => n >= 120 && n <= 360), true)
check("1,000 suggestions are all different", new Set(Array.from({ length: 1000 }, () => rules.generateStrongPassword())).size, 1000)

// Rejection sampling: a value at or above the largest multiple of n is redrawn,
// never folded back with `%` (which would bias the low characters).
{
  const values = [0xffffffff, 0xfffffffe, 5]
  const calls = []
  const fake = (array) => {
    const next = values.length ? values.shift() : 0
    calls.push(next)
    array[0] = next
    return array
  }
  // With only the fixed values then zeros, the first pick (lower-case, n=26)
  // must skip the two too-large draws and take 5 → "f".
  const p = rules.generateStrongPassword(fake)
  check("biased draws are rejected, not folded", calls.slice(0, 3).join(","), `${0xffffffff},${0xfffffffe},5`)
  check("fake source still yields a valid password", rules.PASSWORD_PATTERN.test(p), true)
  check("fake source output length", p.length, 16)
}

// ── Checklist rules ──────────────────────────────────────────────────────────
const states = (p) => Object.fromEntries(rules.passwordRuleStates(p).map((r) => [r.id, r.met]))
const labels = (p) => rules.passwordRuleStates(p).map((r) => r.label)
check("empty: nothing met", JSON.stringify(states("")), '{"length":false,"upper":false,"lower":false,"digit":false,"symbol":false}')
check(
  "labels, in order",
  labels("").join(" | "),
  "8 or more characters | An upper-case letter | A lower-case letter | A number | One of these symbols: ! @ # $ % ^ & *",
)
check("partial: abc1", JSON.stringify(states("abc1")), '{"length":false,"upper":false,"lower":true,"digit":true,"symbol":false}')
check("partial: Abcdefgh", JSON.stringify(states("Abcdefgh")), '{"length":true,"upper":true,"lower":true,"digit":false,"symbol":false}')
check("all met: Strong@123", Object.values(states("Strong@123")).every(Boolean), true)
check("disallowed char adds the rule", labels("Strong@123 ").at(-1), "Only letters, numbers and those symbols")
check("disallowed rule is unmet", states("Strong@123-").allowed, false)
check("a dash is not one of our symbols", states("Strong-123").symbol, false)
check("é is not a letter we allow", states("Strongé@123").allowed, false)
check("no 'allowed' row without a bad character", "allowed" in states("Strong@123"), false)
check("129 characters: length unmet", states("Aa1!" + "a".repeat(125)).length, false)
check("129 characters: label says the max", labels("Aa1!" + "a".repeat(125))[0], "128 characters or fewer")
check("128 characters: length met", states("Aa1!" + "a".repeat(124)).length, true)
// The checklist and the submit rule can never disagree.
for (const p of ["", "abc", "Strong@123", "strong@123", "STRONG@123", "Strong@abc", "Strong123", "Str@1", "Strong@123 ", "Strong_123!", "Aa1!" + "a".repeat(124), "Aa1!" + "a".repeat(125), "Pässword@1"]) {
  check(`checklist all-met ⇔ isStrongPassword (${JSON.stringify(p).slice(0, 24)})`, rules.passwordRuleStates(p).every((r) => r.met), rules.isStrongPassword(p))
}

// ── Usernames ────────────────────────────────────────────────────────────────
const san = (raw, caret) => JSON.stringify(username.sanitizeUsername(raw, caret))
check("typed space removed", username.sanitizeUsername("ama ").value, "ama")
check("pasted spaces removed", username.sanitizeUsername(" ama  mensah ").value, "amamensah")
check("tabs and newlines removed", username.sanitizeUsername("ama\tmen\nsah").value, "amamensah")
check("caret after a removed space moves back", san("ama m", 4), '{"value":"amam","caret":3}')
check("caret before a removed space stays", san("am a", 1), '{"value":"ama","caret":1}')
check("caret mid-paste", san("a b c|", 5), '{"value":"abc|","caret":3}')
check("nothing to remove: caret unchanged", san("ama", 2), '{"value":"ama","caret":2}')
check("hint", username.USERNAME_HINT, "Letters, numbers, dots and underscores")
const BACKEND_USERNAME_REGEX = /^(?!\.)(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{3,30}$/
check("pattern matches the backend", username.USERNAME_PATTERN.source, BACKEND_USERNAME_REGEX.source)
for (const ok of ["abc", "ama.mensah", "ama_mensah", "_ama_", "Ama2026", "a".repeat(30)]) {
  check(`valid ${ok.slice(0, 12)}`, username.validateUsername(ok, true), null)
}
const M = username.USERNAME_MESSAGES
for (const [bad, message] of [
  ["", M.required],
  ["ab", M.tooShort],
  ["a".repeat(31), M.tooLong],
  ["ama-mensah", M.characters],
  ["ama@x", M.characters],
  [".ama", M.edgeDot],
  ["ama.", M.edgeDot],
  ["ama..mensah", M.doubleDot],
]) {
  check(`invalid ${JSON.stringify(bad).slice(0, 14)}`, username.validateUsername(bad, true), message)
  check(`agrees with the backend: ${JSON.stringify(bad).slice(0, 14)}`, BACKEND_USERNAME_REGEX.test(bad), false)
}
check("empty is fine on blur", username.validateUsername("", false), null)

// ── Phone: trunk 0 after the calling code ────────────────────────────────────
check("trunk-0 countries", phone.SUPPORTED_PHONE_COUNTRIES.filter(phone.usesTrunkZero).join(","), "GH,LR,NG,SL")
check("0241234567 with +233 → 241234567", phone.stripTrunkZero("0241234567", "GH").value, "241234567")
check("…and shows 24 123 4567 on blur", phone.formatPhoneNational("241234567", "GH"), "24 123 4567")
check("0241234567 blur → 24 123 4567", phone.formatPhoneNational("0241234567", "GH"), "24 123 4567")
check("+233 024… → 24 123 4567", phone.readInternationalInput("+233 024 123 4567").national, "24 123 4567")
check("+2330241… (incomplete) → 241…", phone.readInternationalInput("+2330241").national, "241")
check("2330241234567 blur → 24 123 4567", phone.formatPhoneNational("2330241234567", "GH"), "24 123 4567")
check("E.164 unchanged", phone.phoneToE164("0241234567", "GH"), "+233241234567")
check("E.164 unchanged after strip", phone.phoneToE164("241234567", "GH"), "+233241234567")
check("E.164 from +233 024…", phone.phoneToE164("+233 024 123 4567", "GH"), "+233241234567")
check("Côte d'Ivoire keeps its 0", phone.stripTrunkZero("0123456789", "CI").value, "0123456789")
check("Côte d'Ivoire E.164", phone.phoneToE164("01 23 45 6789", "CI"), "+2250123456789")
check("2330241234567 typed bare → 24 123 4567", phone.nationalFromBareCallingCode("2330241234567", "GH"), "24 123 4567")
check("233241234567 typed bare → 24 123 4567", phone.nationalFromBareCallingCode("233241234567", "GH"), "24 123 4567")
check("incomplete 23302 left alone", phone.nationalFromBareCallingCode("23302", "GH"), null)
check("plain national left alone", phone.nationalFromBareCallingCode("0241234567", "GH"), null)
check("another country's code left alone", phone.nationalFromBareCallingCode("2348031234567", "GH"), null)
check("+233… is not bare", phone.nationalFromBareCallingCode("+233241234567", "GH"), null)
check("00 is left for an international prefix", phone.stripTrunkZero("00", "GH").value, "00")

if (failures) {
  console.error(`\n${failures} sign-up check(s) failed`)
  process.exit(1)
}
console.log("sign-up checks passed (1,000 generated passwords, checklist, usernames, trunk 0)")
