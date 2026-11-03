/**
 * `GET /admin/analytics/insights?range=`: the admin platform insights shown on
 * the Analytics page's tabs other than Overview (Overview keeps reading
 * `GET /admin/analytics`, see `admin-analytics.ts`).
 *
 * Conventions of this endpoint (they differ from `/admin/analytics` on purpose):
 *  - money is a 2-decimal string ("1250.00");
 *  - a rate with nothing to divide by is `null`, shown as "Not enough data yet";
 *  - a median or p90 from fewer than `minSample` observations is `null`;
 *  - a section listed in `degraded` is `null` and must read as unavailable.
 *
 * Pure and dependency-free, so `scripts/test-admin-insights.mjs` can import it
 * directly through Node's type stripping.
 */

export type InsightsRange = "7d" | "30d" | "90d" | "1y"

export const INSIGHT_SECTIONS = [
  "funnel",
  "speed",
  "marketplace",
  "economics",
  "payments",
  "trust",
  "artisans",
  "retention",
  "reviews",
] as const
export type InsightSection = (typeof INSIGHT_SECTIONS)[number]

/** The Analytics page tabs, in order. `overview` is the original page, unchanged. */
export const ANALYTICS_TABS = ["overview", "funnel", "marketplace", "payments", "trust", "artisans", "retention"] as const
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number]

export const ANALYTICS_TAB_LABELS: Record<AnalyticsTab, string> = {
  overview: "Overview",
  funnel: "Funnel & speed",
  marketplace: "Marketplace",
  payments: "Payments",
  trust: "Trust & safety",
  artisans: "Artisans",
  retention: "Retention & reviews",
}

/** The sections each tab shows. */
export const TAB_SECTIONS: Record<Exclude<AnalyticsTab, "overview">, InsightSection[]> = {
  funnel: ["funnel", "speed"],
  marketplace: ["marketplace", "economics"],
  payments: ["payments"],
  trust: ["trust"],
  artisans: ["artisans"],
  retention: ["retention", "reviews"],
}

export interface DurationStat {
  n: number
  medianHours: number | null
  p90Hours: number | null
}

export interface Counted {
  key: string
  count: number
}

export interface Insights {
  range: InsightsRange
  bucket: "day" | "week" | "month"
  from: string
  to: string
  generatedAt: string
  cached: boolean
  minSample: number
  funnel: {
    steps: Array<{ key: string; count: number; conversionFromPrevious: number | null }>
    overallConversion: number | null
    expiredWithoutHire: number
    cancelled: number
    cancelledBeforeHire: number
    inFlight: number
    fromBookings: number
  } | null
  speed: Record<
    | "firstApplication"
    | "hire"
    | "hireToCompletion"
    | "bookingResponse"
    | "payout"
    | "disputeResolution"
    | "verificationReview",
    DurationStat
  > | null
  marketplace: {
    byService: Array<{
      serviceId: number
      serviceName: string
      isActive: boolean
      jobs: number
      hired: number
      artisans: number
      demandPerArtisan: number | null
      flag: "no_artisans" | "few_artisans" | null
    }>
    byArea: {
      top: Array<{ area: string; jobs: number; share: number | null }>
      other: { jobs: number; areas: number; share: number | null }
      totalJobs: number
    }
  } | null
  economics: {
    grossRevenue: string
    netRevenue: string
    paidPayments: number
    averageJobValue: string | null
    takeRate: number | null
    refundedAmount: string
    refundRateByAmount: number | null
    refundedPayments: number
    refundRateByCount: number | null
    revenueByService: Array<{
      serviceId: number
      serviceName: string
      gross: string
      net: string
      paidPayments: number
      share: number | null
    }>
    cancellation: {
      cancelled: number
      terminalJobs: number
      rate: number | null
      byActor: Record<"client" | "artisan" | "admin" | "system" | "unknown" | "unrecorded", number>
    }
  } | null
  payments: {
    attempts: {
      total: number
      succeeded: number
      failed: number
      expired: number
      cancelled: number
      duplicate: number
      inProgress: number
      successRate: number | null
    }
    methodMix: Array<{ method: string; attempts: number; succeeded: number; share: number | null }>
    payoutsOnHold: Array<{ reason: string; count: number; amount: string }>
    transferFailed: { count: number; amount: string }
    duplicateRefunds: {
      count: number
      amount: string
      byRefundStatus: Array<{ refundStatus: string; count: number; amount: string; refundedAmount: string }>
    }
    savedMethods: {
      mobileMoney: number
      card: number
      momoNetworks: Array<{ network: string; count: number; share: number | null }>
      customers: number
      customersWithMethod: number
      adoptionRate: number | null
    }
  } | null
  trust: {
    disputes: {
      filed: number
      completedJobs: number
      per100CompletedJobs: number | null
      byCategory: Counted[]
      byOutcome: Counted[]
    }
    verifications: {
      approved: number
      rejected: number
      approvalRate: number | null
      rejectionRate: number | null
      pendingBacklog: number
      oldestPendingHours: number | null
    }
    suspensions: { current: number; newInRange: number; bansInRange: number }
    moderationActions: Counted[]
    securityEvents: Counted[]
  } | null
  artisans: {
    activation: {
      total: number
      profileComplete: number
      verified: number
      hasService: number
      hasWorkingHours: number
      hasPayoutMethod: number
      visibleInSearch: number
      fullyActivated: number
      fullyActivatedRate: number | null
    }
    activeLast30Days: number
    activeLast30DaysRate: number | null
    earnings: {
      n: number
      q1: string | null
      median: string | null
      q3: string | null
      min: string | null
      max: string | null
    }
    bookingResponse: {
      requests: number
      responded: number
      expired: number
      pending: number
      withdrawn: number
      responseRate: number | null
    }
  } | null
  retention: {
    payingClients: number
    repeatClients: number
    repeatClientRate: number | null
    pairs: number
    repeatPairs: number
    repeatPairRate: number | null
    cohorts: Array<{ cohort: string; size: number; months: Array<number | null> }>
  } | null
  reviews: {
    count: number
    averageRating: number | null
    distribution: Array<{ star: number; count: number }>
    trend: Array<{ bucket: string; averageRating: number | null; count: number }>
    completedJobs: number
    reviewedJobs: number
    reviewRate: number | null
  } | null
  degraded: string[]
}

