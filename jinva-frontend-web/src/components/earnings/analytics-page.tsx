"use client"

/**
 * Earnings → Analytics (`/dashboard/artisan/earnings?tab=analytics`) on real
 * data (C1, api-contract B3): the
 * Spending page's period selector, brand band and chart-or-table cards, fed
 * by `GET /analytics/artisan?range=`. Nothing here is sample data: an empty
 * period shows empty states, not invented figures.
 */
import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { isAbortError, isRateLimited, retryAfter } from "@/lib/customer-api"
import {
  ANALYTICS_RANGES,
  parseAnalyticsRange,
  rangePhrase,
  rateText,
  ratingText,
  type AnalyticsRange,
} from "@/lib/earnings"
import { getArtisanAnalytics, type ArtisanAnalytics } from "@/lib/earnings-api"
import { bucketName, formatMoney, plural, type SpendingBucket } from "@/lib/spending"
import { cn } from "@/lib/utils"
import { PeriodSelector } from "@/components/spending/period-selector"
import { ChartCard, DataTable, FOCUS_RING, LoadError, Shimmer, UserText, ViewToggle, usePrefersReducedMotion } from "@/components/spending/shared"
import { BAND_FOCUS, BandFigure, BandHelp } from "@/components/spending/statement-band"

const OverTimeChart = dynamic(() => import("@/components/spending/spending-over-time-chart"), {
  ssr: false,
  loading: () => <Shimmer className="h-[200px] w-full sm:h-[248px]" />,
})

/** The same light-mode chart tokens as the Spending page, so both roles' charts match. */
const CHART_TOKENS =
  "not-dark:[--chart-1:oklch(0.56_0.12_160)] not-dark:[--chart-3:oklch(0.66_0.14_80)] not-dark:[--chart-4:oklch(0.56_0.11_250)]"

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties

type State =
  | { status: "loading" }
  | { status: "error"; retryIn: number; attempt: number }
  | { status: "ok"; data: ArtisanAnalytics }

const money = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2)

/** "1 Oct 2026" style bucket names from the ISO instant the API sends for rating points. */
const bucketKey = (iso: string) => iso.slice(0, 10)

function Swap({ view, children }: Readonly<{ view: string; children: React.ReactNode }>) {
  return (
    <div key={view} data-swap>
      {children}
    </div>
  )
}

const unitName = (bucket: SpendingBucket) => (bucket === "month" ? "Month" : bucket === "week" ? "Week" : "Day")

// ── Band ────────────────────────────────────────────────────────────────────

