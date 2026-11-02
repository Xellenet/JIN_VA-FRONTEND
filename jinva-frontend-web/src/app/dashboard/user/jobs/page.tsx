"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle,
  Briefcase,
  CalendarX,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Hourglass,
  Link2,
  Loader2,
  MapPin,
  PlayCircle,
  Plus,
  Search,
  SearchX,
  Star,
  Timer,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard/layout"
import { JobTrack, type JobStageCount } from "@/components/dashboard/job-track"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiFetch } from "@/lib/api"
import { formatDay, initialsOf } from "@/lib/artisan-jobs"
import { getJobSummary, getMyJobs, isAbortError, type JobStatus, type JobSummary, type MyJob } from "@/lib/customer-api"
import { STAGES, parseStage, stageInfo, totalLabel, type Stage } from "@/lib/overview"
import { cn, formatCurrency, resolveAvatarUrl } from "@/lib/utils"

/** A row of `GET /jobs/mine`; the shape is owned by the shared client. */
type BackendJob = MyJob

const STATUS_OPTIONS: readonly { label: string; value: "all" | JobStatus }[] = [
  { label: "All statuses", value: "all" },
  { label: "Open", value: "OPEN" },
  { label: "Awaiting start", value: "PENDING" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Expired", value: "EXPIRED" },
]

type BadgeKey = JobStatus | "TO_CONFIRM"

/** Status badges carry an icon as well as a colour, so status never reads by colour alone. */
const STATUS_BADGES: Record<BadgeKey, { label: string; className: string; icon: typeof CircleDot }> = {
  OPEN: { label: "Open", className: "bg-info/10 text-info border-info/20", icon: CircleDot },
  PENDING: { label: "Awaiting start", className: "bg-warning/10 text-warning border-warning/25", icon: PlayCircle },
  IN_PROGRESS: { label: "In progress", className: "bg-primary/10 text-primary border-primary/20", icon: Timer },
  TO_CONFIRM: { label: "Ready to confirm", className: "bg-warning/10 text-warning border-warning/25", icon: Hourglass },
  COMPLETED: { label: "Completed", className: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  EXPIRED: { label: "Expired", className: "bg-muted text-muted-foreground border-border", icon: CalendarX },
}

function badgeFor(job: BackendJob) {
  if (job.status === "IN_PROGRESS" && job.completionRequestedAt) return STATUS_BADGES.TO_CONFIRM
  return STATUS_BADGES[job.status] ?? { label: job.status, className: "", icon: CircleDot }
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"
const selectClass = cn(
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground sm:h-9 dark:bg-input/30",
  focusRing,
)

/**
 * Decisions #2: job *progress* (the OPEN → PENDING → IN_PROGRESS → COMPLETED
 * state machine, for both open-posting and booking-linked jobs) lives here,
 * genuinely separate from /dashboard/user/bookings (booking-request states
 * only). A job with `bookingId` set originated from a confirmed direct
 * booking (R2); one without it came from the open-posting flow.
 */
const PAGE_SIZE = 50
const STAGE_PREFIX = "stage:"

/** `stage:in_progress` → `in_progress`; anything else → null (always through `parseStage`). */
function filterStage(filter: string): Stage | null {
  return filter.startsWith(STAGE_PREFIX) ? parseStage(filter.slice(STAGE_PREFIX.length)) : null
}

/** A plain status filter, only ever one of our own literals. */
function filterStatus(filter: string): JobStatus | null {
  const opt = STATUS_OPTIONS.find((s) => s.value === filter)
  return opt && opt.value !== "all" ? opt.value : null
}

type SummaryState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: JobSummary }

function UserJobsContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // `?stage=` comes from the Overview ("See all completed jobs in My Jobs") and
  // its rail links. Only the four literals are accepted (SEC-19).
  const urlStage = parseStage(searchParams.get("stage"))
  const [jobs, setJobs] = useState<BackendJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [nextPage, setNextPage] = useState(2)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState(urlStage ? `${STAGE_PREFIX}${urlStage}` : "all")
  const [cancelJobId, setCancelJobId] = useState<number | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [summary, setSummary] = useState<SummaryState>({ kind: "loading" })
  const activeStage = filterStage(statusFilter)
  const activeStatus = filterStatus(statusFilter)

  // Account-wide counts for the stage track (never counted from the loaded page).
  const loadSummary = useCallback(() => {
    const ctrl = new AbortController()
    setSummary({ kind: "loading" })
    getJobSummary(ctrl.signal)
      .then((data) => setSummary({ kind: "ready", data }))
      .catch((err) => {
        if (!isAbortError(err)) setSummary({ kind: "error" })
      })
    return ctrl
  }, [])

  useEffect(() => {
    const ctrl = loadSummary()
    return () => ctrl.abort()
  }, [loadSummary])

  // A stage or status asks the server for just its statuses, so a filter with
  // more than one page of jobs is still complete here.
  const fetchPage = useCallback(
    (page: number) =>
      getMyJobs({
        statuses: activeStage ? stageInfo(activeStage).statuses : activeStatus ? [activeStatus] : undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [activeStage, activeStatus],
  )

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadFailed(false)
    // `/jobs/mine` caps `limit` at 50 and 400s above it.
    fetchPage(1)
      .then(({ items, pagination }) => {
        if (cancelled) return
        setJobs(items)
        setTotal(pagination.total)
        setHasMore(pagination.page < pagination.totalPages)
        setNextPage(2)
      })
      .catch(() => {
        if (cancelled) return
        setJobs([])
        setTotal(null)
        setLoadFailed(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchPage, reloadKey])

  const loadMore = async () => {
    if (isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const { items, pagination } = await fetchPage(nextPage)
      setJobs((prev) => {
        const seen = new Set(prev.map((j) => j.id))
        return [...prev, ...items.filter((j) => !seen.has(j.id))]
      })
      setTotal(pagination.total)
      setHasMore(pagination.page < pagination.totalPages)
      setNextPage((p) => p + 1)
    } catch {
      toast.error("Couldn't load more jobs. Try again.")
    } finally {
      setIsLoadingMore(false)
    }
  }

  const chooseFilter = (value: string) => {
    setStatusFilter(value)
    const stage = filterStage(value)
    const params = new URLSearchParams(searchParams.toString())
    if (stage) params.set("stage", stage)
    else params.delete("stage")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return jobs.filter((job) => {
      const matchesSearch =
        !q ||
        job.title.toLowerCase().includes(q) ||
        (job.service?.name ?? "").toLowerCase().includes(q) ||
        String(job.id).includes(q)
      const matchesStatus = activeStage
        ? (stageInfo(activeStage).statuses as readonly string[]).includes(job.status)
        : activeStatus
          ? job.status === activeStatus
          : true
      return matchesSearch && matchesStatus
    })
  }, [jobs, searchQuery, activeStage, activeStatus])

  const handleCancelJob = async () => {
    if (cancelJobId == null) return
    setIsCancelling(true)
    try {
      await apiFetch(`/jobs/${cancelJobId}/cancel`, { method: "PATCH" })
      setJobs((prev) => prev.map((j) => (j.id === cancelJobId ? { ...j, status: "CANCELLED" } : j)))
      toast.success("Job cancelled.")
      loadSummary()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel the job. Try again.")
    } finally {
      setIsCancelling(false)
      setCancelJobId(null)
    }
  }

  const counts = summary.kind === "ready" ? summary.data.byStage : null
  const stageCounts: JobStageCount[] = STAGES.map(({ stage, label }) => ({
    stage,
    label,
    count: counts ? (counts[stage] ?? 0) : null,
  }))
  const filtersOn = Boolean(searchQuery.trim()) || statusFilter !== "all"
  const clearFilters = () => {
    setSearchQuery("")
    chooseFilter("all")
  }
  const listTitle = activeStage
    ? `${stageInfo(activeStage).label} jobs`
    : activeStatus
      ? `${STATUS_BADGES[activeStatus].label} jobs`
      : "All jobs"
  const searching = Boolean(searchQuery.trim())

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>
          <p className="mt-1 text-muted-foreground">Track the work you&apos;ve posted or booked.</p>
        </div>
        <Button className="h-11 w-fit gap-2 sm:h-9" asChild>
          <Link href="/dashboard/user/post-job">
            <Plus aria-hidden className="h-4 w-4" />
            Post a job
          </Link>
        </Button>
      </div>

      <section aria-labelledby="stage-label" className="space-y-2">
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 id="stage-label" className="text-sm font-medium text-muted-foreground">
            Filter by stage
          </h2>
          {summary.kind === "error" ? (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
              <span>Couldn&apos;t load job counts.</span>
              <button
                type="button"
                onClick={() => loadSummary()}
                className={cn("inline-flex min-h-11 items-center rounded font-medium text-foreground underline underline-offset-4 sm:min-h-0", focusRing)}
              >
                Try again
              </button>
            </p>
          ) : summary.kind === "ready" ? (
            <p className="text-sm tabular-nums text-muted-foreground">{totalLabel(summary.data.total)}</p>
          ) : null}
        </div>
        <JobTrack
          stages={stageCounts}
          selected={activeStage}
          onSelect={(s) => chooseFilter(activeStage === s ? "all" : `${STAGE_PREFIX}${s}`)}
          loading={summary.kind === "loading"}
          labelledBy="stage-label"
        />
      </section>

      <section aria-labelledby="job-list-title" className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5">
          <h2 id="job-list-title" className="text-[15px] font-semibold text-foreground">
            {listTitle}
          </h2>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,18rem)_minmax(0,12rem)_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="job-search" className="text-xs text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="job-search"
                  type="search"
                  placeholder="Title, service or job number"
                  className="h-11 pl-9 sm:h-9"
                  maxLength={100}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="job-status" className="text-xs text-muted-foreground">
                Status
              </Label>
              {/* A stage chosen on the track shows as "All statuses" here; picking a status replaces it. */}
              <select
                id="job-status"
                value={activeStatus ?? "all"}
                onChange={(e) => chooseFilter(e.target.value)}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {filtersOn && (
              <Button variant="ghost" className="h-11 w-fit gap-1.5 text-muted-foreground sm:h-9" onClick={clearFilters}>
                <X aria-hidden className="h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <SkeletonRows />
        ) : loadFailed ? (
          <div role="alert" className="flex flex-col items-center px-4 py-12 text-center">
            <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </span>
            <p className="font-medium text-foreground">Couldn&apos;t load your jobs</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Check your connection, then try again.</p>
            <Button variant="outline" className="mt-5 h-11 bg-transparent sm:h-9" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <EmptyList stage={activeStage} filtersOn={filtersOn} onClear={clearFilters} />
        ) : (
          <>
            <ul className="divide-y">
              {filteredJobs.map((job) => (
                <JobRow key={job.id} job={job} onCancel={() => setCancelJobId(job.id)} />
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
              <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
                {searching
                  ? `${filteredJobs.length} ${filteredJobs.length === 1 ? "match" : "matches"} in ${jobs.length} loaded`
                  : total != null && total >= filteredJobs.length
                    ? `Showing ${filteredJobs.length} of ${total}`
                    : `Showing ${filteredJobs.length}`}
              </p>
              {hasMore && (
                <Button
                  variant="outline"
                  className="h-11 bg-transparent sm:h-9"
                  onClick={() => void loadMore()}
                  aria-disabled={isLoadingMore || undefined}
                >
                  {isLoadingMore && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                  Load more
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      <AlertDialog open={cancelJobId != null} onOpenChange={(open) => !open && setCancelJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this job?</AlertDialogTitle>
            <AlertDialogDescription>
              Artisans can no longer apply or start work, and you can&apos;t undo this. If you&apos;ve paid for the job, the
              payment is refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9" disabled={isCancelling}>
              Keep job
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelJob}
              className="h-11 bg-destructive text-white hover:bg-destructive/90 sm:h-9"
              disabled={isCancelling}
            >
              {isCancelling ? <Loader2 aria-hidden className="mr-2 h-4 w-4 motion-safe:animate-spin" /> : null}
              Cancel job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function JobRow({ job, onCancel }: { job: BackendJob; onCancel: () => void }) {
  const badge = badgeFor(job)
  const BadgeIcon = badge.icon
  const artisan = job.acceptedArtisan
  const artisanName = artisan ? `${artisan.firstname ?? ""} ${artisan.lastname ?? ""}`.trim() || "Former artisan" : null
  const href = `/dashboard/user/jobs/${encodeURIComponent(String(job.id))}`
  const canCancel = job.status === "OPEN" || job.status === "PENDING"
  const canReview = job.status === "COMPLETED"
  const hasBudget = job.budgetMin != null || job.budgetMax != null

  return (
    <li className="group relative px-4 py-4 transition-colors duration-150 hover:bg-muted/40 motion-reduce:transition-none sm:px-5">
      <div className="flex items-start gap-3">
        {artisan ? (
          <Avatar className="h-10 w-10 shrink-0">
            {artisan.profilePicture ? <AvatarImage src={resolveAvatarUrl(artisan.profilePicture)} alt="" /> : null}
            <AvatarFallback className="text-xs font-medium text-foreground/80">{initialsOf(artisanName ?? "") || "?"}</AvatarFallback>
          </Avatar>
        ) : (
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Briefcase className="h-4 w-4" />
          </span>
        )}
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
            {artisanName ? (
              <>
                With <span dir="auto" className="[unicode-bidi:isolate]">{artisanName}</span>
              </>
            ) : job.status === "OPEN" ? (
              "No artisan chosen yet"
            ) : (
              "No artisan"
            )}
            {job.service?.name ? `, ${job.service.name}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Briefcase aria-hidden className="h-3.5 w-3.5 shrink-0" />
              Posted {formatDay(job.createdAt)}
            </span>
            {job.location && (
              <span className="flex min-w-0 max-w-full items-center gap-1.5">
                <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{job.location}</span>
              </span>
            )}
            {hasBudget && (
              <span className="tabular-nums">
                Budget {job.budgetMin != null ? formatCurrency(job.budgetMin) : "—"}
                {job.budgetMax != null && job.budgetMax !== job.budgetMin ? ` to ${formatCurrency(job.budgetMax)}` : ""}
              </span>
            )}
            {job.bookingId ? (
              <span className="flex items-center gap-1.5">
                <Link2 aria-hidden className="h-3.5 w-3.5 shrink-0" />
                From booking #{job.bookingId}
              </span>
            ) : null}
          </div>

          {(job.bookingId || canReview || canCancel) && (
            <div className="relative z-10 mt-3 flex flex-wrap gap-2">
              {canReview && (
                <Button className="h-11 sm:h-9" asChild>
                  <Link href={`/dashboard/user/review/${job.id}`}>
                    <Star aria-hidden className="h-4 w-4" />
                    Leave a review
                  </Link>
                </Button>
              )}
              {job.bookingId ? (
                <Button variant="outline" className="h-11 bg-transparent sm:h-9" asChild>
                  <Link href={`/dashboard/user/bookings/${job.bookingId}`}>View booking</Link>
                </Button>
              ) : null}
              {canCancel && (
                <Button
                  variant="outline"
                  className="h-11 border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9"
                  onClick={onCancel}
                >
                  Cancel job
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

function EmptyList({ stage, filtersOn, onClear }: { stage: Stage | null; filtersOn: boolean; onClear: () => void }) {
  let title = "No jobs yet"
  let hint = "Post a job and artisans near you can apply, or book an artisan directly."
  if (stage) {
    const info = stageInfo(stage)
    title = `No ${info.noun} jobs`
    hint = info.hint
  } else if (filtersOn) {
    title = "No jobs match these filters"
    hint = "Try another search or status."
  }
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center sm:px-5">
      <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-dashed text-muted-foreground">
        <SearchX className="h-5 w-5" />
      </span>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {filtersOn && (
          <Button variant="outline" className="h-11 bg-transparent sm:h-9" onClick={onClear}>
            {stage ? "Show all jobs" : "Clear filters"}
          </Button>
        )}
        {(!filtersOn || stage === "open") && (
          <Button className="h-11 sm:h-9" asChild>
            <Link href="/dashboard/user/post-job">
              <Plus aria-hidden className="h-4 w-4" />
              Post a job
            </Link>
          </Button>
        )}
      </div>
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

export default function UserJobsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <UserJobsContent />
      </Suspense>
    </DashboardLayout>
  )
}
