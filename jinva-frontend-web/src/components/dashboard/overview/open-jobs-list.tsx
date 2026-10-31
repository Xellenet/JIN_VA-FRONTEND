"use client"

import Link from "next/link"
import { AlertCircle, Briefcase, CheckCircle2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OpenJob } from "@/lib/artisan-overview-api"
import { artisanJobHref, formatGhs } from "@/lib/artisan-overview"
import { cn } from "@/lib/utils"

export type OpenJobsState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: OpenJob[]; total: number }

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"

/**
 * Open jobs (status OPEN only) the artisan can apply for, newest first. Apply
 * opens the price dialog; jobs already applied for say so (B4 `hasApplied`,
 * so it survives a reload).
 */
export function OpenJobsList({
  state,
  applied,
  onApply,
  onRetry,
}: {
  state: OpenJobsState
  /** Applied for in this visit (on top of `hasApplied`). */
  applied: Set<number>
  onApply: (job: OpenJob) => void
  onRetry: () => void
}) {
  const hasRows = state.kind === "ready" && state.items.length > 0

  return (
    <section aria-labelledby="open-jobs-title" aria-busy={state.kind === "loading" || undefined} className="overflow-hidden rounded-xl border bg-card">
      <div className="flex min-h-[49px] items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id="open-jobs-title" className="text-[15px] font-semibold text-foreground">
            Open jobs
          </h2>
          <p className="text-sm text-muted-foreground">Posted by clients and still taking applications</p>
        </div>
        {hasRows && (
          <Link
            href="/dashboard/artisan/jobs"
            className={cn("inline-flex min-h-11 shrink-0 items-center rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline sm:min-h-0", focusRing)}
          >
            {state.total > state.items.length ? `See all ${state.total}` : "See all"}
          </Link>
        )}
      </div>

      {state.kind === "loading" ? (
        <ul aria-hidden className="divide-y">
          {["w-2/5", "w-1/3", "w-1/2"].map((w, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-4 sm:px-5">
              <div className="h-10 w-10 shrink-0 rounded-full bg-muted motion-safe:animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className={cn("h-3.5 rounded bg-muted motion-safe:animate-pulse", w)} />
                <div className="h-3 w-1/4 rounded bg-muted motion-safe:animate-pulse" />
              </div>
              <div className="h-9 w-20 rounded-md bg-muted motion-safe:animate-pulse" />
            </li>
          ))}
        </ul>
      ) : state.kind === "error" ? (
        <div role="alert" className="flex flex-col items-center px-4 py-10 text-center sm:px-5">
          <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5" />
          </span>
          <p className="font-medium text-foreground">Couldn&apos;t load open jobs</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Check your connection, then try again.</p>
          <Button variant="outline" className="mt-5 h-11 bg-transparent sm:h-9" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : state.items.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-10 text-center sm:px-5">
          <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Briefcase className="h-5 w-5" />
          </span>
          <p className="font-medium text-foreground">No open jobs right now</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            New jobs clients post show here. Keep your services and profile up to date so clients can also book you directly.
          </p>
          <Button variant="outline" className="mt-5 h-11 bg-transparent sm:h-9" asChild>
            <Link href="/dashboard/artisan/services">Review my services</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y">
          {state.items.map((job) => (
            <OpenJobRow key={job.id} job={job} applied={Boolean(job.hasApplied) || applied.has(job.id)} onApply={onApply} />
          ))}
        </ul>
      )}
    </section>
  )
}

function OpenJobRow({ job, applied, onApply }: { job: OpenJob; applied: boolean; onApply: (job: OpenJob) => void }) {
  const href = artisanJobHref(job.id)
  const budget = budgetText(job.budgetMin, job.budgetMax)
  const posted = formatDate(job.createdAt)

  return (
    <li className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-muted/50 motion-reduce:transition-none sm:px-5">
      <span aria-hidden className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground min-[400px]:flex">
        <Briefcase className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        {href ? (
          // The whole row opens the job (stretched link); Apply sits above it.
          <Link
            href={href}
            dir="auto"
            className={cn(
              "block truncate rounded-sm font-medium text-foreground underline-offset-4 [unicode-bidi:isolate] group-hover:underline",
              "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary dark:focus-visible:after:ring-ring",
            )}
          >
            {job.title}
          </Link>
        ) : (
          <p dir="auto" className="truncate font-medium text-foreground [unicode-bidi:isolate]">
            {job.title}
          </p>
        )}
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {job.service?.name ?? "Any service"}
          {budget && <>, {budget}</>}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <span className="sr-only">Location: </span>
          <span dir="auto" className="truncate [unicode-bidi:isolate]">
            {job.location?.trim() || "Location not given"}
            {posted && <span className="hidden sm:inline">{`, posted ${posted}`}</span>}
          </span>
        </p>
      </div>
      {applied ? (
        <span className="relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-success sm:h-9">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          Applied
        </span>
      ) : (
        <Button className="relative z-10 h-11 shrink-0 sm:h-9" onClick={() => onApply(job)} aria-label={`Apply for ${job.title}`}>
          Apply
        </Button>
      )}
    </li>
  )
}

function budgetText(min: OpenJob["budgetMin"], max: OpenJob["budgetMax"]): string | null {
  const lo = Number(min)
  const hi = Number(max)
  const okLo = Number.isFinite(lo) && lo > 0
  const okHi = Number.isFinite(hi) && hi > 0
  if (okLo && okHi) return lo === hi ? formatGhs(lo) : `${formatGhs(lo)} to ${formatGhs(hi)}`
  if (okHi) return `up to ${formatGhs(hi)}`
  if (okLo) return `from ${formatGhs(lo)}`
  return null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" })
}
