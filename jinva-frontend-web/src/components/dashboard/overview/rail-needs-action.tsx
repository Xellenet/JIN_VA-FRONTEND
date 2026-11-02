"use client"

import Link from "next/link"
import { CheckCheck, ChevronRight, CircleCheck, CreditCard, MessageSquare, Users, type LucideIcon } from "lucide-react"
import type { ActionItems } from "@/lib/customer-api"
import { ACTION_LABELS, actionAriaLabel, actionHref, type ActionKind } from "@/lib/overview"
import { cn } from "@/lib/utils"
import { RailError, RailSection, RailSkeleton, railFocusRing, type RailLayout, type RailSectionState } from "./rail-section"

const ICONS: Record<ActionKind, LucideIcon> = {
  completionsToConfirm: CircleCheck,
  paymentsDue: CreditCard,
  applicationsToReview: Users,
  unreadMessages: MessageSquare,
}

const ORDER: ActionKind[] = ["completionsToConfirm", "paymentsDue", "applicationsToReview", "unreadMessages"]

interface Row {
  kind: ActionKind
  count: number
  jobTitle: string | null
  href: string
  single: boolean
}

/** Rows with a count above 0, in the fixed order (D7). */
export function actionRows(items: ActionItems): Row[] {
  return ORDER.flatMap((kind): Row[] => {
    if (kind === "unreadMessages") {
      const count = items.unreadMessages
      return count > 0 ? [{ kind, count, jobTitle: null, href: actionHref(kind), single: count === 1 }] : []
    }
    const item = items[kind]
    if (!item || item.count <= 0) return []
    const single = item.jobId !== null
    return [{ kind, count: item.count, jobTitle: single ? item.jobTitle : null, href: actionHref(kind, item), single }]
  })
}

/**
 * "Needs your action" (FR-2.4). Each row is one link (≥44px tall); one item
 * goes straight to it, several go to the filtered list. When nothing needs
 * doing the rail keeps the card with a calm "You're all caught up".
 */
export function RailNeedsAction({
  state,
  layout,
  onRetry,
}: {
  state: RailSectionState<ActionItems>
  layout: RailLayout
  onRetry: () => void
}) {
  return (
    <RailSection title="Needs your action" layout={layout} name="action">
      {state.kind === "loading" ? (
        <div className="mt-3 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-8 items-center gap-3">
              <RailSkeleton className="h-8 w-8 rounded-lg" />
              <RailSkeleton className="h-3.5 flex-1" />
              <RailSkeleton className="h-6 w-6 rounded-full" />
            </div>
          ))}
        </div>
      ) : state.kind === "error" ? (
        <RailError message="Couldn't load this" rateLimited={state.rateLimited} onRetry={onRetry} />
      ) : (
        <ActionList items={state.data} layout={layout} />
      )}
    </RailSection>
  )
}

function ActionList({ items, layout }: { items: ActionItems; layout: RailLayout }) {
  const rows = actionRows(items)
  if (rows.length === 0) {
    return <CaughtUp text="Nothing needs you right now. Requests from artisans will show here." />
  }
  return (
    <ActionRowList
      layout={layout}
      rows={rows.map((row) => ({
        key: row.kind,
        href: row.href,
        icon: ICONS[row.kind],
        label: ACTION_LABELS[row.kind],
        detail: row.jobTitle,
        count: row.count,
        ariaLabel: actionAriaLabel(row.kind, row.count, row.single),
      }))}
    />
  )
}

/** The calm "nothing to do" state, shared by both roles' rails. */
export function CaughtUp({ text }: { text: string }) {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-lg px-1 py-2">
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCheck className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

export interface ActionListRow {
  key: string
  href: string
  icon: LucideIcon
  label: string
  /** Second line (a job title, an amount). */
  detail: string | null
  /** 0 = no count badge. */
  count: number
  ariaLabel: string
}

/**
 * The "Needs your action" rows, for either role. Each row is one link at
 * least 44px tall, with the count in the attention tone and as text.
 */
export function ActionRowList({ rows, layout }: { rows: ActionListRow[]; layout: RailLayout }) {
  return (
    <ul className="-mx-2 mt-2">
      {rows.map((row) => {
        const Icon = row.icon
        return (
          <li key={row.key}>
            <Link
              href={row.href}
              aria-label={row.ariaLabel}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 motion-reduce:transition-none",
                layout === "rail" ? "hover:bg-card" : "hover:bg-muted/60",
                railFocusRing,
              )}
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground/80"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{row.label}</span>
                {row.detail && (
                  <span dir="auto" className="block truncate text-xs text-muted-foreground [unicode-bidi:isolate]">
                    {row.detail}
                  </span>
                )}
              </span>
              {/* A row that isn't a count of things (Get verified) has no badge. */}
              {row.count > 0 && (
                <span
                  aria-hidden
                  className="flex h-6 min-w-6 items-center justify-center rounded-full bg-attention px-1.5 text-xs font-semibold tabular-nums text-attention-foreground"
                >
                  {row.count > 99 ? "99+" : row.count}
                </span>
              )}
              <ChevronRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
