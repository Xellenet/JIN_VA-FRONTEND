"use client"

import { useState } from "react"
import { Lightbox } from "@/components/ui/lightbox"
import { cn, resolveMediaUrl } from "@/lib/utils"

/**
 * MC4 read side — an image attachment rendered inline in a message bubble,
 * opening the app's shared click-to-enlarge overlay on tap
 * (design-spec.md §6.1/§4).
 *
 * The overlay itself is `ui/lightbox.tsx`, the same one the portfolio gallery
 * and the review-photo row use — one image-viewing idiom across all three
 * surfaces. A message carries exactly one image, so no prev/next handlers are
 * passed and no paging arrows render.
 *
 * Used by both surfaces that show message images: the chat thread and the
 * admin dispute-conversation viewer.
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
   * the message count changes, which is before an image has any height — so
   * without this the newest image bubble ends up half below the fold.
   */
  onLoad?: () => void
}>) {
  const [isOpen, setIsOpen] = useState(false)
  const src = resolveMediaUrl(url)

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
        <Lightbox label="Message attachment preview" onClose={() => setIsOpen(false)}>
          <div className="flex max-h-[75vh] items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Message attachment" className="max-h-[75vh] w-full object-contain" />
          </div>
        </Lightbox>
      )}
    </>
  )
}
