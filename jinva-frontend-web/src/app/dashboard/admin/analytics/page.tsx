"use client"

import { useState } from "react"
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
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  Users,
  Briefcase,
  DollarSign,
  Star,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

const RANGES = ["7 days", "30 days", "90 days", "All time"] as const
type Range = (typeof RANGES)[number]

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,.1)",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
}

const userGrowth = [
  { month: "Jan", users: 120,  artisans: 35 },
  { month: "Feb", users: 185,  artisans: 52 },
  { month: "Mar", users: 240,  artisans: 68 },
  { month: "Apr", users: 310,  artisans: 80 },
  { month: "May", users: 420,  artisans: 97 },
  { month: "Jun", users: 510,  artisans: 115 },
  { month: "Jul", users: 620,  artisans: 134 },
  { month: "Aug", users: 740,  artisans: 158 },
  { month: "Sep", users: 860,  artisans: 174 },
  { month: "Oct", users: 1020, artisans: 196 },
  { month: "Nov", users: 1180, artisans: 218 },
  { month: "Dec", users: 1340, artisans: 242 },
]

const bookingVolume = [
  { month: "Jan", jobs: 42  },
  { month: "Feb", jobs: 61  },
  { month: "Mar", jobs: 88  },
  { month: "Apr", jobs: 110 },
  { month: "May", jobs: 145 },
  { month: "Jun", jobs: 172 },
  { month: "Jul", jobs: 198 },
  { month: "Aug", jobs: 224 },
  { month: "Sep", jobs: 260 },
  { month: "Oct", jobs: 295 },
  { month: "Nov", jobs: 328 },
  { month: "Dec", jobs: 362 },
]

const revenueData = [
  { month: "Jan", revenue: 1800  },
  { month: "Feb", revenue: 2600  },
  { month: "Mar", revenue: 3400  },
  { month: "Apr", revenue: 4100  },
  { month: "May", revenue: 5600  },
  { month: "Jun", revenue: 6200  },
  { month: "Jul", revenue: 7400  },
  { month: "Aug", revenue: 8100  },
  { month: "Sep", revenue: 9200  },
  { month: "Oct", revenue: 10500 },
  { month: "Nov", revenue: 12100 },
  { month: "Dec", revenue: 13800 },
]

const ratingDist = [
  { name: "5 Stars", value: 48 },
  { name: "4 Stars", value: 27 },
  { name: "3 Stars", value: 14 },
  { name: "2 Stars", value: 7  },
  { name: "1 Star",  value: 4  },
]

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--primary) / 0.45)",
  "hsl(var(--primary) / 0.25)",
  "hsl(var(--primary) / 0.12)",
]

const topCategories = [
  { name: "Plumbing",    jobs: 312, pct: 92 },
  { name: "Electrical",  jobs: 278, pct: 82 },
  { name: "Carpentry",   jobs: 214, pct: 63 },
  { name: "Painting",    jobs: 196, pct: 58 },
  { name: "Cleaning",    jobs: 168, pct: 50 },
  { name: "HVAC",        jobs: 124, pct: 37 },
]

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<Range>("All time")

  const kpis = [
    { label: "Total Users",    value: "1,340", sub: "registered clients",  icon: Users,      iconBg: "bg-muted",       iconColor: "text-foreground", trend: +18 },
    { label: "Total Artisans", value: "242",   sub: "active professionals", icon: Briefcase,  iconBg: "bg-primary/10",  iconColor: "text-primary",    trend: +12 },
    { label: "Total Revenue",  value: "GH₵ 13.8k", sub: "platform fees",  icon: DollarSign, iconBg: "bg-primary/10",  iconColor: "text-primary",    trend: +24 },
    { label: "Avg Rating",     value: "4.6",   sub: "across all artisans", icon: Star,       iconBg: "bg-primary/20",  iconColor: "text-primary",    trend: +3  },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Overview of user growth, bookings, revenue, and service trends
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

        {/* KPI cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, icon: Icon, iconBg, iconColor, trend }) => (
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
                    {trend >= 0
                      ? <TrendingUp className="h-3 w-3" />
                      : <TrendingDown className="h-3 w-3" />}
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

        {/* User growth chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">User Growth</CardTitle>
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
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={userGrowth}>
                <defs>
                  <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="artisansGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="users"    stroke="hsl(var(--primary))"      strokeWidth={2} fill="url(#usersGrad)"    dot={false} />
                <Area type="monotone" dataKey="artisans" stroke="hsl(var(--primary) / 0.4)" strokeWidth={1.5} fill="url(#artisansGrad)" dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Booking volume + Revenue */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Booking Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bookingVolume} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, "Jobs"]} />
                  <Bar dataKey="jobs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Revenue (Platform Fees)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`GH₵ ${Number(v).toLocaleString()}`, "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top categories + Rating distribution */}
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Top Service Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topCategories.map(({ name, jobs, pct }) => (
                <div key={name} className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{name}</p>
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Rating Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={ratingDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {ratingDist.map((_, index) => (
                      <Cell key={index} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {ratingDist.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </span>
                    <span className="font-medium text-foreground">{d.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
