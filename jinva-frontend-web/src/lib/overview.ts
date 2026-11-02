/**
 * Pure helpers for the customer Overview (stage filter and account rail).
 *
 * Pure-module rule (plan §3.2): no runtime imports, only `import type`, so
 * `scripts/test-overview.mjs` runs this file directly with
 * `node --experimental-strip-types`. Every string a screen reader or the
 * filter bar reads is built here, so the exact copy in the Overview spec §7/§8
 * is tested in one place.
 */
import type { ActionItem, JobStatus, Money, Stage } from "./customer-api"

export type { Stage }

export interface StageInfo {
  stage: Stage
  /** Stop label and chip text: "In progress". */
  label: string
  /** Lower-case form used inside sentences: "in progress". */
  noun: string
  statuses: readonly JobStatus[]
  /** Filtered-empty hint (spec §8). */
  hint: string
}

export const STAGES: readonly StageInfo[] = [
  {
    stage: "open",
    label: "Open",
    noun: "open",
    statuses: ["OPEN"],
    hint: "A job is open while artisans can apply to it. Post a job and it will show here.",
  },
  {
    stage: "in_progress",
    label: "In progress",
    noun: "in progress",
    statuses: ["PENDING", "IN_PROGRESS"],
    hint: "Jobs move here once you choose an artisan, and stay until the work is done.",
  },
  {
    stage: "completed",
    label: "Completed",
    noun: "completed",
    statuses: ["COMPLETED"],
    hint: "Jobs move here when you confirm the work is finished.",
  },
  {
    stage: "closed",
    label: "Closed",
    noun: "closed",
    statuses: ["CANCELLED", "EXPIRED"],
    hint: "Jobs move here when they are cancelled or expire without an artisan.",
  },
]

export function stageInfo(stage: Stage): StageInfo {
  return STAGES.find((s) => s.stage === stage) ?? STAGES[0]
}

/**
 * The only way a `?stage=` value becomes a stage (SEC-19, FU-1.2). Exactly the
 * four literals pass; everything else (case variants, arrays, markup, long
 * strings) is `null`. The returned value is always one of our own literals,
 * never the input.
 */
export function parseStage(value: unknown): Stage | null {
  if (typeof value !== "string" || value.length > 16) return null
  for (const s of STAGES) if (s.stage === value) return s.stage
  return null
}

