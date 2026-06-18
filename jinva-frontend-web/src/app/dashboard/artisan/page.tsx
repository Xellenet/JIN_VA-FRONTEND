"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { StatsCard } from "@/components/dashboard/admin/stats-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, Calendar, DollarSign, Briefcase, Loader2, UserRound } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { naviiAvatar, cn } from "@/lib/utils"

interface BackendJob {
  id: string
  title: string
  description?: string
  location?: string
  status: string
  createdAt: string
  customer?: { id: string; firstname: string; lastname: string; profilePicture?: string }
  service?: { id: string; name: string }
}

const statusConfig: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: "In Progress", className: "bg-muted text-muted-foreground border-border" },
  COMPLETED:   { label: "Completed",   className: "bg-primary/10 text-primary border-primary/20" },
  CANCELLED:   { label: "Cancelled",   className: "bg-destructive/10 text-destructive border-destructive/20" },
  PENDING:     { label: "Pending",     className: "bg-muted text-muted-foreground border-border" },
  OPEN:        { label: "Open",        className: "bg-primary/5 text-primary border-primary/15" },
}

export default function ArtisanDashboard() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<BackendJob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiFetch<BackendJob[] | { items?: BackendJob[] }>("/jobs")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setJobs(items)
      })
      .catch(() => setJobs([]))
      .finally(() => setIsLoading(false))
  }, [])

  if (!user) return null

  const activeJobs    = jobs.filter((j) => j.status === "IN_PROGRESS").length
  const completedJobs = jobs.filter((j) => j.status === "COMPLETED").length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Artisan Dashboard
            </p>
            <h1 className="mt-0.5 text-2xl font-bold text-foreground">
              Good day, {user.name.split(" ")[0]}!
            </h1>
            <p className="text-sm text-muted-foreground">
              Here&apos;s your job overview and upcoming appointments
            </p>
          </div>
          <Button className="mt-2 sm:mt-0 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <Link href="/dashboard/artisan/jobs">View All Jobs</Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
            title="Jobs Completed"
            value={completedJobs}
            subtitle="Successfully finished"
          />
          <StatsCard
            icon={<Star className="h-4 w-4 text-muted-foreground" />}
            title="Average Rating"
            value={user.rating?.toFixed(1) ?? "—"}
            subtitle="Based on client feedback"
          />
          <StatsCard
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
            title="Active Jobs"
            value={activeJobs}
            subtitle="Currently in progress"
          />
          <StatsCard
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
            title="Total Reviews"
            value={user.reviews ?? 0}
            subtitle="Reviews from clients"
          />
        </div>

        {/* Available Jobs */}
        <Card className="shadow-sm">
          <div className="border-b p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Available Jobs</h2>
                <p className="text-sm text-muted-foreground">Browse and apply for open jobs near you</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/artisan/jobs">View All</Link>
              </Button>
            </div>
          </div>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No jobs available right now.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service</th>
                      <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Posted</th>
                      <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Location</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.slice(0, 8).map((job) => {
                      const clientName = job.customer
                        ? `${job.customer.firstname} ${job.customer.lastname}`.trim()
                        : "Unknown"
                      const cfg = statusConfig[job.status] ?? { label: job.status, className: "" }
                      return (
                        <tr key={job.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={job.customer?.profilePicture || naviiAvatar(clientName)} />
                                <AvatarFallback><UserRound className="h-3.5 w-3.5" /></AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-foreground">{clientName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground">{job.service?.name ?? job.title}</td>
                          <td className="hidden px-5 py-3.5 text-muted-foreground md:table-cell">
                            {new Date(job.createdAt).toLocaleDateString()}
                          </td>
                          <td className="hidden px-5 py-3.5 text-muted-foreground lg:table-cell">
                            {job.location ?? "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant="outline" className={cn("text-xs", cfg.className)}>
                              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                              {cfg.label}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
