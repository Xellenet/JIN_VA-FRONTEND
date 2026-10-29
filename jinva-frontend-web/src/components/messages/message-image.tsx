"use client"

import { useState } from "react"
import { ImageOff, Loader2 } from "lucide-react"
import { Lightbox } from "@/components/ui/lightbox"
import { cn } from "@/lib/utils"
import { usePrivateMedia } from "@/hooks/use-private-media"

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
 *
 * QA MSG-18: the image is private to the conversation, so it's loaded with
 * the signed-in request (see `usePrivateMedia`), not a plain `<img src>`.
 */
export function MessageImage({
  url,
  previewSrc,
  className,
  onLoad,
}: Readonly<{
  url: string
  /** A local object URL to show instead, for a message still being sent. */
  previewSrc?: string
  className?: string
  /**
   * Fired once the thumbnail has actually painted. The thread auto-scrolls when
   * the message count changes, which is before an image has any height — so
   * without this the newest image bubble ends up half below the fold.
   */
  onLoad?: () => void
}>) {
  const [isOpen, setIsOpen] = useState(false)
  const remote = usePrivateMedia(previewSrc ? null : url)
  const src = previewSrc ?? remote.src
  const status = previewSrc ? "ready" : remote.status

  if (status !== "ready" || !src) {
    return (
      <div
        className={cn(
          "flex h-32 w-[200px] max-w-full items-center justify-center rounded-lg border border-border/40 bg-muted text-muted-foreground",
          className,
        )}
        role="img"
        aria-label={status === "loading" ? "Loading image" : "Image unavailable"}
      >
        {status === "loading" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <span className="flex items-center gap-1.5 text-xs">
            <ImageOff className="h-4 w-4" />
            Image unavailable
          </span>
        )}
      </div>
    )
  }

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
