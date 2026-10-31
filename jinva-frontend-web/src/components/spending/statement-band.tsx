"use client"

import Link from "next/link"
import { useLayoutEffect, useRef, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Info, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { SpendingAnalytics } from "@/lib/customer-api"
import {
  changeLine,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  jobHref,
  moneyParts,
  netSpentLabel,
  periodPhrase,
  type SpendingRange,
} from "@/lib/spending"
import { cn } from "@/lib/utils"
import { FOCUS_RING, UserText } from "./shared"

export const BAND_FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-brand"

const NET_SPENT_HELP =
  "What you paid, minus refunds. Payments you didn't finish and failed payments aren't counted."

/** ⓘ next to the band's headline figure: opens on hover, focus or tap (hover is not available on phones). */
export function BandHelp({
  label = "How net spent is worked out",
  text = NET_SPENT_HELP,
}: Readonly<{ label?: string; text?: React.ReactNode }>) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={cn(
            BAND_FOCUS,
            "grid h-6 w-6 shrink-0 place-items-center rounded-full text-brand-foreground/75 hover:bg-white/10",
          )}
        >
          <Info aria-hidden="true" className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 text-sm leading-snug">
        {text}
      </PopoverContent>
    </Popover>
  )
}

/**
 * FR-4.19: the big figure switches to "GH₵ 1.25M" when the full figure is
 * wider than its box. A measurement, not a character count. The exact value
 * stays in the aria-label and in a popover on focus or tap.
 */
