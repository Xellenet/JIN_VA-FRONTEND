"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Calendar,
  MapPin,
  Search,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Timer,
  Loader2,
  UserRound,
  Briefcase,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { naviiAvatar, cn } from "@/lib/utils"

interface BackendJob {
  id: string | number
  title: string
  description?: string
  location?: string
  status: string
  createdAt: string
  customer?: { id: string; firstname: string; lastname: string; profilePicture?: string }
  acceptedArtisan?: { id: string }
  service?: { id: string; name: string }
}

const statusConfig = {
  IN_PROGRESS: { label: "In Progress", className: "bg-muted text-muted-foreground border-muted",              icon: Timer },
  COMPLETED:   { label: "Completed",   className: "bg-green-100 text-green-700 border-green-200",             icon: CheckCircle2 },
  CANCELLED:   { label: "Cancelled",   className: "bg-red-100 text-red-700 border-red-200",                   icon: XCircle },
  PENDING:     { label: "Pending",     className: "bg-yellow-100 text-yellow-700 border-yellow-200",          icon: AlertCircle },
  OPEN:        { label: "Open",        className: "bg-blue-100 text-blue-700 border-blue-200",                icon: CheckCircle2 },
} as const

type StatusKey = keyof typeof statusConfig

type DateFilter = "all" | "today" | "this-week" | "this-month"

const DATE_LABELS: Record<DateFilter, string> = {
  "all":        "All Time",
  "today":      "Today",
  "this-week":  "This Week",
  "this-month": "This Month",
}

