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

// ── Idempotency key per press of Pay (src/lib/payment-intent.ts) ─────────────
const pi = await import(lib("payment-intent.ts"))
const memStore = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }
}
const throwing = { getItem() { throw new Error("blocked") }, setItem() { throw new Error("blocked") }, removeItem() { throw new Error("blocked") } }
check("key valid uuid", pi.isValidIdempotencyKey("3f2b8c1e-7d4a-4f6b-9a2c-1e5d7f9b3a10"), true)
check("key valid url-safe 16", pi.isValidIdempotencyKey("abcdefghij_-1234"), true)
check("key too short", pi.isValidIdempotencyKey("abc123"), false)
check("key too long", pi.isValidIdempotencyKey("a".repeat(65)), false)
check("key bad chars", pi.isValidIdempotencyKey("abcdefghij klmnop"), false)
check("key not a string", pi.isValidIdempotencyKey(null), false)
check("new key from randomUUID", pi.newIdempotencyKey({ randomUUID: () => "3f2b8c1e-7d4a-4f6b-9a2c-1e5d7f9b3a10" }), "3f2b8c1e-7d4a-4f6b-9a2c-1e5d7f9b3a10")
check("new key fallback getRandomValues", pi.isValidIdempotencyKey(pi.newIdempotencyKey({ getRandomValues: (a) => a.fill(7) })), true)
check("new key fallback Math.random", pi.isValidIdempotencyKey(pi.newIdempotencyKey({})), true)
check("new key randomUUID throws", pi.isValidIdempotencyKey(pi.newIdempotencyKey({ randomUUID: () => { throw new Error("insecure") } })), true)
check("new keys differ", pi.newIdempotencyKey() !== pi.newIdempotencyKey(), true)
check("storage key saved method", pi.intentStorageKey(35, 4), "jinva:pay-intent:35:m4")
check("storage key hosted", pi.intentStorageKey("35", "hosted"), "jinva:pay-intent:35:hosted")
{
  const st = memStore()
  let n = 0
  const make = () => `key_${String(++n).padStart(16, "0")}`
  const k1 = pi.getOrCreateIntentKey(st, 35, 4, make)
  check("create stores key", st.getItem("jinva:pay-intent:35:m4"), k1)
  check("retry/refresh reuses key", pi.getOrCreateIntentKey(st, 35, 4, make), k1)
  check("other method gets its own key", pi.getOrCreateIntentKey(st, 35, "hosted", make) !== k1, true)
  check("other job gets its own key", pi.getOrCreateIntentKey(st, 36, 4, make) !== k1, true)
  pi.clearIntentKey(st, 35, 4)
  check("clear removes stored key", st.getItem("jinva:pay-intent:35:m4"), null)
  check("new attempt after clear gets a new key", pi.getOrCreateIntentKey(st, 35, 4, make) !== k1, true)
  st.setItem("jinva:pay-intent:40:m1", "not valid")
  check("invalid stored key replaced", pi.isValidIdempotencyKey(pi.getOrCreateIntentKey(st, 40, 1, make)), true)
}
{
  const k1 = pi.getOrCreateIntentKey(throwing, 50, 2)
  check("storage failure still gives a key", pi.isValidIdempotencyKey(k1), true)
  check("storage failure reuses in memory", pi.getOrCreateIntentKey(throwing, 50, 2), k1)
  pi.clearIntentKey(throwing, 50, 2)
  check("storage failure clear works", pi.getOrCreateIntentKey(throwing, 50, 2) !== k1, true)
  check("no storage at all", pi.isValidIdempotencyKey(pi.getOrCreateIntentKey(null, 51, "hosted")), true)
}
check("error ALREADY_PAID", pi.payErrorKind({ status: 409, code: "ALREADY_PAID" }), "already_paid")
check("error PAYMENT_ATTEMPT_ACTIVE", pi.payErrorKind({ status: 409, code: "PAYMENT_ATTEMPT_ACTIVE" }), "attempt_active")
check("error IDEMPOTENCY_IN_PROGRESS", pi.payErrorKind({ status: 409, code: "IDEMPOTENCY_IN_PROGRESS" }), "in_progress")
check("error IDEMPOTENCY_KEY_REUSED", pi.payErrorKind({ status: 422, code: "IDEMPOTENCY_KEY_REUSED" }), "key_reused")
check("error IDEMPOTENCY_KEY_INVALID", pi.payErrorKind({ status: 400, code: "IDEMPOTENCY_KEY_INVALID" }), "key_invalid")
check("error network", pi.payErrorKind({ status: 0 }), "network")
check("error other", pi.payErrorKind({ status: 500 }), "other")
check("retry same press: network", pi.shouldRetrySamePress("network", 0), true)
check("retry same press: in progress", pi.shouldRetrySamePress("in_progress", 2), true)
check("retry same press: capped", pi.shouldRetrySamePress("in_progress", pi.SAME_PRESS_MAX_RETRIES), false)
check("no retry on reused key", pi.shouldRetrySamePress("key_reused", 0), false)
check("no retry on already paid", pi.shouldRetrySamePress("already_paid", 0), false)
check("retry delays", [0, 1, 2, 5].map(pi.samePressRetryDelay), [1000, 2000, 4000, 4000])
check("keep key only for unknown outcomes", ["network", "in_progress", "other", "already_paid", "key_reused"].map(pi.keepKeyAfter), [true, true, false, false, false])