export const NOT_ENOUGH_DATA = "Not enough data yet"

/** A known tab, or `overview`. */
export function parseTab(raw: unknown): AnalyticsTab {
  return typeof raw === "string" && (ANALYTICS_TABS as readonly string[]).includes(raw) ? (raw as AnalyticsTab) : "overview"
}

/** True when a section could not be calculated (rendered as unavailable, never as zero). */
export function isDegraded(data: Pick<Insights, "degraded">, section: InsightSection): boolean {
  return Array.isArray(data.degraded) && data.degraded.includes(section)
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN
  return Number.isFinite(n) ? n : 0
}

/** "GH₵ 1,250.00". Never shows NaN. */
export function formatGhs(amount: string | number | null | undefined): string {
  return `GH₵ ${toNumber(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "1,250" */
export function formatCount(n: number | null | undefined): string {
  return toNumber(n).toLocaleString("en-GB")
}

/** "62.5%"; `null` reads as "Not enough data yet". */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return NOT_ENOUGH_DATA
  return `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`
}

/** "3.5" for a ratio; `null` reads as "—" (nothing to divide by). */
export function formatRatio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2 })
}

/**
 * A duration in hours, in the unit a person would say it in: "25 min",
 * "3.5 hours", "2.1 days". `null` reads as "Not enough data yet".
 */
export function formatDuration(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return NOT_ENOUGH_DATA
  if (hours < 1) {
    const min = Math.max(1, Math.round(hours * 60))
    return `${min} min`
  }
  if (hours < 48) {
    const h = Math.round(hours * 10) / 10
    return `${h.toLocaleString("en-GB", { maximumFractionDigits: 1 })} ${h === 1 ? "hour" : "hours"}`
  }
  const d = Math.round((hours / 24) * 10) / 10
  return `${d.toLocaleString("en-GB", { maximumFractionDigits: 1 })} days`
}

/** "Based on 12 jobs" style sample line; an empty sample says so. */
export function sampleLabel(n: number, one: string, many = `${one}s`): string {
  if (!n) return `No ${many} in this period`
  return `Based on ${formatCount(n)} ${n === 1 ? one : many}`
}

/** "Jun 2026" for a `YYYY-MM` cohort key; the key itself if it isn't one. */
export function formatCohort(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return key
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).replace("Sept", "Sep")
}

/** Width of a bar as a % of the largest value, at least 2% so a non-zero value stays visible. */
export function barWidth(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0
  return Math.max(2, Math.round((value / max) * 100))
}

/** Sentence-case label for a server key, with a readable fallback for anything new. */
function label(map: Record<string, string>, key: string): string {
  if (map[key]) return map[key]
  const words = key.replace(/[._]+/g, " ").trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown"
}

const FUNNEL_LABELS: Record<string, string> = {
  posted: "Posted",
  applied: "Got an application",
  hired: "Artisan hired",
  started: "Work started",
  completed: "Completed",
}
export const funnelLabel = (k: string) => label(FUNNEL_LABELS, k)

const METHOD_LABELS: Record<string, string> = {
  mobile_money: "Mobile money",
  card: "Card",
  hosted: "Paystack checkout",
  unknown: "Not recorded",
}
export const methodLabel = (k: string) => label(METHOD_LABELS, k)

const NETWORK_LABELS: Record<string, string> = {
  MTN: "MTN MoMo",
  VOD: "Telecel Cash",
  ATL: "AirtelTigo Money",
  unknown: "Not recorded",
}
export const networkLabel = (k: string) => label(NETWORK_LABELS, k)

const HOLD_LABELS: Record<string, string> = {
  no_payout_method: "Artisan has no payout method",
  payout_name_mismatch: "Name on the account doesn't match",
  payout_account_not_found: "Payout account not found",
  payout_check_pending: "Name check couldn't run yet",
}
export const holdLabel = (k: string) => label(HOLD_LABELS, k)

const REFUND_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  pending: "Waiting to send",
  processing: "Sending",
  requested: "Sent to Paystack",
  processed: "Refunded",
  failed: "Failed, needs an admin",
}
export const refundStatusLabel = (k: string) => label(REFUND_STATUS_LABELS, k)

const DISPUTE_CATEGORY_LABELS: Record<string, string> = {
  WORK_NOT_COMPLETED: "Work not completed",
  WORK_QUALITY: "Quality of work",
  ARTISAN_NO_SHOW: "Artisan didn't turn up",
  CLIENT_NO_ACCESS: "Client gave no access",
  PAYMENT_AMOUNT: "Payment amount",
  PROPERTY_DAMAGE: "Property damage",
  OTHER: "Other",
  UNCATEGORISED: "No category (older disputes)",
}
export const disputeCategoryLabel = (k: string) => label(DISPUTE_CATEGORY_LABELS, k)

const DISPUTE_OUTCOME_LABELS: Record<string, string> = {
  REFUND_CLIENT: "Refund to the client",
  RELEASE_ARTISAN: "Paid to the artisan",
  MUTUAL: "Resolved between them",
  NONE_RECORDED: "No verdict recorded",
}
export const disputeOutcomeLabel = (k: string) => label(DISPUTE_OUTCOME_LABELS, k)

const MODERATION_LABELS: Record<string, string> = {
  FLAG: "Flagged",
  REMOVE: "Removed",
  RESTORE: "Restored",
}
export const moderationLabel = (k: string) => label(MODERATION_LABELS, k)

const SECURITY_EVENT_LABELS: Record<string, string> = {
  "payment_settings.updated": "Payment settings changed",
  "spending_report.exported": "Spending report downloaded",
  "profile_photo.removed": "Profile photo removed",
  "payment_method.added": "Payment method saved",
  "payment_method.removed": "Payment method removed",
}
export const securityEventLabel = (k: string) => label(SECURITY_EVENT_LABELS, k)

const ACTOR_LABELS: Record<string, string> = {
  client: "Client",
  artisan: "Artisan",
  admin: "Admin",
  system: "Automatically (time ran out)",
  unknown: "Someone else",
  unrecorded: "Not recorded",
}
export const actorLabel = (k: string) => label(ACTOR_LABELS, k)

/** The cancellation split as rows, largest first, leaving out zero rows. */
export function actorRows(byActor: Record<string, number>): Array<{ key: string; count: number }> {
  return Object.entries(byActor)
    .filter(([, n]) => n > 0)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

/** A short sentence for the funnel card, from the counts alone. */
export function funnelSummary(f: NonNullable<Insights["funnel"]>): string {
  const posted = f.steps[0]?.count ?? 0
  if (!posted) return "No jobs were posted in this period."
  const completed = f.steps[f.steps.length - 1]?.count ?? 0
  return `${formatCount(completed)} of ${formatCount(posted)} posted ${posted === 1 ? "job" : "jobs"} completed (${formatPercent(f.overallConversion)}).`
}
