"use client"

import Link from "next/link"
import { useEffect, useState, useMemo } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Clock, CheckCircle, Search, Loader2, UserRound, XCircle, TrendingUp, Plus } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { cn, resolveAvatarUrl } from "@/lib/utils"

interface BackendJob {
  id: string
  title: string
  service?: { id: string; name: string }
  status: string
  createdAt: string
  acceptedArtisan?: { id: string; firstname: string; lastname: string; profilePicture?: string }
}

const statusConfig: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: "In Progress", className: "bg-primary/10 text-primary border-primary/20" },
  COMPLETED:   { label: "Completed",   className: "bg-primary/20 text-primary border-primary/30" },
  CANCELLED:   { label: "Cancelled",   className: "bg-destructive/10 text-destructive border-destructive/20" },
  PENDING:     { label: "Pending",     className: "bg-muted text-muted-foreground border-border" },
  OPEN:        { label: "Open",        className: "bg-primary/5 text-primary border-primary/15" },
  EXPIRED:     { label: "Expired",     className: "bg-muted text-muted-foreground border-border" },
}

type FilterKey = "Open" | "In Progress" | "Completed" | "Cancelled"

export default function UserDashboard() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<BackendJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null)

  useEffect(() => {
    apiFetch<BackendJob[] | { items?: BackendJob[] }>("/jobs/mine")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setJobs(items.map((j: BackendJob) => ({ ...j, id: String(j.id) })))
      })
      .catch(() => setJobs([]))
      .finally(() => setIsLoading(false))
  }, [])

  // useMemo must be before any early return to keep hook order stable across renders
  const displayedJobs = useMemo(() => {
    if (activeFilter === "Open")        return jobs.filter((j) => j.status === "OPEN")
    if (activeFilter === "In Progress") return jobs.filter((j) => j.status === "IN_PROGRESS" || j.status === "PENDING")
    if (activeFilter === "Completed")   return jobs.filter((j) => j.status === "COMPLETED")
    if (activeFilter === "Cancelled")   return jobs.filter((j) => j.status === "CANCELLED")
    return jobs.slice(0, 4)
  }, [jobs, activeFilter])

  if (!user) return null

  const open       = jobs.filter((j) => j.status === "OPEN").length
  const inProgress = jobs.filter((j) => j.status === "IN_PROGRESS" || j.status === "PENDING").length
  const completed  = jobs.filter((j) => j.status === "COMPLETED").length
  const cancelled  = jobs.filter((j) => j.status === "CANCELLED").length

  const stats: { label: FilterKey; value: number; icon: React.ElementType; iconBg: string; iconColor: string }[] = [
    { label: "Open",        value: open,       icon: Clock,        iconBg: "bg-primary/10",     iconColor: "text-primary"     },
    { label: "In Progress", value: inProgress, icon: TrendingUp,   iconBg: "bg-muted",          iconColor: "text-foreground"  },
    { label: "Completed",   value: completed,  icon: CheckCircle,  iconBg: "bg-primary/20",     iconColor: "text-primary"     },
    { label: "Cancelled",   value: cancelled,  icon: XCircle,      iconBg: "bg-destructive/10", iconColor: "text-destructive" },
  ]

  const handleStatClick = (label: FilterKey) => {
    setActiveFilter((prev) => (prev === label ? null : label))
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Account Dashboard
            </p>
            <h1 className="mt-0.5 text-2xl font-bold text-foreground">
              Welcome back, {user.name.split(" ")[0]}!
            </h1>
            <p className="text-sm text-muted-foreground">Find trusted artisans and manage your job postings</p>
          </div>
          <div className="mt-2 flex items-center gap-2 sm:mt-0">
            <Button variant="outline" className="hidden bg-transparent sm:flex" asChild>
              <Link href="/dashboard/user/search">
                <Search className="mr-2 h-4 w-4" />
                Find Artisans
              </Link>
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" asChild>
              <Link href="/dashboard/user/post-job">
                <Plus className="mr-2 h-4 w-4" />
                Post a Job
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Stats — clickable to filter */}
        <div className="grid gap-3 md:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, iconBg, iconColor }) => {
            const isActive = activeFilter === label
            return (
              <button
                key={label}
                type="button"
                onClick={() => handleStatClick(label)}
                className={cn(
                  "rounded-xl border bg-card p-5 text-left shadow-sm",
                  "transition-all duration-200 ease-in-out",
                  "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  isActive
                    ? "border-primary ring-1 ring-primary/50 shadow-md"
                    : "border-border hover:border-primary/40",
                )}
              >
                {/* Top row: label + icon */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <div className={cn("shrink-0 rounded-full p-2", iconBg)}>
                    <Icon className={cn("h-4 w-4", iconColor)} />
                  </div>
                </div>
                {/* Number */}
                <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
              </button>
            )
          })}
        </div>

        {/* My Job Postings */}
        <Card className="shadow-sm">
          <div className="border-b p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  My Job Postings
                  {activeFilter && (
                    <span className="ml-2 text-sm font-normal text-primary">({activeFilter})</span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">Your recent service requests</p>
              </div>
              <div className="flex items-center gap-2">
                {activeFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveFilter(null)}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/user/bookings">View All</Link>
                </Button>
              </div>
            </div>
          </div>

          <CardContent className="p-5">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 rounded-full bg-muted p-4">
                  <Search className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">
                  {activeFilter ? `No ${activeFilter.toLowerCase()} jobs` : "No job postings yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeFilter ? "Try a different filter or clear to see all" : "Post a job or browse artisans to get started"}
                </p>
                {!activeFilter && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                      <Link href="/dashboard/user/post-job">
                        <Plus className="mr-2 h-4 w-4" />
                        Post a Job
                      </Link>
                    </Button>
                    <Button variant="outline" className="bg-transparent" asChild>
                      <Link href="/dashboard/user/search">
                        <Search className="mr-2 h-4 w-4" />
                        Find Artisans
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div key={activeFilter ?? "all"} className="space-y-2.5">
                {displayedJobs.map((job) => {
                  const artisanName = job.acceptedArtisan
                    ? `${job.acceptedArtisan.firstname} ${job.acceptedArtisan.lastname}`.trim()
                    : "Awaiting artisan"
                  const cfg = statusConfig[job.status] ?? { label: job.status, className: "" }
                  return (
                    <div
                      key={job.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-lg border bg-card p-4",
                        "transition-all duration-200 hover:shadow-sm hover:border-border/80",
                        "md:flex-row md:items-center md:justify-between",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={resolveAvatarUrl(job.acceptedArtisan?.profilePicture, artisanName)} />
                          <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h3 className="truncate font-medium text-foreground">{job.title}</h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {job.service?.name && (
                              <span className="truncate">{job.service.name}</span>
                            )}
                            {job.service?.name && <span className="shrink-0">·</span>}
                            <span className="flex shrink-0 items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(job.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:shrink-0">
                        <Badge variant="outline" className={cn("text-xs", cfg.className)}>
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                          {cfg.label}
                        </Badge>
                        <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                          <Link href={`/dashboard/user/bookings/${job.id}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
