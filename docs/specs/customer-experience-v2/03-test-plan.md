# Customer Experience v2: Test Plan

| | |
|---|---|
| **Document** | 03-test-plan |
| **Owner** | QA |
| **Status** | Draft, written against `01-requirements.md` (draft, awaiting product owner review) |
| **Date** | 30 October 2026 |
| **Covers** | FR-1.x to FR-6.x, NFR-1 to NFR-8, backend items B1 to B10, small fixes in §9 of the requirements |

All people, emails, ids and amounts below are fictional.

---

## 0. How this plan works

### 0.1 Test levels

| Level | ID prefix | Where it runs | Tooling |
|---|---|---|---|
| **Backend unit** | `BU-` | `JIN_VA-BACKEND`, `npm test` | Jest, services with mocked repositories, pure helpers tested directly |
| **Frontend unit** | `FU-` | `jinva-frontend-web` | Pure functions (stage mapping, URL parsing, formatters, CSV-safe helpers, masking) as `scripts/test-*.mjs` run with `node --experimental-strip-types`, the same pattern as `test:redirect` and `test:phone`. Added to `npm run verify`. |
| **API e2e (hermetic)** | `E-` | `JIN_VA-BACKEND`, `npm run test:e2e` | Jest + supertest against the full Nest app on in-memory Postgres (`test/support/pglite-server.ts`), with `test/support/hermetic.ts` blocking every non-loopback connection. Paystack, S3/B2, mail, FCM and Photon are mocked. Fixtures built with `test/helpers/test-data.ts`. Clock frozen at **2026-10-30T12:00:00Z** unless a case says otherwise. |
| **Browser** | `BR-` | `jinva-frontend-web` | Playwright (new dev dependency) against `next build && next start`. API calls are answered by `page.route()` fixtures (JSON from §0.3) so the browser suite needs no backend and no network. A small **contract smoke** project (`BR-C-`) runs the same pages against the e2e backend in CI. |

Browser cases run in the matrix below unless a case narrows it:

| Axis | Values |
|---|---|
| Viewport (CSS px) | **360**×740, **390**×844, **768**×1024, **1024**×768, **1280**×800, **1440**×900, **1920**×1080 |
| Engine | Chromium (all), WebKit (360, 390, 1440), Firefox (1440) |
| Colour scheme | light, dark (`colorScheme` option) |
| Motion | default, `reducedMotion: 'reduce'` |
| Input | pointer, **keyboard-only** (no `click()`, only `keyboard.press`), touch (`hasTouch` at 360/390/768) |

Accessibility checks use `@axe-core/playwright` (WCAG 2.2 AA tags) on every page state listed in §8.2.

### 0.2 Case format

Each case has: **ID**, **Covers** (FR/NFR/AC), **Preconditions**, **Steps**, **Expected**. Where a step says "as customer A", the request carries customer A's JWT.

### 0.3 Shared fixtures

| Name | Who / what |
|---|---|
| **Customer A** | Ama Owusu, `ama.owusu@example.com`, CUSTOMER, active |
| **Customer B** | Kwame Mensah, `kwame.mensah@example.com`, CUSTOMER, active, owns data used for cross-customer checks |
| **Customer S** | Esi Badu, `esi.badu@example.com`, CUSTOMER, **suspended** |
| **Customer N** | Yaw Boadu, `yaw.boadu@example.com`, CUSTOMER, no jobs, no payments, no photo |
| **Customer L** | Oluwaseun Adebayo-Mensah, `oluwaseun.adebayo-mensah.facilities@example.com` (48 chars), long name |
| **Artisan K** | Kofi Asante, ARTISAN, service Plumbing, has phone and payout details on record (must never leak) |
| **Artisan E** | Efua Boateng, ARTISAN, service Electrical |
| **Artisan D** | a soft-deleted artisan with past payments |
| **Admin** | Abena Darko, ADMIN |
| **Job mix A38** | 38 jobs for customer A: OPEN 3, PENDING 1, IN_PROGRESS 2, COMPLETED 27, CANCELLED 4, EXPIRED 1. Created over 14 months so the newest 10 are *not* representative (newest 10 = 3 OPEN, 2 IN_PROGRESS, 5 COMPLETED). |
| **Payment mix P30** | Customer A, paid in the last 30 days: GH₵ 1,000.00 RELEASED, GH₵ 500.00 HELD, GH₵ 300.00 REFUNDED (refunded 300.00), GH₵ 200.00 FAILED (AC-4.2) |
| **Payment mix P12** | Customer A, 19 counted payments spread over 12 months across Plumbing, Electrical, Cleaning, Carpentry, Painting, Masonry, Tiling, Welding (8 services, so "Other" is exercised), channels `mobile_money`, `card`, `bank`, and one with `channel = null`; plus PENDING, FAILED, CANCELLED rows; one PENDING_TRANSFER, one TRANSFER_FAILED; one partial refund (GH₵ 800.00 paid, GH₵ 200.00 refunded); one refund made in October for a payment paid in August |
| **Payment mix P500** | 500 payments for one customer (performance only) |
| **Notifications N** | the `DISPUTE_RESOLVED` item from §6.5 of the requirements (id 9021, unread, `payload.jobId = 812`), a `NEW_MESSAGE` item with a 100-char cut body, a payment item with `payload.paymentId`, one with an empty payload, one with body `<img src=x onerror=alert(1)>`, one with `payload.url = "https://evil.example.com"` |
| **Conversations M** | latest message 600 chars (multi-line), latest message 2,000 chars, latest message is a photo, conversation with 3 unread, conversation with 1 unread, conversation with a deleted contact, conversation where the latest message is mine |

### 0.4 Entry and exit criteria

- **Entry:** requirements signed off (at least Q1, Q2, Q3, Q4, Q6 answered); design `02-design` approved; endpoints on staging for browser contract smoke.
- **Exit:** every **Must** case passes; no open Critical/High defects; every Should case passes or has an owner-approved waiver; full backend unit + e2e suites green; frontend `npm run verify` green; regression list (§9) re-run.

### 0.5 Cases that depend on open questions

| Question | Cases affected | Default assumed here |
|---|---|---|
| Q1 multi-select | FR-1 cases (button label "Clear filter") | single select |
| Q2 PENDING stage | E-1.1, FU-1.1 | PENDING counts as In progress |
| Q3 spend definition | all spend totals | approved as written |
| Q4 route | BR-4.1 | `/dashboard/user/report` |
| Q6 momo number | cases marked **[Q6]** run only if Q6 = yes | not built |
| Q10 CSV | E-4.20 to E-4.24, BR-4.14 | built (Should) |
| Q12 booking switches | BR-3.9 | removed |

---

## 1. Overview: job stage filters (FR-1.1 to FR-1.19, B7)

### 1.1 Backend unit

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| BU-1.1 | B7a, FR-1.2 | Mock repo returns grouped rows `[{status:'OPEN',count:'3'},{status:'PENDING',count:'1'},…]` (strings, as Postgres returns them) | Call `getMySummary(customerId)` | `byStatus` numbers (not strings) for every `Status`, missing statuses as 0; `byStage` = `{open:3,in_progress:3,completed:27,closed:5}`; `total` 38 |
| BU-1.2 | B7a | Repo returns `[]` | Call summary | All statuses 0, all stages 0, total 0 |
| BU-1.3 | B7a | Spy on query builder | Call summary for user 1042 | Query has a parameterised `customer_id = :me` (no string interpolation) and a single `GROUP BY status` |
| BU-1.4 | B7b | — | Validate `GetJobsQueryDto` with `status=PENDING,IN_PROGRESS` | Parsed to `['PENDING','IN_PROGRESS']`, valid |
| BU-1.5 | B7b, NFR-4.3 | — | Validate `status=OPEN,FOO`, `status=,`, `status=open` (lower case), `status=OPEN;DROP` | Each rejected with a validation error naming `status` |
| BU-1.6 | B7b | — | Validate `status=OPEN` and no `status` | Same parse result as today (single value / undefined) |
| BU-1.7 | B7b | — | Validate `status=OPEN,OPEN` | De-duplicated or accepted; query uses `IN (:...statuses)` |

### 1.2 Frontend unit

| ID | Covers | Steps | Expected |
|---|---|---|---|
| FU-1.1 | Terms §0.5, FR-1.1 | Map every `Status` to a stage | OPEN→open; PENDING, IN_PROGRESS→in_progress; COMPLETED→completed; CANCELLED, EXPIRED→closed; anything else→none |
| FU-1.2 | FR-1.8, AC-1.5 | `parseStage()` with `open`, `in_progress`, `completed`, `closed`, `OPEN`, `<script>`, `''`, `null`, `closed&x=1`, an array value, a 5,000-char string | Only the four exact values return a stage; everything else returns `null`; the function never returns the input string |
| FU-1.3 | FR-1.4, NFR-7.4 | Summary sentence for (In progress, 1), (In progress, 4), (Closed, 0) | "Showing In progress jobs only · 1 result", "… · 4 results", "… · 0 results" |
| FU-1.4 | FR-1.10 | Live-region text for select (Closed, 5) and clear (5 recent) | "Showing 5 closed jobs", "Filter cleared, showing 5 recent jobs" |
| FU-1.5 | FR-1.11 | `summarise()` given account-wide counts for A38 | Sentence uses 27 completed / 3 in progress, not the newest-10 numbers |
| FU-1.6 | FR-1.7 | Pagination helper: total 23, limit 10 | pages 1, 2, 3; "Show more" visible after page 1 and 2, hidden after page 3; at 50 loaded the helper switches to "See all … in My Jobs" |

