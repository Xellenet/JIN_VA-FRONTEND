import type { LucideIcon } from "lucide-react"
import {
  Clock,
  Lock,
  AlertTriangle,
  RefreshCcw,
  CheckCircle2,
  ArrowDownRight,
  XCircle,
  AlertCircle,
  Calendar,
  CreditCard,
  Star,
  Briefcase,
  MessageSquare,
  Scale,
  Settings,
  Handshake,
} from "lucide-react"
import type { Notification } from "@/lib/types"

/**
 * Shared status-pill conventions for the Availability/Booking/Job Lifecycle
 * remediation. Reuses the existing bg-, text-, and border- badge pattern
 * already established across the app (see e.g. the old user/bookings/page.tsx
 * statusConfig) instead of inventing a new visual language.
 *
 * DT2 (2026-08-27) — every map below now reads from the DT1 semantic tokens
 * (`--success` / `--warning` / `--attention` / `--info`, defined in
 * src/app/globals.css) instead of light-mode-only Tailwind palette literals
 * (`bg-yellow-100 text-yellow-700 border-yellow-200`, …) which carried no
 * `dark:` variants and rendered washed-out or illegible on the app's real dark
 * theme. The literal -> token mapping is design-spec.md §1.3 verbatim; nothing
 * here was invented locally.
 *
 * Two consequences worth knowing, both intended and both flagged in the design
 * spec rather than shipped silently:
 *   • Light-mode status pills are very slightly DEEPER than before. That is the
 *     point: `yellow-100/700` and `orange-100/700` measured ~4.4:1 and FAILED
 *     WCAG AA, and `green-100/700` passed by 0.07. The tokens clear 4.5:1 by at
 *     least 1.3x in both themes.
 *   • `disputeStatusConfig.OPEN`, `bookingStatusConfig.CANCELLED` and
 *     `disputeOutcomeConfig.REFUND_CLIENT` all render on `--destructive` now.
 *     They never share a column, and each carries a distinct label + icon, so
 *     the no-colour-only-signalling rule still holds. Do not invent a fifth
 *     tone to separate them.
 *
 * LABELS AND ICONS ARE FROZEN by DT2 — only the colour source changed. In
 * particular `HELD` stays "Withheld". `notificationTypeConfig` at the bottom of
 * this file already used tokens and is untouched.
 */
export interface StatusBadgeConfig {
  label: string
  className: string
}

/** BookingStatus: PENDING | CONFIRMED | COMPLETED | CANCELLED | DECLINED | EXPIRED | NO_SHOW */
export const bookingStatusConfig: Record<string, StatusBadgeConfig> = {
  PENDING: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  CONFIRMED: { label: "Confirmed", className: "bg-primary/10 text-primary border-primary/20" },
  COMPLETED: { label: "Completed", className: "bg-success/10 text-success border-success/20" },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
  DECLINED: { label: "Declined", className: "bg-destructive/10 text-destructive border-destructive/20" },
  EXPIRED: { label: "Expired", className: "bg-muted text-muted-foreground border-border" },
  NO_SHOW: { label: "No-show", className: "bg-attention/10 text-attention border-attention/20" },
}

export function getBookingStatusConfig(status: string): StatusBadgeConfig {
  return bookingStatusConfig[status] ?? { label: status, className: "" }
}

