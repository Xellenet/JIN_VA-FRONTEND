/**
 * `GET /admin/analytics?range=` (AN1/AP1–AP4): the platform rollup the
 * admin Overview and Analytics pages read. QA ADM-02 / ADM-19: both pages
 * used to show fixed sample figures and never called it.
 *
 * Any section listed in `degraded` is `null` and must read as unavailable,
 * never as zero.
 */
export type AnalyticsRange = "7d" | "30d" | "90d" | "1y"

export const ANALYTICS_RANGES: ReadonlyArray<{ value: AnalyticsRange; label: string; period: string }> = [
  { value: "7d", label: "7 days", period: "last 7 days" },
  { value: "30d", label: "30 days", period: "last 30 days" },
  { value: "90d", label: "90 days", period: "last 90 days" },
  { value: "1y", label: "1 year", period: "last 12 months" },
]

export interface AnalyticsKpis {
  newUsers: number
  newClients: number
  newArtisans: number
  totalUsers: number
  totalClients: number
  totalArtisans: number
  bookings: number
  grossRevenue: number
  netRevenue: number
  refundedAmount: number
  artisanPayouts: number
  paidPayments: number
  completionRate: number
  completedJobs: number
  terminalJobs: number
  activeJobs: number
}

export interface AdminAnalytics {
  range: AnalyticsRange
  bucket: "day" | "week" | "month"
  from: string
  to: string
  generatedAt: string
  kpis: AnalyticsKpis | null
  previous: AnalyticsKpis | null
  series: {
    userGrowth: Array<{ bucket: string; clients: number; artisans: number; total: number }> | null
    bookingVolume: Array<{ bucket: string; bookings: number; completed: number; cancelled: number }> | null
    revenue: Array<{ bucket: string; gross: number; net: number; refunded: number }> | null
  }
  topServiceCategories: Array<{
    serviceId: number
    serviceName: string
    jobs: number
    completedJobs: number
    share: number
  }> | null
  topArtisans: Array<{
    artisanProfileId: number
    userId: number
    name: string
    businessName: string | null
    averageRating: number
    totalReviews: number
    completedJobs: number
    isVerified: boolean
  }> | null
  disputes: {
    averageResolutionHours: number
    resolvedCount: number
    filedCount: number
    openCount: number
    openPast48h: number
    slaHours: number
    breachesTarget: boolean
  } | null
  degraded: string[]
}

/** Percentage change against the previous period; null when it can't be said. */
export function percentChange(current: number, previous: number | null | undefined): number | null {
  // Nothing to compare against (or nothing in either period): no trend shown.
  if (previous == null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function startOf(date: Date, bucket: AdminAnalytics["bucket"]): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  if (bucket === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  if (bucket === "month") d.setUTCDate(1)
  return d
}

function step(d: Date, bucket: AdminAnalytics["bucket"]): Date {
  const next = new Date(d)
  if (bucket === "day") next.setUTCDate(next.getUTCDate() + 1)
  else if (bucket === "week") next.setUTCDate(next.getUTCDate() + 7)
  else next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

/**
 * The API returns only buckets that have data. Charts need every bucket in
 * the range, with zero where nothing happened, or a quiet week vanishes from
 * the axis.
 */
export function fillSeries<T extends { bucket: string }>(
  points: T[],
  data: Pick<AdminAnalytics, "from" | "to" | "bucket">,
  empty: Omit<T, "bucket">,
): Array<T & { label: string }> {
  const byKey = new Map(points.map((p) => [startOf(new Date(p.bucket), data.bucket).toISOString(), p]))
  const out: Array<T & { label: string }> = []
  const end = new Date(data.to)
  for (let d = startOf(new Date(data.from), data.bucket); d <= end; d = step(d, data.bucket)) {
    const key = d.toISOString()
    const label =
      data.bucket === "month"
        ? d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })
        : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    out.push({ ...(byKey.get(key) ?? ({ ...empty, bucket: key } as T)), label })
  }
  return out
}
