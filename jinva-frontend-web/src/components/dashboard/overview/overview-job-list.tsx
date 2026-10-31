"use client"

import Link from "next/link"
import { forwardRef } from "react"
import { AlertCircle, Briefcase, ChevronRight, Loader2, Plus, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { MyJob } from "@/lib/customer-api"
import { initials, listTitle, myJobsHref, stageInfo, type ShowMoreState, type Stage } from "@/lib/overview"
import { getJobStatusConfig } from "@/lib/status-badges"
import { cn, resolveAvatarUrl } from "@/lib/utils"

export type ListState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: MyJob[]; total: number }

interface OverviewJobListProps {
  stage: Stage | null
  state: ListState
  /** Footer for a filtered list (Show more / See all in My Jobs). */
  footer: ShowMoreState | null
  loadingMore: boolean
  /** Key that changes on each person-made filter change, so rows swap in (never on first paint). */
  swapKey: string | null
  /** Index of the first row loaded by the last "Show more" (gets `data-swap` and, at the end, focus). */
  appendedFrom: number | null
  onRetry: () => void
  onClear: () => void
  onShowMore: () => void
  /** The filter bar sits directly above, so the card loses its top radius and border. */
  joined: boolean
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"

/**
 * The job list card under the track (Overview spec §3, §5). One card for every
 * state: skeleton rows, error with Try again, the empty account, the filtered
 * empty state with its own "Clear filter", and the rows themselves.
 */
export const OverviewJobList = forwardRef<HTMLHeadingElement, OverviewJobListProps>(function OverviewJobList(
  { stage, state, footer, loadingMore, swapKey, appendedFrom, onRetry, onClear, onShowMore, joined },
  headingRef,
) {
  const hasRows = state.kind === "ready" && state.items.length > 0

  return (
    <section
      aria-labelledby="job-list-title"
      aria-busy={state.kind === "loading" || loadingMore || undefined}
      className={cn(
        "overflow-hidden border bg-card",
        joined ? "rounded-b-xl border-t-0 dark:border-primary/50" : "rounded-xl",
      )}
    >
      <div className="flex min-h-[49px] items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 id="job-list-title" ref={headingRef} tabIndex={-1} className="text-[15px] font-semibold text-foreground outline-none">
          {listTitle(stage)}
        </h2>
        {stage ? (
          <span className="text-sm text-muted-foreground">Newest first</span>
        ) : hasRows ? (
          <Link
            href="/dashboard/user/jobs"
            className={cn("rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline", focusRing)}
          >
            See all jobs
          </Link>
        ) : null}
      </div>

      {state.kind === "loading" ? (
        <SkeletonRows />
      ) : state.kind === "error" ? (
        <ListError onRetry={onRetry} />
      ) : state.items.length === 0 ? (
        stage ? (
          <FilteredEmpty stage={stage} onClear={onClear} />
        ) : (
          <AccountEmpty />
        )
      ) : (
        <>
          <ul key={swapKey ?? "first"} data-swap={swapKey ? "" : undefined} className="divide-y">
            {state.items.map((job, i) => (
              <JobRow key={job.id} job={job} swap={appendedFrom !== null && i >= appendedFrom} />
            ))}
          </ul>
          {stage && footer && footer.kind !== "done" && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
              {footer.kind === "more" ? (
                <>
                  <p className="text-sm tabular-nums text-muted-foreground">{footer.label}</p>
                  <Button
                    variant="outline"
                    className="h-10 bg-transparent sm:h-9"
                    onClick={onShowMore}
                    aria-disabled={loadingMore || undefined}
                    data-show-more
                  >
                    {loadingMore && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                    Show more
                  </Button>
                </>
              ) : (
                <Link
                  href={myJobsHref(stage)}
                  className={cn(
                    "ml-auto inline-flex min-h-10 items-center gap-1 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline",
                    focusRing,
                  )}
                >
                  {footer.label}
                  <ChevronRight aria-hidden className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
})

function JobRow({ job, swap }: { job: MyJob; swap: boolean }) {
  const status = getJobStatusConfig(job.status)
  const artisan = job.acceptedArtisan
  const artisanName = artisan ? `${artisan.firstname} ${artisan.lastname}`.trim() : ""
  const posted = formatPosted(job.createdAt)
  const service = job.service?.name ?? null
  const id = Number.isSafeInteger(job.id) && job.id > 0 ? job.id : null

  const content = (
    <>
      {artisan ? (
        <Avatar className="h-10 w-10 shrink-0">
          {artisan.profilePicture ? <AvatarImage src={resolveAvatarUrl(artisan.profilePicture)} alt="" /> : null}
          <AvatarFallback className="text-xs font-medium text-foreground/80">{initials(artisanName)}</AvatarFallback>
        </Avatar>
      ) : (
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Briefcase className="h-4 w-4" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate font-medium text-foreground [unicode-bidi:isolate]">
          {job.title}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {artisan ? (
            <>
              With{" "}
              <span dir="auto" className="[unicode-bidi:isolate]">
                {artisanName}
              </span>
            </>
          ) : (
            (service ?? "No service set")
          )}
          {posted && <span className="hidden sm:inline xl:hidden">, posted {posted}</span>}
        </p>
        {/* On phones the status sits under the title, so the title keeps its width. */}
        <Badge variant="outline" className={cn("mt-2 text-xs sm:hidden", status.className)}>
          {status.label}
        </Badge>
      </div>

      {/* From 1280px the wider column gains Service and Posted (spec §2.1). */}
      <span className="hidden w-28 shrink-0 truncate text-sm text-muted-foreground xl:block">{artisan ? service : null}</span>
      <span className="hidden w-24 shrink-0 text-sm tabular-nums text-muted-foreground xl:block">{posted}</span>
      <span className="hidden w-[7.5rem] shrink-0 sm:flex sm:justify-start">
        <Badge variant="outline" className={cn("text-xs", status.className)}>
          {status.label}
        </Badge>
      </span>
      <ChevronRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </>
  )

  const rowClass = cn(
    "group flex items-center gap-3 px-4 py-3.5 sm:px-5",
    "transition-colors duration-150 hover:bg-muted/50 motion-reduce:transition-none",
    "focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:focus-visible:ring-ring",
  )

  return (
    <li data-swap={swap ? "" : undefined}>
      {id ? (
        <Link href={`/dashboard/user/jobs/${id}`} className={rowClass} data-job-row>
          {content}
        </Link>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  )
}

function formatPosted(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" })
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

function ListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-4 py-12 text-center sm:px-5">
      <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-5 w-5" />
      </span>
      <p className="font-medium text-foreground">Couldn&apos;t load your jobs</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Check your connection, then try again.</p>
      <Button variant="outline" className="mt-5 h-10 bg-transparent sm:h-9" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

function FilteredEmpty({ stage, onClear }: { stage: Stage; onClear: () => void }) {
  const info = stageInfo(stage)
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center sm:px-5">
      <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-dashed text-muted-foreground">
        <SearchX className="h-5 w-5" />
      </span>
      <p className="font-medium text-foreground">No {info.noun} jobs right now</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{info.hint}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button variant="outline" className="h-10 bg-transparent sm:h-9" onClick={onClear}>
          Clear filter
        </Button>
        {stage === "open" && (
          <Button className="h-10 sm:h-9" asChild>
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

function AccountEmpty() {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center sm:px-5">
      <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Briefcase className="h-5 w-5" />
      </span>
      <p className="font-medium text-foreground">You have not posted a job yet</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Describe what needs doing and artisans near you can apply, or browse artisans and book one directly.
      </p>
      <Button className="mt-5 h-10 sm:h-9" asChild>
        <Link href="/dashboard/user/post-job">
          <Plus aria-hidden className="h-4 w-4" />
          Post a job
        </Link>
      </Button>
    </div>
  )
}
