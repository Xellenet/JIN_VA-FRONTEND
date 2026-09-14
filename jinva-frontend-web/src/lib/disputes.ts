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

/** The subset of `GET /disputes/my` a job/booking page needs. */
export interface MyDisputeSummary {
  id: number
  status: string
  booking?: { id: number }
  /**
   * Which side of the dispute the caller is on. `GET /disputes/my` returns
   * disputes filed **against** the caller as well as ones they filed, so this
   * is what decides whether the strip may call it "your report".
   */
  viewerRole?: "RAISER" | "COUNTERPARTY"
  /** True only when the caller is the counterparty and still owes a response. */
  canRespond?: boolean
}

/**
 * Which dispute on a booking this viewer should be shown.
 *
 * The backend enforces one dispute per booking *per raiser* and rejects a
 * second attempt with a message rather than an id, so both the entry point
 * (before offering the action) and the raise dialog (recovering from that
 * rejection) resolve it the same way — from the caller's own dispute list.
 *
 * The selection is deliberate rather than incidental. Both parties may each
 * file on one booking, and since `GET /disputes/my` widened to include
 * disputes filed against the caller, a bare `.find()` let **array order**
 * decide which dispute a viewer was linked to — so a viewer could be sent to
 * the other party's dispute. The order below is the one DC3.6 requires:
 *
 *   1. the dispute this viewer raised, if any;
 *   2. otherwise the one they can respond to;
 *   3. otherwise the most recent one they participate in (the list is already
 *      `createdAt DESC`).
 */
export async function findMyDisputeForBooking(
  fetcher: (path: string) => Promise<unknown>,
  bookingId: number,
): Promise<MyDisputeSummary | undefined> {
  const mine = (await fetcher("/disputes/my")) as MyDisputeSummary[] | undefined
  if (!Array.isArray(mine)) return undefined

  const onThisBooking = mine.filter((d) => Number(d.booking?.id) === Number(bookingId))
  if (onThisBooking.length === 0) return undefined

  return (
    onThisBooking.find((d) => d.viewerRole === "RAISER") ??
    onThisBooking.find((d) => d.canRespond === true) ??
    onThisBooking[0]
  )
}
