"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The curve every step of the opening uses (Settings & inbox spec §5.5).
 * Durations: height and chevron 200 ms, spine 240 ms, content fade 140 ms
 * after 60 ms. Collapse runs in reverse in 160 ms. Reduced motion: instant.
 */
const EASE = "ease-[cubic-bezier(.2,.8,.2,1)]"

interface DisclosureItemProps {
  /** Stable DOM id prefix, unique within the page. */
  readonly id: string
  readonly open: boolean
  readonly onToggle: () => void
  /** Icon or avatar, 32px. */
  readonly leading: ReactNode
  /** Plain text only (SEC-17). */
  readonly title: string
  readonly titleClassName?: string
  /** Relative time shown in the header. */
  readonly time?: string
  /** Full date for the `<time title>` tooltip. */
  readonly timeTitle?: string
  readonly timeDateTime?: string
  readonly unread: boolean
  /** Show the unread dot (the envelope shows a count on the avatar instead). */
  readonly dot?: boolean
  /** One-line preview shown while collapsed. */
  readonly preview?: ReactNode
  readonly previewClassName?: string
  /** The panel. */
  readonly children: ReactNode
  /** Lets the parent move focus back to this header (first Escape). */
  readonly headerRef?: (el: HTMLButtonElement | null) => void
}

/**
 * One row of the bell or envelope menu, as an in-place disclosure (FR-6.1 to
 * FR-6.4). The header is the button; the panel is a labelled region that is
 * always in the DOM (so `aria-controls` resolves) but `inert` while closed.
 */
export function DisclosureItem({
  id,
  open,
  onToggle,
  leading,
  title,
  titleClassName,
  time,
  timeTitle,
  timeDateTime,
  unread,
  dot = true,
  preview,
  previewClassName,
  children,
  headerRef,
}: DisclosureItemProps) {
  const panelId = `${id}-panel`
  const titleId = `${id}-title`
  return (
    <li className={cn("relative transition-colors", open && "bg-primary/[0.035] dark:bg-primary/[0.06]")}>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-[3px] origin-top rounded-r bg-primary",
          "transition-transform motion-reduce:transition-none",
          EASE,
          open ? "scale-y-100 duration-[240ms]" : "scale-y-0 duration-150",
        )}
      />
      <button
        ref={headerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex min-h-16 w-full items-start gap-3 px-4 py-3 text-left outline-none sm:min-h-0",
          "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:focus-visible:ring-ring",
        )}
      >
        <span className="mt-0.5 shrink-0">{leading}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span
              id={titleId}
              dir="auto"
              className={cn(
                "min-w-0 text-[13px] text-foreground [unicode-bidi:isolate]",
                open ? "break-words [overflow-wrap:anywhere]" : "truncate",
                unread ? "font-semibold" : "font-medium",
                titleClassName,
              )}
            >
              {title}
            </span>
            {time && (
              <time
                dateTime={timeDateTime}
                title={timeTitle}
                className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
              >
                {time}
              </time>
            )}
          </span>
          {!open && preview && (
            <span
              dir="auto"
              className={cn(
                "mt-0.5 line-clamp-1 break-all text-[13px] [unicode-bidi:isolate]",
                unread ? "text-foreground/80" : "text-muted-foreground",
                previewClassName,
              )}
            >
              {preview}
            </span>
          )}
        </span>
        {unread && !dot && <span className="sr-only">Unread</span>}
        {unread && dot ? (
          <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-primary">
            <span className="sr-only">Unread</span>
          </span>
        ) : (
          <span className="w-2 shrink-0" aria-hidden="true" />
        )}
        <span
          aria-hidden="true"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground",
            "transition-transform duration-200 motion-reduce:transition-none",
            EASE,
            open && "rotate-180 text-foreground",
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={titleId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] motion-reduce:transition-none",
          EASE,
          open ? "grid-rows-[1fr] duration-200" : "grid-rows-[0fr] duration-150",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "pb-4 pl-[60px] pr-4 transition-opacity motion-reduce:transition-none",
              open ? "opacity-100 delay-[60ms] duration-[140ms]" : "opacity-0 duration-100",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </li>
  )
}

/**
 * The expanded text area (FR-6.5): plain text, line breaks kept, scrolls on
 * its own above 240px with a 28px fade at the bottom. Focusable only when it
 * scrolls, so keyboard users can scroll it without an extra tab stop otherwise.
 */
export function FullText({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  const ref = useRef<HTMLDivElement>(null)
  const [scrolls, setScrolls] = useState(false)
  const [atEnd, setAtEnd] = useState(true)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const overflow = el.scrollHeight > el.clientHeight + 1
    setScrolls(overflow)
    setAtEnd(!overflow || el.scrollTop + el.clientHeight >= el.scrollHeight - 2)
  }, [])

  useEffect(() => {
    measure()
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, children])

  return (
    <div
      ref={ref}
      onScroll={measure}
      tabIndex={scrolls ? 0 : undefined}
      aria-label={scrolls ? "Full message" : undefined}
      role={scrolls ? "group" : undefined}
      dir="auto"
      className={cn(
        "max-h-[240px] overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-foreground/90",
        "[overflow-wrap:anywhere] [unicode-bidi:isolate] rounded-sm outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring",
        scrolls && !atEnd && "[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]",
        className,
      )}
    >
      {children}
    </div>
  )
}
