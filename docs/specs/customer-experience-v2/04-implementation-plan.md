# Customer Experience v2: Implementation plan

| | |
|---|---|
| **Document** | 04-implementation-plan (tech lead) |
| **Status** | Final for build. Specs 01–03 and the design are approved. |
| **Date** | 30 October 2026 |
| **Backend** | Worktree `JIN_VA-BACKEND-cx2`, branch `feat/customer-experience-v2` (NestJS 11, TypeORM, Postgres). `node_modules` is a symlink, so do not run `npm install`. |
| **Frontend** | `JIN_VA-FRONTEND/jinva-frontend-web`, branch `feat/customer-dashboard-redesign`. It has uncommitted earlier work in `src/app/dashboard/user/page.tsx`, `src/components/dashboard/job-track.tsx`, `globals.css` and the legal pages. Build on that work and never revert it. |
| **Data** | Every person, id, amount and reference in this document is fictional. |

This plan is the build contract. Where it differs from 01/02/03, **this document wins**, and each such place is marked **[Δ]** with the reason. QA reads this plan together with 03 and updates the cases marked [Δ].

---

## 0. Decisions the build relies on

### 0.1 Product owner answers (Q1–Q12, the recommended defaults)

| Q | Decision | Effect on the build |
|---|---|---|
| Q1 | Single-select stages | The button reads **"Clear filter"**. The Spending history uses "Clear all filters", because it can hold several filters. |
| Q2 | `PENDING` counts as In progress | `in_progress` = `PENDING` + `IN_PROGRESS` |
| Q3 | The §4.2 spend definition is approved | §1.3 "Spend rules" below |
| Q4 | Keep `/dashboard/user/report` and call it **"Spending"** | No new route |
| Q5 | Rail = Needs your action, Next appointment, Spending snapshot | §1 B6 |
| Q6 | **No** mobile money number | No number column, no step-up, no masking or encryption work. FR-5.5, SEC-12 and SEC-13 are out of scope. A `momoNumber` field returns 400 (PR-1). |
| Q7 | No separate receipt email | Receipts show the account email, read-only |
| Q8 | No saved cards | Nothing in the UI or API suggests that cards are saved |
| Q9 | No quick reply | "Reply" opens the conversation with the reply box focused |
| Q10 | CSV export: yes | B10 is built |
| Q11 | The "history has moved" banner shows for 60 days or until dismissed | `NEXT_PUBLIC_SPENDING_RELEASED_AT` (ISO date). The banner is hidden after that date + 60 days, or once dismissed. If the variable is unset, it shows until dismissed. |
| Q12 | Remove the unsaved Booking Preferences switches | Remove the whole "Booking Preferences" card on the Profile tab, including "Save Payment Method" |

### 0.2 The owner's copy rules (apply everywhere: UI, emails, CSV, API field names)

1. **Never use the word "escrow".** Say "Held" or "Held until you confirm the job is done". **[Δ]** Because of this rule, the API fields `inEscrow` in B2 and B6 are renamed to **`held`**. BU-4.1, BU-4.2, BU-2.5, E-4.19 and BR-4.3 read `held`.
2. **Never promise when a refund will arrive** ("within 5 working days" or similar), in any copy or notification.

Copy overrides for the approved design specs (all other copy stays as in the area specs):

| Where | Spec text | Build text |
|---|---|---|
| Spending statement band, second cell label | "🔒 In escrow" | "🔒 Held" |
| Line under it (also in the rail and on the Settings panel) | "Held safely until you confirm the job is done" | "Held until you confirm the job is done" |
| Overview rail, Spending card | "In escrow · Held safely until…" | "Held · Held until you confirm the job is done" |
| Spending empty state, step 2 | "We hold it safely. Your money stays in escrow while the work is done." | "**It's held.** Your payment is held until you confirm the job is done." |
| Settings, Payment protection subtitle | "How JinVa keeps your money safe until the work is done." | "How your payment is handled until the job is done." |
| Settings panel line | "Your payment waits with JinVa until you confirm the job is done." | "Your payment is held until you confirm the job is done." |
| Settings path, step 2 | "**JinVa holds it**: The artisan can see the job is paid but can't withdraw the money yet." | "**Held**: Held until you confirm the job is done. The artisan can see that the job is paid." |
| Refund lines (all) | "the money goes back to how you paid" | Keep the text, with no time or date promise |

Payment status pills stay as they are in `status-badges.ts` (FR-4.11): "Withheld", "Paid Out" and so on. The one exception is on the Spending page, where `PENDING` shows as "Awaiting payment" (§4.2, FU-4.4). Q-S2's "Held safely" is **not** adopted.

### 0.3 Design open questions (decided by the tech lead, following each recommendation)

| # | Decision |
|---|---|
| Q-X1 | New controls use the focus ring `focus-visible:ring-primary dark:focus-visible:ring-ring`. The global `--ring` token is not changed, so `globals.css` is not edited. |
| Q-X2 / Spending D5 | Spending allows a 1440px content width at ≥1920px. The history card is capped at 1200px. |
| Q-X3 | The sparkline uses `--primary` |
| Q-X4 | The toast-only and text-only states are accepted as written |
| Q-O1 / D1 | The main column is `minmax(0,1fr)` inside a 1600px wrapper. Service and Posted columns appear from 1280px. |
| Q-O2 | Keep the chip × |
| Q-O3 / D8 | **Yes.** B6 returns `jobTitle` on single-item actions |
| Q-S1 / D1 | Override `--chart-1/3/4` in **light mode only** on the Spending page wrapper, with Tailwind arbitrary-property classes (`not-dark:[--chart-1:oklch(0.56_0.12_160)]` and so on). Config keys stay static (`c1`, `c3`, `c4`, `other`). `globals.css` is not edited. |
| Q-S3 / D4 | The history follows the selected period (`range` is sent to B3) |
| Q-S4 / D6 | B2 `byArtisan` returns **up to 50** rows. The frontend shows 5 and "Show all n artisans". |
| Q-P1 | The network field is always visible, as in the mockups |
| Q-P2 | Use monogram tiles until the owner gets permission for the real logos |
| Q-P4 | Popover 400px wide, 13px text |
| Q-P5 | Confirmed by §0.1 |
| NFR-6.4 | Product analytics events are **not** built in v2. The app has no custom-event sink (`@vercel/analytics` page views only). They are listed for later, so SEC-34 is met trivially. |
| §9 small fixes | "My Bookings" header title: **in scope** (fe-spending). The Settings page split: **partial**. Payments and the photo card become components (fe-settings-inbox). Plumbify FAQ wording: **out of scope** until the owner supplies the text. |

---

## 1. API contracts (final)

### 1.0 Conventions for every endpoint

- **Prefix:** `/api/v1`. Every success body is wrapped by `ResponseInterceptor`:
  `{ "status": "success", "message": string, "data": <payload>, "meta": { "timestamp", "path", "statusCode", "pagination"? } }`.
  Pagination appears as **`meta.pagination`** `{ page, limit, total, totalPages }`. The frontend reads it with `apiFetchWithMeta`. The JSON blocks below show `data` only, unless they say otherwise.
- **Errors**, from `AllExceptionsFilter`:
  `{ "status": "error", "message": string | string[], "meta": { "timestamp", "path", "statusCode", "error"?: CODE, "retryAfterSeconds"?: number } }`.
  - 400: validation, including unknown fields (`forbidNonWhitelisted`).
  - 401: no or invalid token.
  - 403: wrong role, or suspended on a write (existing `NotSuspendedGuard` message).
  - 404: missing **or** someone else's object. The body is identical in both cases.
  - 429: rate limit (below).
- **Money** is always a **string with exactly 2 decimals** (`"1840.00"`), computed in SQL as `ROUND(…, 2)::text` or with a shared `moneyString()` helper. Counts are numbers. Dates are ISO-8601 UTC strings. Calendar dates are `YYYY-MM-DD`. Month keys are `YYYY-MM`.
- **Timezone:** `Africa/Accra` (UTC+0, no DST). In SQL, write it explicitly: `(p.paid_at AT TIME ZONE 'Africa/Accra')`.
- **Owner:** taken only from `req.user.id`. Every query and sub-query filters `customer_id = :me` (or the participant or user equivalent) with bound parameters. No route accepts `customerId` or `userId`, so either one returns 400 (SEC-1, SEC-6).
- **Every `/me` response** sets the header `Cache-Control: private, no-store` (SEC-26), using `@Header('Cache-Control', 'private, no-store')`.
- **Explicit mapping.** No entity is returned directly. These keys must never appear (SEC-7): `platformFee`, `artisanAmount`, `transferCode`, `transferReference`, `paystackRecipientCode`, `accessCode`, `authorizationUrl`, any `authorization*`, any `fraudFlag*`/`fraudFlagged*`, `payoutAccountNumber`, `payoutAccountName`, artisan phone or email, `nationalId`, `password`. The other party in a transaction is `{ id: <artisanProfileId>|null, displayName, avatar }` only.
- **Rate limits.** The named throttlers are new in `THROTTLER_NAMES` (owned by be-settings). Each one is keyed by `user-{id}`, falling back to `ip-{ip}`. `generateKey` includes the handler, so **every route has its own bucket** under the shared configuration; QA asserts this in E-4.8. A 429 response:
  - sets the header `Retry-After: <seconds>` (unsuffixed; the guard sets it itself);
  - has the body `message: "Too many requests, please wait a moment."`, `meta.error: <CODE>` and `meta.retryAfterSeconds`;
  - is not readable cross-origin through its header, so the frontend uses `ApiError.retryAfterSeconds` from the body.

