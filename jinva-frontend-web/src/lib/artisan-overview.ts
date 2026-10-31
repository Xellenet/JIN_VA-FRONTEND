/**
 * Pure helpers for the artisan Overview and Calendar (artisan fixes H3, H4).
 *
 * Same pure-module rule as `overview.ts`: no runtime imports, so
 * `scripts/test-overview.mjs` can load this file directly with
 * `node --experimental-strip-types`. Shapes follow
 * docs/specs/artisan-fixes/api-contract.md (B1).
 */

// ── B1 response ──────────────────────────────────────────────────────────────

export type Money = string

export type ArtisanStage = "to_start" | "in_progress" | "awaiting_client" | "done" | "closed"

export interface ArtisanStageCounts {
  toStart: number
  inProgress: number
  awaitingClient: number
  done: number
  closed: number
  total: number
  applied: number
}

export interface BookingRequest {
  bookingId: number
  clientName: string
  service: { id: number; name: string } | null
  scheduledDate: string
  startTime: string | null
  endTime: string | null
  location: string | null
  notes: string | null
  createdAt: string
  respondBy: string
}

export interface ArtisanBooking {
  bookingId: number
  status: string
  clientName: string
  service: { id: number; name: string } | null
  scheduledDate: string
  startTime: string | null
  endTime: string | null
  location: string | null
  notes: string | null
  artisanNotes: string | null
  jobId: number | null
}

export interface ArtisanEarningsSnapshot {
  currency: string
  heldForSignOff: Money
  onTheWay: Money
  needsAction: Money
  needsActionCount: number
  paidThisMonth: Money
  hasPayoutMethod: boolean
}

export type ArtisanOverviewSection = "stageCounts" | "pendingRequests" | "bookings" | "earnings" | "disputes"

export interface ArtisanOverview {
  stageCounts: ArtisanStageCounts | null
  pendingRequests: { total: number; items: BookingRequest[] } | null
  nextBooking: ArtisanBooking | null
  todayBookings: ArtisanBooking[] | null
  earnings: ArtisanEarningsSnapshot | null
  disputesNeedingResponse: number | null
  failedSections: ArtisanOverviewSection[]
}

// ── Stage strip ──────────────────────────────────────────────────────────────

export interface ArtisanStageInfo {
  stage: ArtisanStage
  label: string
  key: keyof Omit<ArtisanStageCounts, "total" | "applied">
}

/** The path a job takes for the artisan, with Closed set apart at the end. */
export const ARTISAN_STAGES: readonly ArtisanStageInfo[] = [
  { stage: "to_start", label: "To start", key: "toStart" },
  { stage: "in_progress", label: "In progress", key: "inProgress" },
  { stage: "awaiting_client", label: "Waiting on client", key: "awaitingClient" },
  { stage: "done", label: "Done", key: "done" },
  { stage: "closed", label: "Closed", key: "closed" },
]

/** My Jobs filtered to one stage. Built from our own literals only. */
export function artisanJobsHref(stage: ArtisanStage | null): string {
  const s = ARTISAN_STAGES.find((x) => x.stage === stage)?.stage
  return s ? `/dashboard/artisan/jobs?stage=${s}` : "/dashboard/artisan/jobs"
}

