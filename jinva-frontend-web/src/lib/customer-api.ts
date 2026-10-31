/**
 * Customer Experience v2: the one typed client for every customer endpoint in
 * the build contract (docs/specs/customer-experience-v2/04-implementation-plan.md §1).
 *
 * Owner: fe-overview. Spending, Settings and the inbox import from here and
 * never build these requests themselves.
 *
 * Rules this file keeps (plan §4, SEC-19, SEC-33):
 *   - Every call passes `cache: "no-store"` and takes an optional `AbortSignal`
 *     so a page can cancel a stale request (FR-1.18).
 *   - Query strings are built only with `URLSearchParams`, and only from typed,
 *     already-parsed values. Ids that go into a path are checked to be positive
 *     safe integers first, so nothing read from a URL or a response can change
 *     the path.
 *   - No response is cached at module level. Data lives in component state and
 *     is gone after navigation or sign-out.
 *   - The held amount is called `held` (plan §0.2 copy rule).
 */
import { ApiError, apiFetch, apiFetchBlob, apiFetchWithMeta } from "@/lib/api"

// ── Shared primitives ────────────────────────────────────────────────────────

/** Money is always a string with exactly two decimals, e.g. `"1840.00"`. */
export type Money = string

export type JobStatus = "OPEN" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "EXPIRED"

/** The four stops on the Overview job track, as they appear in `?stage=`. */
export type Stage = "open" | "in_progress" | "completed" | "closed"

export type PaymentStatus =
  | "PENDING"
  | "HELD"
  | "PENDING_TRANSFER"
  | "TRANSFER_FAILED"
  | "RELEASED"
  | "REFUNDED"
  | "CANCELLED"
  | "FAILED"

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
}

/** The other person in a transaction. `id` is the artisan profile id, or null for a deleted artisan. */
export interface Counterparty {
  id: number | null
  displayName: string
  avatar: string | null
}

// ── B7a / B7b: jobs ──────────────────────────────────────────────────────────

export interface JobSummary {
  byStatus: Record<JobStatus, number>
  byStage: Record<Stage, number>
  total: number
}

/** One row of `GET /jobs/mine` (`JobResponseDto`), limited to what the customer screens read. */
export interface MyJob {
  id: number
  title: string
  status: JobStatus
  createdAt: string
  location?: string
  budgetMin?: number
  budgetMax?: number
  currency?: string
  bookingId?: number | null
  completionRequestedAt?: string | null
  service?: { id: number; name: string } | null
  acceptedArtisan?: { id: number; firstname: string; lastname: string; profilePicture?: string | null } | null
}

export interface MyJobsQuery {
  statuses?: readonly JobStatus[]
  page: number
  limit: number
}

export type MyJobsPage = Paginated<MyJob>

// ── B6: overview rail ────────────────────────────────────────────────────────

export interface ActionItem {
  count: number
  jobId: number | null
  jobTitle: string | null
}

export interface ActionItems {
  completionsToConfirm: ActionItem
  paymentsDue: ActionItem
  applicationsToReview: ActionItem
  unreadMessages: number
}

export interface NextBooking {
  id: number
  /** `YYYY-MM-DD`, Accra calendar date. */
  scheduledDate: string
  /** `HH:mm` or null. */
  startTime: string | null
  endTime: string | null
  status: "PENDING" | "CONFIRMED"
  service: { id: number; name: string } | null
  artisan: Counterparty
}

export interface SpendSnapshot {
  currency: "GHS"
  hasPaymentsEver: boolean
  thisMonth: Money
  lastMonth: Money
  held: Money
  /** Always six entries, oldest first, current month last. */
  last6Months: { month: string; netSpent: Money }[]
}

export type OverviewSection = "actionItems" | "nextBooking" | "spend"

export interface CustomerOverview {
  actionItems: ActionItems | null
  nextBooking: NextBooking | null
  spend: SpendSnapshot | null
  failedSections: OverviewSection[]
}

// ── B2: spending analytics ───────────────────────────────────────────────────

export type SpendingRange = "30d" | "90d" | "12m" | "all"
export type SpendingChannel = "mobile_money" | "card" | "bank" | "other"

