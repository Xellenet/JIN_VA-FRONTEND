/**
 * Shared messaging wire shapes + helpers for the canonical `/messages` module.
 *
 * Extracted from `components/dashboard/messages-page.tsx` so the header's
 * message-preview dropdown (design-spec.md section 3) can render the same
 * conversation rows without importing from the page component — that would
 * cycle through dashboard/layout -> dashboard/header.
 *
 * MB1: these shapes describe `/messages` (api-contract.md §2), which replaced
 * the retired `/direct-messages/*` module. The two differences that matter most
 * when reading call sites:
 *   1. A conversation now has its own `id`, and that — not the other user's id —
 *      is what `GET /messages/:id` and `PATCH /messages/:id/read` take
 *      (api-contract.md §2.1). Only `POST /messages` still addresses a user, via
 *      `recipientId`, which is what makes a first send from a deep link work
 *      before any conversation exists.
 *   2. `content` is nullable, because MC4 allows an image-only message.
 */

export interface BackendContact {
  id: number
  firstname: string
  lastname: string
  profilePicture: string | null
  /** `/messages` resolves this relative to the caller; absent on migrated rows. */
  role?: "CUSTOMER" | "ARTISAN" | "ADMIN"
}

/** The conversation list's nested last-message preview (api-contract.md §2). */
export interface BackendLastMessage {
  id: number
  content: string | null
  attachmentUrl: string | null
  senderId: number
  createdAt: string
  isRead: boolean
}

export interface BackendConversation {
  id: number
  contact: BackendContact
  lastMessage: BackendLastMessage | null
  lastMessageAt?: string | null
  unreadCount: number
  createdAt?: string
}

export interface BackendDM {
  id: number
  content: string | null
  attachmentUrl: string | null
  attachmentType: string | null
  jobId: number | null
  bookingId: number | null
  isRead: boolean
  createdAt: string
  sender: BackendContact
}

/** `POST /messages` body (api-contract.md §3). */
export interface SendMessagePayload {
  recipientId: number
  content?: string
  attachmentUrl?: string
  jobId?: number
  bookingId?: number
}

export function contactName(c: BackendContact): string {
  return `${c.firstname} ${c.lastname}`.trim()
}

/**
 * What a conversation row shows as its preview line. `content` is null for an
 * image-only message, in which case api-contract.md §2 asks for something
 * derived from the attachment rather than an empty row.
 */
export function lastMessagePreview(m: BackendLastMessage | null): string {
  if (!m) return ""
  if (m.content?.trim()) return m.content
  if (m.attachmentUrl) return "📷 Photo"
  return ""
}

/** Sort key for a conversation row — `lastMessageAt` with the message as fallback. */
export function conversationTimestamp(c: BackendConversation): string | null {
  return c.lastMessageAt ?? c.lastMessage?.createdAt ?? null
}

/** Relative-then-absolute timestamp, matching the conversation list's idiom. */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Day label for the admin dispute thread's date dividers (design-spec.md §4). */
export function formatMessageDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (isSameDay(d, today)) return "Today"
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(d, yesterday)) return "Yesterday"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/**
 * HB1's Mail badge count: the number of conversations that have at least one
 * unread message. Derived client-side from the conversation list the app
 * already fetches — there is no dedicated unread-conversations endpoint and
 * this feature does not add one.
 */
export function countUnreadConversations(conversations: readonly BackendConversation[]): number {
  return conversations.filter((c) => c.unreadCount > 0).length
}

/**
 * Deep link that opens a specific conversation for the current role. The two
 * route wrappers read different params — `user/messages` reads `?artisan=`,
 * `artisan/messages` reads `?client=` — and the admin wrapper reads neither,
 * so admin falls back to the plain inbox.
 *
 * `contactId` is always a **user** id, never an artisan-profile id (qa-report.md
 * F4): the Messages page resolves it against each row's `contact.id`, and a
 * first send posts it as `recipientId`.
 *
 * `context` appends MC2's job/booking reference so a message sent from a
 * job/booking detail page carries that reference through to the backend.
 */
export function conversationHref(
  role: string,
  roleBase: string,
  contactId: number | string,
  context?: { jobId?: number | string; bookingId?: number | string },
): string {
  if (role === "admin") return `${roleBase}/messages`
  const param = role === "artisan" ? "client" : "artisan"
  const query = new URLSearchParams({ [param]: String(contactId) })
  if (context?.jobId != null) query.set("job", String(context.jobId))
  else if (context?.bookingId != null) query.set("booking", String(context.bookingId))
  return `${roleBase}/messages?${query.toString()}`
}

// ── MC4 attachments ─────────────────────────────────────────────────────────

/**
 * Client-side mirror of `POST /uploads/message-attachment`'s own limits
 * (api-contract.md §3: JPEG/PNG only, 5MB — the same number already used for
 * review photos and KYC selfies). Enforced here too so an obviously-invalid
 * file is rejected immediately instead of costing a round-trip (MC4).
 */
export const ATTACHMENT_ACCEPTED_TYPES = ["image/jpeg", "image/png"]
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024

export function validateAttachment(file: File): string | null {
  if (!ATTACHMENT_ACCEPTED_TYPES.includes(file.type)) {
    return "Only JPEG or PNG images can be attached."
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return "That image is larger than 5MB."
  }
  return null
}
