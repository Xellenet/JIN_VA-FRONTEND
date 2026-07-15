"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Briefcase,
  User,
  CheckCircle2,
  AlertCircle,
  Timer,
  XCircle,
  MessageSquare,
  Loader2,
  UserRound,
  DollarSign,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { naviiAvatar } from "@/lib/utils"

interface BackendJob {
  id: string | number
  title: string
  description?: string
  location?: string
  status: string
  createdAt: string
  budget?: number
  customer?: {
    id: string
    firstname: string
    lastname: string
    profilePicture?: string
    email?: string
    phoneNumber?: string
  }
  acceptedArtisan?: { id: string }
  service?: { id: string; name: string }
}

const statusConfig = {
  IN_PROGRESS: { label: "In Progress", className: "bg-muted text-muted-foreground border-muted", icon: Timer },
  COMPLETED:   { label: "Completed",   className: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  CANCELLED:   { label: "Cancelled",   className: "bg-red-100 text-red-700 border-red-200",     icon: XCircle },
  PENDING:     { label: "Pending",     className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
  OPEN:        { label: "Open",        className: "bg-blue-100 text-blue-700 border-blue-200",   icon: CheckCircle2 },
} as const

type StatusKey = keyof typeof statusConfig

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

export default function ArtisanJobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [job, setJob] = useState<BackendJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isApplying, setIsApplying] = useState(false)
  const [isRequestingCompletion, setIsRequestingCompletion] = useState(false)

  useEffect(() => {
    if (!id) return
    apiFetch<BackendJob>(`/jobs/${id}`)
      .then((data) => setJob(data))
      .catch(() => setError("Could not load job details."))
      .finally(() => setIsLoading(false))
  }, [id])

  const handleApply = async () => {
    if (!job) return
    setIsApplying(true)
    try {
      await apiFetch(`/jobs/${job.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ message: "I'm interested in this job.", quotePrice: 0 }),
      })
      toast.success("Application submitted successfully.")
      setJob((prev) => prev ? { ...prev, status: "PENDING" } : prev)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply.")
    } finally {
      setIsApplying(false)
    }
  }

  const handleRequestCompletion = async () => {
    if (!job) return
    setIsRequestingCompletion(true)
    try {
      await apiFetch(`/jobs/${job.id}/request-completion`, { method: "PATCH" })
      toast.success("Completion request sent to client.")
      setJob((prev) => prev ? { ...prev, status: "IN_PROGRESS" } : prev)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request completion.")
    } finally {
      setIsRequestingCompletion(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !job) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
            <Link href="/dashboard/artisan/jobs">
              <ArrowLeft className="h-4 w-4" />
              Back to Jobs
            </Link>
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">{error || "Job not found."}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  const clientName = job.customer
    ? `${job.customer.firstname} ${job.customer.lastname}`.trim()
    : "Unknown"
  const cfg = statusConfig[job.status as StatusKey] ?? { label: job.status, className: "", icon: AlertCircle }
  const StatusIcon = cfg.icon
  const isMyJob = String(job.acceptedArtisan?.id) === String(user?.id)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/artisan/jobs">
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
                    <p className="mt-1 text-xs text-muted-foreground">Job #{String(job.id).substring(0, 8)}</p>
                  </div>
                  <Badge variant="outline" className={`${cfg.className} shrink-0 text-xs`}>
                    <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                    {cfg.label}
                  </Badge>
                </div>

                {/* Meta */}
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {job.service && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4 shrink-0 text-primary/60" />
                      <span>{job.service.name}</span>
                    </div>
                  )}
                  {job.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0 text-primary/60" />
                      <span>{job.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0 text-primary/60" />
                    <span>Posted {formatDate(job.createdAt)}</span>
                  </div>
                  {job.budget != null && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4 shrink-0 text-primary/60" />
                      <span>Budget: GH₵ {Number(job.budget).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {job.description && (
                  <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Description</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {job.description}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
                  {job.status === "OPEN" && (
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={handleApply}
                      disabled={isApplying}
                    >
                      {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Apply for Job
                    </Button>
                  )}
                  {isMyJob && job.status === "IN_PROGRESS" && (
                    <Button
                      className="bg-green-600 text-white hover:bg-green-700"
                      onClick={handleRequestCompletion}
                      disabled={isRequestingCompletion}
                    >
                      {isRequestingCompletion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Request Completion
                    </Button>
                  )}
                  {job.customer && (
                    <Button variant="outline" className="bg-transparent" asChild>
                      <Link href={`/dashboard/artisan/messages?client=${job.customer.id}`}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Contact Client
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">Client</h3>
                {job.customer ? (
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={job.customer.profilePicture || naviiAvatar(clientName)} />
                      <AvatarFallback><UserRound className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium text-foreground">{clientName}</p>
                      {job.customer.email && (
                        <p className="truncate text-xs text-muted-foreground">{job.customer.email}</p>
                      )}
                      {job.customer.phoneNumber && (
                        <p className="text-xs text-muted-foreground">{job.customer.phoneNumber}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>No client info</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {job.service && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Service Required</h3>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground">{job.service.name}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Job Status</h3>
                <Badge variant="outline" className={`${cfg.className} text-xs`}>
                  <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                  {cfg.label}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