/** Which stop a job status belongs to (FU-1.1). PENDING counts as In progress (Q2). */
export function statusToStage(status: unknown): Stage | null {
  for (const s of STAGES) if ((s.statuses as readonly unknown[]).includes(status)) return s.stage
  return null
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * The greeting sentence (FR-1.11), from account-wide stage counts. `null`
 * counts (the summary failed) give the neutral fallback instead of a guess.
 */
export function summarise(byStage: Record<Stage, number> | null): string {
  if (!byStage) return "Your most recent jobs are below."
  const total = byStage.open + byStage.in_progress + byStage.completed + byStage.closed
  if (total === 0) return "Post a job and artisans near you can apply."
  const parts: string[] = []
  if (byStage.in_progress > 0) parts.push(`${plural(byStage.in_progress, "job")} in progress`)
  if (byStage.open > 0) parts.push(`${plural(byStage.open, "job")} waiting for applications`)
  if (parts.length === 0) return "Nothing in progress right now."
  const sentence = `${parts.join(", ")}.`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

/** "38 jobs in total" / "1 job in total". */
export function totalLabel(total: number): string {
  return `${plural(total, "job")} in total`
}

/** "3 results" / "1 result". */
export function resultsLabel(n: number): string {
  return plural(n, "result")
}

/** The filter bar as one sentence (FU-1.3): "Showing In progress jobs only · 4 results". */
export function filterBarSentence(stage: Stage, results: number): string {
  return `Showing ${stageInfo(stage).label} jobs only · ${resultsLabel(results)}`
}

/** List heading: "Recent jobs" or "In progress jobs". */
export function listTitle(stage: Stage | null): string {
  return stage ? `${stageInfo(stage).label} jobs` : "Recent jobs"
}

/** Stop accessible name: "In progress: 3 jobs", or "Open: count unavailable". */
export function stopLabel(stage: Stage, count: number | null): string {
  const { label } = stageInfo(stage)
  return count === null ? `${label}: count unavailable` : `${label}: ${plural(count, "job")}`
}

// ── Live region (spec §7, FU-1.4) ────────────────────────────────────────────

export function liveSelect(stage: Stage, total: number): string {
  return `Showing ${total} ${stageInfo(stage).noun} ${total === 1 ? "job" : "jobs"}`
}

export function liveClear(shown: number): string {
  return `Filter cleared, showing ${shown} recent ${shown === 1 ? "job" : "jobs"}`
}

export function liveShowMore(stage: Stage, shown: number, total: number): string {
  return `Showing ${shown} of ${total} ${stageInfo(stage).noun} ${total === 1 ? "job" : "jobs"}`
}

// ── Show more (FR-1.7, FU-1.6) ───────────────────────────────────────────────

export const FILTERED_PAGE_SIZE = 10
export const RECENT_COUNT = 5
/** After this many rows the list links to My Jobs instead of loading more. */
export const SHOW_MORE_CAP = 50

export type ShowMoreState =
  | { kind: "more"; nextPage: number; label: string }
  | { kind: "my-jobs"; label: string }
  | { kind: "done" }

/** What the footer under a filtered list shows, given rows loaded so far and the total. */
export function showMoreState(
  loaded: number,
  total: number,
  stage: Stage,
  pageSize = FILTERED_PAGE_SIZE,
  cap = SHOW_MORE_CAP,
): ShowMoreState {
  if (loaded >= total) return { kind: "done" }
  if (loaded >= cap) return { kind: "my-jobs", label: `See all ${stageInfo(stage).noun} jobs in My Jobs` }
  return { kind: "more", nextPage: Math.floor(loaded / pageSize) + 1, label: `${loaded} of ${total} shown` }
}

/** The My Jobs URL for a stage, built from the parsed literal only. */
export function myJobsHref(stage: Stage | null): string {
  const s = stage === null ? null : parseStage(stage)
  return s ? `/dashboard/user/jobs?stage=${s}` : "/dashboard/user/jobs"
}

// ── Rail: Needs your action (FR-2.4, FU-2.5) ─────────────────────────────────

export type ActionKind = "completionsToConfirm" | "paymentsDue" | "applicationsToReview" | "unreadMessages"

/** A positive safe integer, or null. */
function safeId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null
}

/**
 * Where a "Needs your action" row goes. Built only from typed ids and fixed
 * literals, never from a URL in the data (SEC-18). One distinct job links to
 * it; several (or a bad id) link to the filtered list.
 */
export function actionHref(kind: ActionKind, item?: Pick<ActionItem, "jobId"> | null): string {
  const id = safeId(item?.jobId)
  switch (kind) {
    case "completionsToConfirm":
      return id ? `/dashboard/user/jobs/${id}` : myJobsHref("in_progress")
    case "paymentsDue":
      return id ? `/dashboard/user/jobs/${id}/pay` : myJobsHref("in_progress")
    case "applicationsToReview":
      return id ? `/dashboard/user/jobs/${id}` : myJobsHref("open")
    case "unreadMessages":
    default:
      return "/dashboard/user/messages"
  }
}

export const ACTION_LABELS: Record<ActionKind, string> = {
  completionsToConfirm: "Confirm completion",
  paymentsDue: "Pay to start",
  applicationsToReview: "Review applications",
  unreadMessages: "Unread messages",
}

/** The row's accessible name: "Confirm completion: 1. Opens the job". */
export function actionAriaLabel(kind: ActionKind, count: number, single: boolean): string {
  const target =
    kind === "unreadMessages"
      ? "Opens Messages"
      : kind === "paymentsDue"
        ? single
          ? "Opens the payment"
          : "Opens your in progress jobs"
        : single
          ? "Opens the job"
          : kind === "applicationsToReview"
            ? "Opens your open jobs"
            : "Opens your in progress jobs"
  return `${ACTION_LABELS[kind]}: ${count}. ${target}`
}

/** Links to the booking and the artisan, from typed ids only. */
export function bookingHref(id: unknown): string | null {
  const n = safeId(id)
  return n ? `/dashboard/user/bookings/${n}` : null
}

export function artisanHref(id: unknown): string | null {
  const n = safeId(id)
  return n ? `/dashboard/user/artisan/${n}` : null
}

// ── Rail: Next appointment (FR-2.5, FU-2.1, FU-2.2) ──────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** Today's calendar date in Accra (UTC+0, no DST) as `YYYY-MM-DD`. */
export function accraToday(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d
}

/** "09:00" → "9:00 am"; "13:30" → "1:30 pm". */
export function formatTime12(time: string | null | undefined): string | null {
  const m = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null
  if (!m) return null
  const h = Number(m[1])
  if (h > 23) return null
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "am" : "pm"}`
}

export interface AppointmentText {
  /** "Today" / "Tomorrow" / null */
  relative: "Today" | "Tomorrow" | null
  /** "Tue 4 Nov 2026" */
  date: string
  /** "9:00 am – 11:00 am", "9:00 am", or null when there is no time */
  time: string | null
  /** The one-line form (FU-2.1): "Tomorrow, 9:00 am – 11:00 am", "Tue 4 Nov 2026, 9:00 am – 11:00 am", date only without times */
  line: string
  tile: { weekday: string; day: string; month: string }
}

export function formatAppointment(
  booking: { scheduledDate: string; startTime: string | null; endTime: string | null },
  now: Date,
): AppointmentText | null {
  const d = parseIsoDate(booking.scheduledDate)
  if (!d) return null
  const today = parseIsoDate(accraToday(now))
  const diffDays = today ? Math.round((d.getTime() - today.getTime()) / 86_400_000) : NaN
  const relative = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : null
  const weekday = WEEKDAYS[d.getUTCDay()]
  const month = MONTHS_SHORT[d.getUTCMonth()]
  const date = `${weekday} ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`
  const start = formatTime12(booking.startTime)
  const end = formatTime12(booking.endTime)
  const time = start ? (end ? `${start} – ${end}` : start) : null
  const head = relative ?? date
  return {
    relative,
    date,
    time,
    line: time ? `${head}, ${time}` : relative ? `${relative}, ${date}` : date,
    tile: { weekday, day: String(d.getUTCDate()), month },
  }
}

// ── Rail: Spending (FR-2.6, FU-2.3, FU-2.4) ──────────────────────────────────

/** `"1840.00"` → `"GH₵ 1,840.00"` (same output as `formatCurrency` in utils). */
export function formatMoney(amount: Money | number): string {
  const n = Number(amount)
  return `GH₵ ${(Number.isFinite(n) ? n : 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** `"2026-10"` → `"October 2026"`; `{ short: true }` → `"Oct"`; `{ monthOnly: true }` → `"October"`. */
export function monthName(key: string, opts: { short?: boolean; monthOnly?: boolean } = {}): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return ""
  const i = Number(m[2]) - 1
  if (i < 0 || i > 11) return ""
  if (opts.short) return MONTHS_SHORT[i]
  return opts.monthOnly ? MONTHS_LONG[i] : `${MONTHS_LONG[i]} ${m[1]}`
}

/** The calendar month before `key` (`"2026-01"` → `"2025-12"`). */
export function previousMonthKey(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return ""
  const y = Number(m[1])
  const mo = Number(m[2])
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`
}

export interface SpendComparison {
  direction: "up" | "down" | "same"
  /** "▲" / "▼" / "" (decorative, `aria-hidden`) */
  arrow: string
  /** "Up" / "Down" / "" (screen-reader word before the amount) */
  srWord: string
  /** "GH₵ 420.00 vs September" / "Same as September" */
  text: string
}

/**
 * This month against last month. `null` (hidden) when last month was 0. The
 * arrow is deliberately neutral: spending more is not good or bad (D6).
 */
export function spendComparison(thisMonth: Money, lastMonth: Money, lastMonthKey: string): SpendComparison | null {
  const now = Math.round(Number(thisMonth) * 100)
  const prev = Math.round(Number(lastMonth) * 100)
  if (!Number.isFinite(now) || !Number.isFinite(prev) || prev <= 0) return null
  const month = monthName(lastMonthKey, { monthOnly: true }) || "last month"
  if (now === prev) return { direction: "same", arrow: "", srWord: "", text: `Same as ${month}` }
  const up = now > prev
  return {
    direction: up ? "up" : "down",
    arrow: up ? "▲" : "▼",
    srWord: up ? "Up" : "Down",
    text: `${formatMoney(Math.abs(now - prev) / 100)} vs ${month}`,
  }
}

/** The sparkline's text alternative (FU-2.4). */
export function sparklineAlt(series: readonly { month: string; netSpent: Money }[]): string {
  const head = `Spending over the last ${series.length} months`
  let best: { month: string; value: number } | null = null
  for (const p of series) {
    const v = Number(p.netSpent)
    if (Number.isFinite(v) && v > 0 && (!best || v > best.value)) best = { month: p.month, value: v }
  }
  if (!best) return `${head}, no payments`
  return `${head}, highest in ${monthName(best.month, { monthOnly: true })}, ${formatMoney(best.value)}`
}

export interface SparklineGeometry {
  /** The line, as an SVG path */
  line: string
  /** The filled area under the line */
  area: string
  /** The last point, as a fraction of the box (0–1) for the HTML end dot */
  last: { x: number; y: number }
}

/**
 * Points for a 280×64 sparkline: x runs 4 → 276, y from 60 (zero, the
 * baseline) up to 10 (the highest month), so the line never touches the edge.
 */
export function sparklineGeometry(
  values: readonly number[],
  box = { width: 280, height: 64, padX: 4, top: 10, base: 60 },
): SparklineGeometry | null {
  if (values.length < 2) return null
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const max = Math.max(...clean)
  const step = (box.width - box.padX * 2) / (clean.length - 1)
  const pts = clean.map((v, i) => {
    const x = box.padX + step * i
    const y = max > 0 ? box.base - (v / max) * (box.base - box.top) : box.base
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const first = pts[0]
  const end = pts[pts.length - 1]
  const area = `${line} L${end[0].toFixed(1)},${box.height} L${first[0].toFixed(1)},${box.height} Z`
  return { line, area, last: { x: end[0] / box.width, y: end[1] / box.height } }
}

/** Two-letter initials for an avatar fallback. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = Array.from(parts[0])[0] ?? ""
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : ""
  return (first + last).toUpperCase()
}
