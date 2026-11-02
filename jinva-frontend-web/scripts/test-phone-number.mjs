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
check("+234 paste national part", intl("+234 802 123 4567").national, "802 123 4567")
check("+233 0… national part", intl("+2330241234567").national, "24 123 4567")
check("00233 → GH", intl("00233 24 123 4567").country, "GH")
check("bare +233 → empty national", intl("+233").national, "")
check("+23 is still pending", intl("+23").kind, "pending")
check("incomplete keeps own spacing", intl("+233 24 123 456").national, "24 123 456")
check("incomplete 00 prefix", intl("00233 24 1").national, "24 1")
check("incomplete trunk 0 dropped", intl("+233 024 12").national, "24 12")
check("+233 024… complete", intl("+233 024 123 4567").national, "24 123 4567")
check("00233 0… complete", intl("00233 024 123 4567").national, "24 123 4567")
check("+234 0… dropped", intl("+234 0803 123 4567").national, "803 123 4567")
check("+225 0 kept (part of the number)", intl("+225 01 23 45 6789").national, "01 23 45 6789")
check("+225 incomplete 0 kept", intl("+225 07 1").national, "07 1")
check("+44 GG → unsupported", intl("+44 7911 123456").kind, "unsupported")
check("+44 unassigned → unsupported", intl("+44 7700 900123").kind, "unsupported")
check("national input → none", intl("024 123 4567").kind, "none")

// ── PH4/PH5: copy and formatting ─────────────────────────────────────────────
check("GH curated example", phone.getPhoneExample("GH"), "24 123 4567")
check("NG example has no trunk 0", phone.getPhoneExample("NG").startsWith("0"), false)
check("CI example keeps its 0", phone.getPhoneExample("CI").startsWith("0"), true)
check("empty on submit", phone.validatePhoneNumber("", "GH"), "Enter your phone number")
check("empty on blur", phone.validatePhoneNumber("  ", "GH", { requireValue: false }), null)
check("invalid copy", phone.validatePhoneNumber("123-456-7890", "GH"), "Enter a valid Ghana number, like 24 123 4567")
check("unsupported copy", phone.validatePhoneNumber("+44 7911 123456", "GH"), phone.PHONE_MESSAGES.unsupported)
check("blur format", phone.formatPhoneNational("0241234567", "GH"), "24 123 4567")
check("blur format NG", phone.formatPhoneNational("08031234567", "NG"), "803 123 4567")
check("blur format CI keeps 0", phone.formatPhoneNational("0123456789", "CI"), "01 23 45 6789")
check("blur leaves invalid alone", phone.formatPhoneNational("02412", "GH"), null)

// ── PH11: stored E.164 back into the field ───────────────────────────────────
check("split stored GH", JSON.stringify(phone.splitStoredPhone("+233241234567")), '{"country":"GH","national":"24 123 4567"}')
check("split stored NG", phone.splitStoredPhone("+2348031234567").country, "NG")
check("split legacy", JSON.stringify(phone.splitStoredPhone("020-000-0001")), '{"country":"GH","national":"20 000 0001"}')
check("standalone display keeps the trunk 0", phone.formatStoredPhone("+233241234567"), "024 123 4567")
check("standalone display of junk", phone.formatStoredPhone("12-34"), "12-34")

// ── Sign-up form v2: trunk 0 while typing ────────────────────────────────────
const strip = (raw, c, caret) => JSON.stringify(phone.stripTrunkZero(raw, c, caret))
check("trunk-0 countries", phone.SUPPORTED_PHONE_COUNTRIES.filter(phone.usesTrunkZero).join(","), "GH,LR,NG,SL")
check("0241234567 → 241234567", phone.stripTrunkZero("0241234567", "GH").value, "241234567")
check("024 123 4567 keeps spacing", phone.stripTrunkZero("024 123 4567", "GH").value, "24 123 4567")
check("(024) keeps the bracket", phone.stripTrunkZero("(024) 123-4567", "GH").value, "(24) 123-4567")
check("lone 0 waits", phone.stripTrunkZero("0", "GH").value, "0")
check("00 waits (international prefix)", phone.stripTrunkZero("00", "GH").value, "00")
check("NG 0803", phone.stripTrunkZero("0803", "NG").value, "803")
check("CI 07 kept", phone.stripTrunkZero("0712", "CI").value, "0712")
check("BJ 01 kept", phone.stripTrunkZero("0195", "BJ").value, "0195")
check("caret after the 0 moves back", strip("0241", "GH", 4), '{"value":"241","caret":3}')
check("caret before the 0 stays", strip("0241", "GH", 0), '{"value":"241","caret":0}')
check("stripped form still submits the same", phone.phoneToE164("24 123 4567", "GH"), "+233241234567")
check("2330241… national paste", phone.phoneToE164("2330241234567", "GH"), "+233241234567")
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