function AnalyticsBand({ data }: Readonly<{ data: ArtisanAnalytics }>) {
  const { earnings, jobCounts, overview, ratingTrend, repeatClients } = data
  const cells = [
    {
      label: "Jobs completed",
      value: jobCounts.completed.toLocaleString("en-GB"),
      note:
        jobCounts.inProgress + jobCounts.pending > 0
          ? `${jobCounts.inProgress + jobCounts.pending} more under way`
          : data.range === "all"
            ? "None under way right now"
            : `${plural(overview.completedJobsAllTime, "job")} since you joined`,
    },
    {
      label: "Average rating",
      value: overview.totalReviews > 0 ? ratingText(overview.averageRating) : "None yet",
      note:
        overview.totalReviews > 0
          ? `From ${plural(overview.totalReviews, "review")}, ${ratingTrend.reviewsInRange} in this period`
          : "Clients rate you after a job",
    },
    {
      label: "Repeat clients",
      value: repeatClients.totalClients > 0 ? rateText(repeatClients.rate) : "None yet",
      note:
        repeatClients.totalClients > 0
          ? `${repeatClients.repeatClients} of ${plural(repeatClients.totalClients, "client")} booked you again`
          : "No bookings in this period",
    },
  ]
  return (
    <section data-enter aria-label="Summary" className="overflow-hidden rounded-2xl bg-brand text-brand-foreground">
      <div className="grid md:grid-cols-3 xl:grid-cols-[1.75fr_1fr_1fr_1fr]">
        <div className="min-w-0 px-5 py-6 md:col-span-3 md:px-8 md:py-7 xl:col-span-1">
          <p className="flex items-center gap-2 text-sm text-brand-foreground/80">
            Paid to you {rangePhrase(data.range)}
            <BandHelp
              label="What counts as paid to you"
              text="Payouts that reached your payout account, after JinVa's fee. Money waiting for sign-off or on its way isn't counted until it's paid."
            />
          </p>
          <BandFigure amount={money(earnings.inRange)} />
          <p className="tnum mt-4 text-sm tabular-nums text-brand-foreground/85">
            {earnings.payoutsInRange > 0 ? `From ${plural(earnings.payoutsInRange, "payout")}. ` : "No payouts yet in this period. "}
            {earnings.pending > 0 ? (
              <>
                {formatMoney(earnings.pending)} more is waiting to be paid.{" "}
                <Link
                  href="/dashboard/artisan/earnings"
                  className={cn(
                    BAND_FOCUS,
                    "-my-3 inline-block rounded-sm py-3 font-medium text-brand-foreground underline decoration-white/40 underline-offset-4 hover:decoration-white",
                  )}
                >
                  See your statement
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={cn(
              "min-w-0 border-t border-white/12 px-5 py-3.5 md:px-7 md:py-6 xl:border-l xl:border-t-0 xl:py-7",
              i > 0 && "md:border-l",
              "max-md:flex max-md:items-start max-md:justify-between max-md:gap-4",
            )}
          >
            <div className="min-w-0">
              <p className="text-sm text-brand-foreground/80">{cell.label}</p>
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
    </section>
  )
}

// ── Earnings over time ─────────────────────────────────────────────────────

function earningsSummary(series: ArtisanAnalytics["series"]["earningsFilled"], bucket: SpendingBucket): string {
  let top: (typeof series)[number] | null = null
  for (const p of series) if (!top || Number(p.net) > Number(top.net)) top = p
  if (!top || Number(top.net) <= 0) return "No payouts in this period."
  const prep = bucket === "day" ? "on" : "in"
  return `Highest ${prep} ${bucketName(top.bucketStart, bucket)} at ${formatMoney(top.net)}.`
}

function EarningsCard({ data, reducedMotion, className }: Readonly<{ data: ArtisanAnalytics; reducedMotion: boolean; className?: string }>) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const bucket = data.bucket as SpendingBucket
  const series = useMemo(() => data.series.earningsFilled ?? [], [data])
  const chartSeries = useMemo(
    () => series.map((p) => ({ bucketStart: p.bucketStart, netSpent: p.net, count: p.payouts })),
    [series],
  )
  const unit = unitName(bucket)
  return (
    <ChartCard
      id="earnings-over-time"
      title="Earnings over time"
      summary={earningsSummary(series, bucket)}
      toggle={series.length ? <ViewToggle view={view} onChange={setView} controls="earnings-over-time" /> : undefined}
      className={className}
    >
      {series.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Your payouts will show here once you&apos;ve been paid.</p>
      ) : (
        <Swap view={view}>
          {view === "chart" ? (
            <OverTimeChart
              key={`${data.range}-${series.length}`}
              series={chartSeries}
              bucket={bucket}
              reducedMotion={reducedMotion}
              groupLabel="Earnings over time"
              countNoun="payout"
              axisWidth={68}
            />
          ) : (
            <DataTable
              caption={`Paid to you per ${unit.toLowerCase()}`}
              columns={[{ label: unit }, { label: "Paid to you", numeric: true }, { label: "Payouts", numeric: true }]}
              rows={series.map((p) => ({
                key: p.bucketStart,
                cells: [
                  bucketName(p.bucketStart, bucket, true).replace(/^The week of /, ""),
                  formatMoney(p.net),
                  p.payouts.toLocaleString("en-GB"),
                ],
                muted: Number(p.net) === 0,
              }))}
            />
          )}
        </Swap>
      )}
    </ChartCard>
  )
}

// ── Rating trend ────────────────────────────────────────────────────────────

