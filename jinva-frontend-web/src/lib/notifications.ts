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
  if (t.includes("PAYMENT") || t.includes("REFUND")) return "payment"
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
  }
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
