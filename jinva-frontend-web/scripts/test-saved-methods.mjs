#!/usr/bin/env node
/**
 * Saved payment methods (customer): labels and masking, the default-method
 * pick, the "Add mobile money number" save rules, the charge status → screen
 * mapping, the polling backoff and the Telecel OTP check, run against the
 * shipped `src/lib/saved-payment-methods.ts`.
 *
 * Run: `npm run test:saved-methods`. Same convention as the other scripts
 * here: no test runner, the real module through Node's type stripping,
 * exit 1 on failure, no network. All names, numbers and cards are made up.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const lib = (...parts) => pathToFileURL(join(process.cwd(), "src", "lib", ...parts)).href
const s = await import(lib("saved-payment-methods.ts"))

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

const momo = (over = {}) => ({
  id: 1,
  type: "mobile_money",
  isDefault: true,
  createdAt: "2026-10-01T10:00:00Z",
  mobileMoney: { network: "MTN", numberMasked: "024 ••• 4567", last4: "4567", accountName: "KOFI ASANTE", nameVerified: true },
  card: null,
  ...over,
})
const card = (over = {}, cardOver = {}) => ({
  id: 2,
  type: "card",
  isDefault: false,
  createdAt: "2026-10-05T10:00:00Z",
  mobileMoney: null,
  card: { brand: "visa", last4: "4081", expMonth: 12, expYear: 2027, bank: null, expired: false, ...cardOver },
  ...over,
})

// ── Labels ───────────────────────────────────────────────────────────────────
check("network MTN", s.networkLabel("MTN"), "MTN MoMo")
check("network VOD", s.networkLabel("VOD"), "Telecel Cash")
check("network ATL", s.networkLabel("ATL"), "AirtelTigo Money")
check("network unknown", s.networkLabel("XYZ"), "Mobile money")
check("key → code", s.NETWORK_KEY_TO_CODE, { MTN: "MTN", TELECEL: "VOD", AT: "ATL" })
check("brand visa", s.brandLabel("visa"), "Visa")
check("brand padded", s.brandLabel(" mastercard "), "Mastercard")
check("brand unknown", s.brandLabel("discover"), "Discover")
check("brand none", s.brandLabel(null), "Card")
check("expiry", s.formatExpiry(12, 2027), "12/27")
check("expiry pads", s.formatExpiry(3, 2030), "03/30")
check("mask 10", s.maskMomoNumber("0244567890"), "024 ••• 7890")
check("mask short", s.maskMomoNumber("12345"), "•••• 2345")
check("mask none", s.maskMomoNumber(""), "••••")
check("momo title", s.methodTitle(momo()), "MTN MoMo · 024 ••• 4567")
check("card title", s.methodTitle(card()), "Visa ••4081")
check("momo detail", s.methodDetail(momo()), "KOFI ASANTE")
check("card detail", s.methodDetail(card()), "expires 12/27")
check("expired detail", s.methodDetail(card({}, { expired: true, expMonth: 3, expYear: 2025 })), "expired 03/25")
check("summary", s.methodSummary(momo()), "MTN MoMo · 024 ••• 4567 · KOFI ASANTE · Default")
check("summary card", s.methodSummary(card()), "Visa ••4081 · expires 12/27")

// ── Picking and sorting ──────────────────────────────────────────────────────
check("usable momo", s.isUsable(momo()), true)
check("expired card unusable", s.isUsable(card({}, { expired: true })), false)
check("pick default", s.pickInitialMethod([card(), momo()])?.id, 1)
check("pick newest usable when default expired", s.pickInitialMethod([card({ isDefault: true }, { expired: true }), momo({ id: 3, isDefault: false })])?.id, 3)
check("pick none", s.pickInitialMethod([]), null)
check("sort default first then newest", s.sortMethods([card({ id: 5, createdAt: "2026-10-09T00:00:00Z" }), card(), momo()]).map((m) => m.id), [1, 5, 2])

// ── Add mobile money: save rules (no typed-name fallback for customers) ──────
const base = { hasNetwork: true, numberIssue: null, lookup: { state: "found", key: "k", name: "KOFI ASANTE" }, confirmed: true }
check("save ok", s.customerMomoSaveState(base), { canSave: true, block: null, reason: null })
check("saving", s.customerMomoSaveState({ ...base, isSaving: true }).block, "saving")
check("full", s.customerMomoSaveState({ ...base, full: true }).block, "full")
check("no network", s.customerMomoSaveState({ ...base, hasNetwork: false }).block, "network")
check("empty number", s.customerMomoSaveState({ ...base, numberIssue: "empty" }).reason, "Enter your mobile money number to continue.")
check("bad number", s.customerMomoSaveState({ ...base, numberIssue: "prefix" }).reason, "Enter a valid mobile money number to continue.")
check("lookup idle", s.customerMomoSaveState({ ...base, lookup: { state: "idle" } }).block, "lookup_pending")
check("lookup loading", s.customerMomoSaveState({ ...base, lookup: { state: "loading", key: "k" } }).block, "lookup_pending")
check("not found", s.customerMomoSaveState({ ...base, lookup: { state: "not_found", key: "k", message: "x" } }).block, "not_found")
check("unavailable blocks (no typed name)", s.customerMomoSaveState({ ...base, lookup: { state: "unavailable", key: "k", message: "x" } }).canSave, false)
check("not confirmed", s.customerMomoSaveState({ ...base, confirmed: false }).block, "confirm")

// ── Charge status → screen ───────────────────────────────────────────────────
check("pending phone", s.chargeView({ status: "pending", action: "approve_on_phone" }), "waiting_phone")
check("pending wait", s.chargeView({ status: "pending", action: "wait" }), "confirming")
check("pending null", s.chargeView({ status: "pending", action: null }), "confirming")
check("needs otp", s.chargeView({ status: "needs_otp", action: "enter_otp" }), "otp")
check("succeeded", s.chargeView({ status: "succeeded", action: null }), "succeeded")
check("failed retry", s.chargeView({ status: "failed", action: null }), "failed_retry")
check("failed fallback", s.chargeView({ status: "failed", action: "pay_another_way" }), "failed_fallback")
check("polling views", ["waiting_phone", "confirming", "otp", "succeeded", "failed_retry"].map(s.isPollingView), [true, true, false, false, false])
check("failure message from server", s.chargeFailureMessage({ message: "Insufficient funds" }), "Insufficient funds")
check("failure message default", s.chargeFailureMessage({ message: "  " }), s.DEFAULT_CHARGE_FAILED_MESSAGE)

// ── Polling backoff and cap ──────────────────────────────────────────────────
check("backoff", [0, 1, 2, 3, 4, 5, 20].map(s.pollDelay), [2000, 3000, 4000, 5000, 8000, 10000, 10000])
check("backoff bad input", s.pollDelay(-1), 2000)
check("backoff never above max", Math.max(...Array.from({ length: 50 }, (_, i) => s.pollDelay(i))) <= s.POLL_MAX_DELAY_MS, true)
check("keeps polling under cap", s.shouldKeepPolling(s.POLL_MAX_ATTEMPTS - 1), true)
check("stops at cap", s.shouldKeepPolling(s.POLL_MAX_ATTEMPTS), false)

// ── Telecel OTP ──────────────────────────────────────────────────────────────
check("otp tidy", s.tidyOtp(" 123 456 "), "123456")
check("otp 6", s.isValidOtp("123456"), true)
check("otp 4", s.isValidOtp("1234"), true)
check("otp 3", s.isValidOtp("123"), false)
check("otp 9", s.isValidOtp("123456789"), false)
check("otp letters", s.isValidOtp("12a456"), false)

// ── Pay button ───────────────────────────────────────────────────────────────
check("pay with saved", s.payButtonLabel("GH₵ 350.00", momo()), "Pay GH₵ 350.00 with MTN MoMo · 024 ••• 4567")
check("pay hosted", s.payButtonLabel("GH₵ 350.00", null), "Pay GH₵ 350.00 on Paystack")

if (failures) {
  console.error(`\n${failures} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`saved payment methods: ${passed} checks passed`)
