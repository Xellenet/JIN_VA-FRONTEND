"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Calendar, MapPin, Search, ChevronDown, Loader2, Link2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"

interface BackendJob {
  id: number
  title: string
  location?: string
  status: string
  createdAt: string
  budgetMin?: number
  budgetMax?: number
  currency?: string
  bookingId?: number
  service?: { id: number; name: string }
}

const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Open", value: "OPEN" },
  { label: "Pending", value: "PENDING" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Expired", value: "EXPIRED" },
]

const statusConfig: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: "In Progress", className: "bg-muted text-muted-foreground border-muted" },
  COMPLETED: { label: "Completed", className: "bg-success/10 text-success border-success/20" },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
  PENDING: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  OPEN: { label: "Open", className: "bg-info/10 text-info border-info/20" },
  EXPIRED: { label: "Expired", className: "bg-muted text-muted-foreground border-border" },
}

/**
 * Decisions #2: job *progress* (the OPEN → PENDING → IN_PROGRESS → COMPLETED
 * state machine, for both open-posting and booking-linked jobs) lives here,
 * genuinely separate from /dashboard/user/bookings (booking-request states
 * only). A job with `bookingId` set originated from a confirmed direct
 * booking (R2); one without it came from the open-posting flow.
 */
export default function UserJobsPage() {
  const [jobs, setJobs] = useState<BackendJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [cancelJobId, setCancelJobId] = useState<number | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    // `/jobs` caps `limit` at 50 and 400s above it — asking for 100 made this
    // list fail outright and render as "no jobs yet".
    apiFetch<BackendJob[] | { items?: BackendJob[] }>("/jobs/mine?page=1&limit=50")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setJobs(items)
      })
      .catch(() => setJobs([]))
      .finally(() => setIsLoading(false))
  }, [])

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        !searchQuery ||
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.service?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(job.id).includes(searchQuery)
      const matchesStatus = statusFilter === "all" || job.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [jobs, searchQuery, statusFilter])

  const handleCancelJob = async () => {
    if (cancelJobId == null) return
    setIsCancelling(true)
    try {
      await apiFetch(`/jobs/${cancelJobId}/cancel`, { method: "PATCH" })
      setJobs((prev) => prev.map((j) => (j.id === cancelJobId ? { ...j, status: "CANCELLED" } : j)))
      toast.success("Job cancelled successfully.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel job.")
    } finally {
      setIsCancelling(false)
      setCancelJobId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>
          <p className="text-muted-foreground">Track the progress of work you&apos;ve posted or booked</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {statusOptions.find((s) => s.value === statusFilter)?.label ?? "All Status"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {statusOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value)}
                      className={statusFilter === opt.value ? "bg-accent text-accent-foreground" : ""}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Showing {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}
            </p>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {filteredJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="mb-4 h-12 w-12 text-muted-foreground/40" />
                    <h3 className="text-lg font-semibold text-foreground">No jobs found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters.</p>
                    <Button
                      variant="outline"
                      className="mt-4 bg-transparent"
                      onClick={() => { setSearchQuery(""); setStatusFilter("all") }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                ) : (
                  filteredJobs.map((job) => {
                    const cfg = statusConfig[job.status] ?? { label: job.status, className: "" }
                    return (
                      <div key={job.id} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-foreground">{job.title}</h3>
                              {job.bookingId && (
                                <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground">
                                  <Link2 className="h-3 w-3" />
                                  From booking #{job.bookingId}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">Job #{job.id}</p>
                            <div className="mt-3 flex flex-wrap gap-4 text-sm">
                              {job.service && (
                                <span className="text-muted-foreground">{job.service.name}</span>
                              )}
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                {new Date(job.createdAt).toLocaleDateString()}
                              </div>
                              {job.location && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <MapPin className="h-4 w-4" />
                                  {job.location}
                                </div>
                              )}
                              {(job.budgetMin != null || job.budgetMax != null) && (
                                <span className="text-muted-foreground">
                                  {job.budgetMin != null ? formatCurrency(job.budgetMin) : "—"}
                                  {job.budgetMax != null ? ` – ${formatCurrency(job.budgetMax)}` : ""}
                                </span>
                              )}
                            </div>
                          </div>

                          <Badge variant="outline" className={cfg.className}>
                            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                            {cfg.label}
                          </Badge>
                        </div>

                        <div className="mt-4 flex gap-2 border-t pt-4">
                          <Button variant="outline" size="sm" asChild className="bg-transparent">
                            <Link href={`/dashboard/user/jobs/${job.id}`}>View Details</Link>
                          </Button>
                          {job.bookingId && (
                            <Button variant="outline" size="sm" asChild className="bg-transparent">
                              <Link href={`/dashboard/user/bookings/${job.bookingId}`}>View Booking</Link>
                            </Button>
                          )}
                          {job.status === "COMPLETED" && (
                            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                              <Link href={`/dashboard/user/review/${job.id}`}>Leave Review</Link>
                            </Button>
                          )}
                          {(job.status === "OPEN" || job.status === "PENDING") && (
                            <Button size="sm" variant="destructive" onClick={() => setCancelJobId(job.id)}>
                              Cancel Job
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={cancelJobId != null} onOpenChange={(open) => !open && setCancelJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this job? This action cannot be undone and any associated payment will be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>No, Keep Job</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelJob}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isCancelling}
            >
              {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, Cancel Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
