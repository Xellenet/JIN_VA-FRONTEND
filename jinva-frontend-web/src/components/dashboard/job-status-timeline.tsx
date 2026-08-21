"use client"

import { CheckCircle2, Cpu, FileText, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

export interface JobStatusHistoryEntry {
  id: number
  fromStatus?: string | null
  toStatus: string
  changedBy: string
  reason?: string | null
  createdAt: string
}

function actorLabel(changedBy: string): string {
  if (changedBy === "SYSTEM") return "System (automated)"
  return `User #${changedBy}`
}

/**
 * J3: renders the real, chronological job status-history array returned by
 * `GET /jobs/:id`. Both parties viewing the same job see this identical
 * component fed the identical array — no per-role fabrication.
 *
 * Per api-contract.md §12, jobs created before this migration simply have an
 * empty `statusHistory` array — that's expected, not an error, so an empty
 * array renders an explicit "not available" note rather than looking broken.
 */
export function JobStatusTimeline({ history }: { readonly history: JobStatusHistoryEntry[] | undefined }) {
  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <FileText className="h-6 w-6 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Detailed history is not available for this job (it predates status tracking).
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {history.map((entry, idx) => {
        const isSystem = entry.changedBy === "SYSTEM"
        return (
          <div key={entry.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  "bg-primary text-primary-foreground",
                )}
              >
                {isSystem ? <Cpu className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </div>
              {idx < history.length - 1 && <div className="h-full w-0.5 min-h-6 bg-primary/30" />}
            </div>
            <div className="pb-6">
              <p className="text-sm font-medium text-foreground">
                {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : `Created — ${entry.toStatus}`}
              </p>
              {entry.reason && (
                <p className="mt-0.5 text-sm text-muted-foreground">{entry.reason}</p>
              )}
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <UserRound className="h-3 w-3" />
                {actorLabel(entry.changedBy)} · {new Date(entry.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
