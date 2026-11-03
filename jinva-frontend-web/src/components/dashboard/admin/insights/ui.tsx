"use client"

/**
 * Building blocks for the admin insights tabs. Charts are HTML bars whose
 * text is the data (the Spending page's pattern), each with a Table view, so
 * no value is reachable only by hovering and nothing depends on colour alone.
 */
import { useState, type ReactNode } from "react"
import { AlertTriangle, Info } from "lucide-react"
import { ChartCard, DataTable, LoadError, Shimmer, ViewToggle } from "@/components/spending/shared"
import { NOT_ENOUGH_DATA, barWidth, formatDuration, formatCount, type DurationStat } from "@/lib/admin-insights"
import { cn } from "@/lib/utils"

/** "What it means / how it's counted" under a figure or a chart. */
export function Help({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <p className={cn("flex gap-1.5 text-xs leading-relaxed text-muted-foreground", className)}>
      <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** A group of cards under a visible h2. */
export function Section({
  id,
  title,
  intro,
  children,
}: Readonly<{ id: string; title: string; intro?: string; children: ReactNode }>) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-4">
      <div>
        <h2 id={`${id}-heading`} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {intro ? <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{intro}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** A single headline figure: value, label, and how it's counted. */
export function StatTile({
  label,
  value,
  sub,
  help,
  muted,
}: Readonly<{ label: string; value: string; sub?: string; help?: ReactNode; muted?: boolean }>) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold text-foreground break-words", muted && "text-base font-medium text-muted-foreground")}>
        {value}
      </p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      {help ? <Help className="mt-1">{help}</Help> : null}
    </div>
  )
}

export function TileGrid({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>
}

/** A median/p90 duration tile; withheld below the minimum sample. */
export function DurationTile({
  label,
  stat,
  unit,
  help,
  minSample,
}: Readonly<{ label: string; stat: DurationStat; unit: [string, string]; help: ReactNode; minSample: number }>) {
  const enough = stat.medianHours != null
  const sample = `${formatCount(stat.n)} ${stat.n === 1 ? unit[0] : unit[1]}`
  return (
    <StatTile
      label={label}
      value={enough ? formatDuration(stat.medianHours) : NOT_ENOUGH_DATA}
      muted={!enough}
      sub={
        enough
          ? `Median · slowest 10% take over ${formatDuration(stat.p90Hours)} · ${sample}`
          : `${sample} so far, needs at least ${minSample}`
      }
      help={help}
    />
  )
}

export interface BarRow {
  key: string
  label: string
  value: number
  /** Shown next to the bar and in the table. */
  display: string
  /** Extra table-only columns. */
  extra?: ReactNode[]
  /** A non-colour status marker (icon + words). */
  badge?: ReactNode
}

/** Horizontal bars (one series, one colour) with a Table view. */
export function BarCard({
  id,
  title,
  summary,
  rows,
  valueLabel,
  extraColumns = [],
  firstColumn = "Item",
  help,
  empty = NOT_ENOUGH_DATA,
}: Readonly<{
  id: string
  title: string
  summary: string
  rows: BarRow[]
  valueLabel: string
  extraColumns?: { label: string; numeric?: boolean }[]
  firstColumn?: string
  help?: ReactNode
  empty?: string
}>) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)
  return (
    <ChartCard
      id={id}
      title={title}
      summary={summary}
      toggle={rows.length ? <ViewToggle view={view} onChange={setView} controls={id} /> : undefined}
      footer={help ? <div className="border-t border-border px-4 py-3 sm:px-6">{<Help>{help}</Help>}</div> : undefined}
    >
      {rows.length === 0 ? (
        // The summary already says so when it is the empty message; don't repeat it.
        summary === empty ? null : <Empty>{empty}</Empty>
      ) : view === "chart" ? (
        <ol className="space-y-3.5">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span className="flex min-w-0 flex-wrap items-center gap-2 text-foreground">
                  <span dir="auto" className="break-words [unicode-bidi:isolate]">
                    {r.label}
                  </span>
                  {r.badge}
                </span>
                <span className="tnum shrink-0 tabular-nums text-muted-foreground">{r.display}</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${barWidth(r.value, max)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <DataTable
            caption={title}
            columns={[{ label: firstColumn }, { label: valueLabel, numeric: true }, ...extraColumns]}
            rows={rows.map((r) => ({
              key: r.key,
              cells: [
                <span key="l" className="flex flex-wrap items-center gap-2">
                  <span dir="auto" className="break-words [unicode-bidi:isolate]">
                    {r.label}
                  </span>
                  {r.badge}
                </span>,
                r.display,
                ...(r.extra ?? []),
              ],
              muted: r.value === 0,
            }))}
          />
        </div>
      )}
    </ChartCard>
  )
}

/** "Not enough data yet", in the card's body. */
export function Empty({ children = NOT_ENOUGH_DATA }: Readonly<{ children?: ReactNode }>) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

/** A warning shown with an icon and words, never by colour alone. */
export function WarnBadge({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">
      <AlertTriangle aria-hidden="true" className="h-3 w-3 shrink-0" />
      {children}
    </span>
  )
}

/** A section the server could not calculate: unavailable, never zero. */
export function SectionUnavailable({
  name,
  onRetry,
  retryIn,
  attempt,
}: Readonly<{ name: string; onRetry: () => void; retryIn: number; attempt: number }>) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <LoadError
        title={`${name} couldn't be calculated`}
        body="The other sections are fine. This one will be recalculated shortly; try again in a moment."
        onRetry={onRetry}
        retryIn={retryIn}
        attempt={attempt}
      />
    </div>
  )
}

/** Loading skeleton for a tab: final sizes, no layout jump. */
export function TabSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Shimmer className="h-6 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-28" />
        ))}
      </div>
      <Shimmer className="h-64" />
    </div>
  )
}
