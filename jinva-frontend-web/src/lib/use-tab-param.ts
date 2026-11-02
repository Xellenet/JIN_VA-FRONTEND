"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * A page's tabs, kept in `?tab=` so each one can be linked to and survives a
 * reload. Unknown values open `fallback`; `aliases` map old tab names (from
 * links and bookmarks made before a rename) to current ones.
 *
 * Changing tab drops the other query parameters, which belong to the tab being
 * left (a period, a filter, a page number).
 */
export function useTabParam<T extends string>(
  tabs: readonly T[],
  fallback: T,
  aliases: Readonly<Record<string, T>> = {},
): readonly [T, (next: string) => void] {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const raw = searchParams.get("tab")
  const active: T =
    raw && (tabs as readonly string[]).includes(raw) ? (raw as T) : (raw && aliases[raw]) || fallback

  const change = useCallback(
    (next: string) => {
      router.replace(`${pathname}?tab=${encodeURIComponent(next)}`, { scroll: false })
    },
    [router, pathname],
  )

  return [active, change] as const
}
