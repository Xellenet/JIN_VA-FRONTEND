/**
 * Spending page (Customer Experience v2, item 4): the pure rules behind
 * `/dashboard/user/report`.
 *
 * PURE MODULE: no runtime imports (only `import type`), no `@/` alias at
 * runtime, so `scripts/test-spending.mjs` can load it with
 * `node --experimental-strip-types`. Every string a customer reads on the page
 * that is computed from data lives here, so it can be tested without a browser.
 *
 * Copy rules (04-implementation-plan §0.2): the word for money waiting on a
 * job is "Held", and nothing here promises when a refund arrives.
 */

// ── Period ───────────────────────────────────────────────────────────────────

export type SpendingRange = "30d" | "90d" | "12m" | "all"
export type SpendingBucket = "day" | "week" | "month"

export const DEFAULT_RANGE: SpendingRange = "12m"

export const RANGES: readonly { value: SpendingRange; short: string; full: string }[] = [
  { value: "30d", short: "30 days", full: "Last 30 days" },
  { value: "90d", short: "90 days", full: "Last 90 days" },
  { value: "12m", short: "12 months", full: "Last 12 months" },
  { value: "all", short: "All time", full: "All time" },
]

const RANGE_VALUES = new Set<string>(RANGES.map((r) => r.value))

/** FU-4.1: anything that is not one of the four allowed values reads as `12m` (SEC-19). */
export function parseRange(value: string | null | undefined): SpendingRange {
  return typeof value === "string" && RANGE_VALUES.has(value) ? (value as SpendingRange) : DEFAULT_RANGE
}

/** "last 12 months"; `null` for All time. */
export function periodPhrase(range: SpendingRange): string | null {
  switch (range) {
    case "30d":
      return "last 30 days"
    case "90d":
      return "last 90 days"
    case "12m":
      return "last 12 months"
    default:
      return null
  }
}

/** "12 months", as in "than the previous 12 months"; `null` for All time. */
export function previousPhrase(range: SpendingRange): string | null {
  const phrase = periodPhrase(range)
  return phrase ? phrase.replace(/^last /, "") : null
}

/** Statement band label: "Net spent in the last 12 months" / "Net spent since you joined". */
export function netSpentLabel(range: SpendingRange): string {
  const phrase = periodPhrase(range)
  return phrase ? `Net spent in the ${phrase}` : "Net spent since you joined"
}

/** Live-region line after a period change (spec §6). */
export function periodAnnouncement(range: SpendingRange): string {
  const phrase = periodPhrase(range)
  return phrase ? `Showing the ${phrase}` : "Showing all time"
}

// ── Money ────────────────────────────────────────────────────────────────────