/** Accessible name of a stop: "Waiting on client: 1 job. Opens My Jobs". */
export function artisanStopLabel(label: string, count: number | null): string {
  if (count === null) return `${label}: count unavailable. Opens My Jobs`
  return `${label}: ${plural(count, "job")}. Opens My Jobs`
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * The greeting sentence under the h1. Requests come first because they expire;
 * `null` parts (a failed section) are skipped rather than guessed.
 */
export function artisanSummary(
  counts: ArtisanStageCounts | null,
  requests: number | null,
  todayCount: number | null,
): string {
  const parts: string[] = []
  if (requests && requests > 0) parts.push(`${plural(requests, "booking request")} to answer`)
  if (todayCount && todayCount > 0) parts.push(`${plural(todayCount, "appointment")} today`)
  if (counts) {
    if (counts.toStart > 0) parts.push(`${plural(counts.toStart, "job")} to start`)
    if (counts.inProgress > 0) parts.push(`${plural(counts.inProgress, "job")} in progress`)
  }
  if (parts.length === 0) {
    if (!counts) return "Here is what needs you today."
    return counts.total === 0 ? "Apply for open jobs below to get your first booking." : "Nothing needs you right now."
  }
  const sentence = `${parts.join(", ")}.`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

// ── Booking requests ─────────────────────────────────────────────────────────

export interface RespondBy {
  expired: boolean
  /** Shown next to the request: "5 hours left to reply", "Less than an hour left to reply". */
  text: string
  /** Under 3 hours left: the request is drawn with the attention tone. */
  urgent: boolean
}

/** Time left before a request expires on its own (the server's `respondBy`). */
export function respondByText(respondBy: string, now: Date): RespondBy {
  const end = new Date(respondBy).getTime()
  if (!Number.isFinite(end)) return { expired: false, text: "", urgent: false }
  const ms = end - now.getTime()
  if (ms <= 0) return { expired: true, text: "This request has expired", urgent: false }
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return { expired: false, text: "Less than an hour left to reply", urgent: true }
  if (hours < 48) return { expired: false, text: `${plural(hours, "hour")} left to reply`, urgent: hours < 3 }
  return { expired: false, text: `${plural(Math.floor(hours / 24), "day")} left to reply`, urgent: false }
}

/** The client's name, or a neutral fallback when it is blank. */
export function clientLabel(name: string | null | undefined): string {
  const n = (name ?? "").trim()
  return n || "Client"
}

/**
 * A booking's title. Never "Service — Name": the service when there is one,
 * else "Booking with Ama Mensah".
 */
export function bookingTitle(service: { name?: string | null } | null | undefined, clientName: string): string {
  const s = service?.name?.trim()
  return s ? s : `Booking with ${clientLabel(clientName)}`
}

export const LOCATION_IN_MESSAGES = "Location shared in messages"

export function locationText(location: string | null | undefined): string {
  const l = (location ?? "").trim()
  return l || LOCATION_IN_MESSAGES
}

// ── Calendar grouping ────────────────────────────────────────────────────────

export type CalendarGroup = "requests" | "upcoming" | "followUp" | "history"

/** "HH:mm[:ss]" → minutes since midnight, or null. */
function minutes(time: string | null | undefined): number | null {
  const m = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** A booking's end as a UTC instant (Accra is UTC+0). Missing end time: the end of that day. */
export function bookingEnd(b: { scheduledDate: string; endTime?: string | null }): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(b.scheduledDate)
  if (!m) return Number.NaN
  const day = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const end = minutes(b.endTime)
  return day + (end === null ? 24 * 60 : end) * 60_000
}

/**
 * Which list a booking belongs to on the Calendar:
 *   PENDING → requests; CONFIRMED and not ended → upcoming;
 *   CONFIRMED and ended → needs follow-up (mark no-show or open the job);
 *   everything else → history.
 */
export function calendarGroup(b: { status: string; scheduledDate: string; endTime?: string | null }, now: Date): CalendarGroup {
  if (b.status === "PENDING") return "requests"
  if (b.status === "CONFIRMED") return bookingEnd(b) > now.getTime() ? "upcoming" : "followUp"
  return "history"
}

// ── Rail: Needs your action ──────────────────────────────────────────────────

export type ArtisanActionKind = "bookingRequests" | "disputes" | "payoutsNeedAction" | "payoutMethod"

export interface ArtisanActionRow {
  kind: ArtisanActionKind
  count: number
  label: string
  detail: string | null
  href: string
  ariaLabel: string
}

/**
 * Rows for the artisan's "Needs your action", in a fixed order. A failed
 * section (null) adds no row; the rail says separately that part didn't load.
 */
export function artisanActionRows(input: {
  requests: number | null
  disputes: number | null
  earnings: Pick<ArtisanEarningsSnapshot, "needsAction" | "needsActionCount" | "hasPayoutMethod"> | null
}): ArtisanActionRow[] {
  const rows: ArtisanActionRow[] = []
  if (input.requests && input.requests > 0) {
    rows.push({
      kind: "bookingRequests",
      count: input.requests,
      label: "Answer booking requests",
      detail: null,
      href: "#booking-requests",
      ariaLabel: `Answer booking requests: ${input.requests}. Goes to the requests on this page`,
    })
  }
  if (input.disputes && input.disputes > 0) {
    rows.push({
      kind: "disputes",
      count: input.disputes,
      label: "Respond to a dispute",
      detail: input.disputes === 1 ? "A client opened a dispute" : `${input.disputes} disputes need your side`,
      href: "/dashboard/artisan/disputes",
      ariaLabel: `Respond to a dispute: ${input.disputes}. Opens Disputes`,
    })
  }
  const e = input.earnings
  if (e && e.needsActionCount > 0) {
    if (!e.hasPayoutMethod) {
      rows.push({
        kind: "payoutMethod",
        count: e.needsActionCount,
        label: "Add a payout method",
        detail: `${formatGhs(e.needsAction)} is waiting for it`,
        href: "/dashboard/artisan/earnings",
        ariaLabel: `Add a payout method: ${formatGhs(e.needsAction)} waiting. Opens Earnings`,
      })
    } else {
      rows.push({
        kind: "payoutsNeedAction",
        count: e.needsActionCount,
        label: "Fix a payout",
        detail: `${formatGhs(e.needsAction)} couldn't be sent`,
        href: "/dashboard/artisan/earnings",
        ariaLabel: `Fix a payout: ${e.needsActionCount}. Opens Earnings`,
      })
    }
  }
  return rows
}

/** `"1840.00"` → `"GH₵ 1,840.00"` (same output as `formatMoney` in overview.ts). */
export function formatGhs(amount: Money | number | null | undefined): string {
  const n = Number(amount)
  return `GH₵ ${(Number.isFinite(n) ? n : 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** A positive safe integer id, or null (ids from responses go into paths). */
export function safeId(value: unknown): number | null {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : null
}

export function artisanJobHref(id: unknown): string | null {
  const n = safeId(id)
  return n ? `/dashboard/artisan/jobs/${n}` : null
}

export function calendarBookingHref(id: unknown): string {
  const n = safeId(id)
  return n ? `/dashboard/artisan/calendar?booking=${n}` : "/dashboard/artisan/calendar"
}

/** `?booking=` → a booking id, or null. */
export function parseBookingParam(value: unknown): number | null {
  if (typeof value !== "string" || value.length > 12) return null
  return /^\d+$/.test(value) ? safeId(Number(value)) : null
}
