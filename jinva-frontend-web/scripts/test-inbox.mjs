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
const HOSTILE = [
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
  for (const value of HOSTILE) {
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
check("By conversation id, other role", M.conversationIdHref("artisan", "/dashboard/artisan", 44), "/dashboard/artisan/messages")
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