| Throttler name (`THROTTLER_NAMES.*`) | Default limit / window | Env override | Guard class (in `src/common/throttling/customer-throttler.guards.ts`) | 429 `meta.error` |
|---|---|---|---|---|
| `CUSTOMER_ANALYTICS` = `customer-analytics` | 30 / 60 s | `CUSTOMER_ANALYTICS_RATE_LIMIT_PER_MINUTE` | `CustomerAnalyticsThrottlerGuard` | `CUSTOMER_ANALYTICS_RATE_LIMIT_EXCEEDED` |
| `CUSTOMER_EXPORT` = `customer-export` | 5 / 600 s | `CUSTOMER_EXPORT_RATE_LIMIT_PER_10_MINUTES` | `CustomerExportThrottlerGuard` | `CUSTOMER_EXPORT_RATE_LIMIT_EXCEEDED` |
| `PAYMENT_SETTINGS_WRITE` = `payment-settings-write` | 5 / 60 s | `PAYMENT_SETTINGS_WRITE_RATE_LIMIT_PER_MINUTE` | `PaymentSettingsWriteThrottlerGuard` | `PAYMENT_SETTINGS_RATE_LIMIT_EXCEEDED` |
| `PROFILE_MEDIA_WRITE` = `profile-media-write` | 10 / 3600 s | `PROFILE_MEDIA_WRITE_RATE_LIMIT_PER_HOUR` | `ProfileMediaWriteThrottlerGuard` | `PROFILE_MEDIA_RATE_LIMIT_EXCEEDED` |
| `NOTIFICATION_READ` = `notification-read` | 60 / 60 s | `NOTIFICATION_READ_RATE_LIMIT_PER_MINUTE` | `NotificationReadThrottlerGuard` | `NOTIFICATION_READ_RATE_LIMIT_EXCEEDED` |

All five guards extend one abstract `UserKeyedThrottlerGuard extends NamedThrottlerGuard`, which supplies `getTracker` and `throwThrottlingException` (as `DisputeWriteThrottlerGuard` does) and adds the `Retry-After` header. A module that attaches a guard must `import ThrottlingModule` and list the guard class in its `providers`.

### 1.1 Endpoints at a glance

| # | Method + route | New/changed | Guards (in order) | Roles | Throttler | Owner |
|---|---|---|---|---|---|---|
| B7a | `GET /jobs/mine/summary` | new | `JwtAuthGuard` (class), `RolesGuard`, `CustomerAnalyticsThrottlerGuard` | CUSTOMER | customer-analytics | be-insights |
| B7b | `GET /jobs/mine` | changed (multi-status) | as today: `JwtAuthGuard`, `RolesGuard` | CUSTOMER | none (unchanged) | be-insights |
| B6 | `GET /customers/me/overview` | new | `JwtAuthGuard`, `RolesGuard`, `CustomerAnalyticsThrottlerGuard` | CUSTOMER | customer-analytics | be-insights |
| B2 | `GET /analytics/customer` | new | `JwtAuthGuard`, `RolesGuard`, `CustomerAnalyticsThrottlerGuard` | CUSTOMER | customer-analytics | be-insights |
| B3 | `GET /payments/history` | changed (paginated form) | `JwtAuthGuard`, `RolesGuard`, `PaymentHistoryThrottlerGuard` (skips the legacy no-param form) | CUSTOMER | customer-analytics | be-insights |
| B3f | `GET /payments/history/filters` | new | `JwtAuthGuard`, `RolesGuard`, `CustomerAnalyticsThrottlerGuard` | CUSTOMER | customer-analytics | be-insights |
| B10 | `GET /payments/history/export.csv` | new | `JwtAuthGuard`, `RolesGuard`, `CustomerExportThrottlerGuard` | CUSTOMER | customer-export | be-insights |
| B4 | index `payments(customer_id, paid_at)` | migration | — | — | — | be-insights |
| B5 | `GET /users/me/payment-settings` | new | `JwtAuthGuard`, `RolesGuard` | CUSTOMER | none | be-settings |
| B5 | `PATCH /users/me/payment-settings` | new | `JwtAuthGuard`, `RolesGuard`, `NotSuspendedGuard`, `PaymentSettingsWriteThrottlerGuard` | CUSTOMER | payment-settings-write | be-settings |
| B5c | `POST /payments/initialize` | changed (channel order) | unchanged | CUSTOMER | unchanged | be-settings |
| B1 | `DELETE /users/me/avatar` | new | `JwtAuthGuard`, `NotSuspendedGuard`, `ProfileMediaWriteThrottlerGuard` | any signed-in user | profile-media-write | be-settings |
| B1 | `POST /users/me/avatar`, `POST /uploads/avatar` | changed (throttle only) | existing + `ProfileMediaWriteThrottlerGuard` | unchanged | profile-media-write | be-settings |
| B1h | `PATCH /users/me` | changed (`profilePicture` removed from `UpdateMeDto`) | unchanged | unchanged | none | be-settings |
| B8 | `GET /notifications/:id` | new | `JwtAuthGuard` (class), `NotificationReadThrottlerGuard` | any | notification-read | be-settings |
| — | `GET /notifications?page&limit`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `GET /notifications/unread-count` | **reused unchanged** | existing | any | none | (be-settings regression) |
| — | `GET /messages?page&limit` | **reused unchanged**. No fields are added (SEC-9). | existing | any | none | (be-settings regression) |
| M1 | `PATCH /messages/:id/read` | changed (optional `upToMessageId`) | existing (`JwtAuthGuard`) | any participant | none | be-settings |

The other existing endpoints the frontend reuses unchanged are `GET /users/me` (avatar state), `GET /notifications/preferences` (the "Payment receipts" switch) and `GET /bookings/:id` / `GET /jobs/:id` (link targets only).

### 1.2 Contracts

#### B7a `GET /jobs/mine/summary`

- **Query:** none. Any query parameter returns 400.
- **200** `message: "Job summary retrieved"`:
```json
{
  "byStatus": { "OPEN": 3, "PENDING": 1, "IN_PROGRESS": 2, "COMPLETED": 27, "CANCELLED": 4, "EXPIRED": 1 },
  "byStage": { "open": 3, "in_progress": 3, "completed": 27, "closed": 5 },
  "total": 38
}
```
- **Types:** all values are `number` integers. Every `Status` key is always present (0 when missing).
- **Query rules:** one `SELECT status, COUNT(*) … WHERE customer_id = :me AND deleted_at IS NULL GROUP BY status`.
- **Stage mapping:**
  - `open` = OPEN
  - `in_progress` = PENDING + IN_PROGRESS
  - `completed` = COMPLETED
  - `closed` = CANCELLED + EXPIRED
- **Errors:** 401, 403 (ARTISAN or ADMIN), 400 (any query parameter), 429.

#### B7b `GET /jobs/mine?status=PENDING,IN_PROGRESS&page=1&limit=10`

- **Query DTO:** a new `GetMyJobsQueryDto`, used **only** by `findMine`. `GET /jobs` keeps `GetJobsQueryDto` unchanged.
  - `status?`: a comma list. It is split, trimmed and de-duplicated, then each value is checked with `@IsEnum(Status, { each: true })` and `@ArrayMinSize(1)` / `@ArrayMaxSize(6)`. An empty item (`status=,`), lower case or an unknown value gives 400.
  - `serviceId?`, `location?`: as today.
  - `page?`: integer ≥ 1 (default 1).
  - `limit?`: integer 1–50 (default 10).
- **SQL:** `job.status IN (:...statuses)` when the list has more than one value; `=` for one value; the clause is omitted when there is no status. The order is `job.createdAt DESC, job.id DESC` (the tie-break is added in `findMine` only).
- **200:** unchanged. `data` is `JobResponseDto[]`, `meta.pagination` is `{ page, limit, total, totalPages }`. With one status or no status the response is byte-for-byte as today (E-1.8).
- **Errors:** 400 (as above, and `limit` 51 or more, `page` 0), 401, 403.

#### B6 `GET /customers/me/overview`

- **Query:** none (400 if any). Header: `Cache-Control: private, no-store`.
- **Cache:** per-user, in process, TTL 30 s, key `customer-overview:{userId}`. It is optional and must never be keyed without the user id.
- **200** `message: "Overview retrieved"`:
```json
{
  "actionItems": {
    "completionsToConfirm": { "count": 1, "jobId": 812, "jobTitle": "Fix leaking kitchen sink" },
    "paymentsDue":          { "count": 1, "jobId": 815, "jobTitle": "Rewire consumer unit" },
    "applicationsToReview": { "count": 4, "jobId": null, "jobTitle": null },
    "unreadMessages": 2
  },
  "nextBooking": {
    "id": 301,
    "scheduledDate": "2026-11-04",
    "startTime": "09:00",
    "endTime": "11:00",
    "status": "CONFIRMED",
    "service": { "id": 3, "name": "Plumbing" },
    "artisan": { "id": 57, "displayName": "Kofi Asante", "avatar": "/uploads/avatars/57.webp" }
  },
  "spend": {
    "currency": "GHS",
    "hasPaymentsEver": true,
    "thisMonth": "1840.00",
    "lastMonth": "1420.00",
    "held": "650.00",
    "last6Months": [
      { "month": "2026-05", "netSpent": "900.00" },
      { "month": "2026-06", "netSpent": "0.00" },
      { "month": "2026-07", "netSpent": "1200.00" },
      { "month": "2026-08", "netSpent": "2150.00" },
      { "month": "2026-09", "netSpent": "1420.00" },
      { "month": "2026-10", "netSpent": "1840.00" }
    ]
  },
  "failedSections": []
}
```