### 1.3 API e2e

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| E-1.1 | B7a, AC-1.1 | A38 for customer A; customer B has 5 jobs | `GET /jobs/mine/summary` as A | 200; `byStatus` `{OPEN:3,PENDING:1,IN_PROGRESS:2,COMPLETED:27,CANCELLED:4,EXPIRED:1}`, `byStage` `{open:3,in_progress:3,completed:27,closed:5}`, `total:38`; B's jobs not counted |
| E-1.2 | B7a | Customer N | Summary as N | 200, all zero, total 0 |
| E-1.3 | NFR-4.1 | — | Summary with no token; as Artisan K; as Admin | 401; 403; 403 |
| E-1.4 | NFR-4.1 | — | Summary as A with `?customerId=<B's id>` and `?userId=` | 400 (non-whitelisted) or ignored; in no case are B's counts returned |
| E-1.5 | B7b | A38 | `GET /jobs/mine?status=PENDING,IN_PROGRESS&page=1&limit=10` | 3 jobs, all PENDING/IN_PROGRESS, newest first; `pagination` `{page:1,limit:10,total:3,totalPages:1}` |
| E-1.6 | B7b, AC-1.7 | A has 23 COMPLETED within A38 variant | `status=COMPLETED&limit=10` pages 1, 2, 3 | 10, 10, 3 rows; no duplicates or gaps across pages; stable order when two jobs share `createdAt` (tie-break on id) |
| E-1.7 | B7b, NFR-4.3 | — | `status=FOO`, `status=OPEN,FOO`, `limit=101`, `page=0` | 400 each |
| E-1.8 | B7b backward compat | A38 | `GET /jobs/mine` (no params) and `?status=OPEN` | Byte-for-byte the same shape as before the change (snapshot of response keys taken on `main`) |
| E-1.9 | FR-1.17 | A has one IN_PROGRESS job with completion requested | Confirm completion via the existing endpoint, then call summary | `in_progress` down by 1, `completed` up by 1 |
| E-1.10 | B7b, NFR-4.1 | B has 2 IN_PROGRESS jobs | `GET /jobs/mine?status=IN_PROGRESS` as A | Only A's jobs |

### 1.4 Browser

Route: `/dashboard/user` as customer A with A38 fixtures unless stated.

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| BR-1.1 | AC-1.1, FR-1.2 | A38 | Load Overview | Stops show 3 / 3 / 27 / 5; header sentence matches the same numbers |
| BR-1.2 | AC-1.2, FR-1.3, FR-1.4, FR-1.5, FR-1.8 | No filter | Click "In progress" | Stop has `aria-pressed="true"`, a check/filled dot and bold label; the other three are dimmed; summary bar reads "Showing In progress jobs only · 3 results"; chip "In progress" with × named "Remove filter: In progress"; "Clear filter" button present; heading "In progress jobs"; URL ends `?stage=in_progress`; `history.length` unchanged (replace, not push) |
| BR-1.3 | FR-1.3, NFR-2.3 | Filter on | Screenshot the stage group in grayscale (CSS `filter: grayscale(1)` injected) | Selected stop still distinguishable (visual diff vs unselected shows shape/weight change, not only hue). Measure selected outline vs unselected outline contrast ≥ 3:1 |
| BR-1.4 | AC-1.3, FR-1.9 | In progress on | Three variants: click "Clear filter"; click chip ×; click the selected stop | Bar gone, heading "Recent jobs", URL has no `stage`; for the first two variants `document.activeElement` is the list heading |
| BR-1.5 | FR-1.1 | In progress on | Click "Completed" | Filter replaced (only Completed pressed), list shows completed jobs, URL `?stage=completed` |
| BR-1.6 | FR-1.4 | — | Toggle filters on/off at 360 and 1440; record the bounding box of "Clear filter" for each stage | Same x/y position for all four stages (does not jump) |
| BR-1.7 | FR-1.6 | No filter | Load | 5 rows, "See all jobs" links to My Jobs |
| BR-1.8 | AC-1.7, FR-1.7 | 23 completed | Filter Completed, click "Show more" twice | 10 → 20 → 23 rows, no full reload (a `window` marker survives), "Show more" disappears; focus after "Show more" lands on the first newly loaded row |
| BR-1.9 | FR-1.7 | 55 completed | Filter Completed, click "Show more" 4 times | At 50 rows, "Show more" is replaced by "See all Completed jobs in My Jobs" linking to My Jobs with the completed filter applied |
| BR-1.10 | AC-1.5, FR-1.8 | — | Open `?stage=completed`; reload | Completed on before and after reload |
| BR-1.11 | AC-1.5, NFR-4.6 | — | Open `?stage=<script>alert(1)</script>`, `?stage=%22onmouseover%3Dalert(1)`, `?stage=OPEN` | No filter on; no dialog fired (`page.on('dialog')` never called); page text and DOM attributes do not contain the raw value; intercepted API requests contain no `stage`/`status` built from it |
| BR-1.12 | AC-1.6, FR-1.14 | 0 open jobs | Select Open | "No open jobs right now", a per-stage hint, and a "Clear filter" button inside the empty state that clears the filter |
| BR-1.13 | FR-1.13 | Customer N | Load | Stops show 0, "You have not posted a job yet" + "Post a job", no summary bar; selecting a stop shows the filtered empty state |
| BR-1.14 | FR-1.12 | Summary response delayed 3 s | Load; observe at 0.5 s and 1.2 s | At 0.5 s skeleton counts, stops `aria-disabled`; by 1.2 s stops show "–" and are selectable; when counts arrive they replace "–" |
| BR-1.15 | AC-1.8, FR-1.15 | Summary returns 500 | Load | Stops show "–", "Try again" inline message, recent jobs list still loads; clicking "Try again" with a 200 fixture shows counts |
| BR-1.16 | FR-1.15, FR-1.16 | Counts 200, list 500 for `status=IN_PROGRESS` | Select In progress | List area shows error + "Try again"; stop stays selected; counts still visible |
| BR-1.17 | FR-1.18 | List responses delayed: Open 1,500 ms, Completed 200 ms | Click Open then Completed within 100 ms | Final list shows Completed jobs only; the late Open response never replaces it |
| BR-1.18 | FR-1.17 | A job with completion requested | Confirm completion from the page | Counts and list refresh after the action returns; the selected stage stays the same |
| BR-1.19 | FR-1.19, NFR-2.6 | — | Load; then change filter. Repeat with reduced motion | No `data-swap` animation on first paint; animation on filter change; none at all under reduced motion (no running `Animation` objects via `document.getAnimations()`) |
| BR-1.20 | FR-1.9, AC-1.4 | Keyboard only | Tab to stage group, arrow/Tab to "Closed", Enter; then Space to clear | Each stop is a `button` with `aria-pressed`; Enter selects, Space clears; live region (`aria-live="polite"`) text becomes "Showing 5 closed jobs" then "Filter cleared, showing 5 recent jobs" |
| BR-1.21 | NFR-1.4 | Throttled 4G profile, list fixture delayed 300 ms | Click a stop, measure | `aria-pressed` updates within 100 ms of the click; list rendered within 1 s |
| BR-1.22 | NFR-3 | All 7 widths, light + dark | Filter on, screenshot | No horizontal scroll (`scrollWidth ≤ clientWidth`), summary bar wraps cleanly at 360, visual snapshot approved |

---

## 2. Overview: right rail (FR-2.1 to FR-2.10, B6)

### 2.1 Backend unit

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| BU-2.1 | B6 actionItems | Mocks: 1 completion requested (job 812), 1 unpaid accepted job (815), 4 new applications across 2 jobs, 2 unread conversations | Build overview | `completionsToConfirm {count:1, jobId:812}`, `paymentsDue {count:1, jobId:815}`, `applicationsToReview {count:4, jobId:null}`, `unreadMessages:2` |
| BU-2.2 | B6 jobId rule | 2 completions requested | Build | `count:2, jobId:null` |
| BU-2.3 | B6 nextBooking | Bookings: yesterday CONFIRMED, today 14:00 PENDING, tomorrow CONFIRMED, today 08:00 CANCELLED; clock 12:00 Accra | Build | Today 14:00 PENDING returned (earliest upcoming, statuses PENDING/CONFIRMED only) |
| BU-2.4 | B6 nextBooking | Booking with no start/end time | Build | `startTime:null`, `endTime:null`, date kept |
| BU-2.5 | B6 spend, FR-4.2 | P12-style rows with refunds and all statuses | Build | `thisMonth`, `lastMonth`, `inEscrow` equal to the analytics service's figures for the same data (shared helper; test asserts both call the same function or produce equal values) |
| BU-2.6 | B6 last6Months | No payments in June | Build | 6 entries, `2026-05` to `2026-10`, June `"0.00"` |
| BU-2.7 | NFR-7.1 month boundary | Payment `paidAt` 2026-09-30T23:59:59Z and another 2026-10-01T00:00:00Z | Build | First counted in September, second in October |
| BU-2.8 | B6 money format | Amounts 0.1 + 0.2 style values | Build | All money strings have exactly two decimals (`"0.30"`), no float artefacts |
| BU-2.9 | FR-2.8 | Spend sub-query throws | Build | `spend:null`, other sections present, error logged without personal data |

