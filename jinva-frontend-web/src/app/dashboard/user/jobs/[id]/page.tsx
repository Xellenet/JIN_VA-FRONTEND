"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
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
  MapPin,
  Wrench,
  MessageSquare,
  Star,
  FileText,
  Loader2,
  UserRound,
  CheckCircle,
  Link2,
  CreditCard,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { formatCurrency, resolveAvatarUrl } from "@/lib/utils"
import { toast } from "sonner"
import { JobStatusTimeline, type JobStatusHistoryEntry } from "@/components/dashboard/job-status-timeline"
import { AttachmentGallery, type JobAttachment } from "@/components/dashboard/attachment-gallery"
import { getPaymentStatusConfig, RETRYABLE_PAYOUT_STATUSES } from "@/lib/status-badges"
import { DISPUTABLE_BOOKING_STATUSES } from "@/lib/disputes"
import { DisputeEntryPoint } from "@/components/disputes/dispute-entry-point"

interface BackendJob {
  id: number
  title: string
  description?: string
  location?: string
  status: string
  createdAt: string
  budgetMin?: number
  budgetMax?: number
  bookingId?: number
  customer?: { id: number; firstname: string; lastname: string }
  // Not yet exposed by GET /jobs/:id (see write-up) — optional-chained
  // throughout so this page degrades gracefully today and "just works" once
  // the backend adds it, consistent with how the rest of the app already
  // expects this field.
  acceptedArtisan?: { id: number; firstname: string; lastname: string; profilePicture?: string }
  completionRequestedAt?: string
  service?: { id: number; name: string }
  statusHistory?: JobStatusHistoryEntry[]
  attachments?: JobAttachment[]
}

