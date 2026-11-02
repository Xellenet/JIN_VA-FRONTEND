"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

export interface StripStop {
  key: string
  label: string
  /** null = the count could not be loaded (shows "–"). */
  count: number | null
  href: string
  ariaLabel: string
  /** Set apart after a dashed rule: the job left the path (Closed). */
  aside?: boolean
}

/**
 * The job track drawn as links instead of filter toggles: the same dots,
 * joining line, big counts and dashed "Closed" stop as the customer
 * Overview's `JobTrack`, for pages where a stop opens a filtered list
 * elsewhere (the artisan Overview → My Jobs). Any number of path stops.
 */
export function StageStrip({
  stops,
  loading = false,
  labelledBy,
}: {
  stops: StripStop[]
  loading?: boolean
  labelledBy?: string
}) {
  const path = stops.filter((s) => !s.aside)
  const aside = stops.filter((s) => s.aside)

  return (
    <nav aria-labelledby={labelledBy} className="rounded-xl border bg-card p-1.5 sm:p-3">
      <ul className="flex items-stretch gap-1 sm:gap-4">
        <li className="min-w-0 flex-[4]">
          <ul className="grid gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${path.length}, minmax(0, 1fr))` }}>
            {path.map((s, i) => (
              <li key={s.key} className="relative min-w-0">
                {i < path.length - 1 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-[13px] right-[-17px] top-[14.5px] h-px bg-primary/30 sm:left-[17px] sm:right-[-25px] sm:top-[16.5px]"
                  />
                )}
                <Stop stop={s} index={i} loading={loading} />
              </li>
            ))}
          </ul>
        </li>
        {aside.length > 0 && (
          <li className="flex min-w-0 flex-1 border-l border-dashed pl-1 sm:pl-4">
            {aside.map((s, i) => (
              <Stop key={s.key} stop={s} index={path.length + i} loading={loading} muted />
            ))}
          </li>
        )}
      </ul>
    </nav>
  )
}

function Stop({ stop, index, loading, muted = false }: { stop: StripStop; index: number; loading: boolean; muted?: boolean }) {
  const known = stop.count !== null
  const filled = known && (stop.count ?? 0) > 0 && !muted

  return (
    <Link
      href={stop.href}
      aria-label={loading ? `${stop.label}: loading` : stop.ariaLabel}
      data-stage={stop.key}
      className={cn(
        "relative flex min-h-11 w-full min-w-0 flex-col items-start rounded-[10px] px-1.5 py-2.5 text-left sm:px-3 sm:py-3",
        "transition-colors duration-150 ease-out hover:bg-muted/70 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:focus-visible:ring-ring",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative z-10 ml-0.5 block h-2.5 w-2.5 rounded-full ring-4 ring-card sm:ml-0",
          filled ? "bg-primary" : "border border-muted-foreground/50 bg-card",
        )}
      />
      {loading ? (
        <span aria-hidden className="mt-2.5 block h-7 w-8 rounded-md bg-muted motion-safe:animate-pulse sm:mt-3" />
      ) : (
        <span
          data-enter
          style={{ "--reveal-delay": `${120 + index * 70}ms` } as React.CSSProperties}
          className={cn(
            "mt-2.5 text-2xl font-semibold leading-none tracking-tight tabular-nums sm:mt-3 sm:text-3xl",
            !known || muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {known ? stop.count : "–"}
        </span>
      )}
      <span className="mt-1.5 text-[11px] leading-tight text-muted-foreground min-[400px]:text-xs sm:text-sm">{stop.label}</span>
    </Link>
  )
}
