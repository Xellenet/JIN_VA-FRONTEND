"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { getDisputeStatusConfig } from "@/lib/status-badges"
import { findMyDisputeForBooking, type MyDisputeSummary } from "@/lib/disputes"
import { RaiseDisputeDialog } from "@/components/disputes/raise-dispute-dialog"

/**
 * DP1 / design-spec.md §6 §8 — the "Report a problem" entry point, shared by
 * the three detail pages that need it (customer booking, customer job, artisan
 * job) so the eligibility rule and the "you already reported this" swap are
 * written once.
 *
 * Three states, per the mockup:
 *  1. Eligible → the outline "Report a problem" button, which opens the dialog.
 *  2. Not eligible → the same button, **disabled with the reason stated**.
 *     Hiding it entirely leaves a user hunting for a route that does exist;
 *     disabling it with a reason teaches the rule (and mirrors the backend's
 *     real one: a dispute is only accepted on a COMPLETED or CANCELLED
 *     booking).
 *  3. Already reported → the button is replaced by the dispute's current
 *     status badge and a "View your report" link.
 *
 * Not `variant="destructive"`: filing a report is not itself destructive, and
 * red would deter legitimate use.
 */

export interface DisputeEntryPointProps {
  /**
   * The booking to file against. `undefined` when the parent is a job with no
   * linked booking — disputes are booking-scoped, so there is nothing to file
   * against and the button says so.
   */
  bookingId?: number
  /** Whether the underlying booking/job has reached a disputable state. */
  isEligible: boolean
  /** Shown under the disabled button when `isEligible` is false. */
  ineligibleReason: string
  contextTitle: string
  counterpartyName: string
  counterpartyRole: "Artisan" | "Client"
  counterpartyAvatar?: string
  contextDate?: string
  amount?: number
  paymentStatus?: string
  /** e.g. "/dashboard/user/disputes" or "/dashboard/artisan/disputes". */
  disputeHrefBase: string
  className?: string
}

export function DisputeEntryPoint({
  bookingId,
  isEligible,
  ineligibleReason,
  contextTitle,
  counterpartyName,
  counterpartyRole,
  counterpartyAvatar,
  contextDate,
  amount,
  paymentStatus,
  disputeHrefBase,
  className,
}: Readonly<DisputeEntryPointProps>) {
  const [existing, setExisting] = useState<MyDisputeSummary | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const check = useCallback(async () => {
    if (!bookingId) {
      setExisting(null)
      setIsChecking(false)
      return
    }
    try {
      // `GET /disputes/my` returns every dispute this user raised, with its
      // booking — the only way to know whether they already filed on this one.
      setExisting((await findMyDisputeForBooking(apiFetch, bookingId)) ?? null)
    } catch {
      // A failed check must not hide the action — fall through to offering it,
      // and let the backend's own duplicate guard be the real gate.
      setExisting(null)
    } finally {
      setIsChecking(false)
    }
  }, [bookingId])

  useEffect(() => {
    check()
  }, [check])

  if (isChecking) return null

  if (existing) {
    const cfg = getDisputeStatusConfig(existing.status)
    const StatusIcon = cfg.icon
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Your report</span>
          <Badge variant="outline" className={cn("text-xs", cfg.className)}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {cfg.label}
          </Badge>
        </div>
        <Button variant="outline" className="w-full bg-transparent" asChild>
          <Link href={`${disputeHrefBase}/${existing.id}`}>
            View your report
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    )
  }

  const canFile = isEligible && Boolean(bookingId)
  const reason = bookingId
    ? ineligibleReason
    : "Reports are filed against the booking behind a job, and this one isn't linked to a booking."

  return (
    <div className={cn("space-y-1.5", className)}>
      <Button
        variant="outline"
        className="w-full bg-transparent"
        disabled={!canFile}
        title={canFile ? undefined : reason}
        onClick={() => setDialogOpen(true)}
      >
        <AlertTriangle className="mr-2 h-4 w-4" />
        Report a problem
      </Button>
      {!canFile && <p className="text-xs text-muted-foreground">{reason}</p>}

      {canFile && bookingId && (
        <RaiseDisputeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          bookingId={bookingId}
          contextTitle={contextTitle}
          counterpartyName={counterpartyName}
          counterpartyRole={counterpartyRole}
          counterpartyAvatar={counterpartyAvatar}
          contextDate={contextDate}
          amount={amount}
          paymentStatus={paymentStatus}
          disputeHrefBase={disputeHrefBase}
          onCreated={check}
        />
      )}
    </div>
  )
}
