"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircle,
  Briefcase,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Hourglass,
  Loader2,
  MapPin,
  MessageSquare,
  PlayCircle,
  Scale,
  SearchX,
  Send,
  Timer,
  UserX,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard/layout"
import { ApplyJobDialog } from "@/components/dashboard/apply-job-dialog"
import { ArtisanStageTrack } from "@/components/dashboard/artisan-stage-track"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch, apiFetchWithMeta } from "@/lib/api"
import {
  ARTISAN_STAGES,
  artisanJobStatus,
  artisanStageInfo,
  formatDay,
  initialsOf,
  isMyJob,
  parseArtisanView,
  personName,
  rowMatchesView,
  type ArtisanJob,
  type ArtisanJobStatusKey,
  type ArtisanJobsView,
  type ArtisanStageCounts,
} from "@/lib/artisan-jobs"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20
/** A stage that the server can only narrow by status (in progress / waiting) may need a few pages to fill a screen. */
const MIN_NEW_ROWS = 8
const MAX_AUTO_PAGES = 4

const STATUS_BADGES: Record<ArtisanJobStatusKey, { label: string; className: string; icon: typeof CircleDot }> = {
  open: { label: "Open", className: "bg-info/10 text-info border-info/20", icon: CircleDot },
  applied: { label: "Applied", className: "bg-info/10 text-info border-info/20", icon: Send },
  to_start: { label: "To start", className: "bg-warning/10 text-warning border-warning/25", icon: PlayCircle },
  in_progress: { label: "In progress", className: "bg-primary/10 text-primary border-primary/20", icon: Timer },
  waiting_on_client: { label: "Waiting on client", className: "bg-warning/10 text-warning border-warning/25", icon: Hourglass },
  done: { label: "Done", className: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground border-border", icon: CalendarX },
  other_artisan: { label: "Went to another artisan", className: "bg-muted text-muted-foreground border-border", icon: UserX },
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"

interface Pagination {
  page: number
  totalPages: number
  total: number
}

/** One server-side query feeding the list (a stage with two statuses has two). */
interface Source {
  status?: string
  page: number
  totalPages: number
  total: number
}

type OverviewCounts = { stageCounts: ArtisanStageCounts | null; disputesNeedingResponse: number | null }

function sourcesFor(view: ArtisanJobsView | null): Source[] {
  if (view === null) return [{ page: 0, totalPages: Infinity, total: 0 }]
  if (view === "open") return [{ status: "OPEN", page: 0, totalPages: Infinity, total: 0 }]
  return artisanStageInfo(view).statuses.map((status) => ({ status, page: 0, totalPages: Infinity, total: 0 }))
}

function viewTitle(view: ArtisanJobsView | null): string {
  if (view === null) return "All jobs"
  if (view === "open") return "Open jobs to apply for"
  return `${artisanStageInfo(view).label}`
}

function ArtisanJobsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlView = parseArtisanView(searchParams.get("stage"))

  const [view, setView] = useState<ArtisanJobsView | null>(urlView)
  const [serviceId, setServiceId] = useState("")
  const [locationDraft, setLocationDraft] = useState("")
  const [location, setLocation] = useState("")

  const [overview, setOverview] = useState<OverviewCounts | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [services, setServices] = useState<{ id: number | string; name: string }[]>([])

  const [jobs, setJobs] = useState<ArtisanJob[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [loadingMore, setLoadingMore] = useState(false)
  const [sources, setSources] = useState<Source[]>(() => sourcesFor(urlView))
  const requestRef = useRef(0)

  const [applyTarget, setApplyTarget] = useState<ArtisanJob | null>(null)
  const [requestingId, setRequestingId] = useState<string | null>(null)

  // Back/forward or a shared link changes the URL: follow it.
  useEffect(() => {
    setView(urlView)
  }, [urlView])

  const loadOverview = useCallback(() => {
    setOverviewLoading(true)
    apiFetch<OverviewCounts>("/artisans/me/overview")
      .then((d) => setOverview({ stageCounts: d.stageCounts ?? null, disputesNeedingResponse: d.disputesNeedingResponse ?? null }))
      .catch(() => setOverview(null))
      .finally(() => setOverviewLoading(false))
  }, [])

  useEffect(() => {
    loadOverview()
    apiFetch<{ id: number | string; name: string }[] | { items?: { id: number | string; name: string }[] }>("/services?limit=100")
      .then((d) => {
        const list = Array.isArray(d) ? d : (d.items ?? [])
        setServices([...list].sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(() => setServices([]))
  }, [loadOverview])

  // Location is typed; ask the server once the typing settles.
  useEffect(() => {
    const t = setTimeout(() => setLocation(locationDraft.trim()), 400)
    return () => clearTimeout(t)
  }, [locationDraft])

  /** Fetches the next page of every source that has one, merged newest first. */
  const fetchNext = useCallback(
    async (sources: Source[]) => {
      const pending = sources.filter((s) => s.page < s.totalPages)
      const results = await Promise.all(
        pending.map(async (s) => {
          const qs = new URLSearchParams({ page: String(s.page + 1), limit: String(PAGE_SIZE) })
          if (s.status) qs.set("status", s.status)
          if (serviceId) qs.set("serviceId", serviceId)
          if (location) qs.set("location", location)
          const { data, meta } = await apiFetchWithMeta<ArtisanJob[]>(`/jobs?${qs}`)
          const p = (meta?.pagination ?? null) as Pagination | null
          return { source: s, items: Array.isArray(data) ? data : [], p }
        }),
      )
      const next = sources.map((s) => {
        const r = results.find((x) => x.source === s)
        if (!r) return s
        return { ...s, page: s.page + 1, totalPages: r.p?.totalPages ?? s.page + 1, total: r.p?.total ?? r.items.length }
      })
      return { sources: next, items: results.flatMap((r) => r.items) }
    },
    [serviceId, location],
  )

  const mergeRows = (prev: ArtisanJob[], incoming: ArtisanJob[]) => {
    const seen = new Set(prev.map((j) => String(j.id)))
    const merged = [...prev, ...incoming.filter((j) => !seen.has(String(j.id)))]
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || Number(b.id) - Number(a.id))
  }

  /** Loads pages until enough visible rows arrive (or nothing is left). */
  const loadPages = useCallback(
    async (base: ArtisanJob[], sources: Source[], reqId: number) => {
      let rows = base
      let srcs = sources
      const visibleBefore = base.filter((j) => rowMatchesView(j, view, user?.id)).length
      for (let i = 0; i < MAX_AUTO_PAGES; i++) {
        const { sources: s, items } = await fetchNext(srcs)
        if (reqId !== requestRef.current) return null
        srcs = s
        rows = mergeRows(rows, items)
        const visible = rows.filter((j) => rowMatchesView(j, view, user?.id)).length
        const more = srcs.some((x) => x.page < x.totalPages)
        if (!more || visible - visibleBefore >= MIN_NEW_ROWS) break
        // Only a stage that the server can't narrow exactly keeps going.
        if (view !== "in_progress" && view !== "waiting_on_client" && view !== "to_start" && view !== "done") break
      }
      return { rows, sources: srcs }
    },
    [fetchNext, view, user?.id],
  )

  const loadFirst = useCallback(async () => {
    const reqId = ++requestRef.current
    setState("loading")
    setJobs([])
    try {
      const res = await loadPages([], sourcesFor(view), reqId)
      if (!res) return
      setSources(res.sources)
      setJobs(res.rows)
      setState("ready")
    } catch {
      if (reqId === requestRef.current) setState("error")
    }
  }, [loadPages, view])

  useEffect(() => {
    void loadFirst()
  }, [loadFirst])

  const loadMore = async () => {
    if (loadingMore) return
    const reqId = requestRef.current
    setLoadingMore(true)
    try {
      const res = await loadPages(jobs, sources, reqId)
      if (!res) return
      setSources(res.sources)
      setJobs(res.rows)
    } catch {
      toast.error("Couldn't load more jobs. Check your connection, then try again.")
    } finally {
      setLoadingMore(false)
    }
  }

  const writeView = (next: ArtisanJobsView | null) => {
    setView(next)
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("stage", next)
    else params.delete("stage")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const visible = useMemo(() => jobs.filter((j) => rowMatchesView(j, view, user?.id)), [jobs, view, user?.id])
  const hasMore = sources.some((s) => s.page < s.totalPages)

  // Totals come from the server: stage counts for a stage, the list's own total otherwise.
  const stageCounts = overview?.stageCounts ?? null
  const filtersOn = Boolean(serviceId || location)
  const total = (() => {
    if (view && view !== "open" && stageCounts && !filtersOn) return stageCounts[artisanStageInfo(view).countKey]
    if (view === "in_progress" || view === "waiting_on_client") return null
    return sources.reduce((n, s) => n + s.total, 0)
  })()

  const clearFilters = () => {
    setServiceId("")
    setLocationDraft("")
    setLocation("")
  }

  const handleRequestCompletion = async (job: ArtisanJob) => {
    setRequestingId(String(job.id))
    try {
      await apiFetch(`/jobs/${job.id}/request-completion`, { method: "PATCH" })
      toast.success("Completion requested. The client has been asked to confirm.")
      const now = new Date().toISOString()
      // H10: the row moves to "Waiting on client" straight away.
      setJobs((prev) => prev.map((j) => (String(j.id) === String(job.id) ? { ...j, completionRequestedAt: now } : j)))
      loadOverview()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't request completion. Try again.")
    } finally {
      setRequestingId(null)
    }
  }

  const disputesDue = overview?.disputesNeedingResponse ?? 0

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My jobs</h1>
          <p className="mt-1 text-muted-foreground">Jobs you are doing for clients, and open jobs you can apply for.</p>
        </div>
        <Button variant="outline" className="h-11 w-fit gap-2 bg-transparent sm:h-9" asChild>
          <Link href="/dashboard/artisan/disputes">
            <Scale aria-hidden className="h-4 w-4" />
            Disputes
            {disputesDue > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                {disputesDue}
                <span className="sr-only"> need your response</span>
              </span>
            )}
          </Link>
        </Button>
      </div>

      {disputesDue > 0 && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <Scale aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">
                {disputesDue === 1 ? "A client reported a problem" : `${disputesDue} clients reported a problem`}
              </p>
              <p className="text-sm text-muted-foreground">
                Read what they said and add your side. Our team reads both before deciding.
              </p>
            </div>
          </div>
          <Button className="h-11 shrink-0 sm:h-9" asChild>
            <Link href="/dashboard/artisan/disputes">
              {disputesDue === 1 ? "Respond to dispute" : "Respond to disputes"}
            </Link>
          </Button>
        </div>
      )}

      <section aria-labelledby="stage-label" className="space-y-2">
        <h2 id="stage-label" className="text-sm font-medium text-muted-foreground">
          Filter by stage
        </h2>
        <ArtisanStageTrack
          counts={stageCounts}
          selected={view && view !== "open" ? view : null}
          onSelect={(s) => writeView(view === s ? null : s)}
          loading={overviewLoading}
          labelledBy="stage-label"
        />
      </section>

      <section aria-labelledby="job-list-title" className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="job-list-title" className="text-[15px] font-semibold text-foreground">
              {viewTitle(view)}
            </h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
              <Button
                variant={view === null ? "secondary" : "ghost"}
                className="h-11 px-3 sm:h-9"
                aria-pressed={view === null}
                onClick={() => writeView(null)}
              >
                All
              </Button>
              <Button
                variant={view === "open" ? "secondary" : "ghost"}
                className="h-11 px-3 sm:h-9"
                aria-pressed={view === "open"}
                onClick={() => writeView(view === "open" ? null : "open")}
              >
                Open to apply
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,16rem)_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="job-service" className="text-xs text-muted-foreground">
                Service
              </Label>
              <select
                id="job-service"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className={cn(
                  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground sm:h-9 dark:bg-input/30",
                  focusRing,
                )}
              >
                <option value="">All services</option>
                {services.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="job-location" className="text-xs text-muted-foreground">
                Location
              </Label>
              <div className="relative">
                <MapPin aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="job-location"
                  value={locationDraft}
                  onChange={(e) => setLocationDraft(e.target.value)}
                  placeholder="Town or area"
                  maxLength={80}
                  className="h-11 pl-9 sm:h-9"
                />
              </div>
            </div>
            {filtersOn && (
              <Button variant="ghost" className="h-11 w-fit gap-1.5 text-muted-foreground sm:h-9" onClick={clearFilters}>
                <X aria-hidden className="h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {state === "loading" ? (
          <SkeletonRows />
        ) : state === "error" ? (
          <div role="alert" className="flex flex-col items-center px-4 py-12 text-center">
            <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </span>
            <p className="font-medium text-foreground">Couldn&apos;t load your jobs</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Check your connection, then try again.</p>
            <Button variant="outline" className="mt-5 h-11 bg-transparent sm:h-9" onClick={() => void loadFirst()}>
              Try again
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyList view={view} filtersOn={filtersOn} onClear={() => (filtersOn ? clearFilters() : writeView(null))} />
        ) : (
          <>
            <ul className="divide-y">
              {visible.map((job) => (
                <JobRow
                  key={String(job.id)}
                  job={job}
                  userId={user?.id}
                  requesting={requestingId === String(job.id)}
                  onApply={() => setApplyTarget(job)}
                  onRequestCompletion={() => void handleRequestCompletion(job)}
                />
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
              <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
                {total != null && total >= visible.length
                  ? `Showing ${visible.length} of ${total}`
                  : `Showing ${visible.length}`}
              </p>
              {hasMore && (
                <Button
                  variant="outline"
                  className="h-11 bg-transparent sm:h-9"
                  onClick={() => void loadMore()}
                  aria-disabled={loadingMore || undefined}
                >
                  {loadingMore && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                  Load more
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      <ApplyJobDialog
        job={applyTarget}
        open={applyTarget != null}
        onOpenChange={(open) => !open && setApplyTarget(null)}
        onApplied={(id) => {
          setJobs((prev) => prev.map((j) => (String(j.id) === String(id) ? { ...j, hasApplied: true } : j)))
          loadOverview()
        }}
      />
    </div>
  )
}

function JobRow({
  job,
  userId,
  requesting,
  onApply,
  onRequestCompletion,
}: {
  job: ArtisanJob
  userId: string | number | undefined
  requesting: boolean
  onApply: () => void
  onRequestCompletion: () => void
}) {
  const statusKey = artisanJobStatus(job, userId)
  const badge = STATUS_BADGES[statusKey]
  const BadgeIcon = badge.icon
  const clientName = personName(job.customer)
  const mine = isMyJob(job, userId)
  const canRequest = mine && job.status === "IN_PROGRESS" && !job.completionRequestedAt
  const canApply = job.status === "OPEN" && !job.hasApplied
  const href = `/dashboard/artisan/jobs/${encodeURIComponent(String(job.id))}`
  const showMessage = Boolean(job.customer?.id) && (mine || job.hasApplied)

  return (
    <li className="group relative px-4 py-4 transition-colors duration-150 hover:bg-muted/40 motion-reduce:transition-none sm:px-5">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="text-xs font-medium text-foreground/80">{initialsOf(clientName) || "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <h3 className="min-w-0 font-medium text-foreground">
              {/* The title link covers the row, so the whole row opens the job. */}
              <Link
                href={href}
                className={cn("rounded-sm after:absolute after:inset-0 after:content-[''] group-hover:text-primary", focusRing)}
              >
                <span dir="auto" className="[unicode-bidi:isolate]">
                  {job.title}
                </span>
              </Link>
            </h3>
            <Badge variant="outline" className={cn("w-fit shrink-0 text-xs", badge.className)}>
              <BadgeIcon aria-hidden className="mr-1 h-3 w-3" />
              {badge.label}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            For <span dir="auto" className="[unicode-bidi:isolate]">{clientName}</span>
            {job.service?.name ? `, ${job.service.name}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {job.location && (
              <span className="flex min-w-0 items-center gap-1.5">
                <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{job.location}</span>
              </span>
            )}
            {job.deadline && job.status !== "COMPLETED" && job.status !== "CANCELLED" && job.status !== "EXPIRED" ? (
              <span className="flex items-center gap-1.5">
                <CalendarClock aria-hidden className="h-3.5 w-3.5 shrink-0" />
                Due {formatDay(job.deadline)}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Briefcase aria-hidden className="h-3.5 w-3.5 shrink-0" />
                Posted {formatDay(job.createdAt)}
              </span>
            )}
          </div>

          {(canApply || canRequest || showMessage) && (
            <div className="relative z-10 mt-3 flex flex-wrap gap-2">
              {canApply && (
                <Button className="h-11 sm:h-9" onClick={onApply}>
                  Apply
                </Button>
              )}
              {canRequest && (
                <Button className="h-11 sm:h-9" onClick={onRequestCompletion} disabled={requesting}>
                  {requesting ? (
                    <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
                  ) : (
                    <CheckCircle2 aria-hidden className="h-4 w-4" />
                  )}
                  Request completion
                </Button>
              )}
              {showMessage && job.customer && (
                <Button variant="outline" className="h-11 bg-transparent sm:h-9" asChild>
                  <Link href={`/dashboard/artisan/messages?client=${job.customer.id}&job=${job.id}`}>
                    <MessageSquare aria-hidden className="h-4 w-4" />
                    Message client
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
        <ChevronRight
          aria-hidden
          className="mt-3 hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none sm:block"
        />
      </div>
    </li>
  )
}

function EmptyList({ view, filtersOn, onClear }: { view: ArtisanJobsView | null; filtersOn: boolean; onClear: () => void }) {
  let title = "No jobs yet"
  let hint = "Open jobs near you show here. Apply to one, or keep your services and calendar up to date so clients can book you."
  if (filtersOn) {
    title = "No jobs match these filters"
    hint = "Try another service or location."
  } else if (view === "open") {
    title = "No open jobs right now"
    hint = "New jobs that clients post will show here."
  } else if (view) {
    const info = ARTISAN_STAGES.find((s) => s.stage === view)!
    title = `No jobs ${info.noun}`
    hint = info.hint
  }
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center sm:px-5">
      <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-dashed text-muted-foreground">
        <SearchX className="h-5 w-5" />
      </span>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>
      {(filtersOn || view) && (
        <Button variant="outline" className="mt-5 h-11 bg-transparent sm:h-9" onClick={onClear}>
          {filtersOn ? "Clear filters" : "Show all jobs"}
        </Button>
      )}
    </div>
  )
}

function SkeletonRows() {
  return (
    <ul aria-hidden className="divide-y">
      {["w-2/5", "w-1/3", "w-1/2"].map((w, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className={cn("h-3.5 rounded bg-muted motion-safe:animate-pulse", w)} />
            <div className="h-3 w-1/4 rounded bg-muted motion-safe:animate-pulse" />
          </div>
          <div className="hidden h-5 w-20 rounded-md bg-muted motion-safe:animate-pulse sm:block" />
        </li>
      ))}
    </ul>
  )
}

export default function ArtisanJobsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <ArtisanJobsContent />
      </Suspense>
    </DashboardLayout>
  )
}