export function BandFigure({ amount }: Readonly<{ amount: string }>) {
  const boxRef = useRef<HTMLDivElement>(null)
  const fullRef = useRef<HTMLParagraphElement>(null)
  const [compact, setCompact] = useState(false)
  const exact = formatMoney(amount)
  const { whole, fraction } = moneyParts(amount)

  useLayoutEffect(() => {
    const box = boxRef.current
    const full = fullRef.current
    if (!box || !full) return
    const measure = () => setCompact(full.scrollWidth > box.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [amount])

  const figureClass =
    "tnum whitespace-nowrap font-semibold leading-none tracking-[-0.035em] tabular-nums text-[44px] md:text-5xl xl:text-[60px]"

  return (
    <div ref={boxRef} className="relative mt-4 min-w-0">
      {/* Measured copy of the full figure. Hidden from everyone; it only sizes. */}
      <p ref={fullRef} aria-hidden="true" className={cn(figureClass, "invisible absolute left-0 top-0")}>
        <span className="mr-1 align-[0.52em] text-[0.38em] font-medium tracking-normal">GH₵</span>
        {whole}.{fraction}
      </p>
      {compact ? (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label={exact} className={cn(BAND_FOCUS, figureClass, "rounded-md text-left")}>
              {formatMoneyCompact(amount)}
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="tnum w-auto text-sm font-medium tabular-nums">
            {exact}
          </PopoverContent>
        </Popover>
      ) : (
        <p className={figureClass}>
          <span className="sr-only">{exact}</span>
          <span aria-hidden="true">
            <span className="mr-1 align-[0.52em] text-[0.38em] font-medium tracking-normal text-brand-foreground/75">GH₵</span>
            {whole}
            <span className="text-brand-foreground/45">.{fraction}</span>
          </span>
        </p>
      )}
    </div>
  )
}

/** A ledger value that falls back to the short form when it would not fit (FR-4.19). */
export function FitMoney({ amount, className }: Readonly<{ amount: string; className?: string }>) {
  const exact = formatMoney(amount)
  const short = Number(amount) >= 1_000_000 ? formatMoneyCompact(amount) : exact
  return (
    <span className={className} title={short !== exact ? exact : undefined}>
      {short !== exact ? <span className="sr-only">{exact}</span> : null}
      <span aria-hidden={short !== exact ? "true" : undefined}>{short}</span>
    </span>
  )
}

interface CellProps {
  label: React.ReactNode
  value: React.ReactNode
  note: string
}

export function StatementBand({ data, range }: Readonly<{ data: SpendingAnalytics; range: SpendingRange }>) {
  const { totals, largestPayment } = data
  const change = changeLine(range, totals.netSpent, totals.previousPeriodNetSpent)
  const cells: CellProps[] = [
    {
      label: (
        <>
          <Lock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Held
        </>
      ),
      value: <FitMoney amount={totals.held} />,
      note: "Held until you confirm the job is done",
    },
    { label: "Refunded", value: <FitMoney amount={totals.refunded} />, note: "Returned to you, already taken off net spent" },
    {
      label: "Payments",
      value: totals.paymentsCount.toLocaleString("en-GB"),
      note: `Average ${formatMoney(totals.avgPayment)}`,
    },
  ]
  const largestHref = largestPayment ? jobHref(largestPayment.jobId) : null
  const ChangeIcon = change?.kind === "less" ? ArrowDownRight : ArrowUpRight

  return (
    <section
      data-enter
      aria-label="Spending summary"
      className="overflow-hidden rounded-2xl bg-brand text-brand-foreground"
    >
      <div className="grid md:grid-cols-3 xl:grid-cols-[1.75fr_1fr_1fr_1fr]">
        <div className="min-w-0 px-5 py-6 md:col-span-3 md:px-8 md:py-7 xl:col-span-1">
          <p className="flex items-center gap-2 text-sm text-brand-foreground/80">
            {netSpentLabel(range)}
            <BandHelp />
          </p>
          <BandFigure amount={totals.netSpent} />
          {change ? (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-brand-foreground/85">
              {change.chip ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 font-medium">
                  <ChangeIcon aria-hidden="true" className="h-3.5 w-3.5" />
                  {change.chip}
                </span>
              ) : null}
              <span className="tnum tabular-nums">{change.rest}</span>
            </p>
          ) : null}
        </div>
        {cells.map((cell, i) => (
          <div
            key={i}
            className={cn(
              "min-w-0 border-t border-white/12 px-5 py-3.5 md:border-t md:px-7 md:py-6 xl:border-l xl:border-t-0 xl:py-7",
              i > 0 && "md:border-l",
              "max-md:flex max-md:items-start max-md:justify-between max-md:gap-4",
            )}
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm text-brand-foreground/80">{cell.label}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-brand-foreground/70 md:hidden">{cell.note}</p>
            </div>
            <div className="shrink-0 md:shrink">
              <p className="tnum whitespace-nowrap text-base font-semibold tabular-nums tracking-tight md:mt-3 md:text-[26px]">
                {cell.value}
              </p>
              <p className="mt-1.5 hidden text-[13px] leading-snug text-brand-foreground/70 md:block">{cell.note}</p>
            </div>
          </div>
        ))}
      </div>
      {largestPayment ? (
        <p className="border-t border-white/12 px-5 py-4 text-sm text-brand-foreground/80 md:px-8">
          Your largest payment:{" "}
          <span className="tnum font-semibold tabular-nums text-brand-foreground">{formatMoney(largestPayment.amount)}</span>
          {largestPayment.jobTitle ? (
            <>
              {" for "}
              {largestHref ? (
                <Link
                  href={largestHref}
                  className={cn(
                    BAND_FOCUS,
                    "rounded-sm font-medium text-brand-foreground underline decoration-white/40 underline-offset-4 hover:decoration-white",
                  )}
                >
                  <UserText>{largestPayment.jobTitle}</UserText>
                </Link>
              ) : (
                <UserText className="font-medium text-brand-foreground">{largestPayment.jobTitle}</UserText>
              )}
            </>
          ) : null}{" "}
          on {formatDate(largestPayment.paidAt)}.
        </p>
      ) : null}
    </section>
  )
}

/** FR-4.17: payments exist, but none in this period. */
export function PeriodEmpty({ range, onShowAll }: Readonly<{ range: SpendingRange; onShowAll: () => void }>) {
  const phrase = periodPhrase(range) ?? "this period"
  return (
    <section
      data-swap
      aria-labelledby="period-empty-title"
      className="rounded-2xl border border-dashed border-border px-5 py-6 sm:px-8 sm:py-8"
    >
      <p className="text-sm text-muted-foreground">{netSpentLabel(range)}</p>
      <p className="tnum mt-3 text-[32px] font-semibold leading-none tracking-tight text-muted-foreground tabular-nums">
        {formatMoney(0)}
      </p>
      <h2 id="period-empty-title" className="mt-7 text-lg font-semibold text-foreground">
        No spending in the {phrase}
      </h2>
      <p className="mt-1.5 max-w-[52ch] text-sm text-muted-foreground sm:text-base">
        Your earlier payments are still here. Choose a longer period to see them.
      </p>
      <Button type="button" className={cn(FOCUS_RING, "mt-5 h-11 w-full sm:w-auto")} onClick={onShowAll}>
        Show all time
      </Button>
    </section>
  )
}

/** FR-4.15: the band's skeleton keeps the brand surface, with white/10 blocks in place. */
export function StatementBandSkeleton() {
  const block = "rounded-md bg-white/10 motion-safe:animate-pulse"
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-2xl bg-brand">
      <div className="grid md:grid-cols-3 xl:grid-cols-[1.75fr_1fr_1fr_1fr]">
        <div className="px-5 py-6 md:col-span-3 md:px-8 md:py-7 xl:col-span-1">
          <div className={cn(block, "h-4 w-56 max-w-full")} />
          <div className={cn(block, "mt-5 h-[44px] w-80 max-w-full xl:h-[60px]")} />
          <div className={cn(block, "mt-5 h-4 w-72 max-w-full")} />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("border-t border-white/12 px-5 py-4 md:px-7 md:py-7 xl:border-l xl:border-t-0", i > 0 && "md:border-l")}>
            <div className={cn(block, "h-4 w-24")} />
            <div className={cn(block, "mt-4 h-7 w-36")} />
            <div className={cn(block, "mt-3 h-3.5 w-40 max-w-full")} />
          </div>
        ))}
      </div>
    </div>
  )
}