### 2.2 API e2e

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| E-2.1 | B6 | Customer A with the BU-2.1 data built in the DB | `GET /customers/me/overview` as A | 200, shape exactly as §2.4 of requirements |
| E-2.2 | FR-2.10, NFR-4.2 | Artisan K has phone, email, payout details | Overview as A; walk the JSON recursively | No key matching `/phone|email|payout|bank|account|platformFee|artisanAmount|transfer|fraud|authorization|accessCode/i`; no value equal to K's phone/email |
| E-2.3 | NFR-4.1 | B has bookings and payments | Overview as A | Contains none of B's ids or amounts |
| E-2.4 | NFR-4.1 | — | No token; Artisan K; Admin | 401; 403; 403 |
| E-2.5 | B6 | Customer N | Overview as N | 200; all action counts 0; `nextBooking:null`; spend all `"0.00"`, six zero months |
| E-2.6 | NFR-4.4 | Throttler limits from config (test override to small number, e.g. 3) | Call overview limit+1 times as A; then once as B | Last call for A returns 429 with the existing rate-limit error contract; B is not affected (per-user key) |
| E-2.7 | AC-2.5 (backend half) | September net GH₵ 1,420.00, October GH₵ 1,840.00 | Overview and `/analytics/customer?range=12m` as A | Overview `thisMonth` equals the October bucket of the analytics series |

### 2.3 Frontend unit

| ID | Covers | Steps | Expected |
|---|---|---|---|
| FU-2.1 | FR-2.5, NFR-7.3 | Format booking 2026-11-04 09:00–11:00 with "now" 2026-10-30, 2026-11-03, 2026-11-04 | "Tue 4 Nov 2026, 9:00 am – 11:00 am"; "Tomorrow, 9:00 am – 11:00 am"; "Today, …" |
| FU-2.2 | FR-2.5 | Booking without times | Date only |
| FU-2.3 | FR-2.6 | Comparison: (1840, 1420), (1000, 1500), (500, 0) | "▲ GH₵ 420.00 vs September", "▼ GH₵ 500.00 vs September", hidden |
| FU-2.4 | FR-2.6, NFR-2.7 | Sparkline text alternative for the §2.4 series | "Spending over the last 6 months, highest in August, GH₵ 2,150" style string |
| FU-2.5 | FR-2.4 | Action link builder: count 1 with jobId, count 3 with null | Direct `/dashboard/user/jobs/812`; filtered list URL. Never uses a URL from data |

### 2.4 Browser

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| BR-2.1 | AC-2.1, FR-2.1 | 1920×1080, overview fixture | Load | Rail is beside the main column; main column ≤ ~880px; rail 320–360px; gap from rail's right edge to viewport right edge < 120px |
| BR-2.2 | FR-2.1 | 1280 and 1440 | Load | Rail visible; same < 120px rule at 1440; no horizontal scroll at 1280 with the sidebar open |
| BR-2.3 | FR-2.2, AC-2.2 | 390 with one completion to confirm | Load | "Needs your action" above the job list; "Next appointment" and "Spending snapshot" below it, stacked |
| BR-2.4 | FR-2.2 | 768 and 1024 | Load | No rail; the two cards below the list sit side by side |
| BR-2.5 | FR-2.2 | 390, all action counts 0 | Load | "Needs your action" not rendered above the list |
| BR-2.6 | FR-2.4 | 1440, all counts 0 | Load | Card shows "You're all caught up" (not hidden) |
| BR-2.7 | AC-2.3, FR-2.4 | `completionsToConfirm {count:1, jobId:812}` | Click "Confirm completion" | Navigates to `/dashboard/user/jobs/812` |
| BR-2.8 | FR-2.4 | Each action type with count 3 | Click each row | Goes to the matching filtered list / Messages; count badges show 3 |
| BR-2.9 | FR-2.5 | Booking fixtures for today, tomorrow, next week, no time, none | Load each | "Today", "Tomorrow", "Tue 4 Nov 2026", date only, "No upcoming appointments" + "Book an artisan"; artisan photo and name only |
| BR-2.10 | AC-2.4, FR-2.6 | Spend all zero, no payments | Load | First-payment message, no `<svg>` sparkline |
| BR-2.11 | AC-2.5 | thisMonth 1840, lastMonth 1420 | Load Overview, then the Spending page with matching analytics fixture | "GH₵ 1,840.00" and "▲ GH₵ 420.00 vs September"; Spending page October total also GH₵ 1,840.00 |
| BR-2.12 | FR-2.6, NFR-2.7 | Sparkline present | Read accessible name of the sparkline | Has `role="img"` and the text alternative from FU-2.4 |
| BR-2.13 | AC-2.6, FR-2.8 | Overview returns 500 | Load | Filters and job list still work; each rail card shows "Couldn't load · Try again"; retry with 200 fills all three |
| BR-2.14 | FR-2.8 | Response with `spend:null` only | Load | Spending card shows its fallback; the other two cards render normally |
| BR-2.15 | FR-2.7, NFR-1.3 | Overview delayed 2 s | Load, record CLS with `PerformanceObserver('layout-shift')` | Skeletons have final heights; CLS < 0.1 at 390 and 1440 |
| BR-2.16 | FR-2.9, NFR-1.7 | Count requests to `/customers/me/overview` | Blur/focus the window 5 times within 20 s; then once after 31 s | Exactly 1 refetch in the first 30 s window, 1 more after; no timer-based polling while focused for 2 minutes |
| BR-2.17 | FR-2.9 | — | Confirm a completion from the rail flow and return | Rail refetched after the action |
| BR-2.18 | FR-2.3 | 1280×720, if the design chooses sticky | Scroll to bottom | Rail never covers the job list or footer |
| BR-2.19 | NFR-1.2, NFR-1.8 | 390 | Load Overview; list loaded JS chunks | No `recharts` chunk loaded on the Overview; route JS growth ≤ 25 KB gzipped vs `main` build (from `next build` output) |

---

## 3. Profile photo on mobile (FR-3.1 to FR-3.8, B1)

### 3.1 Backend unit

| ID | Covers | Steps | Expected |
|---|---|---|---|
| BU-3.1 | B1 | `removeAvatar(userId)` with a stored file | `profilePicture` set to null, storage delete called with that key, user saved |
| BU-3.2 | B1 | Storage delete rejects | Still succeeds; warning logged without the email or full URL query string |
| BU-3.3 | B1 | User has no photo | Succeeds idempotently; storage delete not called |
| BU-3.4 | B1 hardening | Validate `UpdateMeDto` with `profilePicture: "https://tracker.example.com/p.gif"` | Rejected (400) or field not accepted, per the chosen fix; a URL from our own avatar storage accepted only if that option is chosen |

### 3.2 API e2e

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| E-3.1 | B1, AC-3.3 | A has a photo; storage mocked | `DELETE /users/me/avatar` as A; then `GET /users/me` | 200 "Profile photo removed", `profilePicture:null`; GET also null; storage mock called once with A's key |
| E-3.2 | B1, NFR-4.1 | A and B have photos | DELETE as A | B's photo unchanged |
| E-3.3 | B1 | — | No token | 401 |
| E-3.4 | B1 | Artisan K with a photo | DELETE as K | 200 (any signed-in user) and only K's photo removed; artisan public profile shows no photo |
| E-3.5 | B1 | Storage mock throws | DELETE as A | 200, DB null |
| E-3.6 | B1 hardening, AC-5.5 pattern | — | `PATCH /users/me {"profilePicture":"https://tracker.example.com/p.gif"}` | 400; stored value unchanged |
| E-3.7 | Regression | — | Existing upload endpoint with JPEG 1 MB, PNG, WebP, GIF, 5 MB + 1 byte | First three succeed; GIF and oversize rejected with the existing messages |

### 3.3 Browser

