/**
 * Dispute categories — design-spec.md §6 (settled per §15 item 3) and
 * requirements.md DR5.
 *
 * The seven values are fixed by the design spec's copy; the enum *keys* below
 * are this module's single source of truth so the raise-dispute Select, the
 * admin queue's category filter and the queue row badge all read the same
 * list. If the backend lands a different key for any of these, change it
 * here once — nothing else hardcodes a category string.
 *
 * NOTE for the backend engineer: `CreateDisputeDto` does not accept a
 * `category` field yet, and the app's global `ValidationPipe` runs with
 * `forbidNonWhitelisted: true`, so `POST /disputes` rejects the body until it
 * does. See the raise-dispute dialog for how that is handled today.
 */
export const DISPUTE_CATEGORIES = [
  { value: "WORK_NOT_COMPLETED", label: "Work not completed" },
  { value: "WORK_QUALITY", label: "Work quality" },
  { value: "ARTISAN_NO_SHOW", label: "Artisan didn't show up" },
  { value: "CLIENT_NO_ACCESS", label: "Client didn't provide access" },
  { value: "PAYMENT_AMOUNT", label: "Payment amount" },
  { value: "PROPERTY_DAMAGE", label: "Damage to property" },
  { value: "OTHER", label: "Other" },
] as const

export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number]["value"]

export function getDisputeCategoryLabel(value?: string | null): string | undefined {
  if (!value) return undefined
  return DISPUTE_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

/** Backend `CreateDisputeDto` bounds — validated client-side before the request (DP1). */
export const DISPUTE_REASON_MIN = 20
export const DISPUTE_REASON_MAX = 2000

/** Booking statuses the backend accepts a dispute on (`DisputesService.raise`). */
export const DISPUTABLE_BOOKING_STATUSES = ["COMPLETED", "CANCELLED"] as const
