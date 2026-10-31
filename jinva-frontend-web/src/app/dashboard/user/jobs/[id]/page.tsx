"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  CircleDot,
  Hash,
  Hourglass,
  Loader2,
  MapPin,
  MessageSquare,
  Pencil,
  PlayCircle,
  Star,
  Tag,
  Timer,
  Wallet,
  Wrench,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card } from "@/components/ui/card"
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
import { apiFetch } from "@/lib/api"
import { formatDay, initialsOf } from "@/lib/artisan-jobs"
import { cn, formatCurrency, resolveAvatarUrl } from "@/lib/utils"
import { JobStatusTimeline, type JobStatusHistoryEntry } from "@/components/dashboard/job-status-timeline"
import { AttachmentGallery, type JobAttachment } from "@/components/dashboard/attachment-gallery"
import { EditJobDialog } from "@/components/dashboard/edit-job-dialog"
import { getPaymentStatusConfig, RETRYABLE_PAYOUT_STATUSES } from "@/lib/status-badges"
import { DISPUTABLE_BOOKING_STATUSES } from "@/lib/disputes"
import { DisputeEntryPoint } from "@/components/disputes/dispute-entry-point"
import { JobApplicationsCard } from "@/components/dashboard/job-applications-card"

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
  /** QA PAY-01: the history returns `job.id`; `jobId` is only on newer backends. */
  jobId?: number
  job?: { id: number; title?: string | null }
  amount: number
  status: string
  paidAt?: string
  releasedAt?: string
}

type BadgeKey = "OPEN" | "PENDING" | "IN_PROGRESS" | "TO_CONFIRM" | "COMPLETED" | "CANCELLED" | "EXPIRED"

