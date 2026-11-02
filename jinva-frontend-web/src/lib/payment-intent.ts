/**
 * Paying a job exactly once: the Idempotency-Key for each press of Pay, the
 * job's payment state (paid, an active attempt, refunded duplicates) and the
 * messages other open tabs of the same job receive.
 *
 * Free of React and of value imports, so `scripts/test-saved-methods.mjs`
 * runs it directly with Node's type stripping.
 *
 * One key per user intent: it is made when Pay is pressed, reused for the
 * automatic retries of that press (a network error, or the server saying the
 * same key is still in flight), kept in sessionStorage so a refresh during
 * the request sends the same key again, and cleared once the server gave a
 * definite answer. A deliberate new attempt after a failure gets a new key.
 */

// ── API shapes ───────────────────────────────────────────────────────────────

export type AttemptKind = "hosted" | "mobile_money" | "card"
export type AttemptStatus = "pending" | "needs_otp" | "hosted_open"

/** An active payment attempt (the 409 `data`, and `activeAttempt` below). */
export interface AttemptView {
  reference: string
  jobId: number
  kind: AttemptKind
  status: AttemptStatus
  action: "approve_on_phone" | "enter_otp" | "wait" | "continue_checkout" | null
  message: string | null
  paymentMethodId: number | null
  startedAt: string
  expiresAt: string
  /** Only for `hosted`. */
  authorizationUrl: string | null
}

export interface DuplicateRefund {
  reference: string
  amount: number
  currency: "GHS"
  method: AttemptKind
  methodLabel: string | null
  status: "pending" | "requested" | "processed" | "failed"
  createdAt: string
}

/** `GET /payments/jobs/:jobId/attempt`. */
export interface JobPaymentState {
  jobId: number
  paid: boolean
  payment: { id: number; status: string; amount: number; currency: string; paidAt: string | null } | null
  activeAttempt: AttemptView | null
  duplicateRefunds: DuplicateRefund[]
}

/** The 409 ALREADY_PAID `data`. */
export interface AlreadyPaid {
  jobId: number
  status: string
  amount: number
  currency: string
  paidAt: string | null
  reference: string
}

export const PAID_STATUSES = ["HELD", "PENDING_TRANSFER", "TRANSFER_FAILED", "RELEASED", "REFUNDED"] as const
export const isPaidStatus = (status: string | null | undefined): boolean =>
  (PAID_STATUSES as readonly string[]).includes(String(status ?? ""))

// ── Idempotency keys ─────────────────────────────────────────────────────────

export const IDEMPOTENCY_HEADER = "Idempotency-Key"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const URL_SAFE_RE = /^[A-Za-z0-9_-]{16,64}$/

/** What the server accepts: a UUID, or 16 to 64 url-safe characters. */
export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === "string" && (UUID_RE.test(key) || URL_SAFE_RE.test(key))
}

interface CryptoLike {
  randomUUID?: () => string
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T
}

/** A new key: `crypto.randomUUID`, else 32 hex characters from `getRandomValues`, else Math.random. */
export function newIdempotencyKey(c: CryptoLike | undefined = globalThis.crypto as CryptoLike | undefined): string {
  try {
    if (c?.randomUUID) {
      const id = c.randomUUID()
      if (isValidIdempotencyKey(id)) return id
    }
  } catch {
    // Not available (an insecure context): fall through.
  }
  let bytes: number[]
  try {
    if (!c?.getRandomValues) throw new Error("no getRandomValues")
    bytes = Array.from(c.getRandomValues(new Uint8Array(16)))
  } catch {
    bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  }
  return `pay_${bytes.map((b) => b.toString(16).padStart(2, "0")).join("")}`
}

/** How the customer pays: Paystack's page, or a saved method's id. */
export type PayMethod = "hosted" | number | "otp"

/** sessionStorage key for one intent: per job and method. */
export function intentStorageKey(jobId: number | string, method: PayMethod): string {
  const m = method === "hosted" || method === "otp" ? method : `m${method}`
  return `jinva:pay-intent:${jobId}:${m}`
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Used when sessionStorage throws (private mode, blocked storage): this page's lifetime only. */
const memory = new Map<string, string>()

/**
 * The key for this press of Pay: the one already stored for this job and
 * method (a retry, or a refresh during the request), or a new one, stored.
 */
export function getOrCreateIntentKey(
  storage: StorageLike | null | undefined,
  jobId: number | string,
  method: PayMethod,
  make: () => string = () => newIdempotencyKey(),
): string {
  const k = intentStorageKey(jobId, method)
  let stored: string | null = null
  try {
    stored = storage ? storage.getItem(k) : null
  } catch {
    stored = null
  }
  if (!isValidIdempotencyKey(stored)) stored = memory.get(k) ?? null
  if (isValidIdempotencyKey(stored)) return stored
  const key = make()
  memory.set(k, key)
  try {
    storage?.setItem(k, key)
  } catch {
    // Kept in memory only.
  }
  return key
}

/** The intent is over (the server answered): the next press gets a new key. */
export function clearIntentKey(storage: StorageLike | null | undefined, jobId: number | string, method: PayMethod): void {
  const k = intentStorageKey(jobId, method)
  memory.delete(k)
  try {
    storage?.removeItem(k)
  } catch {
    // Nothing to clear.
  }
}

/** sessionStorage, or null when reading it throws. */
export function safeSessionStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null
  } catch {
    return null
  }
}

