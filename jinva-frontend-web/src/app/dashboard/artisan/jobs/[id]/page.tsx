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
  PlayCircle,
  FileText,
  Link2,
  CreditCard,
  RotateCcw,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { naviiAvatar, formatCurrency } from "@/lib/utils"
import { JobStatusTimeline, type JobStatusHistoryEntry } from "@/components/dashboard/job-status-timeline"
import { AttachmentGallery, type JobAttachment } from "@/components/dashboard/attachment-gallery"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { getPaymentStatusConfig, RETRYABLE_PAYOUT_STATUSES } from "@/lib/status-badges"
import { DISPUTABLE_BOOKING_STATUSES } from "@/lib/disputes"
import { DisputeEntryPoint } from "@/components/disputes/dispute-entry-point"

// 3.2: no GET /payments/for-job/:jobId exists — match this job's own payout
// row out of the artisan's own GET /payments/my-earnings list, the same
// approach the customer-side job detail page uses against its own history.
interface EarningRow {
  jobId: number
  artisanAmount: number
  status: string
}

interface BackendJob {
  id: string | number
  title: string
  description?: string
  location?: string
  status: string
  createdAt: string
  budgetMin?: number
  budgetMax?: number
  bookingId?: number
  customer?: {
    id: string
    firstname: string
    lastname: string
    profilePicture?: string
    email?: string
    phoneNumber?: string
  }
  // Not yet exposed by GET /jobs/:id (see write-up) — optional-chained
  // throughout; ownership gating below falls back to "assume mine, let the
  // server enforce" until the backend adds this field.
  acceptedArtisan?: { id: string }
  // NOTE: also not currently exposed by GET /jobs/:id — JobResponseDto
  // (JIN_VA-BACKEND/src/jobs/dto/job-response.dto.ts) has no `@Expose()`
  // for this field, so it's always undefined today despite being on the
  // Job entity. Read defensively so the "waiting on customer" state below
  // activates automatically once the backend adds it; flagged to the
  // backend engineer in qa-report.md.
  completionRequestedAt?: string
  service?: { id: string; name: string }
  statusHistory?: JobStatusHistoryEntry[]
  attachments?: JobAttachment[]
}

