"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch, apiFetchBody } from "@/lib/api"
import { toast } from "sonner"

interface FavouriteArtisanRef {
  id: string
}

/** The API's largest page size for GET /favourites. */
const FAVOURITES_PAGE_SIZE = 50

/**
 * QA FAV-04: every saved artisan, across all pages. A single unpaged call
 * returned the first 10, so the page and the search hearts stopped there.
 */
export async function fetchAllFavourites<T>(): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; ; page++) {
    const body = await apiFetchBody<
      T[] | { data?: T[]; meta?: { pagination?: { totalPages?: number } } }
    >(`/favourites?page=${page}&limit=${FAVOURITES_PAGE_SIZE}`)
    const items = Array.isArray(body) ? body : body?.data ?? []
    all.push(...items)
    const totalPages = Array.isArray(body) ? 1 : (body?.meta?.pagination?.totalPages ?? 1)
    if (page >= totalPages || items.length < FAVOURITES_PAGE_SIZE) return all
  }
}

/**
 * @param enabled false skips loading the saved set — for viewers who can't
 * save artisans (an artisan previewing their own client-facing profile), so
 * the page doesn't fire a request the API would refuse.
 */
export function useFavouriteIds({ enabled = true }: { enabled?: boolean } = {}) {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    fetchAllFavourites<FavouriteArtisanRef>()
      .then((items) => setFavouriteIds(new Set(items.map((a) => a.id))))
      .catch(() => {})
  }, [enabled])

  const toggleFavourite = useCallback(
    async (artisanId: string) => {
      const isFavourited = favouriteIds.has(artisanId)
      setPendingId(artisanId)
      try {
        await apiFetch(`/favourites/${artisanId}`, { method: isFavourited ? "DELETE" : "POST" })
        setFavouriteIds((prev) => {
          const next = new Set(prev)
          if (isFavourited) next.delete(artisanId)
          else next.add(artisanId)
          return next
        })
        toast.success(isFavourited ? "Removed from favourites." : "Added to favourites.")
      } catch (err) {
        // Edge case: duplicate-favourite 409 should read as a friendly no-op,
        // not a raw error — surface it that way while still reconciling the
        // local Set state with reality.
        const message = err instanceof Error ? err.message : ""
        if (/already/i.test(message)) {
          setFavouriteIds((prev) => new Set(prev).add(artisanId))
          toast.info("Already in your favourites.")
        } else {
          toast.error(message || "Failed to update favourites.")
        }
      } finally {
        setPendingId(null)
      }
    },
    [favouriteIds],
  )

  return { favouriteIds, pendingId, toggleFavourite }
}