Field types and rules:

- `actionItems`: `object | null`. It is `null` only when that section failed, and then `failedSections` contains `"actionItems"`.
  - `{count:number, jobId:number|null, jobTitle:string|null}`. `jobId`/`jobTitle` are set **only when the items involve exactly one distinct job**, and are otherwise `null`. **[Δ]** This is a clarification: 4 applications on one job do link to that job (BU-2.1 and BU-2.2 still hold).
  - **completionsToConfirm:** caller's jobs with `status = IN_PROGRESS AND completion_requested_at IS NOT NULL`. `count` = number of jobs.
  - **paymentsDue:** caller's payments with `status = PENDING` whose job is in `PENDING` or `IN_PROGRESS` and not deleted. `count` = number of payments, `jobId` = `payment.job_id`.
  - **applicationsToReview:** `job_applications.status = PENDING` on the caller's `OPEN` jobs. `count` = number of applications.
  - **unreadMessages:** `number` = conversations where the caller is a participant and there is at least one message with `sender_id <> :me AND is_read = false`. This is the same rule as `MessagesService` and the header envelope.
- `nextBooking`: `object | null`. It is `null` when there is no upcoming booking, **or** when the section failed (then `failedSections` contains `"nextBooking"`).
  - It is the earliest booking of the caller with `status IN ('PENDING','CONFIRMED')` and `(scheduled_date + end_time) > now()` (Accra). Order: `scheduled_date, start_time, id`.
  - `startTime`/`endTime`: `"HH:mm"` (seconds cut) or `null`.
  - `status`: `"PENDING" | "CONFIRMED"`.
  - `service`: `{id:number,name:string} | null`.
  - `artisan.id` is the **artisan profile id**, which is the link target `/dashboard/user/artisan/{id}`. `avatar`: `string | null`, the stored value; the frontend resolves it with `resolveAvatarUrl`.
  - A deleted artisan gives `{ id: null, displayName: "Former artisan", avatar: null }`.
- `spend`: `object | null` (null = failed).
  - `hasPaymentsEver`: `boolean`, true if any counted payment exists. It drives "Your spending will appear here after your first payment".
  - `thisMonth`/`lastMonth`: net spent in the current and previous calendar months.
  - `held`: net of **all** currently held payments (any date).
  - `last6Months`: always 6 entries, oldest first, current month last, zeros filled.
- `failedSections`: `Array<"actionItems"|"nextBooking"|"spend">`. Each section is built in its own try/catch. A failure is logged without personal data, and the response is still 200 (BU-2.9).
- **Errors:** 401, 403, 400 (any query parameter), 429. A 500 happens only if everything fails before mapping.

#### B2 `GET /analytics/customer?range=12m`

- **Query DTO:** `CustomerAnalyticsQueryDto`.
  - `range?`: `@IsIn(['30d','90d','12m','all'])`, default `'12m'`.
  - The enum is a **local** `CustomerSpendRange` in `src/customer-insights/customer-range.ts`. `AnalyticsRange` and the artisan/admin DTOs are **not** touched (R3).
- **Windows** (Accra, computed by `resolveCustomerWindow(range, now)`, a pure function with unit tests):

| range | from (inclusive) | to | bucket | buckets | previous window |
|---|---|---|---|---|---|
| `30d` | start of today − 29 days | now | day | 30 | the 30 days before `from` |
| `90d` | start of today − 89 days | now | week (ISO Monday) | every week overlapping the window, 13 or 14 | the 90 days before `from` |
| `12m` | 1st of the month, 11 months back | now | month | 12 (e.g. Nov 2025 – Oct 2026) | the 12 calendar months before `from` |
| `all` | `null` | now | month | from the first counted payment's month to the current month; `[]` if none | `null` |

- **200** `message: "Spending analytics retrieved"`:
```json
{
  "range": "12m",
  "bucket": "month",
  "currency": "GHS",
  "period": { "from": "2025-11-01T00:00:00.000Z", "to": "2026-10-30T12:00:00.000Z" },
  "hasPaymentsEver": true,
  "totals": {
    "netSpent": "14820.00",
    "grossPaid": "15420.00",
    "refunded": "600.00",
    "held": "650.00",
    "released": "13570.00",
    "paymentsCount": 19,
    "avgPayment": "780.00",
    "previousPeriodNetSpent": "9300.00"
  },
  "series": [
    { "bucketStart": "2025-11-01", "netSpent": "0.00", "count": 0 },
    { "bucketStart": "2025-12-01", "netSpent": "1200.00", "count": 2 }
  ],
  "byCategory": [
    { "serviceId": 3, "serviceName": "Plumbing", "netSpent": "5200.00", "count": 7, "share": 0.351 },
    { "serviceId": null, "serviceName": "Other", "netSpent": "800.00", "count": 2, "share": 0.054 }
  ],
  "byArtisan": [
    { "artisanProfileId": 57, "displayName": "Kofi Asante", "avatar": "/uploads/avatars/57.webp", "netSpent": "4100.00", "count": 5, "lastPaidAt": "2026-10-18T10:22:00.000Z" }
  ],
  "byChannel": [
    { "channel": "mobile_money", "netSpent": "9020.00", "count": 13, "share": 0.609 },
    { "channel": "card", "netSpent": "5800.00", "count": 6, "share": 0.391 }
  ],
  "largestPayment": { "id": 4471, "jobId": 790, "jobTitle": "Rewire 3-bedroom flat", "amount": "2400.00", "paidAt": "2026-08-12T14:05:00.000Z" }
}
```

- **Types:**
  - `period.from`: `string|null`.
  - `hasPaymentsEver`: `boolean`. It separates FR-4.16 (never paid) from FR-4.17 (nothing in this period).
  - `totals.*`: money strings, except `paymentsCount` (`number`). `previousPeriodNetSpent` is `null` for `all`.
  - `series[]`: `{bucketStart: "YYYY-MM-DD", netSpent: money, count: number}`. Every bucket is present, filled on the server, oldest first.
  - `byCategory[]`: the top 6 by `netSpent` desc, then **one** `{serviceId:null, serviceName:"Other"}` holding the rest, only if there is a rest. `share` is a `number` 0–1 with 3 decimals. The shares sum to 1 ± 0.001, or every share is 0 when net is 0.
  - `byArtisan[]`: **up to 50** rows, by `netSpent` desc and then `lastPaidAt` desc. `count` = distinct jobs.
    - A deleted or purged artisan gives `artisanProfileId: null, displayName: "Former artisan", avatar: null`. Each deleted artisan still gets its own row.
    - The artisan link target is `/dashboard/user/artisan/{artisanProfileId}`.
  - `byChannel[]`: `channel ∈ "mobile_money" | "card" | "bank" | "other"`. `bank_transfer` maps to `bank`. `null` or unknown values map to `other`. Sorted by netSpent desc.
  - `largestPayment`: `object|null`. It is the largest counted `amount` in the window, with ties broken by the most recent `paidAt`. `jobTitle` is `string|null`.
- **Cache:** in-process, key `customer-analytics:{userId}:{range}`, TTL **60 s**, at most 2,000 entries (oldest evicted first). Header `Cache-Control: private, no-store`.
- **Errors:** 400 (bad `range`, unknown fields), 401, 403, 429.

#### Spend rules (shared by B2, B6, B3 `netAmount`)

They are implemented once, in `src/customer-insights/spend.util.ts`, which B2 and B6 both import (BU-2.5, E-2.7, E-4.19).

- `COUNTED = HELD, PENDING_TRANSFER, TRANSFER_FAILED, RELEASED, REFUNDED`
- `HELD = HELD, PENDING_TRANSFER, TRANSFER_FAILED`
- `net = amount − COALESCE(refunded_amount, 0)`
- **Date of a payment:** `COALESCE(paid_at, created_at)` in Accra. A later refund reduces the bucket the payment was **paid** in (BU-4.4).
- **Totals:**
  - `grossPaid = Σ amount (COUNTED)`
  - `refunded = Σ refunded_amount (COUNTED)`
  - `netSpent = grossPaid − refunded`
  - `held = Σ net (HELD)`
  - `released = Σ net (RELEASED)`
  - `paymentsCount = count(COUNTED)`; fully refunded payments still count
  - `avgPayment = netSpent / paymentsCount`, or `"0.00"` when the count is 0
- `PENDING`, `FAILED` and `CANCELLED` are never in totals, but they **are** in the history.

#### B3 `GET /payments/history`

- **Legacy form (no query parameters at all):** the response is exactly today's unpaginated **array**, in today's order (`created_at DESC`), with today's message `"Payment history retrieved."`. Each row keeps today's keys (`id, reference, jobId, job{id,title}, amount, currency, status, refundedAmount, paidAt, releasedAt, date`) and **adds** `bookingId, service, artisan, netAmount, channel`. There is no `meta.pagination` and no throttle (`PaymentHistoryThrottlerGuard.shouldSkip` returns true when `Object.keys(req.query).length === 0`).
- **Paginated form:** used when **any** of these is present: `page, limit, status, range, from, to, serviceId, artisanProfileId, search`. DTO `PaymentHistoryQueryDto`:

