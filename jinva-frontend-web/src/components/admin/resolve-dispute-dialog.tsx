"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock,
  CreditCard,
  Info,
  Loader2,
  MessageSquare,
} from "lucide-react"
import { toast } from "sonner"
import { ApiError, apiFetch, apiFetchWithMessage } from "@/lib/api"
import { cn, formatCurrency, resolveAvatarUrl } from "@/lib/utils"
import { getDisputeCategoryLabel } from "@/lib/disputes"
import {
  getDisputeOutcomeConfig,
  getDisputeStatusConfig,
  getPaymentStatusConfig,
} from "@/lib/status-badges"
import { DisputeConversationPanel } from "@/components/admin/dispute-conversation-panel"

/**
 * DC1 — the admin resolve surface, restructured into three steps
 * (design-spec.md §10, mockups/admin-dispute-resolve-dialog.html).
 *
 * What was broken: `ResolveDisputeDto.outcome` became mandatory and this
 * dialog still sent `body: { resolution }`, so with the global
 * `ValidationPipe` running `forbidNonWhitelisted: true` **every** resolve
 * attempt on the platform was a 400. The money wiring behind the verdict was
 * real and correct the whole time — unreachable, not wrong.
 *
 * Three steps rather than one long scroll (§10.1): Review → Rule → Confirm.
 * The stepping is not decoration. DC1.7 requires both parties' statements to
 * sit above the verdict control, and on a single surface "above" only means
 * "above a fold you can scroll past"; as a step it becomes structural — an
 * admin cannot reach the verdict control without passing through the
 * evidence.
 *
 * Two invariants worth keeping when this is edited:
 *
 *  1. **The invalid request is unconstructible, not merely validated.** The
 *     body is `{ outcome, resolution }` plus `refundAmountGhs` on a
 *     `REFUND_CLIENT` partial refund and nothing else. `Continue` is disabled
 *     without a verdict, so no UI state can reach step 3 — let alone the
 *     request — with the old `{ resolution }`-only body, and the amount
 *     control does not exist on `RELEASE_ARTISAN`/`MUTUAL`, which the backend
 *     400s on.
 *  2. **Availability is server-decided.** `moneyOptions` already folds in the
 *     payment's status, the remaining refundable balance, an in-flight
 *     transfer and a sibling dispute that already moved money (DC1.2). Never
 *     re-derive it from `payment.status` here.
 */

export type AdminDisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED"

export interface DisputeParty {
  id: number
  firstname?: string | null
  lastname?: string | null
  profilePicture?: string | null
}

export interface LinkedPayment {
  id: number
  /** Decimal *strings* on this endpoint, unlike the analytics ones. */
  amount: number | string
  refundedAmount?: number | string | null
  status: string
  paidAt?: string
  reference?: string
}

/** The subset of `GET /admin/disputes` a queue row already has in hand. */
export interface AdminDispute {
  id: number
  reason: string
  status: AdminDisputeStatus
  category?: string | null
  resolution?: string | null
  resolvedAt?: string | null
  outcome?: string | null
  moneyAction?: string | null
  moneyAmount?: number | null
  response?: string | null
  respondedBy?: DisputeParty | null
  respondedAt?: string | null
  createdAt: string
  booking?: {
    id: number
    scheduledDate?: string
    status?: string
    agreedPrice?: number | null
  }
  raisedBy?: DisputeParty | null
}

/**
 * `moneyOptions` has two genuinely different shapes and the UI must handle
 * both (api-contract.md §2.3, `disputes.service.ts` `describeMoneyOptions`):
 * with no payment linked (or a sibling dispute that already moved money on it)
 * a single top-level `reason` carries the explanation; with a payment, the
 * reasons are per-option. So the lookup is the per-option reason when present,
 * otherwise the single `reason`.
 */
interface MoneyOptions {
  canRefund: boolean
  canRelease: boolean
  reason?: string | null
  refundReason?: string | null
  releaseReason?: string | null
  refundableAmount: number
  releasableAmount: number
  paymentStatus?: string
}

interface SiblingDispute {
  id: number
  status: string
  outcome?: string | null
  moneyAction?: string | null
  raisedById?: number
  raisedByName?: string | null
  createdAt?: string
}

