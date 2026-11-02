"use client"

import type { ActionItems, NextBooking, SpendSnapshot } from "@/lib/customer-api"
import { cn } from "@/lib/utils"
import { RailNeedsAction } from "./rail-needs-action"
import { RailNextAppointment } from "./rail-next-appointment"
import type { RailLayout, RailSectionState } from "./rail-section"
import { RailSpending } from "./rail-spending"

export interface RailStates {
  actionItems: RailSectionState<ActionItems>
  nextBooking: RailSectionState<NextBooking | null>
  spend: RailSectionState<SpendSnapshot>
}

/**
 * "Your account at a glance" (Overview spec §3).
 *
 * - `layout="rail"` (≥1280px): one tinted panel holding all three sections,
 *   split by hairlines.
 * - `layout="cards"` (<1280px): Next appointment and Spending as separate
 *   cards below the list, side by side from 768px. "Needs your action" is
 *   rendered by the page above the track instead (FR-2.2).
 */
export function AccountRail({
  layout,
  states,
  now,
  onRetry,
  className,
}: {
  layout: RailLayout
  states: RailStates
  now: Date
  onRetry: () => void
  className?: string
}) {
  if (layout === "rail") {
    return (
      <aside
        aria-label="Your account at a glance"
        className={cn("divide-y overflow-hidden rounded-2xl border bg-muted/50 dark:bg-muted/40", className)}
      >
        <RailNeedsAction state={states.actionItems} layout="rail" onRetry={onRetry} />
        <RailNextAppointment state={states.nextBooking} layout="rail" now={now} onRetry={onRetry} />
        <RailSpending state={states.spend} layout="rail" onRetry={onRetry} />
      </aside>
    )
  }

  return (
    <aside aria-label="Your account at a glance" className={cn("grid items-start gap-4 md:grid-cols-2 md:gap-6", className)}>
      <RailNextAppointment state={states.nextBooking} layout="cards" now={now} onRetry={onRetry} />
      <RailSpending state={states.spend} layout="cards" onRetry={onRetry} />
    </aside>
  )
}