// C1/C3: there is no GET /payments/for-job/:jobId — whether (and what)
// payment exists for a job can only be determined by checking the
// customer's own payment history and matching on jobId, per requirements.md
// C1 ("the frontend must check the actual payment record, not the job's own
// status field").
interface BackendPayment {
  id: number
  jobId: number
  amount: number
  status: string
  paidAt?: string
  releasedAt?: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: "In Progress", className: "border-border bg-muted text-muted-foreground" },
  COMPLETED: { label: "Completed", className: "border-primary/20 bg-primary/10 text-primary" },
  CANCELLED: { label: "Cancelled", className: "border-destructive/20 bg-destructive/10 text-destructive" },
  PENDING: { label: "Pending", className: "border-border bg-muted text-muted-foreground" },
  OPEN: { label: "Open", className: "border-primary/15 bg-primary/5 text-primary" },
  EXPIRED: { label: "Expired", className: "border-border bg-muted text-muted-foreground" },
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<BackendJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [payment, setPayment] = useState<BackendPayment | null>(null)
  const [isPaymentLoading, setIsPaymentLoading] = useState(true)

  useEffect(() => {
    apiFetch<BackendJob>(`/jobs/${id}`)
      .then(setJob)
      .catch(() => toast.error("Failed to load job details."))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => {
    apiFetch<BackendPayment[]>("/payments/history")
      .then((history) => setPayment(history.find((p) => Number(p.jobId) === Number(id)) ?? null))
      .catch(() => setPayment(null))
      .finally(() => setIsPaymentLoading(false))
  }, [id])

  const handleConfirmCompletion = async () => {
    if (!job) return
    setIsConfirming(true)
    try {
      await apiFetch(`/jobs/${job.id}/confirm`, { method: "POST" })
      setJob((prev) => prev ? { ...prev, status: "COMPLETED" } : prev)
      toast.success("Job marked as completed!")
    } catch (err) {
      // e.g. "The artisan has not yet signalled completion..." — a real,
      // specific 400 from the backend, not a generic failure.
      toast.error(err instanceof Error ? err.message : "Failed to confirm completion.")
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancelJob = async () => {
    if (!job) return
    setIsCancelling(true)
    try {
      await apiFetch(`/jobs/${job.id}/cancel`, { method: "PATCH" })
      setJob((prev) => prev ? { ...prev, status: "CANCELLED" } : prev)
      setShowCancelDialog(false)
      toast.success("Job cancelled.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel job.")
    } finally {
      setIsCancelling(false)
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
          <p className="text-muted-foreground">Job not found.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/dashboard/user/jobs">Back to Jobs</Link>
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const artisanName = job.acceptedArtisan
    ? `${job.acceptedArtisan.firstname} ${job.acceptedArtisan.lastname}`.trim()
    : "Awaiting artisan"
  const cfg = statusConfig[job.status] ?? { label: job.status, className: "" }
  // Best-effort UI hint while `completionRequestedAt` isn't in the API
  // response yet (see write-up) — the button is shown for any IN_PROGRESS
  // job and the server's own precondition check is the real gate.
  const canConfirmCompletion = job.status === "IN_PROGRESS"

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/user/jobs">
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Link>
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
            <p className="text-muted-foreground">
              {job.service?.name ?? "Job"} · {new Date(job.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <Badge variant="outline" className={cfg.className}>
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
            {cfg.label}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <Wrench className="h-4 w-4 text-primary" />
                  Job Information
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
                  {(job.budgetMin != null || job.budgetMax != null) && (
                    <div className="rounded-lg border border-border p-4 md:col-span-2">
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="mt-1 font-medium text-foreground">
                        {job.budgetMin != null ? formatCurrency(job.budgetMin) : "—"}
                        {job.budgetMax != null ? ` – ${formatCurrency(job.budgetMax)}` : ""}
                      </p>
                    </div>
                  )}
                  {job.bookingId && (
                    <div className="rounded-lg border border-border bg-primary/5 p-4 md:col-span-2">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Link2 className="h-3.5 w-3.5" />
                        Linked Booking
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="font-medium text-foreground">Booking #{job.bookingId}</p>
                        <Button variant="link" size="sm" className="h-auto p-0" asChild>
                          <Link href={`/dashboard/user/bookings/${job.bookingId}`}>View booking</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {(job.location || job.description) && (
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    Location &amp; Description
                  </h3>
                </div>
                <CardContent className="p-5">
                  {job.location && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <p className="font-medium text-foreground">{job.location}</p>
                    </div>
                  )}
                  {job.description && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Description:</p>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{job.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {job.attachments && job.attachments.length > 0 && (
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="font-semibold text-foreground">Photos</h3>
                </div>
                <CardContent className="p-5">
                  <AttachmentGallery attachments={job.attachments} />
                </CardContent>
              </Card>
            )}

            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Job Timeline
                </h3>
              </div>
              <CardContent className="p-5">
                <JobStatusTimeline history={job.statusHistory} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <UserRound className="h-4 w-4 text-primary" />
                  Assigned Artisan
                </h3>
              </div>
              <CardContent className="p-5">
                {job.acceptedArtisan ? (
                  <>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={resolveAvatarUrl(job.acceptedArtisan.profilePicture, artisanName)} />
                        <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold text-foreground">{artisanName}</h4>
                        <div className="mt-1 flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-rating text-rating" />
                          <span className="text-sm font-medium">—</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" className="flex-1 bg-transparent" size="sm" asChild>
                        {/* MC2 — `&job=` rides along so the message carries a
                            reference to this job (feeds AD1's evidence view). */}
                        <Link href={`/dashboard/user/messages?artisan=${job.acceptedArtisan.id}&job=${job.id}`}>
                          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                          Chat
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No artisan assigned yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Payment status card (3.1) — reuses the same Card/CardContent/Badge
                block already used for "Assigned Artisan" directly above. */}
            {!isPaymentLoading && (
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Payment
                  </h3>
                </div>
                <CardContent className="p-5">
                  {!payment ? (
                    <p className="text-sm text-muted-foreground">
                      No payment due yet — this shows up once an artisan accepts the job.
                    </p>
                  ) : payment.status === "PENDING" ? (
                    <div className="space-y-3">
                      <p className="text-xl font-bold text-foreground">{formatCurrency(payment.amount)}</p>
                      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                        <Link href={`/dashboard/user/jobs/${job.id}/pay`}>Pay Now</Link>
                      </Button>
                    </div>
                  ) : payment.status === "HELD" || (RETRYABLE_PAYOUT_STATUSES as readonly string[]).includes(payment.status) ? (
                    // C3: PENDING_TRANSFER and TRANSFER_FAILED are both
                    // artisan-payout-side states — shown identically to HELD
                    // here, never as unpaid or a problem on the customer's
                    // side (matches the artisan job-detail and earnings pages).
                    <div className="space-y-2">
                      <p className="text-xl font-bold text-foreground">{formatCurrency(payment.amount)}</p>
                      <Badge variant="outline" className={getPaymentStatusConfig("HELD").className}>
                        {getPaymentStatusConfig("HELD").label}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Released to the artisan once you confirm completion.
                      </p>
                    </div>
                  ) : payment.status === "RELEASED" ? (
                    <div className="space-y-2">
                      <p className="text-xl font-bold text-foreground">{formatCurrency(payment.amount)}</p>
                      <Badge variant="outline" className={getPaymentStatusConfig(payment.status).className}>
                        {getPaymentStatusConfig(payment.status).label}
                      </Badge>
                      {payment.releasedAt && (
                        <p className="text-xs text-muted-foreground">
                          Paid on {new Date(payment.releasedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xl font-bold text-foreground">{formatCurrency(payment.amount)}</p>
                      <Badge variant="outline" className={getPaymentStatusConfig(payment.status).className}>
                        {getPaymentStatusConfig(payment.status).label}
                      </Badge>
                      {payment.status === "REFUNDED" && (
                        <p className="text-xs text-muted-foreground">This payment was refunded.</p>
                      )}
                      {payment.status === "CANCELLED" && (
                        <p className="text-xs text-muted-foreground">This payment was cancelled.</p>
                      )}
                      {payment.status === "FAILED" && (
                        <p className="text-xs text-muted-foreground">The last payment attempt didn&apos;t complete.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="space-y-2 p-5">
                {canConfirmCompletion && (
                  <Button
                    className="w-full bg-success text-success-foreground hover:bg-success/90"
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
                {/* DP1: last in the constructive group. Disputes are
                    booking-scoped on the backend, so this needs the job's
                    linked booking — the component states plainly when a job
                    doesn't have one rather than offering an action the server
                    would reject. */}
                <DisputeEntryPoint
                  bookingId={job.bookingId}
                  isEligible={(DISPUTABLE_BOOKING_STATUSES as readonly string[]).includes(job.status)}
                  ineligibleReason="You can report a problem once the job is completed or cancelled."
                  contextTitle={job.title}
                  counterpartyName={artisanName}
                  counterpartyRole="Artisan"
                  counterpartyAvatar={job.acceptedArtisan?.profilePicture}
                  amount={payment?.amount}
                  paymentStatus={payment?.status}
                  disputeHrefBase="/dashboard/user/disputes"
                />
                {(job.status === "OPEN" || job.status === "PENDING") && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancel Job
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
            <AlertDialogTitle>Cancel Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel &ldquo;{job.title}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>No, Keep Job</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelJob}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isCancelling}
            >
              {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Cancel Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
