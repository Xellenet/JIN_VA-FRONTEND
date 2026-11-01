/**
 * Saved payment methods (customer): the labels, the save rules for a mobile
 * money number, the charge status → screen mapping and the polling backoff.
 * Free of React and of value imports, so `scripts/test-saved-methods.mjs`
 * runs it directly with Node's type stripping.
 *
 * What is never here: a PIN. The customer approves a mobile money payment
 * with their PIN in their network's prompt on their own phone. The only code
 * the pay page ever asks for is Telecel's one-time code, and only when the
 * server says the charge needs it (`needs_otp`).
 */
import type { Lookup, NumberIssue } from "./payout-rules"

// ── API shapes ───────────────────────────────────────────────────────────────

/** Paystack's mobile money codes: MTN, Telecel (VOD), AirtelTigo (ATL). */
export type MomoCode = "MTN" | "VOD" | "ATL"

export interface SavedMobileMoney {
  network: MomoCode
  /** "024 ••• 4567": the full number never leaves the server. */
  numberMasked: string
  last4: string
  accountName: string
  nameVerified: boolean
}

export interface SavedCard {
  /** Lower case: "visa", "mastercard", "verve", or another brand. */
  brand: string
  last4: string
  expMonth: number
  expYear: number
  bank: string | null
  expired: boolean
}

export interface SavedPaymentMethod {
  id: number
  type: "mobile_money" | "card"
  isDefault: boolean
  createdAt: string
  mobileMoney: SavedMobileMoney | null
  card: SavedCard | null
}

export interface PaymentMethodList {
  methods: SavedPaymentMethod[]
  maxMethods: number
  /** False when the server can't store payment details right now. */
  canSave: boolean
}

export type ChargeStatus = "pending" | "needs_otp" | "succeeded" | "failed"
export type ChargeAction = "approve_on_phone" | "enter_otp" | "wait" | "pay_another_way" | null

export interface ChargeResult {
  reference: string
  jobId: number
  method: "mobile_money" | "card"
  status: ChargeStatus
  action: ChargeAction
  message: string | null
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const NETWORK_LABEL: Record<MomoCode, string> = {
  MTN: "MTN MoMo",
  VOD: "Telecel Cash",
  ATL: "AirtelTigo Money",
}

/** The settings form's network keys (shared with the artisan payout form) → Paystack codes. */
export const NETWORK_KEY_TO_CODE: Record<"MTN" | "TELECEL" | "AT", MomoCode> = {
  MTN: "MTN",
  TELECEL: "VOD",
  AT: "ATL",
}

export function networkLabel(code: string): string {
  return (NETWORK_LABEL as Record<string, string>)[code] ?? "Mobile money"
}

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  verve: "Verve",
  "american express": "American Express",
  amex: "American Express",
}

/** "visa" → "Visa"; an unknown brand is title-cased; nothing → "Card". */
export function brandLabel(brand: string | null | undefined): string {
  const b = (brand ?? "").trim().toLowerCase()
  if (!b) return "Card"
  return BRAND_LABEL[b] ?? b.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

/** 12, 2027 → "12/27". */
export function formatExpiry(month: number, year: number): string {
  const m = String(Math.max(1, Math.min(12, Math.trunc(month) || 1))).padStart(2, "0")
  const y = String(Math.trunc(year) % 100).padStart(2, "0")
  return `${m}/${y}`
}

/** "0244567890" → "024 ••• 7890". Anything that isn't 10 digits → "•••• 7890" or "••••". */
export function maskMomoNumber(number: string): string {
  const digits = (number ?? "").replace(/\D/g, "")
  if (digits.length === 10) return `${digits.slice(0, 3)} ••• ${digits.slice(-4)}`
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "••••"
}

/** "MTN MoMo · 024 ••• 4567" / "Visa ••4081". */
export function methodTitle(m: SavedPaymentMethod): string {
  if (m.type === "mobile_money" && m.mobileMoney) {
    return `${networkLabel(m.mobileMoney.network)} · ${m.mobileMoney.numberMasked}`
  }
  if (m.card) return `${brandLabel(m.card.brand)} ••${m.card.last4}`
  return m.type === "card" ? "Card" : "Mobile money"
}

/** The second line: the name on the wallet, or "expires 12/27" ("expired 03/25"). */
export function methodDetail(m: SavedPaymentMethod): string {
  if (m.type === "mobile_money" && m.mobileMoney) return m.mobileMoney.accountName
  if (m.card) {
    const exp = formatExpiry(m.card.expMonth, m.card.expYear)
    return m.card.expired ? `expired ${exp}` : `expires ${exp}`
  }
  return ""
}

/** The whole line, for screen readers and the list: "MTN MoMo · 024 ••• 4567 · KOFI ASANTE · Default". */
export function methodSummary(m: SavedPaymentMethod): string {
  return [methodTitle(m), methodDetail(m), m.isDefault ? "Default" : ""].filter(Boolean).join(" · ")
}

/** A method can be paid with unless it is a card past its expiry. */
export function isUsable(m: SavedPaymentMethod): boolean {
  return !(m.type === "card" && m.card?.expired)
}

/** The method to preselect: the default when usable, otherwise the newest usable one, otherwise none. */
export function pickInitialMethod(methods: readonly SavedPaymentMethod[]): SavedPaymentMethod | null {
  const usable = methods.filter(isUsable)
  const def = usable.find((m) => m.isDefault)
  if (def) return def
  const newest = [...usable].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  return newest[0] ?? null
}

/** Defaults first, then newest first. */
export function sortMethods(methods: readonly SavedPaymentMethod[]): SavedPaymentMethod[] {
  return [...methods].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
  })
}

