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

export function mapNotificationType(type: string): Notification["type"] {
  const t = type.toUpperCase()
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

export function formatNotificationTime(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
  label: "View job" | "View booking" | "Open conversation" | "View payment"
  href: string
}

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

/**
 * SEC-18 / FR-6.9: the only place a notification's action button is built.
 *
 * - Only typed ids are read (`jobId`, `bookingId`, `conversationId`,
 *   `paymentId`), through `typedId`. Any `url`, `href`, `link` or other string
 *   key in the payload is ignored, so the data can never pick the destination.
 * - Every href is a fixed path under `/dashboard/user/`, or there is no
 *   button (`null`).
 */
export function notificationAction(type: string, payload: unknown): NotificationAction | null {
  const t = typeof type === "string" ? type.toUpperCase() : ""
  const jobId = typedId(payload, "jobId")
  const bookingId = typedId(payload, "bookingId")
  const conversationId = typedId(payload, "conversationId")
  const paymentId = typedId(payload, "paymentId")

  if (conversationId !== null) {
    return { label: "Open conversation", href: `${CUSTOMER_BASE}/messages?conversation=${conversationId}` }
  }
  const isPayment = !t.includes("DISPUTE") && (t.includes("PAYMENT") || t.includes("REFUND") || t.includes("PAYOUT"))
  if (isPayment) {
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

/** `notificationAction(...)?.href ?? null`, the name 01 §11.5 uses. */
export function notificationHref(type: string, payload: unknown): string | null {
  return notificationAction(type, payload)?.href ?? null
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
  return `${get("weekday")} ${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} ${period}`
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
