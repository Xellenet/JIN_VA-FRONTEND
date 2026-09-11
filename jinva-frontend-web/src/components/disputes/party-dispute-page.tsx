"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ClipboardList,
  Clock,
  Gavel,
  HelpCircle,
  Loader2,
  Lock,
  MessageSquare,
  Scale,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { ApiError, apiFetch, apiFetchWithMessage } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import {
  DISPUTE_REASON_MAX,
  DISPUTE_REASON_MIN,
  getDisputeCategoryLabel,
} from "@/lib/disputes"
import {
  getBookingStatusConfig,
  getDisputeOutcomeConfig,
  getDisputeStatusConfig,
} from "@/lib/status-badges"
import { DisputeProgressStrip } from "@/components/disputes/dispute-progress-strip"
import { PartyDisputeSkeleton } from "@/components/disputes/party-dispute-skeleton"

/**
 * DC3 — the party-facing dispute page (design-spec.md §2,
 * mockups/party-dispute-detail.html).
 *
 * The backend for this shipped complete — `GET /disputes/my/:id` and
 * `POST /disputes/:id/respond`, with the two derived fields the UI needs — and
 * the frontend had neither route, so every "View your report" link a party was
 * given after filing was a 404 and the counterparty's response, which PRD
 * §5.13 requires the admin to weigh, could never be submitted at all.
 *
 * One component behind two thin role routes (the `SupportPage` precedent), so
 * the customer and artisan views cannot drift.
 *
 * Two rules this file exists to keep:
 *
 *  1. **Every string keys on `viewerRole`, never on the route that mounted
 *     this component.** Either party can file, so an artisan can be the
 *     raiser. Only the *money* lines legitimately key on which side of the
 *     booking the viewer is on — a refund goes to the client whoever filed —
 *     and that side comes from the authenticated account the server returned,
 *     never from the URL prefix (security-report.md F1). The `role` prop is
 *     for navigation and nothing else.
 *  2. **Nothing is inferred that the payload doesn't carry.** The party read
 *     exposes no payment status and no counterparty summary, so there is no
 *     "the payment is Withheld" line and no Message button here. A party whose
 *     booking never had a payment — the normal case today — must never be told
 *     money is being held that never existed.
 *
 * There is no response-deadline copy anywhere, in any state. `respond()`
 * accepts a response for as long as the dispute is OPEN/UNDER_REVIEW, so
 * promising a window would be promising something the system does not enforce.
 */

export type PartyRole = "user" | "artisan"

interface DisputePerson {
  id: number
  firstname?: string | null
  lastname?: string | null
  profilePicture?: string | null
}

export interface PartyDispute {
  id: number
  booking?: {
    id: number
    scheduledDate?: string
    status?: string
    agreedPrice?: number | null
  }
  raisedBy?: DisputePerson | null
  reason: string
  category?: string | null
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED"
  response?: string | null
  respondedBy?: DisputePerson | null
  respondedAt?: string | null
  outcome?: string | null
  moneyAction?: string | null
  moneyAmount?: number | null
  resolution?: string | null
  resolvedAt?: string | null
  createdAt: string
  updatedAt?: string
  viewerRole: "RAISER" | "COUNTERPARTY"
  canRespond: boolean
}

/**
 * The account-purge job anonymises user rows, and that hits the raiser as
 * readily as the counterparty. One resolver for every name this page renders,
 * so no state can produce an empty string, a bare space, `null` or
 * `undefined` — a purged account must never make a decided dispute unreadable
 * to the party still using the product.
 */
const PURGED_NAME = "a former JinVa user"

function fullName(person?: DisputePerson | null): string {
  const name = `${person?.firstname ?? ""} ${person?.lastname ?? ""}`.trim()
  return name.length > 0 ? name : PURGED_NAME
}

