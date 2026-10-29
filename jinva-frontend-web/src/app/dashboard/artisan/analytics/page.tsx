"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import {
  DollarSign,
  Briefcase,
  Users,
  Star,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { CHART_TOOLTIP_STYLE, CHART_AXIS_TICK, CHART_GRID_STROKE } from "@/lib/charts"

const RANGES = ["7 days", "30 days", "90 days", "All time"] as const
type Range = (typeof RANGES)[number]

const earningsData: Record<Range, { month: string; earnings: number }[]> = {
  "7 days": [
    { month: "Mon", earnings: 120 },
    { month: "Tue", earnings: 200 },
    { month: "Wed", earnings: 150 },
    { month: "Thu", earnings: 320 },
    { month: "Fri", earnings: 280 },
    { month: "Sat", earnings: 90 },
    { month: "Sun", earnings: 0 },
  ],
  "30 days": [
    { month: "W1", earnings: 850 },
    { month: "W2", earnings: 1200 },
    { month: "W3", earnings: 960 },
    { month: "W4", earnings: 1400 },
  ],
  "90 days": [
    { month: "Jan", earnings: 2800 },
    { month: "Feb", earnings: 3400 },
    { month: "Mar", earnings: 3100 },
  ],
  "All time": [
    { month: "Jan", earnings: 2800 },
    { month: "Feb", earnings: 3400 },
    { month: "Mar", earnings: 3100 },
    { month: "Apr", earnings: 2600 },
    { month: "May", earnings: 4200 },
    { month: "Jun", earnings: 3800 },
    { month: "Jul", earnings: 4600 },
    { month: "Aug", earnings: 5100 },
    { month: "Sep", earnings: 4400 },
    { month: "Oct", earnings: 4900 },
    { month: "Nov", earnings: 5600 },
    { month: "Dec", earnings: 5200 },
  ],
}

const ratingTrend = [
  { month: "Jan", rating: 4.2 },
  { month: "Feb", rating: 4.4 },
  { month: "Mar", rating: 4.3 },
  { month: "Apr", rating: 4.6 },
  { month: "May", rating: 4.7 },
  { month: "Jun", rating: 4.8 },
]

const topServices = [
  { name: "Plumbing Repair",      jobs: 18, pct: 90 },
  { name: "Pipe Installation",    jobs: 12, pct: 60 },
  { name: "Drain Cleaning",       jobs: 9,  pct: 45 },
  { name: "Water Heater Service", jobs: 6,  pct: 30 },
  { name: "Emergency Leak Fix",   jobs: 4,  pct: 20 },
]

export default function ArtisanAnalyticsPage() {
  const [range, setRange] = useState<Range>("30 days")

  const totalEarnings = earningsData[range].reduce((s, d) => s + d.earnings, 0)

  const stats = [
    {
      label: "Total Earnings",
      value: formatCurrency(totalEarnings),
      sub: range,
      icon: DollarSign,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      trend: +12,
    },
    {
      label: "Jobs Completed",
      value: "49",
      sub: "This period",
      icon: Briefcase,
      iconBg: "bg-muted",
      iconColor: "text-foreground",
      trend: +8,
    },
    {
      label: "Repeat Clients",
      value: "34%",
      sub: "Booked 2+ times",
      icon: Users,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      trend: +5,
    },
    {
      label: "Average Rating",
      value: "4.8",
      sub: "Based on 49 reviews",
      icon: Star,
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
      trend: +2,
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Track your performance, earnings, and client engagement
            </p>
          </div>
          {/* Range selector */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  range === r
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, sub, icon: Icon, iconBg, iconColor, trend }) => (
            <Card key={label} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={cn("rounded-full p-2.5", iconBg)}>
                    <Icon className={cn("h-4 w-4", iconColor)} />
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-xs font-medium",
                      trend >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {trend >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(trend)}%
                  </span>
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

        {/* Charts row */}
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          {/* Earnings chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Earnings</CardTitle>
                <span className="text-xs text-muted-foreground">{range}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={earningsData[range]} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-xs" tick={CHART_AXIS_TICK} />
                  <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} tickFormatter={(v) => `₵${v}`} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [formatCurrency(Number(v)), "Earnings"]} />
                  <Bar dataKey="earnings" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Rating trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Rating Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={ratingTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} />
                  <YAxis domain={[3.5, 5]} axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [v, "Rating"]} />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ fill: "var(--primary)", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top services */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Top Services by Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topServices.map(({ name, jobs, pct }) => (
              <div key={name} className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-foreground">{name}</p>
                    <span className="ml-4 shrink-0 text-sm text-muted-foreground">{jobs} jobs</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
