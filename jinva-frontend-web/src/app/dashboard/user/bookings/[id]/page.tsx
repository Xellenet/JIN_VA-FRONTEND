"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import {
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Wrench,
  Phone,
  Mail,
  MessageSquare,
  Star,
  FileText,
  Loader2,
  UserRound,
  Users,
  CheckCircle,
  DollarSign,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { naviiAvatar, cn } from "@/lib/utils"
import { toast } from "sonner"

interface BackendJob {
  id: string
  title: string
  description?: string
  location?: string
  status: string
  createdAt: string
  completionRequestedAt?: string
  customer?: { id: string; firstname: string; lastname: string; email?: string; phoneNumber?: string; profilePicture?: string }
  acceptedArtisan?: { id: string; firstname: string; lastname: string; email?: string; phoneNumber?: string; profilePicture?: string }
  service?: { id: string; name: string; price?: number }
}

interface BackendApplication {
  id: number
  status: "PENDING" | "ACCEPTED" | "REJECTED"
  quotePrice?: number
  message?: string
  createdAt: string
  artisan: {
    id: number
    firstname: string
    lastname: string
    profilePicture?: string
    phoneNumber?: string
    email?: string
  }
}

const statusConfig: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: "In Progress", className: "border-border bg-muted text-muted-foreground" },
  COMPLETED:   { label: "Completed",   className: "border-primary/20 bg-primary/10 text-primary" },
  CANCELLED:   { label: "Cancelled",   className: "border-destructive/20 bg-destructive/10 text-destructive" },
  PENDING:     { label: "Pending",     className: "border-border bg-muted text-muted-foreground" },
  OPEN:        { label: "Open",        className: "border-primary/15 bg-primary/5 text-primary" },
  EXPIRED:     { label: "Expired",     className: "border-border bg-muted text-muted-foreground" },
}

// The post-job form appends "\n\nPreferred date: DATE[ at TIME]" to the description.
// Split it back out so we can display it as a dedicated field.
function parseDescription(raw: string): { text: string; preferredDate?: string } {
  const marker = "\n\nPreferred date: "
  const idx = raw.indexOf(marker)
  if (idx === -1) return { text: raw }
  return { text: raw.substring(0, idx).trim(), preferredDate: raw.substring(idx + marker.length).trim() }
}

const appStatusConfig: Record<string, { label: string; className: string }> = {
  PENDING:  { label: "Applied",   className: "border-border bg-muted text-muted-foreground" },
  ACCEPTED: { label: "Accepted",  className: "border-primary/20 bg-primary/10 text-primary" },
  REJECTED: { label: "Rejected",  className: "border-destructive/20 bg-destructive/10 text-destructive" },
}

