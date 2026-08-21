/**
 * Shared direct-message wire shapes + helpers.
 *
 * Extracted from `components/dashboard/messages-page.tsx` so the header's
 * message-preview dropdown (design-spec.md section 3) can render the same
 * conversation rows without importing from the page component — that would
 * cycle through dashboard/layout -> dashboard/header.
 *
 * NOTE: these shapes describe the `/direct-messages/*` module.
 *
 * TODO(messaging-notifications, pass 2 — MB1 rewire): as of 2026-08-21 the
 * backend has retired `/direct-messages` entirely and made `/messages` the
 * canonical module (`POST /messages`, `GET /messages`, `GET /messages/:id`,
 * `PATCH /messages/:id/read`). Every `/direct-messages/*` call in the frontend
 * therefore 500s / 404s until it is repointed — that rewire is deliberately out
 * of scope for this pass because the response shapes aren't published in
 * api-contract.md yet, and guessing them is exactly what the contract exists to
 * prevent. The call sites to change are `messages-page.tsx` (list, thread,
 * mark-read, send) and `messages-popover.tsx` (list); the shapes below are the
 * single place their types need updating.
 */

export interface BackendContact {
  id: number
  firstname: string
  lastname: string
  profilePicture: string | null
}

export interface BackendConversation {
  contact: BackendContact
  lastMessage: string
  lastMessageTime: string
  lastSenderId: number
  unreadCount: number
}

export interface BackendDM {
  id: number
  content: string
  isRead: boolean
  createdAt: string
  sender: BackendContact
}

export function contactName(c: BackendContact): string {
  return `${c.firstname} ${c.lastname}`.trim()
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
 */
export function conversationHref(role: string, roleBase: string, contactId: number): string {
  if (role === "artisan") return `${roleBase}/messages?client=${contactId}`
  if (role === "admin") return `${roleBase}/messages`
  return `${roleBase}/messages?artisan=${contactId}`
}
