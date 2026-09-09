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
  /**
   * Typed as required because every documented payload carries it, but the wire
   * can omit it for a participant who has soft-deleted their account
   * (qa-report.md B7) — so anything that *addresses* a contact guards on a
   * finite id at runtime rather than trusting this.
   */
  id: number
  /**
   * Optional because a soft-deleted participant's payload carries **no** name
   * keys at all (qa-report.md FE-7 — the raw response is
   * `"contact":{"profilePicture":null}`), and because a purged row's names are
   * the anonymized placeholders. Never read these directly for display: go
   * through `contactName()`, which is the only place the fallback lives.
   */
  firstname?: string | null
  lastname?: string | null
  /** Tolerated for a placeholder participant labelled with one name field. */
  name?: string | null
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
  /**
   * `null` when the sender has soft-deleted their account — `GET /messages/:id`
   * returns `"sender": null` on the departed party's messages (qa-report.md
   * B7). Reading `sender.id` unguarded threw and took the whole thread render
   * down with it, which is why every call site optional-chains this.
   */
  sender: BackendContact | null
}

/** `POST /messages` body (api-contract.md §3). */
export interface SendMessagePayload {
  recipientId: number
  content?: string
  attachmentUrl?: string
  jobId?: number
  bookingId?: number
}

/**
 * What a participant with no renderable name is called. C1.7 asks for "no blank
 * name, no `null`, no crash" when the other party has left, and the deletion
 * flow makes that a routine 30-day state rather than a rarity.
 *
 * Spelled to match the placeholder the purge writes onto the row itself
 * (api-contract.md: names become `Deleted` / `User`, "so anything joining the
 * row renders 'Deleted User'"). That matters because a `null` message sender
 * has no placeholder to carry — it falls back to this string — while the
 * conversation's `contact` does carry one, and the two must not disagree
 * within a single screen.
 */
export const DELETED_PARTICIPANT_NAME = "Deleted User"

/**
 * The only place a messaging participant's display name is built.
 *
 * Both name parts are optional on the wire (see `BackendContact`), and the
 * template-literal version of this used to print a literal `undefined undefined`
 * as a person's name in the inbox row and the thread header (qa-report.md
 * FE-7). Anything missing, null, or whitespace-only falls back to
 * `DELETED_PARTICIPANT_NAME`; a half-present name renders the half that exists.
 */
export function contactName(c: BackendContact | null | undefined): string {
  const clean = (part: string | null | undefined) => (typeof part === "string" ? part.trim() : "")
  const fromParts = [clean(c?.firstname), clean(c?.lastname)].filter(Boolean).join(" ")
  // `firstname`/`lastname` is the documented shape, so it wins; the
  // single-field `name` is only consulted when neither part is present.
  return fromParts || clean(c?.name) || DELETED_PARTICIPANT_NAME
}

/**
 * What a conversation row shows as its preview line. `content` is null for an
 * image-only message, in which case api-contract.md §2 asks for something
 * derived from the attachment rather than an empty row.
 */
export function lastMessagePreview(
  m: Pick<BackendLastMessage, "content" | "attachmentUrl"> | null | undefined,
): string {
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
