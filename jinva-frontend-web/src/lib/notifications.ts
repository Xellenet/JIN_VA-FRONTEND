import type { Notification } from "@/lib/types"

/**
 * Shared notification wire-shape + mapping helpers.
 *
 * These used to live inside `components/dashboard/notifications-page.tsx`. The
 * header's notification dropdown (design-spec.md section 3) renders the same
 * rows from the same endpoint, and it cannot import from the page component —
 * that would create a cycle (notifications-page -> dashboard/layout ->
 * dashboard/header -> notifications-page). So the shapes and mappers live here
 * and both surfaces consume them.
 */

/** `GET /notifications` item shape (NotificationResponseDto). */
export interface BackendNotification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  payload?: unknown
  createdAt: string
}

/** `GET /notifications/unread-count` response shape. */
export interface UnreadCountResponse {
  count: number
}

/**
 * H5: the UI bucket for every type the backend sends (NotificationType in
 * `common/types/enums.ts`), named explicitly. Name matching used to file
 * `JOB_EXPIRED` and `JOB_APPLICATION_REJECTED` under "Assignment" just because
 * they contain "JOB"; the "assignment" bucket is now labelled "Job" and an
 * explicit list decides what goes in it. Types the frontend doesn't know yet
 * still fall back to the old substring rules.
 */
const TYPE_BUCKETS: Record<string, Notification["type"]> = {
  JOB_APPLICATION_RECEIVED: "assignment",
  JOB_APPLICATION_ACCEPTED: "assignment",
  JOB_APPLICATION_REJECTED: "assignment",
  JOB_STARTED: "assignment",
  JOB_COMPLETION_REQUESTED: "assignment",
  JOB_COMPLETED: "assignment",
  JOB_CANCELLED: "assignment",
  JOB_EXPIRED: "assignment",
  MESSAGE_RECEIVED: "message",
  REVIEW_RECEIVED: "review",
  REVIEW_FLAGGED: "review",
  ARTISAN_PROFILE_VERIFIED: "system",
  ARTISAN_VERIFICATION_REJECTED: "system",
  ARTISAN_VERIFICATION_SUBMITTED: "system",
  ARTISAN_REGISTERED: "system",
  BOOKING_RECEIVED: "booking",
  BOOKING_CONFIRMED: "booking",
  BOOKING_DECLINED: "booking",
  BOOKING_CANCELLED: "booking",
  BOOKING_COMPLETED: "booking",
  BOOKING_EXPIRED: "booking",
  BOOKING_NO_SHOW: "booking",
  BOOKING_REMINDER: "booking",
  PORTFOLIO_APPROVED: "system",
  PORTFOLIO_REJECTED: "system",
  SECURITY_ALERT: "system",
  PAYMENT_RECEIPT: "payment",
  PAYMENT_SECURED: "payment",
  PAYOUT_RELEASED: "payment",
  PAYMENT_REFUNDED: "payment",
  PAYMENT_TRANSFER_FAILED: "payment",
  DISPUTE_FILED: "dispute",
  DISPUTE_RESOLVED: "dispute",
  DISPUTE_CLOSED: "dispute",
}

export function mapNotificationType(type: string): Notification["type"] {
  const t = typeof type === "string" ? type.toUpperCase() : ""
  const known = Object.prototype.hasOwnProperty.call(TYPE_BUCKETS, t) ? TYPE_BUCKETS[t] : undefined
  if (known) return known
  // Checked before PAYMENT so a dispute type is never mistaken for one, and
  // before the rest so `DISPUTE_*` stops falling through to "system"
  // (design-spec.md §6.5; the live type list is api-contract.md §5).
  if (t.includes("DISPUTE")) return "dispute"
  if (t.includes("PAYMENT") || t.includes("REFUND") || t.includes("PAYOUT")) return "payment"
  if (t.includes("REVIEW")) return "review"
  if (t.includes("MESSAGE")) return "message"
  if (t.includes("BOOKING")) return "booking"
  if (t.includes("JOB") || t.includes("ASSIGN")) return "assignment"
  return "system"
}

/** Newer ICU writes en-GB September as "Sept"; the product uses three letters (same as `threeLetterMonth` in spending.ts; this module has no runtime imports). */
const threeLetterMonth = (s: string) => s.replace(/\bSept\b/g, "Sep")

