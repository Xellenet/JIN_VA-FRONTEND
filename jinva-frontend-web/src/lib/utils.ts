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
