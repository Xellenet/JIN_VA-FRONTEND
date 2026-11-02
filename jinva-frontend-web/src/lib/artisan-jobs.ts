/**
 * Artisan side of jobs: the five stages a job goes through for the artisan who
 * does it, how a `GET /jobs` row maps onto them, and the en-GB formatting the
 * artisan job pages share.
 *
 * Stages match `GET /artisans/me/overview` → `stageCounts` (api-contract.md B1):
 *   to start          = PENDING
 *   in progress       = IN_PROGRESS, completion not requested yet
 *   waiting on client = IN_PROGRESS with `completionRequestedAt` set
 *   done              = COMPLETED
 *   closed            = CANCELLED or EXPIRED
 *
 * `?stage=` on My Jobs takes the keys below (`to_start`, `in_progress`,
 * `waiting_on_client`, `done`, `closed`) plus `open` for jobs open to apply
 * for. A few spellings are accepted so a link built from the API's own key
 * names (`toStart`, `awaitingClient`) still lands on the right filter.
 */

export type ArtisanStage = "to_start" | "in_progress" | "waiting_on_client" | "done" | "closed"
/** What the My Jobs list can show: one stage, open jobs to apply for, or everything. */
export type ArtisanJobsView = ArtisanStage | "open"

export interface ArtisanStageCounts {
  toStart: number
  inProgress: number
  awaitingClient: number
  done: number
  closed: number
  total: number
  applied: number
}

export interface ArtisanStageInfo {
  stage: ArtisanStage
  label: string
  /** Lower-case form for sentences. */
  noun: string
  /** Server-side `status` filters; more than one means one request per status. */
  statuses: readonly string[]
  /** Key in `stageCounts`. */
  countKey: keyof Omit<ArtisanStageCounts, "total" | "applied">
  /** Shown when the filtered list is empty. */
  hint: string
}

export const ARTISAN_STAGES: readonly ArtisanStageInfo[] = [
  {
    stage: "to_start",
    label: "To start",
    noun: "to start",
    statuses: ["PENDING"],
    countKey: "toStart",
    hint: "A job lands here when a client chooses you or you confirm a booking. Start it when you begin the work.",
  },
  {
    stage: "in_progress",
    label: "In progress",
    noun: "in progress",
    statuses: ["IN_PROGRESS"],
    countKey: "inProgress",
    hint: "Jobs you have started show here until you ask the client to confirm the work is done.",
  },
  {
    stage: "waiting_on_client",
    label: "Waiting on client",
    noun: "waiting on the client",
    statuses: ["IN_PROGRESS"],
    countKey: "awaitingClient",
    hint: "After you request completion, the job waits here for the client to confirm.",
  },
  {
    stage: "done",
    label: "Done",
    noun: "done",
    statuses: ["COMPLETED"],
    countKey: "done",
    hint: "Jobs move here once the client confirms the work is finished.",
  },
  {
    stage: "closed",
    label: "Closed",
    noun: "closed",
    statuses: ["CANCELLED", "EXPIRED"],
    countKey: "closed",
    hint: "Jobs move here when they are cancelled or expire.",
  },
]

export function artisanStageInfo(stage: ArtisanStage): ArtisanStageInfo {
  return ARTISAN_STAGES.find((s) => s.stage === stage) ?? ARTISAN_STAGES[0]
}

const VIEW_ALIASES: Record<string, ArtisanJobsView> = {
  to_start: "to_start",
  "to-start": "to_start",
  tostart: "to_start",
  in_progress: "in_progress",
  "in-progress": "in_progress",
  inprogress: "in_progress",
  waiting_on_client: "waiting_on_client",
  "waiting-on-client": "waiting_on_client",
  waiting: "waiting_on_client",
  awaiting_client: "waiting_on_client",
  awaitingclient: "waiting_on_client",
  done: "done",
  closed: "closed",
  open: "open",
}

/** The only way a `?stage=` value becomes a view. Unknown values are `null`. */
export function parseArtisanView(value: unknown): ArtisanJobsView | null {
  if (typeof value !== "string" || value.length > 24) return null
  return VIEW_ALIASES[value.toLowerCase()] ?? null
}

/** Link to My Jobs filtered to one stage (for the Overview stage strip). */
export function artisanJobsHref(view: ArtisanJobsView): string {
  return `/dashboard/artisan/jobs?stage=${view}`
}

// ── Rows ─────────────────────────────────────────────────────────────────────

export interface ArtisanJob {
  id: number | string
  title: string
  description?: string | null
  location?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  status: string
  createdAt: string
  deadline?: string | null
  bookingId?: number | null
  completionRequestedAt?: string | null
  hasApplied?: boolean
  customer?: { id: number | string; firstname?: string | null; lastname?: string | null } | null
  acceptedArtisan?: { id: number | string; firstname?: string | null; lastname?: string | null } | null
  service?: { id: number | string; name: string } | null
  budgetMin?: number | string | null
  budgetMax?: number | string | null
}

