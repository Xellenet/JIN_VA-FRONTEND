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
  Settings,
} from "lucide-react"
import type { Notification } from "@/lib/types"

/**
 * Shared status-pill conventions for the Availability/Booking/Job Lifecycle
 * remediation. Reuses the existing bg-, text-, and border- badge pattern
 * already established across the app (see e.g. the old user/bookings/page.tsx
 * statusConfig) instead of inventing a new visual language — EXPIRED and
 * NO_SHOW simply extend the same palette with a couple of previously-unused
 * (but consistent) tones.
 */
export interface StatusBadgeConfig {
  label: string
  className: string
}

/** BookingStatus: PENDING | CONFIRMED | COMPLETED | CANCELLED | DECLINED | EXPIRED | NO_SHOW */
export const bookingStatusConfig: Record<string, StatusBadgeConfig> = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-primary/10 text-primary border-primary/20" },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
  DECLINED: { label: "Declined", className: "bg-red-100 text-red-700 border-red-200" },
  EXPIRED: { label: "Expired", className: "bg-gray-100 text-gray-600 border-gray-200" },
  NO_SHOW: { label: "No-show", className: "bg-orange-100 text-orange-700 border-orange-200" },
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
 * they intentionally share the same orange "needs attention" tone here,
 * distinguished only by label/icon — this is not a departure from the design
 * spec's palette, just coverage for a real backend value the spec predates.
 *
 * IMPORTANT: `HELD` is labelled "Withheld" per the one approved copy change
 * (mockups + design-spec.md already reflect this) — never "Held in Escrow".
 */
export const paymentStatusConfig: Record<string, StatusBadgeConfig & { icon: LucideIcon }> = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  HELD: { label: "Withheld", className: "bg-blue-100 text-blue-700 border-blue-200", icon: Lock },
  PENDING_TRANSFER: { label: "Payout Needs Attention", className: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  TRANSFER_FAILED: { label: "Transfer Failed", className: "bg-orange-100 text-orange-700 border-orange-200", icon: RefreshCcw },
  RELEASED: { label: "Paid Out", className: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  REFUNDED: { label: "Refunded", className: "bg-gray-100 text-gray-600 border-gray-200", icon: ArrowDownRight },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
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
  review:     { icon: Star,          color: "text-foreground",       bg: "bg-muted",      label: "Review" },
  assignment: { icon: Briefcase,     color: "text-foreground",       bg: "bg-muted",      label: "Assignment" },
  message:    { icon: MessageSquare, color: "text-foreground",       bg: "bg-muted",      label: "Message" },
  system:     { icon: Settings,      color: "text-muted-foreground", bg: "bg-muted",      label: "System" },
}

export function getNotificationTypeConfig(type: string): NotificationTypeConfig {
  return notificationTypeConfig[type as Notification["type"]] ?? notificationTypeConfig.system
}