export interface SpendingAnalytics {
  range: SpendingRange
  bucket: "day" | "week" | "month"
  currency: "GHS"
  period: { from: string | null; to: string }
  hasPaymentsEver: boolean
  totals: {
    netSpent: Money
    grossPaid: Money
    refunded: Money
    held: Money
    released: Money
    paymentsCount: number
    avgPayment: Money
    previousPeriodNetSpent: Money | null
  }
  series: { bucketStart: string; netSpent: Money; count: number }[]
  byCategory: { serviceId: number | null; serviceName: string; netSpent: Money; count: number; share: number }[]
  byArtisan: {
    artisanProfileId: number | null
    displayName: string
    avatar: string | null
    netSpent: Money
    count: number
    lastPaidAt: string
  }[]
  byChannel: { channel: SpendingChannel; netSpent: Money; count: number; share: number }[]
  largestPayment: { id: number; jobId: number; jobTitle: string | null; amount: Money; paidAt: string } | null
}

// ── B3 / B3f / B10: payment history ──────────────────────────────────────────

export interface PaymentHistoryRow {
  id: number
  reference: string
  jobId: number
  job: { id: number; title: string | null }
  bookingId: number | null
  service: { id: number | null; name: string }
  artisan: Counterparty
  amount: Money
  refundedAmount: Money
  netAmount: Money
  currency: string
  /** Raw stored channel (`card`, `mobile_money`, `bank`, …) or null. */
  channel: string | null
  status: PaymentStatus
  paidAt: string | null
  releasedAt: string | null
  /** `created_at`. */
  date: string
}

/**
 * The history query. `range` and `from`/`to` are mutually exclusive on the
 * server; when `from` or `to` is set, `range` is not sent.
 */
export interface PaymentHistoryFilters {
  page?: number
  limit?: number
  statuses?: readonly PaymentStatus[]
  range?: SpendingRange
  /** `YYYY-MM-DD` */
  from?: string
  /** `YYYY-MM-DD` */
  to?: string
  serviceId?: number
  artisanProfileId?: number
  search?: string
}

export interface PaymentHistoryFilterOptions {
  services: { id: number; name: string }[]
  artisans: { id: number; displayName: string }[]
}

// ── B5: payment settings ─────────────────────────────────────────────────────

export type PreferredChannel = "mobile_money" | "card"
export type MomoNetwork = "MTN" | "TELECEL" | "AT"

export interface PaymentSettings {
  preferredChannel: PreferredChannel | null
  momoNetwork: MomoNetwork | null
  receiptEmail: string
  updatedAt: string | null
  editable: boolean
}

/** `null` clears a field; a missing key leaves it as it is. */
export interface PaymentSettingsPatch {
  preferredChannel?: PreferredChannel | null
  momoNetwork?: MomoNetwork | null
}

// ── B1 / B8 ──────────────────────────────────────────────────────────────────

/** `GET /users/me` shape after `DELETE /users/me/avatar`; only the fields callers rely on are typed. */
export interface MeResponse {
  id: number
  profilePicture: string | null
  [key: string]: unknown
}

export interface NotificationDetail {
  id: number
  type: string
  title: string
  body: string
  isRead: boolean
  payload: Record<string, unknown> | null
  createdAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const JOB_STATUSES: readonly JobStatus[] = ["OPEN", "PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"]
const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "PENDING",
  "HELD",
  "PENDING_TRANSFER",
  "TRANSFER_FAILED",
  "RELEASED",
  "REFUNDED",
  "CANCELLED",
  "FAILED",
]
const SPENDING_RANGES: readonly SpendingRange[] = ["30d", "90d", "12m", "all"]
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** A positive safe integer, or null. Accepts the numeric strings some screens keep ids in. */
function toId(value: unknown): number | null {
  const n = typeof value === "string" && /^\d{1,16}$/.test(value) ? Number(value) : value
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : null
}

