"use client"

/**
 * The four chart cards (FR-4.4 to FR-4.9). Only "Spending over time" uses
 * Recharts, loaded on demand; the other three are HTML bars whose text is the
 * data (design note D3), so they cannot inject CSS (SEC-22).
 */
import dynamic from "next/dynamic"
import Link from "next/link"
import { useState, type CSSProperties } from "react"
import { ChevronDown } from "lucide-react"
import type { SpendingAnalytics } from "@/lib/customer-api"
import {
  METHOD_COLOURS,
  artisanHref,
  artisanSummary,
  bucketName,
  categorySummary,
  channelAltText,
  channelSummary,
  formatDate,
  formatMoney,
  methodKey,
  methodLabel,
  overTimeSummary,
  percent,
  plural,
} from "@/lib/spending"
import { cn } from "@/lib/utils"
import { ArtisanAvatar, ChartCard, DataTable, FOCUS_RING, METHOD_ICONS, Shimmer, UserText, ViewToggle } from "./shared"

const OverTimeChart = dynamic(() => import("./spending-over-time-chart"), {
  ssr: false,
  loading: () => <ColumnsSkeleton />,
})

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties

/** View swap: a short cross-fade (the shared `data-swap`, off under reduced motion). */
function Swap({ view, children }: Readonly<{ view: string; children: React.ReactNode }>) {
  return (
    <div key={view} data-swap>
      {children}
    </div>
  )
}

// ── Spending over time ──────────────────────────────────────────────────────

export function OverTimeCard({
  data,
  reducedMotion,
  className,
}: Readonly<{ data: SpendingAnalytics; reducedMotion: boolean; className?: string }>) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const unit = data.bucket === "month" ? "Month" : data.bucket === "week" ? "Week" : "Day"
  return (
    <ChartCard
      id="spend-over-time"
      title="Spending over time"
      summary={overTimeSummary(data.series, data.bucket)}
      toggle={<ViewToggle view={view} onChange={setView} controls="spend-over-time" />}
      className={className}
    >
      <Swap view={view}>
        {view === "chart" ? (
          <OverTimeChart key={`${data.range}-${data.series.length}`} series={data.series} bucket={data.bucket} reducedMotion={reducedMotion} />
        ) : (
          <DataTable
            caption={`Net spent per ${unit.toLowerCase()}`}
            columns={[{ label: unit }, { label: "Net spent", numeric: true }, { label: "Payments", numeric: true }]}
            rows={data.series.map((p) => ({
              key: p.bucketStart,
              cells: [
                bucketName(p.bucketStart, data.bucket, true).replace(/^The week of /, ""),
                formatMoney(p.netSpent),
                p.count.toLocaleString("en-GB"),
              ],
              muted: Number(p.netSpent) === 0,
            }))}
          />
        )}
      </Swap>
    </ChartCard>
  )
}

function ColumnsSkeleton() {
  const heights = [30, 52, 22, 2, 48, 60, 38, 78, 56, 100, 72, 88]
  return (
    <div aria-hidden="true" className="flex h-[200px] items-end gap-1.5 pl-14 sm:h-[248px] sm:gap-2">
      {heights.map((h, i) => (
        <Shimmer key={i} className="flex-1 rounded-b-none" style={{ height: `${Math.max(2, h * 0.9)}%` }} />
      ))}
    </div>
  )
}

// ── What you spent on ───────────────────────────────────────────────────────

