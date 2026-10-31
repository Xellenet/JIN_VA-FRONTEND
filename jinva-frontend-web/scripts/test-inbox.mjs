#!/usr/bin/env node
/**
 * Unit tests for the bell and envelope "read in place" helpers (item 6):
 * FU-6.1 to FU-6.5 and T-4 (SEC-18 hostile inputs) from 03-test-plan.md.
 *
 * Run: `npm run test:inbox`. Same convention as the other scripts here: a
 * plain Node script that imports the shipped modules through type stripping
 * (they have no runtime imports), exit 1 on any failure.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const root = join(import.meta.dirname, "..")
const N = await import(pathToFileURL(join(root, "src/lib/notifications.ts")).href)
const M = await import(pathToFileURL(join(root, "src/lib/messages.ts")).href)

let passed = 0
const failures = []
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) passed++
  else failures.push(`${name}\n    expected ${JSON.stringify(expected)}\n    got      ${JSON.stringify(actual)}`)
}

// ── FU-6.1: mapNotification keeps payload and the original createdAt ──────
{
  const item = {
    id: "9021",
    type: "DISPUTE_RESOLVED",
    title: "Dispute resolved",
    body: "Your dispute on 'Fix leaking kitchen tap' was resolved in your favour.",
    isRead: false,
    payload: { jobId: 812 },
    createdAt: "2026-10-30T14:14:00.000Z",
  }
  const mapped = N.mapNotification(item)
  check("FU-6.1 payload kept", mapped.payload, { jobId: 812 })
  check("FU-6.1 createdAt kept", mapped.createdAt, "2026-10-30T14:14:00.000Z")
  check("FU-6.1 raw type kept", mapped.rawType, "DISPUTE_RESOLVED")
  check("FU-6.1 body kept in full", mapped.message, item.body)
  check("FU-6.1 type bucket", mapped.type, "dispute")
}

// ── FU-6.2: notificationAction for typed ids ───────────────────────────────
check("FU-6.2 jobId → View job", N.notificationAction("DISPUTE_RESOLVED", { jobId: 812 }), {
  label: "View job",
  href: "/dashboard/user/jobs/812",
})
check("FU-6.2 bookingId → View booking", N.notificationAction("BOOKING_CONFIRMED", { bookingId: 301 }), {
  label: "View booking",
  href: "/dashboard/user/bookings/301",
})
check("FU-6.2 conversationId → Open conversation", N.notificationAction("MESSAGE_RECEIVED", { conversationId: 44 }), {
  label: "Open conversation",
  href: "/dashboard/user/messages?conversation=44",
})
check("FU-6.2 payment + paymentId → View payment (internal)", N.notificationAction("PAYMENT_REFUNDED", { paymentId: 4471 }), {
  label: "View payment",
  href: "/dashboard/user/report",
})
check("FU-6.2 payment + jobId → View payment on the job", N.notificationAction("PAYMENT_RECEIPT", { jobId: 812, reference: "JV-REF-1" }), {
  label: "View payment",
  href: "/dashboard/user/jobs/812",
})
check("FU-6.2 dispute with bookingId → View booking", N.notificationAction("DISPUTE_RESOLVED", { bookingId: 77 }), {
  label: "View booking",
  href: "/dashboard/user/bookings/77",
})
check("FU-6.2 string digits accepted", N.notificationAction("JOB_STARTED", { jobId: "812" })?.href, "/dashboard/user/jobs/812")
check("FU-6.2 empty payload → none", N.notificationAction("JOB_STARTED", {}), null)
check("FU-6.2 no payload → none", N.notificationAction("JOB_STARTED", undefined), null)
check("FU-6.2 traversal → none", N.notificationAction("JOB_STARTED", { jobId: "812/../../admin" }), null)
check("FU-6.2 negative → none", N.notificationAction("JOB_STARTED", { jobId: -1 }), null)
check("FU-6.2 url only → none", N.notificationAction("JOB_STARTED", { url: "https://evil.example.com" }), null)
check(
  "FU-6.2 url ignored when an id is present",
  N.notificationAction("JOB_STARTED", { jobId: 5, url: "https://evil.example.com", href: "//evil.example.com" })?.href,
  "/dashboard/user/jobs/5",
)

// ── T-4 / SEC-18: every hostile id gives null ──────────────────────────────
const HOSTILE_IDS = [
  "javascript:alert(1)",
  "//evil.example.com",
  "/\\evil.example.com",
  "%2F%2Fevil.example.com",
  "https://evil.example.com",
  -1,
  0,
  1.5,
  "12abc",
  "1e3",
  " 12",
  "0x1F",
  "",
  null,
  undefined,
  true,
  [12],
  { id: 12 },
  Number.MAX_SAFE_INTEGER + 2,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  "99999999999999999999",
]
for (const key of ["jobId", "bookingId", "conversationId", "paymentId"]) {
  for (const value of HOSTILE_IDS) {
    for (const type of ["JOB_STARTED", "BOOKING_CONFIRMED", "MESSAGE_RECEIVED", "PAYMENT_REFUNDED", "DISPUTE_RESOLVED"]) {
      check(`T-4 ${type} ${key}=${String(value)}`, N.notificationHref(type, { [key]: value }), null)
    }
  }
}
for (const payload of ["javascript:alert(1)", 812, [812], null, "{\"jobId\":812}"]) {
  check(`T-4 non-object payload ${JSON.stringify(payload)}`, N.notificationHref("JOB_STARTED", payload), null)
}
check("T-4 hostile type string is harmless", N.notificationHref("<script>alert(1)</script>", { jobId: 3 }), "/dashboard/user/jobs/3")
check("T-4 non-string type is harmless", N.notificationHref(undefined, { jobId: 3 }), "/dashboard/user/jobs/3")

// Every href that does come back stays under /dashboard/user/ and resolves on our origin.
{
  const samples = [
    ["JOB_STARTED", { jobId: 1 }],
    ["BOOKING_CONFIRMED", { bookingId: 9007199254740991 }],
    ["MESSAGE_RECEIVED", { conversationId: 2 }],
    ["PAYMENT_RECEIPT", { jobId: 3 }],
    ["PAYMENT_REFUNDED", { paymentId: 4 }],
  ]
  for (const [type, payload] of samples) {
    const href = N.notificationHref(type, payload)
    const resolved = new URL(href, "https://app.jinva.example")
    check(`T-4 ${type} href prefix`, href.startsWith("/dashboard/user/"), true)
    check(`T-4 ${type} href origin`, resolved.origin, "https://app.jinva.example")
  }
}

// ── H5: customer destinations are unchanged with the explicit role ─────────
{
  const CUSTOMER_CASES = [
    ["JOB_STARTED", { jobId: 812 }, { label: "View job", href: "/dashboard/user/jobs/812" }],
    ["JOB_EXPIRED", { jobId: 9 }, { label: "View job", href: "/dashboard/user/jobs/9" }],
    ["BOOKING_CONFIRMED", { bookingId: 301 }, { label: "View booking", href: "/dashboard/user/bookings/301" }],
    ["MESSAGE_RECEIVED", { conversationId: 44 }, { label: "Open conversation", href: "/dashboard/user/messages?conversation=44" }],
    ["PAYMENT_RECEIPT", { jobId: 812 }, { label: "View payment", href: "/dashboard/user/jobs/812" }],
    ["PAYMENT_REFUNDED", { paymentId: 4471 }, { label: "View payment", href: "/dashboard/user/report" }],
    ["DISPUTE_RESOLVED", { disputeId: 5, bookingId: 77 }, { label: "View booking", href: "/dashboard/user/bookings/77" }],
    ["REVIEW_RECEIVED", { jobId: 3, rating: 5 }, { label: "View job", href: "/dashboard/user/jobs/3" }],
    ["SECURITY_ALERT", {}, null],
  ]
  for (const [type, payload, expected] of CUSTOMER_CASES) {
    check(`H5 customer default ${type}`, N.notificationAction(type, payload), expected)
    check(`H5 customer explicit ${type}`, N.notificationAction(type, payload, "user"), expected)
  }
}

// ── H5: artisan destinations ───────────────────────────────────────────────
{
  const A = (type, payload) => N.notificationAction(type, payload, "artisan")
  check("H5 artisan booking request → calendar", A("BOOKING_RECEIVED", { bookingId: 301 }), {
    label: "View booking",
    href: "/dashboard/artisan/calendar?booking=301",
  })
  check("H5 artisan booking reminder → calendar", A("BOOKING_REMINDER", { bookingId: 7, milestone: "24h" })?.href, "/dashboard/artisan/calendar?booking=7")
  check("H5 artisan job → job page", A("JOB_APPLICATION_ACCEPTED", { jobId: 812 }), {
    label: "View job",
    href: "/dashboard/artisan/jobs/812",
  })
  check("H5 artisan expired job → job page", A("JOB_EXPIRED", { jobId: 9 })?.href, "/dashboard/artisan/jobs/9")
  check("H5 artisan payment secured → earnings", A("PAYMENT_SECURED", { jobId: 812 }), {
    label: "View earnings",
    href: "/dashboard/artisan/earnings",
  })
  check("H5 artisan payout released → earnings", A("PAYOUT_RELEASED", { jobId: 812 })?.href, "/dashboard/artisan/earnings")
  check("H5 artisan refund → earnings", A("PAYMENT_REFUNDED", { jobId: 812 })?.href, "/dashboard/artisan/earnings")
  check("H5 artisan review → reviews", A("REVIEW_RECEIVED", { jobId: 812, rating: 4 }), {
    label: "View reviews",
    href: "/dashboard/artisan/reviews",
  })
  check("H5 artisan dispute filed → dispute page", A("DISPUTE_FILED", { disputeId: 15, bookingId: 77 }), {
    label: "View dispute",
    href: "/dashboard/artisan/disputes/15",
  })
  check("H5 artisan dispute resolved → dispute page", A("DISPUTE_RESOLVED", { disputeId: 15, bookingId: 77 })?.href, "/dashboard/artisan/disputes/15")
  check("H5 artisan dispute without disputeId → booking", A("DISPUTE_CLOSED", { bookingId: 77 })?.href, "/dashboard/artisan/calendar?booking=77")
  check("H5 artisan message → conversation", A("MESSAGE_RECEIVED", { conversationId: 44 }), {
    label: "Open conversation",
    href: "/dashboard/artisan/messages?conversation=44",
  })
  check("H5 artisan portfolio → portfolio", A("PORTFOLIO_REJECTED", { portfolioItemId: 3 })?.href, "/dashboard/artisan/portfolio")
  check("H5 artisan verified → verification", A("ARTISAN_PROFILE_VERIFIED", undefined)?.href, "/dashboard/artisan/verification")
  check("H5 artisan security alert → none", A("SECURITY_ALERT", {}), null)
  check("H5 artisan job without id → none", A("JOB_STARTED", {}), null)
  check("H5 artisan url ignored", A("JOB_STARTED", { jobId: 5, url: "https://evil.example.com" })?.href, "/dashboard/artisan/jobs/5")
  for (const value of HOSTILE_IDS) {
    for (const key of ["jobId", "bookingId", "conversationId", "disputeId"]) {
      for (const type of ["JOB_STARTED", "BOOKING_RECEIVED", "MESSAGE_RECEIVED", "DISPUTE_FILED"]) {
        check(`H5 artisan hostile ${type} ${key}=${String(value)}`, N.notificationHref(type, { [key]: value }, "artisan"), null)
      }
    }
  }
  // Payment, review, portfolio and verification go to fixed pages whatever the payload says.
  for (const [type, payload] of [
    ["JOB_STARTED", { jobId: 1 }],
    ["BOOKING_RECEIVED", { bookingId: 2 }],
    ["MESSAGE_RECEIVED", { conversationId: 3 }],
    ["DISPUTE_FILED", { disputeId: 4 }],
    ["PAYOUT_RELEASED", { jobId: "javascript:alert(1)" }],
    ["REVIEW_RECEIVED", { url: "//evil.example.com" }],
  ]) {
    const href = N.notificationHref(type, payload, "artisan")
    check(`H5 artisan ${type} href prefix`, href.startsWith("/dashboard/artisan/"), true)
    check(`H5 artisan ${type} href origin`, new URL(href, "https://app.jinva.example").origin, "https://app.jinva.example")
  }
  check("H5 role for customer base", N.notificationRoleFor("/dashboard/user"), "user")
  check("H5 role for artisan base", N.notificationRoleFor("/dashboard/artisan"), "artisan")
  check("H5 no actions for admin", N.notificationRoleFor("/dashboard/admin"), null)
}

// ── H5: notification buckets come from the type, not a substring ───────────
check("H5 JOB_EXPIRED bucket", N.mapNotificationType("JOB_EXPIRED"), "assignment")
check("H5 JOB_APPLICATION_REJECTED bucket", N.mapNotificationType("JOB_APPLICATION_REJECTED"), "assignment")
check("H5 BOOKING_EXPIRED bucket", N.mapNotificationType("BOOKING_EXPIRED"), "booking")
check("H5 PAYOUT_RELEASED bucket", N.mapNotificationType("PAYOUT_RELEASED"), "payment")
check("H5 PAYMENT_TRANSFER_FAILED bucket", N.mapNotificationType("PAYMENT_TRANSFER_FAILED"), "payment")
check("H5 DISPUTE_FILED bucket", N.mapNotificationType("DISPUTE_FILED"), "dispute")
check("H5 PORTFOLIO_APPROVED bucket", N.mapNotificationType("PORTFOLIO_APPROVED"), "system")
check("H5 SECURITY_ALERT bucket", N.mapNotificationType("SECURITY_ALERT"), "system")
check("H5 unknown future type falls back", N.mapNotificationType("BOOKING_RESCHEDULED"), "booking")
check("H5 lower-case type", N.mapNotificationType("job_expired"), "assignment")
check("H5 prototype key is not a type", N.mapNotificationType("__PROTO__"), "system")

// ── FU-6.3: full date and time in Africa/Accra ─────────────────────────────
// [QA note] 03-test-plan FU-6.3 and the mockups say "Thu 30 Oct 2026", but
// 30 October 2026 is a Friday. The format is as specified; the weekday is real.
check("FU-6.3 full date", N.formatFullDateTime("2026-10-30T14:14:00Z"), "Fri 30 Oct 2026, 2:14 pm")
// NFR-7 / L-1: envelope rows and dispute dividers use en-GB day-month order.
check("NFR-7 envelope row date", M.formatMessageTime("2025-10-25T12:00:00Z"), "25 Oct")
check("NFR-7 dispute divider date", M.formatMessageDay("2025-10-25T12:00:00Z"), "25 Oct 2025")
check("FU-6.3 a Thursday", N.formatFullDateTime("2026-10-29T14:14:00Z"), "Thu 29 Oct 2026, 2:14 pm")
check("FU-6.3 morning", N.formatFullDateTime("2026-10-30T08:05:00.000Z"), "Fri 30 Oct 2026, 8:05 am")
check("FU-6.3 midnight", N.formatFullDateTime("2026-11-01T00:00:00.000Z"), "Sun 1 Nov 2026, 12:00 am")
check("FU-6.3 invalid", N.formatFullDateTime("not a date"), "")
check("FU-6.3 missing", N.formatFullDateTime(undefined), "")

// ── FR-6.11: message excerpts ──────────────────────────────────────────────
check("FR-6.11 cut message", N.isMessageExcerpt("MESSAGE_RECEIVED", "a".repeat(100) + "…"), true)
check("FR-6.11 short message", N.isMessageExcerpt("MESSAGE_RECEIVED", "Thanks"), false)
check("FR-6.11 other type", N.isMessageExcerpt("JOB_STARTED", "x…"), false)

// ── FU-6.4: unread strip ───────────────────────────────────────────────────
check("FU-6.4 n=0", M.unreadLine(0), null)
check("FU-6.4 n=1", M.unreadLine(1), null)
check("FU-6.4 n=2", M.unreadLine(2), "2 unread messages · Open conversation to read all")
check("FU-6.4 n=3", M.unreadLine(3), "3 unread messages · Open conversation to read all")

// ── FU-6.5: read on expand only with exactly one unread ────────────────────
check("FU-6.5 0", M.shouldMarkReadOnExpand(0), false)
check("FU-6.5 1", M.shouldMarkReadOnExpand(1), true)
check("FU-6.5 3", M.shouldMarkReadOnExpand(3), false)

// ── Envelope links (Q9 Reply, FR-6.18 deleted contact) ─────────────────────
check("Reply link", M.conversationHref("user", "/dashboard/user", 57, { reply: true }), "/dashboard/user/messages?artisan=57&reply=1")
check("Open link unchanged", M.conversationHref("user", "/dashboard/user", 57), "/dashboard/user/messages?artisan=57")
check("Artisan link has no reply flag", M.conversationHref("artisan", "/dashboard/artisan", 8, { reply: true }), "/dashboard/artisan/messages?client=8")
check("By conversation id", M.conversationIdHref("user", "/dashboard/user", 44), "/dashboard/user/messages?conversation=44")
check("By conversation id, artisan", M.conversationIdHref("artisan", "/dashboard/artisan", 44), "/dashboard/artisan/messages?conversation=44")
check("By conversation id, admin", M.conversationIdHref("admin", "/dashboard/admin", 44), "/dashboard/admin/messages")
check("By conversation id, hostile", M.conversationIdHref("user", "/dashboard/user", -4), null)
check("By conversation id, fraction", M.conversationIdHref("user", "/dashboard/user", 4.5), null)
check("Deleted contact (no id)", M.isDeletedContact({ profilePicture: null }), true)
check("Deleted contact (placeholder names)", M.isDeletedContact({ id: 9, firstname: "Deleted", lastname: "User", profilePicture: null }), true)
check("Live contact", M.isDeletedContact({ id: 9, firstname: "Kofi", lastname: "Asante", profilePicture: null }), false)
check("usableContactId string", M.usableContactId({ id: "9", profilePicture: null }), null)

if (failures.length) {
  console.error(`test:inbox — ${failures.length} failed, ${passed} passed\n`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`test:inbox — all ${passed} checks passed`)
