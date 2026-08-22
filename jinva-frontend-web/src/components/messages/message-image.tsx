"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, resolveMediaUrl } from "@/lib/utils"

/**
 * MC4 read side — an image attachment rendered inline in a message bubble,
 * opening the app's existing click-to-enlarge lightbox idiom on tap
 * (design-spec.md §6.1/§4).
 *
 * Same interaction as `portfolio/portfolio-gallery.tsx` and
 * `reviews/review-photo-thumbnails.tsx`: click to open, Escape or click-outside
 * to dismiss. Neither of those could be reused verbatim — the portfolio one is
 * coupled to a masonry grid of `ApiPortfolioItem`s and the review one to a
 * thumbnail row with a "N photos attached" caption — and a message carries
 * exactly one image, so there is nothing to arrow between. This is the same
 * idiom at single-image scale, shared by the two surfaces that need it (the
 * chat thread and the admin dispute viewer) rather than written twice.
 */
export function MessageImage({
  url,
  className,
  onLoad,
}: Readonly<{
  url: string
  className?: string
  /**
   * Fired once the thumbnail has actually painted. The thread auto-scrolls when
   * the message count changes, which happens *before* an image has height — so
   * without this the newest image bubble ends up half below the fold.
   */
  onLoad?: () => void
}>) {
  const [isOpen, setIsOpen] = useState(false)
  const src = resolveMediaUrl(url)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "block overflow-hidden rounded-lg border border-border/40 bg-muted",
          className,
        )}
        aria-label="Open image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Message attachment"
          className="h-auto w-full max-w-[240px] object-cover"
          loading="lazy"
          onLoad={onLoad}
        />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4"
          onClick={() => setIsOpen(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setIsOpen(false) }}
          role="dialog"
          aria-modal="true"
          aria-label="Message attachment preview"
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={() => {}}
            role="document"
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute -right-2 -top-12 z-10 h-9 w-9 rounded-full bg-background/90 shadow-md hover:bg-background"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="overflow-hidden rounded-lg bg-background shadow-2xl">
              <div className="flex max-h-[75vh] items-center justify-center bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Message attachment" className="max-h-[75vh] w-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
