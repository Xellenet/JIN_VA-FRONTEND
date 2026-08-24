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
import { Users, Clock, CheckCircle2, Briefcase, Loader2, ShieldCheck, ArrowRight } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { mockActivities, mockArtisans, mockOrders } from "@/lib/data/mock-data"

interface AdminStats {
  users: { total: number; artisans: number; customers: number; banned: number }
  jobs: { total: number; open: number }
  verifications: { pending: number; approved: number }
  bookings: { total: number; confirmed: number }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiFetch<AdminStats>("/admin/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setIsLoading(false))
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
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
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

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <RevenueChart />
          <RecentActivities activities={mockActivities} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <TopArtisans artisans={mockArtisans} />
          <OngoingJobs jobs={mockOrders} />
        </div>
      </div>
    </DashboardLayout>
  )
}
