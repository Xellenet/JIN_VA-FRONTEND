#!/usr/bin/env node
/**
 * Customer Experience v2, item 4 (Spending): FU-4.1 to FU-4.5, L-2 and the
 * T-5 helper-level check from 03-test-plan.md, run against the shipped
 * `src/lib/spending.ts` (and `formatCurrency` from `src/lib/utils.ts`).
 *
 * Run: `node --experimental-strip-types scripts/test-spending.mjs` (the
 * `test:spending` script). Same convention as the other scripts here: no test
 * runner, real modules through Node's type stripping, exit 1 on failure, no
 * network. All data below is made up.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const lib = (...parts) => pathToFileURL(join(process.cwd(), "src", "lib", ...parts)).href
const s = await import(lib("spending.ts"))

let failures = 0
let passed = 0
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    failures++
    console.error(`FAIL ${label}: expected ${e}, got ${a}`)
  } else passed++
}

// ── FU-4.1 parseRange ────────────────────────────────────────────────────────
for (const v of ["30d", "90d", "12m", "all"]) check(`parseRange(${v})`, s.parseRange(v), v)
for (const v of ["7d", "<x>", "", "ALL", "12M", " 30d", null, undefined]) check(`parseRange(${v})`, s.parseRange(v), "12m")

// ── FU-4.2 history filters round-trip ────────────────────────────────────────
const p = (q) => new URLSearchParams(q)
{
  const f = s.parseHistoryFilters(p("status=RELEASED,REFUNDED&serviceId=3&artisanProfileId=57&search=tap&page=2"))
  check("parse status", f.status, ["RELEASED", "REFUNDED"])
  check("parse serviceId", f.serviceId, 3)
  check("parse artisanProfileId", f.artisanProfileId, 57)
  check("parse search", f.search, "tap")
  check("parse page", f.page, 2)
  const q = s.serialiseHistoryFilters("90d", f).toString()
  check("serialise", q, "range=90d&status=RELEASED%2CREFUNDED&serviceId=3&artisanProfileId=57&search=tap&page=2")
  const again = s.parseHistoryFilters(p(q))
  check("round-trip", again, f)
  check("round-trip range", s.parseRange(p(q).get("range")), "90d")
}
{
  const f = s.parseHistoryFilters(p("status=PAID,released,HELD,DROP%20TABLE&serviceId=-1&artisanProfileId=abc&page=0"))
  check("unknown statuses dropped, group expanded", f.status, ["HELD", "PENDING_TRANSFER", "TRANSFER_FAILED"])
  check("invalid serviceId dropped", f.serviceId, null)
  check("invalid artisan id dropped", f.artisanProfileId, null)
  check("page floor", f.page, 1)
  check("huge id dropped", s.parseHistoryFilters(p("serviceId=99999999999")).serviceId, null)
  check("decimal id dropped", s.parseHistoryFilters(p("serviceId=3.5")).serviceId, null)
  check("page cap", s.parseHistoryFilters(p("page=5000")).page, 1000)
  check("search cut to 100", s.parseHistoryFilters(p(`search=${"a".repeat(150)}`)).search.length, 100)
  check("empty params", s.parseHistoryFilters(p("")), s.EMPTY_FILTERS)
  check("defaults serialise to nothing", s.serialiseHistoryFilters("12m", s.EMPTY_FILTERS).toString(), "")
}
check("toggle withheld on", s.toggleStatusOption([], "withheld"), ["HELD", "PENDING_TRANSFER", "TRANSFER_FAILED"])
check("toggle withheld off", s.toggleStatusOption(["HELD", "PENDING_TRANSFER", "TRANSFER_FAILED", "RELEASED"], "withheld"), ["RELEASED"])
check("status trigger one", s.statusTriggerValue(["RELEASED"]), "Paid Out")
check("status trigger two", s.statusTriggerValue(["RELEASED", "REFUNDED"]), "2 selected")
check("status trigger none", s.statusTriggerValue([]), null)
check("result line plural", s.resultLine(5, 21), { lead: "5 of 21 payments", rest: "match your filters." })
check("result line singular", s.resultLine(1, 21), { lead: "1 of 21 payments", rest: "matches your filters." })
check("history subtitle", s.historySubtitle(21, "12m"), "21 payments in the last 12 months, newest first.")
check("history subtitle all", s.historySubtitle(1, "all"), "1 payment, newest first.")

// ── FU-4.3 / L-2 money ───────────────────────────────────────────────────────
check("compact 1,250,000", s.formatMoneyCompact("1250000.00"), "GH₵ 1.25M")
check("full 1,250,000", s.formatMoney("1250000.00"), "GH₵ 1,250,000.00")
check("compact 999.99 stays full", s.formatMoneyCompact(999.99), "GH₵ 999.99")
check("axis 4000", s.formatAxisMoney(4000), "GH₵ 4k")
check("axis 0", s.formatAxisMoney(0), "0")
const utils = await import(lib("utils.ts"))
for (const [input, expected] of [
  [0, "GH₵ 0.00"],
  [0.5, "GH₵ 0.50"],
  [1234, "GH₵ 1,234.00"],
  [1250000, "GH₵ 1,250,000.00"],
]) {
  check(`L-2 formatCurrency(${input})`, utils.formatCurrency(input), expected)
  check(`L-2 formatMoney(${input}) agrees`, s.formatMoney(input), expected)
}

// ── FU-4.4 status labels ─────────────────────────────────────────────────────
const expectedLabels = {
  PENDING: "Awaiting payment",
  HELD: "Withheld",
  PENDING_TRANSFER: "Withheld",
  TRANSFER_FAILED: "Withheld",
  RELEASED: "Paid Out",
  REFUNDED: "Refunded",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
}
for (const status of s.PAYMENT_STATUSES) {
  const label = s.spendingStatusLabel(status)
  check(`label ${status}`, label, expectedLabels[status])
  check(`no raw enum name for ${status}`, /[A-Z]{2,}|_/.test(label), false)
  check(`no banned held-money word for ${status}`, new RegExp("es" + "crow", "i").test(label), false)
}
check("unknown status", s.spendingStatusLabel("SOMETHING_NEW"), "Unknown")
check("method mobile money", s.methodLabel("mobile_money"), "Mobile money")
check("method bank_transfer", s.methodLabel("bank_transfer"), "Bank")
check("method ussd", s.methodLabel("ussd"), "Other")
check("method pending", s.methodLabel(null, "PENDING"), "Not paid yet")

// ── FU-4.5 chart summaries ───────────────────────────────────────────────────
const series = [
  { bucketStart: "2025-11-01", netSpent: "0.00", count: 0 },
  { bucketStart: "2025-12-01", netSpent: "1200.00", count: 2 },
  { bucketStart: "2026-02-01", netSpent: "0.00", count: 0 },
  { bucketStart: "2026-08-01", netSpent: "3150.00", count: 3 },
]
check(
  "over-time summary",
  s.overTimeSummary(series, "month"),
  "Highest in August 2026 at GH₵ 3,150.00. Nothing spent in November 2025 or February 2026.",
)
check(
  "over-time summary, many zero months",
  s.overTimeSummary([...series, { bucketStart: "2026-09-01", netSpent: "0.00", count: 0 }], "month"),
  "Highest in August 2026 at GH₵ 3,150.00. Nothing spent in 3 months.",
)
check(
  "over-time summary, weeks",
  s.overTimeSummary([{ bucketStart: "2026-08-03", netSpent: "50.00", count: 1 }], "week"),
  "Highest in the week of 3 Aug 2026 at GH₵ 50.00.",
)
check("over-time summary, nothing", s.overTimeSummary([{ bucketStart: "2026-08-03", netSpent: "0", count: 0 }], "day"), "Nothing spent in this period.")
check("category summary", s.categorySummary([{ serviceName: "Plumbing", share: 0.351 }]), "Plumbing is 35% of your spending.")
check(
  "artisan summary",
  s.artisanSummary([{ displayName: "Kofi Asante", netSpent: "3780.00", count: 4 }]),
  "Kofi Asante received the most: GH₵ 3,780.00 over 4 jobs.",
)
check("channel summary most", s.channelSummary([{ channel: "mobile_money", share: 0.57 }, { channel: "card", share: 0.39 }]), "Most of your payments were by mobile money.")
check("channel summary split", s.channelSummary([{ channel: "card", share: 0.45 }, { channel: "mobile_money", share: 0.4 }, { channel: "bank", share: 0.15 }]), "Your payments were split between card and mobile money.")
check("channel alt", s.channelAltText([{ channel: "mobile_money", share: 0.57 }, { channel: "card", share: 0.39 }, { channel: "bank", share: 0.04 }]), "Mobile money 57%, card 39%, bank 4%")
check("column label", s.columnLabel({ bucketStart: "2026-06-01", netSpent: "1890.00", count: 2 }, "month"), "June 2026: GH₵ 1,890.00, 2 payments")
check("column label week", s.columnLabel({ bucketStart: "2026-08-03", netSpent: "10", count: 1 }, "week"), "The week of 3 Aug 2026: GH₵ 10.00, 1 payment")

// ── Statement band change line (D7) ──────────────────────────────────────────
check("change more", s.changeLine("12m", "14820.00", "9300.00"), { kind: "more", chip: "59% more", rest: "than the previous 12 months (GH₵ 9,300.00)" })
check("change less", s.changeLine("30d", "50.00", "100.00"), { kind: "less", chip: "50% less", rest: "than the previous 30 days (GH₵ 100.00)" })
check("change same", s.changeLine("90d", "10.00", "10.00"), { kind: "same", chip: null, rest: "The same as the previous 90 days" })
check("change from zero", s.changeLine("90d", "10.00", "0.00"), { kind: "zero", chip: null, rest: "Nothing spent in the previous 90 days" })
check("change hidden for all", s.changeLine("all", "10.00", null), null)
check("net spent label all", s.netSpentLabel("all"), "Net spent since you joined")

// ── Dates and file name ──────────────────────────────────────────────────────
check("formatDate", s.formatDate("2026-10-30T14:14:00.000Z"), "30 Oct 2026")
check("formatDateTime", s.formatDateTime("2026-06-11T13:10:00.000Z"), "Thu 11 Jun 2026, 1:10 pm")
check("csvFileName", s.csvFileName(new Date("2026-10-30T23:59:00.000Z")), "jinva-payments-2026-10-30.csv")
check("niceTicks", s.niceTicks(3150), [0, 1000, 2000, 3000, 4000])
check("tickIndices", s.tickIndices(30, 6), [0, 5, 10, 15, 20, 25])

// ── Links only from typed ids (SEC-18) ───────────────────────────────────────
check("jobHref ok", s.jobHref(790), "/dashboard/user/jobs/790")
check("jobHref string id", s.jobHref("790"), "/dashboard/user/jobs/790")
for (const bad of [0, -1, 1.5, "1/../../x", "javascript:alert(1)", null, undefined, Number.MAX_SAFE_INTEGER + 2]) {
  check(`jobHref(${String(bad)}) refused`, s.jobHref(bad), null)
  check(`artisanHref(${String(bad)}) refused`, s.artisanHref(bad), null)
}

// ── T-5 (helper level): chart config keys are a static set of token colours ─
{
  const allowed = new Set(s.CHART_CONFIG_KEYS)
  for (const [key, value] of Object.entries(s.OVER_TIME_CHART_CONFIG)) {
    check(`chart key ${key} is static`, allowed.has(key), true)
    check(`chart colour ${key} is a token`, /^var\(--chart-\d\)$/.test(value.color), true)
  }
  for (const [key, colour] of Object.entries(s.METHOD_COLOURS)) {
    check(`method colour ${key} uses tokens only`, /^(var\(--[a-z0-9-]+\)|color-mix\(in oklab, var\(--[a-z0-9-]+\) \d+%, transparent\))$/.test(colour), true)
  }
}

if (failures) {
  console.error(`\n${failures} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`test-spending: ${passed} checks passed`)
