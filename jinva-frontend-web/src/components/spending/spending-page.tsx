"use client"

/**
 * `/dashboard/user/report`, titled "Spending" (FR-4.1 to FR-4.19).
 *
 * Two independent blocks (FR-4.18): the summary (B2) and the history (B3),
 * each with its own skeleton, error and Try again. The URL holds the state
 * (`range`, `status`, `serviceId`, `artisanProfileId`, `search`, `page`), read
 * through allowlists (SEC-19) and written with `URLSearchParams`. Nothing is
 * kept in browser storage (SEC-33); stale requests are aborted.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  getPaymentHistory,
  getPaymentHistoryFilterOptions,
  getSpendingAnalytics,
  isAbortError,
  isRateLimited,
  retryAfter,
  type PaymentHistoryFilterOptions,
  type PaymentHistoryFilters,
  type SpendingAnalytics,
} from "@/lib/customer-api"
import {
  EMPTY_FILTERS,
  HISTORY_PAGE_SIZE,
  hasActiveFilters,
  parseHistoryFilters,
  parseRange,
  periodAnnouncement,
  serialiseHistoryFilters,
  type HistoryFilters,
  type SpendingRange,
} from "@/lib/spending"
import { cn } from "@/lib/utils"
import { DownloadCsvButton } from "./download-csv-button"
import type { FilterPatch } from "./history-filters"
import { PaymentHistory, type HistoryState } from "./payment-history"
import { PeriodSelector } from "./period-selector"
import { ArtisanCard, CategoryCard, ChannelCard, ChartsSkeleton, OverTimeCard } from "./spending-charts"
import { SpendingEmpty } from "./spending-empty"
import { LoadError, usePrefersReducedMotion } from "./shared"
import { PeriodEmpty, StatementBand, StatementBandSkeleton } from "./statement-band"

type AnalyticsState =
  | { status: "loading" }
  | { status: "error"; retryIn: number; attempt: number }
  | { status: "ok"; data: SpendingAnalytics }

/**
 * Spec D1 / plan Q-S1: in light mode only, the page wrapper re-points three
 * chart tokens (green, amber, blue) so the charts match the product; dark mode
 * keeps the global tokens. Artisan and admin analytics are untouched.
 */
const CHART_TOKENS =
  "not-dark:[--chart-1:oklch(0.56_0.12_160)] not-dark:[--chart-3:oklch(0.66_0.14_80)] not-dark:[--chart-4:oklch(0.56_0.11_250)]"

const SEARCH_DEBOUNCE_MS = 300

