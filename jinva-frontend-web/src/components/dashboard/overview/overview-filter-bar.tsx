"use client"

import { useLayoutEffect, useRef, useState, type RefObject } from "react"
import { X } from "lucide-react"
import { resultsLabel, stageInfo, type Stage } from "@/lib/overview"
import { cn } from "@/lib/utils"

interface OverviewFilterBarProps {
  stage: Stage
  /** Results in the stage, or null while unknown (the "· n results" part is then left out). */
  results: number | null
  /** The element holding the job track; the notch points at its pressed stop. */
  trackRef: RefObject<HTMLElement | null>
  /** Chip × and "Clear filter" both clear; the page then moves focus to the list heading. */
  onClear: () => void
  /** Animate the bar in (not on first paint, FR-1.19). */
  animate: boolean
}

/**
 * The forest-green bar joining the selected stop to the list (Overview spec
 * §4.2): "Showing [In progress ×] jobs only · 3 results  …  Clear filter".
 * The stage text always comes from the parsed literal, never the URL.
 */
export function OverviewFilterBar({ stage, results, trackRef, onClear, animate }: OverviewFilterBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const [notchX, setNotchX] = useState<number | null>(null)
  const { label } = stageInfo(stage)

  // Point the notch at the centre of the selected stop; recalculated on
  // resize, on font load and whenever the stage changes.
  useLayoutEffect(() => {
    const bar = barRef.current
    const track = trackRef.current
    if (!bar || !track) return
    const place = () => {
      const stop = track.querySelector<HTMLElement>(`[data-stage="${stage}"]`)
      if (!stop) return
      const s = stop.getBoundingClientRect()
      const b = bar.getBoundingClientRect()
      setNotchX(Math.round(s.left + s.width / 2 - b.left - 7))
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(bar)
    ro.observe(track)
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) place()
    })
    return () => {
      cancelled = true
      ro.disconnect()
    }
  }, [stage, trackRef])

  return (
    <div
      ref={barRef}
      className={cn(
        "relative",
        animate &&
          "transition-[clip-path,opacity] duration-200 ease-out starting:opacity-0 starting:[clip-path:inset(0_0_100%_0)] [clip-path:inset(-12px_0_0_0)] motion-reduce:transition-none",
      )}
    >
      <span
        aria-hidden
        style={{ transform: `translateX(${notchX ?? 26}px) rotate(45deg)` }}
        className={cn(
          "absolute -top-[6px] left-0 h-3.5 w-3.5 rounded-[3px] bg-brand dark:border-l dark:border-t dark:border-primary/50",
          "transition-transform duration-[240ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none",
          notchX === null && "opacity-0",
        )}
      />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-xl bg-brand px-4 py-3 text-brand-foreground dark:border dark:border-b-0 dark:border-primary/50 sm:px-5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span>Showing</span>
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-foreground/15 pl-3 pr-1 font-semibold ring-1 ring-inset ring-brand-foreground/30">
            {label}
            <button
              type="button"
              aria-label={`Remove filter: ${label}`}
              onClick={onClear}
              className={cn(
                "relative flex h-5 w-5 items-center justify-center rounded-full hover:bg-brand-foreground/20",
                "before:absolute before:-inset-3 before:content-['']",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground",
              )}
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </span>
          <span>jobs only</span>
          {/* BR-1.6 / FR-1.4: on phones the count always takes its own line
              (and holds it while unknown), so "Clear filter" sits in the same
              spot whichever stage is selected. */}
          {results !== null ? (
            <span className="basis-full tabular-nums text-brand-foreground/75 sm:basis-auto">
              <span aria-hidden className="hidden sm:inline">· </span>
              {resultsLabel(results)}
            </span>
          ) : (
            <span aria-hidden className="basis-full sm:hidden">&nbsp;</span>
          )}
        </p>
        <button
          type="button"
          onClick={onClear}
          className={cn(
            "-mr-2 ml-auto inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium sm:min-h-9",
            "underline decoration-brand-foreground/40 underline-offset-4 hover:decoration-brand-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground",
          )}
        >
          Clear filter
        </button>
      </div>
    </div>
  )
}
