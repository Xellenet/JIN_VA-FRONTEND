"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FormField } from "@/components/forms/form-field"
import { PaymentMethodMark } from "@/components/payments/payment-method-mark"
import { RADIO_TILE_CLASS, RadioMark } from "@/components/settings/settings-row"
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserRound,
  Receipt,
  Smartphone,
  ExternalLink,
  KeyRound,
  Clock,
} from "lucide-react"
import { ApiError, apiFetch } from "@/lib/api"
import { formatCurrency, resolveAvatarUrl } from "@/lib/utils"
import { getPaymentStatusConfig } from "@/lib/status-badges"
import {
  chargeWithSavedMethod,
  getChargeStatus,
  getJobPaymentState,
  getPaymentMethods,
  initializeHostedPayment,
  submitChargeOtp,
} from "@/lib/payment-methods-api"
import {
  attemptActiveMessage,
  attemptAsCharge,
  clearIntentKey,
  getOrCreateIntentKey,
  keepKeyAfter,
  parsePaySync,
  payErrorKind,
  paySyncChannelName,
  paySyncStorageKey,
  safeSessionStorage,
  samePressRetryDelay,
  shouldRetrySamePress,
  type AlreadyPaid,
  type AttemptView,
  type JobPaymentState,
  type PayMethod,
  type PaySyncMessage,
} from "@/lib/payment-intent"
import {
  chargeFailureMessage,
  chargeView,
  isUsable,
  isValidOtp,
  methodDetail,
  methodTitle,
  payButtonLabel,
  pickInitialMethod,
  pollDelay,
  shouldKeepPolling,
  sortMethods,
  tidyOtp,
  type ChargeResult,
  type PaymentMethodList,
  type SavedPaymentMethod,
} from "@/lib/saved-payment-methods"

interface BackendJob {
  id: number
  title: string
  currency?: string
  service?: { id: number; name: string }
  acceptedArtisan?: { id: number; firstname: string; lastname: string; profilePicture?: string }
}

interface BackendPayment {
  id: number
  /** QA PAY-01: the history returns `job.id`; `jobId` is only on newer backends. */
  jobId?: number
  job?: { id: number; title?: string | null }
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

// Paystack redirects the browser back to whatever URL the backend registered
// as PAYSTACK_CALLBACK_URL, appending ?trxref=...&reference=... (both equal).
// This page doubles as that landing target — presence of either query param
// switches it from the pre-pay confirm state into the post-redirect
// confirming/result flow (design-spec.md 2.1).
const MAX_POLL_ATTEMPTS = 6
const POLL_INTERVAL_MS = 3000

/** "hosted" is Paystack's own page ("Pay another way"); a number is a saved method's id. */
type Selection = number | "hosted"

type Phase =
  | "loading"
  | "confirm"
  | "redirecting"
  | "confirming"
  | "success"
  | "failed"
  | "error"
  | "unavailable"
  // Paying with a saved method:
  | "waiting_phone"
  | "charge_confirming"
  | "otp"
  | "charge_failed"
  // An open Paystack page for this job (started here or in another tab).
  | "hosted_open"

/** Phases where the job's payment state may be refreshed (focus, other tabs). */
const REFRESHABLE_PHASES: readonly Phase[] = [
  "confirm",
  "waiting_phone",
  "charge_confirming",
  "otp",
  "charge_failed",
  "hosted_open",
]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const SAVED_UNAVAILABLE_MESSAGE = "Paying with a saved method isn’t available right now. You can pay another way."

export default function PaymentCheckoutPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>("loading")
  const [job, setJob] = useState<BackendJob | null>(null)
  const [payment, setPayment] = useState<BackendPayment | null>(null)
  const [message, setMessage] = useState("")
  const [resultAmount, setResultAmount] = useState<number | null>(null)

  // Saved payment methods. A failure to load them only hides them: paying on
  // Paystack's page always works.
  const [methods, setMethods] = useState<PaymentMethodList | null>(null)
  const [selected, setSelected] = useState<Selection>("hosted")
  const [choosing, setChoosing] = useState(false)
  const [saveCard, setSaveCard] = useState(false)