| Param | Rule |
|---|---|
| `page` | int 1–1000, default 1 |
| `limit` | int 1–100, default 20 |
| `status` | comma list, split, trimmed and de-duplicated, each `IsEnum(PaymentStatus)`, 1–8 values |
| `range` | `30d|90d|12m|all`. It uses the same window as B2 (`resolveCustomerWindow`) |
| `from`, `to` | `YYYY-MM-DD` (`IsISO8601({strict:true})`), inclusive Accra days, `from ≤ to`, span ≤ 24 months. **Mutually exclusive with `range`** (both → 400). |
| `serviceId` | int ≥ 1. It narrows by `jobs.service_id` |
| `artisanProfileId` | int ≥ 1 |
| `search` | trimmed, 1–100 characters. It matches `job.title ILIKE :q ESCAPE '\'` OR `payment.reference ILIKE :q ESCAPE '\'`, where `q = '%' + escapeLike(search) + '%'` and `escapeLike` escapes `\`, `%` and `_`. |

  - There is **no** sort parameter (SEC-24).
  - Order: `COALESCE(p.paid_at, p.created_at) DESC, p.id DESC`.
  - A `serviceId` or `artisanProfileId` the caller has never paid simply gives an empty page with 200 (SEC-3).
  - The window filters on `COALESCE(paid_at, created_at)`.

- **200** `message: "Payment history retrieved"`. `data` is an array of the rows below, and `meta.pagination` is `{page, limit, total, totalPages}`. The row shape is the same in both forms:
```json
{
  "id": 4471,
  "reference": "JINVA-7F3K2Q",
  "jobId": 790,
  "job": { "id": 790, "title": "Rewire 3-bedroom flat" },
  "bookingId": null,
  "service": { "id": 5, "name": "Electrical" },
  "artisan": { "id": 57, "displayName": "Kofi Asante", "avatar": "/uploads/avatars/57.webp" },
  "amount": "2400.00",
  "refundedAmount": "0.00",
  "netAmount": "2400.00",
  "currency": "GHS",
  "channel": "card",
  "status": "RELEASED",
  "paidAt": "2026-08-12T14:05:00.000Z",
  "releasedAt": "2026-08-15T09:00:00.000Z",
  "date": "2026-08-12T14:03:10.000Z"
}
```

- **Types:**
  - `job.title`: `string|null`.
  - `bookingId`: `number|null`, from `jobs.booking_id`.
  - `service`: `{id:number|null, name:string}`, from the job's service. If it is missing: `{id:null, name:"Other"}`.
  - `artisan`: `{id:number|null, displayName:string, avatar:string|null}`. A deleted artisan gives `{id:null,"Former artisan",null}`.
  - `channel`: the raw stored value (`"card"|"mobile_money"|"bank"|…`) or `null`.
  - `status`: the `PaymentStatus` enum.
  - `paidAt`/`releasedAt`: `string|null`.
  - `date` = `created_at`.
  - The money fields are 2-decimal strings in both forms. **[Δ]** The legacy form used to pass the TypeORM decimal through, which is already a string. The job page and pay page use `Number()`, so they are unaffected.
- **Errors:** 400 (each rule above, plus unknown fields such as `customerId`), 401, 403, 429 (paginated form only).

#### B3f `GET /payments/history/filters` [Δ new]

FR-4.12 needs the dropdown options "only services and artisans the customer has paid", and no existing endpoint returns them.

- **Query:** none.
- **200** `message: "Payment history filters retrieved"`:
```json
{
  "services": [ { "id": 5, "name": "Electrical" }, { "id": 3, "name": "Plumbing" } ],
  "artisans": [ { "id": 57, "displayName": "Kofi Asante" } ]
}
```
- **Content:**
  - Distinct values over **all** of the caller's payments (any status, all time), sorted by name.
  - Deleted artisans (no id) are left out of `artisans`.
- **Errors:** 401, 403, 429.

#### B10 `GET /payments/history/export.csv`

- **Query DTO:** `PaymentHistoryExportQueryDto` = `PaymentHistoryQueryDto` **without** `page`/`limit` (same rules).
- **Limits:**
  - **Span cap:** the effective span is `[from ?? first matching payment date, to ?? now]`. If it is over 24 months, the response is **400** with `meta.error: "EXPORT_RANGE_TOO_LARGE"` and `message: "Narrow the date range to 24 months or less, then download again."`.
  - **Row cap:** if the count is over 10,000, the response is **400** with `meta.error: "EXPORT_TOO_MANY_ROWS"` and the same message.
- **200:** a streamed body written with `@Res()`, so it bypasses the JSON envelope. It is fetched in keyset batches of 500 rows.
  - **Headers:**
    - `Content-Type: text/csv; charset=utf-8`
    - `Content-Disposition: attachment; filename="jinva-payments-YYYY-MM-DD.csv"` (today, Accra; never names or emails)
    - `Cache-Control: no-store`
  - **Body:** a UTF-8 BOM, then the header row:
    `Date paid,Reference,Job,Service,Artisan,Method,Status,Amount (GHS),Refunded (GHS),Net (GHS),Paid to artisan`.
  - **Cells:**
    - Dates are `YYYY-MM-DD HH:mm` (Accra), empty when missing.
    - Method: Mobile money, Card, Bank, Other, or "Not paid yet".
    - Status uses the customer labels (`PENDING` → "Awaiting payment", held statuses → "Withheld", `RELEASED` → "Paid Out", and so on). Never "escrow".
    - Money is plain `2400.00`.
  - **Formula safety:** `csvCell(v)` prefixes `'` when the first character is `= + - @ \t \r`. It then applies RFC 4180 quoting: wrap in `"` and double inner `"` when the cell contains `,`, `"`, `\r` or `\n`. This applies to **every** text column: job, service, artisan, reference and status (SEC-27, T-7). Numbers are written unprefixed. Negative numbers never occur.
- **Audit:** after the stream ends, `AccountSecurityService.recordBestEffort` writes `spending_report.exported`:
  - `details = { range|null, statuses: string[], hasServiceFilter, hasArtisanFilter, hasSearch, hasDateRange, rowCount }`
  - Never the search text and never ids.
  - The IP and user agent come from the request.
- **Errors:** 400, 401, 403, 429.

#### B4 index

This is a migration (§2), and it has no API.

#### B5 `GET /users/me/payment-settings`

- **200** `message: "Payment settings retrieved"`. Header `Cache-Control: private, no-store`. A GET never creates a row.
```json
{
  "preferredChannel": "mobile_money",
  "momoNetwork": "MTN",
  "receiptEmail": "ama.owusu@example.com",
  "updatedAt": "2026-10-30T08:15:00.000Z",
  "editable": true
}
```
- **Types:**
  - `preferredChannel`: `"mobile_money" | "card" | null`.
  - `momoNetwork`: `"MTN" | "TELECEL" | "AT" | null`.
  - `receiptEmail`: the account email (string).
  - `updatedAt`: `string|null` (null when there is no row).
  - `editable`: `boolean`. It is `false` when `isSuspended`, and drives the FR-5.8 suspended state.
- **[Δ]** `momo: {network, numberMasked}` becomes the flat `momoNetwork`, because Q6 = No means there is no number.
- **Errors:** 401, 403 (ARTISAN or ADMIN).

#### B5 `PATCH /users/me/payment-settings`

- **Body DTO** `UpdatePaymentSettingsDto` (every field optional, nullable to clear):
```json
{ "preferredChannel": "card", "momoNetwork": "MTN" }
```
  - `preferredChannel`: `@IsOptional() @ValidateIf(v => v !== null) @IsIn(['mobile_money','card'])`.
  - `momoNetwork`: the same pattern with `['MTN','TELECEL','AT']`.
  - Any other key gives 400, including `momoNumber`, `currentPassword`, `userId` and `channels`.
  - Custom validation messages never use `$value` (SEC-31).
- **Behaviour:**
  - `{}` or no real change: 200 with the current settings, no write and no event.
  - A real change: upsert on `user_id`. In the **same transaction**, write an `account_security_events` row `payment_settings.updated` with `fields_changed = ['preferredChannel'|'momoNetwork', …]` (names only).
- **200** `message: "Payment preferences saved"`: the same shape as GET.
- **Errors:** 400, 401, 403 (role, or suspended with the existing `NotSuspendedGuard` message), 429 `PAYMENT_SETTINGS_RATE_LIMIT_EXCEEDED`.

#### B5c `POST /payments/initialize` (change)

- **Allowlist:** a server constant, `PAYSTACK_CHECKOUT_CHANNELS = ['card','mobile_money','bank','bank_transfer','ussd','qr','apple_pay']`, in `src/payment-settings/checkout-channels.ts`.
- **`orderCheckoutChannels(preferred)`:**
  - With `null` or an unknown value it returns **`undefined`**. Paystack then gets **no** `channels` key and behaves exactly as today (E-5.9 snapshot).
  - With `'mobile_money'` or `'card'` it returns the allowlist with that channel moved first.
- The preference is read through `dataSource.getRepository(CustomerPaymentSettings)` inside try/catch. Any error logs without personal data and proceeds with `undefined` (AC-5.6, BU-5.2).
- `PaystackService.initializeTransaction` takes an optional `channels?: string[]` and adds `channels` to the payload **only when it is defined**.
- Nothing is accepted from the client (SEC-14). The response is unchanged.
- **Known risk for QA (BR-5.11):** Paystack's docs describe `channels` as *which* channels are shown, and do not promise the display order. If test mode shows that order is ignored, the "shown first" helper copy must be revised before release. This is an owner decision; the code stays as specified.

#### B1 `DELETE /users/me/avatar`

