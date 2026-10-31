"use client"

import { Check } from "lucide-react"
import { ARTISAN_STAGES, type ArtisanStage, type ArtisanStageCounts } from "@/lib/artisan-jobs"
import { cn } from "@/lib/utils"

interface ArtisanStageTrackProps {
  /** `null` = counts could not be loaded (stops show "–" but still filter). */
  counts: ArtisanStageCounts | null
  selected: ArtisanStage | null
  onSelect: (stage: ArtisanStage) => void
  loading?: boolean
  labelledBy?: string
}

const plural = (n: number) => `${n} ${n === 1 ? "job" : "jobs"}`

/**
 * The artisan's jobs drawn as the path a job takes for them, in the same
 * visual language as the customer `JobTrack`: To start → In progress →
 * Waiting on client → Done on one line, with Closed set apart because a job
 * leaves the path there. Each stop is a toggle that filters the list below.
 * Counts are account-wide (`GET /artisans/me/overview` → `stageCounts`), never
 * counted from the loaded page.
 */
export function ArtisanStageTrack({ counts, selected, onSelect, loading = false, labelledBy }: ArtisanStageTrackProps) {
  const path = ARTISAN_STAGES.filter((s) => s.stage !== "closed")
  const closed = ARTISAN_STAGES.find((s) => s.stage === "closed")!
  const filtering = selected !== null

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : "Filter jobs by stage"}
      className="flex items-stretch gap-1.5 rounded-xl border bg-card p-1.5 sm:gap-4 sm:p-3"
    >
      <div className="relative grid flex-1 grid-cols-4 gap-1 sm:gap-2">
        {/* Runs through the dot centres, first stop to last (dot = padding + 5px). */}
        <span
          aria-hidden
          data-draw
          style={{ "--reveal-delay": "250ms" } as React.CSSProperties}
          className={cn(
            "pointer-events-none absolute left-[11px] right-[calc(25%-14px)] top-[14.5px] h-px sm:left-[17px] sm:right-[calc(25%-23px)] sm:top-[16.5px]",
            "transition-colors duration-150 motion-reduce:transition-none",
            filtering ? "bg-primary/20" : "bg-primary/30",
          )}
        />
        {path.map((s, i) => (
          <Stop
            key={s.stage}
            stage={s.stage}
            label={s.label}
            count={counts ? counts[s.countKey] : null}
            index={i}
            selected={selected === s.stage}
            dimmed={filtering && selected !== s.stage}
            loading={loading}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="flex border-l border-dashed pl-1.5 sm:pl-4">
        <Stop
          stage={closed.stage}
          label={closed.label}
          count={counts ? counts.closed : null}
          index={4}
          selected={selected === "closed"}
          dimmed={filtering && selected !== "closed"}
          loading={loading}
          onSelect={onSelect}
          muted
        />
      </div>
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
}: {
  stage: ArtisanStage
  label: string
  count: number | null
  index: number
  selected: boolean
  dimmed: boolean
  loading: boolean
  onSelect: (stage: ArtisanStage) => void
  muted?: boolean
}) {
  const known = count !== null
  const filledDot = known && count > 0 && !muted

  return (
    <button
      type="button"
      data-stage={stage}
      aria-pressed={selected}
      aria-disabled={loading || undefined}
      aria-label={loading ? `${label}: loading` : known ? `${label}: ${plural(count)}` : `${label}: count unavailable`}
      onClick={() => {
        if (!loading) onSelect(stage)
      }}
      className={cn(
        "relative flex min-h-[76px] min-w-0 flex-col items-start rounded-[10px] px-1.5 py-2.5 text-left sm:min-h-0 sm:px-3 sm:py-3",
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
            filledDot ? (dimmed ? "bg-primary/45" : "bg-primary") : "border border-muted-foreground/50 bg-card",
          )}
        />
      )}

      {loading ? (
        <span aria-hidden className="mt-2.5 block h-6 w-7 rounded-md bg-muted motion-safe:animate-pulse sm:mt-3 sm:h-7 sm:w-8" />
      ) : (
        <span
          data-enter
          style={{ "--reveal-delay": `${120 + index * 70}ms` } as React.CSSProperties}
          className={cn(
            "mt-2.5 text-xl font-semibold leading-none tracking-tight tabular-nums sm:mt-3 sm:text-3xl",
            selected ? "" : dimmed || !known || muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {known ? count : "–"}
        </span>
      )}

      <span
        className={cn(
          "mt-1.5 text-[11px] leading-tight sm:text-sm",
          selected ? "font-semibold" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  )
}
