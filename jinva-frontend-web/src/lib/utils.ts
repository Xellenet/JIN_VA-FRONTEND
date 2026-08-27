import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function naviiAvatar(seed: string, size = 96): string {
  return `https://api.navii.dev/avatar/${encodeURIComponent(seed)}?size=${size}&packs=command-center&style=neutral&mood=serious&tileBg=auto`
}

export function formatCurrency(amount: number | string): string {
  return `GH₵ ${Number(amount).toLocaleString()}`
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
 * Every avatar in the app used to be written as
 * `user.profilePicture || naviiAvatar(name)`, which skipped `resolveMediaUrl()`
 * — so a picture stored as a relative `/uploads/avatars/…` path (what the local
 * storage provider returns) was requested from the FRONTEND's own origin and
 * 404'd. It was invisible because `AvatarImage` silently falls back to the
 * `AvatarFallback` initials, so the only symptom was a failed request in the
 * network tab.
 *
 * Combining both steps in one helper is deliberate: the two-expression idiom is
 * what made it easy to forget the resolution, and the fallback has to come
 * second because `resolveMediaUrl()` returns `""` for a missing picture.
 * `naviiAvatar()` already returns an absolute URL, so it needs no resolution.
 */
export function resolveAvatarUrl(url: string | null | undefined, seed: string, size?: number): string {
  return resolveMediaUrl(url) || naviiAvatar(seed, size)
}