Route: `/dashboard/user/settings?tab=profile`.

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| BR-3.1 | AC-3.1, FR-3.1 | 360 and 390, A with photo | Load | Photo card: avatar 96px on top, then name, email, buttons; card `scrollWidth ≤ clientWidth`; page has no horizontal scroll; each button bounding box ≥ 44×44 and fully inside the card |
| BR-3.2 | FR-3.2 | 640, 768, 1440 | Load | Avatar left, text and buttons right; buttons wrap rather than overflow |
| BR-3.3 | AC-3.2, FR-3.3 | Customer L at 360 | Load; hover/focus the email | No overflow; truncated or wrapped; full value available in a `title`/tooltip and in the accessible name |
| BR-3.4 | FR-3.4 | 360 and 640 | Measure padding of every Settings card | 16px under 640, 24px from 640 |
| BR-3.5 | FR-3.5 | Upload endpoint delayed 1 s | Choose a 1 MB JPEG | Button shows spinner + "Uploading…", both buttons disabled; on success "Photo updated" toast, the header avatar `src` changes without a reload |
| BR-3.6 | AC-3.5 | — | Choose a 7 MB file; choose a `.gif` | "This file is larger than 5 MB" and a type error respectively; no upload request sent |
| BR-3.7 | FR-3.6, AC-3.3 | A with photo | Click Remove; check dialog; Cancel; Remove again; confirm | Dialog text "Remove your profile photo? Artisans will see your initials instead." with "Remove photo"/"Cancel"; Cancel sends nothing; confirm sends `DELETE /users/me/avatar`; initials in card and header; "Photo removed" toast; reload still shows initials |
| BR-3.8 | FR-3.6 | DELETE returns 500 | Confirm removal | Photo stays; error toast with "Try again" that retries |
| BR-3.9 | AC-3.4 | Customer N | Load | No Remove button |
| BR-3.10 | FR-3.7 | Keyboard only | Tab to the camera icon; Enter | Accessible name "Change profile photo"; opens the same file chooser as "Upload new photo" (`filechooser` event) |
| BR-3.11 | AC-3.6, FR-3.8, FR-5.9 | — | Load Profile tab | No "Save Payment Method" switch; any remaining Booking Preferences switch persists across reload (or the card is gone, per Q12) |
| BR-3.12 | NFR-2.9 | Keyboard only | Open the Remove dialog; Tab cycles; Escape | Focus trapped in dialog; Escape closes; focus returns to Remove |
| BR-3.13 | NFR-8.2 | Dark mode, 360 and 1440 | Snapshot | Approved visual snapshot; contrast checks pass (axe) |

---

## 4. Spending report and payment history (FR-4.1 to FR-4.19, B2, B3, B4, B10)

### 4.1 Backend unit

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| BU-4.1 | FR-4.2, AC-4.2 | P30 rows | Compute totals for 30d | `netSpent "1500.00"`, `inEscrow "500.00"`, `refunded "300.00"`, `grossPaid "1800.00"`, `paymentsCount 3`, FAILED excluded |
| BU-4.2 | §4.2 table | One row per status | Compute | HELD, PENDING_TRANSFER, TRANSFER_FAILED counted and in escrow; RELEASED counted, not in escrow; REFUNDED counted minus refund; PENDING, FAILED, CANCELLED not counted |
| BU-4.3 | §4.2 partial refund | GH₵ 800.00 paid, GH₵ 200.00 refunded | Compute | Net 600.00, refunded 200.00 |
| BU-4.4 | FR-4.19 late refund | Paid 12 Aug, refunded 20 Oct | Compute 30d and 12m | Not in 30d; in 12m the August bucket is reduced by the refund |
| BU-4.5 | B2 buckets | Clock 2026-10-30 | Build bucket list for 30d, 90d, 12m, all | 30 daily, ~13 weekly, 12 monthly (Nov 2025 – Oct 2026), monthly from first payment to now; every bucket present with zeros |
| BU-4.6 | B2 range enum | — | Validate `range` with `30d`, `90d`, `12m`, `all`, `7d`, `1y`, `12M`, `` | First four valid; others 400. Artisan and admin range DTOs unchanged (`7d|30d|90d|all`, `7d|30d|90d|1y`) |
| BU-4.7 | FR-4.3 | Two 30-day periods | Compute | `previousPeriodNetSpent` = net of the 30 days before the range; `null` for `all` |
| BU-4.8 | FR-4.5 | 8 services | Compute byCategory | Top 6 by net + "Other" (serviceId null) with the sum of the rest; shares sum to 1 ± 0.001 |
| BU-4.9 | FR-4.6, FR-4.19 | Artisan D soft-deleted | Compute byArtisan | D shown as "Former artisan", avatar null, `artisanProfileId` null (no link) |
| BU-4.10 | FR-4.7 | Channels mobile_money, card, bank, null | Compute byChannel | null grouped as "other" |
| BU-4.11 | FR-4.8 | — | Compute largestPayment | Largest counted payment by `amount`; tie broken by most recent `paidAt` |
| BU-4.12 | B2 cache | Cache mock | Call twice for user A within 60 s, once for B | Second A call served from cache; key contains the user id and range; B computed separately |
| BU-4.13 | B3 DTO | — | Validate history query: `limit=101`, `search` 101 chars, `from`>`to`, range 25 months, `status=HELD,FOO`, `serviceId=abc` | Each 400 |
| BU-4.14 | B3 mapper | Entity with platformFee, artisanAmount, transferCode, accessCode, authorizationUrl, fraud flags | Map to response DTO | Only the documented keys; `netAmount = amount − refundedAmount` |
| BU-4.15 | B10 CSV | Cells `=SUM(A1)`, `+1`, `-1`, `@x`, `\t=x`, `normal`, a value with comma, quote and newline | Escape | `'=SUM(A1)`, `'+1`, `'-1`, `'@x`, leading tab/CR also neutralised; RFC 4180 quoting for comma/quote/newline |
| BU-4.16 | NFR-7.1 | paidAt 2026-10-31T23:30:00Z | Bucket | Lands in 31 Oct (Accra = UTC) |

### 4.2 API e2e

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| E-4.1 | B2, AC-4.2 | P30 for A | `GET /analytics/customer?range=30d` as A | Totals as BU-4.1; `series` has 30 entries; failed payment not counted |
| E-4.2 | B2 | P12 for A | `range=12m` | 12 monthly buckets in order, zeros filled; `byCategory` has 6 + Other; `byChannel` includes `other`; `largestPayment` correct; `previousPeriodNetSpent` correct |
| E-4.3 | B2 | P12 | `range=all` | Monthly from first paid month; `previousPeriodNetSpent:null` |
| E-4.4 | B2, NFR-4.3 | — | `range=7d`, `range=1y`, `range=foo`, no `range` | 400, 400, 400, and default 12m (or 400 if the API requires it; must match what the frontend sends) |
| E-4.5 | AC-4.5, NFR-4.1 | A and B both have payments | Analytics as A with `?customerId=`, `?userId=` of B | 400 or ignored; never B's data |
| E-4.6 | AC-4.5 | — | Analytics, history (paginated), export as Artisan K and Admin; no token | 403, 403, 401 |
| E-4.7 | NFR-4.2 | P12 | Analytics and history as A; walk JSON | No forbidden keys (list in NFR-4.2); no artisan phone/email |
| E-4.8 | NFR-4.4 | Throttler override small | Analytics limit+1 times as A | 429 on the last; overview and export share the `customer-analytics` bucket if designed so, and the test asserts the agreed behaviour |
| E-4.9 | B3, AC-4.7 | P12 | `GET /payments/history` with **no** params | Unpaginated **array** (same top-level shape as on `main`, snapshot of keys), new fields added, no `pagination` meta |
| E-4.10 | B3 | P12 (19+ rows incl. non-counted) | `?page=1&limit=20` then `page=2` | Paginated, newest first by paid date (rows without `paidAt` ordered by `date`), totals in `pagination` correct, no duplicates across pages |
| E-4.11 | B3, AC-4.3 | P12 | `?serviceId=<Plumbing>` | Only plumbing rows; `pagination.total` = plumbing count |
| E-4.12 | B3 | P12 | `?status=REFUNDED,FAILED` | Only those statuses |
| E-4.13 | B3 | P12 | `?artisanProfileId=<K>` | Only K's rows |
| E-4.14 | B3 | P12, a job titled "Rewire 3-bedroom flat", reference `JINVA-7F3K2Q` | `?search=rewire`, `?search=JINVA-7F3K`, `?search=%25` , `?search=' OR 1=1 --` | Case-insensitive match on title and reference; `%` and `_` treated literally; injection string returns 0 rows and no error |
| E-4.15 | B3 | — | `?from=2024-01-01&to=2026-10-30` (over 24 months), `?from=2026-10-30&to=2026-01-01` | 400 each |
| E-4.16 | B3, NFR-4.1 | B has a payment for service Plumbing | `?serviceId=<Plumbing>` as A | Only A's rows (filters never widen scope) |
| E-4.17 | FR-4.19 | Deleted artisan D, renamed service | History as A | D row: "Former artisan", no id; service name as stored at payment time, else "Other" |
| E-4.18 | B4 | Migrations run on PGlite | Query `pg_indexes` | Index on `payments(customer_id, paid_at)` exists; migration `down` removes it cleanly |
| E-4.19 | B2 vs B6 | P12 | Compare overview `spend.thisMonth`/`inEscrow` with analytics 12m October bucket / totals | Equal |
| E-4.20 | B10, AC-4.8 | Job title `=SUM(1+1)`, `@cmd`, a title with a comma and quotes | `GET /payments/history/export.csv` as A | 200, `Content-Type: text/csv`, `Content-Disposition` filename `jinva-payments-2026-10-30.csv`, `Cache-Control: no-store`; cells start with `'`; proper quoting |
| E-4.21 | B10 | Filter `serviceId=<Plumbing>` | Export | Only plumbing rows; same filter validation as B3 |
| E-4.22 | B10, NFR-4.2 | — | Export; inspect header row and cells | No forbidden columns; no artisan contact; no customer email in the file name |
| E-4.23 | B10, NFR-6.2 | Security-event repo | Export as A | One security event (user, time, IP, user agent, filters used), no row values |
| E-4.24 | B10 | — | Export as Artisan K / Admin / B with A's ids | 403, 403, B's own data only |

