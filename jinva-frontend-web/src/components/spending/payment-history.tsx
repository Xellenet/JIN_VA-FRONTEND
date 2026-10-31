"use client"

/**
 * FR-4.11 to FR-4.13: the payment history, moved here from Settings. A table
 * from 768px (Method from 1024px, Reference from 1280px; both are always in
 * the expanded row) and stacked cards below. 20 per page. One row open at a
 * time; the row toggle is a real button with `aria-expanded`.
 */
import Link from "next/link"
import { Fragment, useState, type MouseEvent, type ReactNode } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Pagination, PaymentHistoryFilterOptions, PaymentHistoryRow } from "@/lib/customer-api"
import {
  artisanHref,
  formatDate,
  formatDateTime,
  formatMoney,
  hasActiveFilters,
  historySubtitle,
  isInactiveStatus,
  jobHref,
  methodLabel,
  periodPhrase,
  resultLine,
  type HistoryFilters,
  type SpendingRange,
} from "@/lib/spending"
import { cn } from "@/lib/utils"
import { HistoryFilterSheet } from "./history-filter-sheet"
import { PickFilter, SearchBox, StatusFilter, activeValuesText, type FilterPatch } from "./history-filters"
import { FOCUS_RING, LoadError, MethodIcon, SCROLL_MARGIN, Shimmer, StatusPill, UserText } from "./shared"

export type HistoryState =
  | { status: "loading" }
  | { status: "error"; retryIn: number; attempt: number }
  | { status: "ok"; items: PaymentHistoryRow[]; pagination: Pagination }

const jobTitle = (row: PaymentHistoryRow) => row.job?.title ?? "Job"
const artisanName = (row: PaymentHistoryRow) => (row.artisan.id === null ? "Former artisan" : row.artisan.displayName)
const paidOrStarted = (row: PaymentHistoryRow) => row.paidAt ?? row.date

function ArtisanCell({ row }: Readonly<{ row: PaymentHistoryRow }>) {
  const href = row.artisan.id === null ? null : artisanHref(row.artisan.id)
  if (!href) return <UserText className="text-muted-foreground">{artisanName(row)}</UserText>
  return (
    <Link href={href} className={cn(FOCUS_RING, "rounded-sm hover:underline")}>
      <UserText>{artisanName(row)}</UserText>
    </Link>
  )
}

function Method({ row }: Readonly<{ row: PaymentHistoryRow }>) {
  if (!row.channel) return <span className="text-muted-foreground">{methodLabel(null, row.status)}</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <MethodIcon channel={row.channel} />
      {methodLabel(row.channel, row.status)}
    </span>
  )
}

function Details({ row, extra }: Readonly<{ row: PaymentHistoryRow; extra?: ReactNode }>) {
  const href = jobHref(row.jobId)
  const refunded = Number(row.refundedAmount) > 0
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] lg:grid-cols-4">
        {extra}
        <div>
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="tnum mt-0.5 break-all font-medium text-foreground tabular-nums">{row.reference}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{row.paidAt ? "Paid" : "Checkout started"}</dt>
          <dd className="mt-0.5 font-medium text-foreground">{formatDateTime(paidOrStarted(row))}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Paid to the artisan</dt>
          <dd className="mt-0.5 font-medium text-foreground">{row.releasedAt ? formatDateTime(row.releasedAt) : "Not yet"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Refunded to you</dt>
          <dd className="tnum mt-0.5 font-medium text-foreground tabular-nums">
            {refunded ? formatMoney(row.refundedAmount) : "Nothing refunded"}
          </dd>
        </div>
      </dl>
      {href ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={href}
            className={cn(FOCUS_RING, "inline-flex h-11 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted md:h-9")}
          >
            <FileText aria-hidden="true" className="h-4 w-4" />
            View job
          </Link>
        </div>
      ) : null}
    </>
  )
}