function requireId(value: unknown, what: string): number {
  const id = toId(value)
  if (id === null) throw new ApiError(`Invalid ${what}.`, 400)
  return id
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

function withQuery(path: string, params: URLSearchParams): string {
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

const NO_STORE = { cache: "no-store" } as const

/** Reads `meta.pagination`, falling back to a flat `meta` and then to the request itself. */
function readPagination(meta: Record<string, unknown> | undefined, page: number, limit: number, count: number): Pagination {
  const source = (meta?.pagination ?? meta) as Partial<Pagination> | undefined
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback)
  const total = num(source?.total, count)
  const lim = num(source?.limit, limit)
  return {
    page: num(source?.page, page),
    limit: lim,
    total,
    totalPages: num(source?.totalPages, lim > 0 ? Math.ceil(total / lim) : 0),
  }
}

function historyParams(filters: PaymentHistoryFilters, paginated: boolean): URLSearchParams {
  const params = new URLSearchParams()
  if (paginated) {
    params.set("page", String(clampInt(filters.page, 1, 1000, 1)))
    params.set("limit", String(clampInt(filters.limit, 1, 100, 20)))
  }
  const statuses = [...new Set(filters.statuses ?? [])].filter((s) => PAYMENT_STATUSES.includes(s))
  if (statuses.length > 0) params.set("status", statuses.join(","))

  const from = filters.from && ISO_DATE.test(filters.from) ? filters.from : undefined
  const to = filters.to && ISO_DATE.test(filters.to) ? filters.to : undefined
  if (from || to) {
    if (from) params.set("from", from)
    if (to) params.set("to", to)
  } else {
    const range = filters.range && SPENDING_RANGES.includes(filters.range) ? filters.range : "12m"
    params.set("range", range)
  }

  const serviceId = toId(filters.serviceId)
  if (serviceId !== null) params.set("serviceId", String(serviceId))
  const artisanProfileId = toId(filters.artisanProfileId)
  if (artisanProfileId !== null) params.set("artisanProfileId", String(artisanProfileId))

  const search = filters.search?.trim().slice(0, 100)
  if (search) params.set("search", search)
  return params
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

/** B7a `GET /jobs/mine/summary`: account-wide counts per status and per stage. */
export function getJobSummary(signal?: AbortSignal): Promise<JobSummary> {
  return apiFetch<JobSummary>("/jobs/mine/summary", { ...NO_STORE, signal })
}

/** B7b `GET /jobs/mine`, optionally narrowed to several statuses. Newest first. */
export async function getMyJobs(query: MyJobsQuery, signal?: AbortSignal): Promise<MyJobsPage> {
  const page = clampInt(query.page, 1, Number.MAX_SAFE_INTEGER, 1)
  const limit = clampInt(query.limit, 1, 50, 10)
  const params = new URLSearchParams()
  const statuses = [...new Set(query.statuses ?? [])].filter((s) => JOB_STATUSES.includes(s))
  if (statuses.length > 0) params.set("status", statuses.join(","))
  params.set("page", String(page))
  params.set("limit", String(limit))

  const { data, meta } = await apiFetchWithMeta<MyJob[] | { items?: MyJob[] }>(withQuery("/jobs/mine", params), {
    ...NO_STORE,
    signal,
  })
  const items = Array.isArray(data) ? data : (data?.items ?? [])
  return { items, pagination: readPagination(meta, page, limit, items.length) }
}

// ── Overview and spending ────────────────────────────────────────────────────

/** B6 `GET /customers/me/overview`: the rail. A failed section is null and listed in `failedSections`. */
export function getCustomerOverview(signal?: AbortSignal): Promise<CustomerOverview> {
  return apiFetch<CustomerOverview>("/customers/me/overview", { ...NO_STORE, signal })
}

/** B2 `GET /analytics/customer?range=`. */
export function getSpendingAnalytics(range: SpendingRange, signal?: AbortSignal): Promise<SpendingAnalytics> {
  const params = new URLSearchParams({ range: SPENDING_RANGES.includes(range) ? range : "12m" })
  return apiFetch<SpendingAnalytics>(withQuery("/analytics/customer", params), { ...NO_STORE, signal })
}

/**
 * B3 `GET /payments/history`, always in its paginated form: `page` and either
 * `range` (default `12m`) or `from`/`to` are always sent.
 */
export async function getPaymentHistory(
  filters: PaymentHistoryFilters,
  signal?: AbortSignal,
): Promise<Paginated<PaymentHistoryRow>> {
  const params = historyParams(filters, true)
  const { data, meta } = await apiFetchWithMeta<PaymentHistoryRow[]>(withQuery("/payments/history", params), {
    ...NO_STORE,
    signal,
  })
  const items = Array.isArray(data) ? data : []
  return {
    items,
    pagination: readPagination(meta, Number(params.get("page")), Number(params.get("limit")), items.length),
  }
}

/** B3f `GET /payments/history/filters`: services and artisans the customer has paid. */
export function getPaymentHistoryFilterOptions(signal?: AbortSignal): Promise<PaymentHistoryFilterOptions> {
  return apiFetch<PaymentHistoryFilterOptions>("/payments/history/filters", { ...NO_STORE, signal })
}

/** B10 `GET /payments/history/export.csv` with the history filters (no page or limit). */
export async function downloadPaymentHistoryCsv(filters: PaymentHistoryFilters): Promise<Blob> {
  const params = historyParams(filters, false)
  const { blob } = await apiFetchBlob(withQuery("/payments/history/export.csv", params), {
    ...NO_STORE,
    headers: { Accept: "text/csv" },
  })
  return blob
}

// ── Settings ─────────────────────────────────────────────────────────────────

/** B5 `GET /users/me/payment-settings`. */
export function getPaymentSettings(signal?: AbortSignal): Promise<PaymentSettings> {
  return apiFetch<PaymentSettings>("/users/me/payment-settings", { ...NO_STORE, signal })
}

/** B5 `PATCH /users/me/payment-settings`. Only the two known keys are ever sent. */
export function updatePaymentSettings(patch: PaymentSettingsPatch): Promise<PaymentSettings> {
  const body: PaymentSettingsPatch = {}
  if (patch.preferredChannel !== undefined) body.preferredChannel = patch.preferredChannel
  if (patch.momoNetwork !== undefined) body.momoNetwork = patch.momoNetwork
  return apiFetch<PaymentSettings>("/users/me/payment-settings", {
    ...NO_STORE,
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

/** B1 `DELETE /users/me/avatar`. Returns the user with `profilePicture: null`. */
export function removeProfilePhoto(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/users/me/avatar", { ...NO_STORE, method: "DELETE" })
}

// ── Inbox ────────────────────────────────────────────────────────────────────

/** B8 `GET /notifications/:id`. Does not mark it read. */
export function getNotification(id: number | string, signal?: AbortSignal): Promise<NotificationDetail> {
  const safe = requireId(id, "notification id")
  return apiFetch<NotificationDetail>(`/notifications/${safe}`, { ...NO_STORE, signal })
}

/** `PATCH /notifications/:id/read`. */
export async function markNotificationRead(id: number | string): Promise<void> {
  const safe = requireId(id, "notification id")
  await apiFetch(`/notifications/${safe}/read`, { ...NO_STORE, method: "PATCH" })
}

/**
 * M1 `PATCH /messages/:id/read`. With `upToMessageId`, only messages up to and
 * including that id are marked read, so one arriving meanwhile stays unread.
 */
export async function markConversationRead(conversationId: number | string, upToMessageId?: number | string): Promise<void> {
  const safe = requireId(conversationId, "conversation id")
  const params = new URLSearchParams()
  if (upToMessageId !== undefined) params.set("upToMessageId", String(requireId(upToMessageId, "message id")))
  await apiFetch(withQuery(`/messages/${safe}/read`, params), { ...NO_STORE, method: "PATCH" })
}

// ── Errors ───────────────────────────────────────────────────────────────────

/** True for a 429 from any of the named throttlers. */
export function isRateLimited(err: unknown): boolean {
  return err instanceof ApiError && err.status === 429
}

/** Seconds to wait after a 429 (from `meta.retryAfterSeconds`), defaulting to 30. Always 1–3600. */
export function retryAfter(err: unknown): number {
  const s = err instanceof ApiError ? err.retryAfterSeconds : undefined
  return typeof s === "number" && Number.isFinite(s) && s > 0 ? Math.min(3600, Math.ceil(s)) : 30
}

/** True when the request was cancelled through its `AbortSignal` (a stale request, not a failure). */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException ? err.name === "AbortError" : err instanceof Error && err.name === "AbortError"
}