### 4.3 Frontend unit

| ID | Covers | Steps | Expected |
|---|---|---|---|
| FU-4.1 | FR-4.1 | `parseRange()` with `30d`, `90d`, `12m`, `all`, `7d`, `<x>`, missing | Valid values kept; anything else → `12m` |
| FU-4.2 | FR-4.12 | Parse/serialise history filters from the URL (status list, serviceId, artisanProfileId, search) | Round-trips; invalid ids dropped; search cut to 100 chars; unknown statuses dropped |
| FU-4.3 | FR-4.19, NFR-7.2 | Format 1,250,000.00 in compact mode and full mode | "GH₵ 1.25M" and "GH₵ 1,250,000.00" |
| FU-4.4 | NFR-7.5 | Customer status labels for every payment status | Existing labels unchanged (e.g. TRANSFER_FAILED → "Withheld"); PENDING → "Awaiting payment"; no raw enum names |
| FU-4.5 | FR-4.9 | Chart text summary for a series | Plain sentence with highest month and total |

### 4.4 Browser

Route: `/dashboard/user/report`.

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| BR-4.1 | AC-4.1, §4.1 | Customer A | Open sidebar (at 390 open the mobile menu) | "Spending" entry after "My Bookings"; opens `/dashboard/user/report`; header title and page `h1` "Spending"; the old redirect to Bookings no longer happens |
| BR-4.2 | FR-4.1 | — | Change period to each option | URL `?range=30d|90d|12m|all`; every card and chart refetches with that range; reload keeps the range |
| BR-4.3 | AC-4.2, FR-4.3 | P30 fixture | Pick "Last 30 days" | Net spent GH₵ 1,500.00, In escrow GH₵ 500.00 with "Held safely until you confirm the job is done", Refunded GH₵ 300.00, Payments count and average; failed row in history, greyed |
| BR-4.4 | FR-4.3 | `all` | Select All time | No "vs previous period" change line |
| BR-4.5 | FR-4.4, AC-4.6 | 12m fixture | Hover a column; tap on touch; Tab to a column | Tooltip/announcement shows month, amount and count; keyboard focus is visible on the column |
| BR-4.6 | FR-4.9, NFR-2.7, AC-4.6 | — | Click "View as table" on each chart | Table with the same numbers as the fixture; toggle back restores the chart |
| BR-4.7 | FR-4.5 | 8 services | Load | Horizontal ranked bars, top 6 + Other, amount and %; no pie chart |
| BR-4.8 | FR-4.6, FR-4.19 | 7 artisans incl. D | Load; click "Show all" | Top 5 with photo, name, total, job count, last paid; "Show all" reveals the rest; D shown as "Former artisan" without link and with initials; other names link to public profiles; no phone/email anywhere on the page |
| BR-4.9 | FR-4.7 | Channels incl. null | Load | Card / Mobile money / Bank / Other with amount and % |
| BR-4.10 | FR-4.8 | — | Load | "Your largest payment: GH₵ 2,400.00 for Rewire 3-bedroom flat on 12 Aug 2026."; job title rendered as text |
| BR-4.11 | FR-4.10, NFR-2.4, NFR-8.2 | Light and dark | Snapshot charts; axe contrast; read computed colours | Charts use `--chart-1..5`; labels ≥ 4.5:1 (axis/large ≥ 3:1) in both modes |
| BR-4.12 | FR-4.11, FR-4.13 | 20+ rows | Load at 1440 and 390 | Desktop table with all FR-4.11 columns; at 390 stacked cards with expandable details (reference, paid at, released at); pagination 20 per page |
| BR-4.13 | AC-4.3, FR-4.12 | — | Select service Plumbing; then status; then search; then "Clear all filters" | URL updated each time; live region announces "N payments"; "Clear all filters" appears only when a filter is set and removes all; focus returns to the results heading |
| BR-4.14 | FR-4.14, AC-4.8 | Export fixture | Click "Download CSV" | `download` event; suggested filename `jinva-payments-2026-10-30.csv`; request carries the current filters |
| BR-4.15 | FR-4.15, NFR-1.3 | Analytics delayed 2 s | Load; record CLS | Skeletons for cards, charts, rows; CLS < 0.1 |
| BR-4.16 | AC-4.4, FR-4.16 | Customer N | Load | Empty state text and "Post a job"; no chart `svg` elements |
| BR-4.17 | FR-4.17 | 30d empty, all-time has data | Pick 30 days; click "Show all time" | "No spending in the last 30 days"; button switches to `range=all` |
| BR-4.18 | FR-4.18 | Analytics 500, history 200 (and reverse) | Load | Failing block shows "Try again"; the other works |
| BR-4.19 | FR-4.19 | Net 1,250,000.00 at 360 | Load | Card does not overflow; shows full or "GH₵ 1.25M" with the exact value in tooltip and accessible name |
| BR-4.20 | NFR-1.2 | 390 throttled | Load Overview then Spending; list chunks | Chart library chunk only loaded on Spending; cards visible < 2.5 s, charts < 3.5 s (Lighthouse, §8.1) |
| BR-4.21 | NFR-4.6 | Job title `<img src=x onerror=alert(1)>` in history and largest payment | Load | Literal text shown; no dialog |
| BR-4.22 | §9 small fixes | — | Visit `/dashboard/user/bookings` | Header title "My Bookings" |

---

## 5. Settings → Payments (FR-5.1 to FR-5.10, B5)

### 5.1 Backend unit

| ID | Covers | Steps | Expected |
|---|---|---|---|
| BU-5.1 | FR-5.7 | Build Paystack `channels` for preferred `mobile_money`, `card`, `null` | `mobile_money` first then the rest of today's allowed list; `card` first; `null` → exactly today's value (or omitted, same as today) |
| BU-5.2 | FR-5.7, AC-5.6 | Settings repository throws in `initializePayment` | Payment still initialised with today's channels; error logged without personal data |
| BU-5.3 | B5 DTO | Validate PATCH bodies: `{preferredChannel:"bank_transfer"}`, `{userId:5}`, `{momoNetwork:"VODAFONE"}`, `{}` | 400, 400, 400 (or mapped per design), `{}` valid no-op |
| BU-5.4 | B5 mapping | GET with no row | `preferredChannel:null`, `momo:null`, `receiptEmail` = account email |
| BU-5.5 | NFR-6.2 | Change preferredChannel | Security event written with field names only (`["preferredChannel"]`), no values |
| BU-5.6 **[Q6]** | FR-5.5, AC-5.3 | Normalise and validate `024 123 4567`, `0241234567`, `+233241234567`, `0201234567` with MTN, `02412345` | First three → `+233241234567`; Telecel prefix with MTN rejected ("doesn't look like an MTN number"); short rejected |
| BU-5.7 **[Q6]** | FR-5.5, NFR-5.2 | Mask `+233241234567` | `+233 24 *** **67` |
| BU-5.8 **[Q6]** | NFR-5.2 | Save number; inspect entity column and logger calls | Column value is ciphertext (not containing the digits); logger never receives the number |
| BU-5.9 **[Q6]** | FR-5.5 | Change number without / with wrong `currentPassword` | 400/401 per auth convention; correct password succeeds and queues the notice email (mail mocked) |

### 5.2 API e2e

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| E-5.1 | B5 | Customer A, no settings row | `GET /users/me/payment-settings` | 200 default shape; no row created by GET |
| E-5.2 | B5, FR-5.3 | — | `PATCH {preferredChannel:"mobile_money", momoNetwork:"MTN"}`; GET | Row created; GET returns the saved values |
| E-5.3 | AC-5.5 | — | `PATCH {preferredChannel:"card", userId:<B>}` | 400; nothing changed for A or B |
| E-5.4 | NFR-4.1 | B has settings | GET/PATCH as A | Only A's row read/written |
| E-5.5 | NFR-4.1 | — | GET/PATCH as Artisan K, Admin; no token | 403, 403, 401 |
| E-5.6 | FR-5.8, NFR-4.4 | Customer S (suspended) | GET; PATCH | GET 200; PATCH 403 with the existing suspended error |
| E-5.7 | NFR-4.4 | Throttler override small | PATCH limit+1 times | 429 on the last; GET unaffected |
| E-5.8 | FR-5.7, AC-5.2 | A prefers mobile_money; Paystack client mocked | `POST /payments/initialize` for an accepted job | Mock called with `channels` starting `mobile_money` and containing every channel sent today |
| E-5.9 | FR-5.7 | No preference | Initialize | Paystack payload identical to `main` (snapshot) |
| E-5.10 | AC-5.6 | Settings repository forced to throw (provider override) | Initialize | 201 as today |
| E-5.11 | NFR-5.3 | A has settings (+ number if Q6) and security events | Run the account-purge job for A | Settings row and A's security events purged per policy; B's untouched |
| E-5.12 | NFR-4.2, AC-5.4 | — | GET/PATCH responses, walked recursively | No full number, no authorization codes |
| E-5.13 **[Q6]** | AC-5.3 | — | PATCH `{momoNetwork:"MTN", momoNumber:"+233201234567"}` | 400, nothing saved |
| E-5.14 **[Q6]** | FR-5.5 | Saved number | PATCH new number without password; with password; `momoNumber:null` with password | 400/401; 200 + mail mock called with A's account email; 200 and `momo.numberMasked` gone |
| E-5.15 **[Q6]** | NFR-5.2 | — | PATCH a number; read the raw column via the test DataSource; capture logs | Raw value does not contain the digits; no log line contains them |

