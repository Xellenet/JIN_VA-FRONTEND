"use client"

import Link from "next/link"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, ListFilter, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard/layout"
import { JobTrack, type JobStageCount } from "@/components/dashboard/job-track"
import { OverviewFilterBar } from "@/components/dashboard/overview/overview-filter-bar"
import { OverviewJobList, type ListState } from "@/components/dashboard/overview/overview-job-list"
import { AccountRail, type RailStates } from "@/components/dashboard/overview/account-rail"
import { RailNeedsAction, actionRows } from "@/components/dashboard/overview/rail-needs-action"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import {
  getCustomerOverview,
  getJobSummary,
  getMyJobs,
  isAbortError,
  isRateLimited,
  retryAfter,
  type CustomerOverview,
  type JobSummary,
  type OverviewSection,
} from "@/lib/customer-api"
import {
  FILTERED_PAGE_SIZE,
  RECENT_COUNT,
  STAGES,
  liveClear,
  liveSelect,
  liveShowMore,
  parseStage,
  showMoreState,
  stageInfo,
  summarise,
  totalLabel,
  type Stage,
} from "@/lib/overview"

/** The rail refetches on focus at most this often (FR-2.9). */
const RAIL_REFRESH_MS = 30_000
/** Stops stay disabled with skeleton counts for at most this long (FR-1.12). */
const COUNTS_GRACE_MS = 1_000

type SummaryState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: JobSummary }
type OverviewState =
  | { kind: "loading" }
  | { kind: "error"; rateLimited: boolean }
  | { kind: "ready"; data: CustomerOverview }

