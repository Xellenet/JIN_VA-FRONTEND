#!/usr/bin/env node
/**
 * Admin platform insights: the pure helpers in `src/lib/admin-insights.ts`
 * (durations, percentages, money, tabs, labels, degraded sections).
 *
 * Run: `npm run test:admin-insights`. Same convention as the other scripts
 * here: no test runner, the real module through Node's type stripping, exit 1
 * on failure, no network. All data below is made up.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const m = await import(pathToFileURL(join(process.cwd(), "src", "lib", "admin-insights.ts")).href)

let failures = 0
let passes = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) passes++
  else {
    failures++
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// ── Durations ────────────────────────────────────────────────────────────────
check("duration null", m.formatDuration(null), "Not enough data yet")
check("duration undefined", m.formatDuration(undefined), "Not enough data yet")
check("duration NaN", m.formatDuration(Number.NaN), "Not enough data yet")
check("duration negative", m.formatDuration(-1), "Not enough data yet")
check("duration 0 → 1 min", m.formatDuration(0), "1 min")
check("duration 0.25 h", m.formatDuration(0.25), "15 min")
check("duration 1 h", m.formatDuration(1), "1 hour")
check("duration 3.14 h", m.formatDuration(3.14), "3.1 hours")
check("duration 47.9 h", m.formatDuration(47.9), "47.9 hours")
check("duration 48 h", m.formatDuration(48), "2 days")
check("duration 60 h", m.formatDuration(60), "2.5 days")
check("duration 240 h", m.formatDuration(240), "10 days")

// ── Percentages and ratios ───────────────────────────────────────────────────
check("percent null", m.formatPercent(null), "Not enough data yet")
check("percent 0", m.formatPercent(0), "0%")
check("percent 62.5", m.formatPercent(62.5), "62.5%")
check("percent 100", m.formatPercent(100), "100%")
check("percent 33.33", m.formatPercent(33.33), "33.3%")
check("percent Infinity", m.formatPercent(Infinity), "Not enough data yet")
check("ratio null", m.formatRatio(null), "—")
check("ratio 3", m.formatRatio(3), "3")
check("ratio 2.555", m.formatRatio(2.555), "2.56")

// ── Money and counts ─────────────────────────────────────────────────────────
check("money string", m.formatGhs("1250.5"), "GH₵ 1,250.50")
check("money number", m.formatGhs(0), "GH₵ 0.00")
check("money null", m.formatGhs(null), "GH₵ 0.00")
check("money garbage", m.formatGhs("abc"), "GH₵ 0.00")
check("count", m.formatCount(12345), "12,345")
check("count null", m.formatCount(null), "0")

// ── Samples, cohorts, bars ───────────────────────────────────────────────────
check("sample 0", m.sampleLabel(0, "job"), "No jobs in this period")
check("sample 1", m.sampleLabel(1, "job"), "Based on 1 job")
check("sample many", m.sampleLabel(1200, "payout"), "Based on 1,200 payouts")
check("sample irregular", m.sampleLabel(2, "dispute", "disputes"), "Based on 2 disputes")
check("cohort Jun", m.formatCohort("2026-06"), "Jun 2026")
check("cohort Sep", m.formatCohort("2026-09"), "Sep 2026")
check("cohort bad", m.formatCohort("June"), "June")
check("bar 0", m.barWidth(0, 10), 0)
check("bar max 0", m.barWidth(5, 0), 0)
check("bar half", m.barWidth(5, 10), 50)
check("bar tiny stays visible", m.barWidth(1, 1000), 2)
check("bar full", m.barWidth(10, 10), 100)

// ── Tabs and sections ────────────────────────────────────────────────────────
check("tab known", m.parseTab("payments"), "payments")
check("tab unknown", m.parseTab("<script>"), "overview")
check("tab missing", m.parseTab(null), "overview")
check("tab case", m.parseTab("Payments"), "overview")
check("tabs order", m.ANALYTICS_TABS, ["overview", "funnel", "marketplace", "payments", "trust", "artisans", "retention"])
check(
  "every section has a tab",
  m.INSIGHT_SECTIONS.every((s) => Object.values(m.TAB_SECTIONS).some((list) => list.includes(s))),
  true,
)
check("degraded yes", m.isDegraded({ degraded: ["speed"] }, "speed"), true)
check("degraded no", m.isDegraded({ degraded: [] }, "speed"), false)
check("degraded missing list", m.isDegraded({}, "speed"), false)

// ── Labels ───────────────────────────────────────────────────────────────────
check("network VOD is Telecel", m.networkLabel("VOD"), "Telecel Cash")
check("method hosted", m.methodLabel("hosted"), "Paystack checkout")
check("unknown key fallback", m.holdLabel("payout_new_reason"), "Payout new reason")
check("dotted fallback", m.securityEventLabel("account.locked"), "Account locked")
check("empty key fallback", m.moderationLabel(""), "Unknown")
check("funnel label", m.funnelLabel("applied"), "Got an application")
check(
  "no label says escrow",
  [
    m.holdLabel("no_payout_method"),
    m.refundStatusLabel("requested"),
    m.disputeOutcomeLabel("RELEASE_ARTISAN"),
    m.actorLabel("system"),
  ].some((s) => /escrow/i.test(s)),
  false,
)
check(
  "actor rows drop zeros, largest first",
  m.actorRows({ client: 1, artisan: 3, admin: 0, system: 0, unknown: 0, unrecorded: 1 }),
  [
    { key: "artisan", count: 3 },
    { key: "client", count: 1 },
    { key: "unrecorded", count: 1 },
  ],
)

// ── Funnel summary ───────────────────────────────────────────────────────────
check(
  "funnel summary empty",
  m.funnelSummary({ steps: [{ key: "posted", count: 0, conversionFromPrevious: null }], overallConversion: null }),
  "No jobs were posted in this period.",
)
check(
  "funnel summary",
  m.funnelSummary({
    steps: [
      { key: "posted", count: 8, conversionFromPrevious: null },
      { key: "completed", count: 2, conversionFromPrevious: 40 },
    ],
    overallConversion: 25,
  }),
  "2 of 8 posted jobs completed (25%).",
)
check(
  "funnel summary single",
  m.funnelSummary({
    steps: [
      { key: "posted", count: 1, conversionFromPrevious: null },
      { key: "completed", count: 1, conversionFromPrevious: 100 },
    ],
    overallConversion: 100,
  }),
  "1 of 1 posted job completed (100%).",
)

if (failures) {
  console.error(`\n${failures} failed, ${passes} passed`)
  process.exit(1)
}
console.log(`admin insights helpers: ${passes} checks passed`)