const toNumber = (amount: number | string | null | undefined): number => {
  const n = typeof amount === "number" ? amount : Number(amount ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** L-2: the same output as `formatCurrency` in `lib/utils` ("GH₵ 1,234.00"). */
export function formatMoney(amount: number | string | null | undefined): string {
  return `GH₵ ${toNumber(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * FU-4.3: the short form for a figure that would not fit ("GH₵ 1.25M"), and for
 * chart axes ("GH₵ 4k"). Up to two decimals, trailing zeros dropped. Values
 * under 1,000 keep the full two-decimal form so nothing small is rounded away.
 */
export function formatMoneyCompact(amount: number | string | null | undefined): string {
  const n = toNumber(amount)
  const abs = Math.abs(n)
  const units: [number, string][] = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ]
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const short = Math.round((n / size) * 100) / 100
      return `GH₵ ${short.toLocaleString("en-GB", { maximumFractionDigits: 2 })}${suffix}`
    }
  }
  return formatMoney(n)
}

/** Chart axis ticks: whole cedis, short form ("0", "GH₵ 1k"). */
export function formatAxisMoney(amount: number): string {
  if (amount === 0) return "0"
  if (Math.abs(amount) < 1000) return `GH₵ ${Math.round(amount)}`
  return formatMoneyCompact(amount)
}

/** Splits "GH₵ 14,820.00" into the parts the statement band sets at three sizes. */
export function moneyParts(amount: number | string | null | undefined): { whole: string; fraction: string } {
  const [whole, fraction = "00"] = formatMoney(amount).replace(/^GH₵ /, "").split(".")
  return { whole, fraction }
}

// ── Dates (en-GB, Africa/Accra; NFR-7.1 / 7.3) ───────────────────────────────

const TZ = "Africa/Accra"

const isValidDate = (d: Date) => !Number.isNaN(d.getTime())

/** Newer ICU writes en-GB September as "Sept"; the product uses three letters ("Sep"). */
export const threeLetterMonth = (s: string) => s.replace(/\bSept\b/g, "Sep")

/** "30 Oct 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (!isValidDate(d)) return ""
  return threeLetterMonth(
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(d),
  )
}

/** "Thu 11 Jun 2026, 1:10 pm" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (!isValidDate(d)) return ""
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `${get("weekday")} ${get("day")} ${threeLetterMonth(get("month"))} ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`
}

/** A `YYYY-MM-DD` / `YYYY-MM` bucket key as a UTC date (Accra is UTC+0, no DST). */
function bucketDate(bucketStart: string): Date {
  const [y, m, d] = bucketStart.split("-").map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
}

const fmtUtc = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  threeLetterMonth(new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(d))

/**
 * The bucket as words: "August 2026", "the week of 3 Aug 2026", "12 Aug 2026".
 * `start: true` capitalises it for the start of a label ("The week of …").
 */
export function bucketName(bucketStart: string, bucket: SpendingBucket, start = false): string {
  const d = bucketDate(bucketStart)
  if (bucket === "month") return fmtUtc(d, { month: "long", year: "numeric" })
  const day = fmtUtc(d, { day: "numeric", month: "short", year: "numeric" })
  if (bucket === "week") return `${start ? "The" : "the"} week of ${day}`
  return day
}

/** Short axis label for a bucket: { main: "Nov", sub: "2025" | null }. */
export function bucketTick(
  bucketStart: string,
  bucket: SpendingBucket,
  index: number,
): { main: string; sub: string | null } {
  const d = bucketDate(bucketStart)
  if (bucket === "month") {
    const main = fmtUtc(d, { month: "short" })
    const sub = index === 0 || d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : null
    return { main, sub }
  }
  if (bucket === "week") return { main: fmtUtc(d, { day: "numeric", month: "short" }), sub: null }
  const main = String(d.getUTCDate())
  const sub = index === 0 || d.getUTCDate() === 1 ? fmtUtc(d, { month: "short" }) : null
  return { main, sub }
}

/** Which bucket indices carry an axis label, so labels never collide. */
export function tickIndices(count: number, maxLabels: number): number[] {
  if (count <= 0) return []
  const step = Math.max(1, Math.ceil(count / Math.max(1, maxLabels)))
  const out: number[] = []
  for (let i = 0; i < count; i += step) out.push(i)
  return out
}

/** Round axis ticks from 0 to just above `max`, at most `maxTicks` intervals. */
export function niceTicks(max: number, maxTicks = 4): number[] {
  if (!(max > 0)) return [0]
  const rough = max / maxTicks
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

/** FR-4.14: `jinva-payments-2026-10-30.csv`, dated in Ghana time. No names or emails. */
export function csvFileName(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ })
    .formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `jinva-payments-${get("year")}-${get("month")}-${get("day")}.csv`
}

// ── Plain words ──────────────────────────────────────────────────────────────

/** NFR-7.4 */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`
}

export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
  return (letters.slice(0, 2) || "?").toUpperCase()
}

// ── Statuses and methods ─────────────────────────────────────────────────────

export const PAYMENT_STATUSES = [
  "PENDING",
  "HELD",
  "PENDING_TRANSFER",
  "TRANSFER_FAILED",
  "RELEASED",
  "REFUNDED",
  "FAILED",
  "CANCELLED",
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/**
 * FU-4.4: the customer labels from `getCustomerPaymentStatusConfig` in
 * `status-badges.ts` (FR-4.11, labels frozen by DT2), with the one Spending
 * exception from §4.2: `PENDING` reads "Awaiting payment". The payout states
 * the artisan still has to sort out are, for the customer, held money.
 */
const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Awaiting payment",
  HELD: "Withheld",
  PENDING_TRANSFER: "Withheld",
  TRANSFER_FAILED: "Withheld",
  RELEASED: "Paid Out",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
}

export function spendingStatusLabel(status: string): string {
  return (STATUS_LABELS as Record<string, string>)[status] ?? "Unknown"
}

/** Rows whose money never moved: their text drops to muted (spec §4, edge rows). */
export function isInactiveStatus(status: string): boolean {
  return status === "FAILED" || status === "CANCELLED"
}

/** The Status filter's options. Each option stands for one or more payment statuses. */
export const STATUS_FILTER_OPTIONS: readonly { key: string; label: string; statuses: readonly PaymentStatus[] }[] = [
  { key: "awaiting", label: "Awaiting payment", statuses: ["PENDING"] },
  { key: "withheld", label: "Withheld", statuses: ["HELD", "PENDING_TRANSFER", "TRANSFER_FAILED"] },
  { key: "paid-out", label: "Paid Out", statuses: ["RELEASED"] },
  { key: "refunded", label: "Refunded", statuses: ["REFUNDED"] },
  { key: "failed", label: "Failed", statuses: ["FAILED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
]

export type MethodKey = "mobile_money" | "card" | "bank" | "other"

/** Paystack channel → the four method groups of FR-4.7. */
export function methodKey(channel: string | null | undefined): MethodKey {
  switch (channel) {
    case "mobile_money":
      return "mobile_money"
    case "card":
      return "card"
    case "bank":
    case "bank_transfer":
      return "bank"
    default:
      return "other"
  }
}

const METHOD_LABELS: Record<MethodKey, string> = {
  mobile_money: "Mobile money",
  card: "Card",
  bank: "Bank",
  other: "Other",
}

/** "Mobile money", "Card", "Bank", "Other"; a row with no method yet reads "Not paid yet". */
export function methodLabel(channel: string | null | undefined, status?: string): string {
  if (!channel) {
    if (status === "PENDING") return "Not paid yet"
    if (status === "FAILED" || status === "CANCELLED") return "Not paid"
  }
  return METHOD_LABELS[methodKey(channel)]
}

/**
 * Static chart configuration (SEC-22). `ChartContainer` writes config keys and
 * colours into a `<style>` tag, so the keys are a fixed set and every colour is
 * a token reference. Server text is never a key or a colour.
 */
export const CHART_CONFIG_KEYS = ["c1", "c3", "c4", "other"] as const
export const OVER_TIME_CHART_CONFIG = {
  c1: { label: "Net spent", color: "var(--chart-1)" },
} as const

/** Method colours for the HTML bars in "How you paid" (token references only). */
export const METHOD_COLOURS: Record<MethodKey, string> = {
  mobile_money: "var(--chart-1)",
  card: "var(--chart-3)",
  bank: "var(--chart-4)",
  other: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
}

// ── History filters (URL state; SEC-19) ──────────────────────────────────────

export interface HistoryFilters {
  status: PaymentStatus[]
  serviceId: number | null
  artisanProfileId: number | null
  search: string
  page: number
}

export const EMPTY_FILTERS: HistoryFilters = { status: [], serviceId: null, artisanProfileId: null, search: "", page: 1 }

export const SEARCH_MAX = 100
export const MAX_PAGE = 1000
export const HISTORY_PAGE_SIZE = 20

interface ParamsLike {
  get(name: string): string | null
}

const parseId = (value: string | null): number | null => {
  if (!value || !/^\d{1,9}$/.test(value)) return null
  const n = Number(value)
  return n >= 1 ? n : null
}

/**
 * Canonical status list: known values only, in a fixed order, and a filter
 * option is either wholly in or wholly out (picking "Withheld" means all three
 * held states).
 */
export function normaliseStatuses(values: readonly string[]): PaymentStatus[] {
  const wanted = new Set(values)
  for (const option of STATUS_FILTER_OPTIONS) {
    if (option.statuses.some((s) => wanted.has(s))) option.statuses.forEach((s) => wanted.add(s))
  }
  return PAYMENT_STATUSES.filter((s) => wanted.has(s))
}

/** FU-4.2: reads the history filters from the URL, dropping anything not allowed. */
export function parseHistoryFilters(params: ParamsLike): HistoryFilters {
  const rawStatus = params.get("status")
  const status = rawStatus ? normaliseStatuses(rawStatus.split(",").map((s) => s.trim())) : []
  const pageRaw = params.get("page")
  const page = pageRaw && /^\d{1,4}$/.test(pageRaw) ? Math.min(MAX_PAGE, Math.max(1, Number(pageRaw))) : 1
  return {
    status,
    serviceId: parseId(params.get("serviceId")),
    artisanProfileId: parseId(params.get("artisanProfileId")),
    search: (params.get("search") ?? "").slice(0, SEARCH_MAX),
    page,
  }
}

/**
 * FU-4.2: the URL query for a range and filters. Defaults are left out, so the
 * plain page stays `/dashboard/user/report`.
 */
export function serialiseHistoryFilters(range: SpendingRange, filters: HistoryFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (range !== DEFAULT_RANGE) params.set("range", range)
  const status = normaliseStatuses(filters.status)
  if (status.length) params.set("status", status.join(","))
  if (filters.serviceId) params.set("serviceId", String(filters.serviceId))
  if (filters.artisanProfileId) params.set("artisanProfileId", String(filters.artisanProfileId))
  const search = filters.search.trim().slice(0, SEARCH_MAX)
  if (search) params.set("search", search)
  if (filters.page > 1) params.set("page", String(filters.page))
  return params
}

export function hasActiveFilters(f: HistoryFilters): boolean {
  return f.status.length > 0 || f.serviceId !== null || f.artisanProfileId !== null || f.search.trim() !== ""
}

/** How many separate filters are set (the phone "Filters" badge). */
export function activeFilterCount(f: HistoryFilters): number {
  return selectedStatusOptions(f.status).length + (f.serviceId ? 1 : 0) + (f.artisanProfileId ? 1 : 0)
}

export function selectedStatusOptions(status: readonly string[]) {
  const set = new Set(status)
  return STATUS_FILTER_OPTIONS.filter((o) => o.statuses.every((s) => set.has(s)))
}

/** The Status trigger: "Status", "Status: Paid Out" or "Status: 2 selected". */
export function statusTriggerValue(status: readonly string[]): string | null {
  const selected = selectedStatusOptions(status)
  if (selected.length === 0) return null
  if (selected.length === 1) return selected[0].label
  return `${selected.length} selected`
}

export function toggleStatusOption(status: readonly PaymentStatus[], key: string): PaymentStatus[] {
  const option = STATUS_FILTER_OPTIONS.find((o) => o.key === key)
  if (!option) return normaliseStatuses(status)
  const isOn = option.statuses.every((s) => status.includes(s))
  const next = isOn ? status.filter((s) => !option.statuses.includes(s)) : [...status, ...option.statuses]
  return normaliseStatuses(next)
}

/** "5 of 21 payments match your filters." / "1 of 21 payments matches your filters." */
export function resultLine(matching: number, total: number): { lead: string; rest: string } {
  return {
    lead: `${matching.toLocaleString("en-GB")} of ${plural(total, "payment")}`,
    rest: matching === 1 ? "matches your filters." : "match your filters.",
  }
}

/** "21 payments in the last 12 months, newest first." */
export function historySubtitle(total: number, range: SpendingRange): string {
  const phrase = periodPhrase(range)
  return phrase ? `${plural(total, "payment")} in the ${phrase}, newest first.` : `${plural(total, "payment")}, newest first.`
}

// ── Statement band ───────────────────────────────────────────────────────────

export type ChangeLine =
  | { kind: "more" | "less"; chip: string; rest: string }
  | { kind: "same" | "zero"; chip: null; rest: string }

/**
 * The line under Net spent (spec §4, D7). `null` for All time. Neutral words,
 * because spending more is neither good nor bad.
 */
export function changeLine(
  range: SpendingRange,
  netSpent: number | string,
  previousPeriodNetSpent: number | string | null | undefined,
): ChangeLine | null {
  const period = previousPhrase(range)
  if (!period || previousPeriodNetSpent === null || previousPeriodNetSpent === undefined) return null
  const current = toNumber(netSpent)
  const previous = toNumber(previousPeriodNetSpent)
  if (previous <= 0) return { kind: "zero", chip: null, rest: `Nothing spent in the previous ${period}` }
  const cents = Math.round(current * 100) - Math.round(previous * 100)
  if (cents === 0) return { kind: "same", chip: null, rest: `The same as the previous ${period}` }
  const pct = Math.max(1, Math.round((Math.abs(current - previous) / previous) * 100))
  const kind = cents > 0 ? "more" : "less"
  return { kind, chip: `${pct.toLocaleString("en-GB")}% ${kind}`, rest: `than the previous ${period} (${formatMoney(previous)})` }
}

// ── Chart summaries (FR-4.9) ─────────────────────────────────────────────────

interface SeriesPoint {
  bucketStart: string
  netSpent: string | number
  count: number
}

const zeroBucketWords: Record<SpendingBucket, { prep: string; unit: string }> = {
  month: { prep: "in", unit: "month" },
  week: { prep: "in", unit: "week" },
  day: { prep: "on", unit: "day" },
}

/** FU-4.5: "Highest in August 2026 at GH₵ 3,150.00. Nothing spent in November 2025 or February 2026." */
export function overTimeSummary(series: readonly SeriesPoint[], bucket: SpendingBucket): string {
  if (series.length === 0) return "No payments in this period."
  let top = series[0]
  for (const p of series) if (toNumber(p.netSpent) > toNumber(top.netSpent)) top = p
  if (toNumber(top.netSpent) <= 0) return "Nothing spent in this period."
  const { prep, unit } = zeroBucketWords[bucket]
  const highest = `Highest ${prep} ${bucketName(top.bucketStart, bucket)} at ${formatMoney(top.netSpent)}.`
  const zeros = series.filter((p) => toNumber(p.netSpent) <= 0)
  if (zeros.length === 0) return highest
  if (zeros.length <= 2) {
    const names = zeros.map((p) => bucketName(p.bucketStart, bucket)).join(" or ")
    return `${highest} Nothing spent ${prep} ${names}.`
  }
  return `${highest} Nothing spent ${prep} ${plural(zeros.length, unit)}.`
}

export function percent(share: number): number {
  return Math.round(toNumber(share) * 100)
}

/** "Plumbing is 35% of your spending." */
export function categorySummary(rows: readonly { serviceName: string; share: number }[]): string {
  const top = rows[0]
  if (!top) return "No spending to show for this period."
  return `${top.serviceName} is ${percent(top.share)}% of your spending.`
}

/** "Kofi Asante received the most: GH₵ 3,780.00 over 4 jobs." */
export function artisanSummary(rows: readonly { displayName: string; netSpent: string | number; count: number }[]): string {
  const top = rows[0]
  if (!top) return "No artisans paid in this period."
  return `${top.displayName} received the most: ${formatMoney(top.netSpent)} over ${plural(top.count, "job")}.`
}

const methodInSentence = (key: MethodKey) => (key === "other" ? "other methods" : METHOD_LABELS[key].toLowerCase())

/** "Most of your payments were by mobile money." / "Your payments were split between card and mobile money." */
export function channelSummary(rows: readonly { channel: string; share: number }[]): string {
  const sorted = [...rows].sort((a, b) => toNumber(b.share) - toNumber(a.share))
  const [a, b] = sorted
  if (!a) return "No payments in this period."
  if (toNumber(a.share) > 0.5 || !b) return `Most of your payments were by ${methodInSentence(methodKey(a.channel))}.`
  return `Your payments were split between ${methodInSentence(methodKey(a.channel))} and ${methodInSentence(methodKey(b.channel))}.`
}

/** The stacked bar's text alternative: "Mobile money 57%, card 39%, bank 4%". */
export function channelAltText(rows: readonly { channel: string; share: number }[]): string {
  return rows
    .map((r, i) => {
      const label = METHOD_LABELS[methodKey(r.channel)]
      return `${i === 0 ? label : label.toLowerCase()} ${percent(r.share)}%`
    })
    .join(", ")
}

/** Accessible name of a column: "June 2026: GH₵ 1,890.00, 2 payments". */
export function columnLabel(point: SeriesPoint, bucket: SpendingBucket, noun = "payment"): string {
  return `${bucketName(point.bucketStart, bucket, true)}: ${formatMoney(point.netSpent)}, ${plural(point.count, noun)}`
}

/** Seconds left on a 429 as the Try again label (spec §4). */
export function retryLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Try again in ${secondsLeft} s` : "Try again"
}

/** Positive safe integer ids only; anything else gives no link (SEC-18). */
export function safeId(id: unknown): number | null {
  const n = typeof id === "string" && /^\d{1,15}$/.test(id) ? Number(id) : id
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : null
}

export const jobHref = (id: unknown) => {
  const n = safeId(id)
  return n ? `/dashboard/user/jobs/${n}` : null
}

export const artisanHref = (id: unknown) => {
  const n = safeId(id)
  return n ? `/dashboard/user/artisan/${n}` : null
}
