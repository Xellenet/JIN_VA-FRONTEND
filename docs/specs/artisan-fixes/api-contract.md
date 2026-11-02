# Artisan fixes: backend API contract (B1–B7, X5)

Backend branch `feat/customer-experience-v2`. Frontend builds against this file; it is kept in
sync with the code. All routes are under `/api/v1`.

## Conventions (same as the customer v2 work)

- **Envelope**: every JSON response is `{ status: "success", message, data, meta: { timestamp,
  path, statusCode, pagination? } }`. The shapes below are the `data` part. Paginated lists put
  `{ page, limit, total, totalPages }` in `meta.pagination`.
- **Owner**: always the JWT subject. No route takes a user, artisan or profile id. Unknown query
  parameters (including `userId`, `artisanId`, `artisanProfileId`) are rejected with **400**
  (global `forbidNonWhitelisted`). Someone else's record is **404**, never 403.
- **Auth errors**: 401 no/invalid JWT; 403 wrong role (`Roles(ARTISAN)` everywhere below).
- **Money**: strings with exactly two decimals, GHS (`"1840.00"`). `currency: "GHS"` where shown.
- **Dates**: instants are ISO 8601 UTC strings (`"2026-10-31T09:15:00.000Z"`); calendar dates are
  `"YYYY-MM-DD"`; times are `"HH:mm"`. Accra is UTC+0 with no DST, so a UTC day is an Accra day.
  Display formatting (en-GB, "25 Oct 2026") is the frontend's job.
- **Caching**: every `/me`-style and earnings response carries `Cache-Control: private, no-store`.
- **Rate limits** (per user and per route, in-memory per process). A 429 body has
  `meta.error` = the code below and `meta.retryAfterSeconds`; a `Retry-After` header is set;
  `message` is `"Too many requests, please wait a moment."`.

| Throttler name     | Limit          | `meta.error` on 429                     |
| ------------------ | -------------- | --------------------------------------- |
| `artisan-insights` | 30 per 60 s    | `ARTISAN_INSIGHTS_RATE_LIMIT_EXCEEDED`  |
| `artisan-export`   | 5 per 10 min   | `ARTISAN_EXPORT_RATE_LIMIT_EXCEEDED`    |

Env overrides: `ARTISAN_INSIGHTS_RATE_LIMIT_PER_MINUTE`, `ARTISAN_EXPORT_RATE_LIMIT_PER_10_MINUTES`.

---

## B1 `GET /artisans/me/overview`

Guards `JwtAuthGuard, RolesGuard, ArtisanInsightsThrottlerGuard` · role ARTISAN · limit
`artisan-insights` · no query parameters (any → 400) · `Cache-Control: private, no-store`.
404 `Artisan profile not found.` when the user has no artisan profile. Not cached server-side
(Accept/Decline must show on the next fetch).

Each section is built independently; a section whose query fails is `null` and its name is
listed in `failedSections` (the rest still render). Section names: `stageCounts`,
`pendingRequests`, `bookings`, `earnings`, `disputes`.

```jsonc
{
  "stageCounts": {            // jobs where I am the accepted artisan, deleted jobs excluded
    "toStart": 1,             // status PENDING
    "inProgress": 2,          // IN_PROGRESS and completion not yet requested
    "awaitingClient": 1,      // IN_PROGRESS and completionRequestedAt set
    "done": 14,               // COMPLETED
    "closed": 3,              // CANCELLED + EXPIRED
    "total": 21,
    "applied": 4              // my PENDING applications on jobs that are still OPEN
  },
  "pendingRequests": {        // bookings waiting for my Accept/Decline (status PENDING), oldest first
    "total": 3,               // all of them; `items` holds at most 10
    "items": [
      {
        "bookingId": 42,
        "clientName": "Ama Mensah",        // "Former client" if the account is gone
        "service": { "id": 3, "name": "Plumbing" },   // or null
        "scheduledDate": "2026-11-04",
        "startTime": "09:00",
        "endTime": "11:00",
        "location": null,                  // the linked job's location, else null (bookings have no address)
        "notes": "Kitchen sink leaking",   // client's note or null
        "createdAt": "2026-10-31T08:02:11.000Z",
        "respondBy": "2026-11-01T08:02:11.000Z"   // createdAt + 24 h, after which it expires
      }
    ]
  },
  "nextBooking": {            // earliest CONFIRMED booking whose end is still ahead, or null
    "bookingId": 40,
    "status": "CONFIRMED",
    "clientName": "Kofi Asante",
    "service": { "id": 3, "name": "Plumbing" },
    "scheduledDate": "2026-11-01",
    "startTime": "13:00",
    "endTime": "15:00",
    "location": "12 Ring Road, Accra",
    "notes": "Gate code 1234",
    "artisanNotes": null,
    "jobId": 77                            // the job created on confirmation, or null
  },
  "todayBookings": [ /* same shape as nextBooking: CONFIRMED bookings dated today (Accra), by start time, max 20 */ ],
  "earnings": {
    "currency": "GHS",
    "heldForSignOff": "450.00",  // HELD, transfer not started: client paid, waiting for sign-off
    "onTheWay": "300.00",        // HELD with a transfer started
    "needsAction": "120.00",     // PENDING_TRANSFER + TRANSFER_FAILED
    "needsActionCount": 1,
    "paidThisMonth": "1840.00",  // RELEASED, released this calendar month
    "hasPayoutMethod": true
  },
  "disputesNeedingResponse": 1,  // disputes filed against me, OPEN/UNDER_REVIEW, no response yet
  "failedSections": []
}
```

