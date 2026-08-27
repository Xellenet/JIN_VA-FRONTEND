"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserRound,
  Receipt,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { naviiAvatar, formatCurrency } from "@/lib/utils"
import { getPaymentStatusConfig } from "@/lib/status-badges"

interface BackendJob {
  id: number
  title: string
  currency?: string
  service?: { id: number; name: string }
  acceptedArtisan?: { id: number; firstname: string; lastname: string; profilePicture?: string }
}

interface BackendPayment {
  id: number
  jobId: number
  amount: number
  currency: string
  status: string
  reference: string
}

interface VerifyResult {
  reference: string
  jobId: number
  status: string
  remoteStatus: string
  amount: number
  currency: string
}

interface InitializeResult {
  reference: string
  authorizationUrl: string
  accessCode: string
  amount: number
  currency: string
}

// Paystack redirects the browser back to whatever URL the backend registered
// as PAYSTACK_CALLBACK_URL, appending ?trxref=...&reference=... (both equal).
// This page doubles as that landing target — presence of either query param
// switches it from the pre-pay confirm state into the post-redirect
// confirming/result flow (design-spec.md 2.1).
const MAX_POLL_ATTEMPTS = 6
const POLL_INTERVAL_MS = 3000

type Phase = "loading" | "confirm" | "redirecting" | "confirming" | "success" | "failed" | "error" | "unavailable"