export function CategoryCard({ data, className }: Readonly<{ data: SpendingAnalytics; className?: string }>) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const rows = data.byCategory
  const top = rows.reduce((m, r) => Math.max(m, Number(r.netSpent) || 0), 0) || 1
  return (
    <ChartCard
      id="spend-by-service"
      title="What you spent on"
      summary={categorySummary(rows)}
      toggle={<ViewToggle view={view} onChange={setView} controls="spend-by-service" />}
      className={className}
    >
      <Swap view={view}>
        {view === "chart" ? (
          <ol className="space-y-4" key={data.range}>
            {rows.map((r, i) => {
              const isOther = r.serviceId === null && r.serviceName === "Other"
              return (
                <li key={`${r.serviceId ?? "other"}-${i}`}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <UserText className="font-medium text-foreground">{r.serviceName}</UserText>{" "}
                      <span className="whitespace-nowrap text-muted-foreground">{plural(r.count, "payment")}</span>
                    </span>
                    <span className="tnum shrink-0 whitespace-nowrap tabular-nums">
                      <span className="font-medium text-foreground">{formatMoney(r.netSpent)}</span>
                      <span className="ml-2 inline-block w-9 text-right text-muted-foreground">{percent(r.share)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted">
                    <div
                      data-draw
                      style={{ ...delay(200 + i * 50), width: `${Math.max(1, ((Number(r.netSpent) || 0) / top) * 100)}%` }}
                      className={cn("h-2 rounded-full", isOther ? "bg-muted-foreground/45" : "bg-[var(--chart-1)]")}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <DataTable
            caption="Net spent per service"
            columns={[{ label: "Service" }, { label: "Payments", numeric: true }, { label: "Net spent", numeric: true }, { label: "Share", numeric: true }]}
            rows={rows.map((r, i) => ({
              key: `${r.serviceId ?? "other"}-${i}`,
              cells: [<UserText key="n">{r.serviceName}</UserText>, r.count.toLocaleString("en-GB"), formatMoney(r.netSpent), `${percent(r.share)}%`],
            }))}
          />
        )}
      </Swap>
    </ChartCard>
  )
}

// ── Who you paid ────────────────────────────────────────────────────────────

const ARTISANS_SHOWN = 5

function ArtisanName({ id, name }: Readonly<{ id: number | null; name: string }>) {
  const href = id === null ? null : artisanHref(id)
  if (!href) return <UserText className="font-medium text-muted-foreground">{name}</UserText>
  return (
    <Link href={href} className={cn(FOCUS_RING, "rounded-sm font-medium text-foreground hover:underline")}>
      <UserText>{name}</UserText>
    </Link>
  )
}

export function ArtisanCard({ data, className }: Readonly<{ data: SpendingAnalytics; className?: string }>) {
  const [expanded, setExpanded] = useState(false)
  const all = data.byArtisan
  const rows = expanded ? all : all.slice(0, ARTISANS_SHOWN)
  const top = all.reduce((m, r) => Math.max(m, Number(r.netSpent) || 0), 0) || 1
  const name = (r: (typeof all)[number]) => (r.artisanProfileId === null ? "Former artisan" : r.displayName)
  const bar = (r: (typeof all)[number], i: number) => (
    <div className="h-1.5 flex-1 rounded-full bg-muted">
      <div
        data-draw
        style={{ ...delay(300 + Math.min(i, 8) * 50), width: `${Math.max(1, ((Number(r.netSpent) || 0) / top) * 100)}%` }}
        className="h-1.5 rounded-full bg-[var(--chart-1)]"
      />
    </div>
  )

  return (
    <ChartCard
      id="spend-by-artisan"
      title="Who you paid"
      summary={artisanSummary(all.map((r) => ({ ...r, displayName: name(r) })))}
      className={className}
      footer={
        all.length > ARTISANS_SHOWN ? (
          <div className="border-t border-border px-4 py-2 sm:px-6 sm:py-3">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls="spend-by-artisan"
              onClick={() => setExpanded((v) => !v)}
              className={cn(FOCUS_RING, "inline-flex h-11 items-center gap-1 rounded-md text-sm font-medium text-primary sm:h-9")}
            >
              {expanded ? "Show fewer artisans" : `Show all ${all.length} artisans`}
              <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} />
            </button>
          </div>
        ) : null
      }
    >
      {/* Desktop and tablet: a table with a bar beside each amount. */}
      <table className="hidden w-full text-sm sm:table" key={`t-${data.range}`}>
        <caption className="sr-only">{expanded ? "Artisans by net spent" : `Top ${rows.length} artisans by net spent`}</caption>
        <thead>
          <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
            <th scope="col" className="pb-2 font-medium">Artisan</th>
            <th scope="col" className="pb-2 pl-4 text-right font-medium">Jobs</th>
            <th scope="col" className="whitespace-nowrap pb-2 pl-6 font-medium">Last paid</th>
            <th scope="col" className="pb-2 pl-6 text-right font-medium">Net spent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.artisanProfileId ?? "former"}-${i}`} className="border-b border-border/70 last:border-0">
              <td className="py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ArtisanAvatar name={name(r)} avatar={r.artisanProfileId === null ? null : r.avatar} />
                  <ArtisanName id={r.artisanProfileId} name={name(r)} />
                </div>
              </td>
              <td className="tnum py-3 pl-4 text-right tabular-nums text-muted-foreground">{r.count.toLocaleString("en-GB")}</td>
              <td className="whitespace-nowrap py-3 pl-6 text-muted-foreground">{formatDate(r.lastPaidAt)}</td>
              <td className="w-[38%] py-3 pl-6">
                <div className="flex items-center gap-3">
                  <span className="hidden flex-1 md:flex">{bar(r, i)}</span>
                  <span className="tnum ml-auto whitespace-nowrap text-right font-medium tabular-nums text-foreground">{formatMoney(r.netSpent)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phone: a list; the details are written out under the name. */}
      <ul className="divide-y divide-border/70 sm:hidden" key={`l-${data.range}`}>
        {rows.map((r, i) => (
          <li key={`${r.artisanProfileId ?? "former"}-${i}`} className="flex items-start gap-3 py-3 first:pt-0">
            <ArtisanAvatar name={name(r)} avatar={r.artisanProfileId === null ? null : r.avatar} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <ArtisanName id={r.artisanProfileId} name={name(r)} />
                <span className="tnum shrink-0 whitespace-nowrap font-medium tabular-nums text-foreground">{formatMoney(r.netSpent)}</span>
              </div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {plural(r.count, "job")}, last paid {formatDate(r.lastPaidAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

// ── How you paid ────────────────────────────────────────────────────────────

export function ChannelCard({ data, className }: Readonly<{ data: SpendingAnalytics; className?: string }>) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const rows = data.byChannel
  return (
    <ChartCard
      id="spend-by-method"
      title="How you paid"
      summary={channelSummary(rows)}
      toggle={<ViewToggle view={view} onChange={setView} controls="spend-by-method" />}
      className={className}
    >
      <Swap view={view}>
        {view === "chart" ? (
          <div key={data.range}>
            <div role="img" aria-label={channelAltText(rows)} className="flex h-3 gap-0.5 overflow-hidden rounded-full">
              {rows.map((r, i) => (
                <span
                  key={r.channel}
                  data-draw
                  style={{ ...delay(300 + i * 60), width: `${Math.max(0.5, r.share * 100)}%`, background: METHOD_COLOURS[methodKey(r.channel)] }}
                  className="h-3 shrink-0"
                />
              ))}
            </div>
            <ul className="mt-5 space-y-3">
              {rows.map((r) => {
                const key = methodKey(r.channel)
                const Icon = METHOD_ICONS[key]
                return (
                  <li key={r.channel} className="flex items-start gap-3 text-sm">
                    <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-[3px]" style={{ background: METHOD_COLOURS[key] }} />
                    <span className="flex min-w-0 flex-1 items-start gap-2">
                      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{methodLabel(r.channel)}</span>
                        <span className="block text-xs text-muted-foreground">{plural(r.count, "payment")}</span>
                      </span>
                    </span>
                    <span className="tnum whitespace-nowrap font-medium tabular-nums text-foreground">{formatMoney(r.netSpent)}</span>
                    <span className="tnum w-9 text-right tabular-nums text-muted-foreground">{percent(r.share)}%</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <DataTable
            caption="Net spent per payment method"
            columns={[{ label: "Method" }, { label: "Payments", numeric: true }, { label: "Net spent", numeric: true }, { label: "Share", numeric: true }]}
            rows={rows.map((r) => ({
              key: r.channel,
              cells: [methodLabel(r.channel), r.count.toLocaleString("en-GB"), formatMoney(r.netSpent), `${percent(r.share)}%`],
            }))}
          />
        )}
      </Swap>
    </ChartCard>
  )
}

// ── Skeletons (FR-4.15) ─────────────────────────────────────────────────────

export function ChartsSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 lg:col-span-2">
        <Shimmer className="h-4 w-40" />
        <Shimmer className="mt-2 h-3.5 w-64 max-w-full" />
        <div className="mt-6">
          <ColumnsSkeleton />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <Shimmer className="h-4 w-36" />
        <Shimmer className="mt-2 h-3.5 w-48 max-w-full" />
        <div className="mt-6 space-y-5">
          {[100, 80, 40, 30, 18, 10, 14].map((w, i) => (
            <div key={i}>
              <Shimmer className="h-3.5 w-full" />
              <div className="mt-2 h-2 rounded-full bg-muted/60">
                <Shimmer className="h-2 rounded-full" style={{ width: `${w}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
