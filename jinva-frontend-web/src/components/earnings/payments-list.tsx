"use client"

import Link from "next/link"
import type { ReactNode, RefObject } from "react"
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import type { Pagination } from "@/lib/customer-api"
import type { EarningsItem } from "@/lib/earnings-api"
import {
  PAYOUT_SETTINGS_HREF,
  STAGE_FILTERS,
  failureReasonText,
  noPayoutText,
  payoutHoldNeedsFix,
  payoutHoldText,
  rangePhrase,
  type EarningsPeriod,
  type EarningsStage,
} from "@/lib/earnings"
import { formatDate, formatMoney, plural, safeId } from "@/lib/spending"
import { cn } from "@/lib/utils"
import { FOCUS_RING, LoadError, SCROLL_MARGIN, Shimmer, UserText } from "@/components/spending/shared"
import { StagePill } from "./stage-pill"

export type ListState =
  | { status: "loading" }
  | { status: "error"; retryIn: number; attempt: number }
  | { status: "ok"; items: EarningsItem[]; pagination: Pagination }

const LINK = cn(FOCUS_RING, "rounded-sm font-medium text-foreground underline-offset-4 hover:underline")
const ACTION =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted sm:h-9"

function jobHref(id: number | null): string | null {
  const safe = safeId(id)
  return safe ? `/dashboard/artisan/jobs/${safe}` : null
}

function JobTitle({ item }: Readonly<{ item: EarningsItem }>) {
  const title = item.jobTitle?.trim() || "Untitled job"
  const href = jobHref(item.jobId)
  return href ? (
    <Link href={href} className={cn(LINK, "-my-3 inline-block py-3 lg:my-0 lg:py-0")}>
      <UserText>{title}</UserText>
    </Link>
  ) : (
    <UserText className="font-medium text-foreground">{title}</UserText>
  )
}

function Payout({ item, className }: Readonly<{ item: EarningsItem; className?: string }>) {
  return item.payout === null ? (
    <span className={cn("text-muted-foreground", className)}>{noPayoutText(item.stage)}</span>
  ) : (
    <span className={cn("tnum font-semibold tabular-nums text-foreground", className)}>{formatMoney(item.payout)}</span>
  )
}

/** The date a row is listed under, with what it means. */
function rowDate(item: EarningsItem): string {
  if (item.stage === "paid" && item.releasedAt) return `Paid out ${formatDate(item.releasedAt)}`
  if (item.paidAt) return `Client paid ${formatDate(item.paidAt)}`
  return formatDate(item.date)
}