- **Body/query:** none.
- **Behaviour:**
  - Load the caller's `profilePicture`. If it is null → 200, idempotent, and storage is not called (BU-3.3).
  - Otherwise set it to `null` and save.
  - Then, **best effort**, delete the stored file **only if** the value, after normalisation, resolves inside our `avatars` folder. That means a relative `/uploads/avatars/<file>`, or our storage public base followed by `avatars/<file>`, with no `..` or encoded separators and a basename matching `^[A-Za-z0-9._-]+$`.
  - Otherwise, for example a Google `lh3.googleusercontent.com` URL, nothing is deleted and a warning is logged **without the path**.
  - A storage error is logged and never surfaced.
  - Then write `profile_photo.removed` (best effort).
- **200** `message: "Profile photo removed"`, `data` = `UserResponseDto` (the same shape as `GET /users/me`) with `profilePicture: null`.
- **Errors:** 401, 403 (suspended), 429 `PROFILE_MEDIA_RATE_LIMIT_EXCEEDED`.

#### B1h `PATCH /users/me`

`profilePicture` is **removed** from `UpdateMeDto`, so sending it gives 400 through `forbidNonWhitelisted` (E-3.6). The only setter is `POST /users/me/avatar`, which the frontend already uses. `POST /uploads/avatar` (upload only, returns a URL) is kept, and both now carry `ProfileMediaWriteThrottlerGuard`.

#### B8 `GET /notifications/:id` (built; "Could" in 01)

- **Param:** `id` with `ParseIntPipe`. The route is declared **after** `unread-count`, `preferences` and `read-all`.
- **200** `message: "Notification retrieved"`, `data` = `NotificationResponseDto`:
```json
{ "id": 9021, "type": "DISPUTE_RESOLVED", "title": "Dispute resolved", "body": "Your dispute on 'Fix leaking kitchen tap' was resolved in your favour. A refund of GH₵ 150.00 has been sent to your original payment method.", "isRead": false, "payload": { "jobId": 812 }, "createdAt": "2026-10-30T14:14:00.000Z" }
```
- **Ownership:** `where: { id, user: { id: me } }`. Someone else's notification and a missing one return the same **404** "Notification not found." It is read only, so it does not mark the notification read.
- **Errors:** 400 (non-integer id), 401, 404, 429 `NOTIFICATION_READ_RATE_LIMIT_EXCEEDED`.

#### Reused unchanged (read in place)

- `GET /notifications?page=1&limit=5` → `NotificationResponseDto[]` with full `body`, `payload` and `createdAt`.
- `PATCH /notifications/:id/read` → 200 `{message}`. Someone else's id → 404.
- `PATCH /notifications/read-all`, `GET /notifications/unread-count` → `{count}`.
- `GET /messages?page=1&limit=50` → conversations with `lastMessage {id, content (full, ≤2,000), attachmentUrl, senderId, createdAt, isRead}` and `unreadCount`. **The popovers must never use `attachmentUrl`** (SEC-20).

#### M1 `PATCH /messages/:id/read?upToMessageId=123` [Δ additive]

- **Query DTO** `MarkConversationReadQueryDto`: `upToMessageId?`, an int ≥ 1.
- **Behaviour:**
  - When it is present, only messages in that conversation with `id <= :upTo AND sender_id <> :me AND is_read = false` are marked read.
  - When it is absent, the behaviour is exactly today's.
  - Participant checks are unchanged (403/404 as today).
- **Why:** FR-6.17 marks a conversation read on expand only when it has exactly one unread message. Without the upper bound, a message arriving between the poll and the PATCH would be marked read silently. The popover always sends `upToMessageId = lastMessage.id`.
- **200:** unchanged `{message}`.

---

## 2. Database, modules and registration

### 2.1 Migrations

Use exactly these timestamps. The latest existing migration is `1783260000000`. `migrationsRun: true`, so they run in the PGlite e2e setup. **Never run them against the developer database.**

| File | Class | Owner | Up | Down |
|---|---|---|---|---|
| `src/migrations/1783270000000-AddPaymentsCustomerPaidAtIndex.ts` | `AddPaymentsCustomerPaidAtIndex1783270000000` | be-insights | `CREATE INDEX IF NOT EXISTS "idx_payments_customer_id_paid_at" ON "payments" ("customer_id", "paid_at")` | `DROP INDEX IF EXISTS "idx_payments_customer_id_paid_at"` |
| `src/migrations/1783280000000-CreateAccountSecurityEvents.ts` | `CreateAccountSecurityEvents1783280000000` | be-settings | table below + `idx_account_security_events_user_created (user_id, created_at DESC)` + `idx_account_security_events_created (created_at)` | `DROP TABLE IF EXISTS "account_security_events"` |
| `src/migrations/1783290000000-CreateCustomerPaymentSettings.ts` | `CreateCustomerPaymentSettings1783290000000` | be-settings | table below | `DROP TABLE IF EXISTS "customer_payment_settings"` |

`account_security_events` (append-only; no update or delete API):

| Column | Type |
|---|---|
| `id` | `SERIAL PRIMARY KEY` |
| `user_id` | `INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `event` | `VARCHAR(60) NOT NULL` with `CHECK (event IN ('payment_settings.updated','spending_report.exported','profile_photo.removed'))` |
| `fields_changed` | `TEXT[] NOT NULL DEFAULT '{}'` |
| `details` | `JSONB NULL` (primitives and string arrays only; never values or PII) |
| `ip` | `VARCHAR(45) NULL` |
| `user_agent` | `VARCHAR(256) NULL` (truncated) |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |

`customer_payment_settings` (one row per customer, created on the first real save):

| Column | Type |
|---|---|
| `id` | `SERIAL PRIMARY KEY` |
| `user_id` | `INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE` |
| `preferred_channel` | `VARCHAR(20) NULL CHECK (preferred_channel IN ('mobile_money','card'))` |
| `momo_network` | `VARCHAR(10) NULL CHECK (momo_network IN ('MTN','TELECEL','AT'))` |
| `created_at`, `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |

There is **no** `momo_number` column (Q6 = No, PR-1).

### 2.2 New modules and how they register

`src/app.module.ts` is **not edited by anyone**. Each new module is reached through a module that `AppModule` already imports.

| Module (file) | Owner | Contents | Registered by |
|---|---|---|---|
| `AccountSecurityModule` (`src/account-security/account-security.module.ts`) | be-settings | `TypeOrmModule.forFeature([AccountSecurityEvent])`; provides and exports `AccountSecurityService`; a daily `@Cron` in the same service deletes rows older than 12 months | imported by `UsersModule`, `PaymentSettingsModule` and `PaymentsModule` |
| `PaymentSettingsModule` (`src/payment-settings/payment-settings.module.ts`) | be-settings | entity `CustomerPaymentSettings`, `PaymentSettingsController` (`@Controller('users')`, routes `me/payment-settings`), `PaymentSettingsService`, `checkout-channels.ts`, imports `ThrottlingModule` and `AccountSecurityModule`, provides `PaymentSettingsWriteThrottlerGuard` | imported by `UsersModule` (`users.module.ts`, be-settings) |
| `CustomerInsightsModule` (`src/customer-insights/customer-insights.module.ts`) | be-insights | `CustomerOverviewController` (`@Controller('customers')`, `me/overview`), `CustomerAnalyticsController` (`@Controller('analytics')`, `customer`), their services, `spend.util.ts`, `customer-range.ts`, cache; `forFeature([Payment, Job, JobApplication, Booking, Message, Conversation, User, ArtisanProfile, ServiceEntity])`; imports `ThrottlingModule`; provides `CustomerAnalyticsThrottlerGuard`; exports `SpendService` (spend helpers) | imported by `AnalyticsModule` (`analytics.module.ts`, be-insights: one line in `imports`) |
| `PaymentsModule` (existing) | be-insights | adds `CustomerPaymentHistoryService`, imports `ThrottlingModule` and `AccountSecurityModule`, provides `PaymentHistoryThrottlerGuard`, `CustomerAnalyticsThrottlerGuard`, `CustomerExportThrottlerGuard`, adds `ServiceEntity` to `forFeature` if needed | already in `AppModule` |
| `JobsModule` (existing) | be-insights | imports `ThrottlingModule`, provides `CustomerAnalyticsThrottlerGuard` | already |
| `UsersModule`, `UploadsModule`, `NotificationsModule` (existing) | be-settings | import `ThrottlingModule`; provide `ProfileMediaWriteThrottlerGuard` / `NotificationReadThrottlerGuard`; `UsersModule` imports `PaymentSettingsModule` and `AccountSecurityModule` and adds `CustomerPaymentSettings` and `AccountSecurityEvent` to `forFeature` for the purge | already |

**Interfaces be-settings delivers first (Phase 0), with these exact signatures:**

```ts
// src/account-security/account-security.service.ts
export type SecurityEventName = 'payment_settings.updated' | 'spending_report.exported' | 'profile_photo.removed';
export interface SecurityEventInput {
  userId: number;
  event: SecurityEventName;
  fieldsChanged?: string[];
  details?: Record<string, string | number | boolean | null | string[]>;
  ip?: string | null;
  userAgent?: string | null; // truncated to 256 inside
}
export class AccountSecurityService {
  record(input: SecurityEventInput, manager?: EntityManager): Promise<void>;   // throws; use inside the caller's transaction
  recordBestEffort(input: SecurityEventInput): Promise<void>;                  // never throws; logs without PII
  deleteForUser(manager: EntityManager, userId: number): Promise<void>;        // purge
}
export function securityContextFrom(req: Request): { ip: string | null; userAgent: string | null };

// src/common/throttling/customer-throttler.guards.ts
export abstract class UserKeyedThrottlerGuard extends NamedThrottlerGuard { /* tracker + 429 + Retry-After */ }
export class CustomerAnalyticsThrottlerGuard, CustomerExportThrottlerGuard, PaymentSettingsWriteThrottlerGuard,
             ProfileMediaWriteThrottlerGuard, NotificationReadThrottlerGuard;
export const CUSTOMER_RATE_LIMIT_ERROR_CODES: { CUSTOMER_ANALYTICS: 'CUSTOMER_ANALYTICS_RATE_LIMIT_EXCEEDED', … };
```