// ── Adding a mobile money number (customer) ─────────────────────────────────

export type CustomerSaveBlock = "saving" | "full" | "network" | "number" | "lookup_pending" | "not_found" | "unavailable" | "confirm"

export interface CustomerMomoSaveInput {
  /** A network was chosen. */
  hasNetwork: boolean
  /** `checkAccountNumber` for the normalised number (null when valid). */
  numberIssue: NumberIssue | null
  /** The lookup for exactly this network and number (`lookupFor(...)`). */
  lookup: Lookup
  confirmed: boolean
  isSaving?: boolean
  /** The customer already has the most methods allowed. */
  full?: boolean
}

export interface CustomerMomoSaveState {
  canSave: boolean
  block: CustomerSaveBlock | null
  reason: string | null
}

/**
 * Save is on only with a network, a valid Ghana mobile number, the name the
 * lookup found for that exact number and "This is my account" ticked. Unlike
 * the artisan payout form there is no typed-name fallback: a customer can't
 * save a number whose name couldn't be checked, and is told to try later.
 */
export function customerMomoSaveState(input: CustomerMomoSaveInput): CustomerMomoSaveState {
  const off = (block: CustomerSaveBlock, reason: string | null): CustomerMomoSaveState => ({ canSave: false, block, reason })
  if (input.isSaving) return off("saving", null)
  if (input.full) return off("full", "You’ve saved the most payment methods allowed. Remove one to add another.")
  if (!input.hasNetwork) return off("network", "Choose your mobile money network to continue.")
  if (input.numberIssue) {
    return off("number", input.numberIssue === "empty" ? "Enter your mobile money number to continue." : "Enter a valid mobile money number to continue.")
  }
  switch (input.lookup.state) {
    case "idle":
    case "loading":
      return off("lookup_pending", "Checking the name on this number…")
    case "not_found":
      return off("not_found", "Check the number and network: we couldn’t find this wallet.")
    case "unavailable":
      return off("unavailable", "We can’t check the name right now. Try again in a few minutes.")
    case "found":
      if (!input.confirmed) return off("confirm", "Confirm this is your account to continue.")
      return { canSave: true, block: null, reason: null }
  }
}

// ── Paying ───────────────────────────────────────────────────────────────────

/** What the pay page shows for a charge result. */
export type ChargeView = "waiting_phone" | "confirming" | "otp" | "succeeded" | "failed_retry" | "failed_fallback"

export function chargeView(r: Pick<ChargeResult, "status" | "action">): ChargeView {
  switch (r.status) {
    case "succeeded":
      return "succeeded"
    case "needs_otp":
      return "otp"
    case "failed":
      return r.action === "pay_another_way" ? "failed_fallback" : "failed_retry"
    case "pending":
    default:
      return r.action === "approve_on_phone" ? "waiting_phone" : "confirming"
  }
}

/** Whether the page keeps asking the server for this view. */
export const isPollingView = (v: ChargeView): boolean => v === "waiting_phone" || v === "confirming"

export const DEFAULT_CHARGE_FAILED_MESSAGE = "Your payment didn’t go through. No money was taken. Try again or pay another way."

/** The server's message when it sent one (already safe to show), otherwise ours. */
export function chargeFailureMessage(r: Pick<ChargeResult, "message">): string {
  const m = (r.message ?? "").trim()
  return m || DEFAULT_CHARGE_FAILED_MESSAGE
}

/** Delays between status checks: quick at first, then every 10 s. */
const POLL_STEPS_MS = [2000, 3000, 4000, 5000, 8000]
export const POLL_MAX_DELAY_MS = 10_000
/** After this many checks the page stops on its own and offers "Check again". */
export const POLL_MAX_ATTEMPTS = 30

export function pollDelay(attempt: number): number {
  if (!Number.isFinite(attempt) || attempt < 0) return POLL_STEPS_MS[0]
  return POLL_STEPS_MS[Math.floor(attempt)] ?? POLL_MAX_DELAY_MS
}

export const shouldKeepPolling = (attempt: number): boolean => attempt < POLL_MAX_ATTEMPTS

/** Spaces and dashes removed; the code Telecel sends is 4 to 8 digits. */
export const tidyOtp = (raw: string): string => (raw ?? "").replace(/[\s-]+/g, "")
export const isValidOtp = (raw: string): boolean => /^\d{4,8}$/.test(tidyOtp(raw))

/** "Pay GH₵ 350.00 with MTN MoMo · 024 ••• 4567", given the formatted amount. */
export function payButtonLabel(amount: string, method: SavedPaymentMethod | null): string {
  return method ? `Pay ${amount} with ${methodTitle(method)}` : `Pay ${amount} on Paystack`
}