function RatingCard({ data, className }: Readonly<{ data: ArtisanAnalytics; className?: string }>) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const { points, hasEnoughDataForTrend, reviewsInRange } = data.ratingTrend
  const bucket = data.bucket as SpendingBucket
  const name = (iso: string) => bucketName(bucketKey(iso), bucket, true).replace(/^The week of /, "")
  const summary =
    reviewsInRange === 0
      ? "No reviews in this period."
      : hasEnoughDataForTrend
        ? `${plural(reviewsInRange, "review")} in this period, averaging ${ratingText(
            points.reduce((s, p) => s + p.averageRating * p.reviewCount, 0) /
              Math.max(1, points.reduce((s, p) => s + p.reviewCount, 0)),
          )}.`
        : `${plural(reviewsInRange, "review")} in this period. A trend shows once there are more.`
  return (
    <ChartCard
      id="rating-trend"
      title="Rating trend"
      summary={summary}
      toggle={points.length ? <ViewToggle view={view} onChange={setView} controls="rating-trend" /> : undefined}
      className={className}
    >
      {points.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Ratings from clients will show here.</p>
      ) : (
        <Swap view={view}>
          {view === "chart" ? (
            <ol className="space-y-3" key={data.range}>
              {points.map((p, i) => (
                <li key={p.bucket}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-foreground">{name(p.bucket)}</span>
                    <span className="tnum shrink-0 whitespace-nowrap tabular-nums">
                      <span className="font-medium text-foreground">{p.averageRating.toFixed(1)} out of 5</span>
                      <span className="ml-2 text-muted-foreground">{plural(p.reviewCount, "review")}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted">
                    <div
                      data-draw
                      style={{ ...delay(200 + i * 50), width: `${Math.max(2, (p.averageRating / 5) * 100)}%` }}
                      className="h-2 rounded-full bg-[var(--chart-3)]"
                    />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <DataTable
              caption={`Average rating per ${unitName(bucket).toLowerCase()}`}
              columns={[{ label: unitName(bucket) }, { label: "Average rating", numeric: true }, { label: "Reviews", numeric: true }]}
              rows={points.map((p) => ({
                key: p.bucket,
                cells: [name(p.bucket), `${p.averageRating.toFixed(1)} out of 5`, p.reviewCount.toLocaleString("en-GB")],
              }))}
            />
          )}
        </Swap>
      )}
    </ChartCard>
  )
}

// ── Top services ────────────────────────────────────────────────────────────

function ServicesCard({ data, className }: Readonly<{ data: ArtisanAnalytics; className?: string }>) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const rows = data.topServices
  const top = rows[0]
  const max = rows.reduce((m, r) => Math.max(m, r.bookings), 0) || 1
  return (
    <ChartCard
      id="top-services"
      title="Top services"
      summary={
        top
          ? `${top.serviceName} is ${Math.round(top.share)}% of your bookings ${rangePhrase(data.range)}.`
          : `No bookings ${rangePhrase(data.range)}.`
      }
      toggle={rows.length ? <ViewToggle view={view} onChange={setView} controls="top-services" /> : undefined}
      className={className}
    >
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Services clients book you for will show here.</p>
      ) : (
        <Swap view={view}>
          {view === "chart" ? (
            <ol className="space-y-4" key={data.range}>
              {rows.map((r, i) => (
                <li key={r.serviceId}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <UserText className="font-medium text-foreground">{r.serviceName}</UserText>{" "}
                      <span className="whitespace-nowrap text-muted-foreground">{r.completedBookings} completed</span>
                    </span>
                    <span className="tnum shrink-0 whitespace-nowrap tabular-nums">
                      <span className="font-medium text-foreground">{plural(r.bookings, "booking")}</span>
                      <span className="ml-2 inline-block w-10 text-right text-muted-foreground">{Math.round(r.share)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted">
                    <div
                      data-draw
                      style={{ ...delay(200 + i * 50), width: `${Math.max(1, (r.bookings / max) * 100)}%` }}
                      className="h-2 rounded-full bg-[var(--chart-1)]"
                    />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <DataTable
              caption="Bookings per service"
              columns={[
                { label: "Service" },
                { label: "Bookings", numeric: true },
                { label: "Completed", numeric: true },
                { label: "Share", numeric: true },
              ]}
              rows={rows.map((r) => ({
                key: String(r.serviceId),
                cells: [
                  <UserText key="n">{r.serviceName}</UserText>,
                  r.bookings.toLocaleString("en-GB"),
                  r.completedBookings.toLocaleString("en-GB"),
                  `${Math.round(r.share)}%`,
                ],
              }))}
            />
          )}
        </Swap>
      )}
    </ChartCard>
  )
}

// ── Jobs ────────────────────────────────────────────────────────────────────

function JobsCard({ data, className }: Readonly<{ data: ArtisanAnalytics; className?: string }>) {
  const { jobCounts, repeatClients } = data
  const rows = [
    { label: "Completed", value: jobCounts.completed },
    { label: "In progress", value: jobCounts.inProgress },
    { label: "Waiting to start", value: jobCounts.pending },
    { label: "Cancelled", value: jobCounts.cancelled },
  ]
  return (
    <ChartCard
      id="jobs-breakdown"
      title="Jobs and clients"
      summary={`${plural(jobCounts.total, "job")} ${rangePhrase(data.range)}.`}
      className={className}
    >
      <DataTable
        caption="Jobs by status"
        columns={[{ label: "Status" }, { label: "Jobs", numeric: true }]}
        rows={rows.map((r) => ({ key: r.label, cells: [r.label, r.value.toLocaleString("en-GB")], muted: r.value === 0 }))}
      />
      <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        Repeat clients are clients who booked you two or more times {rangePhrase(data.range)}
        {repeatClients.totalClients > 0
          ? `: ${repeatClients.repeatClients} of ${plural(repeatClients.totalClients, "client")}.`
          : "."}{" "}
        Declined and expired bookings aren&apos;t counted.
      </p>
    </ChartCard>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  const block = "rounded-md bg-white/10 motion-safe:animate-pulse"
  return (
    <div aria-hidden="true" className="space-y-5 sm:space-y-6">
      <div className="rounded-2xl bg-brand px-5 py-6 md:px-8 md:py-7">
        <div className={cn(block, "h-4 w-56 max-w-full")} />
        <div className={cn(block, "mt-5 h-[44px] w-72 max-w-full")} />
        <div className={cn(block, "mt-5 h-4 w-64 max-w-full")} />
      </div>
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
        <Shimmer className="h-[320px] rounded-xl lg:col-span-2" />
        <Shimmer className="h-[320px] rounded-xl" />
      </div>
    </div>
  )
}

export function AnalyticsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const reducedMotion = usePrefersReducedMotion()
  const range = parseAnalyticsRange(searchParams.get("range"))

  const [state, setState] = useState<State>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  const [announcement, setAnnouncement] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    setState((prev) => (prev.status === "ok" && prev.data.range === range ? prev : { status: "loading" }))
    getArtisanAnalytics(range, controller.signal)
      .then((data) => setState({ status: "ok", data }))
      .catch((err) => {
        if (isAbortError(err)) return
        setState({ status: "error", retryIn: isRateLimited(err) ? retryAfter(err) : 0, attempt })
      })
    return () => controller.abort()
  }, [range, attempt])

  const changeRange = useCallback(
    (next: AnalyticsRange) => {
      const full = ANALYTICS_RANGES.find((r) => r.value === next)?.full ?? ""
      setAnnouncement(`Showing ${full.toLowerCase()}`)
      // Earnings → Analytics: the tab stays in the URL with the range.
      router.replace(`${pathname}?tab=analytics${next === "12m" ? "" : `&range=${next}`}`, { scroll: false })
    },
    [router, pathname],
  )

  const data = state.status === "ok" && state.data.range === range ? state.data : null

  return (
    <div className={cn("mx-auto w-full max-w-[1200px] space-y-5 sm:space-y-6 min-[1920px]:max-w-[1440px]", CHART_TOKENS)}>
      <header data-enter className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <p className="min-w-0 text-sm text-muted-foreground sm:text-base">
          How your work is going: what you&apos;ve been paid, jobs, ratings and returning clients.
        </p>
        <PeriodSelector value={range} onChange={changeRange} options={ANALYTICS_RANGES} />
      </header>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {state.status === "error" ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
          <LoadError
            title="Couldn't load your analytics"
            body="Check your connection, then try again."
            onRetry={() => setAttempt((n) => n + 1)}
            retryIn={state.retryIn}
            attempt={state.attempt}
          />
        </div>
      ) : !data ? (
        <>
          <p className="sr-only" role="status">
            Loading your analytics
          </p>
          <AnalyticsSkeleton />
        </>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <AnalyticsBand data={data} />
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <EarningsCard data={data} reducedMotion={reducedMotion} className="lg:col-span-2" />
            <ServicesCard data={data} />
            <RatingCard data={data} className="xl:col-span-2" />
            <JobsCard data={data} />
          </div>
          <p className="text-sm text-muted-foreground">
            For each payment, the fee and where your payout is, see your{" "}
            <Link href="/dashboard/artisan/earnings" className={cn(FOCUS_RING, "-my-3 inline-block rounded-sm py-3 font-medium text-primary hover:underline dark:text-ring")}>
              statement
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  )
}
