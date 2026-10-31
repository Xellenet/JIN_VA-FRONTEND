"use client"

import Link from "next/link"
import { Lock, ReceiptText } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SpendSnapshot } from "@/lib/customer-api"
import { formatMoney, monthName, previousMonthKey, spendComparison } from "@/lib/overview"
import { RailError, RailSection, RailSkeleton, type RailLayout, type RailSectionState } from "./rail-section"
import { Sparkline } from "./sparkline"

/**
 * "Spending" snapshot (FR-2.6): this month's net spend, a neutral comparison
 * with last month, the six-month sparkline and what is currently held.
 * Copy follows the owner's rule in plan §0.2: the amount is called "Held".
 */
export function RailSpending({
  state,
  layout,
  onRetry,
}: {
  state: RailSectionState<SpendSnapshot>
  layout: RailLayout
  onRetry: () => void
}) {
  const spend = state.kind === "ready" ? state.data : null
  const currentKey = spend?.last6Months[spend.last6Months.length - 1]?.month ?? ""
  const showMonth = spend?.hasPaymentsEver && currentKey

  return (
    <RailSection
      title="Spending"
      layout={layout}
      name="spend"
      aside={showMonth ? <span className="text-sm text-muted-foreground">{monthName(currentKey)}</span> : null}
    >
      {state.kind === "loading" ? (
        <div className="mt-3 space-y-3">
          <RailSkeleton className="h-8 w-3/5" />
          <RailSkeleton className="h-3 w-2/5" />
          <RailSkeleton className="h-16 w-full" />
          <RailSkeleton className="h-10 w-full" />
        </div>
      ) : state.kind === "error" ? (
        <RailError message="Couldn't load your spending" rateLimited={state.rateLimited} onRetry={onRetry} />
      ) : spend && spend.hasPaymentsEver ? (
        <SpendBody spend={spend} currentKey={currentKey} />
      ) : (
        <div className="mt-3 flex items-start gap-3 px-1 py-2">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-inset ring-border"
          >
            <ReceiptText className="h-4 w-4" />
          </span>
          <p className="text-sm text-muted-foreground">Your spending will appear here after your first payment.</p>
        </div>
      )}
    </RailSection>
  )
}

function SpendBody({ spend, currentKey }: { spend: SpendSnapshot; currentKey: string }) {
  const comparison = spendComparison(spend.thisMonth, spend.lastMonth, previousMonthKey(currentKey))
  const [, amount] = formatMoney(spend.thisMonth).split("GH₵ ")

  return (
    <>
      <p className="mt-3 text-[2rem] font-semibold leading-none tracking-tight tabular-nums text-foreground">
        <span className="mr-1 text-lg font-medium text-muted-foreground">GH₵</span>
        {amount}
      </p>
      {comparison && (
        <p className="mt-2 text-sm tabular-nums text-muted-foreground">
          {comparison.arrow && <span aria-hidden>{comparison.arrow} </span>}
          {comparison.srWord && <span className="sr-only">{comparison.srWord} </span>}
          {comparison.text}
        </p>
      )}
      <Sparkline series={spend.last6Months} />
      <div className="mt-5 flex items-start justify-between gap-3 rounded-lg bg-card px-3 py-2.5 ring-1 ring-inset ring-border">
        <span className="flex min-w-0 items-start gap-2">
          <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="block text-sm font-medium text-foreground">Held</span>
            <span className="block text-xs text-muted-foreground">Held until you confirm the job is done</span>
          </span>
        </span>
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">{formatMoney(spend.held)}</span>
      </div>
      <Button variant="outline" className="mt-4 h-10 w-full bg-card sm:h-9" asChild>
        <Link href="/dashboard/user/report">View spending report</Link>
      </Button>
    </>
  )
}