/** H1: a job is mine only when the API says I am its accepted artisan. */
export function isMyJob(job: Pick<ArtisanJob, "acceptedArtisan">, userId: string | number | undefined | null): boolean {
  return userId != null && job.acceptedArtisan?.id != null && String(job.acceptedArtisan.id) === String(userId)
}

/** Another artisan is known to have the job (only when the API sent `acceptedArtisan`). */
export function isSomeoneElsesJob(job: Pick<ArtisanJob, "acceptedArtisan">, userId: string | number | undefined | null): boolean {
  return job.acceptedArtisan?.id != null && String(job.acceptedArtisan.id) !== String(userId)
}

export type ArtisanJobStatusKey =
  | "open"
  | "applied"
  | "to_start"
  | "in_progress"
  | "waiting_on_client"
  | "done"
  | "cancelled"
  | "expired"
  | "other_artisan"

/** Which badge a row gets, from the artisan's point of view. */
export function artisanJobStatus(job: ArtisanJob, userId: string | number | undefined | null): ArtisanJobStatusKey {
  if (job.status === "OPEN") return job.hasApplied ? "applied" : "open"
  if (job.status === "EXPIRED") return "expired"
  if (job.status === "CANCELLED") return "cancelled"
  if (isSomeoneElsesJob(job, userId)) return "other_artisan"
  if (job.status === "PENDING") return "to_start"
  if (job.status === "IN_PROGRESS") return job.completionRequestedAt ? "waiting_on_client" : "in_progress"
  if (job.status === "COMPLETED") return "done"
  return "expired"
}

/** Whether a row belongs in a stage view (the server filtered by status already). */
export function rowMatchesView(job: ArtisanJob, view: ArtisanJobsView | null, userId: string | number | undefined | null): boolean {
  if (view === null || view === "open") return true
  // A job someone else got only shows here because I applied to it.
  if (view !== "closed" && isSomeoneElsesJob(job, userId)) return false
  if (view === "in_progress") return !job.completionRequestedAt
  if (view === "waiting_on_client") return Boolean(job.completionRequestedAt)
  return true
}

export const JOB_STATUS_NAMES: Record<string, string> = {
  OPEN: "Open",
  PENDING: "To start",
  IN_PROGRESS: "In progress",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
}

/** Readable status name for the timeline; never a raw enum. */
export function jobStatusName(status?: string | null): string {
  if (!status) return "Unknown"
  return JOB_STATUS_NAMES[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ")
}

// ── Formatting ───────────────────────────────────────────────────────────────

const TZ = "Africa/Accra"

/** Newer ICU writes en-GB September as "Sept"; the product uses three letters (same as `threeLetterMonth` in spending.ts; this module has no runtime imports). */
const threeLetterMonth = (s: string) => s.replace(/\bSept\b/g, "Sep")

/** "25 Oct 2026" */
export function formatDay(iso?: string | null): string {
  if (!iso) return ""
  // A bare calendar date is a day in Accra (UTC+0), not an instant.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return threeLetterMonth(d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }))
}

/** "Tue 4 Nov 2026" */
export function formatDayWithWeekday(iso?: string | null): string {
  if (!iso) return ""
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return threeLetterMonth(
    d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ }),
  )
}

/** "25 Oct 2026, 14:05" — no seconds. */
export function formatDayTime(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const day = formatDay(iso)
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ })
  return `${day}, ${time}`
}

/** "09:00:00" or "09:00" → "09:00". */
export function formatClock(time?: string | null): string {
  if (!time) return ""
  const m = /^(\d{1,2}):(\d{2})/.exec(time)
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : ""
}

export function personName(p?: { firstname?: string | null; lastname?: string | null } | null, fallback = "Former client"): string {
  const name = `${p?.firstname ?? ""} ${p?.lastname ?? ""}`.trim()
  return name || fallback
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** Google Maps directions to a job. Coordinates win over the typed address when both exist. */
export function directionsUrl(job: Pick<ArtisanJob, "location" | "latitude" | "longitude">): string | null {
  const lat = job.latitude != null ? Number(job.latitude) : NaN
  const lng = job.longitude != null ? Number(job.longitude) : NaN
  let destination = ""
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) destination = `${lat},${lng}`
  else if (job.location?.trim()) destination = job.location.trim()
  if (!destination) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

/** Where every "add a payout method" link goes (H8/H11). */
export const PAYOUT_SETTINGS_HREF = "/dashboard/artisan/settings?tab=payments#payout-method"
