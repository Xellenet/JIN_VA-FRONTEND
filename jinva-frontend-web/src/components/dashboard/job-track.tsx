"use client"

import { Check } from "lucide-react"
import type { Stage } from "@/lib/overview"
import { stopLabel } from "@/lib/overview"
import { cn } from "@/lib/utils"

export interface JobStageCount {
  stage: Stage
  label: string
  /** null = the count could not be loaded (shows "–"). */
  count: number | null
}

interface JobTrackProps {
  stages: JobStageCount[]
  selected: Stage | null
  onSelect: (stage: Stage) => void
  /** Counts still loading: skeleton counts, stops not clickable yet (FR-1.12). */
  loading?: boolean
  /** Id of the visible "Filter by stage" label that names the group. */
  labelledBy?: string
}

/**
 * The customer dashboard's job filter, drawn as the path a job actually takes:
 * Open → In progress → Completed, joined by a line, with Closed (cancelled or
 * expired) set apart because a job leaves the path there rather than finishing
 * it. Each stop is a toggle button that filters the job list below it.
 *
 * Selected stop (Overview spec §4.1): a solid `--primary` block with a check,
 * bold label and reversed count, so it reads without colour (FR-1.3). While a
 * filter is on, the other stops dim but stay focusable and clickable.
 */
export function JobTrack({ stages, selected, onSelect, loading = false, labelledBy }: JobTrackProps) {
  const path = stages.filter((s) => s.stage !== "closed")
  const closed = stages.find((s) => s.stage === "closed")
  const filtering = selected !== null

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : "Filter jobs by stage"}
      className="flex items-stretch gap-2 rounded-xl border bg-card p-2 sm:gap-4 sm:p-3"
    >
      <div className="relative grid flex-1 grid-cols-3 gap-1 sm:gap-2">
        {/*
          Runs through the dot centres, from the first stop to the last. A dot
          sits at the stop's padding + 5px (half its 10px size); the right end
          also accounts for the grid gaps before the third column.
        */}
        <span
          aria-hidden
          data-draw
          style={{ "--reveal-delay": "250ms" } as React.CSSProperties}
          className={cn(
            "pointer-events-none absolute left-[13px] right-[calc(33.333%-16px)] top-[14.5px] h-px sm:left-[17px] sm:right-[calc(33.333%-22px)] sm:top-[16.5px]",
            "transition-colors duration-150 motion-reduce:transition-none",
            filtering ? "bg-primary/20" : "bg-primary/30",
          )}
        />
        {path.map((s, i) => (
          <Stop
            key={s.stage}
            {...s}
            index={i}
            selected={selected === s.stage}
            dimmed={filtering && selected !== s.stage}
            loading={loading}
            onSelect={onSelect}
          />
        ))}
      </div>

      {closed && (
        <div className="flex border-l border-dashed pl-2 sm:pl-4">
          <Stop
            {...closed}
            index={3}
            selected={selected === "closed"}
            dimmed={filtering && selected !== "closed"}
            loading={loading}
            onSelect={onSelect}
            muted
          />
        </div>
      )}
    </div>
  )
}

function Stop({
  stage,
  label,
  count,
  index,
  selected,
  dimmed,
  loading,
  onSelect,
  muted = false,
}: JobStageCount & {
  index: number
  selected: boolean
  dimmed: boolean
  loading: boolean
  onSelect: (stage: Stage) => void
  muted?: boolean
}) {
  const known = count !== null
  // A reached stage on the path is a solid dot; Closed and empty stages are outlined.
  const filledDot = known && count > 0 && !muted

  return (
    <button
      type="button"
      data-stage={stage}
      aria-pressed={selected}
      aria-disabled={loading || undefined}
      aria-label={loading ? `${label}: loading` : stopLabel(stage, count)}
      onClick={() => {
        if (!loading) onSelect(stage)
      }}
      className={cn(
        "relative flex min-w-0 flex-col items-start rounded-[10px] px-2 py-2.5 text-left sm:px-3 sm:py-3",
        "transition-[background-color,color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:focus-visible:ring-ring",
        loading && "cursor-default",
        selected
          ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_var(--primary)] dark:text-card"
          : !loading && "hover:bg-muted/70",
      )}
    >
      {selected ? (
        <span
          aria-hidden
          className="relative z-10 -m-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary-foreground text-primary ring-4 ring-primary transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] starting:scale-[0.6] motion-reduce:transition-none dark:bg-card"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            "relative z-10 block h-2.5 w-2.5 rounded-full ring-4 ring-card",
            "transition-opacity duration-150 motion-reduce:transition-none",
            filledDot
              ? dimmed
                ? "bg-primary/45"
                : "bg-primary"
              : "border border-muted-foreground/50 bg-card",
          )}
        />
      )}

      {loading ? (
        <span aria-hidden className="mt-2.5 block h-7 w-8 rounded-md bg-muted motion-safe:animate-pulse sm:mt-3" />
      ) : (
        <span
          data-enter
          style={{ "--reveal-delay": `${120 + index * 70}ms` } as React.CSSProperties}
          className={cn(
            "mt-2.5 text-2xl font-semibold leading-none tracking-tight tabular-nums sm:mt-3 sm:text-3xl",
            selected ? "" : dimmed || !known || (muted && !selected) ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {known ? count : "–"}
        </span>
      )}

      <span
        className={cn(
          "mt-1.5 text-xs leading-tight sm:text-sm",
          selected ? "font-semibold" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  )
}
