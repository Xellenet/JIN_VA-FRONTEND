"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Calendar,
  Clock,
  Search,
  ChevronDown,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Timer,
  Loader2,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"

interface BackendJob {
  id: string
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
  IN_PROGRESS: { label: "In Progress", className: "bg-muted text-muted-foreground border-muted", icon: Timer },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
  OPEN: { label: "Open", className: "bg-blue-100 text-blue-700 border-blue-200", icon: CheckCircle2 },
} as const

type StatusKey = keyof typeof statusConfig
type StatusFilter = "all" | StatusKey

export default function ArtisanJobsPage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<BackendJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  useEffect(() => {
    apiFetch<BackendJob[] | { items?: BackendJob[] }>("/jobs")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setJobs(items)
      })
      .catch(() => setJobs([]))
      .finally(() => setIsLoading(false))
  }, [])

  const filteredJobs = jobs.filter((job) => {
    const clientName = job.customer
      ? `${job.customer.firstname} ${job.customer.lastname}`
      : ""
    const matchesSearch =
      searchQuery === "" ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.service?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const jobCounts = {
    all: jobs.length,
    IN_PROGRESS: jobs.filter((j) => j.status === "IN_PROGRESS").length,
    COMPLETED: jobs.filter((j) => j.status === "COMPLETED").length,
    PENDING: jobs.filter((j) => j.status === "PENDING").length,
    CANCELLED: jobs.filter((j) => j.status === "CANCELLED").length,
    OPEN: jobs.filter((j) => j.status === "OPEN").length,
  }

  const handleApply = async (jobId: string) => {
    try {
      await apiFetch(`/jobs/${jobId}/apply`, {
        method: "POST",
        body: JSON.stringify({ message: "I'm interested in this job.", quotePrice: 0 }),
      })
      toast.success("Application submitted successfully.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply.")
    }
  }

  const handleRequestCompletion = async (jobId: string) => {
    try {
      await apiFetch(`/jobs/${jobId}/request-completion`, { method: "PATCH" })
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: "IN_PROGRESS" } : j))
      toast.success("Completion request sent to client.")
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

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(["all", "IN_PROGRESS", "COMPLETED", "OPEN"] as const).map((key) => (
            <Card
              key={key}
              className={`cursor-pointer transition-shadow hover:shadow-md ${statusFilter === key ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {key !== "all" && (
                    <div
                      className={`h-2 w-2 rounded-full ${
                        key === "IN_PROGRESS" ? "bg-primary" : key === "COMPLETED" ? "bg-green-500" : "bg-blue-500"
                      }`}
                    />
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
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by client, service, or title..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative">
                <Button
                  variant="outline"
                  className="gap-2 bg-transparent"
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                >
                  {statusFilter === "all" ? "All Status" : statusConfig[statusFilter as StatusKey]?.label}
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {showStatusDropdown && (
                  <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border bg-card py-1 shadow-lg">
                    {(["all", "OPEN", "IN_PROGRESS", "COMPLETED", "PENDING", "CANCELLED"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                        onClick={() => {
                          setStatusFilter(status)
                          setShowStatusDropdown(false)
                        }}
                      >
                        {status === "all" ? "All Status" : statusConfig[status as StatusKey]?.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
              </div>
            ) : (
              <div className="space-y-4">
                {filteredJobs.map((job) => {
                  const clientName = job.customer
                    ? `${job.customer.firstname} ${job.customer.lastname}`.trim()
                    : "Unknown"
                  const cfg = statusConfig[job.status as StatusKey] ?? { label: job.status, className: "", icon: AlertCircle }
                  const StatusIcon = cfg.icon
                  const isMyJob = job.acceptedArtisan?.id === user?.id

                  return (
                    <div
                      key={job.id}
                      className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={job.customer?.profilePicture || "/placeholder.svg"} alt={clientName} />
                            <AvatarFallback>{clientName.substring(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{job.title}</h3>
                            <p className="text-sm text-muted-foreground">Job ID: #{job.id.substring(0, 8)}</p>
                            <div className="mt-3 flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback>{clientName.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <span>Client: {clientName}</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                {new Date(job.createdAt).toLocaleDateString()}
                              </div>
                              {job.location && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  {job.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 md:items-end">
                          <Badge variant="outline" className={cfg.className}>
                            <StatusIcon className="mr-1.5 h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                        {job.status === "OPEN" && (
                          <Button
                            size="sm"
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => handleApply(job.id)}
                          >
                            Apply for Job
                          </Button>
                        )}
                        {isMyJob && job.status === "IN_PROGRESS" && (
                          <Button
                            size="sm"
                            className="bg-green-600 text-white hover:bg-green-700"
                            onClick={() => handleRequestCompletion(job.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Request Completion
                          </Button>
                        )}
                        {job.customer && (
                          <Button variant="outline" size="sm" className="bg-transparent" asChild>
                            <a href={`/dashboard/artisan/messages?client=${job.customer.id}`}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Contact Client
                            </a>
                          </Button>
                        )}
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
