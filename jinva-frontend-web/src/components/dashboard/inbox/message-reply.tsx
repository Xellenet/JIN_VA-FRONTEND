"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { Copy, Reply, X } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  REPLY_DELETED_LABEL,
  SWIPE_REPLY_THRESHOLD,
  replyAnnouncement,
  swipeIntent,
  swipeReplyOffset,
  type BackendReplyTo,
} from "@/lib/messages"

/** How long a finger rests on a bubble before the message menu opens. */
const LONG_PRESS_MS = 500

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

// ── Quote inside a bubble ───────────────────────────────────────────────────

/**
 * The quoted original at the top of a reply's bubble: a bar in the quoted
 * sender's colour, their name and a one-line preview. A button that jumps to
 * the original, unless the original is gone.
 */
export function ReplyQuote({
  replyTo,
  senderLabel,
  quotesViewer,
  inOwnBubble,
  onJump,
}: {
  replyTo: BackendReplyTo
  /** "You", or the quoted sender's name. */
  senderLabel: string
  /** Whether the quoted message is the viewer's own (decides the colour). */
  quotesViewer: boolean
  /** Whether the reply bubble is the viewer's own (primary background). */
  inOwnBubble: boolean
  onJump: (messageId: number) => void
}) {
  const box = cn(
    "mb-1.5 flex w-full min-w-0 items-stretch gap-2 overflow-hidden rounded-lg py-1.5 pr-2.5 text-left",
    inOwnBubble ? "bg-primary-foreground/15" : "bg-muted",
  )
  const bar = cn(
    "w-1 shrink-0 rounded-full",
    inOwnBubble
      ? quotesViewer
        ? "bg-primary-foreground"
        : "bg-primary-foreground/60"
      : quotesViewer
        ? "bg-primary"
        : "bg-info",
  )
  const nameClass = cn(
    "block truncate text-xs font-semibold",
    inOwnBubble ? "text-primary-foreground" : quotesViewer ? "text-primary" : "text-info",
  )
  const previewClass = cn(
    "block truncate text-xs",
    inOwnBubble ? "text-primary-foreground/80" : "text-muted-foreground",
  )

  if (replyTo.deleted || replyTo.id === null) {
    return (
      <div className={box}>
        <span aria-hidden className={cn(bar, "opacity-50")} />
        <span className={cn(previewClass, "italic")}>
          <span className="sr-only">Replying to a message. </span>
          {REPLY_DELETED_LABEL}
        </span>
      </div>
    )
  }

  const id = replyTo.id
  return (
    <button
      type="button"
      onClick={() => onJump(id)}
      className={cn(
        box,
        "outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none",
      )}
    >
      <span aria-hidden className={bar} />
      <span className="min-w-0 flex-1">
        <span className="sr-only">Replying to </span>
        <span dir="auto" className={nameClass}>
          {senderLabel}
        </span>
        <span className="sr-only">: </span>
        <span dir="auto" className={previewClass}>
          {replyTo.preview}
        </span>
        <span className="sr-only">. Go to the original message.</span>
      </span>
    </button>
  )
}

// ── Reply bar above the composer ────────────────────────────────────────────