`PaymentHistoryThrottlerGuard` (be-insights, `src/payments/payment-history-throttler.guard.ts`) extends `CustomerAnalyticsThrottlerGuard` and overrides `shouldSkip(ctx)` to skip the legacy no-param form.

**Purge (SEC-37, be-settings):** `AccountPurgeService.deleteResidualPersonalData` deletes the user's `customer_payment_settings` row and all their `account_security_events` rows. v2 events never link to a dispute or fraud case, so there is no exception. The per-user analytics and overview caches expire within 60 s, which satisfies SEC-37 without an eviction hook.

**Logging hygiene (SEC-31, be-settings):**
- Add a winston format in `src/config/winston.config.ts`, backed by `src/common/utils/redact.util.ts`, that replaces the values of these keys at any depth with `"[redacted]"`: `password, currentPassword, code, otp, momoNumber, phoneNumber, email, accountNumber, payoutAccountNumber, payout_account_number, authorization, authorization_code, card, nationalId`.
- New code never logs request bodies, emails or URLs that carry ids or paths.

---

## 3. File ownership (no overlaps)

Each file has exactly **one** owner. A role may **read** any file, but must not edit a file it does not own. If a change is needed in someone else's file, ask that owner. The shared files are assigned explicitly below.

### 3.1 Backend (`JIN_VA-BACKEND-cx2`)

| Path | be-insights | be-settings |
|---|---|---|
| `src/customer-insights/**` (new: module, `customer-overview.controller.ts`/`.service.ts`, `customer-analytics.controller.ts`/`.service.ts`, `spend.util.ts`, `customer-range.ts`, `customer-cache.ts`, `dto/**`, all `*.spec.ts`) | ✔ | |
| `src/analytics/analytics.module.ts` (one import line only) | ✔ | |
| `src/jobs/jobs.controller.ts`, `src/jobs/jobs.service.ts`, `src/jobs/jobs.module.ts`, new `src/jobs/dto/get-my-jobs-query.dto.ts`, `src/jobs/jobs.*.spec.ts`, new `src/jobs/dto/get-my-jobs-query.dto.spec.ts` | ✔ | |
| `src/payments/payments.controller.ts`, `src/payments/payments.module.ts`, `src/payments/payments.controller.spec.ts` | ✔ | |
| new `src/payments/customer-payment-history.service.ts` (+spec), `src/payments/csv.util.ts` (+spec), `src/payments/like-escape.util.ts` (+spec), `src/payments/payment-history-throttler.guard.ts` (+spec), `src/payments/dto/payment-history-query.dto.ts` (+spec) | ✔ | |
| `src/migrations/1783270000000-AddPaymentsCustomerPaidAtIndex.ts` | ✔ | |
| new `test/support/forbidden-fields.ts` (SEC-8 walker, shared; be-settings imports it) | ✔ | |
| new `test/customer-jobs-summary.e2e-spec.ts`, `test/customer-overview.e2e-spec.ts`, `test/customer-spending.e2e-spec.ts`, `test/customer-export.e2e-spec.ts` | ✔ | |
| `src/common/throttling/throttler-names.ts`, `throttling.module.ts`, new `customer-throttler.guards.ts` (+spec) | | ✔ |
| `src/account-security/**` (new) | | ✔ |
| `src/payment-settings/**` (new: module, controller, service, entity, `dto/**`, `payment-settings.enums.ts`, `checkout-channels.ts`, specs) | | ✔ |
| `src/payments/payments.service.ts`, `src/payments/paystack.service.ts`, `src/payments/payments.service.spec.ts`, `payments.service.flows.spec.ts`, `paystack.service.spec.ts` | | ✔ |
| `src/users/users.controller.ts`, `users.service.ts`, `users.module.ts`, `account-purge.service.ts`, `dto/update-me.dto.ts`, and their specs (`users.*.spec.ts`, `account-purge.service.spec.ts`) | | ✔ |
| `src/uploads/uploads.controller.ts`, `uploads.service.ts`, `uploads.module.ts` (+ a new `avatar-path.util.ts` +spec) | | ✔ |
| `src/notifications/notifications.controller.ts`, `notifications.service.ts`, `notifications.module.ts`, specs | | ✔ |
| `src/messages/messages.controller.ts`, `messages.service.ts`, new `src/messages/dto/mark-conversation-read-query.dto.ts`, `messages.service.spec.ts` | | ✔ |
| `src/config/winston.config.ts`, new `src/common/utils/redact.util.ts` (+spec), `src/common/constants/success-messages.constants.ts` | | ✔ |
| `src/migrations/1783280000000-CreateAccountSecurityEvents.ts`, `1783290000000-CreateCustomerPaymentSettings.ts` | | ✔ |
| new `test/payment-settings.e2e-spec.ts`, `test/profile-photo.e2e-spec.ts`, `test/inbox-read-in-place.e2e-spec.ts`, `test/customer-throttlers.e2e-spec.ts`, `test/customer-purge.e2e-spec.ts` | | ✔ |
| `src/app.module.ts`, `src/common/types/enums.ts`, `src/analytics/analytics.util.ts`, `src/analytics/dto/analytics-query.dto.ts`, `test/helpers/test-data.ts`, existing e2e specs | **nobody edits** | **nobody edits** |

### 3.2 Frontend (`jinva-frontend-web`)

| Path | fe-overview | fe-spending | fe-settings-inbox |
|---|---|---|---|
| **new `src/lib/customer-api.ts`**: the shared API client and types for every endpoint in §1 (see §4) | **✔ owner** | import only | import only |
| `src/app/dashboard/user/page.tsx` (keeps the earlier uncommitted work) | ✔ | | |
| `src/components/dashboard/job-track.tsx` (untracked earlier work; `active` → `in_progress`) | ✔ | | |
| new `src/components/dashboard/overview/**` (`overview-filter-bar.tsx`, `overview-job-list.tsx`, `account-rail.tsx`, `rail-needs-action.tsx`, `rail-next-appointment.tsx`, `rail-spending.tsx`, `sparkline.tsx`) | ✔ | | |
| new `src/lib/overview.ts` (pure: `Stage`, `parseStage`, `STAGES`, `statusToStage`, `summarise`, filter-bar and live-region strings, `actionHref`, `formatAppointment`, `spendComparison`, `sparklineAlt`, `showMoreState`) | ✔ | | |
| `src/app/dashboard/user/jobs/page.tsx` (read `?stage=` through `parseStage` for "See all {stage} jobs in My Jobs" and the rail links) | ✔ | | |
| new `scripts/test-overview.mjs` | ✔ | | |
| `src/app/dashboard/user/report/page.tsx`, `report/loading.tsx` (replace the redirect) | | ✔ | |
| new `src/components/spending/**` (page shell, `period-selector`, `statement-band`, `spending-over-time-chart` (Recharts via `ChartContainer`, keys `c1`), `ranked-bars`, `who-you-paid`, `how-you-paid`, `chart-table-toggle`, `payment-history` (table and cards), `history-filters`, `history-filter-sheet`, `download-csv-button`, `spending-empty`, `load-error`) | | ✔ | |
| new `src/lib/spending.ts` (pure: `parseRange`, `parseHistoryFilters`/`serialiseHistoryFilters`, `formatMoneyCompact`, chart summaries, `spendingStatusLabel`, `methodLabel`, `csvFileName`, `changeLine`) | | ✔ | |
| `src/components/dashboard/sidebar.tsx` ("Spending" after "My Bookings", `Wallet` icon) | | ✔ | |
| `src/components/dashboard/header.tsx` (`PAGE_TITLES.report = "Spending"`, `bookings = "My Bookings"`; nothing else) | | ✔ | |
| new `scripts/test-spending.mjs` | | ✔ | |
| `src/app/dashboard/user/settings/page.tsx` (Payments tab replaced; Booking Preferences card removed; photo block extracted) | | | ✔ |
| new `src/components/settings/payments-tab.tsx`, `history-moved-banner.tsx`, `protection-path.tsx`, `profile-photo-card.tsx` | | | ✔ |
| `src/components/dashboard/notifications-popover.tsx`, `messages-popover.tsx`, new `src/components/dashboard/inbox/**` (`inbox-surface.tsx` popover ≥640 / drawer <640, `disclosure-item.tsx`) | | | ✔ |
| `src/lib/notifications.ts` (`mapNotification` keeps `payload` and `createdAt`; `notificationHref`; `formatFullDateTime`) | | | ✔ |
| `src/lib/messages.ts` (`unreadLine`, `shouldMarkReadOnExpand`; `conversationHref` gains an optional `reply`) | | | ✔ |
| `src/lib/types.ts` (only the `Notification` type: add `payload`, `createdAt`) | | | ✔ |
| `src/components/dashboard/notifications-page.tsx` (only if needed by the type change) | | | ✔ |
| `src/components/dashboard/messages-page.tsx`, `src/app/dashboard/user/messages/page.tsx` (`?reply=1` focuses the reply box; `?conversation=<id>` opens it) | | | ✔ |
| `src/contexts/auth-context.tsx` (only if needed to clear `profilePicture` after removal) | | | ✔ |
| `next.config.ts` (security headers), new `src/lib/csp.ts` (pure policy builder) | | | ✔ |
| `eslint.config.mjs` (`react/no-danger: error`, with a file override for `src/components/ui/chart.tsx`) | | | ✔ |
| `package.json` (**scripts only**: `test:overview`, `test:spending`, `test:inbox`, `test:csp`, added to `verify`; no dependencies) | | | ✔ |
| new `scripts/test-inbox.mjs`, `scripts/test-csp.mjs` | | | ✔ |
| `src/app/globals.css`, `src/lib/status-badges.ts`, `src/lib/api.ts`, `src/lib/utils.ts`, `src/components/ui/**` | **nobody edits** | **nobody edits** | **nobody edits** |

