"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Hash,
  Hourglass,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  PlayCircle,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard/layout"
import { ApplyJobDialog } from "@/components/dashboard/apply-job-dialog"
import { AttachmentGallery, type JobAttachment } from "@/components/dashboard/attachment-gallery"
import { DisputeEntryPoint } from "@/components/disputes/dispute-entry-point"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { ApiError, apiFetch } from "@/lib/api"
import {
  PAYOUT_SETTINGS_HREF,
  artisanJobStatus,
  directionsUrl,
  formatClock,
  formatDay,
  formatDayTime,
  formatDayWithWeekday,
  initialsOf,
  isMyJob,
  jobStatusName,
  personName,
  type ArtisanJob,
  type ArtisanJobStatusKey,
} from "@/lib/artisan-jobs"
import { DISPUTABLE_BOOKING_STATUSES } from "@/lib/disputes"
import { cn, formatCurrency } from "@/lib/utils"

interface StatusHistoryEntry {
  id: number
  fromStatus?: string | null
  toStatus: string
  changedBy: string
  reason?: string | null
  createdAt: string
}

interface JobDetail extends ArtisanJob {
  statusHistory?: StatusHistoryEntry[]
  attachments?: JobAttachment[]
}

interface BookingDetail {
  id: number
  scheduledDate?: string | null
  startTime?: string | null
  endTime?: string | null
  agreedPrice?: string | number | null
}

type PaymentStage = "awaiting_payment" | "held" | "on_the_way" | "needs_action" | "paid" | "refunded" | "not_paid"

/** One row of `GET /payments/my-earnings/statement` (api-contract.md B2). */
interface StatementItem {
  jobId: number | null
  gross: string
  fee: string
  net: string
  refunded: string
  payout: string | null
  stage: PaymentStage
  transferReference: string | null
  failureReason: "no_payout_method" | "transfer_failed" | null
  paidAt: string | null
  releasedAt: string | null
}

interface PayoutDestination {
  label: string
  last4: string
}

const STATUS_COPY: Record<ArtisanJobStatusKey, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-info/10 text-info border-info/20" },
  applied: { label: "Applied", className: "bg-info/10 text-info border-info/20" },
  to_start: { label: "To start", className: "bg-warning/10 text-warning border-warning/25" },
  in_progress: { label: "In progress", className: "bg-primary/10 text-primary border-primary/20" },
  waiting_on_client: { label: "Waiting on client", className: "bg-warning/10 text-warning border-warning/25" },
  done: { label: "Done", className: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground border-border" },
  other_artisan: { label: "Went to another artisan", className: "bg-muted text-muted-foreground border-border" },
}

/** This job's row of the earnings statement, if it has a payment. */
async function findStatementItem(jobId: number): Promise<StatementItem | null> {
  const data = await apiFetch<{ items?: StatementItem[] }>(
    `/payments/my-earnings/statement?period=all&jobId=${jobId}&limit=1`,
  )
  return data.items?.[0] ?? null
}

const BACK = (
  <Button variant="ghost" asChild className="-ml-2 h-11 gap-2 text-muted-foreground hover:text-foreground sm:h-9">
    <Link href="/dashboard/artisan/jobs">
      <ArrowLeft aria-hidden className="h-4 w-4" />
      Back to My Jobs
    </Link>
  </Button>
)