/**
 * PaymentStatus badge map — Payments Integration (2026-08-20).
 *
 * Every payment-status badge across this feature (job detail — customer and
 * artisan, customer payment history, artisan earnings, admin transactions,
 * disputes' linked-payment panel) uses this single map. See
 * docs/team/payments-integration/design-spec.md section 4 for the source of
 * truth on labels/classes/icons — colors reuse existing tones already used
 * elsewhere in the app (bookingStatusConfig, the old transactions mock), no
 * new palette is introduced.
 *
 * The backend's PaymentStatus enum (JIN_VA-BACKEND `common/types/enums.ts`)
 * has grown one value beyond the design spec's original 7 —
 * `TRANSFER_FAILED` (a transfer that was attempted and then failed/reversed,
 * or whose initiation itself errored, as opposed to `PENDING_TRANSFER`'s
 * "never attempted, no payout method on file" case). Both states are
 * retryable via the same `POST /payments/retry-transfer/:jobId` action, so
 * they intentionally share the same `--attention` "needs a human to act, but
 * this is not a failure" tone here, distinguished only by label/icon — this is
 * not a departure from the design spec's palette, just coverage for a real
 * backend value the spec predates.
 *
 * IMPORTANT: `HELD` is labelled "Withheld" per the one approved copy change
 * (mockups + design-spec.md already reflect this) — never "Held in Escrow".
 */