`nextBooking`/`todayBookings` are `null` together when the `bookings` section fails;
`disputesNeedingResponse` is `null` when `disputes` fails. All money is my payout amount
(`artisan_amount`, after the platform fee).

---

## B2 Earnings statement

Statement **stage** of each payment (derived; the raw `status` is also returned):

| `stage`            | Raw status                          | Artisan copy (suggested)              |
| ------------------ | ----------------------------------- | ------------------------------------- |
| `awaiting_payment` | PENDING                             | Client hasn't paid yet                |
| `held`             | HELD, no transfer started           | Paid by client, waiting for sign-off  |
| `on_the_way`       | HELD, transfer started              | On its way                            |
| `needs_action`     | PENDING_TRANSFER, TRANSFER_FAILED   | Needs your action                     |
| `paid`             | RELEASED                            | Paid                                  |
| `refunded`         | REFUNDED                            | Refunded to client                    |
| `not_paid`         | CANCELLED, FAILED                   | Not paid                              |

`failureReason` (code, not copy): `no_payout_method` (PENDING_TRANSFER), `transfer_failed`
(TRANSFER_FAILED; the provider's own text is not stored), otherwise `null`.

A payment is **dated** by `COALESCE(releasedAt, paidAt, createdAt)` ("earning date").
**Counted** stages for gross/fee/net totals and months: `held`, `on_the_way`, `needs_action`, `paid`.

### `GET /payments/my-earnings/statement`

Guards `JwtAuthGuard, RolesGuard, ArtisanInsightsThrottlerGuard` · ARTISAN · `artisan-insights`
· `Cache-Control: private, no-store`. 404 when there is no artisan profile.

Query (all optional):

| Param    | Type                                   | Default | Notes                                    |
| -------- | -------------------------------------- | ------- | ---------------------------------------- |
| `period` | `30d` \| `90d` \| `12m` \| `all`        | `12m`   | 30d/90d = last N days incl. today; 12m = from the 1st of the month 11 months ago |
| `stage`  | comma list of stages above (1–7)       | all     | filters `items` (and the CSV) only        |
| `page`   | int 1–1000                             | 1       |                                          |
| `limit`  | int 1–100                              | 20      |                                          |

400 on any other parameter or bad value.

```jsonc
{
  "currency": "GHS",
  "period": { "key": "12m", "from": "2025-11-01T00:00:00.000Z", "to": "2026-10-31T10:00:00.000Z" }, // from null for "all"
  "summary": {                 // over the period, counted stages only unless named otherwise
    "gross": "5200.00",        // what clients paid (amount)
    "fee": "520.00",           // platform fee
    "net": "4680.00",          // my payout amount (gross − fee)
    "jobs": 9,                 // counted payments
    "paid": "3900.00",         // stage paid
    "refunded": "300.00",      // net of payments refunded to the client (stage refunded) in the period
    "refundedCount": 1
  },
  "balances": {                // right now, not limited by period
    "heldForSignOff": "450.00",
    "onTheWay": "300.00",
    "needsAction": "120.00",
    "needsActionCount": 1,
    "paidThisMonth": "1840.00"
  },
  "months": [                  // counted stages, one row per calendar month in the period, oldest first, zero-filled
    { "month": "2026-10", "gross": "1200.00", "fee": "120.00", "net": "1080.00", "jobs": 2 }
  ],                           // for "all": from the month of my first counted payment (empty when none); 30d/90d: the months they touch
  "items": [
    {
      "paymentId": 311,
      "jobId": 77,
      "jobTitle": "Fix kitchen sink",      // or null
      "clientName": "Ama Mensah",          // "Former client" if gone
      "gross": "600.00",
      "fee": "60.00",
      "net": "540.00",
      "refunded": "0.00",                  // refunded to the client so far
      "payout": "540.00",                  // what I get / got; null for awaiting_payment, refunded, not_paid
      "status": "RELEASED",                // raw PaymentStatus
      "stage": "paid",
      "transferReference": "TRF-77-…",     // our transfer reference once a transfer was started, else null
      "failureReason": null,
      "paidAt": "2026-10-20T10:00:00.000Z",     // client paid; null if not
      "releasedAt": "2026-10-22T09:00:00.000Z", // payout confirmed; null if not
      "createdAt": "2026-10-19T16:30:00.000Z",
      "date": "2026-10-22T09:00:00.000Z"        // earning date (sort key)
    }
  ]
}
```

`meta.pagination` = `{ page, limit, total, totalPages }` for `items` (after the `stage` filter).
Items are newest earning date first, then id. Never returned: Paystack transfer codes,
recipient codes, access codes, fraud flags, the client's email/phone.

The old `GET /payments/my-earnings` is unchanged.

### `GET /payments/my-earnings/export.csv`

Guards `JwtAuthGuard, RolesGuard, ArtisanExportThrottlerGuard` · ARTISAN · `artisan-export`
(5 per 10 min) · query `period`, `stage` (same as above; no `page`/`limit`).

- 200 `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="jinva-earnings-YYYY-MM-DD.csv"`,
  `Cache-Control: no-store`, UTF-8 BOM, CRLF lines. Text cells are formula-safe (leading
  `= + - @ tab CR` get a `'`), RFC 4180 quoting.
- Columns: `Date,Job,Client,Status,Paid by client (GHS),Platform fee (GHS),Your payout (GHS),Refunded to client (GHS),Transfer reference,Client paid,Paid out`
  (dates `YYYY-MM-DD HH:mm` UTC; payout empty when `payout` is null). The Status column uses
  the copy in the stage table above ("Client has not paid yet", "Paid by client, waiting for
  sign-off", "On its way", "Needs your action", "Paid", "Refunded to client", "Not paid").
- 404 when there is no artisan profile; 400 on unknown/bad params.
- 400 `meta.error: "EXPORT_TOO_MANY_ROWS"` (more than 10,000 rows; message
  `"Narrow the period, then download again."`) before anything is streamed.
- A successful export is recorded in the account security log (`spending_report.exported`,
  `details.report = "artisan_earnings"`, row count and filter flags only).

### Masked payout destination (profile)

Every artisan **self-view** of the profile now includes it: `GET /users/me/artisan-profile`,
`PATCH /users/me/artisan-profile`, `PATCH /artisans/me`, `POST /artisans/me/services/:serviceId`
and `DELETE /artisans/me/services/:serviceId` (never the public `GET /artisans/:id`):

```jsonc
"payoutDestination": {           // null when no payout method is set
  "type": "mobile_money",        // or "bank"
  "label": "MTN MoMo",           // MTN → "MTN MoMo", VOD → "Telecel Cash", ATL → "AirtelTigo Money";
                                 // bank → the bank's name from the cached Paystack list, else "Bank account"
  "last4": "1234",
  "accountName": "Yaw Osei"
}
```

The full account number is never returned (the existing `payoutAccountNumber` stays masked
`"••••••1234"`; existing `payoutType`, `payoutAccountName`, `payoutBankCode` unchanged).

---

## B3 `GET /analytics/artisan` (existing, extended)

Guards now `JwtAuthGuard, RolesGuard, ArtisanInsightsThrottlerGuard` · ARTISAN ·
`artisan-insights` · `Cache-Control: private, no-store`.

Query `range`: `7d | 30d | 90d | 12m | all` (default `30d`). **`12m` is new** (monthly buckets,
from the 1st of the month 11 months ago, same as the Spending page). `1y` stays rejected (400).

Response (unchanged fields keep their existing **number** types — this endpoint predates the
string-money convention and has tests pinned to numbers):

```jsonc
{
  "range": "12m", "bucket": "month", "from": "2025-11-01T00:00:00.000Z", "to": "…", "generatedAt": "…",
  "earnings": { "allTime": 4200, "thisMonth": 1840, "lastMonth": 600, "inRange": 3900,
                "payoutsInRange": 7, "pending": 870, "pendingPayments": 3, "currency": "GHS" },
  "jobCounts": { "completed": 7, "cancelled": 1, "inProgress": 2, "pending": 1, "total": 11 },
  "repeatClients": { "totalClients": 6, "repeatClients": 2, "rate": 33.3, "definition": "…" },
  "ratingTrend": { "points": [ { "bucket": "2026-10-01T00:00:00.000Z", "averageRating": 4.5, "reviewCount": 2 } ],
                   "hasEnoughDataForTrend": true, "reviewsInRange": 5 },
  "topServices": [ { "serviceId": 3, "serviceName": "Plumbing", "bookings": 5, "completedBookings": 4, "share": 62.5 } ],
  "overview": { "completedJobsAllTime": 14, "inProgressJobs": 2, "averageRating": 4.6, "totalReviews": 12, "isVerified": true },
  "series": {
    "earnings": [ { "bucket": "2026-10-01T00:00:00.000Z", "earnings": 1080, "payouts": 2 } ],  // sparse (as before)
    "earningsFilled": [ { "bucketStart": "2026-10-01", "net": "1080.00", "payouts": 2 } ]       // NEW: every bucket, zero-filled, money as strings
  }
}
```

`series.earningsFilled` covers every day (7d/30d), ISO week starting Monday (90d) or month
(12m/all) in the range, oldest first, so the chart and its table never skip empty periods; for
`all` it starts at the month of the first payout (empty when there is none).
"Earnings" = my payout on RELEASED payments, dated by `releasedAt`.

---

## B4 `hasApplied` on jobs

`GET /jobs` (list) and `GET /jobs/:id` (detail): when the caller is an **ARTISAN**, every job
object carries `"hasApplied": boolean` — true when I have an application on that job (any
application status). For customers and admins the field is absent. No new route, no new guard.

---

## B5 Party disputes

`GET /disputes/my` and `GET /disputes/my/:id` (existing guards: JWT + roles CUSTOMER/ARTISAN)
and the `POST /disputes/:id/respond` response now include on every dispute:

```jsonc
"jobId": 77,           // the job linked to the dispute's booking, or null when no job exists
"responseDue": true    // I am the other party, no response yet, and the dispute is OPEN or UNDER_REVIEW (same as canRespond)
```

`GET /disputes/my` also accepts optional `?responseDue=true` to return only those disputes
(any other value of `responseDue` → 400; other params still 400). List stays newest first,
unpaginated. Others' disputes stay 404.

---

## B6 `GET /payments/banks`

Guards `JwtAuthGuard, RolesGuard, ArtisanInsightsThrottlerGuard` · ARTISAN · `artisan-insights`
· no query parameters · `Cache-Control: private, max-age=3600`.

```jsonc
[ { "code": "280100", "name": "Access Bank" }, { "code": "GH010100", "name": "Absa Bank Ghana" } ]
```

Ghana banks from Paystack (`/bank?country=ghana`), bank transfers (type `ghipss`) only, active,
sorted by name, de-duplicated by code. Mobile money networks are not in this list (they stay
`MTN` / `VOD` (Telecel Cash) / `ATL`). Cached server-side for 24 h; on a Paystack failure the
last good list is served; with no list at all → **502** `"The bank list is unavailable right
now. Please try again shortly."`. Send `code` as `bankCode` to `POST /payments/payout-method`.

---

## B7 `GET /reviews/me/summary`

Guards `JwtAuthGuard, RolesGuard, ArtisanInsightsThrottlerGuard` · ARTISAN · `artisan-insights`
· no query parameters · `Cache-Control: private, no-store`. 404 when no artisan profile.

Counts every ACTIVE review of my profile (the same set my reviews list shows; flagged and
removed reviews excluded).

```jsonc
{
  "total": 12,
  "average": "4.58",            // 2-decimal string; "0.00" when total is 0
  "byStar": { "1": 0, "2": 1, "3": 1, "4": 4, "5": 6 },   // star = floor(rating), so 4.5 counts as 4
  "fourPlus": 10,               // rating ≥ 4
  "fourPlusShare": 0.833,       // fourPlus / total, 3 decimals; 0 when total is 0
  "awaitingReply": 2            // no reply yet AND the review has text (rating-only reviews never count)
}
```

---

## X5 Booking date wording

Cause: the seeded notifications hard-coded "Monday 7 July 2026" (and "Thursday 10 July 2026")
for bookings dated 2026-07-07 (a Tuesday) and 2026-07-10 (a Friday). Fixed in the seed, which
now builds the text from the booking date with a UTC-safe formatter. Live booking
notifications (in-app, push, email) now also say the date the same way, e.g.
`"Ama Mensah has requested a booking on Tuesday 7 July 2026."` instead of the raw
`2026-07-07`. The formatter parses the date-only string as a UTC calendar day, so the weekday
can never drift with the server time zone. Existing rows in a developer database keep their
old text until it is re-seeded.