### 5.3 Browser

Route: `/dashboard/user/settings?tab=payments`.

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| BR-5.1 | AC-5.1, FR-5.1, FR-5.2 | — | Open the old link `?tab=payments` | Payments tab open; banner "Your payment history has moved to Spending" with "Go to Spending" (navigates to `/dashboard/user/report`); sections in order: Preferred method, Mobile money details, Receipts, Payment protection; no payment list |
| BR-5.2 | FR-5.1 | — | Dismiss banner; reload; open in a new context | Hidden after reload (same browser); visible in a fresh context; storage access wrapped so a blocked `localStorage` does not break the tab |
| BR-5.3 | FR-5.3 | — | Load; check Save disabled; pick Mobile money; Save | Save disabled until a change; PATCH body contains only changed fields; toast "Payment preferences saved"; Save disabled again |
| BR-5.4 | FR-5.4 | — | Network radios | Logos with text labels (MTN, Telecel, AirtelTigo); keyboard arrows move selection |
| BR-5.5 | FR-5.6, AC-5.7 | — | Read all page text | Helper text as specified; no wording such as "saved card", "one-tap", "card on file", "we'll fill in your number" |
| BR-5.6 | FR-5.8 | GET 500 | Load | "Couldn't load your payment settings · Try again"; Receipts and Payment protection still show |
| BR-5.7 | FR-5.8 | PATCH 400 with a server message | Save | Inputs keep the user's values; message shown |
| BR-5.8 | FR-5.8 | Suspended user fixture | Load | Settings readable; Save disabled with the explanation |
| BR-5.9 | FR-5.10 | Unsaved change | Click the Profile tab; then browser back; then a sidebar link | "Discard changes?" each time; Cancel stays, Discard leaves |
| BR-5.10 | §5.1 Receipts | — | Click the Receipts link | Goes to Notifications tab with the "Payment receipts" switch in view; email shown is the account email |
| BR-5.11 | AC-5.2 (contract smoke, BR-C) | Staging/e2e backend with Paystack test mode stubbed | Save Mobile money; start paying a job | Initialize request returns a checkout URL; the request sent to the Paystack stub has `mobile_money` first (asserted on the stub, not on the real Paystack page) |
| BR-5.12 **[Q6]** | FR-5.5, AC-5.3, AC-5.4 | — | Enter `0201234567` with MTN; then `024 123 4567`; save; reload | Inline error, no request; then saved and shown only as `+233 24 *** **67` with Change/Remove; full number never in DOM, `localStorage`, or the stored user object |
| BR-5.13 **[Q6]** | FR-5.5 | Saved number | Change → password dialog; wrong password; right password | Error then success; dialog traps focus and returns it (NFR-2.9) |
| BR-5.14 | NFR-3, NFR-8.2 | 7 widths × light/dark | Snapshot | No overflow; radio cards ≥ 44px tall on phones |

---

## 6. Bell and envelope: read in place (FR-6.1 to FR-6.20)

### 6.1 Frontend unit

| ID | Covers | Steps | Expected |
|---|---|---|---|
| FU-6.1 | §6.5 | `mapNotification()` on the §6.5 item | Keeps `payload` and original `createdAt` |
| FU-6.2 | FR-6.8, FR-6.9, NFR-4.6 | `notificationAction()` for: `{jobId:812}`, `{bookingId:301}`, `{conversationId:44}`, payment type with `{paymentId:4471}`, `{}`, `{jobId:"812/../../admin"}`, `{jobId:-1}`, `{url:"https://evil.example.com"}` | "View job" → `/dashboard/user/jobs/812`; booking and conversation equivalents; "View payment" → an internal path; no action for empty, non-integer, negative or URL-only payloads; every href starts with `/dashboard/user/` |
| FU-6.3 | FR-6.2, NFR-7.3 | Full date for 2026-10-30T14:14:00Z | "Thu 30 Oct 2026, 2:14 pm" |
| FU-6.4 | FR-6.16 | Unread line for n = 1, 2, 3 | none; "2 unread messages · Open conversation to read all"; "3 …" |
| FU-6.5 | FR-6.17 | `shouldMarkReadOnExpand(unread)` for 0, 1, 3 | false, true, false |

### 6.2 API e2e (existing endpoints, regression for the new use)

| ID | Covers | Steps | Expected |
|---|---|---|---|
| E-6.1 | §6.5 | Create a 600-char message from Artisan K to A; `GET /messages?page=1&limit=50` as A | `lastMessage.content` is the full 600 chars |
| E-6.2 | FR-6.11 | Same message; `GET /notifications?page=1&limit=5` as A | Notification body cut to 100 chars |
| E-6.3 | §6.5 | `GET /notifications` | Items include `body`, `payload`, `createdAt` |
| E-6.4 | FR-6.10, NFR-4.1 | `PATCH /notifications/:id/read` as A on B's notification | 404 (not 403), B's item still unread |
| E-6.5 | FR-6.17 | `PATCH /messages/:conversationId/read` as A on a conversation A is not part of | 403/404 per existing contract; nothing changes |
| E-6.6 | B8 (Could) | `GET /notifications/:id` own, other's, missing | 200; 404; 404 |

### 6.3 Browser

Header on any customer page. Popover at ≥ 640, bottom sheet below.

| ID | Covers | Preconditions | Steps | Expected |
|---|---|---|---|---|
| BR-6.1 | AC-6.1, FR-6.2, FR-6.9 | Notifications N | Open bell; click the dispute item | Expands in place: full sentence, "Thu 30 Oct 2026, 2:14 pm", "View job" → `/dashboard/user/jobs/812`; header row (icon, title, time) still visible; line breaks kept (`white-space: pre-line`) |
| BR-6.2 | AC-6.2, FR-6.10 | Item unread, badge 3 | Expand and wait 1.2 s; reload | `PATCH /notifications/9021/read` sent once; badge 2 immediately; after reload still read |
| BR-6.3 | FR-6.10 | — | Expand and collapse within 500 ms | No read request; still unread |
| BR-6.4 | FR-6.10 | PATCH returns 500 | Expand, wait 1.2 s | Badge goes back up; item unread; no error toast |
| BR-6.5 | AC-6.3, FR-6.1 | — | Expand item 1; click item 2; click item 2 again | Item 1 collapses, item 2 opens; then item 2 collapses; at most one `aria-expanded="true"` |
| BR-6.6 | FR-6.11 | Message notification (cut) | Expand | Ends with "…" and "Open conversation" |
| BR-6.7 | FR-6.9 | Empty payload; `payload.url` only | Expand each | No action button; no anchor with an external host anywhere in the popover |
| BR-6.8 | AC-6.6, FR-6.8 | Body `<img src=x onerror=alert(1)>`; title with `<b>` | Expand | Literal text visible; no `img` element in the popover; no dialog; text containing `https://example.com` is not a link |
| BR-6.9 | FR-6.12 | 8 notifications | Open bell | 5 shown, "View all notifications" and "Mark all as read" work as today |
| BR-6.10 | FR-6.13 | Loading / empty / 500 | Open bell each way | Skeleton rows; "You're all caught up"; "Couldn't load notifications · Try again" with working retry |
| BR-6.11 | FR-6.5 | 2,000-char message at 1440×900 and 360×740 | Expand | Text area scrolls internally when > ~240px; list max 70% of viewport height; popover/sheet bottom never below the viewport |
| BR-6.12 | AC-6.4, FR-6.14 | Conversations M | Open envelope; click the 600-char conversation | Row no longer navigates; expanded text has all 600 chars (compare `textContent`); "Open conversation" → thread; "Reply" → thread with the reply box focused |
| BR-6.13 | FR-6.14 | Latest message mine | Expand | Prefixed "You:"; full time |
| BR-6.14 | FR-6.15 | Latest is a photo | Expand | "📷 Photo" and "Open conversation to view"; no image request made (assert via `page.on('request')`) |
| BR-6.15 | AC-6.5, FR-6.16, FR-6.17 | 3 unread | Expand, wait 2 s | "3 unread messages · Open conversation to read all"; no read PATCH sent; still unread after reopening |
| BR-6.16 | FR-6.17 | 1 unread | Expand, wait 1.2 s | `PATCH /messages/:id/read` sent; badge drops |
| BR-6.17 | FR-6.18 | Deleted contact | Expand | "Deleted user"; "Open conversation" present, no "Reply" |
| BR-6.18 | FR-6.19 | Clock control (`page.clock`) | Expand a conversation; advance 30 s with a new message arriving in another conversation | Expanded item stays open and in the same position (bounding box unchanged); new order applied after closing and reopening; polling interval still 30 s |
| BR-6.19 | FR-6.7 | — | Expand an item; close popover; reopen | Nothing expanded |
| BR-6.20 | AC-6.7, FR-6.6 | 360 and 390, touch | Tap bell; tap envelope | Bottom sheet (drawer) opens; expanded items fully readable; sheet traps focus; swipe/close button closes; focus returns to the icon |
| BR-6.21 | AC-6.8, FR-6.4, NFR-2.9 | Keyboard only, 1440 | Tab to bell, Enter; Tab/arrow to item; Enter; Tab to "View job"; Escape; Escape | Item has `aria-expanded` + `aria-controls` pointing at the region; focus stays on the item after expanding; Tab reaches "View job"; first Escape collapses (focus on item), second closes the menu (focus on bell) |
| BR-6.22 | FR-6.3, NFR-2.6 | Default and reduced motion | Expand | ~200 ms height transition by default; with reduced motion the region is at full height on the next frame |
| BR-6.23 | NFR-1.5 | — | Expand; measure from click to visible text | < 100 ms; no network request made by expanding (other than the delayed read PATCH) |
| BR-6.24 | NFR-3 | 7 widths × light/dark | Expanded state snapshot | Popover ≥ 640, sheet < 640; no overflow; dark mode contrast passes axe |

