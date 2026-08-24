"use client"

import { useEffect, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The app's single click-to-enlarge overlay.
 *
 * The exact same backdrop, close affordance, optional prev/next arrows and
 * Escape/click-outside dismissal had been written out three times — the
 * portfolio gallery, the review-photo thumbnail row, and (as of the messaging
 * round) message image attachments. This is that shared chrome, lifted out
 * verbatim from the portfolio gallery's version so nothing about how it looks
 * or behaves changes; each caller supplies only its own content.
 *
 * Arrows and arrow-key navigation appear only when `onPrev`/`onNext` are
 * given, which is what lets a single-image caller (a message carries exactly
 * one) use it without a paging affordance that would have nothing to page to.
 */
export function Lightbox({
  label,
  onClose,
  onPrev,
  onNext,
  className,
  children,
}: Readonly<{
  label: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  /** Width constraint on the content frame (defaults to the 3xl used by images). */
  className?: string
  children: ReactNode
}>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Registered on `window` in the capture phase, which runs before the
        // document-capture listener Radix's dismissable layers use. Without
        // stopping it here, one Escape inside a lightbox opened from within a
        // Dialog/Sheet (the admin dispute conversation viewer) would close both
        // the preview and the sheet behind it.
        e.stopPropagation()
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === "ArrowRight") onNext?.()
      if (e.key === "ArrowLeft") onPrev?.()
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={cn("relative w-full max-w-3xl", className)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <Button
          size="icon"
          variant="ghost"
          className="absolute -right-2 -top-12 z-10 h-9 w-9 rounded-full bg-background/90 shadow-md hover:bg-background"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </Button>

        {onPrev && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute -left-4 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-background/90 shadow-md hover:bg-background sm:-left-14"
            onClick={onPrev}
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        {onNext && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute -right-4 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-background/90 shadow-md hover:bg-background sm:-right-14"
            onClick={onNext}
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}

        <div className="overflow-hidden rounded-lg bg-background shadow-2xl">{children}</div>
      </div>
    </div>
  )
}