/** `undefined` when there is no usable first name, so callers can fall back. */
function firstNameOrNull(person?: DisputePerson | null): string | undefined {
  const first = (person?.firstname ?? "").trim()
  return first.length > 0 ? first : undefined
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function PartyDisputePage({ role }: Readonly<{ role: PartyRole }>) {
  // Read the id here rather than taking it as a prop, so both route wrappers
  // stay the two-line files the SupportPage precedent sets.
  const params = useParams<{ id: string }>()
  const disputeId = Array.isArray(params?.id) ? params.id[0] : params?.id

  // The signed-in account as the *server* described it (`GET /users/me` via
  // AuthContext) — the only trustworthy answer to "which side of this booking
  // am I on?". See `viewerSide` below.
  const { user: authUser } = useAuth()

  const [dispute, setDispute] = useState<PartyDispute | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading")

  const [draft, setDraft] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const backHref = role === "artisan" ? "/dashboard/artisan/jobs" : "/dashboard/user/bookings"
  const backLabel = role === "artisan" ? "Back to My Jobs" : "Back to My Bookings"
  const supportHref = `/dashboard/${role}/support`

  const load = useCallback(async (id: string) => {
    setState("loading")
    try {
      setDispute(await apiFetch<PartyDispute>(`/disputes/my/${id}`))
      setState("ready")
    } catch (err) {
      // A dispute that doesn't exist and one that isn't yours both 404 by
      // design — an id is never confirmed to a stranger — so they get one
      // identical state here. This is an enumeration boundary, not a copy
      // preference.
      setState(err instanceof ApiError && err.status === 404 ? "unavailable" : "error")
    }
  }, [])

  useEffect(() => {
    if (disputeId) void load(disputeId)
  }, [disputeId, load])

  const backButton = (
    <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
      <Link href={backHref}>
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
    </Button>
  )

  if (state === "loading") return <PartyDisputeSkeleton />

  if (state === "unavailable" || !dispute) {
    return (
      <div className="space-y-6">
        {backButton}
        <Card>
          <Empty className="border-0 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Scale className="text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>This dispute isn&apos;t available</EmptyTitle>
              <EmptyDescription>
                It may have been removed, or it isn&apos;t one of yours.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center gap-2">
              <Button variant="outline" className="bg-transparent" asChild>
                <Link href={backHref}>{backLabel}</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href={supportHref}>Get help</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="space-y-6">
        {backButton}
        <Card>
          <Empty className="border-0 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertTriangle className="text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>Couldn&apos;t load this dispute</EmptyTitle>
              <EmptyDescription>Something went wrong on our end.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center gap-2">
              <Button
                variant="outline"
                className="bg-transparent"
                onClick={() => disputeId && load(disputeId)}
              >
                Try Again
              </Button>
              <Button variant="ghost" asChild>
                <Link href={supportHref}>Get help</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      </div>
    )
  }

  const isRaiser = dispute.viewerRole === "RAISER"
  const isTerminal = dispute.status === "RESOLVED" || dispute.status === "CLOSED"
  const statusCfg = getDisputeStatusConfig(dispute.status)
  const categoryLabel = getDisputeCategoryLabel(dispute.category) ?? "Other"

  const raiserFirst = firstNameOrNull(dispute.raisedBy)
  const responderFirst = firstNameOrNull(dispute.respondedBy)

  // Which side of the *booking* the viewer is on. Used only for the money
  // lines — a refund goes to the client and a release to the artisan, whoever
  // happened to file.
  //
  // This used to read `role === "user"`, i.e. it took "was I the one refunded?"
  // from the URL prefix of the route wrapper that mounted the component
  // (security-report.md F1). The middleware role gate and the server-side
  // scoping of the read both hold today, so it was never wrong — but the one
  // sentence on this page whose whole job is telling someone whether they got
  // their money back should not rest on a client-side fact that a third mount
  // point or a relaxed guard could silently flip.
  //
  // So it comes from server-supplied facts only, and from two of them that
  // have to agree:
  //
  //  - `authUser.role` — the signed-in account's own role from `/users/me`.
  //    Only a CUSTOMER account can create a booking (`POST /bookings` is
  //    `@Roles(Role.CUSTOMER)`), so on any booking the client is the customer
  //    account and the other side is the artisan.
  //  - `viewerRole` vs `raisedBy.id` — the server's answer to "did you file
  //    this?" checked against its answer to "who filed it?". If those two
  //    disagree, the account AuthContext is holding is not the account this
  //    payload was scoped to, so no claim about *whose* money moved is safe.
  //
  // When either is missing or they disagree, the side is `unknown` and the
  // money lines fall back to their impersonal phrasing, which is true for
  // both parties. Nothing is guessed.
  const authUserId = authUser ? Number(authUser.id) : null
  const identityMatchesPayload =
    authUserId != null &&
    Number.isFinite(authUserId) &&
    dispute.raisedBy?.id != null &&
    (dispute.raisedBy.id === authUserId) === isRaiser

  const viewerSide: "client" | "artisan" | "unknown" = !identityMatchesPayload
    ? "unknown"
    : authUser?.role === "user"
      ? "client"
      : authUser?.role === "artisan"
        ? "artisan"
        : "unknown"

  const viewerIsClient = viewerSide === "client"

  /**
   * How to head the other party's response when we have no name for them —
   * the party read carries no counterparty summary, so a purged or
   * not-yet-responded counterparty has none. Keyed on the viewer's own side,
   * with a side-neutral form for when that isn't known.
   */
  const otherPartyResponseHeading =
    viewerSide === "client"
      ? "Artisan's response"
      : viewerSide === "artisan"
        ? "Client's response"
        : "Their response"

  const heading = isRaiser ? "Your dispute" : "Dispute filed against you"
  const claimHeading = isRaiser
    ? "Your report"
    : `What ${raiserFirst ?? PURGED_NAME} reported`

  // `canRespond` is evaluated first: it is the only branch that asks the
  // viewer for something, and a counterparty who owes a response must not be
  // told "our team is reviewing this" instead.
  const statusLine = dispute.canRespond
    ? { text: "Waiting on your response.", emphasised: true }
    : dispute.status === "RESOLVED"
      ? { text: `Resolved on ${fmtDate(dispute.resolvedAt)}.`, emphasised: false }
      : dispute.status === "CLOSED"
        ? { text: `Closed on ${fmtDate(dispute.resolvedAt)}.`, emphasised: false }
        : {
            text: "Our team is reviewing this. We aim to resolve disputes within 48 hours.",
            emphasised: false,
          }

  const trimmedDraft = draft.trim()
  const draftValid =
    trimmedDraft.length >= DISPUTE_REASON_MIN && trimmedDraft.length <= DISPUTE_REASON_MAX

  const submitResponse = async () => {
    if (!draftValid || isSubmitting) return
    setIsSubmitting(true)
    try {
      const { data, message } = await apiFetchWithMessage<PartyDispute>(
        `/disputes/${dispute.id}/respond`,
        { method: "POST", body: JSON.stringify({ response: trimmedDraft }) },
      )
      // The server's line is well written and is the confirmation the party
      // should read — don't compose a competing one.
      toast.success(message ?? "Your response has been recorded.")
      setDispute(data)
      setDraft("")
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      const serverMessage = err instanceof Error ? err.message : ""
      // "Already responded", "this dispute is RESOLVED and can no longer
      // receive a response", and the 403 for a raiser are all states the
      // server describes better than we can. Surface its message and refetch
      // so the card flips to whatever is now true. The typed text is never
      // cleared on a failure.
      if (status === 400 || status === 403) {
        toast.error(serverMessage)
        if (disputeId) void load(disputeId)
      } else {
        toast.error("Couldn't submit your response. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
      setConfirmOpen(false)
    }
  }

  /**
   * DC3.5 — exactly one money line, chosen by `moneyAction` and by which side
   * of the booking the viewer is on. The "to you" variants put the amount in
   * the emphasis position; the other side's variants read as a sentence, since
   * it is somebody else's money moving.
   *
   * Only a *known* side earns a "to you", and each side is asked for
   * explicitly rather than inferred from the negation of the other: the
   * impersonal line is factually true for either reader, so it is the right
   * answer whenever `viewerSide` is `unknown`, and claiming a refund reached
   * someone's account is not.
   */
  type MoneyLine =
    | { kind: "to-you"; label: string; amount: string }
    | { kind: "about-them"; amount: string; tail: string }
    | { kind: "none" }

  const moneyLine = (): MoneyLine => {
    const amount = dispute.moneyAmount
    if (dispute.moneyAction === "REFUND" && amount != null) {
      return viewerIsClient
        ? { kind: "to-you", label: "Refunded to you:", amount: formatCurrency(amount) }
        : { kind: "about-them", amount: formatCurrency(amount), tail: " was refunded to the client" }
    }
    if (dispute.moneyAction === "RELEASE" && amount != null) {
      return viewerSide === "artisan"
        ? { kind: "to-you", label: "Released to you:", amount: formatCurrency(amount) }
        : { kind: "about-them", amount: formatCurrency(amount), tail: " was released to the artisan" }
    }
    // Includes every MUTUAL verdict, and a resolved dispute whose amount is
    // absent — no amount and no zero is ever shown.
    return { kind: "none" }
  }

  const money = moneyLine()
  const viewerWasRefunded = dispute.moneyAction === "REFUND" && viewerIsClient

  return (
    <div className="space-y-6">
      {backButton}

      <div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{heading}</h1>
            <p className="text-muted-foreground">
              {categoryLabel}
              {dispute.booking?.id ? ` · Booking #${dispute.booking.id}` : ""} · Filed{" "}
              {fmtDate(dispute.createdAt)}
            </p>
          </div>
          <Badge variant="outline" className={cn("w-fit", statusCfg.className)}>
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
            {statusCfg.label}
          </Badge>
        </div>
        <p
          className={cn(
            "mt-2.5 text-sm",
            statusLine.emphasised ? "font-medium text-primary" : "text-foreground",
          )}
        >
          {statusLine.text}
        </p>
      </div>

      <DisputeProgressStrip status={dispute.status} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* The outcome sits first once a decision exists — it is what the
              party came back for. */}
          {isTerminal && (
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <Gavel className="h-4 w-4 text-primary" />
                  {dispute.status === "RESOLVED" ? "The decision" : "This dispute was closed"}
                </h3>
              </div>
              <CardContent className="space-y-3 p-5">
                {dispute.status === "RESOLVED" ? (
                  <>
                    {/* `close()` records no outcome, so a CLOSED dispute gets
                        no badge and no money tile — an empty pill is worse
                        than none. */}
                    {dispute.outcome &&
                      (() => {
                        const cfg = getDisputeOutcomeConfig(dispute.outcome)
                        const Icon = cfg.icon
                        return (
                          <Badge variant="outline" className={cn("w-fit", cfg.className)}>
                            <Icon className="mr-1.5 h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        )
                      })()}

                    <div
                      className={cn(
                        "rounded-lg border border-border p-4",
                        money.kind !== "none" && "bg-primary/5",
                      )}
                    >
                      {money.kind === "to-you" ? (
                        <p className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm text-foreground">{money.label}</span>
                          <span className="text-lg font-semibold text-foreground">
                            {money.amount}
                          </span>
                        </p>
                      ) : money.kind === "about-them" ? (
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">{money.amount}</span>
                          {money.tail}
                        </p>
                      ) : (
                        // "No change to the payment" is information, not a
                        // headline — so this variant drops the emphasis fill.
                        <p className="text-sm text-foreground">No change to the payment.</p>
                      )}
                    </div>

                    {dispute.resolution && (
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-sm whitespace-pre-line text-foreground">
                          {dispute.resolution}
                        </p>
                        {/* Never a staff name: the party payload carries no
                            `resolvedBy` at all, by construction. */}
                        <p className="mt-2.5 text-xs text-muted-foreground">
                          JinVa Support · {fmtDate(dispute.resolvedAt)}
                        </p>
                      </div>
                    )}

                    {viewerWasRefunded && (
                      <p className="text-xs text-muted-foreground">
                        Refunds usually reach your account within 5–10 business days.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-sm text-foreground">
                        Our team closed this dispute without ruling for either side.
                      </p>
                    </div>
                    {dispute.resolution && (
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-sm whitespace-pre-line text-foreground">
                          {dispute.resolution}
                        </p>
                        <p className="mt-2.5 text-xs text-muted-foreground">
                          JinVa Support · {fmtDate(dispute.resolvedAt)}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Closed {fmtDate(dispute.resolvedAt)}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* The claim */}
          <Card>
            <div className="border-b border-border p-5">
              <h3 className="flex items-center gap-2 font-semibold text-foreground">
                <Scale className="h-4 w-4 text-primary" />
                {claimHeading}
              </h3>
            </div>
            <CardContent className="p-5">
              <Badge variant="secondary" className="text-xs">
                {categoryLabel}
              </Badge>
              {/* `whitespace-pre-line` is load-bearing: this is up to 2000
                  characters of someone's account of events, usually typed with
                  line breaks. No truncation and no "read more" — both accounts
                  readable in full is the point. */}
              <p className="mt-3 min-w-0 text-sm leading-relaxed whitespace-pre-line text-foreground">
                {dispute.reason}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Filed by {isRaiser ? "you" : fullName(dispute.raisedBy)} ·{" "}
                {fmtDate(dispute.createdAt)}
              </p>
            </CardContent>
          </Card>

          {/* The response — four variants, gated on `canRespond` alone. */}
          {dispute.canRespond ? (
            <Card>
              <div className="border-b border-primary/20 bg-primary/5 p-5">
                <div className="flex items-start gap-2">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold text-foreground">Your response is needed</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Our team reads both accounts before deciding.
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="space-y-3 p-5">
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
                  {/* A card header is not a form label. */}
                  <Label htmlFor="dispute-response" className="mb-1.5 block">
                    Your side of what happened
                  </Label>
                  <Textarea
                    id="dispute-response"
                    rows={5}
                    maxLength={DISPUTE_REASON_MAX}
                    placeholder={
                      raiserFirst
                        ? `Tell us what happened from your side, with dates if you can. ${raiserFirst} and our team will both read this.`
                        : "Tell us what happened from your side, with dates if you can. Our team will read this."
                    }
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {trimmedDraft.length}/{DISPUTE_REASON_MAX} characters — minimum{" "}
                    {DISPUTE_REASON_MIN}
                  </p>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    You can only respond once, so include everything you want our team to know.
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={!draftValid || isSubmitting}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting ? "Submitting…" : "Submit response"}
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-transparent"
                    disabled={isSubmitting || draft.length === 0}
                    onClick={() => setDraft("")}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : dispute.response ? (
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  {isRaiser
                    ? responderFirst
                      ? `${responderFirst}'s response`
                      : otherPartyResponseHeading
                    : "Your response"}
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="rounded-r-lg border-l-2 border-primary bg-primary/5 py-2 pr-2 pl-3">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-primary">
                    <MessageSquare className="h-3 w-3" />
                    {isRaiser
                      ? responderFirst
                        ? `${responderFirst}'s response`
                        : otherPartyResponseHeading
                      : "Your response"}
                    <span className="font-normal text-muted-foreground">
                      · {fmtDate(dispute.respondedAt)}
                    </span>
                  </p>
                  <p className="mt-1 min-w-0 text-sm leading-relaxed whitespace-pre-line text-foreground">
                    {dispute.response}
                  </p>
                </div>
                {/* Only when it is theirs — a raiser gets no reassurance line
                    about somebody else's words. */}
                {!isRaiser && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Our team has your response.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  {otherPartyResponseHeading}
                </h3>
              </div>
              <CardContent className="p-5">
                {/* The copy differs by *reason*: a dispute nobody answered
                    before it was decided is not the same as one still waiting.
                    No deadline in either. */}
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isTerminal
                      ? "No response was submitted before this dispute was decided."
                      : `${raiserFirst && !isRaiser ? raiserFirst : "This person"} hasn't responded yet.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Rail */}
        <div className="space-y-6">
          <Card>
            <div className="border-b border-border p-5">
              <h3 className="flex items-center gap-2 font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                Booking
              </h3>
            </div>
            <CardContent className="space-y-3 p-5">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Booking</p>
                <p className="mt-1 font-mono text-xs font-medium text-foreground">
                  #{dispute.booking?.id ?? "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Scheduled</p>
                <p className="mt-1 font-medium text-foreground">
                  {fmtDate(dispute.booking?.scheduledDate)}
                </p>
                {dispute.booking?.status && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-2 w-fit",
                      getBookingStatusConfig(dispute.booking.status).className,
                    )}
                  >
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                    {getBookingStatusConfig(dispute.booking.status).label}
                  </Badge>
                )}
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Agreed price</p>
                {/* Never GH₵ 0 for a missing price — the app's own fallback. */}
                <p className="mt-1 font-medium text-foreground">
                  {dispute.booking?.agreedPrice != null
                    ? formatCurrency(dispute.booking.agreedPrice)
                    : "Not specified"}
                </p>
              </div>
              {/* No "the payment for this job is Withheld" line: the party read
                  exposes no payment status, and most disputes have no payment
                  behind them at all, so stating it would be a guess about
                  somebody's money. Omitted rather than guessed. */}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5">
              {/* "Message {counterparty}" needs the counterparty summary the
                  party read doesn't carry yet — omitted rather than rendered
                  disabled, since the only reason would be missing data. Same
                  for the artisan's "View linked job", which needs a jobId. */}
              {role === "user" && dispute.booking?.id && (
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <Link href={`/dashboard/user/bookings/${dispute.booking.id}`}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    View booking
                  </Link>
                </Button>
              )}
              <Button variant="ghost" className="w-full" asChild>
                <Link href={supportHref}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Get help
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* One shot, uneditable, and an admin will rule money on it — the same
          category of irreversibility the admin's own action gets a
          confirmation for. The safe option names itself. */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => !isSubmitting && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your response?</AlertDialogTitle>
            <AlertDialogDescription>
              This is the one response you can add to this dispute. Once it&apos;s submitted you
              can&apos;t edit it or add to it — our team will read it as your account of what
              happened.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault()
                void submitResponse()
              }}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit response
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