// ── Errors from the pay endpoints ────────────────────────────────────────────

export type PayErrorKind =
  | "already_paid"
  | "attempt_active"
  | "in_progress"
  | "key_reused"
  | "key_invalid"
  | "network"
  | "other"

/** What a failed pay request means. `status` 0 is a network failure (no answer). */
export function payErrorKind(err: { status?: number; code?: string } | null | undefined): PayErrorKind {
  const code = err?.code
  if (code === "ALREADY_PAID") return "already_paid"
  if (code === "PAYMENT_ATTEMPT_ACTIVE") return "attempt_active"
  if (code === "IDEMPOTENCY_IN_PROGRESS") return "in_progress"
  if (code === "IDEMPOTENCY_KEY_REUSED") return "key_reused"
  if (code === "IDEMPOTENCY_KEY_INVALID") return "key_invalid"
  if (!err?.status) return "network"
  return "other"
}

/** Automatic retries of one press, with the same key. */
export const SAME_PRESS_MAX_RETRIES = 3

/** Retry the same press (same key) only when the outcome is unknown or still running. */
export function shouldRetrySamePress(kind: PayErrorKind, retriesSoFar: number): boolean {
  return (kind === "network" || kind === "in_progress") && retriesSoFar < SAME_PRESS_MAX_RETRIES
}

export function samePressRetryDelay(retriesSoFar: number): number {
  return Math.min(1000 * 2 ** Math.max(0, retriesSoFar), 4000)
}

/** Whether the stored key must be kept after this outcome (unknown outcome only). */
export const keepKeyAfter = (kind: PayErrorKind): boolean => kind === "network" || kind === "in_progress"

// ── Copy ─────────────────────────────────────────────────────────────────────

/** GH₵ with 2 decimals (same as `formatCurrency`). */
export function formatGhs(amount: number | string): string {
  return `GH₵ ${Number(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const ATTEMPT_ACTIVE_FALLBACK: Record<AttemptKind, string> = {
  mobile_money:
    "A payment is waiting for approval on your phone. Approve or decline it there, or wait for it to expire, before paying another way.",
  hosted:
    "A payment is open on the checkout page. Finish or close it there, or wait for it to expire, before paying another way.",
  card: "A card payment is being confirmed. Wait for it to finish before paying another way.",
}

/** The explanation for an active attempt: the server's sentence, or ours. */
export function attemptActiveMessage(a: Pick<AttemptView, "kind">, serverMessage?: string | null): string {
  const m = (serverMessage ?? "").trim()
  return m || ATTEMPT_ACTIVE_FALLBACK[a.kind] || ATTEMPT_ACTIVE_FALLBACK.mobile_money
}

/** An active saved-method attempt as the charge result the pay page already shows. */
export function attemptAsCharge(a: AttemptView): {
  reference: string
  jobId: number
  method: "mobile_money" | "card"
  status: "pending" | "needs_otp"
  action: "approve_on_phone" | "enter_otp" | "wait"
  message: string | null
} | null {
  if (a.kind === "hosted") return null
  const needsOtp = a.status === "needs_otp"
  return {
    reference: a.reference,
    jobId: a.jobId,
    method: a.kind,
    status: needsOtp ? "needs_otp" : "pending",
    action: needsOtp ? "enter_otp" : a.kind === "mobile_money" ? "approve_on_phone" : "wait",
    message: a.message,
  }
}

const METHOD_FALLBACK: Record<AttemptKind, string> = {
  mobile_money: "mobile money",
  card: "card",
  hosted: "original payment method",
}

/** The job page's note for a refunded duplicate payment. No timing promise. */
export function duplicateRefundNote(r: Pick<DuplicateRefund, "amount" | "methodLabel" | "method">): string {
  const label = (r.methodLabel ?? "").trim() || METHOD_FALLBACK[r.method] || "original payment method"
  return `You were charged twice for this job. We've refunded the extra payment of ${formatGhs(r.amount)} to your ${label}.`
}

/**
 * Only refunds Paystack has accepted ("We've refunded" must be true). One still
 * being arranged, or one our team is handling, isn't announced here.
 */
export const visibleDuplicateRefunds = (list: readonly DuplicateRefund[] | null | undefined): DuplicateRefund[] =>
  (list ?? []).filter((r) => r.status === "requested" || r.status === "processed")

// ── Other tabs of the same job ───────────────────────────────────────────────

export type PaySyncMessage =
  | { type: "paid"; jobId: number; amount: number | null }
  | { type: "attempt"; jobId: number; attempt: AttemptView }
  | { type: "refresh"; jobId: number }

export const paySyncChannelName = (jobId: number | string): string => `jinva-payment-${jobId}`
export const paySyncStorageKey = (jobId: number | string): string => `jinva:pay-sync:${jobId}`

/** Reads a message from another tab, or null when it isn't one of ours for this job. */
export function parsePaySync(raw: unknown, jobId: number): PaySyncMessage | null {
  let v: unknown = raw
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!v || typeof v !== "object") return null
  const m = v as Record<string, unknown>
  if (Number(m.jobId) !== Number(jobId)) return null
  if (m.type === "paid") return { type: "paid", jobId, amount: typeof m.amount === "number" ? m.amount : null }
  if (m.type === "refresh") return { type: "refresh", jobId }
  if (m.type === "attempt" && m.attempt && typeof m.attempt === "object") {
    return { type: "attempt", jobId, attempt: m.attempt as AttemptView }
  }
  return null
}