function NeedsAction({
  item,
  hasPayoutMethod,
  retrying,
  onRetry,
}: Readonly<{ item: EarningsItem; hasPayoutMethod: boolean | null; retrying: boolean; onRetry: (jobId: number) => void }>) {
  if (item.stage !== "needs_action") return null
  // Payout name check: a hold says why in plain words. A name that doesn't
  // match, or an account that can't be found, is fixed in Settings (saving
  // new details retries it), so there is no retry button for those.
  const hold = payoutHoldText(item.holdReason)
  const needsFix = payoutHoldNeedsFix(item.holdReason)
  const reason = hold ? null : failureReasonText(item.failureReason)
  const jobId = safeId(item.jobId)
  const canRetry = hasPayoutMethod !== false && jobId !== null && !needsFix
  return (
    <div className="mt-2 rounded-lg bg-attention/[0.07] px-3 py-2.5">
      {hold ? (
        <>
          <p className="text-[13px] font-medium leading-snug text-foreground">{hold.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{hold.detail}</p>
        </>
      ) : null}
      {reason ? <p className="text-[13px] leading-snug text-foreground">{reason}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {needsFix ? (
          <Link href={PAYOUT_SETTINGS_HREF} className={cn(FOCUS_RING, ACTION)}>
            Fix payment details
          </Link>
        ) : null}
        {canRetry ? (
          <button
            type="button"
            disabled={retrying}
            aria-busy={retrying}
            onClick={() => jobId !== null && onRetry(jobId)}
            className={cn(FOCUS_RING, ACTION, retrying && "cursor-progress opacity-80")}
          >
            {retrying ? <Spinner className="h-4 w-4" /> : <RotateCcw aria-hidden="true" className="h-4 w-4" />}
            Retry payout
          </button>
        ) : null}
        {needsFix ? null : (
          <Link href={PAYOUT_SETTINGS_HREF} className={cn(FOCUS_RING, ACTION)}>
            {hasPayoutMethod === false ? "Add payout details" : "Update payout details"}
          </Link>
        )}
      </div>
    </div>
  )
}

export function PaymentsList({
  state,
  period,
  stage,
  onStage,
  onPage,
  onRetryLoad,
  download,
  hasPayoutMethod,
  retryingJobId,
  onRetryPayout,
  headingRef,
}: Readonly<{
  state: ListState
  period: EarningsPeriod
  stage: EarningsStage | "all"
  onStage: (stage: EarningsStage | "all") => void
  onPage: (page: number) => void
  onRetryLoad: () => void
  download: ReactNode
  hasPayoutMethod: boolean | null
  retryingJobId: number | null
  onRetryPayout: (jobId: number) => void
  headingRef: RefObject<HTMLHeadingElement | null>
}>) {
  const total = state.status === "ok" ? state.pagination.total : null
  const stageName = STAGE_FILTERS.find((f) => f.value === stage)?.label ?? "All"

  return (
    <section aria-labelledby="payments-title" className="rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <h2
            id="payments-title"
            ref={headingRef}
            tabIndex={-1}
            className={cn(SCROLL_MARGIN, "rounded-sm text-[15px] font-semibold text-foreground outline-none")}
          >
            Payments
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === null
              ? "Every job a client has paid for, with the fee and your payout."
              : stage === "all"
                ? `${plural(total, "payment")} ${rangePhrase(period)}.`
                : `${plural(total, "payment")} marked "${stageName}" ${rangePhrase(period)}.`}
          </p>
        </div>
        {download}
      </div>

      {/* Stage filter: a select on phones (eight chips would take four rows), chips from sm up. */}
      <div className="px-4 pt-4 sm:px-6">
        <label htmlFor="stage-filter" className="sr-only">
          Show payments
        </label>
        <select
          id="stage-filter"
          value={stage}
          onChange={(e) => onStage(e.target.value as EarningsStage | "all")}
          className={cn(FOCUS_RING, "h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground sm:hidden")}
        >
          {STAGE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.value === "all" ? "All payments" : f.label}
            </option>
          ))}
        </select>
        <div role="group" aria-label="Show payments" className="hidden flex-wrap gap-2 sm:flex">
          {STAGE_FILTERS.map((f) => {
            const on = f.value === stage
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={on}
                onClick={() => !on && onStage(f.value)}
                className={cn(
                  FOCUS_RING,
                  "h-9 rounded-full border px-3.5 text-[13px]",
                  on
                    ? "border-foreground bg-foreground font-medium text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pt-4">
        {state.status === "loading" ? (
          <ListSkeleton />
        ) : state.status === "error" ? (
          <LoadError
            className="px-4 pb-6 sm:px-6"
            title="Couldn't load your payments"
            body="Check your connection, then try again."
            onRetry={onRetryLoad}
            retryIn={state.retryIn}
            attempt={state.attempt}
          />
        ) : state.items.length === 0 ? (
          <p className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
            {stage === "all"
              ? `No payments ${rangePhrase(period)}.`
              : `No payments marked "${stageName}" ${rangePhrase(period)}.`}
          </p>
        ) : (
          <>
            {/* Desktop: the statement as a table. */}
            <table className="hidden w-full text-sm lg:table">
              <caption className="sr-only">Payments, newest first</caption>
              <thead>
                <tr className="border-y border-border text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="py-2.5 pl-6 font-medium">Job</th>
                  <th scope="col" className="py-2.5 pl-4 font-medium">Status</th>
                  <th scope="col" className="py-2.5 pl-4 text-right font-medium">Paid by client</th>
                  <th scope="col" className="py-2.5 pl-4 text-right font-medium">JinVa fee</th>
                  <th scope="col" className="py-2.5 pl-4 pr-6 text-right font-medium">Your payout</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((item) => (
                  <tr key={item.paymentId} className="border-b border-border/70 align-top last:border-0">
                    <td className="max-w-[340px] py-3.5 pl-6">
                      <JobTitle item={item} />
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        <UserText>{item.clientName}</UserText>, {rowDate(item)}
                      </p>
                    </td>
                    <td className="py-3.5 pl-4">
                      <StagePill stage={item.stage} />
                      {item.transferReference ? (
                        <p className="mt-1.5 text-[13px] text-muted-foreground">
                          Transfer ref. <span className="break-all text-foreground/80">{item.transferReference}</span>
                        </p>
                      ) : null}
                      <NeedsAction
                        item={item}
                        hasPayoutMethod={hasPayoutMethod}
                        retrying={retryingJobId === item.jobId}
                        onRetry={onRetryPayout}
                      />
                    </td>
                    <td className="tnum whitespace-nowrap py-3.5 pl-4 text-right tabular-nums">
                      {formatMoney(item.gross)}
                      {Number(item.refunded) > 0 && item.stage !== "refunded" ? (
                        <span className="block text-[13px] text-muted-foreground">{formatMoney(item.refunded)} refunded</span>
                      ) : null}
                    </td>
                    <td className="tnum whitespace-nowrap py-3.5 pl-4 text-right tabular-nums text-muted-foreground">
                      {formatMoney(item.fee)}
                    </td>
                    <td className="whitespace-nowrap py-3.5 pl-4 pr-6 text-right">
                      <Payout item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phones and tablets: one card per payment, the same fields written out. */}
            <ul className="divide-y divide-border/70 border-t border-border lg:hidden">
              {state.items.map((item) => (
                <li key={item.paymentId} className="px-4 py-4 sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <JobTitle item={item} />
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        <UserText>{item.clientName}</UserText>, {rowDate(item)}
                      </p>
                    </div>
                    <Payout item={item} className="shrink-0 text-right text-sm" />
                  </div>
                  <div className="mt-2">
                    <StagePill stage={item.stage} />
                  </div>
                  <dl className="tnum mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] tabular-nums sm:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">Paid by client</dt>
                      <dd className="text-foreground">{formatMoney(item.gross)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">JinVa fee</dt>
                      <dd className="text-foreground">{formatMoney(item.fee)}</dd>
                    </div>
                    {Number(item.refunded) > 0 ? (
                      <div>
                        <dt className="text-muted-foreground">Refunded to client</dt>
                        <dd className="text-foreground">{formatMoney(item.refunded)}</dd>
                      </div>
                    ) : null}
                    {item.transferReference ? (
                      <div className="col-span-2 min-w-0">
                        <dt className="text-muted-foreground">Transfer reference</dt>
                        <dd className="break-all text-foreground">{item.transferReference}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <NeedsAction
                    item={item}
                    hasPayoutMethod={hasPayoutMethod}
                    retrying={retryingJobId === item.jobId}
                    onRetry={onRetryPayout}
                  />
                </li>
              ))}
            </ul>

            {state.pagination.totalPages > 1 ? (
              <nav aria-label="Payments pages" className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6">
                <button
                  type="button"
                  disabled={state.pagination.page <= 1}
                  onClick={() => onPage(state.pagination.page - 1)}
                  className={cn(FOCUS_RING, ACTION, "disabled:opacity-50")}
                >
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                  Previous
                </button>
                <span className="tnum text-sm tabular-nums text-muted-foreground">
                  Page {state.pagination.page} of {state.pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={state.pagination.page >= state.pagination.totalPages}
                  onClick={() => onPage(state.pagination.page + 1)}
                  className={cn(FOCUS_RING, ACTION, "disabled:opacity-50")}
                >
                  Next
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

function ListSkeleton() {
  return (
    <div aria-hidden="true" className="divide-y divide-border/70 border-t border-border">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex-1">
            <Shimmer className="h-4 w-48 max-w-full" />
            <Shimmer className="mt-2 h-3.5 w-36" />
          </div>
          <Shimmer className="h-4 w-24" />
        </div>
      ))}
    </div>
  )
}
