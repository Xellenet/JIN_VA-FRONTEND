/**
 * Typed client for the artisan money endpoints (api-contract.md B2, B3, B6):
 * the earnings statement and its CSV, artisan analytics, and the bank list.
 * Same rules as `customer-api.ts`: `no-store`, an optional `AbortSignal`, and
 * query strings built only from already-parsed values with `URLSearchParams`.
 */
import { apiFetch, apiFetchBlob, apiFetchWithMeta } from "@/lib/api"
import type { Pagination } from "@/lib/customer-api"
import type { AnalyticsRange, EarningsPeriod, EarningsStage } from "@/lib/earnings"
import { EARNINGS_STAGES } from "@/lib/earnings"

type Money = string

// ── B2 statement ─────────────────────────────────────────────────────────────

export interface EarningsBalances {
  heldForSignOff: Money
  onTheWay: Money
  needsAction: Money
  needsActionCount: number
  paidThisMonth: Money
}

export interface EarningsMonth {
  month: string
  gross: Money
  fee: Money
  net: Money
  jobs: number
}

export interface EarningsItem {
  paymentId: number
  jobId: number | null
  jobTitle: string | null
  clientName: string
  gross: Money
  fee: Money
  net: Money
  refunded: Money
  payout: Money | null
  status: string
  stage: EarningsStage
  transferReference: string | null
  failureReason: "no_payout_method" | "transfer_failed" | null
  paidAt: string | null
  releasedAt: string | null
  createdAt: string
  date: string
}

export interface EarningsStatement {
  currency: "GHS"
  period: { key: EarningsPeriod; from: string | null; to: string }
  summary: {
    gross: Money
    fee: Money
    net: Money
    jobs: number
    paid: Money
    refunded: Money
    refundedCount: number
  }
  balances: EarningsBalances
  months: EarningsMonth[]
  items: EarningsItem[]
}

export interface StatementQuery {
  period: EarningsPeriod
  stage: EarningsStage | "all"
  page?: number
  limit?: number
}

const PERIODS: readonly EarningsPeriod[] = ["30d", "90d", "12m", "all"]

function statementParams(q: StatementQuery, paginated: boolean): URLSearchParams {
  const params = new URLSearchParams()
  params.set("period", PERIODS.includes(q.period) ? q.period : "12m")
  if (q.stage !== "all" && EARNINGS_STAGES.includes(q.stage)) params.set("stage", q.stage)
  if (paginated) {
    const page = Number.isSafeInteger(q.page) && (q.page ?? 0) >= 1 ? Math.min(1000, q.page as number) : 1
    const limit = Number.isSafeInteger(q.limit) && (q.limit ?? 0) >= 1 ? Math.min(100, q.limit as number) : 20
    params.set("page", String(page))
    params.set("limit", String(limit))
  }
  return params
}

export async function getEarningsStatement(
  q: StatementQuery,
  signal?: AbortSignal,
): Promise<{ data: EarningsStatement; pagination: Pagination }> {
  const params = statementParams(q, true)
  const { data, meta } = await apiFetchWithMeta<EarningsStatement>(
    `/payments/my-earnings/statement?${params.toString()}`,
    { cache: "no-store", signal },
  )
  const p = (meta?.pagination ?? {}) as Partial<Pagination>
  const limit = Number(params.get("limit"))
  const total = typeof p.total === "number" ? p.total : (data?.items?.length ?? 0)
  return {
    data,
    pagination: {
      page: typeof p.page === "number" ? p.page : Number(params.get("page")),
      limit: typeof p.limit === "number" ? p.limit : limit,
      total,
      totalPages: typeof p.totalPages === "number" ? p.totalPages : Math.ceil(total / limit),
    },
  }
}

/** `GET /payments/my-earnings/export.csv` with the same period and stage. */
export async function downloadEarningsCsv(q: Pick<StatementQuery, "period" | "stage">): Promise<Blob> {
  const params = statementParams({ ...q }, false)
  const { blob } = await apiFetchBlob(`/payments/my-earnings/export.csv?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "text/csv" },
  })
  return blob
}

/** `POST /payments/retry-transfer/:jobId` for a payout that needs action. */
export async function retryTransfer(jobId: number): Promise<void> {
  if (!Number.isSafeInteger(jobId) || jobId <= 0) throw new Error("Invalid job id")
  await apiFetch(`/payments/retry-transfer/${jobId}`, { method: "POST", cache: "no-store" })
}

// ── B3 analytics ─────────────────────────────────────────────────────────────

export interface ArtisanAnalytics {
  range: AnalyticsRange
  bucket: "day" | "week" | "month"
  from: string | null
  to: string
  generatedAt: string
  earnings: {
    allTime: number
    thisMonth: number
    lastMonth: number
    inRange: number
    payoutsInRange: number
    pending: number
    pendingPayments: number
    currency: "GHS"
  }
  jobCounts: { completed: number; cancelled: number; inProgress: number; pending: number; total: number }
  repeatClients: { totalClients: number; repeatClients: number; rate: number; definition: string }
  ratingTrend: {
    points: { bucket: string; averageRating: number; reviewCount: number }[]
    hasEnoughDataForTrend: boolean
    reviewsInRange: number
  }
  topServices: { serviceId: number; serviceName: string; bookings: number; completedBookings: number; share: number }[]
  overview: {
    completedJobsAllTime: number
    inProgressJobs: number
    averageRating: number
    totalReviews: number
    isVerified: boolean
  }
  series: {
    earningsFilled: { bucketStart: string; net: Money; payouts: number }[]
  }
}

export function getArtisanAnalytics(range: AnalyticsRange, signal?: AbortSignal): Promise<ArtisanAnalytics> {
  const params = new URLSearchParams({ range })
  return apiFetch<ArtisanAnalytics>(`/analytics/artisan?${params.toString()}`, { cache: "no-store", signal })
}

// ── B6 banks and the profile's payout destination ───────────────────────────

export interface Bank {
  code: string
  name: string
}

export function getBanks(signal?: AbortSignal): Promise<Bank[]> {
  return apiFetch<Bank[]>("/payments/banks", { signal })
}

export interface PayoutDestination {
  type: "mobile_money" | "bank"
  label: string
  last4: string
  accountName: string
}
