"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { resolveMediaUrl } from "@/lib/utils"
import type { ReviewPhoto } from "@/lib/types"

/**
 * Read-side thumbnail row + lightbox for review photos (RP1) —
 * design-spec.md §5.4/§8: "the same click-to-enlarge idiom already used by
 * the Portfolio Gallery, reused here rather than inventing a second
 * image-viewer pattern." Kept as its own small component (rather than
 * reworking `portfolio-gallery.tsx`'s masonry-grid-coupled lightbox) since
 * every review-rendering surface here needs a compact inline thumbnail row,
 * not a gallery grid — the interaction idiom (click to open, arrow-key
 * nav, Escape/click-outside dismiss) is identical.
 */
export function ReviewPhotoThumbnails({
  photos,
  size = "md",
}: Readonly<{ photos: ReviewPhoto[]; size?: "sm" | "md" }>) {
  const [index, setIndex] = useState<number | null>(null)

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null)
      if (e.key === "ArrowRight") setIndex((i) => (i === null ? i : Math.min(i + 1, photos.length - 1)))
      if (e.key === "ArrowLeft") setIndex((i) => (i === null ? i : Math.max(i - 1, 0)))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, photos.length])

  if (photos.length === 0) return null

  const active = index !== null ? photos[index] : null
  const tileClass = size === "sm" ? "h-12 w-12" : "h-14 w-14"

  return (
    <>
      <div className="mt-3 flex items-center gap-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setIndex(i)}
            className={`${tileClass} overflow-hidden rounded-lg border border-border bg-muted`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveMediaUrl(photo.url)}
              alt="Review attachment"
              className="h-full w-full object-cover transition-transform hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
        <span className="text-[11px] text-muted-foreground">
          {photos.length} photo{photos.length !== 1 ? "s" : ""} attached
        </span>
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4"
          onClick={() => setIndex(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setIndex(null) }}
          role="dialog"
          aria-modal="true"
          aria-label="Review photo preview"
        >
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()} onKeyDown={() => {}} role="document">
            <Button
              size="icon"
              variant="ghost"
              className="absolute -right-2 -top-12 z-10 h-9 w-9 rounded-full bg-background/90 shadow-md hover:bg-background"
              onClick={() => setIndex(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            {index! > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute -left-4 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-background/90 shadow-md hover:bg-background sm:-left-14"
                onClick={() => setIndex((i) => (i === null ? i : Math.max(i - 1, 0)))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {index! < photos.length - 1 && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute -right-4 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-background/90 shadow-md hover:bg-background sm:-right-14"
                onClick={() => setIndex((i) => (i === null ? i : Math.min(i + 1, photos.length - 1)))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
            <div className="overflow-hidden rounded-lg bg-background shadow-2xl">
              <div className="flex max-h-[75vh] items-center justify-center bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveMediaUrl(active.url)}
                  alt="Review attachment"
                  className="max-h-[75vh] w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