export function SpendingPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const reducedMotion = usePrefersReducedMotion()

  const range = parseRange(searchParams.get("range"))
  const queryKey = searchParams.toString()
  // Re-parsed only when the query string changes, so effects see stable values.
  const filters = useMemo(() => parseHistoryFilters(new URLSearchParams(queryKey)), [queryKey])
  const statusKey = filters.status.join(",")

  const writeUrl = useCallback(
    (nextRange: SpendingRange, next: HistoryFilters) => {
      const qs = serialiseHistoryFilters(nextRange, next).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )

  // ── Period ────────────────────────────────────────────────────────────────
  const [announcement, setAnnouncement] = useState("")
  const changeRange = (next: SpendingRange) => {
    setAnnouncement(periodAnnouncement(next))
    writeUrl(next, { ...filters, page: 1 })
  }

  // ── Search box: typed text is local, the URL follows 300 ms later ──────────
  const [search, setSearch] = useState(filters.search)
  const lastWritten = useRef(filters.search)
  useEffect(() => {
    if (filters.search !== lastWritten.current) {
      lastWritten.current = filters.search
      setSearch(filters.search)
    }
  }, [filters.search])
  useEffect(() => {
    // Also skip a value this page already wrote (e.g. "" from Clear all
    // filters): until the URL catches up, `filters` is stale and writing it
    // back would restore the filters that were just cleared.
    if (search.trim() === filters.search.trim() || search.trim() === lastWritten.current) return
    const timer = window.setTimeout(() => {
      lastWritten.current = search.trim()
      writeUrl(range, { ...filters, search, page: 1 })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search, filters, range, writeUrl])

  const applyFilter = (patch: FilterPatch) => writeUrl(range, { ...filters, ...patch, search, page: 1 })
  const headingRef = useRef<HTMLHeadingElement>(null)
  // FR-4.12 / NFR-2: the "Clear all filters" button unmounts once nothing is
  // filtered, so focus moves to the results heading rather than to <body>.
  const clearFilters = () => {
    lastWritten.current = ""
    setSearch("")
    writeUrl(range, { ...EMPTY_FILTERS })
    headingRef.current?.focus({ preventScroll: true })
  }

  // ── B2 summary ────────────────────────────────────────────────────────────
  const [analytics, setAnalytics] = useState<AnalyticsState>({ status: "loading" })
  const [analyticsAttempt, setAnalyticsAttempt] = useState(0)
  const [analyticsBusy, setAnalyticsBusy] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    setAnalyticsBusy(true)
    setAnalytics((prev) => (prev.status === "ok" ? prev : { status: "loading" }))
    getSpendingAnalytics(range, controller.signal)
      .then((data) => setAnalytics({ status: "ok", data }))
      .catch((err) => {
        if (isAbortError(err)) return
        setAnalytics({ status: "error", retryIn: isRateLimited(err) ? retryAfter(err) : 0, attempt: analyticsAttempt })
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnalyticsBusy(false)
      })
    return () => controller.abort()
  }, [range, analyticsAttempt])

  // ── B3 history ────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistoryState>({ status: "loading" })
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const [historyBusy, setHistoryBusy] = useState(true)
  const historyQuery: PaymentHistoryFilters = useMemo(
    () => ({
      range,
      statuses: statusKey ? (statusKey.split(",") as PaymentHistoryFilters["statuses"]) : undefined,
      serviceId: filters.serviceId ?? undefined,
      artisanProfileId: filters.artisanProfileId ?? undefined,
      search: filters.search.trim() || undefined,
    }),
    [range, statusKey, filters.serviceId, filters.artisanProfileId, filters.search],
  )
  // Which query the shown result answers. The previous result stays on screen
  // while the next one loads, so a stale "0 matches" must not be read as an
  // empty period once the filters are cleared (that swapped the card to its
  // empty-period form and dropped the focus Clear all filters had set).
  const historyKey = JSON.stringify([historyQuery, filters.page])
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const historyStale = historyFor !== historyKey
  useEffect(() => {
    const controller = new AbortController()
    setHistoryBusy(true)
    setHistory((prev) => (prev.status === "ok" ? prev : { status: "loading" }))
    getPaymentHistory({ ...historyQuery, page: filters.page, limit: HISTORY_PAGE_SIZE }, controller.signal)
      .then((res) => {
        setHistory({ status: "ok", items: res.items, pagination: res.pagination })
        setHistoryFor(JSON.stringify([historyQuery, filters.page]))
      })
      .catch((err) => {
        if (isAbortError(err)) return
        setHistory({ status: "error", retryIn: isRateLimited(err) ? retryAfter(err) : 0, attempt: historyAttempt })
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryBusy(false)
      })
    return () => controller.abort()
  }, [historyQuery, filters.page, historyAttempt])

  // Payments in the period without filters ("5 of 21 payments…" and the subtitle).
  const filtered = hasActiveFilters(filters)
  const [periodTotals, setPeriodTotals] = useState<Partial<Record<SpendingRange, number>>>({})
  useEffect(() => {
    if (!filtered && !historyStale && history.status === "ok") {
      const total = history.pagination.total
      setPeriodTotals((t) => (t[range] === total ? t : { ...t, [range]: total }))
    }
  }, [filtered, historyStale, history, range])
  const knownTotal = periodTotals[range]
  useEffect(() => {
    if (!filtered || knownTotal !== undefined) return
    const controller = new AbortController()
    getPaymentHistory({ range, page: 1, limit: 1 }, controller.signal)
      .then((res) => setPeriodTotals((t) => ({ ...t, [range]: res.pagination.total })))
      .catch(() => undefined)
    return () => controller.abort()
  }, [filtered, knownTotal, range])

  // B3f: the Service and Artisan options. On failure the selects offer "All" only.
  const [options, setOptions] = useState<PaymentHistoryFilterOptions | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    getPaymentHistoryFilterOptions(controller.signal)
      .then(setOptions)
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  const countFor = useCallback(
    (draft: Pick<HistoryFilters, "status" | "serviceId" | "artisanProfileId">, signal: AbortSignal) =>
      getPaymentHistory(
        {
          range,
          page: 1,
          limit: 1,
          statuses: draft.status,
          serviceId: draft.serviceId ?? undefined,
          artisanProfileId: draft.artisanProfileId ?? undefined,
          search: filters.search.trim() || undefined,
        },
        signal,
      ).then((res) => res.pagination.total),
    [range, filters.search],
  )

  const goToPage = (page: number) => {
    writeUrl(range, { ...filters, search, page })
    headingRef.current?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" })
    headingRef.current?.focus({ preventScroll: true })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const data = analytics.status === "ok" ? analytics.data : null
  const neverPaid = data !== null && !data.hasPaymentsEver
  const periodEmpty = data !== null && data.hasPaymentsEver && data.totals.paymentsCount === 0
  const loading = analytics.status === "loading" || (analyticsBusy && data?.range !== range)

  return (
    <div className={cn("mx-auto w-full max-w-[1200px] space-y-5 sm:space-y-6 min-[1920px]:max-w-[1440px]", CHART_TOKENS)}>
      <header data-enter className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">Your spending</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            What you have paid through JinVa, what it was for and who you paid.
          </p>
        </div>
        {neverPaid ? null : <PeriodSelector value={range} onChange={changeRange} />}
      </header>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {loading ? <p className="sr-only" role="status">Loading your spending</p> : null}

      {neverPaid ? (
        <SpendingEmpty />
      ) : (
        <>
          {analytics.status === "error" ? (
            <div className="rounded-2xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
              <LoadError
                title="Couldn't load your spending summary"
                body="The totals and charts couldn't be fetched. Your payment history below is up to date. Check your connection, then try again."
                onRetry={() => setAnalyticsAttempt((n) => n + 1)}
                retryIn={analytics.retryIn}
                attempt={analytics.attempt}
              />
            </div>
          ) : loading || !data ? (
            <div className="space-y-5 sm:space-y-6">
              <StatementBandSkeleton />
              <ChartsSkeleton />
            </div>
          ) : periodEmpty ? (
            <PeriodEmpty range={range} onShowAll={() => changeRange("all")} />
          ) : (
            <div aria-busy={analyticsBusy} className="space-y-5 sm:space-y-6">
              <StatementBand data={data} range={range} />
              <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
                <OverTimeCard data={data} reducedMotion={reducedMotion} className="order-1 lg:col-span-2" />
                <CategoryCard data={data} className="order-2" />
                <ArtisanCard data={data} className="order-3 lg:order-4 lg:col-span-2 xl:order-3" />
                <ChannelCard data={data} className="order-4 lg:order-3 xl:order-4" />
              </div>
            </div>
          )}

          <div className="mx-auto w-full max-w-[1200px]" aria-busy={historyBusy}>
            <PaymentHistory
              state={history}
              stale={historyStale}
              range={range}
              periodTotal={knownTotal ?? null}
              filters={filters}
              search={search}
              options={options}
              download={<DownloadCsvButton filters={historyQuery} />}
              headingRef={headingRef}
              onSearch={setSearch}
              onFilter={applyFilter}
              onClear={clearFilters}
              onPage={goToPage}
              onRetry={() => {
                setHistory({ status: "loading" })
                setHistoryAttempt((n) => n + 1)
              }}
              countFor={countFor}
            />
          </div>
        </>
      )}
    </div>
  )
}