export default function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<BackendJob | null>(null)
  const [applications, setApplications] = useState<BackendApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingApps, setIsLoadingApps] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  useEffect(() => {
    apiFetch<BackendJob>(`/jobs/${id}`)
      .then((j) => {
        setJob(j)
        // Fetch applications alongside
        setIsLoadingApps(true)
        apiFetch<BackendApplication[]>(`/jobs/${id}/applications`)
          .then((r) => setApplications(Array.isArray(r) ? r : []))
          .catch(() => {})
          .finally(() => setIsLoadingApps(false))
      })
      .catch(() => toast.error("Failed to load booking details."))
      .finally(() => setIsLoading(false))
  }, [id])

  const handleConfirmCompletion = async () => {
    if (!job) return
    setIsConfirming(true)
    try {
      await apiFetch(`/jobs/${job.id}/confirm`, { method: "POST" })
      setJob((prev) => prev ? { ...prev, status: "COMPLETED" } : prev)
      toast.success("Job marked as completed!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm completion.")
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancelBooking = async () => {
    if (!job) return
    setIsCancelling(true)
    try {
      await apiFetch(`/jobs/${job.id}/cancel`, { method: "PATCH" })
      setJob((prev) => prev ? { ...prev, status: "CANCELLED" } : prev)
      setShowCancelDialog(false)
      toast.success("Booking cancelled.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel.")
    } finally {
      setIsCancelling(false)
    }
  }

  const handleAccept = async (app: BackendApplication) => {
    if (!job) return
    setAcceptingId(app.id)
    try {
      await apiFetch(`/jobs/${job.id}/applications/${app.id}/accept`, { method: "POST" })
      // Reflect changes locally
      setApplications((prev) =>
        prev.map((a) => ({
          ...a,
          status: a.id === app.id ? "ACCEPTED" : "REJECTED",
        }))
      )
      setJob((prev) => prev ? {
        ...prev,
        status: "PENDING",
        acceptedArtisan: {
          id: String(app.artisan.id),
          firstname: app.artisan.firstname,
          lastname: app.artisan.lastname,
          profilePicture: app.artisan.profilePicture,
          phoneNumber: app.artisan.phoneNumber,
          email: app.artisan.email,
        },
      } : prev)
      toast.success(`${app.artisan.firstname} has been accepted!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept application.")
    } finally {
      setAcceptingId(null)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!job) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">Booking not found.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/dashboard/user/bookings">Back to Bookings</Link>
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const artisanName = job.acceptedArtisan
    ? `${job.acceptedArtisan.firstname} ${job.acceptedArtisan.lastname}`.trim()
    : "Awaiting artisan"

  const cfg = statusConfig[job.status] ?? { label: job.status, className: "" }

  const timelineSteps = [
    { label: "Booking Created",  done: true,                                                    time: new Date(job.createdAt).toLocaleDateString() },
    { label: "Artisan Assigned", done: !!job.acceptedArtisan,                                   time: job.acceptedArtisan ? "Assigned" : "" },
    { label: "Work Started",     done: job.status === "IN_PROGRESS" || job.status === "COMPLETED", time: "" },
    { label: "Work Completed",   done: job.status === "COMPLETED",                              time: "" },
  ]

  const { text: cleanDescription, preferredDate } = parseDescription(job.description ?? "")

  const pendingApps    = applications.filter((a) => a.status === "PENDING")
  const canAccept      = job.status === "OPEN" && pendingApps.length > 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/user/bookings">
            <ArrowLeft className="h-4 w-4" />
            Back to Bookings
          </Link>
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
            <p className="text-muted-foreground">
              {job.service?.name ?? "Booking"} · {new Date(job.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <Badge variant="outline" className={cfg.className}>
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
            {cfg.label}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Left column ─────────────────────────────────────────────── */}
          <div className="space-y-6 lg:col-span-2">

            {/* Service Information */}
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <Wrench className="h-4 w-4 text-primary" />
                  Service Information
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Job Title</p>
                    <p className="mt-1 font-medium text-foreground">{job.title}</p>
                  </div>
                  {job.service && (
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">Service</p>
                      <p className="mt-1 font-medium text-foreground">{job.service.name}</p>
                    </div>
                  )}
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Reference</p>
                    <p className="mt-1 font-medium text-foreground">JB-{String(job.id).toUpperCase().slice(-6)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Created</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="font-medium text-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {preferredDate && (
                    <div className="rounded-lg border border-border bg-primary/5 p-4 md:col-span-2">
                      <p className="text-xs text-muted-foreground">Preferred Date &amp; Time</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <p className="font-medium text-foreground">{preferredDate}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Location & description */}
            {job.location && (
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    Service Location
                  </h3>
                </div>
                <CardContent className="p-5">
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="font-medium text-foreground">{job.location}</p>
                  </div>
                  {cleanDescription && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Description:</p>
                      <p className="mt-1 leading-relaxed">{cleanDescription}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Applicants ────────────────────────────────────────────── */}
            <Card>
              <div className="border-b border-border p-5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    Applicants
                  </h3>
                  {!isLoadingApps && (
                    <Badge variant="outline" className="text-xs">
                      {applications.length} {applications.length === 1 ? "applicant" : "applicants"}
                    </Badge>
                  )}
                </div>
              </div>
              <CardContent className="p-0">
                {isLoadingApps ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : applications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="mb-3 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-foreground">No applicants yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Artisans will apply once your job is live
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {applications.map((app) => {
                      const name = `${app.artisan.firstname} ${app.artisan.lastname}`.trim()
                      const appCfg = appStatusConfig[app.status] ?? { label: app.status, className: "" }
                      const isAccepting = acceptingId === app.id

                      return (
                        <div key={app.id} className="flex items-start gap-4 p-5">
                          <Avatar className="h-11 w-11 shrink-0">
                            <AvatarImage src={app.artisan.profilePicture || naviiAvatar(name)} />
                            <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-foreground">{name}</span>
                              <Badge variant="outline" className={cn("text-[11px]", appCfg.className)}>
                                {appCfg.label}
                              </Badge>
                              {app.quotePrice != null && (
                                <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                  GH₵ {Number(app.quotePrice).toLocaleString()}
                                </span>
                              )}
                            </div>

                            {app.message && (
                              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                                {app.message}
                              </p>
                            )}

                            <p className="mt-1 text-xs text-muted-foreground">
                              Applied {new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 flex-col gap-2">
                            {canAccept && app.status === "PENDING" && (
                              <Button
                                size="sm"
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => handleAccept(app)}
                                disabled={isAccepting}
                              >
                                {isAccepting ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Accept
                              </Button>
                            )}
                            {app.status === "ACCEPTED" && (
                              <Button size="sm" variant="outline" className="bg-transparent" asChild>
                                <Link href={`/dashboard/user/messages?artisan=${app.artisan.id}`}>
                                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                                  Chat
                                </Link>
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

            {/* Timeline */}
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Booking Timeline
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="space-y-0">
                  {timelineSteps.map((step, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          step.done ? "bg-primary text-primary-foreground" : "border-2 border-border bg-background",
                        )}>
                          {step.done ? (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-xs text-muted-foreground">{idx + 1}</span>
                          )}
                        </div>
                        {idx < timelineSteps.length - 1 && (
                          <div className={`h-8 w-0.5 ${step.done ? "bg-primary/50" : "bg-border"}`} />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`text-sm font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        {step.time && <p className="text-xs text-muted-foreground">{step.time}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div className="space-y-6">
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  Assigned Artisan
                </h3>
              </div>
              <CardContent className="p-5">
                {job.acceptedArtisan ? (
                  <>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={job.acceptedArtisan.profilePicture || naviiAvatar(artisanName)} />
                        <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold text-foreground">{artisanName}</h4>
                        <div className="mt-1 flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">—</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                      {job.acceptedArtisan.phoneNumber && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {job.acceptedArtisan.phoneNumber}
                        </div>
                      )}
                      {job.acceptedArtisan.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {job.acceptedArtisan.email}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" className="flex-1 bg-transparent" size="sm" asChild>
                        <Link href={`/dashboard/user/messages?artisan=${job.acceptedArtisan.id}`}>
                          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                          Chat
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No artisan assigned yet. Waiting for applications.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 p-5">
                {job.status === "IN_PROGRESS" && job.completionRequestedAt && (
                  <Button
                    className="w-full bg-green-600 text-white hover:bg-green-700"
                    onClick={handleConfirmCompletion}
                    disabled={isConfirming}
                  >
                    {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Completion
                  </Button>
                )}
                {job.status === "COMPLETED" && (
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href={`/dashboard/user/review/${job.id}`}>
                      <Star className="mr-2 h-4 w-4" />
                      Leave a Review
                    </Link>
                  </Button>
                )}
                {job.status === "OPEN" && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancel Booking
                  </Button>
                )}
                {job.status === "IN_PROGRESS" && job.acceptedArtisan && (
                  <Button variant="outline" className="w-full bg-transparent" asChild>
                    <Link href={`/dashboard/user/messages?artisan=${job.acceptedArtisan.id}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Contact Artisan
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel booking for &ldquo;{job.title}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>No, Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isCancelling}
            >
              {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