export function formatNotificationTime(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return threeLetterMonth(d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Accra" }))
}

export function mapNotification(n: BackendNotification): Notification {
  return {
    id: n.id,
    title: n.title,
    message: n.body,
    type: mapNotificationType(n.type),
    isRead: n.isRead,
    time: formatNotificationTime(n.createdAt),
    // Item 6 (§6.5): the expanded row needs the original timestamp and the
    // payload's typed ids. Both used to be dropped here.
    rawType: n.type,
    payload: n.payload,
    createdAt: n.createdAt,
  }
}

// ── Item 6: read in place (pure helpers; no runtime imports, see 04 §3.2) ──

/** The one action button an expanded notification can show. */
export interface NotificationAction {
  label:
    | "View job"
    | "View booking"
    | "Open conversation"
    | "View payment"
    | "View earnings"
    | "View dispute"
    | "View reviews"
    | "View portfolio"
    | "View verification"
  href: string
}

/** Which dashboard a notification's action button points into. */
export type NotificationRole = "user" | "artisan"

/**
 * Reads a positive safe integer id from a payload key, and nothing else.
 * Strings are accepted only when they are a plain run of digits (the JSON
 * column round-trips numbers, but a defensive `"812"` should still work);
 * `"812/../admin"`, `"12abc"`, `1.5`, `-1`, `0` and URLs all give null.
 */
export function typedId(payload: unknown, key: string): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null
  const raw = (payload as Record<string, unknown>)[key]
  let n: number
  if (typeof raw === "number") n = raw
  else if (typeof raw === "string" && /^[1-9][0-9]{0,15}$/.test(raw)) n = Number(raw)
  else return null
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

const CUSTOMER_BASE = "/dashboard/user"
const ARTISAN_BASE = "/dashboard/artisan"

function isPaymentType(t: string): boolean {
  return !t.includes("DISPUTE") && (t.includes("PAYMENT") || t.includes("REFUND") || t.includes("PAYOUT"))
}

/**
 * H5: the artisan's destinations. Same SEC-18 rules as the customer map: only
 * typed ids are read, every href is a fixed path under `/dashboard/artisan/`.
 *
 * - message → the conversation (`?conversation=`)
 * - dispute → the artisan's dispute page; without a `disputeId`, the booking
 *   or job it is about
 * - payment / payout / refund → Earnings (the payout lives there, not on the job)
 * - review → Reviews
 * - booking → Calendar, with `?booking=` so the calendar can pick it out
 * - job → the job page
 * - portfolio / verification outcomes → those pages
 */
function artisanAction(t: string, payload: unknown): NotificationAction | null {
  const jobId = typedId(payload, "jobId")
  const bookingId = typedId(payload, "bookingId")
  const conversationId = typedId(payload, "conversationId")
  const disputeId = typedId(payload, "disputeId")
  const bookingHref = (id: number) => `${ARTISAN_BASE}/calendar?booking=${id}`

  if (conversationId !== null) {
    return { label: "Open conversation", href: `${ARTISAN_BASE}/messages?conversation=${conversationId}` }
  }
  if (t.includes("DISPUTE")) {
    if (disputeId !== null) return { label: "View dispute", href: `${ARTISAN_BASE}/disputes/${disputeId}` }
    if (bookingId !== null) return { label: "View booking", href: bookingHref(bookingId) }
    if (jobId !== null) return { label: "View job", href: `${ARTISAN_BASE}/jobs/${jobId}` }
    return null
  }
  if (isPaymentType(t)) return { label: "View earnings", href: `${ARTISAN_BASE}/earnings` }
  if (t.includes("REVIEW")) return { label: "View reviews", href: `${ARTISAN_BASE}/profile?tab=reviews` }
  if (t.startsWith("PORTFOLIO_")) return { label: "View portfolio", href: `${ARTISAN_BASE}/profile?tab=portfolio` }
  if (t === "ARTISAN_PROFILE_VERIFIED" || t === "ARTISAN_VERIFICATION_REJECTED") {
    return { label: "View verification", href: `${ARTISAN_BASE}/settings?tab=verification` }
  }
  if (bookingId !== null) return { label: "View booking", href: bookingHref(bookingId) }
  if (jobId !== null) return { label: "View job", href: `${ARTISAN_BASE}/jobs/${jobId}` }
  return null
}

/**
 * SEC-18 / FR-6.9: the only place a notification's action button is built.
 *
 * - Only typed ids are read (`jobId`, `bookingId`, `conversationId`,
 *   `paymentId`, `disputeId`), through `typedId`. Any `url`, `href`, `link` or
 *   other string key in the payload is ignored, so the data can never pick the
 *   destination.
 * - Every href is a fixed path under the role's own dashboard
 *   (`/dashboard/user/` by default, `/dashboard/artisan/` for artisans), or
 *   there is no button (`null`).
 */
export function notificationAction(
  type: string,
  payload: unknown,
  role: NotificationRole = "user",
): NotificationAction | null {
  const t = typeof type === "string" ? type.toUpperCase() : ""
  if (role === "artisan") return artisanAction(t, payload)

  const jobId = typedId(payload, "jobId")
  const bookingId = typedId(payload, "bookingId")
  const conversationId = typedId(payload, "conversationId")
  const paymentId = typedId(payload, "paymentId")

  if (conversationId !== null) {
    return { label: "Open conversation", href: `${CUSTOMER_BASE}/messages?conversation=${conversationId}` }
  }
  if (isPaymentType(t)) {
    // The job page carries the payment panel; without a job the Spending page
    // (item 4) is the payment's home. Both are fixed internal routes.
    if (jobId !== null) return { label: "View payment", href: `${CUSTOMER_BASE}/jobs/${jobId}` }
    if (paymentId !== null) return { label: "View payment", href: `${CUSTOMER_BASE}/report` }
    return null
  }
  if (bookingId !== null) return { label: "View booking", href: `${CUSTOMER_BASE}/bookings/${bookingId}` }
  if (jobId !== null) return { label: "View job", href: `${CUSTOMER_BASE}/jobs/${jobId}` }
  return null
}

/** The role whose routes a dashboard base maps to, or null for one with no actions (admin). */
export function notificationRoleFor(roleBase: string): NotificationRole | null {
  if (roleBase === CUSTOMER_BASE) return "user"
  if (roleBase === ARTISAN_BASE) return "artisan"
  return null
}

/** `notificationAction(...)?.href ?? null`, the name 01 §11.5 uses. */
export function notificationHref(type: string, payload: unknown, role: NotificationRole = "user"): string | null {
  return notificationAction(type, payload, role)?.href ?? null
}

/**
 * FR-6.11: a message notification's body is the server's first 100
 * characters followed by "…". Only then does the row add the "start of the
 * message" line.
 */
export function isMessageExcerpt(type: string | undefined, body: string): boolean {
  return (type ?? "").toUpperCase().includes("MESSAGE") && body.endsWith("…")
}

/**
 * FR-6.2 / NFR-7.3: "Thu 30 Oct 2026, 2:14 pm" in Africa/Accra, whatever the
 * device's own timezone. Returns "" for an unparseable value.
 */
export function formatFullDateTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ""
  const period = get("dayPeriod").toLowerCase().replace(/\./g, "")
  return `${get("weekday")} ${get("day")} ${threeLetterMonth(get("month"))} ${get("year")}, ${get("hour")}:${get("minute")} ${period}`
}