export function ReplyBar({
  senderLabel,
  preview,
  onCancel,
}: {
  senderLabel: string
  preview: string
  onCancel: () => void
}) {
  return (
    <div className="flex items-stretch gap-2 rounded-xl border border-border bg-muted/60 py-1.5 pl-2 pr-1">
      <span aria-hidden className="w-1 shrink-0 rounded-full bg-primary" />
      {/* Announced once when the reply starts, and on every change of target. */}
      <p className="min-w-0 flex-1 py-0.5" role="status" aria-live="polite">
        <span className="sr-only">{replyAnnouncement(senderLabel, preview)}</span>
        <span aria-hidden className="block truncate text-xs font-semibold text-primary">
          Replying to {senderLabel}
        </span>
        <span aria-hidden dir="auto" className="block truncate text-xs text-muted-foreground">
          {preview}
        </span>
      </p>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none sm:size-8"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── A bubble that can be replied to ─────────────────────────────────────────

/**
 * Wraps one message bubble with its three ways to reply:
 * - a small Reply button beside it, shown on hover or keyboard focus (mouse
 *   and keyboard; on touch screens it stays available to screen readers only);
 * - swipe right on touch: the bubble follows the finger (damped), and letting
 *   go past the threshold replies; it then snaps back. With reduced motion the
 *   bubble stays put and only the reply icon shows the progress;
 * - long-press on touch opens a small menu with "Reply" (and "Copy text"),
 *   the fallback for anyone who can't or won't swipe.
 */
export function ReplyableBubble({
  isOwn,
  canReply,
  onReply,
  copyText,
  highlighted,
  children,
}: {
  isOwn: boolean
  canReply: boolean
  onReply: () => void
  /** The message text, for "Copy text"; omitted for a photo-only message. */
  copyText?: string | null
  /** Briefly true after a quote jumped here. */
  highlighted?: boolean
  children: ReactNode
}) {
  const moverRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const gesture = useRef<{
    id: number
    x: number
    y: number
    intent: "undecided" | "swipe" | "scroll"
    triggered: boolean
    reduced: boolean
  } | null>(null)
  const pressTimer = useRef<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const lastPointerType = useRef<string>("mouse")

  const clearPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
    pressTimer.current = null
  }
  useEffect(() => clearPress, [])

  const paint = (offset: number, progress: number, animate: boolean, reduced: boolean) => {
    const mover = moverRef.current
    const icon = iconRef.current
    if (mover) {
      mover.style.transition = animate && !reduced ? "transform 180ms ease-out" : "none"
      mover.style.transform = reduced || offset === 0 ? "" : `translateX(${offset}px)`
    }
    if (icon) {
      icon.style.opacity = String(Math.min(1, progress))
      icon.style.transform = `scale(${0.6 + Math.min(1, progress) * 0.4})`
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    lastPointerType.current = e.pointerType
    if (!canReply || e.pointerType === "mouse" || !e.isPrimary) return
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      intent: "undecided",
      triggered: false,
      reduced: prefersReducedMotion(),
    }
    clearPress()
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      const g = gesture.current
      if (g && g.intent === "undecided") {
        gesture.current = null
        navigator.vibrate?.(10)
        setMenuOpen(true)
      }
    }, LONG_PRESS_MS)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (g.intent === "undecided") {
      g.intent = swipeIntent(dx, dy)
      if (g.intent === "undecided") return
      clearPress()
      if (g.intent === "scroll") {
        gesture.current = null
        return
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // A synthetic or already-released pointer can't be captured; the
        // gesture still works while the finger stays on the bubble.
      }
    }
    const { offset, triggered } = swipeReplyOffset(dx)
    if (triggered && !g.triggered) navigator.vibrate?.(10)
    g.triggered = triggered
    paint(offset, offset / SWIPE_REPLY_THRESHOLD, false, g.reduced)
  }

  const finish = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    clearPress()
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    gesture.current = null
    paint(0, 0, true, g.reduced)
    if (!cancelled && g.intent === "swipe" && g.triggered) onReply()
  }

  const copy = async () => {
    if (!copyText) return
    try {
      await navigator.clipboard.writeText(copyText)
      toast.success("Copied.")
    } catch {
      toast.error("Couldn't copy this message.")
    }
  }

  return (
    <div
      className={cn(
        "group/bubble relative flex min-w-0 max-w-[78%] items-center gap-1",
        isOwn ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Swipe progress: the reply icon behind the bubble's leading edge. */}
      {canReply && (
        <span
          ref={iconRef}
          aria-hidden
          style={{ opacity: 0 }}
          className={cn(
            "pointer-events-none absolute top-1/2 -mt-4 flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground",
            isOwn ? "-left-9" : "left-0",
          )}
        >
          <Reply className="h-4 w-4" />
        </span>
      )}
      <div
        ref={moverRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onContextMenu={(e) => {
          // Android raises contextmenu on a long-press: open our menu instead
          // of the browser's callout. A mouse right-click keeps the native menu.
          if (!canReply || lastPointerType.current === "mouse") return
          e.preventDefault()
          clearPress()
          gesture.current = null
          setMenuOpen(true)
        }}
        className={cn(
          "relative min-w-0 touch-pan-y rounded-2xl pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]",
          highlighted && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
      >
        {children}
        {canReply && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <span aria-hidden tabIndex={-1} className="pointer-events-none absolute inset-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isOwn ? "end" : "start"}
              className="min-w-40"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem className="min-h-11" onSelect={onReply}>
                <Reply aria-hidden className="h-4 w-4" />
                Reply
              </DropdownMenuItem>
              {copyText && (
                <DropdownMenuItem className="min-h-11" onSelect={() => void copy()}>
                  <Copy aria-hidden className="h-4 w-4" />
                  Copy text
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {canReply && (
        <button
          type="button"
          aria-label="Reply"
          onClick={onReply}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 group-hover/bubble:opacity-100 motion-reduce:transition-none pointer-coarse:sr-only"
        >
          <Reply aria-hidden className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
