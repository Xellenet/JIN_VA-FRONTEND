"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts"
import { Users, Briefcase, DollarSign, CheckCircle2, TrendingUp, TrendingDown, Loader2, Scale } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { CHART_TOOLTIP_STYLE, CHART_AXIS_TICK, CHART_GRID_STROKE } from "@/lib/charts"
import { apiFetch } from "@/lib/api"
import {
  ANALYTICS_RANGES,
  fillSeries,
  percentChange,
  type AdminAnalytics,
  type AnalyticsRange,
} from "@/lib/admin-analytics"

function TrendBadge({ change }: { change: number | null }) {
  if (change == null) return null
  const up = change >= 0
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-medium", up ? "text-primary" : "text-destructive")}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(change)}%
    </span>
  )
}

function Unavailable({ height = 200 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
      This section couldn&apos;t be loaded right now.
    </div>
  )
}

/**
 * QA ADM-19: every figure here used to be fixed sample data (1,340 users,
 * GH₵ 13.8k, "HVAC 124") that never changed with the range, though the
 * backend's analytics rollup (`GET /admin/analytics`) already existed. The
 * page now reads it. Trends compare with the period just before the range;
 * sections the rollup couldn't compute show as unavailable, never as zero.
 */
export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("30d")
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadFailed(false)
    apiFetch<AdminAnalytics>(`/admin/analytics?range=${range}`)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setLoadFailed(true))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [range])

  const period = ANALYTICS_RANGES.find((r) => r.value === range)!.period
  const k = data?.kpis
  const p = data?.previous
  const kpis = k
    ? [
        {
          label: "Users",
          value: k.totalUsers.toLocaleString("en-GB"),
          sub: `${k.newClients} new clients in the ${period}`,
          icon: Users,
          iconBg: "bg-muted",
          iconColor: "text-foreground",
          change: percentChange(k.newUsers, p?.newUsers),
        },
        {
          label: "Artisans",
          value: k.totalArtisans.toLocaleString("en-GB"),
          sub: `${k.newArtisans} new in the ${period}`,
          icon: Briefcase,
          iconBg: "bg-primary/10",
          iconColor: "text-primary",
          change: percentChange(k.newArtisans, p?.newArtisans),
        },
        {
          label: "Platform Fees",
          value: formatCurrency(k.netRevenue),
          sub: `from ${formatCurrency(k.grossRevenue)} paid in the ${period}`,
          icon: DollarSign,
          iconBg: "bg-primary/10",
          iconColor: "text-primary",
          change: percentChange(k.netRevenue, p?.netRevenue),
        },
        {
          label: "Completion Rate",
          value: `${k.completionRate}%`,
          sub: `${k.completedJobs} of ${k.terminalJobs} finished jobs completed`,
          icon: CheckCircle2,
          iconBg: "bg-primary/20",
          iconColor: "text-primary",
          change: null,
        },
      ]
    : []

  const growth = data?.series.userGrowth
    ? fillSeries(data.series.userGrowth, data, { clients: 0, artisans: 0, total: 0 })
    : null
  const volume = data?.series.bookingVolume
    ? fillSeries(data.series.bookingVolume, data, { bookings: 0, completed: 0, cancelled: 0 })
    : null
  const revenue = data?.series.revenue ? fillSeries(data.series.revenue, data, { gross: 0, net: 0, refunded: 0 }) : null
  const maxShare = Math.max(1, ...(data?.topServiceCategories?.map((s) => s.jobs) ?? [0]))

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
            <p className="text-sm text-muted-foreground">
              {data
                ? `Updated ${new Date(data.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                : "User growth, bookings, revenue and service trends"}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
            {ANALYTICS_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                aria-pressed={range === r.value}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  range === r.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loadFailed ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Couldn&apos;t load analytics. Refresh to try again.
            </CardContent>
          </Card>
        ) : !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className={cn("space-y-5 transition-opacity", isLoading && "opacity-60")}>
            {k ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {kpis.map(({ label, value, sub, icon: Icon, iconBg, iconColor, change }) => (
                  <Card key={label} className="transition-shadow hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className={cn("rounded-full p-2.5", iconBg)}>
                          <Icon className={cn("h-4 w-4", iconColor)} />
                        </div>
                        <TrendBadge change={change} />
                      </div>
                      <div className="mt-3">
                        <p className="text-2xl font-bold text-foreground">{value}</p>
                        <p className="text-sm text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-4">
                  <Unavailable height={80} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">New Sign-ups</CardTitle>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                      Clients
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary/40" />
                      Artisans
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {growth ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={growth}>
                      <defs>
                        <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="artisansGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.08} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} minTickGap={12} />
                      <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} allowDecimals={false} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="clients" name="Clients" stroke="var(--primary)" strokeWidth={2} fill="url(#usersGrad)" dot={false} />
                      {/* Same token at reduced opacity; `var(--primary) / 0.4` is not valid inside var() (design-spec §0.4). */}
                      <Area type="monotone" dataKey="artisans" name="Artisans" stroke="var(--primary)" strokeOpacity={0.4} strokeWidth={1.5} fill="url(#artisansGrad)" dot={false} strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Unavailable height={240} />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Booking Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  {volume ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={volume}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} minTickGap={12} />
                        <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} allowDecimals={false} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="bookings" name="Bookings" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="completed" name="Completed" fill="var(--primary)" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Unavailable height={220} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Revenue (Platform Fees)</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenue ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={revenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} minTickGap={12} />
                        <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} width={56} tickFormatter={(v) => `₵${Number(v).toLocaleString("en-GB")}`} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [formatCurrency(Number(v)), "Platform fees"]} />
                        <Line type="monotone" dataKey="net" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Unavailable height={220} />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Top Service Categories</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!data.topServiceCategories ? (
                    <Unavailable height={120} />
                  ) : data.topServiceCategories.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No jobs in the {period}.</p>
                  ) : (
                    data.topServiceCategories.map((s) => (
                      <div key={s.serviceId}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{s.serviceName}</p>
                          <span className="ml-4 shrink-0 text-sm text-muted-foreground">
                            {s.jobs} job{s.jobs === 1 ? "" : "s"} · {s.share}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${Math.round((s.jobs / maxShare) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Scale className="h-4 w-4 text-primary" />
                    Disputes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {!data.disputes ? (
                    <Unavailable height={120} />
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Filed in the {period}</span>
                        <span className="font-medium">{data.disputes.filedCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Open now</span>
                        <span className="font-medium">{data.disputes.openCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resolved</span>
                        <span className="font-medium">{data.disputes.resolvedCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Average time to resolve</span>
                        <span className="font-medium">
                          {data.disputes.resolvedCount ? `${data.disputes.averageResolutionHours}h` : "—"}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "rounded-md px-3 py-2 text-xs",
                          data.disputes.breachesTarget || data.disputes.openPast48h > 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-success/10 text-success",
                        )}
                      >
                        {data.disputes.openPast48h > 0
                          ? `${data.disputes.openPast48h} open longer than the ${data.disputes.slaHours}h target`
                          : `Within the ${data.disputes.slaHours}h resolution target`}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
