"use client"

import { AlertTriangle, ArrowDownRight, Lock, Send } from "lucide-react"
import type { EarningsStatement } from "@/lib/earnings-api"
import { PAYOUT_TIMING, isZero, monthKey, monthName, rangePhrase, type EarningsPeriod } from "@/lib/earnings"
import { formatMoney, plural } from "@/lib/spending"
import { cn } from "@/lib/utils"
import { BandFigure, BandHelp, FitMoney } from "@/components/spending/statement-band"

/** Rules between the four cells: stacked on phones, 2×2 on tablets, one row on desktops. */
const CELL_BORDERS = [
  "",
  "max-md:border-t md:border-l",
  "border-t lg:border-l lg:border-t-0",
  "border-t md:border-l lg:border-t-0",
]

const MONTH_HELP =
  "What clients paid for your jobs this month, minus JinVa's fee. It counts money waiting for sign-off, on its way, needing your action and already paid. Refunded and unpaid jobs aren't counted."

/**
 * The Earnings statement band (H7): the same brand surface and figure as the
 * customer's Spending band, in the artisan's words. The hero is this month's
 * net; the four cells are where the money is right now.
 */
export function EarningsBand({
  data,
  period,
  now = new Date(),
}: Readonly<{ data: EarningsStatement; period: EarningsPeriod; now?: Date }>) {
  const key = monthKey(now)
  const month = data.months.find((m) => m.month === key)
  const net = month?.net ?? "0.00"
  const { balances, summary } = data

  const cells = [
    {
      icon: Lock,
      label: "Paid by client, waiting for sign-off",
      value: balances.heldForSignOff,
      note: "Yours once the client confirms the job is done",
    },
    {
      icon: Send,
      label: "On its way",
      value: balances.onTheWay,
      note: "We've started the transfer to your payout account",
    },
    {
      icon: AlertTriangle,
      label: "Needs your action",
      value: balances.needsAction,
      note:
        balances.needsActionCount > 0
          ? `${plural(balances.needsActionCount, "payout")} couldn't be sent`
          : "Nothing is stuck",
      alert: balances.needsActionCount > 0,
    },
    {
      icon: ArrowDownRight,
      label: "Refunded",
      value: summary.refunded,
      note:
        summary.refundedCount > 0
          ? `${plural(summary.refundedCount, "job")} refunded to clients ${rangePhrase(period)}`
          : `No refunds ${rangePhrase(period)}`,
    },
  ]

  return (
    <section data-enter aria-label="Earnings summary" className="overflow-hidden rounded-2xl bg-brand text-brand-foreground">
      <div className="flex flex-col gap-4 px-5 py-6 md:flex-row md:items-end md:justify-between md:px-8 md:py-7">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm text-brand-foreground/80">
            Earned in {monthName(key)} so far
            <BandHelp label="How this month's earnings are worked out" text={MONTH_HELP} />
          </p>
          <BandFigure amount={net} />
          <p className="tnum mt-4 text-sm tabular-nums text-brand-foreground/85">
            {month && month.jobs > 0 ? `From ${plural(month.jobs, "job")}. ` : "No jobs paid for yet this month. "}
            {isZero(balances.paidThisMonth)
              ? "Nothing paid out to you yet this month."
              : `${formatMoney(balances.paidThisMonth)} paid out to you this month.`}
          </p>
        </div>
      </div>
      <div className="grid border-t border-white/12 md:grid-cols-2 lg:grid-cols-4">
        {cells.map((cell, i) => {
          const Icon = cell.icon
          return (
            <div
              key={cell.label}
              className={cn(
                "min-w-0 px-5 py-3.5 md:px-7 md:py-6",
                "border-white/12",
                CELL_BORDERS[i],
                "max-md:flex max-md:items-start max-md:justify-between max-md:gap-4",
              )}
            >
              <div className="min-w-0">
                <p className="flex items-start gap-1.5 text-sm text-brand-foreground/80">
                  <Icon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {cell.label}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[13px] leading-snug text-brand-foreground/70 md:hidden",
                    cell.alert && "font-medium text-brand-foreground",
                  )}
                >
                  {cell.note}
                </p>
              </div>
              <div className="shrink-0 md:shrink">
                <p className="tnum whitespace-nowrap text-base font-semibold tabular-nums tracking-tight md:mt-3 md:text-[26px]">
                  <FitMoney amount={cell.value} />
                </p>
                <p
                  className={cn(
                    "mt-1.5 hidden text-[13px] leading-snug text-brand-foreground/70 md:block",
                    cell.alert && "font-medium text-brand-foreground",
                  )}
                >
                  {cell.note}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="border-t border-white/12 px-5 py-4 text-sm text-brand-foreground/80 md:px-8">{PAYOUT_TIMING}</p>
    </section>
  )
}

export function EarningsBandSkeleton() {
  const block = "rounded-md bg-white/10 motion-safe:animate-pulse"
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-2xl bg-brand">
      <div className="px-5 py-6 md:px-8 md:py-7">
        <div className={cn(block, "h-4 w-48 max-w-full")} />
        <div className={cn(block, "mt-5 h-[44px] w-72 max-w-full xl:h-[60px]")} />
        <div className={cn(block, "mt-5 h-4 w-80 max-w-full")} />
      </div>
      <div className="grid border-t border-white/12 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-5 py-4 md:px-7 md:py-6">
            <div className={cn(block, "h-4 w-32")} />
            <div className={cn(block, "mt-4 h-7 w-28")} />
          </div>
        ))}
      </div>
    </div>
  )
}