/** The same badges as My Jobs: an icon as well as a colour, so status never reads by colour alone. */
const STATUS_BADGES: Record<BadgeKey, { label: string; className: string; icon: typeof CircleDot }> = {
  OPEN: { label: "Open", className: "bg-info/10 text-info border-info/20", icon: CircleDot },
  PENDING: { label: "Awaiting start", className: "bg-warning/10 text-warning border-warning/25", icon: PlayCircle },
  IN_PROGRESS: { label: "In progress", className: "bg-primary/10 text-primary border-primary/20", icon: Timer },
  TO_CONFIRM: { label: "Ready to confirm", className: "bg-warning/10 text-warning border-warning/25", icon: Hourglass },
  COMPLETED: { label: "Completed", className: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  EXPIRED: { label: "Expired", className: "bg-muted text-muted-foreground border-border", icon: CalendarX },
}

function badgeFor(job: BackendJob) {
  if (job.status === "IN_PROGRESS" && job.completionRequestedAt) return STATUS_BADGES.TO_CONFIRM
  return STATUS_BADGES[job.status as BadgeKey] ?? { label: job.status, className: "", icon: CircleDot }
}

const BACK = (
  <Button variant="ghost" asChild className="-ml-2 h-11 w-fit gap-2 text-muted-foreground hover:text-foreground sm:h-9">
    <Link href="/dashboard/user/jobs">
      <ArrowLeft aria-hidden className="h-4 w-4" />
      Back to jobs
    </Link>
  </Button>
)

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<BackendJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [payment, setPayment] = useState<BackendPayment | null>(null)
  const [isPaymentLoading, setIsPaymentLoading] = useState(true)
  // Bumped after accepting an application so the job and its new payment reload.
  const [reloadKey, setReloadKey] = useState(0)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    apiFetch<BackendJob>(`/jobs/${id}`)
      .then(setJob)
      .catch(() => toast.error("Failed to load job details."))
      .finally(() => setIsLoading(false))
  }, [id, reloadKey])

  useEffect(() => {
    apiFetch<BackendPayment[]>("/payments/history")
      .then((history) => setPayment(history.find((p) => Number(p.jobId ?? p.job?.id) === Number(id)) ?? null))
      .catch(() => setPayment(null))
      .finally(() => setIsPaymentLoading(false))
  }, [id, reloadKey])

  const handleConfirmCompletion = async () => {
    if (!job) return
    setIsConfirming(true)
    try {
      await apiFetch(`/jobs/${job.id}/confirm`, { method: "POST" })
      setJob((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev))
      toast.success("Job marked as completed.")
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
      setJob((prev) => (prev ? { ...prev, status: "CANCELLED" } : prev))
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
        <div className="space-y-6" aria-busy>
          {BACK}
          <div className="space-y-3">
            <div className="h-5 w-24 rounded-md bg-muted motion-safe:animate-pulse" />
            <div className="h-8 w-2/3 rounded-md bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-1/3 rounded-md bg-muted motion-safe:animate-pulse" />
          </div>
          <div className="h-64 rounded-xl border bg-card" />
        </div>
      </DashboardLayout>
    )
  }

  if (!job) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {BACK}
          <Card className="items-center gap-0 px-4 py-16 text-center">
            <h1 className="text-lg font-semibold text-foreground">This job isn&apos;t available</h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              It may have been removed, or the connection dropped. Go back to your jobs and try again.
            </p>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  const artisan = job.acceptedArtisan
  const artisanName = artisan ? `${artisan.firstname} ${artisan.lastname}`.trim() || "Your artisan" : "the artisan"
  const badge = badgeFor(job)
  const BadgeIcon = badge.icon
  // QA JOB-14: the API returns `completionRequestedAt` now, so the button
  // appears only once the artisan has said the work is finished (the server
  // refuses a confirmation before that).
  const canConfirmCompletion = job.status === "IN_PROGRESS" && !!job.completionRequestedAt
  const awaitingArtisanFinish = job.status === "IN_PROGRESS" && !job.completionRequestedAt
  const canCancel = job.status === "OPEN" || job.status === "PENDING"
  const hasBudget = job.budgetMin != null || job.budgetMax != null

  const timeline = (
    <Card className="gap-0 py-0">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-foreground">Job timeline</h2>
      </div>
      <div className="px-5 py-5">
        <JobStatusTimeline
          history={job.statusHistory}
          artisan={job.acceptedArtisan}
          createdAt={job.createdAt}
          completionRequestedAt={job.completionRequestedAt}
        />
      </div>
    </Card>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {BACK}

        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <Badge variant="outline" className={cn("w-fit gap-1 text-xs", badge.className)}>
              <BadgeIcon aria-hidden className="h-3 w-3" />
              {badge.label}
            </Badge>
            <h1 dir="auto" className="break-words text-2xl font-bold text-foreground [unicode-bidi:isolate] sm:text-3xl">
              {job.title}
            </h1>
            <p className="text-muted-foreground">
              {job.service?.name ? `${job.service.name}, posted ` : "Posted "}
              {formatDay(job.createdAt)}
            </p>
          </div>
          {/* QA JOB-16: editable only while open (the server enforces it too). */}
          {job.status === "OPEN" && (
            <Button variant="outline" className="h-11 w-fit shrink-0 gap-1.5 bg-transparent sm:h-9" onClick={() => setIsEditing(true)}>
              <Pencil aria-hidden className="h-3.5 w-3.5" />
              Edit job
            </Button>
          )}
        </header>

        {/* What the client can do next, or what they are waiting for. */}
        {(canConfirmCompletion || awaitingArtisanFinish || job.status === "COMPLETED") && (
          <section
            aria-label="Next step"
            className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            {canConfirmCompletion && (
              <>
                <StepText
                  icon={<CheckCircle2 aria-hidden className="h-5 w-5 text-primary" />}
                  title="Ready to confirm"
                  body={`${artisan ? artisanName : "The artisan"} says the work is done. Confirm it and your payment is released to them.`}
                />
                <Button
                  className="h-11 shrink-0 bg-success text-success-foreground hover:bg-success/90 sm:h-10"
                  onClick={() => void handleConfirmCompletion()}
                  disabled={isConfirming}
                >
                  {isConfirming && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                  Confirm completion
                </Button>
              </>
            )}
            {awaitingArtisanFinish && (
              <StepText
                icon={<Hourglass aria-hidden className="h-5 w-5 text-warning" />}
                title="Work in progress"
                body={`You can confirm completion once ${artisanName} marks the job as finished.`}
              />
            )}
            {job.status === "COMPLETED" && (
              <>
                <StepText
                  icon={<Star aria-hidden className="h-5 w-5 text-rating" />}
                  title="Job done"
                  body="Tell other clients how it went."
                />
                <Button className="h-11 shrink-0 sm:h-10" asChild>
                  <Link href={`/dashboard/user/review/${job.id}`}>Leave a review</Link>
                </Button>
              </>
            )}
          </section>
        )}

        {/* Phones read Details, Applications, Artisan, Payment, then the timeline; wide screens keep the rail beside both. */}
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <Card className="gap-0 py-0">
              <div className="border-b px-5 py-4">
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <Wrench aria-hidden className="h-4 w-4 text-primary" />
                  Job information
                </h2>
              </div>
              <div className="space-y-5 px-5 py-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  {job.location && (
                    <Fact icon={<MapPin aria-hidden className="h-4 w-4" />} term="Location" wide>
                      <span className="break-words">{job.location}</span>
                    </Fact>
                  )}
                  {job.service && (
                    <Fact icon={<Tag aria-hidden className="h-4 w-4" />} term="Service">
                      {job.service.name}
                    </Fact>
                  )}
                  {hasBudget && (
                    <Fact icon={<Wallet aria-hidden className="h-4 w-4" />} term="Budget">
                      <span className="tabular-nums">
                        {job.budgetMin != null ? formatCurrency(job.budgetMin) : "—"}
                        {job.budgetMax != null ? ` – ${formatCurrency(job.budgetMax)}` : ""}
                      </span>
                    </Fact>
                  )}
                  <Fact icon={<CalendarDays aria-hidden className="h-4 w-4" />} term="Posted">
                    {formatDay(job.createdAt)}
                  </Fact>
                  <Fact icon={<Hash aria-hidden className="h-4 w-4" />} term="Job number">
                    <span>
                      <span className="tabular-nums">{String(job.id)}</span>
                      {job.bookingId ? <span className="text-muted-foreground"> from booking {job.bookingId}</span> : null}
                    </span>
                    {job.bookingId && (
                      <Link
                        href={`/dashboard/user/bookings/${job.bookingId}`}
                        className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0"
                      >
                        View booking
                      </Link>
                    )}
                  </Fact>
                </dl>

                {job.description && (
                  <div>
                    <h3 className="mb-1.5 text-sm font-semibold text-foreground">Description</h3>
                    <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                      {job.description}
                    </p>
                  </div>
                )}

                {job.attachments && job.attachments.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Photos</h3>
                    <AttachmentGallery attachments={job.attachments} />
                  </div>
                )}
              </div>
            </Card>
            <div className="hidden lg:block">{timeline}</div>
          </div>

          <div className="min-w-0 space-y-6">
            {job.status === "OPEN" && (
              <JobApplicationsCard jobId={job.id} onAccepted={() => setReloadKey((k) => k + 1)} />
            )}

            <Card className="gap-0 py-0">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold text-foreground">Assigned artisan</h2>
              </div>
              <div className="space-y-4 px-5 py-5">
                {artisan ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarImage src={resolveAvatarUrl(artisan.profilePicture)} alt="" />
                        <AvatarFallback className="text-sm font-medium text-foreground/80">
                          {initialsOf(artisanName) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <p dir="auto" className="min-w-0 truncate font-medium text-foreground [unicode-bidi:isolate]">
                        {artisanName}
                      </p>
                    </div>
                    <Button variant="outline" className="h-11 w-full bg-transparent sm:h-10" asChild>
                      {/* MC2 — `&job=` rides along so the message carries a
                          reference to this job (feeds AD1's evidence view). */}
                      <Link href={`/dashboard/user/messages?artisan=${artisan.id}&job=${job.id}`}>
                        <MessageSquare aria-hidden className="h-4 w-4" />
                        Message artisan
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {job.status === "OPEN" ? "No artisan yet. Choose one from the applications." : "No artisan assigned."}
                  </p>
                )}
              </div>
            </Card>

            {!isPaymentLoading && (
              <Card className="gap-0 py-0">
                <div className="border-b px-5 py-4">
                  <h2 className="font-semibold text-foreground">Payment</h2>
                </div>
                <div className="px-5 py-5">
                  {!payment ? (
                    <p className="text-sm text-muted-foreground">
                      No payment due yet. It shows up here once an artisan accepts the job.
                    </p>
                  ) : payment.status === "PENDING" ? (
                    <div className="space-y-3">
                      <p className="tnum text-xl font-bold tabular-nums text-foreground">{formatCurrency(payment.amount)}</p>
                      <Button className="h-11 w-full sm:h-10" asChild>
                        <Link href={`/dashboard/user/jobs/${job.id}/pay`}>Pay now</Link>
                      </Button>
                    </div>
                  ) : payment.status === "HELD" || (RETRYABLE_PAYOUT_STATUSES as readonly string[]).includes(payment.status) ? (
                    // C3: PENDING_TRANSFER and TRANSFER_FAILED are both
                    // artisan-payout-side states — shown identically to HELD
                    // here, never as unpaid or a problem on the customer's
                    // side (matches the artisan job-detail and earnings pages).
                    <div className="space-y-2">
                      <p className="tnum text-xl font-bold tabular-nums text-foreground">{formatCurrency(payment.amount)}</p>
                      <Badge variant="outline" className={getPaymentStatusConfig("HELD").className}>
                        {getPaymentStatusConfig("HELD").label}
                      </Badge>
                      <p className="text-xs text-muted-foreground">Released to the artisan once you confirm completion.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="tnum text-xl font-bold tabular-nums text-foreground">{formatCurrency(payment.amount)}</p>
                      <Badge variant="outline" className={getPaymentStatusConfig(payment.status).className}>
                        {getPaymentStatusConfig(payment.status).label}
                      </Badge>
                      {payment.status === "RELEASED" && payment.releasedAt && (
                        <p className="text-xs text-muted-foreground">Paid on {formatDay(payment.releasedAt)}</p>
                      )}
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
                </div>
              </Card>
            )}

            <div className="space-y-3">
              {/* DP1: disputes are booking-scoped on the backend, so this
                  needs the job's linked booking — the component states
                  plainly when a job doesn't have one rather than offering an
                  action the server would reject. */}
              <DisputeEntryPoint
                bookingId={job.bookingId}
                isEligible={(DISPUTABLE_BOOKING_STATUSES as readonly string[]).includes(job.status)}
                ineligibleReason="You can report a problem once the job is completed or cancelled."
                contextTitle={job.title}
                counterpartyName={artisan ? artisanName : "Awaiting artisan"}
                counterpartyRole="Artisan"
                counterpartyAvatar={artisan?.profilePicture}
                amount={payment?.amount}
                paymentStatus={payment?.status}
                disputeHrefBase="/dashboard/user/disputes"
              />
              {canCancel && (
                <Button
                  variant="outline"
                  className="h-11 w-full border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9"
                  onClick={() => setShowCancelDialog(true)}
                >
                  Cancel job
                </Button>
              )}
            </div>
          </div>

          {/* Phones: the timeline comes last, after the artisan and payment. */}
          <div className="min-w-0 lg:hidden">{timeline}</div>
        </div>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this job?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{job.title}&rdquo; will be cancelled. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9" disabled={isCancelling}>
              Keep job
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelJob}
              className="h-11 bg-destructive text-white hover:bg-destructive/90 sm:h-9"
              disabled={isCancelling}
            >
              {isCancelling && <Loader2 aria-hidden className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
              Cancel job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EditJobDialog job={job} open={isEditing} onOpenChange={setIsEditing} onSaved={() => setReloadKey((k) => k + 1)} />
    </DashboardLayout>
  )
}

function StepText({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

function Fact({
  icon,
  term,
  wide = false,
  children,
}: {
  icon: React.ReactNode
  term: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 gap-3", wide && "sm:col-span-2")}>
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{term}</dt>
        <dd className="mt-0.5 flex flex-col items-start text-sm text-foreground">{children}</dd>
      </div>
    </div>
  )
}