function OverviewContent() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlStage = parseStage(searchParams.get("stage"))

  // ── Stage filter (kept in the URL, FR-1.8) ─────────────────────────────────
  const [selected, setSelected] = useState<Stage | null>(urlStage)
  // Counts person-made filter changes so the list only animates after one (FR-1.19).
  const [filterChanges, setFilterChanges] = useState(0)
  const [live, setLive] = useState("")
  const announce = useRef<"select" | "clear" | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Back/forward or a shared link changes the URL: follow it.
  useEffect(() => {
    setSelected(urlStage)
  }, [urlStage])

  const writeStage = useCallback(
    (stage: Stage | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (stage) params.set("stage", stage)
      else params.delete("stage")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const choose = useCallback(
    (stage: Stage | null, opts: { focusHeading?: boolean } = {}) => {
      setSelected(stage)
      setFilterChanges((n) => n + 1)
      announce.current = stage ? "select" : "clear"
      writeStage(stage)
      if (opts.focusHeading) requestAnimationFrame(() => headingRef.current?.focus())
    },
    [writeStage],
  )

  const handleStop = (stage: Stage) => choose(selected === stage ? null : stage)
  const handleClear = () => choose(null, { focusHeading: true })

  // ── Account-wide counts (B7a) ──────────────────────────────────────────────
  const [summary, setSummary] = useState<SummaryState>({ kind: "loading" })
  const [countsGraceOver, setCountsGraceOver] = useState(false)
  const summaryAbort = useRef<AbortController | null>(null)

  const loadSummary = useCallback(() => {
    summaryAbort.current?.abort()
    const ctrl = new AbortController()
    summaryAbort.current = ctrl
    setSummary({ kind: "loading" })
    setCountsGraceOver(false)
    const grace = window.setTimeout(() => setCountsGraceOver(true), COUNTS_GRACE_MS)
    getJobSummary(ctrl.signal)
      .then((data) => setSummary({ kind: "ready", data }))
      .catch((err) => {
        if (!isAbortError(err)) setSummary({ kind: "error" })
      })
      .finally(() => window.clearTimeout(grace))
  }, [])

  useEffect(() => {
    loadSummary()
    return () => summaryAbort.current?.abort()
  }, [loadSummary])

  // ── Job list (B7b) ─────────────────────────────────────────────────────────
  const [list, setList] = useState<ListState>({ kind: "loading" })
  const [loadingMore, setLoadingMore] = useState(false)
  const [appendedFrom, setAppendedFrom] = useState<number | null>(null)
  const focusNewRow = useRef<number | null>(null)
  const listAbort = useRef<AbortController | null>(null)

  const loadList = useCallback((stage: Stage | null) => {
    listAbort.current?.abort()
    const ctrl = new AbortController()
    listAbort.current = ctrl
    setList({ kind: "loading" })
    setLoadingMore(false)
    setAppendedFrom(null)
    const statuses = stage ? stageInfo(stage).statuses : undefined
    const limit = stage ? FILTERED_PAGE_SIZE : RECENT_COUNT
    getMyJobs({ statuses, page: 1, limit }, ctrl.signal)
      .then(({ items, pagination }) => {
        // Unfiltered shows only the newest five, whatever the server sends.
        const rows = stage ? items : items.slice(0, RECENT_COUNT)
        setList({ kind: "ready", items: rows, total: pagination.total })
        if (announce.current === "select" && stage) setLive(liveSelect(stage, pagination.total))
        if (announce.current === "clear") setLive(liveClear(rows.length))
        announce.current = null
      })
      .catch((err) => {
        if (!isAbortError(err)) setList({ kind: "error" })
      })
  }, [])

  useEffect(() => {
    loadList(selected)
  }, [selected, loadList])

  useEffect(() => () => listAbort.current?.abort(), [])

  const loadMore = () => {
    if (!selected || list.kind !== "ready" || loadingMore) return
    const footer = showMoreState(list.items.length, list.total, selected)
    if (footer.kind !== "more") return
    const ctrl = new AbortController()
    listAbort.current?.abort()
    listAbort.current = ctrl
    setLoadingMore(true)
    const stage = selected
    getMyJobs({ statuses: stageInfo(stage).statuses, page: footer.nextPage, limit: FILTERED_PAGE_SIZE }, ctrl.signal)
      .then(({ items, pagination }) => {
        const seen = new Set(list.items.map((j) => j.id))
        const merged = [...list.items, ...items.filter((j) => !seen.has(j.id))]
        const from = list.items.length
        if (showMoreState(merged.length, pagination.total, stage).kind !== "more") focusNewRow.current = from
        setAppendedFrom(from)
        setList({ kind: "ready", items: merged, total: pagination.total })
        setLive(liveShowMore(stage, merged.length, pagination.total))
      })
      .catch((err) => {
        if (!isAbortError(err)) toast.error("Couldn't load more jobs. Please try again.")
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingMore(false)
      })
  }

  // When the footer goes away after the last "Show more", focus the first new row (spec §4.3).
  useEffect(() => {
    if (focusNewRow.current === null || list.kind !== "ready") return
    const index = focusNewRow.current
    focusNewRow.current = null
    document.querySelectorAll<HTMLElement>("[data-job-row]")[index]?.focus()
  }, [list])

  // ── Rail (B6) ──────────────────────────────────────────────────────────────
  const [overview, setOverview] = useState<OverviewState>({ kind: "loading" })
  const [now, setNow] = useState(() => new Date())
  const overviewAbort = useRef<AbortController | null>(null)
  const lastRailFetch = useRef(0)
  const rateTimer = useRef<number | undefined>(undefined)

  const loadOverview = useCallback((showSkeleton: boolean) => {
    overviewAbort.current?.abort()
    const ctrl = new AbortController()
    overviewAbort.current = ctrl
    lastRailFetch.current = Date.now()
    if (showSkeleton) setOverview({ kind: "loading" })
    getCustomerOverview(ctrl.signal)
      .then((data) => {
        setOverview({ kind: "ready", data })
        setNow(new Date())
      })
      .catch((err) => {
        if (isAbortError(err)) return
        if (isRateLimited(err)) {
          setOverview({ kind: "error", rateLimited: true })
          window.clearTimeout(rateTimer.current)
          rateTimer.current = window.setTimeout(
            () => setOverview((prev) => (prev.kind === "error" ? { kind: "error", rateLimited: false } : prev)),
            retryAfter(err) * 1000,
          )
          return
        }
        // A quiet background refresh keeps what is on screen.
        setOverview((prev) => (prev.kind === "ready" && !showSkeleton ? prev : { kind: "error", rateLimited: false }))
      })
  }, [])

  useEffect(() => {
    loadOverview(true)
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastRailFetch.current < RAIL_REFRESH_MS) return
      loadOverview(false)
    }
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
      overviewAbort.current?.abort()
      window.clearTimeout(rateTimer.current)
    }
  }, [loadOverview])

  const retryRail = useCallback(() => loadOverview(true), [loadOverview])

  const rail = useMemo<RailStates>(() => {
    if (overview.kind !== "ready") {
      const s = overview.kind === "loading" ? ({ kind: "loading" } as const) : overview
      return { actionItems: s, nextBooking: s, spend: s }
    }
    const { data } = overview
    const failed = (k: OverviewSection) => (data.failedSections ?? []).includes(k)
    const err = { kind: "error", rateLimited: false } as const
    return {
      actionItems: data.actionItems && !failed("actionItems") ? { kind: "ready", data: data.actionItems } : err,
      nextBooking: failed("nextBooking") ? err : { kind: "ready", data: data.nextBooking ?? null },
      spend: data.spend && !failed("spend") ? { kind: "ready", data: data.spend } : err,
    }
  }, [overview])

  // Below 1280px "Needs your action" sits above the track only when there is something to do (FR-2.2).
  const showActionCard =
    rail.actionItems.kind === "error" ||
    (rail.actionItems.kind === "ready" && actionRows(rail.actionItems.data).length > 0)

  if (!user) return null

  // ── Derived view state ─────────────────────────────────────────────────────
  const counts = summary.kind === "ready" ? summary.data.byStage : null
  const stageCounts: JobStageCount[] = STAGES.map(({ stage, label }) => ({
    stage,
    label,
    count: counts ? (counts[stage] ?? 0) : null,
  }))
  const countsLoading = summary.kind === "loading" && !countsGraceOver
  const results =
    selected === null ? null : list.kind === "ready" ? list.total : counts ? (counts[selected] ?? 0) : null
  const footer = selected && list.kind === "ready" ? showMoreState(list.items.length, list.total, selected) : null
  const swapKey = filterChanges > 0 ? `${selected ?? "recent"}-${filterChanges}` : null

  return (
    <div className="w-full max-w-[1600px] min-[1600px]:p-2">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] min-[1600px]:grid-cols-[minmax(0,1fr)_360px] min-[1600px]:gap-8">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <header data-enter className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                Welcome back, {user.name.split(" ")[0]}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {summary.kind === "loading"
                  ? "Loading your jobs…"
                  : summarise(summary.kind === "ready" ? summary.data.byStage : null)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <Button className="h-10 sm:h-9" asChild>
                <Link href="/dashboard/user/post-job">
                  <Plus aria-hidden className="h-4 w-4" />
                  Post a job
                </Link>
              </Button>
              <Button variant="outline" className="h-10 bg-transparent sm:h-9" asChild>
                <Link href="/dashboard/user/search">
                  <Search aria-hidden className="h-4 w-4" />
                  Find artisans
                </Link>
              </Button>
            </div>
          </header>

          {showActionCard && (
            <div className="xl:hidden">
              <RailNeedsAction state={rail.actionItems} layout="cards" onRetry={retryRail} />
            </div>
          )}

          <section aria-labelledby="track-label" data-enter style={{ "--reveal-delay": "80ms" } as React.CSSProperties}>
            <div className="mb-2 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p id="track-label" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <ListFilter aria-hidden className="h-4 w-4 text-muted-foreground" />
                Filter by stage
              </p>
              {summary.kind === "loading" ? (
                <span aria-hidden className="h-4 w-24 rounded bg-muted motion-safe:animate-pulse" />
              ) : summary.kind === "error" ? (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
                  <span>Couldn&apos;t load job counts.</span>
                  <button
                    type="button"
                    onClick={loadSummary}
                    className="inline-flex min-h-11 items-center rounded font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0 dark:focus-visible:ring-ring"
                  >
                    Try again
                  </button>
                </p>
              ) : (
                <p className="text-sm tabular-nums text-muted-foreground">{totalLabel(summary.data.total)}</p>
              )}
            </div>
            <div ref={trackRef}>
              <JobTrack
                stages={stageCounts}
                selected={selected}
                onSelect={handleStop}
                loading={countsLoading}
                labelledBy="track-label"
              />
            </div>
          </section>

          <div data-enter style={{ "--reveal-delay": "200ms" } as React.CSSProperties} className={selected ? "-mt-2.5" : undefined}>
            {selected && (
              <OverviewFilterBar
                stage={selected}
                results={results}
                trackRef={trackRef}
                onClear={handleClear}
                animate={filterChanges > 0}
              />
            )}
            <OverviewJobList
              ref={headingRef}
              stage={selected}
              state={list}
              footer={footer}
              loadingMore={loadingMore}
              swapKey={swapKey}
              appendedFrom={appendedFrom}
              onRetry={() => loadList(selected)}
              onClear={handleClear}
              onShowMore={loadMore}
              joined={selected !== null}
            />
          </div>

          <AccountRail layout="cards" states={rail} now={now} onRetry={retryRail} className="xl:hidden" />
        </div>

        <AccountRail layout="rail" states={rail} now={now} onRetry={retryRail} className="hidden xl:block" />
      </div>

      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  )
}

export default function UserDashboard() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <OverviewContent />
      </Suspense>
    </DashboardLayout>
  )
}
