"use client"

import { useState } from "react"
import { Lightbox } from "@/components/ui/lightbox"
import { resolveMediaUrl } from "@/lib/utils"
import type { ReviewPhoto } from "@/lib/types"

/**
 * Read-side thumbnail row for review photos (RP1) — design-spec.md §5.4/§8:
 * "the same click-to-enlarge idiom already used by the Portfolio Gallery,
 * reused here rather than inventing a second image-viewer pattern." The
 * thumbnail row is specific to reviews; the overlay it opens is the shared
 * `ui/lightbox.tsx`, which now backs this, the portfolio gallery and message
 * image attachments (click to open, arrow-key nav, Escape/click-outside
 * dismiss — all unchanged, just no longer written out three times).
 */
export function ReviewPhotoThumbnails({
  photos,
  size = "md",
}: Readonly<{ photos: ReviewPhoto[]; size?: "sm" | "md" }>) {
  const [index, setIndex] = useState<number | null>(null)

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
        <Lightbox
          label="Review photo preview"
          onClose={() => setIndex(null)}
          onPrev={index! > 0 ? () => setIndex((i) => (i === null ? i : Math.max(i - 1, 0))) : undefined}
          onNext={
            index! < photos.length - 1
              ? () => setIndex((i) => (i === null ? i : Math.min(i + 1, photos.length - 1)))
              : undefined
          }
        >
          <div className="flex max-h-[75vh] items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveMediaUrl(active.url)}
              alt="Review attachment"
              className="max-h-[75vh] w-full object-contain"
            />
          </div>
        </Lightbox>
      )}
    </>
  )
}
