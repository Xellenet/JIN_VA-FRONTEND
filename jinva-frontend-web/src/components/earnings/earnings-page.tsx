"use client"

/**
 * Earnings → Statement (H7, api-contract B2), the default tab of
 * `/dashboard/artisan/earnings`; the page owns the h1.
 *
 * One request feeds the band, the months and the first page of payments;
 * changing the stage filter or the page refetches the same endpoint (the band
 * and months don't depend on either, so they stay on screen). The period,
 * stage and page live in the URL, read through allowlists.
 */
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, RotateCcw, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { isAbortError, isRateLimited, retryAfter } from "@/lib/customer-api"
import { apiFetch } from "@/lib/api"
import {
  PAYOUT_SETTINGS_HREF,
  isZero,
  parseStage,
  rangePhrase,
  type EarningsPeriod,
  type EarningsStage,
} from "@/lib/earnings"
import {
  downloadEarningsCsv,
  getEarningsStatement,
  retryTransfer,
  type EarningsStatement,
  type PayoutDestination,
} from "@/lib/earnings-api"
import { formatMoney, parseRange, periodAnnouncement, plural } from "@/lib/spending"
import { cn } from "@/lib/utils"
import { DownloadCsvButton } from "@/components/spending/download-csv-button"
import { PeriodSelector } from "@/components/spending/period-selector"
import { FOCUS_RING, LoadError, usePrefersReducedMotion } from "@/components/spending/shared"
import { EarningsBand, EarningsBandSkeleton } from "./earnings-band"
import { EarningsEmpty } from "./earnings-empty"
import { MonthsCard } from "./months-card"
import { PaymentsList, type ListState } from "./payments-list"

const PAGE_SIZE = 20

type SummaryState =
  | { status: "loading" }
  | { status: "error"; retryIn: number; attempt: number }
  | { status: "ok"; data: EarningsStatement }

function csvName(): string {
  const d = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Accra" })
    .formatToParts(new Date())
  const get = (t: string) => d.find((p) => p.type === t)?.value ?? ""
  return `jinva-earnings-${get("year")}-${get("month")}-${get("day")}.csv`
}