function HistoryTable({
  rows,
  openId,
  onToggle,
}: Readonly<{ rows: PaymentHistoryRow[]; openId: number | null; onToggle: (id: number) => void }>) {
  const rowClick = (e: MouseEvent<HTMLTableRowElement>, id: number) => {
    if ((e.target as HTMLElement).closest("a,button")) return
    onToggle(id)
  }
  return (
    <table className="hidden w-full text-sm md:table">
      <caption className="sr-only">Payment history</caption>
      <thead>
        <tr className="border-y border-border bg-muted/40 text-left text-[13px] text-muted-foreground">
          <th scope="col" className="whitespace-nowrap py-2.5 pl-4 font-medium xl:pl-6">Date paid</th>
          <th scope="col" className="py-2.5 pl-4 font-medium">Job</th>
          <th scope="col" className="py-2.5 pl-4 font-medium">Artisan</th>
          <th scope="col" className="hidden py-2.5 pl-4 font-medium lg:table-cell">Method</th>
          <th scope="col" className="py-2.5 pl-4 text-right font-medium">Amount</th>
          <th scope="col" className="py-2.5 pl-4 font-medium xl:pl-6">Status</th>
          <th scope="col" className="hidden py-2.5 pl-4 font-medium xl:table-cell">Reference</th>
          <th scope="col" className="w-12 py-2.5 pr-4">
            <span className="sr-only">Details</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const open = openId === row.id
          const inactive = isInactiveStatus(row.status)
          const href = jobHref(row.jobId)
          const refunded = Number(row.refundedAmount) > 0
          return (
            <Fragment key={row.id}>
              <tr
                onClick={(e) => rowClick(e, row.id)}
                className={cn("cursor-pointer border-b border-border/70 hover:bg-muted/30", inactive && "text-muted-foreground", open && "border-b-0 bg-muted/30")}
              >
                <td className={cn("whitespace-nowrap py-3 pl-4 align-top xl:pl-6", !inactive && "text-muted-foreground")}>{formatDate(paidOrStarted(row))}</td>
                <td className="min-w-[8rem] max-w-[260px] py-3 pl-4 align-top">
                  {href ? (
                    <Link href={href} className={cn(FOCUS_RING, "rounded-sm font-medium hover:underline", !inactive && "text-foreground")}>
                      <UserText>{jobTitle(row)}</UserText>
                    </Link>
                  ) : (
                    <UserText className="font-medium">{jobTitle(row)}</UserText>
                  )}
                  <p className="text-[13px] text-muted-foreground">
                    <UserText>{row.service.name}</UserText>
                  </p>
                </td>
                <td className="py-3 pl-4 align-top">
                  <ArtisanCell row={row} />
                </td>
                <td className="hidden py-3 pl-4 align-top lg:table-cell xl:whitespace-nowrap">
                  <Method row={row} />
                </td>
                <td className="whitespace-nowrap py-3 pl-4 text-right align-top">
                  <span className={cn("tnum font-medium tabular-nums", !inactive && "text-foreground")}>{formatMoney(row.amount)}</span>
                  {refunded ? (
                    <p className="tnum text-[13px] tabular-nums text-muted-foreground">{formatMoney(row.refundedAmount)} refunded</p>
                  ) : null}
                </td>
                <td className="py-3 pl-4 align-top xl:pl-6">
                  <StatusPill status={row.status} />
                </td>
                <td className="tnum hidden whitespace-nowrap py-3 pl-4 align-top text-[13px] tabular-nums text-muted-foreground xl:table-cell">{row.reference}</td>
                <td className="py-2 pl-2 pr-3 align-top xl:pr-4">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`payment-${row.id}`}
                    aria-label={`Details for ${jobTitle(row)}`}
                    onClick={() => onToggle(row.id)}
                    className={cn(FOCUS_RING, SCROLL_MARGIN, "grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted")}
                  >
                    <ChevronRight aria-hidden="true" className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-90")} />
                  </button>
                </td>
              </tr>
              {open ? (
                <tr id={`payment-${row.id}`} className="border-b border-border/70 bg-muted/30">
                  <td />
                  <td colSpan={7} className="py-4 pl-4 pr-6">
                    <div data-swap>
                      <Details
                        row={row}
                        extra={
                          <div className="lg:hidden">
                            <dt className="text-muted-foreground">Method</dt>
                            <dd className="mt-0.5 font-medium text-foreground">
                              <Method row={row} />
                            </dd>
                          </div>
                        }
                      />
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function HistoryCards({
  rows,
  openId,
  onToggle,
}: Readonly<{ rows: PaymentHistoryRow[]; openId: number | null; onToggle: (id: number) => void }>) {
  return (
    <ul className="divide-y divide-border border-t border-border md:hidden">
      {rows.map((row) => {
        const open = openId === row.id
        const inactive = isInactiveStatus(row.status)
        const refunded = Number(row.refundedAmount) > 0
        return (
          <li key={row.id}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`payment-card-${row.id}`}
              onClick={() => onToggle(row.id)}
              className={cn(FOCUS_RING, SCROLL_MARGIN, "block w-full px-4 py-4 text-left ring-inset", inactive && "text-muted-foreground")}
            >
              <span className="flex items-start justify-between gap-3">
                <UserText className={cn("min-w-0 font-medium leading-snug", !inactive && "text-foreground")}>{jobTitle(row)}</UserText>
                <ChevronDown aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} />
              </span>
              <span className="mt-1 block text-[13px] text-muted-foreground">
                <UserText>{row.service.name}</UserText>, <UserText>{artisanName(row)}</UserText>
              </span>
              <span className="mt-2.5 flex items-center justify-between gap-3">
                <StatusPill status={row.status} />
                <span className="text-right">
                  <span className={cn("tnum block text-[15px] font-semibold tabular-nums", !inactive && "text-foreground")}>{formatMoney(row.amount)}</span>
                  {refunded ? (
                    <span className="tnum block text-xs tabular-nums text-muted-foreground">{formatMoney(row.refundedAmount)} refunded</span>
                  ) : null}
                </span>
              </span>
              <span className="mt-1.5 block text-xs text-muted-foreground">{formatDate(paidOrStarted(row))}</span>
            </button>
            {open ? (
              <div id={`payment-card-${row.id}`} data-swap className="mx-4 mb-4 rounded-lg bg-muted/60 p-3.5">
                <Details
                  row={row}
                  extra={
                    <div>
                      <dt className="text-muted-foreground">Method</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        <Method row={row} />
                      </dd>
                    </div>
                  }
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Page numbers with gaps: 1 … 4 5 6 … 12 */
function pageList(page: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | "gap")[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap")
    out.push(n)
  })
  return out
}

function Pager({ pagination, onPage }: Readonly<{ pagination: Pagination; onPage: (page: number) => void }>) {
  const { page, limit, total, totalPages } = pagination
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(total, page * limit)
  const showing = `Showing ${from.toLocaleString("en-GB")}–${to.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")}`
  const nav = (label: string, target: number, disabled: boolean, children: ReactNode, cls?: string) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => onPage(target)}
      className={cn(FOCUS_RING, "inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:text-muted-foreground/60", cls)}
    >
      {children}
    </button>
  )
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6 sm:py-4">
      <p className="tnum text-sm tabular-nums text-muted-foreground">{showing}</p>
      {totalPages > 1 ? (
        <nav aria-label="Payment history pages">
          <div className="flex items-center gap-1 md:hidden">
            {nav("Previous page", page - 1, page <= 1, <ChevronLeft aria-hidden="true" className="h-4 w-4" />, "h-11 w-11")}
            <span className="tnum whitespace-nowrap px-1 text-sm tabular-nums">
              Page {page} of {totalPages}
            </span>
            {nav("Next page", page + 1, page >= totalPages, <ChevronRight aria-hidden="true" className="h-4 w-4" />, "h-11 w-11")}
          </div>
          <ul className="hidden items-center gap-1 md:flex">
            <li>
              {nav("Previous page", page - 1, page <= 1, <>
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                Previous
              </>, "h-9 px-2.5")}
            </li>
            {pageList(page, totalPages).map((n, i) =>
              n === "gap" ? (
                <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
                  …
                </li>
              ) : (
                <li key={n}>
                  <button
                    type="button"
                    aria-label={`Page ${n}`}
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => n !== page && onPage(n)}
                    className={cn(
                      FOCUS_RING,
                      "tnum h-9 min-w-9 rounded-md px-2 text-sm tabular-nums",
                      n === page ? "border border-border bg-card font-semibold text-foreground" : "text-foreground hover:bg-muted",
                    )}
                  >
                    {n}
                  </button>
                </li>
              ),
            )}
            <li>
              {nav("Next page", page + 1, page >= totalPages, <>
                Next
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </>, "h-9 px-2.5")}
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  )
}

export function HistorySkeleton() {
  return (
    <div aria-hidden="true">
      <div className="hidden md:block">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-t border-border px-6 py-4">
            <Shimmer className="h-3.5 w-20" />
            <Shimmer className="h-3.5 flex-[3]" />
            <Shimmer className="h-3.5 flex-1" />
            <Shimmer className="hidden h-3.5 flex-1 lg:block" />
            <Shimmer className="h-3.5 flex-1" />
            <Shimmer className="h-5 w-20" />
            <Shimmer className="hidden h-3.5 flex-1 xl:block" />
          </div>
        ))}
      </div>
      <div className="md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2.5 border-t border-border px-4 py-4">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-3 w-1/2" />
            <div className="flex justify-between">
              <Shimmer className="h-5 w-24" />
              <Shimmer className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PaymentHistory({
  state,
  range,
  periodTotal,
  filters,
  search,
  options,
  download,
  headingRef,
  onSearch,
  onFilter,
  onClear,
  stale = false,
  onPage,
  onRetry,
  countFor,
}: Readonly<{
  state: HistoryState
  range: SpendingRange
  /** Payments in the period with no filters; null while unknown. */
  periodTotal: number | null
  filters: HistoryFilters
  search: string
  options: PaymentHistoryFilterOptions | null
  download: ReactNode
  headingRef: React.Ref<HTMLHeadingElement>
  onSearch: (value: string) => void
  onFilter: (patch: FilterPatch) => void
  onClear: () => void
  /** The result on screen answers an earlier query; the next one is loading. */
  stale?: boolean
  onPage: (page: number) => void
  onRetry: () => void
  countFor: Parameters<typeof HistoryFilterSheet>[0]["countFor"]
}>) {
  const [openId, setOpenId] = useState<number | null>(null)
  const toggle = (id: number) => setOpenId((cur) => (cur === id ? null : id))
  const filtered = hasActiveFilters(filters)
  const matching = state.status === "ok" ? state.pagination.total : null
  const emptyPeriod = !filtered && !stale && state.status === "ok" && state.pagination.total === 0
  const phrase = periodPhrase(range)

  // FR-4.17: an empty period shows the card header with one line, nothing else.
  if (emptyPeriod) {
    return (
      <section aria-labelledby="payment-history-title" className="rounded-xl border border-border bg-card px-4 py-4 sm:px-6 sm:py-5">
        <h3 id="payment-history-title" ref={headingRef} tabIndex={-1} className="text-[15px] font-semibold text-foreground outline-none">
          Payment history
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{phrase ? `No payments in the ${phrase}.` : "No payments yet."}</p>
      </section>
    )
  }

  const line = matching !== null && periodTotal !== null ? resultLine(matching, periodTotal) : null

  return (
    <section aria-labelledby="payment-history-title" className="min-w-0 rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <h3 id="payment-history-title" ref={headingRef} tabIndex={-1} className={cn("text-[15px] font-semibold text-foreground outline-none", SCROLL_MARGIN)}>
            Payment history
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodTotal !== null ? historySubtitle(periodTotal, range) : "Newest first."}
          </p>
        </div>
        {download}
      </div>

      <div className="px-4 pb-1 pt-4 sm:px-6">
        {/* Phone: search, then the Filters sheet with the active values written beside it. */}
        <div className="space-y-3 md:hidden">
          <SearchBox value={search} onChange={onSearch} className="w-full" />
          <div className="flex min-w-0 items-center gap-3">
            <HistoryFilterSheet filters={filters} options={options} onApply={onFilter} countFor={countFor} />
            <span className="min-w-0 truncate text-sm text-muted-foreground" dir="auto">
              {activeValuesText(filters, options)}
            </span>
          </div>
        </div>
        {/* From 768px: every control in one row. */}
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <SearchBox value={search} onChange={onSearch} className="w-full max-w-[300px]" />
          <StatusFilter status={filters.status} onChange={onFilter} />
          <PickFilter kind="service" value={filters.serviceId} options={options} onChange={(serviceId) => onFilter({ serviceId })} />
          <PickFilter kind="artisan" value={filters.artisanProfileId} options={options} onChange={(artisanProfileId) => onFilter({ artisanProfileId })} />
        </div>

        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", filtered ? "mt-3" : "mt-0")}>
          <p role="status" aria-live="polite" className="text-sm">
            {filtered && line ? (
              <>
                <span className="font-semibold text-foreground">{line.lead}</span>{" "}
                <span className="text-muted-foreground">{line.rest}</span>
              </>
            ) : null}
          </p>
          {filtered ? (
            <button
              type="button"
              onClick={onClear}
              className={cn(FOCUS_RING, "inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:underline md:h-9 dark:text-ring")}
            >
              <X aria-hidden="true" className="h-4 w-4" />
              Clear all filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        {state.status === "loading" ? (
          <HistorySkeleton />
        ) : state.status === "error" ? (
          <div className="border-t border-border px-4 py-6 sm:px-6">
            <LoadError
              title="Couldn't load your payment history"
              body="Check your connection, then try again."
              onRetry={onRetry}
              retryIn={state.retryIn}
              attempt={state.attempt}
            />
          </div>
        ) : state.items.length === 0 ? (
          <div className="px-4 pb-5 sm:px-6 sm:pb-6">
            <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
                <Search aria-hidden="true" className="h-5 w-5" />
              </span>
              <p className="mt-4 font-semibold text-foreground">No payments match these filters</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another status, service or artisan.</p>
              <Button type="button" variant="outline" className={cn(FOCUS_RING, "mt-5 h-11 md:h-10")} onClick={onClear}>
                <X aria-hidden="true" className="h-4 w-4" />
                Clear all filters
              </Button>
            </div>
          </div>
        ) : (
          <div data-swap key={`${state.pagination.page}-${state.items[0]?.id}`}>
            <HistoryTable rows={state.items} openId={openId} onToggle={toggle} />
            <HistoryCards rows={state.items} openId={openId} onToggle={toggle} />
            <Pager pagination={state.pagination} onPage={onPage} />
          </div>
        )}
      </div>
    </section>
  )
}