function isWithinRange(iso: string, range: DateFilter): boolean {
  if (range === "all") return true
  const d = new Date(iso)
  const now = new Date()
  if (range === "today") {
    return d.toDateString() === now.toDateString()
  }
  if (range === "this-week") {
    const weekAgo = new Date(now)
    weekAgo.setDate(now.getDate() - 7)
    return d >= weekAgo
  }
  if (range === "this-month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  return true
}

export default function ArtisanJobsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [jobs, setJobs] = useState<BackendJob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all")
  const [serviceFilter, setServiceFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [locationQuery, setLocationQuery] = useState("")

  useEffect(() => {
    apiFetch<BackendJob[] | { items?: BackendJob[] }>("/jobs")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setJobs(items)
      })
      .catch(() => setJobs([]))
      .finally(() => setIsLoading(false))
  }, [])

  // Derive unique services and locations from loaded jobs
  const uniqueServices = useMemo(() => {
    const map = new Map<string, string>()
    jobs.forEach((j) => { if (j.service) map.set(j.service.id, j.service.name) })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [jobs])

  const uniqueLocations = useMemo(() => {
    const set = new Set<string>()
    jobs.forEach((j) => { if (j.location?.trim()) set.add(j.location.trim()) })
    return Array.from(set).sort()
  }, [jobs])

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const clientName = job.customer
        ? `${job.customer.firstname} ${job.customer.lastname}`
        : ""
      if (
        searchQuery &&
        !job.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(job.service?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) &&
        !clientName.toLowerCase().includes(searchQuery.toLowerCase())
      ) return false
      if (statusFilter !== "all" && job.status !== statusFilter) return false
      if (serviceFilter !== "all" && job.service?.id !== serviceFilter) return false
      if (!isWithinRange(job.createdAt, dateFilter)) return false
      if (
        locationQuery &&
        !(job.location ?? "").toLowerCase().includes(locationQuery.toLowerCase())
      ) return false
      return true
    })
  }, [jobs, searchQuery, statusFilter, serviceFilter, dateFilter, locationQuery])

  const jobCounts = useMemo(() => ({
    all:         jobs.length,
    IN_PROGRESS: jobs.filter((j) => j.status === "IN_PROGRESS").length,
    COMPLETED:   jobs.filter((j) => j.status === "COMPLETED").length,
    PENDING:     jobs.filter((j) => j.status === "PENDING").length,
    CANCELLED:   jobs.filter((j) => j.status === "CANCELLED").length,
    OPEN:        jobs.filter((j) => j.status === "OPEN").length,
  }), [jobs])

  const hasActiveFilters =
    statusFilter !== "all" ||
    serviceFilter !== "all" ||
    dateFilter !== "all" ||
    locationQuery !== "" ||
    searchQuery !== ""

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setServiceFilter("all")
    setDateFilter("all")
    setLocationQuery("")
  }

  const handleApply = async (e: React.MouseEvent, jobId: string | number) => {
    e.stopPropagation()
    try {
      await apiFetch(`/jobs/${jobId}/apply`, {
        method: "POST",
        body: JSON.stringify({ message: "I'm interested in this job.", quotePrice: 0 }),
      })
      toast.success("Application submitted successfully.")
      setJobs((prev) => prev.map((j) => String(j.id) === String(jobId) ? { ...j, status: "PENDING" } : j))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply.")
    }
  }

  const handleRequestCompletion = async (e: React.MouseEvent, jobId: string | number) => {
    e.stopPropagation()
    try {
      await apiFetch(`/jobs/${jobId}/request-completion`, { method: "PATCH" })
      toast.success("Completion request sent to client.")
      setJobs((prev) => prev.map((j) => String(j.id) === String(jobId) ? { ...j, status: "IN_PROGRESS" } : j))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request completion.")
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-muted-foreground">Browse available jobs and manage your assigned work</p>
        </div>

        {/* Status summary cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(["all", "IN_PROGRESS", "COMPLETED", "OPEN"] as const).map((key) => (
            <Card
              key={key}
              className={cn(
                "cursor-pointer transition-shadow hover:shadow-md",
                statusFilter === key && "ring-2 ring-primary",
              )}
              onClick={() => setStatusFilter(key)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {key !== "all" && (
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      key === "IN_PROGRESS" ? "bg-primary" : key === "COMPLETED" ? "bg-green-500" : "bg-blue-500",
                    )} />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {key === "all" ? "Total" : statusConfig[key].label}
                  </p>
                </div>
                <p className="text-2xl font-bold text-foreground">{jobCounts[key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            {/* Filter bar */}
            <div className="mb-6 space-y-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by client, service, or title..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Filter dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Service */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "gap-1.5 bg-transparent",
                        serviceFilter !== "all" && "border-primary/50 bg-primary/5 text-primary",
                      )}
                    >
                      <Briefcase className="h-3.5 w-3.5" />
                      {serviceFilter === "all"
                        ? "Service"
                        : (uniqueServices.find((s) => s.id === serviceFilter)?.name ?? "Service")}
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    <DropdownMenuItem onClick={() => setServiceFilter("all")}>
                      All Services
                    </DropdownMenuItem>
                    {uniqueServices.length > 0 && <DropdownMenuSeparator />}
                    {uniqueServices.map((s) => (
                      <DropdownMenuItem key={s.id} onClick={() => setServiceFilter(s.id)}>
                        {s.name}
                      </DropdownMenuItem>
                    ))}
                    {uniqueServices.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No services found</div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Date posted */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "gap-1.5 bg-transparent",
                        dateFilter !== "all" && "border-primary/50 bg-primary/5 text-primary",
                      )}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {DATE_LABELS[dateFilter]}
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setDateFilter("all")}>All Time</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDateFilter("today")}>Today</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDateFilter("this-week")}>This Week</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDateFilter("this-month")}>This Month</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Location */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "gap-1.5 bg-transparent",
                        locationQuery && "border-primary/50 bg-primary/5 text-primary",
                      )}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {locationQuery || "Location"}
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    <DropdownMenuItem onClick={() => setLocationQuery("")}>
                      All Locations
                    </DropdownMenuItem>
                    {uniqueLocations.length > 0 && <DropdownMenuSeparator />}
                    {uniqueLocations.map((loc) => (
                      <DropdownMenuItem key={loc} onClick={() => setLocationQuery(loc)}>
                        {loc}
                      </DropdownMenuItem>
                    ))}
                    {uniqueLocations.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No locations found</div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Status */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "gap-1.5 bg-transparent",
                        statusFilter !== "all" && "border-primary/50 bg-primary/5 text-primary",
                      )}
                    >
                      {statusFilter === "all" ? "Status" : statusConfig[statusFilter as StatusKey]?.label}
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {(["OPEN", "IN_PROGRESS", "PENDING", "COMPLETED", "CANCELLED"] as const).map((s) => (
                      <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)}>
                        {statusConfig[s].label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Clear + result count */}
                {hasActiveFilters && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={clearFilters}
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {filteredJobs.length} of {jobs.length} jobs
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Job list */}
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">No jobs found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filter criteria</p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="mt-4 bg-transparent" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => {
                  const clientName = job.customer
                    ? `${job.customer.firstname} ${job.customer.lastname}`.trim()
                    : "Unknown"
                  const cfg = statusConfig[job.status as StatusKey] ?? { label: job.status, className: "", icon: AlertCircle }
                  const StatusIcon = cfg.icon
                  // GET /jobs does not yet expose `acceptedArtisan` (flagged
                  // to backend-engineer) — fall back to "assume mine" so this
                  // action isn't permanently hidden; the server's own
                  // ownership guard is the real gate.
                  const isMyJob = job.acceptedArtisan ? String(job.acceptedArtisan.id) === String(user?.id) : true

                  return (
                    <div
                      key={String(job.id)}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/dashboard/artisan/jobs/${job.id}`)}
                      onKeyDown={(e) => e.key === "Enter" && router.push(`/dashboard/artisan/jobs/${job.id}`)}
                      className="group cursor-pointer rounded-lg border border-border p-4 transition-colors hover:bg-muted/30 hover:border-primary/30"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12 shrink-0">
                            <AvatarImage src={job.customer?.profilePicture || naviiAvatar(clientName)} alt={clientName} />
                            <AvatarFallback><UserRound className="h-5 w-5" /></AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {job.title}
                              </h3>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                            <p className="text-xs text-muted-foreground">#{String(job.id).substring(0, 8)}</p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={naviiAvatar(clientName, 32)} />
                                  <AvatarFallback><UserRound className="h-2.5 w-2.5" /></AvatarFallback>
                                </Avatar>
                                {clientName}
                              </span>
                              {job.service && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="h-3.5 w-3.5" />
                                  {job.service.name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {new Date(job.createdAt).toLocaleDateString()}
                              </span>
                              {job.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {job.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <Badge variant="outline" className={cn("shrink-0 self-start text-xs", cfg.className)}>
                          <StatusIcon className="mr-1.5 h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </div>

                      {/* Action buttons — stop propagation so clicks don't navigate */}
                      <div
                        className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {job.status === "OPEN" && (
                          <Button
                            size="sm"
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={(e) => handleApply(e, job.id)}
                          >
                            Apply for Job
                          </Button>
                        )}
                        {isMyJob && job.status === "IN_PROGRESS" && (
                          <Button
                            size="sm"
                            className="bg-green-600 text-white hover:bg-green-700"
                            onClick={(e) => handleRequestCompletion(e, job.id)}
                          >
                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                            Request Completion
                          </Button>
                        )}
                        {job.customer && (
                          <Button variant="outline" size="sm" className="bg-transparent" asChild>
                            <Link
                              href={`/dashboard/artisan/messages?client=${job.customer.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageSquare className="mr-1.5 h-4 w-4" />
                              Contact Client
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-muted-foreground gap-1"
                          onClick={() => router.push(`/dashboard/artisan/jobs/${job.id}`)}
                        >
                          View Details
                          <ChevronRight className="h-3.5 w-3.5" />
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