// ── Job payment state and copy ───────────────────────────────────────────────
check("paid statuses", ["PENDING", "HELD", "RELEASED", "REFUNDED", "CANCELLED"].map(pi.isPaidStatus), [false, true, true, true, false])
const attempt = (over = {}) => ({ reference: "jinva-ch-7-1", jobId: 35, kind: "mobile_money", status: "pending", action: "approve_on_phone", message: null, paymentMethodId: 4, startedAt: "2026-11-01T10:00:00Z", expiresAt: "2026-11-01T10:10:00Z", authorizationUrl: null, ...over })
check("attempt as charge momo", pi.attemptAsCharge(attempt()), { reference: "jinva-ch-7-1", jobId: 35, method: "mobile_money", status: "pending", action: "approve_on_phone", message: null })
check("attempt as charge otp", pi.attemptAsCharge(attempt({ status: "needs_otp" })).action, "enter_otp")
check("attempt as charge card", pi.attemptAsCharge(attempt({ kind: "card" })).action, "wait")
check("hosted attempt is not a charge", pi.attemptAsCharge(attempt({ kind: "hosted", status: "hosted_open" })), null)
check("active message from server", pi.attemptActiveMessage(attempt(), " Server says. "), "Server says.")
check("active message fallback", pi.attemptActiveMessage(attempt({ kind: "hosted" }), ""), pi.ATTEMPT_ACTIVE_FALLBACK.hosted)
check("refund note with label", pi.duplicateRefundNote({ amount: 150, method: "mobile_money", methodLabel: "MTN MoMo" }), "You were charged twice for this job. We've refunded the extra payment of GH₵ 150.00 to your MTN MoMo.")
check("refund note fallback", pi.duplicateRefundNote({ amount: 1234.5, method: "hosted", methodLabel: null }), "You were charged twice for this job. We've refunded the extra payment of GH₵ 1,234.50 to your original payment method.")
check("refund note never promises time", /day|hour|minute|soon|shortly/i.test(pi.duplicateRefundNote({ amount: 1, method: "card", methodLabel: null })), false)
check("visible refunds", pi.visibleDuplicateRefunds(["pending", "requested", "processed", "failed"].map((status) => ({ status }))).map((r) => r.status), ["requested", "processed"])
check("visible refunds none", pi.visibleDuplicateRefunds(undefined), [])

// ── Other tabs ───────────────────────────────────────────────────────────────
check("channel name", pi.paySyncChannelName(35), "jinva-payment-35")
check("sync paid", pi.parsePaySync({ type: "paid", jobId: 35, amount: 150 }, 35), { type: "paid", jobId: 35, amount: 150 })
check("sync from storage string", pi.parsePaySync(JSON.stringify({ type: "refresh", jobId: "35", at: 1 }), 35), { type: "refresh", jobId: 35 })
check("sync other job ignored", pi.parsePaySync({ type: "paid", jobId: 36 }, 35), null)
check("sync junk ignored", [pi.parsePaySync("{oops", 35), pi.parsePaySync(null, 35), pi.parsePaySync({ type: "x", jobId: 35 }, 35)], [null, null, null])
check("sync attempt", pi.parsePaySync({ type: "attempt", jobId: 35, attempt: attempt() }, 35).attempt.reference, "jinva-ch-7-1")

if (failures) {
  console.error(`\n${failures} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`saved payment methods: ${passed} checks passed`)
