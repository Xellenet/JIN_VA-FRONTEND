#!/usr/bin/env node
/**
 * Payout method save rules (Settings → Payments), run against the shipped
 * `src/lib/payout-rules.ts`: number normalisation, Ghana mobile money
 * prefixes per network, bank number length, typed-name rules and every
 * `payoutSaveState` state (when Save is on, and the line that says why not).
 *
 * Run: `npm run test:payout`. Same convention as the other scripts here: no
 * test runner, the real module through Node's type stripping, exit 1 on
 * failure, no network. All numbers and names below are made up.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const lib = (...parts) => pathToFileURL(join(process.cwd(), "src", "lib", ...parts)).href
const r = await import(lib("payout-rules.ts"))

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

// ── Normalisation ────────────────────────────────────────────────────────────
const momo = (raw) => r.normaliseAccountNumber("mobile_money", raw)
check("plain", momo("0240000000"), "0240000000")
check("+233", momo("+233240000000"), "0240000000")
check("233", momo("233240000000"), "0240000000")
check("00233", momo("00233240000000"), "0240000000")
check("233 with 0", momo("2330240000000"), "0240000000")
check("spaces", momo(" 024 000 0000 "), "0240000000")
check("dashes", momo("024-000-0000"), "0240000000")
check("+233 spaced", momo("+233 24 000 0000"), "0240000000")
check("too short stays", momo("02400"), "02400")
check("bank keeps digits", r.normaliseAccountNumber("bank", "1234 5678-90"), "1234567890")
check("bank no 233 rewrite", r.normaliseAccountNumber("bank", "233240000000"), "233240000000")

// ── Prefixes per network ─────────────────────────────────────────────────────
const n = (network, num) => r.checkAccountNumber("mobile_money", network, num)
for (const p of ["024", "025", "053", "054", "055", "059"]) check(`MTN ${p}`, n("MTN", `${p}0000000`), null)
for (const p of ["020", "050"]) check(`Telecel ${p}`, n("TELECEL", `${p}0000000`), null)
for (const p of ["026", "027", "056", "057"]) check(`AirtelTigo ${p}`, n("AT", `${p}0000000`), null)
// Ported numbers keep their original prefix, so any network's prefix is accepted;
// the Paystack lookup decides whether the wallet is on the chosen network.
check("MTN accepts a ported 020", n("MTN", "0200000000"), null)
check("Telecel accepts a ported 024", n("TELECEL", "0240000000"), null)
check("AirtelTigo accepts a ported 050", n("AT", "0500000000"), null)
check("Telecel rejects 031 (landline)", n("TELECEL", "0310000000"), "prefix")
check("MTN rejects 030 (landline)", n("MTN", "0300000000"), "prefix")
check("empty", n("MTN", ""), "empty")
check("9 digits", n("MTN", "024000000"), "format")
check("11 digits", n("MTN", "02400000000"), "format")
check("no leading 0", n("MTN", "2400000000"), "format")
check("letters", n("MTN", "024000000a"), "format")
check("no network yet: format only", n("", "0200000000"), null)
check("prefix message", r.numberIssueMessage("mobile_money", "MTN", "prefix"),
  "This isn't a Ghana mobile number. Mobile money numbers start with 02 or 05, like 0240000000.")

// ── Bank numbers ─────────────────────────────────────────────────────────────
const b = (num) => r.checkAccountNumber("bank", "", num)
check("bank 6", b("123456"), null)
check("bank 20", b("1".repeat(20)), null)
check("bank 5", b("12345"), "format")
check("bank 21", b("1".repeat(21)), "format")
check("bank letters", b("12345A"), "format")

// ── Typed names ──────────────────────────────────────────────────────────────
const nm = r.checkTypedName
check("two words", nm("Kofi Asante"), null)
check("trimmed", nm("  Kofi   Asante  "), null)
check("accents", nm("Adwoa Mensah-Ofori"), null)
check("apostrophe + dot", nm("Ama O’Neil Jr."), null)
check("accented letters", nm("Éfua Kwarténg"), null)
check("one word", nm("Kofi"), "one_word")
check("word + dot", nm("Kofi ."), "one_word")
check("digits", nm("Kofi Asante 2"), "chars")
check("symbols", nm("Kofi <Asante>"), "chars")
check("empty", nm("   "), "empty")
check("too long", nm(`Kofi ${"a".repeat(100)}`), "length")
check("tidy", r.tidyName("  Kofi   Asante "), "Kofi Asante")

// ── payoutSaveState ──────────────────────────────────────────────────────────
const key = r.lookupKeyFor("mobile_money", "MTN", "0240000000")
const base = {
  type: "mobile_money",
  network: "MTN",
  bankCode: "",
  accountNumber: "0240000000",
  lookup: { state: "idle" },
  lookupKey: key,
  confirmed: false,
  typedName: "",
}
const st = (over) => {
  const s = r.payoutSaveState({ ...base, ...over })
  return [s.canSave, s.block, s.reason]
}
check("no network", st({ network: "", lookupKey: "" }),
  [false, "network", "Choose your mobile money network to continue."])
check("empty number", st({ accountNumber: "", lookupKey: "" }),
  [false, "number", "Enter your MTN number to continue."])
check("invalid number", st({ accountNumber: "02400", lookupKey: "" }),
  [false, "number", "Enter a valid MTN number to continue."])
check("ported number goes to the lookup", st({ accountNumber: "0200000000", lookupKey: "" }),
  [false, "lookup_pending", "Checking the name on this account…"])
check("landline number", st({ accountNumber: "0300000000", lookupKey: "" }),
  [false, "number", "Enter a valid MTN number to continue."])
check("debouncing", st({}), [false, "lookup_pending", "Checking the name on this account…"])
check("in flight", st({ lookup: { state: "loading", key } }),
  [false, "lookup_pending", "Checking the name on this account…"])
check("found, unconfirmed", st({ lookup: { state: "found", key, name: "KOFI ASANTE" } }),
  [false, "confirm", "Confirm this is your account to continue."])
check("found, confirmed", st({ lookup: { state: "found", key, name: "KOFI ASANTE" }, confirmed: true }),
  [true, null, null])
check("found name sent", r.payoutSaveState({ ...base, lookup: { state: "found", key, name: "KOFI ASANTE" }, confirmed: true }).name,
  "KOFI ASANTE")
const staleKey = r.lookupKeyFor("mobile_money", "MTN", "0240000001")
check("stale found (other number)", st({ lookup: { state: "found", key: staleKey, name: "KOFI ASANTE" }, confirmed: true }),
  [false, "lookup_pending", "Checking the name on this account…"])
const otherNet = r.lookupKeyFor("mobile_money", "VOD", "0240000000")
check("stale found (other network)", st({ lookup: { state: "found", key: otherNet, name: "KOFI ASANTE" }, confirmed: true }),
  [false, "lookup_pending", "Checking the name on this account…"])
check("not found", st({ lookup: { state: "not_found", key, message: "x" } }),
  [false, "not_found", "Check the number: we couldn’t find this account."])
check("unavailable, no name", st({ lookup: { state: "unavailable", key, message: "x" } }),
  [false, "name", "Type the full name on the account to continue."])
check("unavailable, one word", st({ lookup: { state: "unavailable", key, message: "x" }, typedName: "Kofi" }),
  [false, "name", "Type the full name on the account to continue."])
check("unavailable, valid name", st({ lookup: { state: "unavailable", key, message: "x" }, typedName: " Kofi  Asante " }),
  [true, null, null])
const fallback = r.payoutSaveState({ ...base, lookup: { state: "unavailable", key, message: "x" }, typedName: " Kofi  Asante " })
check("fallback name tidy + unverified", [fallback.name, fallback.verifiedName], ["Kofi Asante", false])
check("saving", st({ lookup: { state: "found", key, name: "KOFI ASANTE" }, confirmed: true, isSaving: true }),
  [false, "saving", null])
const bankKey = r.lookupKeyFor("bank", "GCB", "1234567890")
const bank = { ...base, type: "bank", network: "", bankCode: "GCB", accountNumber: "1234567890", lookupKey: bankKey }
check("bank: no bank", r.payoutSaveState({ ...bank, bankCode: "" }).block, "bank")
check("bank: short", r.payoutSaveState({ ...bank, accountNumber: "123" }).reason, "Enter a valid account number to continue.")
check("bank: found + confirmed", r.payoutSaveState({ ...bank, lookup: { state: "found", key: bankKey, name: "KOFI ASANTE" }, confirmed: true }).canSave, true)

if (failures) {
  console.error(`\n${failures} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`payout rules: ${passed} checks passed`)
