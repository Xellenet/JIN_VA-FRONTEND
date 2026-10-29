#!/usr/bin/env node
/**
 * PH8 (google-signup-prefill): runs the phone fixture table shared with the
 * backend against the shipped `src/lib/phone.ts`, plus the LOC4 region
 * matching rules from `src/lib/regions/normalise.ts`.
 *
 * Run: `npm run test:phone` (part of `npm run verify`). Same convention as
 * `scripts/test-safe-internal-redirect.mjs`: no test runner, the real modules
 * imported through Node's type stripping, exit 1 on failure. No network.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const lib = (...parts) => pathToFileURL(join(process.cwd(), "src", "lib", ...parts)).href
const phone = await import(lib("phone.ts"))
const { PHONE_NUMBER_FIXTURES } = await import(lib("phone-number.fixtures.ts"))
const { matchRegion } = await import(lib("regions", "normalise.ts"))

let failures = 0
const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures++
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// ── the shared table (identical rows run in JIN_VA-BACKEND) ───────────────────
for (const { input, country, expected, note } of PHONE_NUMBER_FIXTURES) {
  check(`phoneToE164(${JSON.stringify(input)}, ${country}) [${note}]`, phone.phoneToE164(input, country), expected)
  // The field's own verdict must agree with the submitted value.
  check(
    `validatePhoneNumber(${JSON.stringify(input)}, ${country}) is ok [${note}]`,
    phone.validatePhoneNumber(input, country) === null,
    expected !== null,
  )
}

// ── PH1: the picker list ─────────────────────────────────────────────────────
const { pinned, others } = phone.getPhoneCountryOptions()
check("pinned country", pinned.country, "GH")
check("pinned calling code", pinned.callingCode, "233")
check("list size", others.length + 1, 16)
check("list has no Ghana twice", others.some((o) => o.country === "GH"), false)
check(
  "others sorted by name",
  others.map((o) => o.name).join("|"),
  [...others.map((o) => o.name)].sort((a, b) => a.localeCompare(b, "en")).join("|"),
)
check("GH flag", phone.getCountryFlag("GH"), "\u{1F1EC}\u{1F1ED}")

// ── PH3: paste / autofill switches the country ───────────────────────────────
const intl = (raw) => phone.readInternationalInput(raw)
check("+234 paste → NG", intl("+234 802 123 4567").kind === "supported" && intl("+234 802 123 4567").country, "NG")
check("+234 paste national part", intl("+234 802 123 4567").national, "0802 123 4567")
check("+233 0… national part", intl("+2330241234567").national, "024 123 4567")
check("00233 → GH", intl("00233 24 123 4567").country, "GH")
check("bare +233 → empty national", intl("+233").national, "")
check("+23 is still pending", intl("+23").kind, "pending")
check("incomplete keeps own spacing", intl("+233 24 123 456").national, "24 123 456")
check("incomplete 00 prefix", intl("00233 24 1").national, "24 1")
check("incomplete trunk 0 kept", intl("+233 024 12").national, "024 12")
check("+44 GG → unsupported", intl("+44 7911 123456").kind, "unsupported")
check("+44 unassigned → unsupported", intl("+44 7700 900123").kind, "unsupported")
check("national input → none", intl("024 123 4567").kind, "none")

// ── PH4/PH5: copy and formatting ─────────────────────────────────────────────
check("GH curated example", phone.getPhoneExample("GH"), "024 123 4567")
check("empty on submit", phone.validatePhoneNumber("", "GH"), "Enter your phone number")
check("empty on blur", phone.validatePhoneNumber("  ", "GH", { requireValue: false }), null)
check("invalid copy", phone.validatePhoneNumber("123-456-7890", "GH"), "Enter a valid Ghana number, like 024 123 4567")
check("unsupported copy", phone.validatePhoneNumber("+44 7911 123456", "GH"), phone.PHONE_MESSAGES.unsupported)
check("blur format", phone.formatPhoneNational("0241234567", "GH"), "024 123 4567")
check("blur leaves invalid alone", phone.formatPhoneNational("02412", "GH"), null)

// ── PH11: stored E.164 back into the field ───────────────────────────────────
check("split stored GH", JSON.stringify(phone.splitStoredPhone("+233241234567")), '{"country":"GH","national":"024 123 4567"}')
check("split stored NG", phone.splitStoredPhone("+2348031234567").country, "NG")
check("split legacy", JSON.stringify(phone.splitStoredPhone("020-000-0001")), '{"country":"GH","national":"020 000 0001"}')
check("split empty", phone.splitStoredPhone(null).national, "")

// ── PH11: what an edit form sends ────────────────────────────────────────────
const update = (...args) => JSON.stringify(phone.phoneUpdateFor(...args))
check("unchanged → nothing sent", update("+233241234567", "024 123 4567", "GH"), "{}")
check("unconvertible legacy left alone", update("12-34", "12-34", "GH"), "{}")
check("edited → E.164 sent", update("+233241234567", "0551234567", "GH"), '{"phoneNumber":"+233551234567"}')
check("same number retyped → nothing sent", update("+233241234567", "+233 24 123 4567", "GH"), "{}")
check("country change → re-sent", update("+233241234567", "0803 123 4567", "NG"), '{"phoneNumber":"+2348031234567"}')
check("cleared → required", update("+233241234567", "", "GH"), JSON.stringify({ error: phone.PHONE_MESSAGES.required }))
check("invalid edit → error", update("+233241234567", "02412", "GH"), JSON.stringify({ error: phone.PHONE_MESSAGES.invalid("GH") }))
check("first phone on a phoneless account", update(null, "0241234567", "GH"), '{"phoneNumber":"+233241234567"}')

// ── LOC4/LOC5: region matching ───────────────────────────────────────────────
const GH = ["Ashanti", "Greater Accra", "Upper East", "Upper West"]
check("Photon suffix", matchRegion("Greater Accra Region", GH), "Greater Accra")
check("case-insensitive", matchRegion("greater accra", GH), "Greater Accra")
check("diacritics + spaces", matchRegion("  Ashánti  ", GH), "Ashanti")
check("State suffix", matchRegion("Ashanti State", GH), "Ashanti")
check("no partial match", matchRegion("Upper", GH), null)
check("no guess", matchRegion("Kumasi", GH), null)
check("null", matchRegion(null, GH), null)

if (failures) {
  console.error(`\n${failures} phone/region check(s) failed`)
  process.exit(1)
}
console.log(`phone/region checks passed (${PHONE_NUMBER_FIXTURES.length} shared fixtures)`)
