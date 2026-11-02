"use client"

import { RANGES, type SpendingRange } from "@/lib/spending"
import { cn } from "@/lib/utils"
import { FOCUS_RING } from "./shared"

/**
 * FR-4.1: Last 30 days / 90 days / 12 months / All time. The selected button
 * is raised (card surface, ring, semibold), not only recoloured, and carries
 * `aria-pressed`. On phones it is a 4-up segmented control with 44px targets.
 */
export function PeriodSelector<T extends string = SpendingRange>({
  value,
  onChange,
  options = RANGES as unknown as readonly { value: T; short: string; full: string }[],
}: Readonly<{
  value: T
  onChange: (range: T) => void
  /** The choices; the Spending page's four periods by default. */
  options?: readonly { value: T; short: string; full: string }[]
}>) {
  return (
    <div
      role="group"
      aria-label="Period"
      className={cn(
        "grid w-full rounded-lg border border-border bg-muted p-1 sm:inline-flex sm:w-auto",
        options.length === 5 ? "grid-cols-5" : "grid-cols-4",
      )}
    >
      {options.map((r) => {
        const on = r.value === value
        return (
          <button
            key={r.value}
            type="button"
            title={r.full}
            aria-label={r.full}
            aria-pressed={on}
            onClick={() => !on && onChange(r.value)}
            className={cn(
              FOCUS_RING,
              "h-11 min-w-0 whitespace-nowrap rounded-md px-1 text-[13px] sm:h-9 sm:px-3.5 sm:text-sm",
              on
                ? "bg-card font-semibold text-foreground shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.06)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r.short}
          </button>
        )
      })}
    </div>
  )
}
