"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetchWithMeta } from "@/lib/api"

/**
 * The admin area's one "who did what to this thing" dialog —
 * design-spec.md §10.6.
 *
 * The Reviews round built exactly this as an inline Removal History dialog on
 * `admin/reviews/page.tsx`, and it is the right pattern for four screens, not
 * one: Disputes (started review / resolved / verdict), Verifications
 * (approve / reject + reason), Transactions (refunds and fraud flags) and
 * User Detail (ban / suspend / verify). Same `rounded-lg border border-border
 * p-3` entries, same action `Badge` + actor + date + reason, same newest-first
 * ordering, same "Load more" paging.
 *
 * The generic append-only `admin_actions` log this reads from is backend work
 * for this round (design-spec.md §11 item J) — today only
 * `review_moderation_actions` exists, and ban/verify/portfolio/dispute/refund
 * actions write no audit row at all. This component is deliberately built and
 * shipped now so both of the parallel frontend passes can mount it against a
 * settled prop shape, and it fails soft: an endpoint that isn't there yet
 * renders the "couldn't load" state with a Retry rather than breaking the
 * screen that hosts it.
 */

/** Which entity's history to show. Maps 1:1 onto the log's `scope` column. */
export type AdminActionScope = "dispute" | "verification" | "payment" | "user" | "portfolio"

export interface AdminActionLogEntry {
  id: number
  /** e.g. "APPROVE", "REJECT", "BAN", "RESOLVE" — rendered in the badge. */
  action: string
  /** Snapshot of the acting admin's name (no FK, so it survives deletion). */
  actorName?: string
  actorRole?: string
  /** Free-text reason / note the admin gave, when the action captured one. */
  reason?: string
  /**
   * Any extra one-line detail the log recorded for this action — e.g. the
   * dispute verdict, or a refunded amount already formatted by the caller's
   * `renderDetail`. Rendered verbatim when no `renderDetail` is supplied.
   */
  detail?: string
  createdAt: string
}

export interface AdminActionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: AdminActionScope
  entityId: number
  /** Overrides the default "Action history" title. */
  title?: string
  /** Extra context line under the title (e.g. "Dispute #1042"). */
  subtitle?: string
  /**
   * Per-action badge tones. Falls back to the neutral outline badge for any
   * action the caller doesn't map, so a new backend action type can never
   * crash this dialog.
   */
  actionTones?: Record<string, string>
  /** Lets a caller render its own detail line (e.g. an amount via formatCurrency). */
  renderDetail?: (entry: AdminActionLogEntry) => React.ReactNode
}

const PAGE_SIZE = 50

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function extractTotalPages(meta: Record<string, unknown> | undefined): number {
  const direct = meta?.totalPages as number | undefined
  const nested = (meta?.pagination as { totalPages?: number } | undefined)?.totalPages
  const value = direct ?? nested ?? 1
  return value > 0 ? value : 1
}

export function AdminActionHistoryDialog({
  open,
  onOpenChange,
  scope,
  entityId,
  title = "Action history",
  subtitle,
  actionTones,
  renderDetail,
}: Readonly<AdminActionHistoryDialogProps>) {
  const [entries, setEntries] = useState<AdminActionLogEntry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(
    async (p: number, append: boolean) => {
      setIsLoading(true)
      if (!append) setLoadError(false)
      try {
        const { data, meta } = await apiFetchWithMeta<AdminActionLogEntry[]>(
          `/admin/actions?scope=${scope}&entityId=${entityId}&page=${p}&limit=${PAGE_SIZE}`,
        )
        const rows = Array.isArray(data) ? data : []
        setEntries((prev) => (append ? [...prev, ...rows] : rows))
        setPage(p)
        setTotalPages(extractTotalPages(meta))
      } catch {
        // Never a toast: this is a secondary panel opened on purpose, and a
        // toast on top of an open dialog reads as a failure of the screen
        // behind it. Show it inline with a Retry instead.
        setLoadError(true)
        if (!append) setEntries([])
      } finally {
        setIsLoading(false)
      }
    },
    [scope, entityId],
  )

  useEffect(() => {
    if (open) load(1, false)
  }, [open, load])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {subtitle ? `${subtitle} — newest first.` : "Every recorded admin action on this record, newest first."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {isLoading && entries.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : loadError ? (
            <div className="py-8 text-center">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive/60" />
              <p className="text-sm text-muted-foreground">Couldn&apos;t load the action history.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 bg-transparent"
                onClick={() => load(1, false)}
              >
                Retry
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No admin actions recorded on this record yet.
            </p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={cn("text-xs", actionTones?.[entry.action])}>
                    {entry.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{fmtDate(entry.createdAt)}</span>
                </div>
                {renderDetail
                  ? renderDetail(entry)
                  : entry.detail && <p className="mt-1.5 text-xs text-foreground">{entry.detail}</p>}
                {entry.reason && (
                  <p className="mt-1 text-xs text-foreground">Reason: {entry.reason}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  By {entry.actorName ?? "Unknown admin"}
                  {entry.actorRole ? ` (${entry.actorRole})` : ""}
                </p>
              </div>
            ))
          )}
        </div>

        {!loadError && totalPages > page && (
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent"
            disabled={isLoading}
            onClick={() => load(page + 1, true)}
          >
            {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Load more
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