export default function ArtisanJobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [job, setJob] = useState<JobDetail | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading")
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [payment, setPayment] = useState<StatementItem | null>(null)
  const [paymentState, setPaymentState] = useState<"loading" | "ready" | "error">("loading")
  const [destination, setDestination] = useState<PayoutDestination | null>(null)
  const [hasDispute, setHasDispute] = useState(false)

  const [applyOpen, setApplyOpen] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  const loadJob = useCallback(() => {
    if (!id) return
    setState("loading")
    apiFetch<JobDetail>(`/jobs/${encodeURIComponent(id)}`)
      .then((data) => {
        setJob(data)
        setState("ready")
      })
      .catch((err) => setState(err instanceof ApiError && (err.status === 404 || err.status === 403) ? "missing" : "error"))
  }, [id])

  useEffect(() => {
    loadJob()
  }, [loadJob])

  const mine = job ? isMyJob(job, user?.id) : false
  const jobId = job ? Number(job.id) : NaN

  const loadPayment = useCallback(() => {
    if (!Number.isFinite(jobId)) return
    setPaymentState("loading")
    findStatementItem(jobId)
      .then((item) => {
        setPayment(item)
        setPaymentState("ready")
      })
      .catch(() => setPaymentState("error"))
  }, [jobId])

  // Money, booking and dispute details only exist for a job that is mine.
  const bookingId = job?.bookingId ?? null
  useEffect(() => {
    if (!Number.isFinite(jobId) || !mine) {
      setPaymentState("ready")
      return
    }
    loadPayment()
    if (bookingId) {
      apiFetch<BookingDetail>(`/bookings/${bookingId}`)
        .then(setBooking)
        .catch(() => setBooking(null))
    }
    apiFetch<{ payoutDestination?: PayoutDestination | null }>("/users/me/artisan-profile")
      .then((p) => setDestination(p.payoutDestination ?? null))
      .catch(() => setDestination(null))
    apiFetch<{ jobId?: number | null }[]>("/disputes/my")
      .then((list) => setHasDispute(Array.isArray(list) && list.some((d) => Number(d.jobId) === jobId)))
      .catch(() => setHasDispute(false))
  }, [jobId, bookingId, mine, loadPayment])

  const handleStart = async () => {
    if (!job) return
    setIsStarting(true)
    try {
      await apiFetch(`/jobs/${job.id}/start`, { method: "PATCH" })
      toast.success("Job started.")
      setJob((prev) => (prev ? { ...prev, status: "IN_PROGRESS" } : prev))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the job. Try again.")
    } finally {
      setIsStarting(false)
    }
  }

  const handleRequestCompletion = async () => {
    if (!job) return
    setIsRequesting(true)
    try {
      await apiFetch(`/jobs/${job.id}/request-completion`, { method: "PATCH" })
      toast.success("Completion requested. The client has been asked to confirm.")
      setJob((prev) => (prev ? { ...prev, completionRequestedAt: new Date().toISOString() } : prev))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't request completion. Try again.")
    } finally {
      setIsRequesting(false)
    }
  }

  const handleRetry = async () => {
    if (!job) return
    setIsRetrying(true)
    try {
      await apiFetch(`/payments/retry-transfer/${job.id}`, { method: "POST" })
      toast.success("Transfer sent again.")
      loadPayment()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The transfer didn't go through. Try again later.")
    } finally {
      setIsRetrying(false)
    }
  }

  if (state === "loading") {
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

  if (state !== "ready" || !job) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {BACK}
          <Card className="items-center gap-0 px-4 py-16 text-center">
            <h1 className="text-lg font-semibold text-foreground">
              {state === "missing" ? "This job isn't available" : "Couldn't load this job"}
            </h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {state === "missing"
                ? "It may have been removed, or it isn't open to you."
                : "Check your connection, then try again."}
            </p>
            {state === "error" && (
              <Button variant="outline" className="mt-5 h-11 bg-transparent sm:h-9" onClick={loadJob}>
                Try again
              </Button>
            )}
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  const clientName = personName(job.customer)
  const statusKey = artisanJobStatus(job, user?.id)
  const status = STATUS_COPY[statusKey]
  const directions = directionsUrl(job)
  const disputeEligible = (DISPUTABLE_BOOKING_STATUSES as readonly string[]).includes(job.status)
  const showReport = mine && Boolean(job.bookingId) && (disputeEligible || hasDispute)
  const canStart = mine && job.status === "PENDING"
  const canRequest = mine && job.status === "IN_PROGRESS" && !job.completionRequestedAt
  const waiting = mine && job.status === "IN_PROGRESS" && Boolean(job.completionRequestedAt)
  const bookedFor =
    booking?.scheduledDate
      ? `${formatDayWithWeekday(booking.scheduledDate)}${
          booking.startTime ? `, ${formatClock(booking.startTime)}${booking.endTime ? `–${formatClock(booking.endTime)}` : ""}` : ""
        }`
      : null

  const timeline = (
    <Card className="gap-0 py-0">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-foreground">Timeline</h2>
      </div>
      <div className="px-5 py-5">
        <Timeline job={job} userId={user?.id} clientName={clientName} />
      </div>
    </Card>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {BACK}

        <header className="space-y-2">
          <Badge variant="outline" className={cn("w-fit text-xs", status.className)}>
            {status.label}
          </Badge>
          <h1 dir="auto" className="text-2xl font-bold text-foreground [unicode-bidi:isolate] sm:text-3xl">
            {job.title}
          </h1>
          <p className="text-muted-foreground">
            For {clientName}
            {job.service?.name ? `, ${job.service.name}` : ""}
          </p>
        </header>

        {/* What the artisan can do next, or what they are waiting for. */}
        {(job.status === "OPEN" || canStart || canRequest || waiting) && (
          <NextStep>
            {job.status === "OPEN" &&
              (job.hasApplied ? (
                <StepText
                  icon={<CheckCircle2 aria-hidden className="h-5 w-5 text-success" />}
                  title="You have applied"
                  body="The client will see your price and message. If they choose you, the job moves to To start."
                />
              ) : (
                <>
                  <StepText
                    icon={<PlayCircle aria-hidden className="h-5 w-5 text-primary" />}
                    title="Open for applications"
                    body="Tell the client your price and when you can do the work."
                  />
                  <Button className="h-11 shrink-0 sm:h-10" onClick={() => setApplyOpen(true)}>
                    Apply
                  </Button>
                </>
              ))}
            {canStart && (
              <>
                <StepText
                  icon={<PlayCircle aria-hidden className="h-5 w-5 text-primary" />}
                  title="Ready to start"
                  body="Start the job when you begin the work, so the client can follow along."
                />
                <Button className="h-11 shrink-0 sm:h-10" onClick={() => void handleStart()} disabled={isStarting}>
                  {isStarting && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                  Start job
                </Button>
              </>
            )}
            {canRequest && (
              <>
                <StepText
                  icon={<CheckCircle2 aria-hidden className="h-5 w-5 text-primary" />}
                  title="Finished the work?"
                  body="Request completion and the client will be asked to confirm. Payment is released once they do."
                />
                <Button className="h-11 shrink-0 sm:h-10" onClick={() => void handleRequestCompletion()} disabled={isRequesting}>
                  {isRequesting && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                  Request completion
                </Button>
              </>
            )}
            {waiting && (
              <StepText
                icon={<Hourglass aria-hidden className="h-5 w-5 text-warning" />}
                title="Waiting on client"
                body={`You asked ${clientName} to confirm the work on ${formatDayTime(job.completionRequestedAt)}. If they don't reply, the job is marked done 48 hours after your request.`}
              />
            )}
          </NextStep>
        )}

        {/* Phones read Details, Payment, Client, then Timeline; wide screens keep the rail beside both. */}
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <Card className="gap-0 py-0">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold text-foreground">Details</h2>
              </div>
              <div className="space-y-5 px-5 py-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  {job.location && (
                    <Fact icon={<MapPin aria-hidden className="h-4 w-4" />} term="Location" wide>
                      <span className="break-words">{job.location}</span>
                      {directions && (
                        <a
                          href={directions}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0"
                        >
                          <Navigation aria-hidden className="h-3.5 w-3.5" />
                          Get directions
                          <span className="sr-only"> (opens Google Maps)</span>
                        </a>
                      )}
                    </Fact>
                  )}
                  {bookedFor && (
                    <Fact icon={<CalendarDays aria-hidden className="h-4 w-4" />} term="Booked for">
                      {bookedFor}
                    </Fact>
                  )}
                  {job.deadline && (
                    <Fact icon={<CalendarClock aria-hidden className="h-4 w-4" />} term="Deadline">
                      {formatDay(job.deadline)}
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
                  </Fact>
                </dl>

                {job.description && (
                  <div>
                    <h3 className="mb-1.5 text-sm font-semibold text-foreground">What the client needs</h3>
                    <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
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
            <PaymentCard
              job={job}
              mine={mine}
              booking={booking}
              payment={payment}
              state={paymentState}
              destination={destination}
              retrying={isRetrying}
              onRetry={() => void handleRetry()}
              onReload={loadPayment}
            />

            <Card className="gap-0 py-0">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold text-foreground">Client</h2>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarFallback className="text-sm font-medium text-foreground/80">{initialsOf(clientName) || "?"}</AvatarFallback>
                  </Avatar>
                  <p dir="auto" className="min-w-0 truncate font-medium text-foreground [unicode-bidi:isolate]">
                    {clientName}
                  </p>
                </div>
                {job.customer?.id != null && (
                  <>
                    <Button variant="outline" className="h-11 w-full bg-transparent sm:h-10" asChild>
                      <Link href={`/dashboard/artisan/messages?client=${job.customer.id}&job=${job.id}`}>
                        <MessageSquare aria-hidden className="h-4 w-4" />
                        Message client
                      </Link>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Phone numbers aren&apos;t shared. Use messages to agree access and timing.
                    </p>
                  </>
                )}
              </div>
            </Card>

            {showReport && (
              <DisputeEntryPoint
                className="w-full"
                bookingId={job.bookingId ?? undefined}
                isEligible={disputeEligible}
                ineligibleReason=""
                contextTitle={job.title}
                counterpartyName={clientName}
                counterpartyRole="Client"
                amount={payment?.payout != null ? Number(payment.payout) : undefined}
                disputeHrefBase="/dashboard/artisan/disputes"
              />
            )}
          </div>

          {/* Phones: the timeline comes last, after payment and client. */}
          <div className="min-w-0 lg:hidden">{timeline}</div>
        </div>
      </div>
      <ApplyJobDialog
        job={job}
        open={applyOpen}
        onOpenChange={setApplyOpen}
        onApplied={() => setJob((prev) => (prev ? { ...prev, hasApplied: true } : prev))}
      />
    </DashboardLayout>
  )
}

function NextStep({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Next step"
      className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      {children}
    </section>
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

// ── Payment ──────────────────────────────────────────────────────────────────

/** The path money takes for the artisan. `needs_action` sits on step 3 with an alert. */
const MONEY_STEPS = [
  { key: "pay", label: "Client pays" },
  { key: "held", label: "Held until the client signs off" },
  { key: "way", label: "On its way to you" },
  { key: "paid", label: "Paid" },
] as const

function moneyStep(stage: PaymentStage | null): number {
  switch (stage) {
    case "held":
      return 1
    case "on_the_way":
    case "needs_action":
      return 2
    case "paid":
      return 3
    default:
      return 0
  }
}

function PaymentCard({
  job,
  mine,
  booking,
  payment,
  state,
  destination,
  retrying,
  onRetry,
  onReload,
}: {
  job: JobDetail
  mine: boolean
  booking: BookingDetail | null
  payment: StatementItem | null
  state: "loading" | "ready" | "error"
  destination: PayoutDestination | null
  retrying: boolean
  onRetry: () => void
  onReload: () => void
}) {
  const budgetMin = job.budgetMin != null ? Number(job.budgetMin) : null
  const budgetMax = job.budgetMax != null ? Number(job.budgetMax) : null
  const budget =
    budgetMin != null && budgetMax != null && budgetMin !== budgetMax
      ? `${formatCurrency(budgetMin)} to ${formatCurrency(budgetMax)}`
      : budgetMax != null || budgetMin != null
        ? formatCurrency((budgetMax ?? budgetMin) as number)
        : null

  const agreed = payment ? Number(payment.gross) : booking?.agreedPrice != null ? Number(booking.agreedPrice) : null
  const stage = payment?.stage ?? null
  const closedUnpaid = !payment && (job.status === "CANCELLED" || job.status === "EXPIRED")
  const showSteps = mine && !closedUnpaid && stage !== "refunded" && stage !== "not_paid"
  const current = moneyStep(stage)

  return (
    <Card className="gap-0 py-0" aria-busy={state === "loading" || undefined}>
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-foreground">Payment</h2>
      </div>
      <div className="space-y-4 px-5 py-5">
        {/* Price first: agreed when we know it, otherwise the client's budget. */}
        <div>
          <p className="text-xs text-muted-foreground">{agreed != null ? "Agreed price" : "Client's budget"}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {agreed != null ? formatCurrency(agreed) : (budget ?? "Not set")}
          </p>
          {!mine && job.status === "OPEN" && (
            <p className="mt-1 text-xs text-muted-foreground">You set your own price when you apply.</p>
          )}
        </div>

        {mine && state === "loading" && <div className="h-24 rounded-lg bg-muted motion-safe:animate-pulse" />}

        {mine && state === "error" && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="text-foreground">Couldn&apos;t load the payment for this job.</p>
            <Button variant="outline" className="mt-2 h-11 bg-transparent sm:h-9" onClick={onReload}>
              Try again
            </Button>
          </div>
        )}

        {mine && state === "ready" && (
          <>
            {payment && (
              <dl className="space-y-1.5 border-y py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Paid by client</dt>
                  <dd className="tabular-nums text-foreground">{formatCurrency(payment.gross)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Platform fee</dt>
                  <dd className="tabular-nums text-foreground">−{formatCurrency(payment.fee)}</dd>
                </div>
                <div className="flex justify-between gap-3 font-semibold">
                  <dt className="text-foreground">Your payout</dt>
                  <dd className="tabular-nums text-foreground">
                    {payment.payout != null ? formatCurrency(payment.payout) : "None"}
                  </dd>
                </div>
              </dl>
            )}

            {showSteps ? (
              <ol aria-label="Where the money is" className="space-y-0">
                {MONEY_STEPS.map((step, i) => {
                  const done = i < current || (i === current && stage === "paid")
                  const now = i === current && stage !== "paid"
                  return (
                    <li key={step.key} className="relative flex gap-3 pb-3 last:pb-0">
                      {i < MONEY_STEPS.length - 1 && (
                        <span
                          aria-hidden
                          className={cn("absolute left-[7px] top-4 h-[calc(100%-8px)] w-px", done ? "bg-primary/60" : "bg-border")}
                        />
                      )}
                      <span
                        aria-hidden
                        className={cn(
                          "relative z-10 mt-0.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full",
                          done
                            ? "bg-primary text-primary-foreground"
                            : now
                              ? "border-2 border-primary bg-card ring-4 ring-primary/15"
                              : "border border-muted-foreground/40 bg-card",
                        )}
                      >
                        {done && <CheckCircle2 className="h-[15px] w-[15px]" />}
                      </span>
                      <span className={cn("text-sm", now ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground")}>
                        {step.label}
                        <span className="sr-only">{done ? " (done)" : now ? " (now)" : " (not yet)"}</span>
                        {now && <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Now</span>}
                      </span>
                    </li>
                  )
                })}
              </ol>
            ) : null}

            <PaymentNote
              job={job}
              payment={payment}
              closedUnpaid={closedUnpaid}
              destination={destination}
              retrying={retrying}
              onRetry={onRetry}
            />
          </>
        )}
      </div>
    </Card>
  )
}

function PaymentNote({
  job,
  payment,
  closedUnpaid,
  destination,
  retrying,
  onRetry,
}: {
  job: JobDetail
  payment: StatementItem | null
  closedUnpaid: boolean
  destination: PayoutDestination | null
  retrying: boolean
  onRetry: () => void
}) {
  const to = destination ? `${destination.label} ••${destination.last4}` : null

  if (!payment) {
    return (
      <p className="text-sm text-muted-foreground">
        {closedUnpaid
          ? "Not paid. This job closed without a payment."
          : job.status === "COMPLETED"
            ? "Not paid yet. No payment from the client has been recorded for this job."
            : "Not paid yet. You'll see the client's payment here once they pay through JinVa."}
      </p>
    )
  }

  switch (payment.stage) {
    case "awaiting_payment":
      return <p className="text-sm text-muted-foreground">The client hasn&apos;t paid yet.</p>
    case "held":
      return (
        <p className="text-sm text-muted-foreground">
          The client has paid. JinVa holds the money until they confirm the work is done, then sends it to you.
        </p>
      )
    case "on_the_way":
      return (
        <p className="text-sm text-muted-foreground">
          The transfer has started{to ? ` to ${to}` : ""}.
          {payment.transferReference ? ` Reference ${payment.transferReference}.` : ""}
        </p>
      )
    case "needs_action":
      return payment.failureReason === "no_payout_method" ? (
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning/10 p-3">
          <p className="flex items-start gap-2 text-sm font-medium text-foreground">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            Add a payout method to receive {payment.payout != null ? formatCurrency(payment.payout) : "this payment"}
          </p>
          <Button className="mt-3 h-11 w-full sm:h-9" asChild>
            <Link href={PAYOUT_SETTINGS_HREF}>Add payout method</Link>
          </Button>
        </div>
      ) : (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="flex items-start gap-2 text-sm font-medium text-foreground">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            The transfer{to ? ` to ${to}` : ""} didn&apos;t go through
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Check your payout details, then send it again.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="h-11 sm:h-9" onClick={onRetry} disabled={retrying}>
              {retrying ? (
                <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <RotateCcw aria-hidden className="h-4 w-4" />
              )}
              Send again
            </Button>
            <Button variant="outline" className="h-11 bg-transparent sm:h-9" asChild>
              <Link href={PAYOUT_SETTINGS_HREF}>Check payout details</Link>
            </Button>
          </div>
        </div>
      )
    case "paid":
      return (
        <p className="text-sm text-muted-foreground">
          Paid{payment.releasedAt ? ` on ${formatDay(payment.releasedAt)}` : ""}
          {to ? ` to ${to}` : ""}.
          {payment.transferReference ? ` Reference ${payment.transferReference}.` : ""}
        </p>
      )
    case "refunded":
      return (
        <p className="text-sm text-muted-foreground">
          Refunded to the client{Number(payment.refunded) > 0 ? ` (${formatCurrency(payment.refunded)})` : ""}. There is no payout for this job.
        </p>
      )
    case "not_paid":
    default:
      return <p className="text-sm text-muted-foreground">Not paid. The client&apos;s payment didn&apos;t complete.</p>
  }
}

// ── Timeline ─────────────────────────────────────────────────────────────────

const EVENT_NAMES: Record<string, string> = {
  OPEN: "Posted",
  PENDING: "Artisan chosen",
  IN_PROGRESS: "Work started",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
}

/** System reasons are written for logs; say them in the artisan's words. */
function readableReason(reason?: string | null): string | null {
  if (!reason) return null
  if (/auto-?completed/i.test(reason)) return "Marked done automatically because the client didn't reply."
  if (/expired?/i.test(reason) && /deadline/i.test(reason)) return "The deadline passed."
  return reason.replace(/\bcustomer\b/gi, "client")
}

function Timeline({ job, userId, clientName }: { job: JobDetail; userId: string | number | undefined; clientName: string }) {
  const actor = (changedBy: string) => {
    if (changedBy === "SYSTEM") return "JinVa, automatically"
    if (userId != null && changedBy === String(userId)) return "You"
    if (job.customer?.id != null && changedBy === String(job.customer.id)) return clientName
    return "JinVa team"
  }

  const events = (job.statusHistory ?? []).map((e) => ({
    key: `h${e.id}`,
    title:
      e.toStatus === "PENDING" && userId != null && job.acceptedArtisan && String(job.acceptedArtisan.id) === String(userId)
        ? "You were chosen"
        : (EVENT_NAMES[e.toStatus] ?? jobStatusName(e.toStatus)),
    detail: e.fromStatus ? `${jobStatusName(e.fromStatus)} to ${jobStatusName(e.toStatus)}` : null,
    reason: readableReason(e.reason),
    by: actor(e.changedBy),
    at: e.createdAt,
  }))
  if (job.completionRequestedAt) {
    events.push({
      key: "completion",
      title: "Completion requested",
      detail: null,
      reason: null,
      by: isMyJob(job, userId) ? "You" : "The artisan",
      at: job.completionRequestedAt,
    })
  }
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Posted {formatDayTime(job.createdAt)}. Earlier changes to this job weren&apos;t recorded.
      </p>
    )
  }

  return (
    <ol className="space-y-0">
      {events.map((e, i) => (
        <li key={e.key} className="relative flex gap-3 pb-5 last:pb-0">
          {i < events.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-6px)] w-px bg-primary/30" />}
          <span aria-hidden className="relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full bg-primary ring-4 ring-card" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{e.title}</p>
            {e.reason && <p className="mt-0.5 text-sm text-muted-foreground">{e.reason}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">
              <time dateTime={e.at}>{formatDayTime(e.at)}</time>, by {e.by}
              {e.detail ? <span className="sr-only">. {e.detail}</span> : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