interface DisputeDetail extends AdminDispute {
  counterparty?: {
    id: number
    firstname?: string | null
    lastname?: string | null
    profilePicture?: string | null
    role?: string
  } | null
  jobId?: number | null
  payment?: LinkedPayment | null
  work?: { service?: { id: number; name: string } | null } | null
  siblingDisputes?: SiblingDispute[]
  moneyOptions?: MoneyOptions
}

type Verdict = "REFUND_CLIENT" | "RELEASE_ARTISAN" | "MUTUAL"

const VERDICTS: { value: Verdict; sub: string }[] = [
  {
    value: "REFUND_CLIENT",
    sub: "Refund the withheld payment to the client. The artisan is not paid for this job.",
  },
  {
    value: "RELEASE_ARTISAN",
    sub: "Release the withheld payment to the artisan as originally agreed.",
  },
  {
    value: "MUTUAL",
    sub: "Close the dispute with no change to the payment.",
  },
]

const RESOLUTION_MIN = 10
const RESOLUTION_MAX = 2000

const STEP_LABELS: Record<1 | 2 | 3, string> = {
  1: "Review",
  2: "Record the outcome",
  3: "Confirm",
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/**
 * One name resolver for every person this surface renders. The account-purge
 * job anonymises user rows, so a party can come back with empty or missing
 * names — and that hits the raiser as readily as the counterparty. A purged
 * account must never make a dispute unreadable, so this never returns an empty
 * string, a bare space, `null` or `undefined`.
 */
function partyName(party?: DisputeParty | null): string {
  const full = `${party?.firstname ?? ""} ${party?.lastname ?? ""}`.trim()
  return full.length > 0 ? full : "a former JinVa user"
}

function partyFirstName(party?: DisputeParty | null): string {
  const first = (party?.firstname ?? "").trim()
  return first.length > 0 ? first : "a former JinVa user"
}

export interface ResolveDisputeDialogProps {
  /** `null` closes the dialog; a dispute opens it on step 1. */
  dispute: AdminDispute | null
  onOpenChange: (open: boolean) => void
  /**
   * Called with the dispute re-read from the server after any state change, so
   * the queue row reflects what was actually persisted. DC1.5: never patch the
   * row from the request body — that cannot represent `outcome`, `moneyAction`
   * or a rolled-back ruling.
   */
  onDisputeUpdated: (dispute: AdminDispute) => void
}

export function ResolveDisputeDialog({
  dispute,
  onOpenChange,
  onDisputeUpdated,
}: Readonly<ResolveDisputeDialogProps>) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [detail, setDetail] = useState<DisputeDetail | null>(null)
  const [detailState, setDetailState] = useState<"loading" | "ready" | "error">("loading")

  const [outcome, setOutcome] = useState<Verdict | "">("")
  const [refundMode, setRefundMode] = useState<"full" | "partial">("full")
  const [refundAmount, setRefundAmount] = useState("")
  const [resolution, setResolution] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  /**
   * `moneySkippedReason` only ever arrives on the resolve response — it is not
   * a column and not on the read DTO — so it is held for this dialog session
   * and shown in the read-only summary (DC1.5: a verdict that moved no money
   * is a real result, not something to swallow).
   */
  const [skippedReason, setSkippedReason] = useState<string | null>(null)

  const stepHeadingRef = useRef<HTMLParagraphElement | null>(null)
  const openedAtStep = useRef(true)

  const disputeId = dispute?.id ?? null

  const loadDetail = useCallback(
    async (id: number, { notify = false }: { notify?: boolean } = {}) => {
      setDetailState("loading")
      try {
        const fresh = await apiFetch<DisputeDetail>(`/admin/disputes/${id}`)
        setDetail(fresh)
        setDetailState("ready")
        if (notify) onDisputeUpdated(fresh)
        return fresh
      } catch {
        setDetailState("error")
        return null
      }
    },
    [onDisputeUpdated],
  )

  // A newly-opened dispute resets the whole flow. The dialog opens straight on
  // step 1 with the data the queue row already has (§10.8) — gating it on the
  // fetch would be a regression from today's behaviour.
  useEffect(() => {
    if (disputeId == null) return
    openedAtStep.current = true
    setStep(1)
    setDetail(null)
    setOutcome("")
    setRefundMode("full")
    setRefundAmount("")
    setResolution("")
    setIsSubmitting(false)
    setSkippedReason(null)
    void loadDetail(disputeId)
  }, [disputeId, loadDetail])

  // Accessibility (§8): focus moves to the new step's heading on each step
  // change, so a screen-reader user is told the content changed instead of
  // silently landing mid-document. Deliberately skipped on open, where Radix's
  // own title/description announcement should not be interrupted.
  useEffect(() => {
    if (openedAtStep.current) {
      openedAtStep.current = false
      return
    }
    stepHeadingRef.current?.focus()
  }, [step])

  const current: DisputeDetail | null = detail ?? dispute
  const isTerminal = current?.status === "RESOLVED" || current?.status === "CLOSED"

  const money = detail?.moneyOptions
  const detailFailed = detailState === "error"
  const detailLoading = detailState === "loading"

  const canRefund = Boolean(money?.canRefund) && !detailFailed && !detailLoading
  const canRelease = Boolean(money?.canRelease) && !detailFailed && !detailLoading

  // The per-option reason when the shape carries one, otherwise the single
  // top-level `reason` — never a sentence composed here (DC1.2).
  const unavailableReason = (which: "refund" | "release"): string | null => {
    if (detailFailed) return "Couldn't load this dispute's payment details"
    if (detailLoading) return "Checking what this dispute's payment allows…"
    if (!money) return null
    const specific = which === "refund" ? money.refundReason : money.releaseReason
    return specific ?? money.reason ?? null
  }

  const refundableAmount = money?.refundableAmount ?? 0
  const releasableAmount = money?.releasableAmount ?? 0
  const alreadyRefunded = Number(detail?.payment?.refundedAmount ?? 0)

  const trimmedAmount = refundAmount.trim()
  const partialAmountValid =
    trimmedAmount !== "" &&
    /^\d+(\.\d{1,2})?$/.test(trimmedAmount) &&
    Number(trimmedAmount) > 0 &&
    Number(trimmedAmount) <= refundableAmount

  /** What a `REFUND_CLIENT` verdict would actually move, for every label. */
  const refundEffective =
    refundMode === "partial" ? (partialAmountValid ? Number(trimmedAmount) : 0) : refundableAmount

  const trimmedResolution = resolution.trim()
  const resolutionValid =
    trimmedResolution.length >= RESOLUTION_MIN && trimmedResolution.length <= RESOLUTION_MAX

  const canContinue =
    outcome !== "" &&
    resolutionValid &&
    !detailLoading &&
    (outcome !== "REFUND_CLIENT" || refundMode === "full" || partialAmountValid)

  // Who is on which side. Either party can file, so the client is not
  // necessarily the raiser — `counterparty.role` is what settles it: a booking
  // has exactly one customer and one artisan, so if the counterparty is the
  // artisan then the raiser is the client, and vice versa.
  //
  // Getting this backwards is not a cosmetic error: it swaps the names in the
  // consequence panel, so the surface would tell an admin it is refunding the
  // artisan's payment method on a refund to the client.
  const counterpartyRole = detail?.counterparty?.role
  const raiserIsClient = counterpartyRole ? counterpartyRole === "ARTISAN" : undefined
  const raiserName = partyName(current?.raisedBy)
  const counterpartyPerson = detail?.counterparty ?? null
  const counterpartyName = counterpartyPerson ? partyName(counterpartyPerson) : null

  const clientName =
    raiserIsClient === undefined ? null : raiserIsClient ? raiserName : counterpartyName
  const artisanName =
    raiserIsClient === undefined ? null : raiserIsClient ? counterpartyName : raiserName

  const claimHeading =
    raiserIsClient === undefined ? "The claim" : raiserIsClient ? "Client's claim" : "Artisan's claim"
  const responseHeading =
    raiserIsClient === undefined
      ? "Response"
      : raiserIsClient
        ? "Artisan's response"
        : "Client's response"
  const raiserRoleLabel =
    raiserIsClient === undefined ? null : raiserIsClient ? "Client" : "Artisan"

  const categoryLabel = getDisputeCategoryLabel(current?.category) ?? "Other"
  const serviceName = detail?.work?.service?.name
  const statusCfg = getDisputeStatusConfig(current?.status ?? "OPEN")
  const StatusIcon = statusCfg.icon

  /** The consequence panel — tone tracks direction of money, not sentiment. */
  const consequence = (): { tone: "refund" | "release" | "neutral"; text: string } | null => {
    if (outcome === "REFUND_CLIENT") {
      return {
        tone: "refund",
        text: `This refunds ${formatCurrency(refundEffective)} to ${
          clientName ? `${clientName}'s` : "the client's"
        } original payment method and cannot be undone.`,
      }
    }
    if (outcome === "RELEASE_ARTISAN") {
      return {
        tone: "release",
        text: `This releases ${formatCurrency(releasableAmount)} to ${
          artisanName ?? "the artisan"
        }. Once released, the payment cannot be recalled.`,
      }
    }
    if (outcome === "MUTUAL") {
      if (!detail?.payment) {
        return {
          tone: "neutral",
          text: "No money moves. There is no payment linked to this booking.",
        }
      }
      if (detail.payment.status === "HELD") {
        return {
          tone: "neutral",
          text: `No money moves. The payment stays ${
            getPaymentStatusConfig("HELD").label
          } and follows its normal release schedule.`,
        }
      }
      return {
        tone: "neutral",
        text: "No money moves. The payment on this booking is unchanged.",
      }
    }
    return null
  }

  const moneyLine = (): { label: string; amount: string | null } => {
    if (outcome === "REFUND_CLIENT") {
      return { label: "Refund to client", amount: formatCurrency(refundEffective) }
    }
    if (outcome === "RELEASE_ARTISAN") {
      return { label: "Release to artisan", amount: formatCurrency(releasableAmount) }
    }
    return { label: "No money moves", amount: null }
  }

  const confirmLabel = (): string => {
    if (outcome === "REFUND_CLIENT") return `Refund ${formatCurrency(refundEffective)} to client`
    if (outcome === "RELEASE_ARTISAN") {
      return `Release ${formatCurrency(releasableAmount)} to artisan`
    }
    return "Close as mutually resolved"
  }

  const submit = async () => {
    if (!dispute || outcome === "" || !canContinue || isSubmitting) return
    setIsSubmitting(true)
    try {
      // The whole body, and nothing else — one stray key is a 400 under
      // `forbidNonWhitelisted`. `refundAmountGhs` rides along only on a
      // REFUND_CLIENT partial refund; a full refund omits it so the backend
      // refunds the remaining balance itself.
      const body: {
        outcome: Verdict
        resolution: string
        refundAmountGhs?: number
      } = { outcome, resolution: trimmedResolution }
      if (outcome === "REFUND_CLIENT" && refundMode === "partial" && partialAmountValid) {
        body.refundAmountGhs = Number(trimmedAmount)
      }

      const { data, message } = await apiFetchWithMessage<{
        outcome?: string
        moneyAction?: string
        moneyAmount?: number | null
        moneySkippedReason?: string | null
      }>(`/admin/disputes/${dispute.id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })

      // The server's own sentence already names the amount in GH₵, says both
      // parties were notified, and carries the skipped reason when a money
      // verdict moved nothing. Shown verbatim — never re-composed, never
      // double-formatted (DC1.5).
      toast.success(message ?? "Dispute resolved.")
      setSkippedReason(data?.moneySkippedReason ?? null)
      await loadDetail(dispute.id, { notify: true })
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      const message = err instanceof Error ? err.message : ""

      // Another admin won the conditional-claim race. Reload rather than
      // retry — only the winner ever reached the money action (DC1.6).
      if (status === 400 && /already\s+(resolved|closed)/i.test(message)) {
        toast.error(message)
        await loadDetail(dispute.id, { notify: true })
        return
      }

      // Over the remaining refundable balance: rejected before anything was
      // written, and the amount control lives on step 2.
      if (status === 400 && /refundable balance/i.test(message)) {
        toast.error(message)
        setStep(2)
        return
      }

      // Everything else — including a money action that failed after the
      // ruling was claimed and then rolled back — leaves the dispute
      // unresolved and still actionable. No optimistic anything.
      toast.error(message || "Couldn't record the outcome. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * `Escape`, the overlay and the close button must not silently discard a
   * typed resolution note (§8), and nothing can dismiss the dialog while a
   * resolve is in flight (DC1.4). Cancel stays explicit.
   *
   * The guard has to say so rather than just swallow the keypress: a dead
   * `Escape` reads as a broken dialog. Note that `preventDefault()` on
   * Radix's own escape/outside handlers stops it calling `onOpenChange` at
   * all, so the explanation belongs here, not there.
   */
  const hasUnsavedNote = step >= 2 && trimmedResolution.length > 0
  const dismissBlockedBy = (): "in-flight" | "unsaved-note" | null => {
    if (isSubmitting) return "in-flight"
    if (hasUnsavedNote && !isTerminal) return "unsaved-note"
    return null
  }
  const explainBlockedDismiss = (reason: "in-flight" | "unsaved-note") => {
    toast.info(
      reason === "in-flight"
        ? "Recording the outcome — please wait."
        : "Your resolution note is still here — use Cancel if you want to discard it.",
      { id: "resolve-dismiss-guard" },
    )
  }
  /** For Radix's escape / outside-interaction handlers. */
  const guardDismiss = (e: { preventDefault: () => void }) => {
    const blocked = dismissBlockedBy()
    if (!blocked) return
    e.preventDefault()
    explainBlockedDismiss(blocked)
  }
  /** For the header close button, which does not route through the above. */
  const requestClose = (next: boolean) => {
    if (next) return
    const blocked = dismissBlockedBy()
    if (blocked) {
      explainBlockedDismiss(blocked)
      return
    }
    onOpenChange(false)
  }

  const stepHeadingText = isTerminal
    ? "This dispute is closed to new rulings"
    : `Step ${step} of 3 · ${STEP_LABELS[step]}`

  const consequencePanel = consequence()

  return (
    <Dialog open={!!dispute} onOpenChange={requestClose}>
      <DialogContent
        className="sm:max-w-2xl"
        showCloseButton={!isSubmitting}
        onEscapeKeyDown={guardDismiss}
        onInteractOutside={guardDismiss}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle>Dispute #{current?.id}</DialogTitle>
              <DialogDescription>
                {[
                  categoryLabel,
                  serviceName,
                  current?.booking?.id ? `Booking #${current.booking.id}` : null,
                  `Filed ${fmtDate(current?.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={cn("shrink-0 text-xs", statusCfg.className)}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusCfg.label}
            </Badge>
          </div>
          {/* Real text, not dots: a dot row says nothing to a screen reader and
              nothing about what the steps are. Also the focus target on each
              step change. */}
          <p
            ref={stepHeadingRef}
            tabIndex={-1}
            role="heading"
            aria-level={3}
            aria-live="polite"
            className="mt-1 text-xs font-medium text-muted-foreground outline-none"
          >
            {stepHeadingText}
          </p>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {/* ── Step 1 · Review — also the evidence above a read-only summary ── */}
          {(step === 1 || isTerminal) && current && (
            <>
              <Card>
                <div className="flex items-center gap-2 border-b border-border p-4">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">{claimHeading}</h4>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage
                        src={resolveAvatarUrl(
                          current.raisedBy?.profilePicture,
                          raiserName,
                          24,
                        )}
                      />
                      <AvatarFallback className="text-xs">{raiserName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold text-foreground">{raiserName}</span>
                    {raiserRoleLabel && (
                      <Badge variant="secondary" className="text-xs">
                        {raiserRoleLabel}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {categoryLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      · {fmtDate(current.createdAt)}
                    </span>
                  </div>
                  {/* Untruncated: this is the evidence, not a badge (DC1.7). */}
                  <p className="mt-3 min-w-0 text-sm leading-relaxed whitespace-pre-line text-foreground">
                    {current.reason}
                  </p>
                </div>
              </Card>

              {/* The counterparty's response — captured server-side since DR4
                  and rendered nowhere until now, which is how an admin has
                  been ruling on money after hearing one side. */}
              <Card>
                <div className="flex items-center gap-2 border-b border-border p-4">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">{responseHeading}</h4>
                </div>
                <div className="p-4">
                  {detailLoading && !current.response ? (
                    <Skeleton className="h-24 w-full rounded-lg" />
                  ) : detailFailed && !current.response ? (
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-sm text-muted-foreground">
                        Couldn&apos;t load the full dispute detail.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 bg-transparent px-2 text-xs"
                        onClick={() => disputeId != null && loadDetail(disputeId)}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (detail ?? current).response ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage
                            src={resolveAvatarUrl(
                              (detail ?? current).respondedBy?.profilePicture,
                              partyName((detail ?? current).respondedBy),
                              24,
                            )}
                          />
                          <AvatarFallback className="text-xs">
                            {partyName((detail ?? current).respondedBy)[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-semibold text-foreground">
                          {partyName((detail ?? current).respondedBy)}
                        </span>
                        {counterpartyRole && (
                          <Badge variant="secondary" className="text-xs">
                            {counterpartyRole === "ARTISAN" ? "Artisan" : "Client"}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          · Responded {fmtDate((detail ?? current).respondedAt)}
                        </span>
                      </div>
                      <p className="mt-3 min-w-0 text-sm leading-relaxed whitespace-pre-line text-foreground">
                        {(detail ?? current).response}
                      </p>
                    </>
                  ) : (
                    // No deadline clause anywhere: no response window exists
                    // server-side, so there is nothing to count down and no
                    // "window closed" state to render.
                    <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No response yet — {counterpartyPerson
                          ? partyFirstName(counterpartyPerson)
                          : "the other party"}{" "}
                        was notified on {fmtDate(current.createdAt)}.
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {(detail?.siblingDisputes ?? []).length > 0 && (
                <div className="space-y-1 rounded-lg border border-warning/30 bg-warning/10 p-3">
                  {(detail?.siblingDisputes ?? []).map((s) => (
                    <p key={s.id} className="flex items-start gap-2 text-xs text-foreground">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                      <span>
                        {s.raisedByName ?? "Another party"} also filed dispute #{s.id} on this
                        booking.
                      </span>
                    </p>
                  ))}
                </div>
              )}

              {/* Ad3's linked-payment panel, unchanged. */}
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  Linked Payment
                </p>
                {detailLoading ? (
                  <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking for a linked payment…
                  </div>
                ) : detail?.payment ? (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(detail.payment.amount)}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-1 text-xs",
                          getPaymentStatusConfig(detail.payment.status).className,
                        )}
                      >
                        {getPaymentStatusConfig(detail.payment.status).label}
                      </Badge>
                      {detail.payment.paidAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Paid {fmtDate(detail.payment.paidAt)}
                        </p>
                      )}
                    </div>
                    <Link
                      href="/dashboard/admin/transactions"
                      className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      View in Transactions <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No payment on file for this booking.
                  </p>
                )}
              </div>

              <DisputeConversationPanel
                disputeId={current.id}
                disputeStatus={current.status}
                bookingLabel={
                  current.booking?.id ? `Booking #${current.booking.id}` : undefined
                }
              />
            </>
          )}

          {/* ── The resolved / closed read-only summary (DC1.8) ── */}
          {isTerminal && current && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              {current.status === "RESOLVED" ? (
                <>
                  {current.outcome && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        getDisputeOutcomeConfig(current.outcome).className,
                      )}
                    >
                      {(() => {
                        const OutcomeIcon = getDisputeOutcomeConfig(current.outcome).icon
                        return <OutcomeIcon className="mr-1 h-3 w-3" />
                      })()}
                      {getDisputeOutcomeConfig(current.outcome).label}
                    </Badge>
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-foreground">
                      {current.moneyAction === "REFUND"
                        ? "Refunded to client"
                        : current.moneyAction === "RELEASE"
                          ? "Released to artisan"
                          : "No money moved"}
                    </span>
                    {current.moneyAmount != null &&
                      current.moneyAction &&
                      current.moneyAction !== "NONE" && (
                        <span className="text-lg font-semibold text-foreground">
                          {formatCurrency(current.moneyAmount)}
                        </span>
                      )}
                  </div>
                  {skippedReason && (
                    <p className="text-xs text-muted-foreground">{skippedReason}</p>
                  )}
                  {current.resolution && (
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-sm whitespace-pre-line text-foreground">
                        {current.resolution}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Resolved {fmtDate(current.resolvedAt)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground">
                    This dispute was closed without a verdict.
                  </p>
                  {current.resolution && (
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-sm whitespace-pre-line text-foreground">
                        {current.resolution}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Closed {fmtDate(current.resolvedAt)}
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Step 2 · Record the outcome ── */}
          {step === 2 && !isTerminal && (
            <>
              <RadioGroup
                value={outcome}
                onValueChange={(v) => setOutcome(v as Verdict)}
                aria-label="Verdict"
              >
                {VERDICTS.map(({ value, sub }) => {
                  const cfg = getDisputeOutcomeConfig(value)
                  const isMoneyVerdict = value !== "MUTUAL"
                  const enabled =
                    value === "MUTUAL" || (value === "REFUND_CLIENT" ? canRefund : canRelease)
                  const reason = isMoneyVerdict
                    ? unavailableReason(value === "REFUND_CLIENT" ? "refund" : "release")
                    : null
                  const inlineAmount =
                    value === "MUTUAL"
                      ? "no money moves"
                      : value === "REFUND_CLIENT"
                        ? formatCurrency(refundableAmount)
                        : formatCurrency(releasableAmount)
                  const selected = outcome === value

                  return (
                    /**
                     * A `div` rather than the Transactions dialog's `label`,
                     * because the refund branch nests its own `RadioGroup`
                     * inside this card and a `<label>` cannot contain another
                     * `<label>`. The association is kept explicitly instead —
                     * `Label htmlFor` on the verdict name — so both levels of
                     * radio still have a real label, and the whole card stays
                     * a click target via the handler below.
                     */
                    <div
                      key={value}
                      onClick={() => enabled && setOutcome(value)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3",
                        enabled ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                        selected && "border-primary bg-primary/5",
                      )}
                    >
                      <RadioGroupItem
                        id={`verdict-${value}`}
                        value={value}
                        className="mt-0.5"
                        disabled={!enabled}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <Label
                            htmlFor={`verdict-${value}`}
                            className={cn(
                              "text-sm font-semibold text-foreground",
                              enabled ? "cursor-pointer" : "cursor-not-allowed",
                            )}
                          >
                            {cfg.label}
                          </Label>
                          {enabled && (
                            <p
                              className={cn(
                                "text-sm font-semibold whitespace-nowrap text-foreground",
                                value === "MUTUAL" && "font-normal text-muted-foreground",
                              )}
                            >
                              {inlineAmount}
                            </p>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
                        {/* Disabled and silent is not acceptable: the server's
                            own reason is shown where the amount would be. */}
                        {!enabled && reason && (
                          <p className="mt-1.5 text-xs text-muted-foreground italic">{reason}</p>
                        )}
                        {!enabled && detailFailed && disputeId != null && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 bg-transparent px-2 text-xs"
                            onClick={(e) => {
                              e.preventDefault()
                              void loadDetail(disputeId)
                            }}
                          >
                            Retry
                          </Button>
                        )}

                        {/* The amount control exists on REFUND_CLIENT only —
                            the backend 400s on `refundAmountGhs` with any
                            other verdict, so it must be unconstructible here
                            rather than validated away. */}
                        {value === "REFUND_CLIENT" && selected && enabled && (
                          <div className="mt-2.5 space-y-2">
                            {alreadyRefunded > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Already refunded {formatCurrency(alreadyRefunded)} —{" "}
                                {formatCurrency(refundableAmount)} remains refundable.
                              </p>
                            )}
                            <RadioGroup
                              value={refundMode}
                              onValueChange={(v) => setRefundMode(v as "full" | "partial")}
                              aria-label="Refund amount"
                            >
                              <label
                                htmlFor="refund-mode-full"
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 rounded-lg border p-2.5",
                                  refundMode === "full" && "border-primary bg-primary/5",
                                )}
                              >
                                <RadioGroupItem
                                  id="refund-mode-full"
                                  value="full"
                                  className="mt-0.5"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">
                                    Full refund
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Return the remaining {formatCurrency(refundableAmount)} to
                                    the client&apos;s original payment method.
                                  </p>
                                </div>
                              </label>
                              <label
                                htmlFor="refund-mode-partial"
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 rounded-lg border p-2.5",
                                  refundMode === "partial" && "border-primary bg-primary/5",
                                )}
                              >
                                <RadioGroupItem
                                  id="refund-mode-partial"
                                  value="partial"
                                  className="mt-0.5"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-foreground">
                                    Partial refund
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Return part of the payment — the rest stays held or paid to
                                    the artisan.
                                  </p>
                                  {refundMode === "partial" && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <span className="text-xs font-semibold text-muted-foreground">
                                        GH₵
                                      </span>
                                      <Label htmlFor="dispute-refund-amount" className="sr-only">
                                        Partial refund amount in cedis
                                      </Label>
                                      <Input
                                        id="dispute-refund-amount"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        max={refundableAmount}
                                        className="h-8 max-w-[140px] text-sm"
                                        value={refundAmount}
                                        onChange={(e) => setRefundAmount(e.target.value)}
                                      />
                                    </div>
                                  )}
                                </div>
                              </label>
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </RadioGroup>

              <div className="space-y-1.5">
                <Label htmlFor="dispute-resolution">Resolution note (required)</Label>
                <Textarea
                  id="dispute-resolution"
                  rows={3}
                  maxLength={RESOLUTION_MAX}
                  placeholder="Document the decision and what each party should expect…"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {trimmedResolution.length}/{RESOLUTION_MAX} characters — minimum{" "}
                  {RESOLUTION_MIN}
                </p>
                <p className="text-xs text-muted-foreground">
                  Both parties see this note. Write it for them, not for the log.
                </p>
              </div>

              {consequencePanel && (
                <ConsequencePanel tone={consequencePanel.tone} text={consequencePanel.text} />
              )}
            </>
          )}

          {/* ── Step 3 · Confirm — nothing here submits on render ── */}
          {step === 3 && !isTerminal && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              {outcome !== "" && (
                <Badge
                  variant="outline"
                  className={cn("text-xs", getDisputeOutcomeConfig(outcome).className)}
                >
                  {(() => {
                    const OutcomeIcon = getDisputeOutcomeConfig(outcome).icon
                    return <OutcomeIcon className="mr-1 h-3 w-3" />
                  })()}
                  {getDisputeOutcomeConfig(outcome).label}
                </Badge>
              )}

              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-foreground">{moneyLine().label}</span>
                {moneyLine().amount && (
                  <span className="text-lg font-semibold text-foreground">
                    {moneyLine().amount}
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-sm whitespace-pre-line text-foreground">
                  {trimmedResolution}
                </p>
              </div>

              {consequencePanel && (
                <ConsequencePanel tone={consequencePanel.tone} text={consequencePanel.text} />
              )}

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-3.5 w-3.5" />
                  What both parties will see
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <p>Your resolution note above, in full, on each party&apos;s dispute page.</p>
                  <p>
                    A dispute-resolved notification naming the verdict
                    {outcome === "MUTUAL"
                      ? " and stating that the payment is unchanged."
                      : ", worded from their own side, with the amount in cedis."}
                  </p>
                  <p>Neither party sees your name or any admin-internal note.</p>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>

        {/* The footer sits outside the scroll region so the advance control is
            always reachable — a footer you have to hunt for is what actually
            makes a tall dialog feel like a trap. */}
        {isTerminal ? (
          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        ) : step === 1 ? (
          <DialogFooter className="gap-2">
            <Button variant="outline" className="bg-transparent" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setStep(2)}
            >
              Record outcome
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        ) : step === 2 ? (
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" className="bg-transparent" onClick={() => setStep(1)}>
              ← Back to review
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!canContinue}
              onClick={() => setStep(3)}
            >
              Continue
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              className="bg-transparent"
              disabled={isSubmitting}
              onClick={() => setStep(2)}
            >
              ← Back
            </Button>
            <Button
              variant={outcome === "REFUND_CLIENT" ? "destructive" : "default"}
              className={cn(
                outcome !== "REFUND_CLIENT" &&
                  "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              disabled={isSubmitting || !canContinue}
              onClick={submit}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Recording…" : confirmLabel()}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * The Transactions refund dialog's irreversibility panel, re-toned per verdict.
 * Tone tracks the direction of money, never sentiment — and the warning is
 * carried in the words as well as the colour, so it survives colour being
 * stripped out entirely.
 */
function ConsequencePanel({
  tone,
  text,
}: Readonly<{ tone: "refund" | "release" | "neutral"; text: string }>) {
  const Icon = tone === "neutral" ? Info : AlertTriangle
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg p-3 text-xs",
        tone === "refund" && "border border-destructive/20 bg-destructive/5 text-destructive",
        tone === "release" && "border border-primary/20 bg-primary/5 text-primary",
        tone === "neutral" && "bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{text}</p>
    </div>
  )
}