export const paymentStatusConfig: Record<string, StatusBadgeConfig & { icon: LucideIcon }> = {
  PENDING: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  HELD: { label: "Withheld", className: "bg-info/10 text-info border-info/20", icon: Lock },
  PENDING_TRANSFER: { label: "Payout Needs Attention", className: "bg-attention/10 text-attention border-attention/20", icon: AlertTriangle },
  TRANSFER_FAILED: { label: "Transfer Failed", className: "bg-attention/10 text-attention border-attention/20", icon: RefreshCcw },
  RELEASED: { label: "Paid Out", className: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  REFUNDED: { label: "Refunded", className: "bg-muted text-muted-foreground border-border", icon: ArrowDownRight },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  FAILED: { label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertCircle },
}

export function getPaymentStatusConfig(status: string): StatusBadgeConfig & { icon: LucideIcon } {
  return paymentStatusConfig[status] ?? { label: status, className: "", icon: AlertCircle }
}

/**
 * Retryable payout states — `POST /payments/retry-transfer/:jobId` matches
 * both on the backend (see `retryPendingTransfer`'s `In([...])` query).
 */
export const RETRYABLE_PAYOUT_STATUSES = ["PENDING_TRANSFER", "TRANSFER_FAILED"] as const

/**
 * DisputeStatus badge map — Analytics/Admin/Disputes round (2026-08-24),
 * design-spec.md §2.1 / requirements.md DQ5.
 *
 * Retires the page-local `statusCfg` that lived in
 * `admin/disputes/page.tsx`, which gave `UNDER_REVIEW` and `CLOSED` the same
 * muted tone — two statuses that mean opposite things (active work vs.
 * finished) rendered pixel-identical. Every dispute badge (admin queue,
 * admin detail, and both party-facing surfaces) reads from here.
 *
 * No new colour is introduced: `--warning` is already this app's
 * "in progress / awaiting" tone (`bookingStatusConfig.PENDING`,
 * `paymentStatusConfig.PENDING`) and muted is already its terminal-neutral
 * tone (`EXPIRED`, `REFUNDED`).
 */
export const disputeStatusConfig: Record<string, StatusBadgeConfig & { icon: LucideIcon }> = {
  OPEN:         { label: "Open",         className: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
  UNDER_REVIEW: { label: "Under Review", className: "bg-warning/10 text-warning border-warning/20",             icon: Clock },
  RESOLVED:     { label: "Resolved",     className: "bg-primary/10 text-primary border-primary/20",             icon: CheckCircle2 },
  CLOSED:       { label: "Closed",       className: "bg-muted text-muted-foreground border-border",             icon: XCircle },
}

export function getDisputeStatusConfig(status: string): StatusBadgeConfig & { icon: LucideIcon } {
  return disputeStatusConfig[status] ?? { label: status, className: "", icon: AlertCircle }
}

/**
 * Dispute outcome (verdict) badge map — design-spec.md §2.2.
 *
 * The three PRD §5.13 verdicts. Tones and glyphs deliberately borrow from
 * `paymentStatusConfig` rather than inventing dispute-specific ones: a
 * dispute ruled for the client *is* a refund (`REFUNDED`'s
 * `ArrowDownRight`), and one ruled for the artisan *is* a release
 * (`RELEASED`'s `CheckCircle2`), so an admin who has used the Transactions
 * screen recognises the money consequence from the badge alone.
 *
 * The `resolve` endpoint does not accept or return an outcome yet (that is
 * this round's backend work) — this map exists now so the queue, the admin
 * detail surface and both party views all read identically the moment it
 * does.
 */
export const disputeOutcomeConfig: Record<string, StatusBadgeConfig & { icon: LucideIcon }> = {
  REFUND_CLIENT:   { label: "Ruled for client",   className: "bg-destructive/10 text-destructive border-destructive/20", icon: ArrowDownRight },
  RELEASE_ARTISAN: { label: "Ruled for artisan",  className: "bg-success/10 text-success border-success/20",             icon: CheckCircle2 },
  MUTUAL:          { label: "Mutually resolved",  className: "bg-muted text-muted-foreground border-border",             icon: Handshake },
}

export function getDisputeOutcomeConfig(outcome: string): StatusBadgeConfig & { icon: LucideIcon } {
  return disputeOutcomeConfig[outcome] ?? { label: outcome, className: "", icon: AlertCircle }
}

/**
 * Notification type-icon chips — Messaging & Notifications (2026-08-21).
 *
 * Extracted out of `notifications-page.tsx`'s local `typeConfig` so the same
 * map drives every surface that renders one of these chips (the Notifications
 * feed and the header's notification dropdown), matching the
 * `bookingStatusConfig`/`paymentStatusConfig` pattern above. See
 * docs/team/messaging-notifications/design-spec.md section 2 and
 * requirements.md's UI/UX notes.
 *
 * `review`, `assignment` and `message` previously used literal light-mode-only
 * palette colors (`bg-yellow-100 text-yellow-600`, `bg-blue-100
 * text-blue-600`, `bg-violet-100 text-violet-600`) with no `dark:` variants,
 * which rendered muddy on the dark theme at the 40px chip scale. They now use
 * the semantic tokens the other three categories in this map already used, so
 * the app's real `.dark` theme handles them. This is a deliberate reduction
 * from six arbitrary hues to two meaningful tones — `bg-primary/10
 * text-primary` for money (unchanged), `bg-muted` for everything routine —
 * since the glyph and the text label already carry the category.
 */
export interface NotificationTypeConfig {
  icon: LucideIcon
  color: string
  bg: string
  label: string
}

export const notificationTypeConfig: Record<Notification["type"], NotificationTypeConfig> = {
  booking:    { icon: Calendar,      color: "text-foreground",       bg: "bg-muted",      label: "Booking" },
  payment:    { icon: CreditCard,    color: "text-primary",          bg: "bg-primary/10", label: "Payment" },
  // `DISPUTE_FILED`/`DISPUTE_RESOLVED`/`DISPUTE_CLOSED` are real types now
  // (api-contract.md §5), so a dispute outcome no longer lands in the generic
  // "System" bucket. Same emphasis tone as money — it matters as much to the
  // affected user (design-spec.md §2/§6.5).
  dispute:    { icon: Scale,         color: "text-primary",          bg: "bg-primary/10", label: "Dispute" },
  review:     { icon: Star,          color: "text-foreground",       bg: "bg-muted",      label: "Review" },
  assignment: { icon: Briefcase,     color: "text-foreground",       bg: "bg-muted",      label: "Assignment" },
  message:    { icon: MessageSquare, color: "text-foreground",       bg: "bg-muted",      label: "Message" },
  system:     { icon: Settings,      color: "text-muted-foreground", bg: "bg-muted",      label: "System" },
}

export function getNotificationTypeConfig(type: string): NotificationTypeConfig {
  return notificationTypeConfig[type as Notification["type"]] ?? notificationTypeConfig.system
}
