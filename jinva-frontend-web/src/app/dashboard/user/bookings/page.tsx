"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Calendar, Clock, Search, ChevronDown, MessageSquare, Loader2, UserRound } from "lucide-react"
import { naviiAvatar } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"

interface BackendJob {
  id: string
  title: string
  description?: string
  location?: string
  status: string
  createdAt: string
  acceptedArtisan?: { id: string; firstname: string; lastname: string; profilePicture?: string }
  service?: { id: string; name: string }
}

const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Open", value: "OPEN" },
  { label: "Pending", value: "PENDING" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
]

const statusConfig: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: "In Progress", className: "bg-muted text-muted-foreground border-muted" },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  OPEN: { label: "Open", className: "bg-blue-100 text-blue-700 border-blue-200" },
  EXPIRED: { label: "Expired", className: "bg-gray-100 text-gray-600 border-gray-200" },
}

export default function UserBookingsPage() {
  const [jobs, setJobs] = useState<BackendJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [cancelJobId, setCancelJobId] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    apiFetch<BackendJob[] | { items?: BackendJob[] }>("/jobs/mine")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setJobs(items.map((j) => ({ ...j, id: String(j.id) })))
      })
      .catch(() => setJobs([]))
      .finally(() => setIsLoading(false))
  }, [])

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const artisanName = job.acceptedArtisan
        ? `${job.acceptedArtisan.firstname} ${job.acceptedArtisan.lastname}`
        : ""
      const matchesSearch =
        !searchQuery ||
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.service?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        artisanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.id.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || job.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [jobs, searchQuery, statusFilter])

  const handleCancelBooking = async () => {
    if (!cancelJobId) return
    setIsCancelling(true)
    try {
      await apiFetch(`/jobs/${cancelJobId}/cancel`, { method: "PATCH" })
      setJobs((prev) =>
        prev.map((j) => (j.id === cancelJobId ? { ...j, status: "CANCELLED" } : j))
      )
      toast.success("Booking cancelled successfully.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking.")
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
          <p className="text-muted-foreground">View and manage all your service jobs</p>
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
                    const artisanName = job.acceptedArtisan
                      ? `${job.acceptedArtisan.firstname} ${job.acceptedArtisan.lastname}`.trim()
                      : "Awaiting artisan"
                    const cfg = statusConfig[job.status] ?? { label: job.status, className: "" }
                    return (
                      <div key={job.id} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-14 w-14">
                              <AvatarImage src={job.acceptedArtisan?.profilePicture || naviiAvatar(artisanName)} />
                              <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground">{job.title}</h3>
                              <p className="text-sm text-muted-foreground">Booking ID: #{job.id.substring(0, 8)}</p>
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
                                    <Clock className="h-4 w-4" />
                                    {job.location}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 md:items-end">
                            <Badge variant="outline" className={cfg.className}>
                              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                              {cfg.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2 border-t pt-4">
                          <Button variant="outline" size="sm" asChild className="bg-transparent">
                            <Link href={`/dashboard/user/bookings/${job.id}`}>View Details</Link>
                          </Button>
                          {job.acceptedArtisan && (
                            <Button variant="outline" size="sm" asChild className="bg-transparent">
                              <Link href={`/dashboard/user/messages?artisan=${job.acceptedArtisan.id}`}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Contact Artisan
                              </Link>
                            </Button>
                          )}
                          {job.status === "COMPLETED" && (
                            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                              <Link href={`/dashboard/user/review/${job.id}`}>Leave Review</Link>
                            </Button>
                          )}
                          {job.status === "OPEN" && (
                            <Button size="sm" variant="destructive" onClick={() => setCancelJobId(job.id)}>
                              Cancel Booking
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

      <AlertDialog open={!!cancelJobId} onOpenChange={(open) => !open && setCancelJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this job? This action cannot be undone and any associated payment will be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>No, Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isCancelling}
            >
              {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