/**
 * `GET /notifications` has been observed returning both a bare array and the
 * `{ items: [...] }` envelope depending on the deployed backend build — the
 * same dual-shape guard the rest of this app applies to paginated list
 * endpoints.
 */
export function readNotificationList(r: BackendNotification[] | { items?: BackendNotification[] }): BackendNotification[] {
  if (Array.isArray(r)) return r
  return r?.items ?? []
}

/**
 * Strips the preferences row's own `id` out of a notification-preferences
 * payload before it is PATCHed back.
 *
 * `GET /notifications/preferences` includes `id` (the NotificationPreferences
 * row's primary key), but the Settings screens build their PATCH body from
 * that same fetched object — and `PATCH /notifications/preferences` validates
 * against `UpdateNotificationPreferencesDto` behind a global ValidationPipe
 * with `forbidNonWhitelisted: true`. An undeclared property doesn't get
 * ignored, it 400s the whole request: verified live against the running
 * backend, `PATCH` with the unmodified GET payload returns
 * `["property id should not exist", ...]` and nothing saves at all.
 *
 * `id` is row metadata, never a user preference, so dropping it client-side is
 * the correct fix rather than something the backend should start accepting.
 */
export function stripPreferenceMetadata<T extends object>(prefs: T): Omit<T, "id"> {
  const rest = { ...prefs } as T & { id?: unknown }
  delete rest.id
  return rest as Omit<T, "id">
}