**Pure-module rule** (it makes the `FU-` scripts runnable with `node --experimental-strip-types`): `src/lib/overview.ts`, `spending.ts`, `csp.ts` and the helpers added to `notifications.ts`/`messages.ts` have **no runtime imports**, only `import type`. They never use the `@/` alias at runtime.

---

## 4. Shared frontend API client: `src/lib/customer-api.ts`

**Owner: fe-overview.** It is written **first** (Phase 0), complete for every endpoint in §1, so that fe-spending and fe-settings-inbox only import it. Changes go through fe-overview. A role that is blocked may declare a local type in its own file temporarily and switch to the shared one afterwards.

- **Transport:** it uses `apiFetch`/`apiFetchWithMeta`/`apiFetchBlob` from `@/lib/api`. Every call passes `cache: "no-store"` and an optional `signal` (FR-1.18 cancels stale requests).
- **Query strings:** they are built only with `URLSearchParams`, and only from parsed, typed values (SEC-19).
- **Exports:**
  - Types: `Money` (= `string`), `Stage`, `JobSummary`, `MyJobsPage`, `CustomerOverview`, `ActionItem`, `NextBooking`, `SpendSnapshot`, `SpendingRange`, `SpendingAnalytics`, `PaymentHistoryRow`, `PaymentHistoryFilters` (the query), `PaymentHistoryFilterOptions`, `PaymentSettings`, `PaymentSettingsPatch`, `Paginated<T>`.
  - Functions:
    - `getJobSummary(signal?)`
    - `getMyJobs({ statuses?, page, limit }, signal?) → { items, pagination }`
    - `getCustomerOverview(signal?)`
    - `getSpendingAnalytics(range, signal?)`
    - `getPaymentHistory(filters, signal?) → { items, pagination }` (always paginated: it sends `page` and `range`)
    - `getPaymentHistoryFilterOptions(signal?)`
    - `downloadPaymentHistoryCsv(filters) → Blob`
    - `getPaymentSettings()`, `updatePaymentSettings(patch)`
    - `removeProfilePhoto()`
    - `getNotification(id)`, `markNotificationRead(id)`
    - `markConversationRead(conversationId, upToMessageId?)`
    - `isRateLimited(err)`, `retryAfter(err)`
- **Not touched:** the existing legacy `/payments/history` call sites (job page, pay page). Settings stops calling it.
- **No module-level caching** of any response. Data lives in component state and is gone after sign-out or navigation (SEC-33). The only new browser storage is `localStorage["jinva:payments-history-moved-dismissed"] = "1"`, read and written inside try/catch.

### 4.1 Frontend security headers (fe-settings-inbox; SEC-32, read from the code)

`next.config.ts` `headers()`, built by `src/lib/csp.ts` → `buildCsp({ apiUrl, mediaOrigins, dev })`.

**What the app really loads**, from reading the code:

- **Fonts:** Geist through `geist/font`, self-hosted. No Google Fonts requests.
- **API:** `NEXT_PUBLIC_API_URL`. It may be relative (`/api/v1`) under the proxy.
- **Avatars and media:**
  - `resolveMediaUrl` gives either the API origin plus `/uploads/...`, or full S3/CDN URLs (`AWS_S3_PUBLIC_URL_BASE`).
  - Google sign-in stores `lh3.googleusercontent.com` avatar URLs.
  - Private media uses `blob:`.
- **Paystack:** the pay page does a **top-level redirect** (`window.location.href = authorizationUrl`). No Popup script and no iframe, so no Paystack host is needed in CSP.
- **Google sign-in:** a top-level redirect to the API's `/auth/google`. No CSP impact.
- **Firebase Cloud Messaging:** `firebase/messaging` calls `firebaseinstallations.googleapis.com`, `fcmregistrations.googleapis.com` and `fcm.googleapis.com`. The service worker `/firebase-messaging-sw.js` uses `importScripts` from `https://www.gstatic.com`.
- **Vercel Analytics:** same-origin `/_vercel/insights/*` in production; `https://va.vercel-scripts.com` in development.
- **Geolocation:** used on post-job.
- **Inline styles:** used by Tailwind/Radix and the chart `<style>`.

**Policy for every path except the service worker:**
```
default-src 'self';
script-src 'self' 'unsafe-inline'  [dev: 'unsafe-eval' https://va.vercel-scripts.com];
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: <API origin> https://lh3.googleusercontent.com <NEXT_PUBLIC_MEDIA_ORIGINS…>;
font-src 'self' data:;
connect-src 'self' <API origin> https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://fcm.googleapis.com [dev: ws: wss:];
worker-src 'self'; manifest-src 'self'; frame-src 'none'; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

- **Service worker** (`/firebase-messaging-sw.js`): its own policy, `default-src 'self'; script-src 'self' https://www.gstatic.com; connect-src 'self' https://*.googleapis.com`.
- **Header name:**
  - `Content-Security-Policy-Report-Only` by default.
  - `Content-Security-Policy` when `CSP_ENFORCE=1`. The release flips this after at least one week in Report-Only (SEC-32).
- **Always enforced on every path:**
  - `X-Frame-Options: DENY` (frame-ancestors has no effect in Report-Only)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()`
- **[Δ]** **No nonce/`strict-dynamic` in v2.** The task requires `next.config`, and `headers()` cannot mint a per-request nonce. A nonce would also force every page to render dynamically. `script-src` therefore carries `'unsafe-inline'`, and the user-text controls for items 5 and 6 are SEC-17 and SEC-18 (plain text only, typed links). The upgrade to middleware nonces is a tracked security follow-up, and security must sign off this deviation before `CSP_ENFORCE=1`.
- If Paystack Popup is ever adopted, add `https://js.paystack.co` (script) and `https://checkout.paystack.com` (frame and form-action).
- **Dev server note:** editing `next.config.ts` makes the running `next dev` on port 4200 restart itself. In the default Report-Only mode nothing is blocked.

---

## 5. Role briefs, tests and the definition of done

### 5.0 Order of work

- **Phase 0, first:**
  - be-settings: throttler names, module and guards; `AccountSecurityModule`.
  - be-insights: `test/support/forbidden-fields.ts`.
  - fe-overview: `src/lib/customer-api.ts`.
- **Phase 1:** everything else, in parallel against the contracts in §1. The frontend cannot run the backend (the developer DB is off limits), so it codes to these contracts exactly.

### 5.1 be-insights

**Builds:** B7a, B7b, B6, B2, B3, B3f, B10, B4 and the spend helper. Notes:

- B6 and B2 call the same `spend.util.ts` functions.
- Write SQL with `createQueryBuilder` and bound parameters only. No template strings inside `.where()`/`.query()`.
- Every aggregate (by service, artisan, channel, largest payment, unread, actions) is scoped to `:me` inside its own query.

**Tests it owns** (from 03, adjusted by [Δ]):

- **Backend unit:**
  - BU-1.1 to 1.7
  - BU-2.1 to 2.9
  - BU-4.1 to 4.16: `held` instead of `inEscrow`. BU-4.6 runs against `CustomerAnalyticsQueryDto` and asserts that the artisan/admin DTOs are unchanged. BU-4.8 includes the 50-row artisan cap.
  - Unit tests for `resolveCustomerWindow`, `escapeLike`, `csvCell` and `PaymentHistoryThrottlerGuard.shouldSkip`.
- **API e2e:**
  - E-1.1 to 1.10
  - E-2.1 to 2.7: E-2.6 for overview
  - E-4.1 to 4.24:
    - E-4.4: no `range` gives 200 with `12m`.
    - E-4.8: separate buckets per route.
    - E-4.18 covers the index migration up and down.
    - Plus B3f: own data only; another customer's ids never appear.
  - SEC-6/T-1 and T-2 for B7a, B7b, B6, B2, B3, B3f and B10, using `test/support/forbidden-fields.ts`.
  - T-6, the guard-attached check, for its own routes.
  - S-2 route inventory for its routes.
  - P-7 note: the index exists.
- **Coverage:** each new `*.service.ts` ≥ 60% and each new `*.controller.ts` ≥ 50% (unit + e2e, `jest.coverage.json`).

### 5.2 be-settings

**Builds:**

- the throttler registrations and guards
- `AccountSecurityModule` and its retention cron
- B5 GET/PATCH, the B5c channel order, B1 and B1h
- profile-media throttling on both upload routes
- B8, M1, purge coverage and the logger redaction

**Tests it owns:**

- **Backend unit:**
  - BU-3.1 to 3.4
  - BU-5.1 to 5.5. The [Q6] cases are not built; PR-1 asserts that `momoNumber` returns 400.
  - Unit tests for the avatar-path check (SEC-5 / T-10: `..`, encoded separators, foreign hosts, Google URLs), `orderCheckoutChannels`, the redaction util, each guard (N+1 → 429, `Retry-After`, `meta.error`), and the throttling module limits and windows.