---

## 7. Small fixes bundled (§9 of requirements)

| ID | Covers | Steps | Expected |
|---|---|---|---|
| BR-7.1 | Header title | Visit `/dashboard/user/bookings` | "My Bookings" (also BR-4.22) |
| BR-7.2 | Support FAQ | `grep -ri "plumbify\|10% platform fee" src` in CI; visit Support | No matches; wording as approved by the owner |
| BR-7.3 | Settings split | Visit every Settings tab before/after split at 390 and 1440 | Visual snapshots match `main` except Payments and Profile changes; every tab still saves (Notifications switches, Security password change, etc.) |

---

## 8. Non-functional tests

### 8.1 Performance (NFR-1)

| ID | Covers | How | Pass |
|---|---|---|---|
| P-1 | NFR-1.1 | Lighthouse CI (mobile preset, 4× CPU, "Fast 4G" ~9 Mbps/170 ms) on `/dashboard/user` with fixtures, 5 runs, median | LCP < 2.5 s; TBT low enough that a filter tap responds (INP-proxy < 200 ms) |
| P-2 | NFR-1.1 | Same with "Slow 4G/3G" | First skeleton painted < 1.5 s (FCP) |
| P-3 | NFR-1.2 | Lighthouse on `/dashboard/user/report` | Cards LCP < 2.5 s; charts rendered (custom mark) < 3.5 s |
| P-4 | NFR-1.3 | CLS from P-1 and P-3 plus BR-2.15/BR-4.15 | < 0.1 |
| P-5 | NFR-1.8, NFR-1.2 | Compare `next build` route sizes with `main` | Overview first-load JS growth ≤ 25 KB gzipped; chart library not in Overview chunks |
| P-6 | NFR-1.6 | Backend load test on staging (k6 or autocannon) with P500 per customer, 20 VUs, 2 min, realistic customer data only; data removed afterwards | p95: summary < 150 ms, overview < 300 ms, analytics < 500 ms, paginated history < 300 ms |
| P-7 | NFR-1.6, B4 | `EXPLAIN ANALYZE` of the history and analytics queries on staging with P500 | Uses the `payments(customer_id, paid_at)` index; no sequential scan on `payments` |
| P-8 | NFR-1.7 | BR-2.16 | No new polling |

### 8.2 Accessibility (NFR-2)

| ID | Covers | How | Pass |
|---|---|---|---|
| A-1 | NFR-2.1 to 2.4 | axe (WCAG 2.2 AA) on: Overview (no filter, filter on, filtered empty, error), rail states, Settings Profile, Remove dialog, Settings Payments, Spending (data, empty, table view), bell and envelope expanded, bottom sheet; light and dark | 0 serious/critical violations |
| A-2 | NFR-2.1 | Keyboard walk-through script per page (BR-1.20, BR-3.10, BR-4.5, BR-6.21) | Every interactive control reachable, logical order, focus ring ≥ 2px and ≥ 3:1 (computed style check), focused element never covered by the sticky header (`elementFromPoint` at the focus box centre returns the focused element) |
| A-3 | NFR-2.5 | Script measuring every `button, a, [role=radio], input` at 360/390 | ≥ 44×44 on phones (exceptions listed and approved by design); ≥ 24×24 everywhere |
| A-4 | NFR-2.6 | Run BR-1.19, BR-6.22 and chart animations with reduced motion | No animations running |
| A-5 | NFR-2.8 | 1280 viewport at 200% zoom (`deviceScaleFactor` + CSS zoom) and 320 px width | No content loss, no two-dimensional scroll except the history table if designed as such |
| A-6 | NFR-2.2, 2.7 | Manual screen-reader pass: NVDA + Firefox (desktop), TalkBack + Chrome (Android), VoiceOver + Safari (iOS) | Filter/result announcements, chart summaries and tables, disclosure states read correctly |
| A-7 | NFR-2.9 | BR-3.12, BR-5.13, BR-6.20 | Focus trapped and returned |

### 8.3 Responsive (NFR-3)

| ID | How | Pass |
|---|---|---|
| R-1 | For each changed page at all 7 widths: assert `document.documentElement.scrollWidth <= innerWidth` | Pass everywhere |
| R-2 | Layout assertions: 768 rail cards side by side; 1024 sidebar visible, no rail; 1280 rail; 1920 < 120px band | As NFR-3 table |
| R-3 | Visual snapshots (light/dark) at all widths, reviewed against `02-design` | Approved by design |

### 8.4 Security (NFR-4)

