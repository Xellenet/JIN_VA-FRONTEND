"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, Briefcase, ChevronRight, MessageSquare, Scale } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { formatDay, personName } from "@/lib/artisan-jobs"
import { getDisputeCategoryLabel } from "@/lib/disputes"
import { getDisputeStatusConfig } from "@/lib/status-badges"
import { cn } from "@/lib/utils"

/** A row of `GET /disputes/my` (api-contract.md B5). */
interface DisputeRow {
  id: number
  status: string
  category?: string | null
  createdAt: string
  booking?: { id: number; scheduledDate?: string | null } | null
  raisedBy?: { id: number; firstname?: string | null; lastname?: string | null } | null
  viewerRole: "RAISER" | "COUNTERPARTY"
  responseDue?: boolean
  canRespond?: boolean
  jobId?: number | null
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"

/**
 * H6: the artisan's disputes, those a client filed against them and those
 * they filed. Disputes waiting on the artisan's response come first.
 */
export default function ArtisanDisputesPage() {
  const [rows, setRows] = useState<DisputeRow[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")

  const load = useCallback(() => {
    setState("loading")
    apiFetch<DisputeRow[]>("/disputes/my")
      .then((d) => {
        setRows(Array.isArray(d) ? d : [])
        setState("ready")
      })
      .catch(() => setState("error"))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Response needed first; otherwise the server's newest-first order holds.
  const sorted = useMemo(() => {
    const due = (d: DisputeRow) => Boolean(d.responseDue ?? d.canRespond)
    return rows.map((d, i) => ({ d, i })).sort((a, b) => Number(due(b.d)) - Number(due(a.d)) || a.i - b.i).map((x) => x.d)
  }, [rows])
  const dueCount = rows.filter((d) => d.responseDue ?? d.canRespond).length

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Button variant="ghost" asChild className="-ml-2 h-11 gap-2 text-muted-foreground hover:text-foreground sm:h-9">
          <Link href="/dashboard/artisan/jobs">
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Back to My Jobs
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Disputes</h1>
          <p className="mt-1 max-w-prose text-muted-foreground">
            Problems reported on your jobs. When a client reports one, add your side so our team can read both before
            deciding.
          </p>
        </div>

        <section aria-labelledby="dispute-list-title" className="overflow-hidden rounded-xl border bg-card">
          <div className="flex min-h-[49px] flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
            <h2 id="dispute-list-title" className="text-[15px] font-semibold text-foreground">
              All disputes
            </h2>
            {state === "ready" && dueCount > 0 && (
              <span className="text-sm font-medium text-primary">
                {dueCount === 1 ? "1 needs your response" : `${dueCount} need your response`}
              </span>
            )}
          </div>

          {state === "loading" ? (
            <ul aria-hidden className="divide-y">
              {["w-2/5", "w-1/3"].map((w) => (
                <li key={w} className="space-y-2 px-4 py-4 sm:px-5">
                  <div className={cn("h-3.5 rounded bg-muted motion-safe:animate-pulse", w)} />
                  <div className="h-3 w-1/4 rounded bg-muted motion-safe:animate-pulse" />
                </li>
              ))}
            </ul>
          ) : state === "error" ? (
            <div role="alert" className="flex flex-col items-center px-4 py-12 text-center">
              <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
              </span>
              <p className="font-medium text-foreground">Couldn&apos;t load your disputes</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Check your connection, then try again.</p>
              <Button variant="outline" className="mt-5 h-11 bg-transparent sm:h-9" onClick={load}>
                Try again
              </Button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-dashed text-muted-foreground">
                <Scale className="h-5 w-5" />
              </span>
              <p className="font-medium text-foreground">No disputes</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                If you or a client report a problem with a job, it shows here. You can report one from a done or cancelled
                job.
              </p>
              <Button variant="outline" className="mt-5 h-11 bg-transparent sm:h-9" asChild>
                <Link href="/dashboard/artisan/jobs">Go to My Jobs</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {sorted.map((d) => (
                <DisputeItem key={d.id} d={d} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardLayout>
  )
}

function DisputeItem({ d }: { d: DisputeRow }) {
  const due = Boolean(d.responseDue ?? d.canRespond)
  const status = getDisputeStatusConfig(d.status)
  const StatusIcon = status.icon
  const category = getDisputeCategoryLabel(d.category) ?? "Other"
  const filedBy = d.viewerRole === "RAISER" ? "Filed by you" : `Filed by ${personName(d.raisedBy, "a former client")}`
  const href = `/dashboard/artisan/disputes/${d.id}`

  return (
    <li className={cn("group relative px-4 py-4 transition-colors duration-150 hover:bg-muted/40 motion-reduce:transition-none sm:px-5", due && "bg-primary/[0.04]")}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            due ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {due ? <MessageSquare className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <h3 className="font-medium text-foreground">
              <Link href={href} className={cn("rounded-sm after:absolute after:inset-0 after:content-[''] group-hover:text-primary", focusRing)}>
                {category}
              </Link>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {due && (
                <Badge className="bg-primary text-xs text-primary-foreground">Response needed</Badge>
              )}
              <Badge variant="outline" className={cn("text-xs", status.className)}>
                <StatusIcon aria-hidden className="mr-1 h-3 w-3" />
                {status.label}
              </Badge>
            </div>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filedBy} on {formatDay(d.createdAt)}
            {d.booking?.scheduledDate ? `. Booking for ${formatDay(d.booking.scheduledDate)}` : ""}
          </p>
          {d.jobId != null && (
            <div className="relative z-10 mt-2">
              <Link
                href={`/dashboard/artisan/jobs/${d.jobId}`}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline sm:min-h-0",
                  focusRing,
                )}
              >
                <Briefcase aria-hidden className="h-3.5 w-3.5" />
                View job
              </Link>
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
