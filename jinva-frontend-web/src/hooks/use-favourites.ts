"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

interface FavouriteArtisanRef {
  id: string
}

// FB1: the real `GET /favourites` response is `{ message, data, pagination }`
// — there is no `items` field. Defensively also accept a bare array in case
// the shape is ever simplified server-side (matches the dual-shape check
// pattern used for other paginated list endpoints across the app).
interface FavouritesEnvelope {
  message?: string
  data?: FavouriteArtisanRef[]
  pagination?: { total: number; page: number; limit: number; totalPages: number }
}

function extractFavouriteIds(response: FavouriteArtisanRef[] | FavouritesEnvelope): string[] {
  const items = Array.isArray(response) ? response : response?.data ?? []
  return items.map((a) => a.id)
}

export function useFavouriteIds() {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<FavouriteArtisanRef[] | FavouritesEnvelope>("/favourites")
      .then((r) => setFavouriteIds(new Set(extractFavouriteIds(r))))
      .catch(() => {})
  }, [])

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