| ID | Covers | How | Pass |
|---|---|---|---|
| S-1 | NFR-4.1, NFR-4.8 | IDOR suite: for each new `/me` route and each new filter param, customer A tries B's ids | Never B's data; another user's resource id → 404 |
| S-2 | NFR-4.1 | Route inventory test: enumerate Nest routes added in v2, assert each has `JwtAuthGuard`, `RolesGuard` and `Role.CUSTOMER` metadata (except B1 any signed-in user) | All guarded |
| S-3 | NFR-4.2, NFR-4.8 | Forbidden-field test on every new/changed response (E-2.2, E-4.7, E-4.22, E-5.12) | No forbidden key or value |
| S-4 | NFR-4.3 | Validation fuzz: unknown fields, oversize `limit`/`search`, bad enums, bad dates, SQL metacharacters | 400; no 500; parameterised queries (grep: no template strings inside `.where(`/`query(` in new code) |
| S-5 | NFR-4.4, NFR-4.8 | Throttler tests E-2.6, E-4.8, E-5.7; `NotSuspendedGuard` on writes (E-5.6) | Pass |
| S-6 | NFR-4.5 | Code check: no card fields in DTOs/entities; Paystack hosted checkout only | Pass |
| S-7 | NFR-4.6, NFR-4.8 | XSS rendering tests BR-1.11, BR-4.21, BR-6.8; lint rule / grep: no `dangerouslySetInnerHTML` in changed files | Pass |
| S-8 | NFR-4.7 | Request any page; read headers | `Content-Security-Policy` present with `frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; app still loads (no CSP console violations on the changed pages, Paystack redirect still works) |
| S-9 | B10 | E-4.20 formula injection | Pass |
| S-10 | B1 | E-3.6 `profilePicture` lockdown | Pass |

### 8.5 Privacy (NFR-5)

| ID | Covers | How | Pass |
|---|---|---|---|
| PR-1 | NFR-5.1 | If Q6 = no: no `momo_number` column in the migration; DTO rejects `momoNumber` | Pass |
| PR-2 | NFR-5.2 **[Q6]** | E-5.15, BU-5.8, BR-5.12 | Encrypted, masked, absent from logs and stored user object |
| PR-3 | NFR-5.3 | E-5.11 purge test extended to new tables | Pass |
| PR-4 | NFR-5.4 | Review: spending endpoints not called by any marketing/admin job | No such caller |

### 8.6 Observability (NFR-6)

| ID | Covers | How | Pass |
|---|---|---|---|
| O-1 | NFR-6.1 | e2e with a log capture: call each new endpoint, including an error case | Latency logged; log lines contain no email, phone, `momoNumber`, `authorization` values |
| O-2 | NFR-6.2 | E-4.23 and BU-5.5 | Security events with fields, not values; retention setting 12 months |
| O-3 | NFR-6.3 | Browser: force 500 on each new endpoint with the error monitor stubbed | One report per failure, no request body |
| O-4 | NFR-6.4 | Browser: stub the analytics sink; perform each action | Events fired with the listed names and properties; no personal data (only if the analytics setup exists) |

### 8.7 Localisation (NFR-7)

| ID | How | Pass |
|---|---|---|
| L-1 | Run the browser suite with `timezoneId: 'America/New_York'` and `locale: 'en-US'` for one pass | Dates and month boundaries still Ghana time and `en-GB` format (bucket labels, "Today"/"Tomorrow", full dates) |
| L-2 | FU checks for `formatCurrency` on 0, 0.5, 1234, 1250000 | "GH₵ 0.00", "GH₵ 0.50", "GH₵ 1,234.00", "GH₵ 1,250,000.00" |
| L-3 | Text scan of the rendered changed pages | No raw enum names (`PENDING_TRANSFER`, `IN_PROGRESS`, …), correct plurals |

### 8.8 Compatibility and quality (NFR-8)

| ID | How | Pass |
|---|---|---|
| C-1 | Playwright Chromium/WebKit/Firefox (§0.1) plus a manual smoke on Samsung Internet (Android) and Edge | Pass |
| C-2 | Frontend `npm run verify` (colours, redirect, phone, new FU scripts, lint, build) | Green |
| C-3 | Backend `npm run lint`, typecheck, `npm test`, `npm run test:e2e` (full suites, not only new specs) | Green |
| C-4 | No new UI library in `package.json` (Playwright and axe as dev dependencies only) | Pass |

---

## 9. Regression risks for existing behaviour

| # | Risk | Why it could break | Guard |
|---|---|---|---|
| R1 | **Job page and pay page** read `GET /payments/history` as an unpaginated array | B3 adds pagination and fields | E-4.9 snapshot; browser smoke of `/dashboard/user/jobs/[id]` and `/jobs/[id]/pay` with the no-param response; AC-4.7 |
| R2 | **Artisan earnings** page uses a parallel artisan history endpoint | Shared mapper or DTO changes could leak into it | Existing artisan earnings e2e; snapshot of its response keys; visual smoke of `/dashboard/artisan/earnings` |
| R3 | **Artisan and admin analytics** ranges | Adding `12m` to the shared range helper/enum | BU-4.6: artisan still `7d|30d|90d|all`, admin still `7d|30d|90d|1y`; `analytics-admin-disputes.e2e-spec.ts` and platform cache specs green |
| R4 | `GET /jobs/mine` single-status callers (My Jobs page, Overview) | Changing `status` parsing to a list | E-1.8 snapshot; My Jobs page filters still work (browser smoke) |
| R5 | **Paystack initialise** | Adding `channels` ordering | E-5.9 payload snapshot with no preference; `job-payment-flow.e2e-spec.ts` green; webhook/verify untouched |
| R6 | `PATCH /users/me` | Locking down `profilePicture` | `settings-payloads.e2e-spec.ts` green; profile save of name/phone still works; upload flow still sets the photo |
| R7 | **Avatar everywhere** (header, messages, artisan views of the customer) | Null photo after removal | Initials fallback checked in header, message thread and an artisan's job-applicant view |
| R8 | **Notifications popover** "Mark all as read", "View all", badge count | Converting rows to disclosures | BR-6.9; `messaging-notifications.e2e-spec.ts` green |
| R9 | **Messages popover navigation** | Rows no longer navigate | "Open conversation" covers it; Messages page itself unchanged |
| R10 | **Message read state** | Auto-read on expand | FR-6.17 tests ensure multi-unread conversations stay unread |
| R11 | Settings **tab routing** (`?tab=` with `router.replace`) and other tabs | Splitting the 1,000-line page | BR-7.3; old `?tab=payments`, `?tab=notifications`, `?tab=security` links |
| R12 | **Booking Preferences** removal | Removing switches someone relied on | Confirm with owner (Q12); none were persisted, so no data loss |
| R13 | `/dashboard/user/report` **redirect** | Replacing redirect with a page | Old bookmarks land on Spending; no redirect loop; artisan has no access (customer-only layout guard) |
| R14 | Overview `data-swap` animation and `summarise()` | New counts source | BR-1.19, FU-1.5 |
| R15 | **Account purge** | New tables with FKs to users | E-5.11; `account-closeout.qa.e2e-spec.ts` and purge specs green |
| R16 | **Rate limits** | New named throttlers interacting with global/default ones | `rate-limit-error-contract.e2e-spec.ts` and `auth-rate-limit.e2e-spec.ts` green; 429 body shape unchanged |
| R17 | **Hermetic guard** | New code calling Paystack/S3 at import time or in tests | `hermetic-guard.e2e-spec.ts` green; new specs mock all externals |
| R18 | **Migrations** | New table and index | Migration up/down on PGlite in e2e setup; `migration:run` dry run on a staging copy before release |
| R19 | **CSP headers** (NFR-4.7) | Blocking Paystack redirect, fonts, avatars from CDN, analytics | S-8 plus a manual payment run in Paystack test mode on staging |
| R20 | **Dark mode / colour tokens** | New components with raw colours | `npm run check:colors` in verify |

---

## 10. Traceability summary

| Requirement | Unit | API e2e | Browser / NFR |
|---|---|---|---|
| FR-1.1 | FU-1.1 | — | BR-1.4, BR-1.5 |
| FR-1.2 | BU-1.1 | E-1.1 | BR-1.1 |
| FR-1.3 | — | — | BR-1.2, BR-1.3 |
| FR-1.4 / 1.5 | FU-1.3 | — | BR-1.2, BR-1.6 |
| FR-1.6 / 1.7 | FU-1.6 | E-1.5, E-1.6 | BR-1.7, BR-1.8, BR-1.9 |
| FR-1.8 | FU-1.2 | — | BR-1.10, BR-1.11 |
| FR-1.9 / 1.10 | FU-1.4 | — | BR-1.20 |
| FR-1.11 | FU-1.5 | — | BR-1.1 |
| FR-1.12 to 1.16 | — | — | BR-1.13 to BR-1.16 |
| FR-1.17 / 1.18 / 1.19 | — | E-1.9 | BR-1.18, BR-1.17, BR-1.19 |
| FR-2.1 to 2.3 | — | — | BR-2.1 to BR-2.5, BR-2.18 |
| FR-2.4 | FU-2.5, BU-2.1, BU-2.2 | E-2.1 | BR-2.6 to BR-2.8 |
| FR-2.5 | FU-2.1, FU-2.2, BU-2.3, BU-2.4 | — | BR-2.9 |
| FR-2.6 | FU-2.3, FU-2.4, BU-2.5 to 2.8 | E-2.5, E-2.7 | BR-2.10 to BR-2.12 |
| FR-2.7 / 2.8 / 2.9 / 2.10 | BU-2.9 | E-2.2 | BR-2.13 to BR-2.17 |
| FR-3.1 to 3.4 | — | — | BR-3.1 to BR-3.4 |
| FR-3.5 / 3.7 | — | E-3.7 | BR-3.5, BR-3.6, BR-3.10 |
| FR-3.6 | BU-3.1 to 3.3 | E-3.1 to E-3.5 | BR-3.7, BR-3.8, BR-3.9, BR-3.12 |
| FR-3.8 | — | — | BR-3.11 |
| B1 hardening | BU-3.4 | E-3.6 | — |
| FR-4.1 / 4.2 | FU-4.1, BU-4.1 to 4.4, BU-4.6 | E-4.1 to E-4.4 | BR-4.2, BR-4.3 |
| FR-4.3 to 4.10 | BU-4.5, 4.7 to 4.11, FU-4.5 | E-4.2 | BR-4.4 to BR-4.11 |
| FR-4.11 to 4.13 | BU-4.13, BU-4.14, FU-4.2, FU-4.4 | E-4.9 to E-4.17 | BR-4.12, BR-4.13 |
| FR-4.14 / B10 | BU-4.15 | E-4.20 to E-4.24 | BR-4.14 |
| FR-4.15 to 4.19 | BU-4.9, FU-4.3 | E-4.17 | BR-4.15 to BR-4.19 |
| B4 | — | E-4.18 | P-7 |
| FR-5.1 / 5.2 | — | — | BR-5.1, BR-5.2 |
| FR-5.3 / 5.4 / 5.6 | BU-5.3, BU-5.4 | E-5.1 to E-5.4 | BR-5.3 to BR-5.5, BR-5.10 |
| FR-5.5 [Q6] | BU-5.6 to 5.9 | E-5.13 to E-5.15 | BR-5.12, BR-5.13 |
| FR-5.7 | BU-5.1, BU-5.2 | E-5.8 to E-5.10 | BR-5.11 |
| FR-5.8 / 5.10 | — | E-5.6 | BR-5.6 to BR-5.9 |
| FR-6.1 to 6.8 | FU-6.2, FU-6.3 | — | BR-6.1, BR-6.5, BR-6.7, BR-6.8, BR-6.11, BR-6.19 to BR-6.22 |
| FR-6.9 to 6.13 | FU-6.1, FU-6.2 | E-6.2 to E-6.4 | BR-6.1 to BR-6.4, BR-6.6, BR-6.9, BR-6.10 |
| FR-6.14 to 6.20 | FU-6.4, FU-6.5 | E-6.1, E-6.5 | BR-6.12 to BR-6.18 |
| NFR-1 to NFR-8 | — | — | §8 (P-, A-, R-, S-, PR-, O-, L-, C-) |

---

## 11. Notes for the team

- The frontend has no component test runner today. This plan keeps logic in small pure modules (stage parsing, link building, formatters, masking) so they are covered by `FU-` scripts in the existing `node --experimental-strip-types` style, and covers rendering in Playwright. Adding Vitest/Testing Library is optional and not assumed.
- Playwright is new to the repo. Proposed layout: `jinva-frontend-web/e2e/` with `fixtures/` (fictional JSON from §0.3), a `mockApi()` helper around `page.route()` that fails any unmocked API call, and projects per viewport/engine. CI runs it after `next build`.
- Backend e2e fixtures must be created through the existing helpers in `test/helpers/test-data.ts` inside the PGlite database and are discarded with it. Nothing in this plan writes to a shared or staging database except the performance run P-6/P-7, which uses realistic fictional data and removes it afterwards.
- Throttler tests override limits through config in the test module, never by sleeping.