export default function PaymentCheckoutPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>("loading")
  const [job, setJob] = useState<BackendJob | null>(null)
  const [payment, setPayment] = useState<BackendPayment | null>(null)
  const [message, setMessage] = useState("")
  const [resultAmount, setResultAmount] = useState<number | null>(null)

  // C2: synchronous, ref-backed guard — state alone can lag a fast double
  // click by a render, a ref cannot.
  const isSubmittingRef = useRef(false)
  const pollAttemptsRef = useRef(0)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const reference = searchParams.get("reference") ?? searchParams.get("trxref")

  const runVerify = useCallback(async (ref: string) => {
    try {
      const res = await apiFetch<VerifyResult>(`/payments/verify/${encodeURIComponent(ref)}`)
      setResultAmount(res.amount)
      if (res.status === "HELD" || res.status === "PENDING_TRANSFER" || res.status === "RELEASED") {
        setPhase("success")
        return
      }
      if (res.status === "PENDING") {
        pollAttemptsRef.current += 1
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setPhase("confirming")
          setMessage("Still confirming — this is taking longer than usual. You can check your payment history, or come back to this job in a minute.")
          return
        }
        setPhase("confirming")
        setMessage("")
        pollTimeoutRef.current = setTimeout(() => runVerify(ref), POLL_INTERVAL_MS)
        return
      }
      // CANCELLED / FAILED / REFUNDED — treat as a failed attempt from the
      // checkout screen's point of view (copy guidelines: name the actor,
      // not the system; never a dead end).
      setPhase("failed")
      setMessage("Your payment didn't go through. No charge was made — you can try again.")
    } catch {
      setPhase("error")
      setMessage("We couldn't confirm this payment right now.")
    }
  }, [])

  const loadConfirmState = useCallback(async () => {
    setPhase("loading")
    try {
      const [jobData, history] = await Promise.all([
        apiFetch<BackendJob>(`/jobs/${id}`),
        apiFetch<BackendPayment[]>("/payments/history"),
      ])
      setJob(jobData)

      // Money/currency defensive guard: never offer to pay a job whose
      // currency isn't GHS, regardless of what the backend's own validator
      // lets through at creation time.
      if (jobData.currency && jobData.currency !== "GHS") {
        setPhase("unavailable")
        setMessage("This job can't be paid in-app — its currency isn't set to Ghanaian Cedis (GHS).")
        return
      }

      const match = history.find((p) => Number(p.jobId) === Number(id))
      if (!match) {
        setPhase("unavailable")
        setMessage("No payment is due yet — this job doesn't have an accepted artisan with a pending payment.")
        return
      }
      if (match.status !== "PENDING") {
        setPhase("unavailable")
        const cfg = getPaymentStatusConfig(match.status)
        setPayment(match)
        setMessage(
          match.status === "REFUNDED" || match.status === "CANCELLED"
            ? `This payment is already ${cfg.label.toLowerCase()} — it can't be paid again.`
            : "This job has already been paid.",
        )
        return
      }
      setPayment(match)
      setPhase("confirm")
    } catch {
      setPhase("error")
      setMessage("Couldn't load this job's payment details.")
    }
  }, [id])

  useEffect(() => {
    if (reference) {
      pollAttemptsRef.current = 0
      runVerify(reference)
    } else {
      loadConfirmState()
    }
    return () => clearTimeout(pollTimeoutRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference])

  const handleProceed = async () => {
    if (isSubmittingRef.current || !payment) return
    isSubmittingRef.current = true
    setPhase("redirecting")
    try {
      const res = await apiFetch<InitializeResult>("/payments/initialize", {
        method: "POST",
        body: JSON.stringify({ jobId: Number(id) }),
      })
      window.location.href = res.authorizationUrl
    } catch (err) {
      isSubmittingRef.current = false
      setPhase("error")
      setMessage(err instanceof Error ? err.message : "Couldn't start the payment. Please try again.")
    }
  }

  const handleTryAgain = () => {
    isSubmittingRef.current = false
    pollAttemptsRef.current = 0
    router.replace(`/dashboard/user/jobs/${id}/pay`)
    loadConfirmState()
  }

  const artisanName = job?.acceptedArtisan
    ? `${job.acceptedArtisan.firstname} ${job.acceptedArtisan.lastname}`.trim()
    : undefined

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href={`/dashboard/user/jobs/${id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Job
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Complete Payment</h1>
          <p className="text-sm text-muted-foreground">
            {artisanName ? `${artisanName} has accepted your job. Pay now to confirm and get started.` : "Review and complete your payment."}
          </p>
        </div>

        {phase === "loading" && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-11 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        )}

        {phase === "confirm" && job && payment && (
          <>
            <Card className="overflow-hidden">
              {job.acceptedArtisan && (
                <div className="flex items-center gap-3 border-b border-border p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={job.acceptedArtisan.profilePicture || naviiAvatar(artisanName ?? "Artisan")} />
                    <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{artisanName}</p>
                    {job.service && <p className="truncate text-xs text-muted-foreground">{job.service.name}</p>}
                  </div>
                </div>
              )}
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <Receipt className="h-4 w-4 text-primary" />
                  Payment Summary
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="space-y-3 divide-y divide-dashed divide-border">
                  <div className="flex items-center justify-between pb-3 text-sm">
                    <span className="text-muted-foreground">Job</span>
                    <span className="font-medium text-foreground">{job.title}</span>
                  </div>
                  {job.service && (
                    <div className="flex items-center justify-between py-3 text-sm">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium text-foreground">{job.service.name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-3 text-sm">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono text-xs font-medium text-foreground">{payment.reference}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-4">
                  <span className="font-semibold text-foreground">Total to pay</span>
                  <span className="text-2xl font-extrabold text-primary">{formatCurrency(payment.amount)}</span>
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleProceed}
            >
              Proceed to Pay — {formatCurrency(payment.amount)}
            </Button>
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Held securely with Paystack until the job is confirmed complete
            </p>
          </>
        )}

        {phase === "redirecting" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-medium text-foreground">Redirecting to secure payment…</p>
              <p className="text-sm text-muted-foreground">Please don&apos;t close this tab.</p>
            </CardContent>
          </Card>
        )}

        {phase === "confirming" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-info/10 text-info">
                <Loader2 className="h-6 w-6 animate-spin" />
              </span>
              <h3 className="font-semibold text-foreground">Confirming your payment…</h3>
              <p className="max-w-xs text-sm text-muted-foreground">
                {message || "Paystack sent you back before we heard from them. This usually clears in a few seconds."}
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" className="bg-transparent" asChild>
                  <Link href={`/dashboard/user/jobs/${id}`}>Back to Job</Link>
                </Button>
                {reference && (
                  <Button variant="outline" className="bg-transparent" onClick={() => { pollAttemptsRef.current = 0; runVerify(reference) }}>
                    Check Again
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "success" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <h3 className="text-lg font-semibold text-foreground">Payment secured</h3>
              {resultAmount != null && (
                <p className="text-2xl font-bold text-foreground">{formatCurrency(resultAmount)}</p>
              )}
              <p className="max-w-xs text-sm text-muted-foreground">
                Held safely until the job is marked complete.
              </p>
              <Badge variant="outline" className={getPaymentStatusConfig("HELD").className}>
                {getPaymentStatusConfig("HELD").label}
              </Badge>
              <Button className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <Link href={`/dashboard/user/jobs/${id}`}>Back to Job</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "failed" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="h-7 w-7" />
              </span>
              <h3 className="text-lg font-semibold text-foreground">Payment didn&apos;t go through</h3>
              <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" className="bg-transparent" asChild>
                  <Link href={`/dashboard/user/jobs/${id}`}>Back to Job</Link>
                </Button>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleTryAgain}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "unavailable" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <AlertTriangle className="h-7 w-7" />
              </span>
              <h3 className="text-lg font-semibold text-foreground">Nothing to pay here</h3>
              <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
              <Button variant="outline" className="mt-2 bg-transparent" asChild>
                <Link href={`/dashboard/user/jobs/${id}`}>Back to Job</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "error" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              <p>{message || "Please try again."}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="bg-transparent" onClick={() => reference ? runVerify(reference) : loadConfirmState()}>
                  Retry
                </Button>
                <Button size="sm" variant="outline" className="bg-transparent" asChild>
                  <Link href={`/dashboard/user/jobs/${id}`}>Back to Job</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  )
}
