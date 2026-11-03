"use client"

import Link from "next/link"
import { Circle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SetupProgress } from "@/components/artisan/setup/setup-progress"
import { SETUP_HREF, progressLabel, searchLine, type SetupState } from "@/lib/artisan-setup"

/** How many of the steps still to do the card names. */
const SHOWN = 3

/**
 * Overview: "Finish setting up", until all six setup steps are done. It
 * stands in for the rail's "Add a payout method" and "Get verified" rows
 * (`artisanActionRows({ setupCard: true })`) and the "not in search" alert,
 * so nothing is asked twice. "Hide" lasts for this browser session only.
 */
export function SetupCard({
  state,
  payoutWaiting,
  onHide,
}: Readonly<{
  state: SetupState
  /** "GH₵ 120.00" when earnings are waiting for a payout method. */
  payoutWaiting: string | null
  onHide: () => void
}>) {
  const remaining = state.steps.filter((s) => !s.done)
  // Money waiting on a payout method is the most pressing step, so it is named first.
  if (payoutWaiting) remaining.sort((a, b) => Number(b.key === "payout") - Number(a.key === "payout"))
  const line = searchLine(state.searchVisible)

  return (
    <section aria-labelledby="setup-card-title" data-enter className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="setup-card-title" className="text-base font-semibold text-foreground">
            Finish setting up
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{progressLabel(state)}</span>
            {line && <>. {line}</>}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mt-2 -mr-2 h-11 w-11 shrink-0 text-muted-foreground"
          aria-label="Hide setup until your next visit"
          onClick={onHide}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <SetupProgress state={state} size="sm" className="mt-3" />

      <ul className="mt-4 space-y-2">
        {remaining.slice(0, SHOWN).map((step) => (
          <li key={step.key} className="flex items-start gap-2.5 text-sm">
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="font-medium text-foreground">{step.title}</span>
              <span className="sr-only">, to do</span>
              <span className="block text-muted-foreground [overflow-wrap:anywhere]">
                {step.key === "payout" && payoutWaiting ? `${payoutWaiting} is waiting for it` : step.detail}
              </span>
            </span>
          </li>
        ))}
        {remaining.length > SHOWN && (
          <li className="pl-[1.625rem] text-sm text-muted-foreground">
            And {remaining.length - SHOWN} more
          </li>
        )}
      </ul>

      <Button className="mt-4 h-11 w-full sm:h-9 sm:w-auto" asChild>
        <Link href={SETUP_HREF}>
          Continue setup
        </Link>
      </Button>
    </section>
  )
}