  const [charge, setCharge] = useState<ChargeResult | null>(null)
  /** Whether a failed charge can be tried again with the same method (otherwise: pay another way). */
  const [canRetryCharge, setCanRetryCharge] = useState(true)
  const [pollStalled, setPollStalled] = useState(false)
  const [pollRun, setPollRun] = useState(0)
  const [otp, setOtp] = useState("")
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpSubmitting, setOtpSubmitting] = useState(false)
  /** Pay was pressed and its request hasn't answered yet (aria-busy, disabled). */
  const [payBusy, setPayBusy] = useState(false)
  /** Why the customer can't pay another way right now (an active attempt). */
  const [activeNotice, setActiveNotice] = useState<string | null>(null)
  const [hostedAttempt, setHostedAttempt] = useState<AttemptView | null>(null)

  // C2: synchronous, ref-backed guard — state alone can lag a fast double
  // click by a render, a ref cannot.
  const isSubmittingRef = useRef(false)
  const pollAttemptsRef = useRef(0)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const reference = searchParams.get("reference") ?? searchParams.get("trxref")

  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase

  // ── Other tabs of the same job ──────────────────────────────────────────────
  // BroadcastChannel where the browser has it, else a localStorage write that
  // other tabs see as a `storage` event.
  const channelRef = useRef<BroadcastChannel | null>(null)
  const publish = useCallback(
    (m: PaySyncMessage) => {
      try {
        if (channelRef.current) {
          channelRef.current.postMessage(m)
          return
        }
        window.localStorage.setItem(paySyncStorageKey(id), JSON.stringify({ ...m, at: Date.now() }))
      } catch {
        // Other tabs catch up on focus instead.
      }
    },
    [id],
  )

  const publishRef = useRef(publish)
  publishRef.current = publish

  const runVerify = useCallback(async (ref: string) => {
    try {
      const res = await apiFetch<VerifyResult>(`/payments/verify/${encodeURIComponent(ref)}`)
      setResultAmount(res.amount)
      if (res.status === "HELD" || res.status === "PENDING_TRANSFER" || res.status === "RELEASED") {
        setPhase("success")
        publishRef.current({ type: "paid", jobId: Number(id), amount: res.amount })
        return
      }
      // QA PAY-03/PAY-06: Paystack already knows the attempt failed (declined
      // card) or was never completed (checkout closed). Say so now, rather
      // than "Confirming your payment…" and then "Still confirming".
      if (res.status === "PENDING" && (res.remoteStatus === "failed" || res.remoteStatus === "abandoned")) {
        setPhase("failed")
        setMessage(
          res.remoteStatus === "failed"
            ? "Your payment was declined. No charge was made — you can try again with another card or mobile money number."
            : "Your payment wasn't completed. No charge was made — you can try again.",
        )
        return
      }
      if (res.status === "PENDING") {
        pollAttemptsRef.current += 1
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setPhase("confirming")
          setMessage("Still confirming. You can check your payment history, or come back to this job later.")
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
  }, [id])

  const loadConfirmState = useCallback(async () => {
    setPhase("loading")
    try {
      const [jobData, history, saved] = await Promise.all([
        apiFetch<BackendJob>(`/jobs/${id}`),
        apiFetch<BackendPayment[]>("/payments/history"),
        getPaymentMethods().catch(() => null),
      ])
      setJob(jobData)
      setMethods(saved)
      const initial = saved ? pickInitialMethod(saved.methods) : null
      setSelected(initial ? initial.id : "hosted")
      setChoosing(false)

      // Money/currency defensive guard: never offer to pay a job whose
      // currency isn't GHS, regardless of what the backend's own validator
      // lets through at creation time.
      if (jobData.currency && jobData.currency !== "GHS") {
        setPhase("unavailable")
        setMessage("This job can't be paid in-app — its currency isn't set to Ghanaian Cedis (GHS).")
        return
      }

      const match = history.find((p) => Number(p.jobId ?? p.job?.id) === Number(id))
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
      // Paid in another tab, or a payment already waiting (a phone prompt,
      // a Telecel code, Paystack's page): show that instead of a second Pay.
      const state = await getJobPaymentState(Number(id)).catch(() => null)
      if (state && applyStateRef.current(state, { initial: true })) return
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

  /** Moves the page to whatever a charge result calls for. */
  const applyCharge = useCallback(
    (r: ChargeResult) => {
      setCharge(r)
      const view = chargeView(r)
      switch (view) {
        case "succeeded":
          setResultAmount(payment?.amount ?? null)
          setPhase("success")
          setActiveNotice(null)
          publishRef.current({ type: "paid", jobId: r.jobId, amount: payment?.amount ?? null })
          return
        case "otp":
          setPhase("otp")
          return
        case "failed_fallback":
        case "failed_retry":
          setCanRetryCharge(view === "failed_retry")
          setMessage(chargeFailureMessage(r))
          setPhase("charge_failed")
          return
        case "waiting_phone":
          setPhase("waiting_phone")
          return
        case "confirming":
          setPhase("charge_confirming")
          return
      }
    },
    [payment?.amount],
  )

  /** Shows an active attempt: the phone/OTP panel for a saved method, or Paystack's open page. */
  const applyAttempt = useCallback(
    (a: AttemptView, notice: string | null) => {
      setActiveNotice(notice)
      if (a.kind === "hosted") {
        setCharge(null)
        setHostedAttempt(a)
        setPhase("hosted_open")
        return
      }
      setHostedAttempt(null)
      if (a.paymentMethodId != null) setSelected(a.paymentMethodId)
      const c = attemptAsCharge(a)
      if (c) applyCharge(c)
    },
    [applyCharge],
  )

  const showPaid = useCallback((amount: number | null | undefined) => {
    setResultAmount(amount ?? null)
    setActiveNotice(null)
    setPhase("success")
  }, [])

  /**
   * Applies the server's view of this job's payment. Returns true when it
   * decided the screen (paid, or an attempt to resume).
   */
  const applyState = useCallback(
    (state: JobPaymentState, opts: { initial?: boolean } = {}): boolean => {
      if (state.paid) {
        showPaid(state.payment?.amount)
        return true
      }
      const a = state.activeAttempt
      if (a) {
        const showing = phaseRef.current === "hosted_open" ? hostedRef.current : chargeRefCurrent.current
        if (opts.initial || showing !== a.reference) applyAttempt(a, null)
        return true
      }
      // The attempt we were showing ended without paying (declined, expired):
      // let the status poll or the customer move on.
      if (phaseRef.current === "hosted_open") {
        setHostedAttempt(null)
        setActiveNotice(null)
        setPhase("confirm")
      }
      return false
    },
    [applyAttempt, showPaid],
  )
  const applyStateRef = useRef(applyState)
  applyStateRef.current = applyState
  const hostedRef = useRef<string | null>(null)
  hostedRef.current = hostedAttempt?.reference ?? null
  const chargeRefCurrent = useRef<string | null>(null)
  chargeRefCurrent.current = charge?.reference ?? null

  const lastRefreshRef = useRef(0)
  const refreshState = useCallback(async () => {
    if (reference || isSubmittingRef.current) return
    if (!REFRESHABLE_PHASES.includes(phaseRef.current)) return
    const now = Date.now()
    if (now - lastRefreshRef.current < 1500) return
    lastRefreshRef.current = now
    try {
      const state = await getJobPaymentState(Number(id))
      if (!isSubmittingRef.current && REFRESHABLE_PHASES.includes(phaseRef.current)) applyStateRef.current(state)
    } catch {
      // An older server without this endpoint, or offline: keep the screen.
    }
  }, [id, reference])

  // Back on this tab (focus, or it became visible): ask what changed.
  useEffect(() => {
    const onFocus = () => void refreshState()
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshState()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refreshState])

  // Messages from other tabs of this job.
  const onSyncRef = useRef<(m: PaySyncMessage) => void>(() => {})
  onSyncRef.current = (m: PaySyncMessage) => {
    if (m.type === "paid") {
      if (phaseRef.current !== "success" && phaseRef.current !== "unavailable") showPaid(m.amount ?? payment?.amount)
      return
    }
    if (m.type === "attempt") {
      if (phaseRef.current === "confirm" || phaseRef.current === "charge_failed") applyAttempt(m.attempt, null)
      return
    }
    lastRefreshRef.current = 0
    void refreshState()
  }
  useEffect(() => {
    const jobId = Number(id)
    const onMessage = (raw: unknown) => {
      const m = parsePaySync(raw, jobId)
      if (m) onSyncRef.current(m)
    }
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel(paySyncChannelName(jobId))
        bc.onmessage = (e: MessageEvent) => onMessage(e.data)
        channelRef.current = bc
      }
    } catch {
      channelRef.current = null
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === paySyncStorageKey(jobId) && e.newValue) onMessage(e.newValue)
    }
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("storage", onStorage)
      channelRef.current?.close()
      channelRef.current = null
    }
  }, [id])

  /**
   * One press of Pay: the same Idempotency-Key for the automatic retries of
   * this press (no answer, or the server still working on the same key), and
   * kept for a refresh mid-request; cleared once the server answered.
   */
  const runPress = async <T,>(method: PayMethod, send: (key: string) => Promise<T>): Promise<T> => {
    const storage = safeSessionStorage()
    const key = getOrCreateIntentKey(storage, id, method)
    for (let retries = 0; ; retries++) {
      try {
        const result = await send(key)
        clearIntentKey(storage, id, method)
        return result
      } catch (err) {
        const kind = payErrorKind(err instanceof ApiError ? err : { status: 0 })
        if (shouldRetrySamePress(kind, retries)) {
          await sleep(samePressRetryDelay(retries))
          continue
        }
        if (!keepKeyAfter(kind)) clearIntentKey(storage, id, method)
        throw err
      }
    }
  }

  /** Paid already, or another attempt is active: the answers every pay call shares. */
  const handlePayConflict = (err: unknown): boolean => {
    if (!(err instanceof ApiError)) return false
    const kind = payErrorKind(err)
    if (kind === "already_paid") {
      const paid = (err.data ?? null) as Partial<AlreadyPaid> | null
      const amount = typeof paid?.amount === "number" ? paid.amount : (payment?.amount ?? null)
      showPaid(amount)
      publish({ type: "paid", jobId: Number(id), amount })
      return true
    }
    if (kind === "attempt_active") {
      const a = (err.data ?? null) as AttemptView | null
      if (a && typeof a.reference === "string" && a.kind) {
        applyAttempt(a, attemptActiveMessage(a, err.message))
        return true
      }
    }
    return false
  }

  // Ask the server how the charge is going while the customer approves it.
  // Quick checks first, then every 10 s; paused while the tab is hidden, and
  // stopped after a cap ("Check again" starts a new round).
  const chargeRef = charge?.reference
  useEffect(() => {
    if (!chargeRef || (phase !== "waiting_phone" && phase !== "charge_confirming")) return
    let cancelled = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | null = null
    setPollStalled(false)

    const schedule = () => {
      if (cancelled || timer || controller) return
      if (!shouldKeepPolling(attempt)) {
        setPollStalled(true)
        return
      }
      if (document.visibilityState === "hidden") return
      timer = setTimeout(tick, pollDelay(attempt))
    }
    const tick = async () => {
      timer = undefined
      attempt += 1
      controller = new AbortController()
      try {
        const r = await getChargeStatus(chargeRef, controller.signal)
        controller = null
        if (cancelled) return
        if (r.status !== "pending") {
          applyCharge(r)
          return
        }
        setCharge(r)
      } catch {
        controller = null
        if (cancelled) return
      }
      schedule()
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        clearTimeout(timer)
        timer = undefined
      } else {
        schedule()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [chargeRef, phase, pollRun, applyCharge])

  const handleProceed = async () => {
    if (isSubmittingRef.current || !payment) return
    isSubmittingRef.current = true
    // The Pay step stays, with the button disabled and busy, until the server answers.
    setPayBusy(true)
    try {
      const res = await runPress("hosted", (key) =>
        initializeHostedPayment({ jobId: Number(id), saveCard }, key),
      )
      setPhase("redirecting")
      publish({ type: "refresh", jobId: Number(id) })
      window.location.href = res.authorizationUrl
    } catch (err) {
      isSubmittingRef.current = false
      setPayBusy(false)
      if (handlePayConflict(err)) return
      setPhase("error")
      setMessage(err instanceof Error ? err.message : "Couldn't start the payment. Please try again.")
    }
  }

  const selectedMethod: SavedPaymentMethod | null =
    selected === "hosted" ? null : (methods?.methods.find((m) => m.id === selected && isUsable(m)) ?? null)

  const handleChargeSaved = async () => {
    if (isSubmittingRef.current || !payment || !selectedMethod) return
    isSubmittingRef.current = true
    setPayBusy(true)
    setOtp("")
    setOtpError(null)
    setActiveNotice(null)
    const methodId = selectedMethod.id
    try {
      const r = await runPress(methodId, (key) => chargeWithSavedMethod(Number(id), methodId, key))
      applyCharge(r)
      if (r.status === "pending" || r.status === "needs_otp") publish({ type: "refresh", jobId: Number(id) })
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      if (handlePayConflict(err)) {
        // Shown: paid, or the attempt that is already waiting.
      } else if (status === 409) {
        // An older server's "already paid": show the job's real state.
        isSubmittingRef.current = false
        await loadConfirmState()
      } else {
        setCanRetryCharge(status !== 503 && status !== 404)
        setMessage(
          status === 503
            ? SAVED_UNAVAILABLE_MESSAGE
            : err instanceof Error && err.message
              ? err.message
              : "We couldn’t start this payment. Try again or pay another way.",
        )
        setPhase("charge_failed")
      }
    } finally {
      isSubmittingRef.current = false
      setPayBusy(false)
    }
  }

  // Both handlers set the ref-backed guard and `payBusy` before any await, so
  // a double click sends one request.
  const handlePay = () => (selectedMethod ? handleChargeSaved() : handleProceed())

  const handleSubmitOtp = async () => {
    if (!charge || otpSubmitting) return
    if (!isValidOtp(otp)) {
      setOtpError("Enter the code Telecel sent you: 4 to 8 digits.")
      return
    }
    setOtpSubmitting(true)
    setOtpError(null)
    try {
      const code = tidyOtp(otp)
      const r = await runPress("otp", (key) => submitChargeOtp(charge.reference, code, key))
      if (r.status === "needs_otp") {
        setCharge(r)
        setOtp("")
        setOtpError(r.message?.trim() || "That code didn’t work. Check the latest code from Telecel and try again.")
      } else {
        applyCharge(r)
      }
    } catch (err) {
      if (handlePayConflict(err)) return
      setOtpError(err instanceof Error && err.message ? err.message : "We couldn’t check that code. Try again.")
    } finally {
      setOtpSubmitting(false)
    }
  }

  /** Back to the pay step with Paystack's own page chosen. */
  const payAnotherWay = () => {
    setCharge(null)
    setHostedAttempt(null)
    setSelected("hosted")
    setChoosing(false)
    setMessage("")
    setPhase("confirm")
  }

  /** Back to the pay step with the same saved method, after a failed charge. */
  const retryCharge = () => {
    setCharge(null)
    setActiveNotice(null)
    setMessage("")
    setPhase("confirm")
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

  const usableMethods = methods ? sortMethods(methods.methods).filter(isUsable) : []
  const showSaveCard =
    selected === "hosted" && !!methods?.canSave && methods.methods.length < methods.maxMethods
  const amountLabel = payment ? formatCurrency(payment.amount) : ""

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground max-sm:h-11">
          <Link href={`/dashboard/user/jobs/${id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to job
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Complete payment</h1>
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
                    <AvatarImage src={resolveAvatarUrl(job.acceptedArtisan.profilePicture)} />
                    <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{artisanName}</p>
                    {job.service && <p className="truncate text-xs text-muted-foreground">{job.service.name}</p>}
                  </div>
                </div>
              )}
              <div className="border-b border-border p-5">
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
                  Payment summary
                </h2>
              </div>
              <CardContent className="p-5">
                <div className="space-y-3 divide-y divide-dashed divide-border">
                  <div className="flex items-center justify-between gap-4 pb-3 text-sm">
                    <span className="text-muted-foreground">Job</span>
                    <span className="min-w-0 text-right font-medium text-foreground">{job.title}</span>
                  </div>
                  {job.service && (
                    <div className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium text-foreground">{job.service.name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="min-w-0 break-all text-right font-mono text-xs font-medium text-foreground">{payment.reference}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-4">
                  <span className="font-semibold text-foreground">Total to pay</span>
                  <span className="text-2xl font-extrabold text-primary tabular-nums">{amountLabel}</span>
                </div>
              </CardContent>
            </Card>

            {/* How to pay: the default saved method, or Paystack's page. */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-foreground" id="pay-with-title">
                    Pay with
                  </h2>
                  {usableMethods.length > 0 && !choosing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="max-sm:h-11"
                      onClick={() => setChoosing(true)}
                      aria-label="Change how you pay"
                    >
                      Change
                    </Button>
                  )}
                </div>

                {choosing ? (
                  <div className="space-y-3">
                    <RadioGroupPrimitive.Root
                      aria-labelledby="pay-with-title"
                      value={String(selected)}
                      onValueChange={(v) => setSelected(v === "hosted" ? "hosted" : Number(v))}
                      className="grid gap-2"
                    >
                      {usableMethods.map((m) => (
                        <RadioGroupPrimitive.Item key={m.id} value={String(m.id)} className={RADIO_TILE_CLASS}>
                          <RadioMark />
                          <PaymentMethodMark method={m} />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium tabular-nums text-foreground">{methodTitle(m)}</span>
                            <span dir="auto" className="block text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
                              {methodDetail(m)}
                              {m.isDefault ? " · Default" : ""}
                            </span>
                          </span>
                        </RadioGroupPrimitive.Item>
                      ))}
                      <RadioGroupPrimitive.Item value="hosted" className={RADIO_TILE_CLASS}>
                        <RadioMark />
                        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          <ExternalLink className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground">Pay another way</span>
                          <span className="block text-[13px] text-muted-foreground">Card or mobile money on Paystack&apos;s page</span>
                        </span>
                      </RadioGroupPrimitive.Item>
                    </RadioGroupPrimitive.Root>
                    <Button variant="outline" className="max-sm:h-11 max-sm:w-full" onClick={() => setChoosing(false)}>
                      Done
                    </Button>
                  </div>
                ) : selectedMethod ? (
                  <div className="flex items-center gap-3 rounded-xl border p-4">
                    <PaymentMethodMark method={selectedMethod} className="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{methodTitle(selectedMethod)}</p>
                      <p dir="auto" className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {methodDetail(selectedMethod)}
                        {selectedMethod.isDefault ? " · Default" : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border p-4">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <ExternalLink className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Paystack&apos;s secure page</p>
                      <p className="text-sm text-muted-foreground">Pay by card or mobile money.</p>
                    </div>
                  </div>
                )}

                {selectedMethod?.type === "mobile_money" && !choosing && (
                  <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
                    <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>We&apos;ll send a payment prompt to this number. You approve it on your phone with your PIN. We never ask for your PIN.</span>
                  </p>
                )}

                {showSaveCard && !choosing && (
                  <div className="space-y-1.5">
                    <label htmlFor="save-card" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground sm:min-h-0">
                      <Checkbox
                        id="save-card"
                        checked={saveCard}
                        onCheckedChange={(v) => setSaveCard(v === true)}
                        aria-describedby="save-card-help"
                      />
                      Save this card for next time?
                    </label>
                    <p id="save-card-help" className="pl-7 text-[13px] leading-relaxed text-muted-foreground">
                      Only if you pay by card. We keep a secure token from Paystack, never your card number or CVV. You
                      can remove it in Settings.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="h-auto min-h-11 w-full whitespace-normal bg-primary py-3 text-primary-foreground hover:bg-primary/90"
              onClick={handlePay}
              disabled={choosing || payBusy}
              aria-busy={payBusy}
            >
              {payBusy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {payBusy ? "Starting your payment…" : payButtonLabel(amountLabel, selectedMethod)}
            </Button>
            <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Held securely with Paystack until the job is confirmed complete
            </p>
          </>
        )}

        {phase === "redirecting" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
              <p className="font-medium text-foreground">
                Redirecting to secure payment…
              </p>
              <p className="text-sm text-muted-foreground">Please don&apos;t close this tab.</p>
            </CardContent>
          </Card>
        )}

        {(phase === "waiting_phone" || phase === "charge_confirming") && charge && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-info/10 text-info">
                {phase === "waiting_phone" ? (
                  <Smartphone className="h-7 w-7" aria-hidden="true" />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                )}
              </span>
              <h2 className="text-lg font-semibold text-foreground">
                {phase === "waiting_phone" ? "Approve the payment on your phone" : "Confirming your payment…"}
              </h2>
              {phase === "waiting_phone" && (
                <p className="max-w-sm text-sm text-foreground">
                  Check your phone and approve the payment with your MoMo PIN.
                </p>
              )}
              <p className="max-w-sm text-sm text-muted-foreground">
                {phase === "waiting_phone"
                  ? `${amountLabel} from ${selectedMethod ? methodTitle(selectedMethod) : "your mobile money"}. No prompt? Dial your network's MoMo menu to approve pending payments.`
                  : "We're waiting for Paystack to confirm it."}
              </p>
              <p aria-live="polite" role="status" className="flex items-center gap-2 text-sm font-medium text-foreground">
                {pollStalled ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                    We haven&apos;t heard back yet.
                  </>
                ) : (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    {phase === "waiting_phone" ? "Waiting for your approval" : "Checking"}
                  </>
                )}
              </p>
              {activeNotice && <ActiveAttemptNotice text={activeNotice} />}
              <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {pollStalled && (
                  <Button className="max-sm:h-11" onClick={() => setPollRun((n) => n + 1)}>
                    Check again
                  </Button>
                )}
                <Button variant="outline" className="bg-transparent max-sm:h-11" onClick={payAnotherWay}>
                  Pay another way
                </Button>
              </div>
              <p className="max-w-sm text-xs text-muted-foreground">
                If you pay another way, don&apos;t approve this prompt too.
              </p>
            </CardContent>
          </Card>
        )}

        {phase === "otp" && charge && (
          <Card>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground">Enter the code from Telecel</h2>
                  <p className="text-sm text-muted-foreground">
                    {charge.message?.trim() || "Telecel sent a one-time code to your phone to confirm this payment."}
                  </p>
                </div>
              </div>
              {activeNotice && <ActiveAttemptNotice text={activeNotice} />}
              <form
                noValidate
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleSubmitOtp()
                }}
              >
                <FormField
                  id="telecel-otp"
                  label="Code from Telecel"
                  hint="This is the one-time code Telecel sent you, not your PIN."
                  error={otpError ?? undefined}
                  className="sm:max-w-xs"
                >
                  {(control) => (
                    <Input
                      {...control}
                      className="h-11 tracking-[0.2em] tabular-nums"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={10}
                      value={otp}
                      disabled={otpSubmitting}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/[^\d\s-]/g, ""))
                        setOtpError(null)
                      }}
                    />
                  )}
                </FormField>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" className="max-sm:h-11" disabled={otpSubmitting}>
                    {otpSubmitting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    Submit code
                  </Button>
                  <Button type="button" variant="outline" className="bg-transparent max-sm:h-11" onClick={payAnotherWay} disabled={otpSubmitting}>
                    Pay another way
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {phase === "hosted_open" && hostedAttempt && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-info/10 text-info">
                <ExternalLink className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-foreground">Your payment is open on Paystack&apos;s page</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                You started paying {amountLabel ? `${amountLabel} ` : ""}on Paystack&apos;s page. Continue there to finish.
              </p>
              <ActiveAttemptNotice
                text={
                  activeNotice ??
                  "To pay another way, close that page first. You can pay another way once it's closed or has expired."
                }
              />
              <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {hostedAttempt.authorizationUrl && (
                  <Button className="h-11 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <a href={hostedAttempt.authorizationUrl}>
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Continue on the checkout page
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="h-11 bg-transparent"
                  onClick={() => {
                    lastRefreshRef.current = 0
                    void refreshState()
                  }}
                >
                  Check again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "success" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="status">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-foreground">Payment secured</h2>
              {resultAmount != null && (
                <p className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(resultAmount)}</p>
              )}
              <p className="max-w-xs text-sm text-muted-foreground">
                Held safely until the job is marked complete.
              </p>
              <Badge variant="outline" className={getPaymentStatusConfig("HELD").className}>
                {getPaymentStatusConfig("HELD").label}
              </Badge>
              <Button className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90 max-sm:h-11" asChild>
                <Link href={`/dashboard/user/jobs/${id}`}>Back to job</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {(phase === "failed" || phase === "charge_failed") && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center" role="alert">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-foreground">Payment didn&apos;t go through</h2>
              <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
              <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {phase === "failed" ? (
                  <>
                    <Button variant="outline" className="bg-transparent max-sm:h-11" asChild>
                      <Link href={`/dashboard/user/jobs/${id}`}>Back to job</Link>
                    </Button>
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90 max-sm:h-11" onClick={handleTryAgain}>
                      Try again
                    </Button>
                  </>
                ) : (
                  <>
                    {canRetryCharge && (
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90 max-sm:h-11" onClick={retryCharge}>
                        Try again
                      </Button>
                    )}
                    <Button
                      variant={canRetryCharge ? "outline" : "default"}
                      className={canRetryCharge ? "bg-transparent max-sm:h-11" : "max-sm:h-11"}
                      onClick={payAnotherWay}
                    >
                      Pay another way
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "confirming" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-info/10 text-info">
                <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              </span>
              <h2 className="font-semibold text-foreground">Confirming your payment…</h2>
              <p className="max-w-xs text-sm text-muted-foreground" aria-live="polite">
                {message || "Paystack sent you back before we heard from them. We're checking with them now."}
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" className="bg-transparent max-sm:h-11" asChild>
                  <Link href={`/dashboard/user/jobs/${id}`}>Back to job</Link>
                </Button>
                {reference && (
                  <Button variant="outline" className="bg-transparent max-sm:h-11" onClick={() => { pollAttemptsRef.current = 0; runVerify(reference) }}>
                    Check again
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "unavailable" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <AlertTriangle className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-foreground">Nothing to pay here</h2>
              <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
              <Button variant="outline" className="mt-2 bg-transparent max-sm:h-11" asChild>
                <Link href={`/dashboard/user/jobs/${id}`}>Back to job</Link>
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
                <Button size="sm" variant="outline" className="bg-transparent max-sm:h-11" onClick={() => reference ? runVerify(reference) : loadConfirmState()}>
                  Retry
                </Button>
                <Button size="sm" variant="outline" className="bg-transparent max-sm:h-11" asChild>
                  <Link href={`/dashboard/user/jobs/${id}`}>Back to job</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  )
}

/** Why the customer can't pay another way yet: icon and text, never colour alone. */
function ActiveAttemptNotice({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="flex max-w-sm items-start gap-2 rounded-lg border bg-muted/40 p-3 text-left text-[13px] leading-relaxed text-foreground"
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>{text}</span>
    </p>
  )
}
