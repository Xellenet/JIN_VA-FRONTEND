"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatsCard } from "@/components/dashboard/admin/stats-card"
import { RevenueChart } from "@/components/dashboard/admin/revenue-chart"
import { RecentActivities } from "@/components/dashboard/admin/recent-activities"
import { TopArtisans } from "@/components/dashboard/admin/top-artisans"
import { OngoingJobs } from "@/components/dashboard/admin/ongoing-jobs"
import { Users, Clock, CheckCircle2, Briefcase, ShieldCheck, ArrowRight } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { fillSeries, type AdminAnalytics } from "@/lib/admin-analytics"
import type { Activity } from "@/components/dashboard/admin/recent-activities"
import type { OngoingJob } from "@/components/dashboard/admin/ongoing-jobs"
import { Skeleton } from "@/components/ui/skeleton"

interface AdminPerson {
  firstname?: string
  lastname?: string
  profilePicture?: string | null
}
interface AdminJobRow {
  id: number
  title: string
  status: string
  deadline?: string | null
  createdAt: string
  bookingId?: number | null
  service?: { name: string } | null
  customer?: AdminPerson | null
}
interface AdminBookingRow {
  id: number
  status: string
  createdAt: string
  service?: { name: string } | null
  customer?: AdminPerson | null
}

const personName = (p?: AdminPerson | null) => `${p?.firstname ?? ""} ${p?.lastname ?? ""}`.trim() || "Customer"

interface AdminStats {
  users: { total: number; artisans: number; customers: number; banned: number }
  jobs: { total: number; open: number }
  verifications: { pending: number; approved: number }
  bookings: { total: number; confirmed: number }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // QA ADM-02: the chart, activity, top artisans and ongoing jobs used to be
  // sample data; they now come from the last 30 days of real activity.
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [analyticsFailed, setAnalyticsFailed] = useState(false)
  const [ongoing, setOngoing] = useState<OngoingJob[] | null>(null)
  const [activity, setActivity] = useState<Activity[] | null>(null)

  useEffect(() => {
    apiFetch<AdminStats>("/admin/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setIsLoading(false))
    apiFetch<AdminAnalytics>("/admin/analytics?range=30d")
      .then(setAnalytics)
      .catch(() => setAnalyticsFailed(true))
    apiFetch<AdminJobRow[]>("/admin/jobs?status=IN_PROGRESS&limit=6")
      .then((rows) =>
        setOngoing(
          rows.map((j) => ({
            id: j.id,
            title: j.title,
            service: j.service?.name ?? null,
            status: j.status,
            deadline: j.deadline ?? null,
            customerName: personName(j.customer),
            customerPicture: j.customer?.profilePicture ?? null,
          })),
        ),
      )
      .catch(() => setOngoing([]))
    Promise.all([
      apiFetch<AdminBookingRow[]>("/admin/bookings?limit=8").catch(() => [] as AdminBookingRow[]),
      apiFetch<AdminJobRow[]>("/admin/jobs?limit=8").catch(() => [] as AdminJobRow[]),
    ]).then(([bookings, jobs]) =>
      setActivity(
        [
          ...bookings.map<Activity>((b) => ({
            kind: "booking",
            id: b.id,
            title: b.service?.name ?? "Booking",
            status: b.status,
            at: b.createdAt,
            customerName: personName(b.customer),
            customerPicture: b.customer?.profilePicture ?? null,
          })),
          // A booking's job is the same piece of work; list it once.
          ...jobs
            .filter((j) => !j.bookingId)
            .map<Activity>((j) => ({
              kind: "job",
              id: j.id,
              title: j.title,
              status: j.status,
              at: j.createdAt,
              customerName: personName(j.customer),
              customerPicture: j.customer?.profilePicture ?? null,
            })),
        ]
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 8),
      ),
    )
  }, [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Admin Dashboard
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-foreground">Platform Overview</h1>
          <p className="text-sm text-muted-foreground">
            Manage clients, artisans, orders, and platform health in one place.
          </p>
        </div>

        {isLoading ? (
          // QA UI-12: placeholders the size of the cards, so the page doesn't
          // jump when the numbers arrive.
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[118px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              icon={<Users className="h-5 w-5 text-muted-foreground" />}
              title="Total Customers"
              value={stats?.users.customers ?? 0}
              subtitle="Registered on the platform"
            />
            <StatsCard
              icon={<Clock className="h-5 w-5 text-muted-foreground" />}
              title="Open Jobs"
              value={stats?.jobs.open ?? 0}
              subtitle="Jobs awaiting artisans"
            />
            <StatsCard
              icon={<CheckCircle2 className="h-5 w-5 text-muted-foreground" />}
              title="Confirmed Bookings"
              value={stats?.bookings.confirmed ?? 0}
              subtitle="Successfully booked"
            />
            <StatsCard
              icon={<Briefcase className="h-5 w-5 text-muted-foreground" />}
              title="Total Artisans"
              value={stats?.users.artisans ?? 0}
              subtitle="Service providers"
            />
          </div>
        )}

        {/*
          AT1: `/admin/stats` has always returned `verifications.pending` /
          `.approved` and this page has never rendered either of them, while
          the queue that acts on them didn't exist. Surfaced here as a work
          item linking into the new queue rather than as a fifth stat card, so
          the four-up rhythm above survives and the number comes with the
          action it implies.
        */}
        {!isLoading && stats && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-full bg-primary/10 p-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {stats.verifications.pending === 0
                      ? "No artisan verifications waiting"
                      : `${stats.verifications.pending} artisan verification${stats.verifications.pending === 1 ? "" : "s"} waiting for review`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stats.verifications.approved} approved to date
                  </p>
                </div>
              </div>
              <Button variant="outline" className="bg-transparent" asChild>
                <Link href="/dashboard/admin/verifications">
                  Review queue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && stats && (
          <p className="text-sm text-muted-foreground">
            {stats.users.total} accounts in total ({stats.users.banned} banned) · {stats.jobs.total} jobs posted ·{" "}
            {stats.bookings.total} bookings made
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {analyticsFailed ? (
            <RevenueChart series={null} total={null} periodLabel="last 30 days" />
          ) : !analytics ? (
            <Skeleton className="h-[400px] rounded-xl" />
          ) : (
            <RevenueChart
              series={analytics.series.revenue ? fillSeries(analytics.series.revenue, analytics, { gross: 0, net: 0, refunded: 0 }) : null}
              total={analytics.kpis?.netRevenue ?? null}
              periodLabel="last 30 days"
            />
          )}
          {activity ? <RecentActivities activities={activity} /> : <Skeleton className="h-[400px] rounded-xl" />}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          {analytics?.topArtisans ? (
            <TopArtisans artisans={analytics.topArtisans} />
          ) : (
            <Skeleton className="h-[260px] rounded-xl" />
          )}
          {ongoing ? <OngoingJobs jobs={ongoing} /> : <Skeleton className="h-[260px] rounded-xl" />}
        </div>
      </div>
    </DashboardLayout>
  )
}
