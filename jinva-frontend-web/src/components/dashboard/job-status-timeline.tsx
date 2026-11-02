"use client"

import { useAuth } from "@/contexts/auth-context"
import { formatDayTime, jobStatusName } from "@/lib/artisan-jobs"

export interface JobStatusHistoryEntry {
  id: number
  fromStatus?: string | null
  toStatus: string
  changedBy: string
  reason?: string | null
  createdAt: string
}

interface Person {
  id: number | string
  firstname?: string | null
  lastname?: string | null
}

interface JobStatusTimelineProps {
  readonly history: JobStatusHistoryEntry[] | undefined
  /** The job's accepted artisan, so their changes read as their name. */
  readonly artisan?: Person | null
  /** When the job was posted; shown when there is no recorded history. */
  readonly createdAt?: string | null
  /** When the artisan asked the client to confirm the work is done. */
  readonly completionRequestedAt?: string | null
}

/** Event names in the client's words (the artisan job page uses the same set). */
const EVENT_NAMES: Record<string, string> = {
  OPEN: "Posted",
  PENDING: "Artisan chosen",
  IN_PROGRESS: "Work started",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
}

/** System reasons are written for logs; say them in the client's words. */
function readableReason(reason?: string | null): string | null {
  if (!reason) return null
  if (/auto-?completed/i.test(reason)) return "Marked done automatically because the work wasn't confirmed in time."
  if (/expired?/i.test(reason) && /deadline/i.test(reason)) return "The deadline passed."
  return reason.replace(/\bcustomer\b/gi, "client")
}

function nameOf(p?: Person | null): string {
  return `${p?.firstname ?? ""} ${p?.lastname ?? ""}`.trim()
}

/**
 * J3: the real, chronological job status history from `GET /jobs/:id`, read
 * from the client's side: readable event names, who made each change ("You",
 * the artisan by name, or JinVa) and en-GB times without seconds. Jobs created
 * before status tracking have an empty `statusHistory`; that's expected, so it
 * says so instead of looking broken.
 */
export function JobStatusTimeline({ history, artisan, createdAt, completionRequestedAt }: JobStatusTimelineProps) {
  const { user } = useAuth()
  const userId = user?.id
  const artisanName = nameOf(artisan)

  const actor = (changedBy: string): string | null => {
    if (changedBy === "SYSTEM") return "JinVa, automatically"
    if (userId != null && changedBy === String(userId)) return "You"
    if (artisan?.id != null && changedBy === String(artisan.id)) return artisanName || "The artisan"
    // Without the artisan we can't tell them apart from our team, so say nothing rather than guess.
    return artisan ? "JinVa team" : null
  }

  const events = (history ?? []).map((e) => ({
    key: `h${e.id}`,
    title: EVENT_NAMES[e.toStatus] ?? jobStatusName(e.toStatus),
    detail: e.fromStatus ? `${jobStatusName(e.fromStatus)} to ${jobStatusName(e.toStatus)}` : null,
    reason: readableReason(e.reason),
    by: actor(e.changedBy),
    at: e.createdAt,
  }))
  if (completionRequestedAt) {
    events.push({
      key: "completion",
      title: "Completion requested",
      detail: null,
      reason: null,
      by: artisanName || "The artisan",
      at: completionRequestedAt,
    })
  }
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {createdAt ? `Posted ${formatDayTime(createdAt)}. ` : ""}
        Earlier changes to this job weren&apos;t recorded.
      </p>
    )
  }

  return (
    <ol className="space-y-0">
      {events.map((e, i) => (
        <li key={e.key} className="relative flex gap-3 pb-5 last:pb-0">
          {i < events.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-6px)] w-px bg-primary/30" />}
          <span aria-hidden className="relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full bg-primary ring-4 ring-card" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{e.title}</p>
            {e.reason && <p className="mt-0.5 break-words text-sm text-muted-foreground">{e.reason}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">
              <time dateTime={e.at}>{formatDayTime(e.at)}</time>
              {e.by ? `, by ${e.by}` : ""}
              {e.detail ? <span className="sr-only">. {e.detail}</span> : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
