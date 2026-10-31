/**
 * Artisan Earnings and Analytics: the pure rules behind
 * `/dashboard/artisan/earnings` and `/dashboard/artisan/analytics`
 * (findings H7, C1; api-contract B2, B3).
 *
 * PURE MODULE: no runtime imports, so a Node script can load it with
 * `--experimental-strip-types`. Every artisan-facing word for a payment's
 * stage lives here, in the artisan's own terms: a client "pays", the artisan
 * "gets paid". Never "escrow", never a promise about when money arrives.
 */

// ── Stages (B2) ──────────────────────────────────────────────────────────────

export type EarningsStage =
  | "awaiting_payment"
  | "held"
  | "on_the_way"
  | "needs_action"
  | "paid"
  | "refunded"
  | "not_paid"

export const EARNINGS_STAGES: readonly EarningsStage[] = [
  "awaiting_payment",
  "held",
  "on_the_way",
  "needs_action",
  "paid",
  "refunded",
  "not_paid",
]

const STAGE_LABELS: Record<EarningsStage, string> = {
  awaiting_payment: "Client hasn't paid yet",
  held: "Waiting for sign-off",
  on_the_way: "On its way",
  needs_action: "Needs your action",
  paid: "Paid",
  refunded: "Refunded to client",
  not_paid: "Not paid",
}

export function stageLabel(stage: string): string {
  return (STAGE_LABELS as Record<string, string>)[stage] ?? "Unknown"
}

/** The stage filter's options, in the order an artisan thinks about money. */
export const STAGE_FILTERS: readonly { value: EarningsStage | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_action", label: "Needs your action" },
  { value: "held", label: "Waiting for sign-off" },
  { value: "on_the_way", label: "On its way" },
  { value: "paid", label: "Paid" },
  { value: "refunded", label: "Refunded" },
  { value: "awaiting_payment", label: "Not paid yet" },
  { value: "not_paid", label: "Not paid" },
]

const STAGE_SET = new Set<string>(EARNINGS_STAGES)

/** One stage from the URL, or "all" for anything not allowed. */
export function parseStage(value: string | null | undefined): EarningsStage | "all" {
  return typeof value === "string" && STAGE_SET.has(value) ? (value as EarningsStage) : "all"
}

/**
 * The raw PaymentStatus as an artisan reads it. The shared badge map calls
 * HELD "Withheld", which is the customer's word; for the artisan, held money
 * is normal: the client has paid and the job is waiting for sign-off.
 */
export function artisanStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Client hasn't paid yet"
    case "HELD":
      return "Waiting for sign-off"
    case "PENDING_TRANSFER":
    case "TRANSFER_FAILED":
      return "Needs your action"
    case "RELEASED":
      return "Paid"
    case "REFUNDED":
      return "Refunded to client"
    case "CANCELLED":
    case "FAILED":
      return "Not paid"
    default:
      return "Unknown"
  }
}

/** What the "Your payout" cell says when `payout` is null. */
export function noPayoutText(stage: string): string {
  if (stage === "refunded") return "Refunded to client"
  if (stage === "awaiting_payment") return "Awaiting client payment"
  return "Not paid"
}

/** `failureReason` code → a sentence the artisan can act on. */
export function failureReasonText(code: string | null | undefined): string | null {
  if (code === "no_payout_method") return "There's no payout method on your account, so we couldn't send it."
  if (code === "transfer_failed")
    return "The transfer to your payout account didn't go through. Check your payout details, then retry."
  return null
}

/** The one accurate payout-timing sentence (no arrival promise). */
export const PAYOUT_TIMING =
  "We start your payout when the client confirms the job is done, or 48 hours after you mark it done if they don't respond."

/** Where every "Add / Update payout details" link goes. */
export const PAYOUT_SETTINGS_HREF = "/dashboard/artisan/settings?tab=payouts#payout-method"

// ── Periods ──────────────────────────────────────────────────────────────────

export type EarningsPeriod = "30d" | "90d" | "12m" | "all"
export type AnalyticsRange = "7d" | "30d" | "90d" | "12m" | "all"

export const ANALYTICS_RANGES: readonly { value: AnalyticsRange; short: string; full: string }[] = [
  { value: "7d", short: "7 days", full: "Last 7 days" },
  { value: "30d", short: "30 days", full: "Last 30 days" },
  { value: "90d", short: "90 days", full: "Last 90 days" },
  { value: "12m", short: "12 months", full: "Last 12 months" },
  { value: "all", short: "All time", full: "All time" },
]

const ANALYTICS_SET = new Set<string>(ANALYTICS_RANGES.map((r) => r.value))

export function parseAnalyticsRange(value: string | null | undefined): AnalyticsRange {
  return typeof value === "string" && ANALYTICS_SET.has(value) ? (value as AnalyticsRange) : "12m"
}

/** "in the last 12 months" / "since you joined". */
export function rangePhrase(range: AnalyticsRange | EarningsPeriod): string {
  switch (range) {
    case "7d":
      return "in the last 7 days"
    case "30d":
      return "in the last 30 days"
    case "90d":
      return "in the last 90 days"
    case "12m":
      return "in the last 12 months"
    default:
      return "since you joined"
  }
}

// ── Months ───────────────────────────────────────────────────────────────────

/** "2026-10" for a date, in UTC (Accra is UTC+0 with no DST). */
export function monthKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function monthDate(key: string): Date {
  const [y, m] = key.split("-").map(Number)
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, 1))
}

/** "October 2026" */
export function monthLong(key: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate(key))
}

/** "October" */
export function monthName(key: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(monthDate(key))
}

/** "Oct 2026"; "Sep 2026", never ICU's "Sept 2026". */
export function monthShort(key: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(monthDate(key))
    .replace(/\bSept\b/, "Sep")
}

// ── Money (strings with two decimals from the API) ───────────────────────────

const toNumber = (amount: number | string | null | undefined): number => {
  const n = typeof amount === "number" ? amount : Number(amount ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Adds money strings in whole pesewas, so 0.1 + 0.2 stays 0.30. */
export function sumMoney(values: readonly (string | number | null | undefined)[]): string {
  const pesewas = values.reduce<number>((acc, v) => acc + Math.round(toNumber(v) * 100), 0)
  return (pesewas / 100).toFixed(2)
}

export function isZero(amount: string | number | null | undefined): boolean {
  return Math.round(toNumber(amount) * 100) === 0
}

/** "10% of what clients paid" from gross and fee; null when nothing was paid. */
export function feeShare(gross: string, fee: string): string | null {
  const g = toNumber(gross)
  if (g <= 0) return null
  const pct = Math.round((toNumber(fee) / g) * 1000) / 10
  return `${pct.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`
}

// ── Analytics words ──────────────────────────────────────────────────────────

/** "4.6" / "No rating yet". */
export function ratingText(value: number | null | undefined): string {
  return typeof value === "number" && value > 0 ? value.toFixed(1) : "No rating yet"
}

/** "33%" from the API's 0–100 rate, one decimal at most. */
export function rateText(rate: number | null | undefined): string {
  const n = typeof rate === "number" && Number.isFinite(rate) ? rate : 0
  return `${Math.round(n * 10) / 10}%`
}
