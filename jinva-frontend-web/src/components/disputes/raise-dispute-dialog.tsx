"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Clock, Loader2, Lock, MessageSquare } from "lucide-react"
import { naviiAvatar, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { ApiError, apiFetch } from "@/lib/api"
import {
  DISPUTE_CATEGORIES,
  DISPUTE_REASON_MAX,
  DISPUTE_REASON_MIN,
  findMyDisputeForBooking,
} from "@/lib/disputes"
import { getPaymentStatusConfig } from "@/lib/status-badges"

/**
 * DP1 / design-spec.md §6 — "Report a problem".
 *
 * `POST /disputes` has been implemented, tested and reachable from nowhere in
 * the product. This is the dialog that finally reaches it, mounted from the
 * actions card on the customer booking, customer job and artisan job detail
 * pages via `DisputeEntryPoint`.
 *
 * Copy is deliberately "Report a problem", not "File a dispute": nobody's
 * first dispute should read like a court form. The three "what happens next"
 * lines exist because a first-time disputer has no model of this process, and
 * the third one reuses the settled "Withheld" term verbatim from
 * `paymentStatusConfig` — never "escrow".
 */

export interface RaiseDisputeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The booking the dispute is filed against — disputes are booking-scoped. */
  bookingId: number
  /** Human label for what is being disputed, e.g. "Kitchen sink replacement". */
  contextTitle: string
  counterpartyName: string
  counterpartyRole: "Artisan" | "Client"
  counterpartyAvatar?: string
  /** Completion/cancellation date, when the parent page has one. */
  contextDate?: string
  /** Agreed price / job amount, when the parent page has one. */
  amount?: number
  /** Payment status, so the context panel can show the real badge. */
  paymentStatus?: string
  /**
   * Role-appropriate base path for a party's own dispute, e.g.
   * "/dashboard/user/disputes". Used only for the "you already reported this"
   * recovery link.
   */
  disputeHrefBase: string
  /** Called with the new dispute's id once it is created. */
  onCreated?: (disputeId: number) => void
}

function fmtDate(iso?: string): string | undefined {
  if (!iso) return undefined
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function RaiseDisputeDialog({
  open,
  onOpenChange,
  bookingId,
  contextTitle,
  counterpartyName,
  counterpartyRole,
  counterpartyAvatar,
  contextDate,
  amount,
  paymentStatus,
  disputeHrefBase,
  onCreated,
}: Readonly<RaiseDisputeDialogProps>) {
  const [category, setCategory] = useState("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [duplicateDisputeId, setDuplicateDisputeId] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      setCategory("")
      setReason("")
      setIsSubmitting(false)
      setDuplicateDisputeId(null)
    }
  }, [open])

  const trimmed = reason.trim()
  const isValid =
    category !== "" && trimmed.length >= DISPUTE_REASON_MIN && trimmed.length <= DISPUTE_REASON_MAX

  const submit = async () => {
    if (!isValid || isSubmitting) return
    setIsSubmitting(true)
    try {
      /**
       * The `category` field is settled scope for this round (DR5) but
       * `CreateDisputeDto` does not accept it yet, and the API runs
       * `ValidationPipe` with `forbidNonWhitelisted: true` — so until the
       * backend lands it, sending it 400s with "property category should not
       * exist". Rather than drop the user's selection silently (a control that
       * discards input) or block filing entirely, send it and retry once
       * without it on exactly that rejection. The moment the backend accepts
       * the field this fallback stops being reached and the retry can be
       * deleted. See lib/disputes.ts for the agreed value list.
       */
      let created: { id?: number } | undefined
      try {
        created = await apiFetch<{ id?: number }>("/disputes", {
          method: "POST",
          body: JSON.stringify({ bookingId, reason: trimmed, category }),
        })
      } catch (err) {
        const rejectsCategory =
          err instanceof ApiError && err.status === 400 && /category/i.test(err.message)
        if (!rejectsCategory) throw err
        created = await apiFetch<{ id?: number }>("/disputes", {
          method: "POST",
          body: JSON.stringify({ bookingId, reason: trimmed }),
        })
      }

      toast.success("Report submitted. Our team will review it within 48 hours.")
      onOpenChange(false)
      if (created?.id) onCreated?.(created.id)
      else onCreated?.(0)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't submit your report."
      // The backend enforces one dispute per booking per raiser. Route the
      // user to the report they already have instead of a dead end — the
      // error carries no id, so look it up from their own dispute list.
      if (/already raised/i.test(message)) {
        toast.error("You already have an open report for this booking.")
        try {
          const existing = await findMyDisputeForBooking(apiFetch, bookingId)
          setDuplicateDisputeId(existing?.id ?? 0)
        } catch {
          setDuplicateDisputeId(0)
        }
      } else {
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const dateLabel = fmtDate(contextDate)
  const paymentCfg = paymentStatus ? getPaymentStatusConfig(paymentStatus) : null
  const PaymentIcon = paymentCfg?.icon

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>
            {contextTitle} · Booking #{bookingId}
            {amount != null ? ` · ${formatCurrency(amount)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {/* Context panel — so nobody reports the wrong job */}
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={counterpartyAvatar || naviiAvatar(counterpartyName, 36)} />
              <AvatarFallback className="text-xs">{counterpartyName[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <span className="truncate">{counterpartyName}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {counterpartyRole}
                </Badge>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {dateLabel && <span>{dateLabel}</span>}
                {amount != null && <span>· {formatCurrency(amount)}</span>}
                {paymentCfg && PaymentIcon && (
                  <Badge variant="outline" className={`text-[10px] ${paymentCfg.className}`}>
                    <PaymentIcon className="mr-1 h-2.5 w-2.5" />
                    {paymentCfg.label}
                  </Badge>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dispute-category">What&apos;s the problem about?</Label>
          <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
            <SelectTrigger id="dispute-category" className="h-9">
              <SelectValue placeholder="Choose the closest match" />
            </SelectTrigger>
            <SelectContent>
              {DISPUTE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dispute-reason">What went wrong?</Label>
          <Textarea
            id="dispute-reason"
            rows={5}
            maxLength={DISPUTE_REASON_MAX}
            placeholder="Describe what happened, with dates if you can. The other party and our team will both read this."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            {trimmed.length}/{DISPUTE_REASON_MAX} characters — minimum {DISPUTE_REASON_MIN}
          </p>
        </div>

        {/* What happens next */}
        <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">
              Our team reviews reports within 48 hours.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{counterpartyName} is notified and can respond.</span>
          </p>
          <p className="flex items-start gap-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Any payment on this job stays{" "}
              <span className="font-medium text-foreground">
                {getPaymentStatusConfig("HELD").label}
              </span>{" "}
              until the report is resolved.
            </span>
          </p>
        </div>

        <DialogFooter className="gap-2">
          {duplicateDisputeId !== null ? (
            duplicateDisputeId > 0 ? (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <Link href={`${disputeHrefBase}/${duplicateDisputeId}`}>View your report</Link>
              </Button>
            ) : (
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            )
          ) : (
            <>
              <Button
                variant="outline"
                className="bg-transparent"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!isValid || isSubmitting}
                onClick={submit}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit report
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
