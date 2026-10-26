import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The one way money is rendered in this app: GH₵ (Ghana Cedis), thousands
 * separated, always two decimal places.
 *
 * Both options are load-bearing rather than cosmetic:
 *
 *  - **The pesewas are padded.** A bare `toLocaleString()` drops trailing
 *    zeros, so a partial refund of 90.50 rendered on an irreversible confirm
 *    button as "Refund GH₵ 90.5 to client" (qa-report.md QA-DC1-02). An amount
 *    that is about to move someone's money has to read exactly as it will be
 *    charged.
 *  - **The locale is pinned.** A bare `toLocaleString()` follows whatever
 *    locale the renderer happens to run under — which is the server's on the
 *    first paint and the browser's afterwards, so the same cedi amount could
 *    be grouped two different ways in one session. `en-GB` is the convention
 *    the rest of the app already formats dates with.
 */
export function formatCurrency(amount: number | string): string {
  return `GH₵ ${Number(amount).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/api\/v1\/?$/, "")

/**
 * Resolves a file URL returned by the backend (avatars, portfolio items,
 * etc). Per api-contract.md, `fileUrl` may be an absolute-from-root path
 * (local storage provider) or a full URL (e.g. once S3 is switched on) —
 * this normalizes either into something a browser can actually load.
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`
}

/**
 * The one way to turn a stored `profilePicture` into an `<AvatarImage src>`.
 *
 * It resolves relative `/uploads/…` paths against the API origin (a bare
 * relative path 404s on the frontend's own origin). With no picture it returns
 * `""`, and every `<Avatar>` shows its `<AvatarFallback>` (initials or icon).
 *
 * There is deliberately no generated placeholder: the previous one fetched
 * `api.navii.dev/avatar/<name or email>`, sending users' names and emails to a
 * third party on every dashboard (QA SEC-15 / UI-11).
 */
export function resolveAvatarUrl(url: string | null | undefined): string {
  return resolveMediaUrl(url)
}

/**
 * The API returns booking and slot times as 'HH:MM:SS' but accepts 'HH:MM'.
 * `toClockTime` gives the full form for building dates (an 'HH:MM:SS' value
 * plus ':00' made an Invalid Date, so "has this ended?" was never true);
 * `formatClockTime` gives 'HH:MM' for display.
 */
export function toClockTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time
}

export function formatClockTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : ""
}