const statusConfig = {
  IN_PROGRESS: { label: "In Progress", className: "bg-muted text-muted-foreground border-muted", icon: Timer },
  COMPLETED:   { label: "Completed",   className: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  CANCELLED:   { label: "Cancelled",   className: "bg-red-100 text-red-700 border-red-200",     icon: XCircle },
  PENDING:     { label: "Pending",     className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
  OPEN:        { label: "Open",        className: "bg-blue-100 text-blue-700 border-blue-200",   icon: CheckCircle2 },
  EXPIRED:     { label: "Expired",     className: "bg-gray-100 text-gray-600 border-gray-200",   icon: AlertCircle },
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
  const [isStartingJob, setIsStartingJob] = useState(false)
  const [payment, setPayment] = useState<EarningRow | null>(null)
  const [hasPayoutMethod, setHasPayoutMethod] = useState<boolean | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    if (!id) return
    apiFetch<BackendJob>(`/jobs/${id}`)
      .then((data) => setJob(data))
      .catch(() => setError("Could not load job details."))
      .finally(() => setIsLoading(false))
  }, [id])

  const loadPayment = () => {
    if (!id) return
    apiFetch<EarningRow[]>("/payments/my-earnings")
      .then((rows) => setPayment(rows.find((r) => Number(r.jobId) === Number(id)) ?? null))
      .catch(() => setPayment(null))
  }

  useEffect(() => {
    loadPayment()
    apiFetch<{ payoutType?: string }>("/users/me/artisan-profile")
      .then((p) => setHasPayoutMethod(!!p.payoutType))
      .catch(() => setHasPayoutMethod(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleRetryTransfer = async () => {
    if (!job) return
    setIsRetrying(true)
    try {
      await apiFetch(`/payments/retry-transfer/${job.id}`, { method: "POST" })
      toast.success("Transfer retry initiated.")
      loadPayment()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed — the payout is still blocked.")
    } finally {
      setIsRetrying(false)
    }
  }

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
      setJob((prev) => prev ? { ...prev, status: "IN_PROGRESS", completionRequestedAt: new Date().toISOString() } : prev)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request completion.")
    } finally {
      setIsRequestingCompletion(false)
    }
  }

  // J1: works identically regardless of whether the job arrived via the
  // open-posting apply/accept flow or the new R2 booking-linkage flow — no
  // special-casing on job.bookingId, matching J1's edge case.
  const handleStartJob = async () => {
    if (!job) return
    setIsStartingJob(true)
    try {
      await apiFetch(`/jobs/${job.id}/start`, { method: "PATCH" })
      toast.success("Job started.")
      setJob((prev) => prev ? { ...prev, status: "IN_PROGRESS" } : prev)
    } catch (err) {
      // The backend's existing state/ownership guards already produce a
      // specific message ("Only PENDING jobs can be started...", "Only the
      // accepted artisan can perform this action...") — surfaced verbatim
      // rather than implying something broke (J1 edge cases: double-click,
      // a race with the customer cancelling first, etc. all land here).
      toast.error(err instanceof Error ? err.message : "Failed to start job.")
    } finally {
      setIsStartingJob(false)
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
  // GET /jobs/:id does not yet expose `acceptedArtisan` (see write-up) — when
  // present, gate strictly on it; until then, fall back to "assume mine" so
  // Start Job / Request Completion aren't permanently hidden for everyone,
  // and let the backend's own ownership guard (403) be the real gate.
  const isMyJob = job.acceptedArtisan ? String(job.acceptedArtisan.id) === String(user?.id) : true

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
                  {(job.budgetMin != null || job.budgetMax != null) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4 shrink-0 text-primary/60" />
                      <span>
                        Budget: {job.budgetMin != null ? formatCurrency(job.budgetMin) : "—"}
                        {job.budgetMax != null ? ` – ${formatCurrency(job.budgetMax)}` : ""}
                      </span>
                    </div>
                  )}
                  {job.bookingId && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Link2 className="h-4 w-4 shrink-0 text-primary/60" />
                      <Link href={`/dashboard/artisan/calendar`} className="underline-offset-2 hover:underline">
                        From booking #{job.bookingId}
                      </Link>
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

                {/* Photos (J4) */}
                {job.attachments && job.attachments.length > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Photos</h3>
                    <AttachmentGallery attachments={job.attachments} />
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
                  {isMyJob && job.status === "PENDING" && (
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={handleStartJob}
                      disabled={isStartingJob}
                    >
                      {isStartingJob ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      )}
                      Start Job
                    </Button>
                  )}
                  {isMyJob && job.status === "IN_PROGRESS" && !job.completionRequestedAt && (
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
                  {isMyJob && job.status === "IN_PROGRESS" && job.completionRequestedAt && (
                    <Button variant="outline" className="cursor-default bg-transparent" disabled>
                      <Timer className="mr-2 h-4 w-4" />
                      Waiting on customer confirmation
                    </Button>
                  )}
                  {job.customer && (
                    <Button variant="outline" className="bg-transparent" asChild>
                      {/* MC2 — `&job=` rides along so the message carries a
                          reference to this job (feeds AD1's evidence view). */}
                      <Link href={`/dashboard/artisan/messages?client=${job.customer.id}&job=${job.id}`}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Contact Client
                      </Link>
                    </Button>
                  )}
                  {/* DP1: the backend already allows either party to file, so
                      this must not be customer-only. Disputes are
                      booking-scoped, so it needs the job's linked booking. */}
                  {isMyJob && (
                    <DisputeEntryPoint
                      className="w-full sm:w-auto sm:min-w-[220px]"
                      bookingId={job.bookingId}
                      isEligible={(DISPUTABLE_BOOKING_STATUSES as readonly string[]).includes(job.status)}
                      ineligibleReason="You can report a problem once the job is completed or cancelled."
                      contextTitle={job.title}
                      counterpartyName={clientName}
                      counterpartyRole="Client"
                      counterpartyAvatar={job.customer?.profilePicture}
                      amount={payment?.artisanAmount}
                      paymentStatus={payment?.status}
                      disputeHrefBase="/dashboard/artisan/disputes"
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* J3: real, chronological status-history timeline */}
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Job Timeline
                </h3>
                <JobStatusTimeline history={job.statusHistory} />
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

            {/* 3.2: payment card, artisan-facing copy */}
            {payment && (
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Payment
                  </h3>
                </div>
                <CardContent className="space-y-3 p-5">
                  {payment.status === "HELD" ? (
                    <>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(payment.artisanAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Customer has paid — funds release when the job is complete.
                      </p>
                    </>
                  ) : (RETRYABLE_PAYOUT_STATUSES as readonly string[]).includes(payment.status) ? (
                    <Alert variant="destructive" className="p-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-xs">
                        {payment.status === "TRANSFER_FAILED"
                          ? "Transfer failed"
                          : hasPayoutMethod === false
                            ? "Payout needs a method on file"
                            : "Payout blocked — retry needed"}
                      </AlertTitle>
                      <AlertDescription>
                        <p className="text-xs">
                          {formatCurrency(payment.artisanAmount)} is ready but couldn&apos;t reach your account.
                        </p>
                        {hasPayoutMethod === false ? (
                          <Button size="sm" variant="outline" className="mt-2 h-7 bg-transparent px-2 text-xs" asChild>
                            <Link href="/dashboard/artisan/settings">Add Payout Method</Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 bg-transparent px-2 text-xs"
                            disabled={isRetrying}
                            onClick={handleRetryTransfer}
                          >
                            {isRetrying ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
                            Retry Transfer
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : payment.status === "RELEASED" ? (
                    <>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(payment.artisanAmount)}</p>
                      <p className="text-xs text-muted-foreground">Paid out to your account.</p>
                    </>
                  ) : (
                    <Badge variant="outline" className={getPaymentStatusConfig(payment.status).className}>
                      {getPaymentStatusConfig(payment.status).label}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
