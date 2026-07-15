"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

interface FavouriteArtisan {
  id: string
}

export function useFavouriteIds() {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<FavouriteArtisan[] | { items: FavouriteArtisan[] }>("/favourites")
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: FavouriteArtisan[] }).items ?? []
        setFavouriteIds(new Set(items.map((a) => a.id)))
      })
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
        toast.error(err instanceof Error ? err.message : "Failed to update favourites.")
      } finally {
        setPendingId(null)
      }
    },
    [favouriteIds],
  )

  return { favouriteIds, pendingId, toggleFavourite }
}