- **API e2e:**
  - E-3.1 to 3.7
  - E-5.1 to 5.12, except [Q6]. E-5.11 covers the purge of both new tables.
  - E-6.1 to 6.6. E-6.6 is B8. Plus M1: `upToMessageId` marks only messages ≤ that id, and without it the behaviour is unchanged.
  - T-6 for every named throttler (in `customer-throttlers.e2e-spec.ts`, which overrides limits through config and never sleeps).
  - T-8 (except [Q6]), T-9, T-10.
  - O-1 log capture for its endpoints: no email, phone or `authorization` values.
  - The security event is written in the same transaction (rolled back with a failing save).
- **Regression it must keep green:** `job-payment-flow` (E-5.9 snapshot: no `channels` key without a preference), `settings-payloads`, `rate-limit-error-contract`, `auth-rate-limit`, `messaging-notifications`, `account-closeout.qa`, purge specs, `hermetic-guard`.
- **Coverage:** the same gate.

### 5.3 fe-overview

**Builds:**

- `customer-api.ts`
- Overview filters, using `parseStage` with `router.replace` and `URLSearchParams`; `aria-pressed`; and the live region with the exact strings in the Overview spec §7.
- The filter bar with its chip × and **Clear filter**; focus moves to `#job-list-title`.
- Lists:
  - unfiltered: `getMyJobs({page:1,limit:5})`
  - filtered: limit 10, "Show more", and after 50 rows the link "See all {stage} jobs in My Jobs" (`/dashboard/user/jobs?stage=…`)
  - stale requests aborted
- Counts and the header sentence from B7a.
- The right rail from B6: `AccountRail` with `layout="rail"` at ≥1280px and `"cards"` below it. Needs your action goes above the track and only when it has items; the other two go below the list. It refetches on focus at most every 30 s and after actions.
- An SVG sparkline with no Recharts.
- My Jobs reads `?stage=`.
- Rail links come from `actionHref` in `overview.ts`, built from typed ids only:

  | Item | One job (`jobId` set) | Several (`jobId` null) |
  |---|---|---|
  | Confirm completion | `/dashboard/user/jobs/{id}` | `/dashboard/user/jobs?stage=in_progress` |
  | Pay to start | `/dashboard/user/jobs/{id}/pay` | `/dashboard/user/jobs?stage=in_progress` |
  | Review applications | `/dashboard/user/jobs/{id}` | `/dashboard/user/jobs?stage=open` |
  | Unread messages | `/dashboard/user/messages` | `/dashboard/user/messages` |

  The appointment card links to `/dashboard/user/bookings/{id}`, and the artisan to `/dashboard/user/artisan/{artisan.id}` when the id is not null.
- Every state in the Overview spec §5, with the copy overrides in §0.2.

**Tests it owns:**

- FU-1.1 to 1.6 and FU-2.1 to 2.5 in `scripts/test-overview.mjs`. FU-2.5 also checks the `notificationHref`-style rules for `actionHref`: only positive safe integers and `/dashboard/user/` paths.
- It self-checks with `tsc`, `eslint` and `check:colors`, and hands BR-1.x / BR-2.x to QA.

### 5.4 fe-spending

**Builds:**

- `/dashboard/user/report` titled "Spending": the period selector (`?range=`), the statement band (FR-4.3 with the §0.2 copy), and the four chart cards with summaries and a Chart/Table toggle.
- Charts: only "Spending over time" uses `ChartContainer`, with key `c1`. The others are HTML bars, with no server text in config keys or colours (SEC-22).
- Payment history from B3 (paginated, `range` sent), with filters (status multi-select, service and artisan from B3f, search debounced 300 ms with `maxLength=100`), "Clear all filters", the result live region, table at ≥768px and cards below, pagination of 20, and the phone filter sheet.
- **Download CSV** through `downloadPaymentHistoryCsv` → object URL. The filename comes from `csvFileName()`. Toasts for start, 400 and 429.
- Separate skeleton, error and retry states for the analytics block and the history (with a 429 countdown); the empty states (FR-4.16 from `hasPaymentsEver`, FR-4.17); FR-4.19 edge cases.
- The sidebar entry and the header titles.
- Recharts is loaded only on this route (`next/dynamic` for the chart card).

**Tests it owns:**

- FU-4.1 to 4.5 and L-2 in `scripts/test-spending.mjs`. FU-4.4 expects `PENDING` → "Awaiting payment" and the existing labels otherwise.
- A unit check that the chart config keys are a static set (T-5 helper level).
- It self-checks with `tsc`, `eslint` and `check:colors`, and hands BR-4.x and BR-7.1 to QA.

### 5.5 fe-settings-inbox

**Builds:**

- **Settings → Payments** (per the Settings spec §3, with the §0.2 copy):
  - the history-moved banner (60 days / dismissed flag)
  - the radio-card form from B5, with explicit Save, a sticky bar on phones, Cancel, "Discard changes?" on tab, back or link changes, the suspended state from `editable`, and the error states
  - Receipts (read-only, linking to `?tab=notifications`)
  - the protection path
  - no payment list
- **Profile photo card:**
  - the stacked layout below 640px
  - Remove only when there is a photo, with a confirm dialog, `DELETE /users/me/avatar` and the header avatar updated
  - inline upload errors
  - the camera button named "Change profile photo"
  - padding 16px below 640px and 24px from 640px on every Settings card
- **Remove** the Booking Preferences card.
- **Bell and envelope:**
  - in-place single-open disclosures with plain text only (`whitespace-pre-wrap break-words`, `dir="auto"`, `[unicode-bidi:isolate]`)
  - `notificationHref` with typed ids only
  - read after 1 s open (once per item per menu-open; quietly reverts on failure)
  - envelope: full `lastMessage.content`, the photo placeholder that never loads `attachmentUrl`, the unread strip, and auto-read only when `unreadCount === 1` (sends `upToMessageId`)
  - "Open conversation" and "Reply" (`?reply=1`); no Reply for "Deleted user"
  - Escape twice; everything collapses on close; a 400px popover at ≥640px and a drawer below 640px; polling unchanged and no re-order while open
- **Platform:** CSP and headers (§4.1); ESLint `react/no-danger`; the `package.json` scripts.

**Tests it owns:**

- FU-6.1 to 6.5 and T-4 (every hostile input in SEC-18) in `scripts/test-inbox.mjs`.
- `scripts/test-csp.mjs`: the policy contains the required directives; the API, media and Google avatar hosts are included; dev-only sources are absent in production; there is no `'unsafe-eval'` in production; the SW policy allows gstatic.
- T-11 / S-8, the header presence part, through `test-csp.mjs` against the built config object. Live-response checks go to QA.
- It self-checks with `tsc`, `eslint` and `check:colors`, and hands BR-3.x, BR-5.x (except [Q6]) and BR-6.x to QA.

### 5.6 QA and security (after the build; not one of the five roles)

- The Playwright `BR-` suites, A-, R-, P-, L- and C-1. Playwright is a new dev dependency that QA adds; the five dev roles do not install anything.
- The manual Paystack test-mode check of BR-5.11, including the channel-order risk in §1 B5c.
- Security verifies SEC-1..39 against this plan, including the [Δ] CSP deviation in §4.1 and the field rename in §0.2.

### 5.7 Definition of done (every role)

1. Everything in the role's brief is built exactly to §1 and the approved area spec and mockups, with the copy rules in §0.2. `grep -ri escrow` on the changed and new files finds nothing in UI strings, emails, CSV text or API field names. No refund timing is promised anywhere.
2. **Backend:**
   - `npx tsc --noEmit -p tsconfig.json` shows **only the 5 known errors** in spec files.
   - `npx jest <own specs>` passes, and the **full** `npm test` and `npm run test:e2e` stay green. They are hermetic (PGlite, all externals mocked) and never touch the developer DB.
   - Coverage holds at the gate.
   - `npx prettier --write` only on the `.ts` files the role changed.
   - The role does not start the API against the developer DB and does not run migrations against it.
3. **Frontend:**
   - `npx tsc --noEmit` adds no new errors.
   - `npx eslint <changed files>` is clean.
   - `npm run check:colors` passes.
   - The role's `scripts/test-*.mjs` passes with `node --experimental-strip-types`.
   - No `next build`, `npm run build` or `npm run verify` (the dev server on 4200 shares `.next`).
   - `globals.css` is not edited.
   - Layouts are checked against the mockups at 360, 390, 768, 1024, 1280, 1440 and 1920 in light and dark mode, with no horizontal scroll.
4. **Security:**
   - Every new route has explicit guards, a role check and its named throttler, and the owner comes from the JWT inside SQL.
   - The forbidden-field walker runs on every new response.
   - User text renders only as text nodes.
   - Links come only from typed ids.
   - No new `dangerouslySetInnerHTML`.
   - No secrets or `.env` values are read or printed.
   - Fictional test data only.
5. **Existing behaviour is unchanged:**
   - `/payments/history` with no parameters (job page, pay page)
   - `GET /jobs` and the single-status `/jobs/mine`
   - artisan and admin analytics ranges
   - Paystack initialise without a preference
   - the other Settings tabs
   - "Mark all as read" and "View all"
   - artisan and admin screens
6. **Git:** no commit, push, stash, reset or checkout. The work stays in each working tree for review. Files owned by another role are not edited.
