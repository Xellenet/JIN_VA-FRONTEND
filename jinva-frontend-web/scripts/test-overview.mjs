#!/usr/bin/env node
/**
 * Customer Experience v2, Overview: FU-1.1 to FU-1.6 and FU-2.1 to FU-2.5
 * (docs/specs/customer-experience-v2/03-test-plan.md), run against the shipped
 * pure module `src/lib/overview.ts`.
 *
 * Run: `npm run test:overview`, or
 *   node --experimental-strip-types scripts/test-overview.mjs
 * Same convention as `scripts/test-phone-number.mjs`: no test runner, the real
 * module imported through Node's type stripping, exit 1 on failure. No network.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const o = await import(pathToFileURL(join(process.cwd(), "src", "lib", "overview.ts")).href)

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

// ── FU-1.1 status → stage ────────────────────────────────────────────────────
check("FU-1.1 OPEN", o.statusToStage("OPEN"), "open")
check("FU-1.1 PENDING", o.statusToStage("PENDING"), "in_progress")
check("FU-1.1 IN_PROGRESS", o.statusToStage("IN_PROGRESS"), "in_progress")
check("FU-1.1 COMPLETED", o.statusToStage("COMPLETED"), "completed")
check("FU-1.1 CANCELLED", o.statusToStage("CANCELLED"), "closed")
check("FU-1.1 EXPIRED", o.statusToStage("EXPIRED"), "closed")
check("FU-1.1 unknown", o.statusToStage("DISPUTED"), null)
check("FU-1.1 lower case", o.statusToStage("open"), null)
check("FU-1.1 non-string", o.statusToStage(3), null)

// ── FU-1.2 parseStage ────────────────────────────────────────────────────────
for (const s of ["open", "in_progress", "completed", "closed"]) check(`FU-1.2 ${s}`, o.parseStage(s), s)
for (const bad of ["OPEN", "<script>", "", null, undefined, "closed&x=1", ["open"], "x".repeat(5000), "In_progress", " open"]) {
  const out = o.parseStage(bad)
  check(`FU-1.2 rejects ${JSON.stringify(bad)?.slice(0, 30)}`, out, null)
}
// Never hands back the input object itself.
const literal = new String("open")
check("FU-1.2 String object", o.parseStage(literal), null)

// ── FU-1.3 filter bar sentence ───────────────────────────────────────────────
check("FU-1.3 one", o.filterBarSentence("in_progress", 1), "Showing In progress jobs only · 1 result")
check("FU-1.3 four", o.filterBarSentence("in_progress", 4), "Showing In progress jobs only · 4 results")
check("FU-1.3 zero", o.filterBarSentence("closed", 0), "Showing Closed jobs only · 0 results")
check("FU-1.3 list heading", o.listTitle("in_progress"), "In progress jobs")
check("FU-1.3 recent heading", o.listTitle(null), "Recent jobs")
check("FU-1.3 stop name", o.stopLabel("in_progress", 3), "In progress: 3 jobs")
check("FU-1.3 stop name one", o.stopLabel("open", 1), "Open: 1 job")
check("FU-1.3 stop unavailable", o.stopLabel("open", null), "Open: count unavailable")
check("FU-1.3 total", o.totalLabel(38), "38 jobs in total")
check("FU-1.3 total one", o.totalLabel(1), "1 job in total")

// ── FU-1.4 live region ───────────────────────────────────────────────────────
check("FU-1.4 select closed 5", o.liveSelect("closed", 5), "Showing 5 closed jobs")
check("FU-1.4 select in progress 3", o.liveSelect("in_progress", 3), "Showing 3 in progress jobs")
check("FU-1.4 select open 1", o.liveSelect("open", 1), "Showing 1 open job")
check("FU-1.4 select closed 0", o.liveSelect("closed", 0), "Showing 0 closed jobs")
check("FU-1.4 clear", o.liveClear(5), "Filter cleared, showing 5 recent jobs")
check("FU-1.4 show more", o.liveShowMore("completed", 20, 27), "Showing 20 of 27 completed jobs")

// ── FU-1.5 summarise from account-wide counts (A38) ──────────────────────────
const a38 = { open: 3, in_progress: 3, completed: 27, closed: 5 }
check("FU-1.5 A38", o.summarise(a38), "3 jobs in progress, 3 jobs waiting for applications.")
check("FU-1.5 one each", o.summarise({ open: 1, in_progress: 1, completed: 0, closed: 0 }), "1 job in progress, 1 job waiting for applications.")
check("FU-1.5 only completed", o.summarise({ open: 0, in_progress: 0, completed: 27, closed: 5 }), "Nothing in progress right now.")
check("FU-1.5 empty", o.summarise({ open: 0, in_progress: 0, completed: 0, closed: 0 }), "Post a job and artisans near you can apply.")
check("FU-1.5 counts failed", o.summarise(null), "Your most recent jobs are below.")

// ── FU-1.6 show more ─────────────────────────────────────────────────────────
check("FU-1.6 after page 1 of 23", o.showMoreState(10, 23, "completed"), { kind: "more", nextPage: 2, label: "10 of 23 shown" })
check("FU-1.6 after page 2 of 23", o.showMoreState(20, 23, "completed"), { kind: "more", nextPage: 3, label: "20 of 23 shown" })
check("FU-1.6 after page 3 of 23", o.showMoreState(23, 23, "completed"), { kind: "done" })
check("FU-1.6 50 of 55", o.showMoreState(50, 55, "completed"), { kind: "my-jobs", label: "See all completed jobs in My Jobs" })
check("FU-1.6 40 of 55", o.showMoreState(40, 55, "completed").kind, "more")
check("FU-1.6 exactly 50", o.showMoreState(50, 50, "completed"), { kind: "done" })
check("FU-1.6 my jobs link", o.myJobsHref("completed"), "/dashboard/user/jobs?stage=completed")
check("FU-1.6 my jobs link, bad stage", o.myJobsHref("<x>"), "/dashboard/user/jobs")

// ── FU-2.1 / FU-2.2 appointment ──────────────────────────────────────────────
// 4 Nov 2026 is a Wednesday; the 03 test plan and mockups say "Tue", a calendar slip.
const booking = { scheduledDate: "2026-11-04", startTime: "09:00", endTime: "11:00" }
check("FU-2.1 next week", o.formatAppointment(booking, new Date("2026-10-30T12:00:00Z")).line, "Wed 4 Nov 2026, 9:00 am – 11:00 am")
check("FU-2.1 tomorrow", o.formatAppointment(booking, new Date("2026-11-03T08:00:00Z")).line, "Tomorrow, 9:00 am – 11:00 am")
check("FU-2.1 today", o.formatAppointment(booking, new Date("2026-11-04T07:00:00Z")).line, "Today, 9:00 am – 11:00 am")
check("FU-2.1 late evening Accra is still that day", o.formatAppointment(booking, new Date("2026-11-03T23:59:00Z")).relative, "Tomorrow")
check("FU-2.1 tile", o.formatAppointment(booking, new Date("2026-10-30T12:00:00Z")).tile, { weekday: "Wed", day: "4", month: "Nov" })
check("FU-2.1 pm", o.formatTime12("13:30"), "1:30 pm")
check("FU-2.1 noon", o.formatTime12("12:00"), "12:00 pm")
check("FU-2.1 midnight", o.formatTime12("00:15"), "12:15 am")
check("FU-2.1 seconds", o.formatTime12("09:00:00"), "9:00 am")
const noTime = { scheduledDate: "2026-11-04", startTime: null, endTime: null }
check("FU-2.2 date only", o.formatAppointment(noTime, new Date("2026-10-30T12:00:00Z")).line, "Wed 4 Nov 2026")
check("FU-2.2 date only, time null", o.formatAppointment(noTime, new Date("2026-10-30T12:00:00Z")).time, null)
check("FU-2.2 date only tomorrow", o.formatAppointment(noTime, new Date("2026-11-03T12:00:00Z")).line, "Tomorrow, Wed 4 Nov 2026")
check("FU-2.2 bad date", o.formatAppointment({ scheduledDate: "4/11/2026", startTime: null, endTime: null }, new Date()), null)

// ── FU-2.3 comparison ────────────────────────────────────────────────────────
const up = o.spendComparison("1840.00", "1420.00", "2026-09")
check("FU-2.3 up", `${up.arrow} ${up.text}`, "▲ GH₵ 420.00 vs September")
check("FU-2.3 up sr word", up.srWord, "Up")
const down = o.spendComparison("1000.00", "1500.00", "2026-09")
check("FU-2.3 down", `${down.arrow} ${down.text}`, "▼ GH₵ 500.00 vs September")
check("FU-2.3 hidden when last month 0", o.spendComparison("500.00", "0.00", "2026-09"), null)
check("FU-2.3 money", o.formatMoney("1840.00"), "GH₵ 1,840.00")
check("FU-2.3 previous month over a year", o.previousMonthKey("2026-01"), "2025-12")
check("FU-2.3 month name", o.monthName("2026-10"), "October 2026")

// ── FU-2.4 sparkline alternative ─────────────────────────────────────────────
const series = [
  { month: "2026-05", netSpent: "900.00" },
  { month: "2026-06", netSpent: "0.00" },
  { month: "2026-07", netSpent: "1200.00" },
  { month: "2026-08", netSpent: "2150.00" },
  { month: "2026-09", netSpent: "1420.00" },
  { month: "2026-10", netSpent: "1840.00" },
]
check("FU-2.4 alt", o.sparklineAlt(series), "Spending over the last 6 months, highest in August, GH₵ 2,150.00")
check("FU-2.4 all zero", o.sparklineAlt(series.map((p) => ({ ...p, netSpent: "0.00" }))), "Spending over the last 6 months, no payments")
const geo = o.sparklineGeometry(series.map((p) => Number(p.netSpent)))
check("FU-2.4 geometry starts at the left pad", geo.line.startsWith("M4.0,"), true)
check("FU-2.4 highest month at the top", geo.line.includes("L167.2,10.0"), true)
check("FU-2.4 zero month on the baseline", geo.line.includes("L58.4,60.0"), true)

// ── FU-2.5 action links ──────────────────────────────────────────────────────
check("FU-2.5 confirm one", o.actionHref("completionsToConfirm", { jobId: 812 }), "/dashboard/user/jobs/812")
check("FU-2.5 confirm several", o.actionHref("completionsToConfirm", { jobId: null }), "/dashboard/user/jobs?stage=in_progress")
check("FU-2.5 pay one", o.actionHref("paymentsDue", { jobId: 815 }), "/dashboard/user/jobs/815/pay")
check("FU-2.5 pay several", o.actionHref("paymentsDue", { jobId: null }), "/dashboard/user/jobs?stage=in_progress")
check("FU-2.5 review one", o.actionHref("applicationsToReview", { jobId: 9 }), "/dashboard/user/jobs/9")
check("FU-2.5 review several", o.actionHref("applicationsToReview", { jobId: null }), "/dashboard/user/jobs?stage=open")
check("FU-2.5 messages", o.actionHref("unreadMessages"), "/dashboard/user/messages")
// Never a URL from data: hostile or non-integer ids fall back to the fixed list.
for (const bad of ["812", "https://evil.example/x", "javascript:alert(1)", -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 2, NaN, "../../admin", { toString: () => "1" }]) {
  const href = o.actionHref("completionsToConfirm", { jobId: bad })
  check(`FU-2.5 rejects id ${String(bad).slice(0, 24)}`, href, "/dashboard/user/jobs?stage=in_progress")
}
for (const kind of ["completionsToConfirm", "paymentsDue", "applicationsToReview", "unreadMessages", "bogus"]) {
  for (const jobId of [1, 812, null]) {
    const href = o.actionHref(kind, { jobId })
    check(`FU-2.5 ${kind}/${jobId} stays inside /dashboard/user/`, /^\/dashboard\/user\/[a-z0-9/?=_]+$/.test(href), true)
  }
}
check("FU-2.5 booking link", o.bookingHref(301), "/dashboard/user/bookings/301")
check("FU-2.5 booking link rejects string", o.bookingHref("301"), null)
check("FU-2.5 artisan link", o.artisanHref(57), "/dashboard/user/artisan/57")
check("FU-2.5 deleted artisan", o.artisanHref(null), null)
check("FU-2.5 aria single", o.actionAriaLabel("completionsToConfirm", 1, true), "Confirm completion: 1. Opens the job")
check("FU-2.5 aria messages", o.actionAriaLabel("unreadMessages", 2, false), "Unread messages: 2. Opens Messages")
check("FU-2.5 aria review several", o.actionAriaLabel("applicationsToReview", 4, false), "Review applications: 4. Opens your open jobs")

// ── Copy rules (plan §0.2) ───────────────────────────────────────────────────
const { readFileSync, readdirSync } = await import("node:fs")
const files = [
  "src/lib/overview.ts",
  "src/lib/customer-api.ts",
  "src/components/dashboard/job-track.tsx",
  "src/app/dashboard/user/page.tsx",
  ...readdirSync(join(process.cwd(), "src/components/dashboard/overview")).map((f) => `src/components/dashboard/overview/${f}`),
]
for (const f of files) {
  const text = readFileSync(join(process.cwd(), f), "utf8")
  check(`copy: no "escrow" in ${f}`, /escrow/i.test(text), false)
  check(`copy: no dangerouslySetInnerHTML in ${f}`, text.includes("dangerouslySetInnerHTML"), false)
}


// ── Artisan Overview and Calendar (artisan fixes H3, H4): src/lib/artisan-overview.ts ──
{
  const a = await import(pathToFileURL(join(process.cwd(), "src", "lib", "artisan-overview.ts")).href)
  const t0 = new Date("2026-10-31T10:00:00.000Z")
  check("A respondBy expired", a.respondByText("2026-10-31T09:59:00.000Z", t0).expired, true)
  check("A respondBy <1h", a.respondByText("2026-10-31T10:30:00.000Z", t0), { expired: false, text: "Less than an hour left to reply", urgent: true })
  check("A respondBy 1h", a.respondByText("2026-10-31T11:10:00.000Z", t0).text, "1 hour left to reply")
  check("A respondBy 20h not urgent", a.respondByText("2026-11-01T06:00:00.000Z", t0).urgent, false)
  check("A respondBy bad", a.respondByText("nope", t0).text, "")
  check("A title never 'Service — Name'", a.bookingTitle(null, "Ama Mensah"), "Booking with Ama Mensah")
  check("A title service", a.bookingTitle({ name: "Plumbing" }, "Ama"), "Plumbing")
  check("A client fallback", a.clientLabel("  "), "Client")
  check("A location null", a.locationText(null), "Location shared in messages")
  check("A location", a.locationText(" 12 Ring Road "), "12 Ring Road")
  const b = (status, scheduledDate, endTime) => ({ status, scheduledDate, endTime })
  check("A group pending", a.calendarGroup(b("PENDING", "2026-10-01", "10:00"), t0), "requests")
  check("A group upcoming", a.calendarGroup(b("CONFIRMED", "2026-10-31", "11:00:00"), t0), "upcoming")
  check("A group follow-up (past confirmed)", a.calendarGroup(b("CONFIRMED", "2026-10-31", "09:00"), t0), "followUp")
  check("A group history", a.calendarGroup(b("NO_SHOW", "2026-11-05", "09:00"), t0), "history")
  check("A jobs href", a.artisanJobsHref("awaiting_client"), "/dashboard/artisan/jobs?stage=awaiting_client")
  check("A jobs href hostile", a.artisanJobsHref("<x>"), "/dashboard/artisan/jobs")
  check("A booking param", a.parseBookingParam("42"), 42)
  for (const bad of ["-1", "0", "4e2", "42abc", "<script>", "9".repeat(20)]) check(`A booking param ${bad}`, a.parseBookingParam(bad), null)
  check("A job href bad", a.artisanJobHref("../x"), null)
  check("A summary", a.artisanSummary({ toStart: 1, inProgress: 2, awaitingClient: 0, done: 0, closed: 0, total: 3, applied: 0 }, 3, 1),
    "3 booking requests to answer, 1 appointment today, 1 job to start, 2 jobs in progress.")
  check("A summary failed", a.artisanSummary(null, null, null), "Here is what needs you today.")
  check("A summary new", a.artisanSummary({ toStart: 0, inProgress: 0, awaitingClient: 0, done: 0, closed: 0, total: 0, applied: 0 }, 0, 0),
    "Apply for open jobs below to get your first booking.")
  const rows = a.artisanActionRows({ requests: 2, disputes: 1, earnings: { needsAction: "120.00", needsActionCount: 1, hasPayoutMethod: false } })
  check("A action rows", rows.map((r) => [r.kind, r.href]), [["bookingRequests", "#booking-requests"], ["disputes", "/dashboard/artisan/disputes"], ["payoutMethod", "/dashboard/artisan/settings?tab=payments#payout-method"]])
  check("A action rows failed sections", a.artisanActionRows({ requests: null, disputes: null, earnings: null }), [])
  check("A get verified (never sent)", a.artisanActionRows({ requests: 0, disputes: 0, earnings: null, verification: "none" }).map((r) => [r.kind, r.href, r.label, r.count]), [["verification", "/dashboard/artisan/settings?tab=verification", "Get verified", 0]])
  check("A get verified (rejected)", a.artisanActionRows({ requests: 0, disputes: 0, earnings: null, verification: "rejected" })[0]?.detail, "Your last submission wasn't approved")
  check("A no verify row when verified, in review or unknown", a.artisanActionRows({ requests: 0, disputes: 0, earnings: null, verification: null }), [])
  // The setup card asks for the payout method and the documents, so the rail doesn't ask again.
  check("A setup card folds payout method and verify rows", a.artisanActionRows({ requests: 1, disputes: 0, earnings: { needsAction: "80.00", needsActionCount: 1, hasPayoutMethod: false }, verification: "none", setupCard: true }).map((r) => r.kind), ["bookingRequests"])
  check("A setup card keeps a failed payout row", a.artisanActionRows({ requests: 0, disputes: 0, earnings: { needsAction: "80.00", needsActionCount: 1, hasPayoutMethod: true }, verification: "rejected", setupCard: true }).map((r) => r.kind), ["payoutsNeedAction"])
  check("A money", a.formatGhs("1840"), "GH₵ 1,840.00")
}

if (failures > 0) {
  console.error(`\n${failures} failed, ${passes} passed`)
  process.exit(1)
}
console.log(`✓ overview: ${passes} checks passed`)