export function EarningsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const reducedMotion = usePrefersReducedMotion()

  const period = parseRange(searchParams.get("period")) as EarningsPeriod
  const stage = parseStage(searchParams.get("stage"))
  const pageRaw = searchParams.get("page")
  const page = pageRaw && /^\d{1,4}$/.test(pageRaw) ? Math.min(1000, Math.max(1, Number(pageRaw))) : 1

  const writeUrl = useCallback(
    (next: { period: EarningsPeriod; stage: EarningsStage | "all"; page: number }) => {
      const params = new URLSearchParams()
      if (next.period !== "12m") params.set("period", next.period)
      if (next.stage !== "all") params.set("stage", next.stage)
      if (next.page > 1) params.set("page", String(next.page))
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )

  const [announcement, setAnnouncement] = useState("")
  const headingRef = useRef<HTMLHeadingElement>(null)

  // ── Payout method (for the alerts and row actions) ─────────────────────────
  const [hasPayoutMethod, setHasPayoutMethod] = useState<boolean | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    apiFetch<{ payoutType?: string | null; payoutDestination?: PayoutDestination | null }>("/users/me/artisan-profile", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((p) => setHasPayoutMethod(Boolean(p.payoutDestination || p.payoutType)))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  // ── Statement: summary (period only) and list (period, stage, page) ────────
  const [summary, setSummary] = useState<SummaryState>({ status: "loading" })
  const [list, setList] = useState<ListState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  const [listAttempt, setListAttempt] = useState(0)
  const [summaryFor, setSummaryFor] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setList((prev) => (prev.status === "ok" ? prev : { status: "loading" }))
    getEarningsStatement({ period, stage, page, limit: PAGE_SIZE }, controller.signal)
      .then(({ data, pagination }) => {
        setSummary({ status: "ok", data })
        setSummaryFor(period)
        setList({ status: "ok", items: data.items ?? [], pagination })
      })
      .catch((err) => {
        if (isAbortError(err)) return
        const retryIn = isRateLimited(err) ? retryAfter(err) : 0
        setSummary((prev) => (prev.status === "ok" ? prev : { status: "error", retryIn, attempt }))
        setList({ status: "error", retryIn, attempt: listAttempt })
      })
    return () => controller.abort()
  }, [period, stage, page, attempt, listAttempt])

  // Never earned anything: only asked when the period shows nothing at all.
  const [everEarned, setEverEarned] = useState<boolean | null>(null)
  const data = summary.status === "ok" ? summary.data : null
  const periodEmpty =
    data !== null &&
    stage === "all" &&
    list.status === "ok" &&
    list.pagination.total === 0 &&
    isZero(data.balances.heldForSignOff) &&
    isZero(data.balances.onTheWay) &&
    isZero(data.balances.needsAction)
  useEffect(() => {
    if (!periodEmpty) return
    if (period === "all") {
      setEverEarned(false)
      return
    }
    const controller = new AbortController()
    getEarningsStatement({ period: "all", stage: "all", page: 1, limit: 1 }, controller.signal)
      .then(({ pagination }) => setEverEarned(pagination.total > 0))
      .catch(() => setEverEarned(true))
    return () => controller.abort()
  }, [periodEmpty, period])

  // ── Actions ───────────────────────────────────────────────────────────────
  const changePeriod = (next: EarningsPeriod) => {
    setAnnouncement(periodAnnouncement(next))
    setSummary({ status: "loading" })
    writeUrl({ period: next, stage, page: 1 })
  }
  const changeStage = (next: EarningsStage | "all") => writeUrl({ period, stage: next, page: 1 })
  const changePage = (next: number) => {
    writeUrl({ period, stage, page: next })
    headingRef.current?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" })
    headingRef.current?.focus({ preventScroll: true })
  }
  const reload = () => setListAttempt((n) => n + 1)

  const [retryingJobId, setRetryingJobId] = useState<number | null>(null)
  const retryOne = async (jobId: number) => {
    setRetryingJobId(jobId)
    try {
      await retryTransfer(jobId)
      toast.success("Payout retried")
      reload()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't retry the payout. Try again.")
    } finally {
      setRetryingJobId(null)
    }
  }

  const needsAction = data ? data.balances.needsActionCount : 0
  const [retryingAll, setRetryingAll] = useState(false)
  const retryAll = async () => {
    setRetryingAll(true)
    try {
      // Every row that needs action and can be retried, across pages.
      const { data: d } = await getEarningsStatement({ period: "all", stage: "needs_action", page: 1, limit: 100 })
      const jobIds = [
        ...new Set(
          d.items
            .filter((i) => (i.failureReason === "transfer_failed" || i.holdReason === "payout_check_pending") && i.jobId)
            .map((i) => i.jobId as number),
        ),
      ]
      let ok = 0
      for (const id of jobIds) {
        try {
          await retryTransfer(id)
          ok += 1
        } catch {
          // keep going; summarised below
        }
      }
      if (jobIds.length === 0) toast.error("There's nothing to retry. Check your payout details.")
      else if (ok === jobIds.length) toast.success(`Retried ${plural(ok, "payout")}`)
      else if (ok > 0) toast.warning(`Retried ${ok} of ${jobIds.length} payouts. The rest still need your action.`)
      else toast.error("Couldn't retry your payouts. Check your payout details, then try again.")
      reload()
    } catch {
      toast.error("Couldn't retry your payouts. Try again.")
    } finally {
      setRetryingAll(false)
    }
  }

  const loading = summary.status === "loading" || (data !== null && summaryFor !== period)
  const neverEarned = periodEmpty && everEarned === false

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 sm:space-y-6 min-[1920px]:max-w-[1440px]">
      <header data-enter className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <p className="min-w-0 text-sm text-muted-foreground sm:text-base">
          What clients paid for your jobs, JinVa&apos;s fee, and where your payouts are.
        </p>
        {neverEarned ? null : <PeriodSelector value={period} onChange={changePeriod} />}
      </header>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {hasPayoutMethod === false ? (
        <div role="note" className="flex flex-col gap-4 rounded-xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:p-5">
          <Wallet aria-hidden="true" className="h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Add a payout method so we can pay you</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data && !isZero(data.balances.needsAction)
                ? `${formatMoney(data.balances.needsAction)} is waiting to be sent to you.`
                : "Without one, we can't send you the money for jobs you complete."}
            </p>
          </div>
          <Link
            href={PAYOUT_SETTINGS_HREF}
            className={cn(
              FOCUS_RING,
              "inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:h-10",
            )}
          >
            Add payout details
          </Link>
        </div>
      ) : hasPayoutMethod === true && needsAction > 0 && data ? (
        <div role="note" className="flex flex-col gap-4 rounded-xl border border-attention/30 bg-attention/10 p-4 sm:flex-row sm:items-center sm:p-5">
          <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-attention" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">
              {needsAction === 1 ? "A payout needs your action" : `${needsAction} payouts need your action`}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatMoney(data.balances.needsAction)} couldn&apos;t be sent to your payout account. Check your payout
              details, then retry.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link
              href={PAYOUT_SETTINGS_HREF}
              className={cn(
                FOCUS_RING,
                "inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted sm:h-10",
              )}
            >
              Update payout details
            </Link>
            <button
              type="button"
              onClick={retryAll}
              disabled={retryingAll}
              aria-busy={retryingAll}
              className={cn(
                FOCUS_RING,
                "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:h-10",
                retryingAll && "cursor-progress opacity-80",
              )}
            >
              {retryingAll ? <Spinner className="h-4 w-4" /> : <RotateCcw aria-hidden="true" className="h-4 w-4" />}
              {needsAction === 1 ? "Retry payout" : "Retry all"}
            </button>
          </div>
        </div>
      ) : null}

      {summary.status === "error" ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
          <LoadError
            title="Couldn't load your earnings"
            body="Check your connection, then try again."
            onRetry={() => setAttempt((n) => n + 1)}
            retryIn={summary.retryIn}
            attempt={summary.attempt}
          />
        </div>
      ) : loading || !data ? (
        <>
          <p className="sr-only" role="status">
            Loading your earnings
          </p>
          <EarningsBandSkeleton />
        </>
      ) : neverEarned ? (
        <EarningsEmpty />
      ) : (
        <>
          <EarningsBand data={data} period={period} />
          {periodEmpty && everEarned ? (
            <section className="rounded-xl border border-dashed border-border px-5 py-6 sm:px-8">
              <h2 className="text-lg font-semibold text-foreground">No paid jobs {rangePhrase(period)}</h2>
              <p className="mt-1.5 max-w-[52ch] text-sm text-muted-foreground">
                Your earlier earnings are still here. Choose a longer period to see them.
              </p>
              <button
                type="button"
                onClick={() => changePeriod("all")}
                className={cn(
                  FOCUS_RING,
                  "mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto",
                )}
              >
                Show all time
              </button>
            </section>
          ) : (
            <>
              <MonthsCard data={data} period={period} />
              <PaymentsList
                state={list}
                period={period}
                stage={stage}
                onStage={changeStage}
                onPage={changePage}
                onRetryLoad={reload}
                hasPayoutMethod={hasPayoutMethod}
                retryingJobId={retryingJobId}
                onRetryPayout={retryOne}
                headingRef={headingRef}
                download={
                  <DownloadCsvButton
                    fetchCsv={() => downloadEarningsCsv({ period, stage })}
                    fileName={csvName}
                    tooLargeMessage="Narrow the period, then download again."
                    failedMessage="Couldn't download your earnings. Check your connection, then try again."
                  />
                }
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
