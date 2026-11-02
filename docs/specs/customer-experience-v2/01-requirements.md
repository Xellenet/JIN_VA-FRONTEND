# Customer Experience v2: Requirements

| | |
|---|---|
| **Document** | 01-requirements (product requirements, functional and non-functional) |
| **Owner** | Product management |
| **Status** | Draft, awaiting product owner review |
| **Date** | 30 October 2026 |
| **Applies to** | Customer (client) side of JinVa. Frontend: `jinva-frontend-web` (Next.js 15, React 19, Tailwind 4). Backend: `JIN_VA-BACKEND` (NestJS 11, TypeORM, Postgres). |
| **Next step** | UI/UX design (`02-design`) is produced from this document and presented for approval. No development starts before that approval. |

All people, numbers and emails in this document are fictional.

---

## 0. Overview

### 0.1 Why we are doing this

Customers use JinVa to post jobs, book artisans and pay through Paystack. The dashboard does the basics, but six things get in the way:

1. The job stages on the Overview (Open, In progress, Completed, Closed) already filter the list, but this is not obvious. A selected stage looks almost the same as an unselected one, and the reset button says "Show all stages", which reads like a display option rather than "clear the filter". The counts are also **wrong** for customers with more than 10 jobs, because the page only loads the 10 newest jobs.
2. On large monitors the Overview uses about two thirds of the screen and leaves a wide empty strip on the right.
3. On phones, the profile photo buttons ("Upload new photo", "Remove") overflow their card. "Remove" also does nothing at all.
4. Customers cannot see how much they have spent, on what, with whom, or when. The only record is a flat payment list hidden in Settings.
5. Settings → Payments shows that payment list instead of payment settings. A "Save Payment Method" switch elsewhere in Settings promises a feature that does not exist.
6. In the bell (notifications) and envelope (messages) menus, long items are cut to one line. To read them the customer has to leave the page.

### 0.2 Goals

- **G1. Clear filtering:** a customer always knows whether the job list is filtered, by what, and how to clear it, in one tap.
- **G2. Correct numbers:** every count and total the customer sees is correct for their whole account, not a sample.
- **G3. Useful wide screens:** the space on large monitors shows what the customer needs to act on next.
- **G4. Spending insight:** a customer can answer "how much have I spent, on what, with whom, and when" in under 10 seconds, and find any single payment.
- **G5. Honest payment settings:** Settings → Payments only offers settings that really change what happens at checkout or on receipts.
- **G6. Read in place:** a customer can read a full notification or latest message from the header without leaving the current page.
- **G7. Works on a phone first:** everything above works on a 360px wide Android phone on mobile data.

### 0.3 Non-goals (v2)

- Saved cards / one-tap payment with a stored card (deferred to a later phase with its own security review; see §5).
- Replying to messages from the envelope menu (open question Q9).
- Selecting several stages at once (open question Q1).
- Budgets, spending alerts or forecasts.
- Artisan or admin screens. Their behaviour must not change.
- PDF invoices with tax details (we are not a VAT-invoicing system).
- Translation into languages other than English.

### 0.4 Personas

**P1. Ama, on her phone in Accra.**
Ama Owusu, 34, runs a small catering business in Dansoman. She uses a mid-range Android phone (about 390px wide, 4 GB RAM) on MTN mobile data that drops to slow 3G/4G in parts of the city. She pays with MTN Mobile Money. She checks JinVa between tasks, often one-handed, and wants to know "is my plumber coming today, and have I paid?" She is careful with data bundles and leaves if a page sits blank.

**P2. Kwame, at his desk.**
Kwame Mensah, 46, is the facilities manager for a group of rented flats in East Legon. He books electricians, plumbers and cleaners for several properties, mostly on a 27-inch monitor (1920 × 1080 or wider) and pays by card. He has dozens of jobs. He needs to see what is waiting on him, and at the end of each month he needs to know what he spent, on which trades and with which artisans, to report to the landlords.

### 0.5 Terms used in this document

| Term | Meaning |
|---|---|
| **Stage** | One of the four Overview filters. Open = job status `OPEN`. In progress = `PENDING` or `IN_PROGRESS`. Completed = `COMPLETED`. Closed = `CANCELLED` or `EXPIRED`. (This matches the code today.) |
| **Spend / net spend** | Money that has left the customer through JinVa, minus any refunds. Exact rule in FR-4.2. |
| **In escrow** | Paid by the customer and held by JinVa, not yet released to the artisan. |
| **Rail** | The right-hand column on the Overview at wide screens (item 2). |
| **Popover** | The small menu that opens from the bell or envelope icon in the header. |
| **Must / Should / Could** | Priority. Must = needed for v2 release. Should = expected in v2, can slip one sprint. Could = only if time allows. |

### 0.6 Delivery order

1. Backend endpoints in the "Must" list (B1–B6 in §8) and the design approval run in parallel.
2. Frontend items 1, 3 and 6 can start straight after design approval (item 1 needs B7 for correct counts; item 6 needs no backend work).
3. Items 2, 4 and 5 start when their endpoints are on the staging API.

---

## 1. Overview: job stage filters

**Where:** `src/app/dashboard/user/page.tsx`, `src/components/dashboard/job-track.tsx`.

### 1.1 User story

As a customer, when I tap a stage such as "In progress", I want it to be obvious that I am now looking only at those jobs, how many there are, and how to go back to everything, so that I never mistake a filtered list for my full list.

### 1.2 Functional requirements

**Selecting and clearing**

- **FR-1.1** The four stage stops (Open, In progress, Completed, Closed) act as a **single-select filter**. Selecting a stop shows only jobs in that stage. Selecting a different stop replaces the filter. Selecting the selected stop again clears it (current behaviour, kept).
- **FR-1.2** Each stop shows its count for the customer's **whole account** (all pages, not just the newest 10). Counts come from the summary endpoint (§1.4). A stop with a count of 0 is still selectable and leads to the filtered empty state (FR-1.12).
- **FR-1.3** The selected stop must look clearly different from the others **without relying on colour alone**: a filled background or solid outline, a check mark or filled dot, bold label, and a contrast ratio of at least 3:1 against the unselected stops' outline. The unselected stops are visibly "dimmed but available" while a filter is on.
- **FR-1.4** When a filter is on, a **filter summary bar** appears directly above the list, reading for example: "Showing **In progress** jobs only · 4 results". It contains:
  - an "active filter" chip with the stage name and an × button (accessible name "Remove filter: In progress");
  - a **"Clear filter"** text button (replaces "Show all stages"). It is placed in the same spot every time so it does not jump. It returns the list to "Recent jobs".
  - Wording rule: the button says "Clear filter" while only one filter is possible. If Q1 adds multi-select, it becomes "Clear all filters".
- **FR-1.5** The list heading changes with the filter: "Recent jobs" (no filter) or "In progress jobs" etc. (filter on). The count in the summary bar matches the stop's count.
- **FR-1.6** When no filter is on, the list shows the 5 most recent jobs with a "See all jobs" link to My Jobs (current behaviour, kept).
- **FR-1.7** When a filter is on, the list shows the first **10** jobs in that stage, newest first. If there are more, a "Show more" button loads the next 10 (no full page reload). After 50 jobs, the list shows "See all {stage} jobs in My Jobs" instead, linking to My Jobs with the same filter applied.
- **FR-1.8** The filter is kept in the URL as `?stage=open|in_progress|completed|closed` using `router.replace` (no new history entry per tap, matching how Settings tabs work). Reloading the page or sharing the URL restores the filter. Any other value is ignored and treated as "no filter"; the value is never printed into the page or sent raw to the API.

> Security note: Agreed. Parse `stage` with a single helper that returns one of the four literals or `null` (`parseStage`), and use that result for the label, the API call and the analytics event. The raw query string value must not reach the DOM, the API or analytics (SEC-19).

- **FR-1.9** Keyboard: Tab reaches the stage group; each stop is a button with `aria-pressed`; Enter/Space toggle. After "Clear filter" or the chip × is used, focus moves to the list heading so keyboard users are not lost.
- **FR-1.10** Screen readers: a polite live region announces each change, e.g. "Showing 4 in progress jobs" or "Filter cleared, showing 5 recent jobs".
- **FR-1.11** The header summary sentence at the top of the Overview (currently built by `summarise`) uses the same account-wide counts, so it is correct for customers with more than 10 jobs.

**States**

- **FR-1.12 Loading:** stage stops show skeleton counts; the list shows 3 skeleton rows. Stops are not clickable until counts arrive (max 1 s skeleton before showing stops with "–" counts and allowing selection).
- **FR-1.13 Empty (no jobs at all):** the stages show 0 and the list shows "You have not posted a job yet" with a "Post a job" button. The summary bar is hidden.
- **FR-1.14 Filtered empty:** "No {stage} jobs right now" with a short hint ("Jobs move here when …" per stage) and the "Clear filter" button repeated inside the empty state.
- **FR-1.15 Error:** if counts fail, the stops still work (counts show "–") and a small inline message offers "Try again". If the job list fails, the list area shows an error with "Try again"; the filter stays selected.
- **FR-1.16 Partial:** if counts load but the list fails (or the reverse), each part shows its own state; one failure never blanks the whole page.

**Edge cases**

- **FR-1.17** If a job changes stage while the page is open (for example after the customer confirms completion), counts and list refresh after the action returns, and the filter stays as it was.
- **FR-1.18** Rapid taps: only the last selected stage's results are shown (earlier requests are cancelled or ignored).
- **FR-1.19** The list must not animate on first load, only after a user action (keep the existing `data-swap` + counter approach), and not at all under reduced motion.

### 1.3 Data needed

- Count of the customer's jobs per status, across all their jobs.
- Jobs list filtered by one or more statuses, paginated.

### 1.4 Backend contract

**B7a. `GET /jobs/mine/summary`** (new, CUSTOMER, scoped to the caller)

```json
{
  "message": "Job summary retrieved",
  "data": {
    "byStatus": { "OPEN": 3, "PENDING": 1, "IN_PROGRESS": 2, "COMPLETED": 27, "CANCELLED": 4, "EXPIRED": 1 },
    "byStage": { "open": 3, "in_progress": 3, "completed": 27, "closed": 5 },
    "total": 38
  }
}
```

**B7b. `GET /jobs/mine?status=PENDING,IN_PROGRESS&page=1&limit=10`** (change to existing)

- `status` accepts one value (unchanged) **or** a comma-separated list of `Status` values; each value is validated against the enum. Unknown values return 400.
- Response unchanged, with the existing `pagination` meta (`page`, `limit`, `total`, `totalPages`). The frontend must read it with `apiFetchWithMeta`.
- Backward compatible: callers that send one status or none get exactly what they get today.

> Security note: Agreed. In addition, split the list on commas, trim, drop duplicates, and accept at most 6 values (the size of the `Status` enum); a longer list returns 400. Each value is bound as a query parameter (`IN (:...statuses)`), never concatenated. The owner filter stays `customer_id = :me` from the token (SEC-1, SEC-23).


### 1.5 Acceptance criteria

- **AC-1.1** *Given* I have 38 jobs, 27 of them completed, *when* I open the Overview, *then* the Completed stop shows 27 (not a number capped by the newest 10).
- **AC-1.2** *Given* no filter is on, *when* I tap "In progress", *then* the stop looks selected (not by colour alone), a bar shows "Showing In progress jobs only · 3 results" with a chip and "Clear filter", the heading reads "In progress jobs", and the URL ends with `?stage=in_progress`.
- **AC-1.3** *Given* the In progress filter is on, *when* I tap "Clear filter" (or the chip ×, or the selected stop), *then* the bar disappears, the heading reads "Recent jobs", the URL has no `stage`, and focus is on the list heading.
- **AC-1.4** *Given* I use a screen reader, *when* I select Closed, *then* I hear "Showing 5 closed jobs".
- **AC-1.5** *Given* I open `/dashboard/user?stage=completed`, *then* the Completed filter is already on. *Given* I open `?stage=<script>`, *then* no filter is on and nothing from the value appears on the page.
- **AC-1.6** *Given* I have 0 open jobs, *when* I select Open, *then* I see "No open jobs right now" with a "Clear filter" button inside the empty state.
- **AC-1.7** *Given* 23 completed jobs, *when* I filter Completed, *then* 10 show with "Show more"; after two taps all 23 show and "Show more" disappears.
- **AC-1.8** *Given* the summary endpoint fails, *then* the stops show "–", the list of recent jobs still loads, and "Try again" reloads the counts.

---

## 2. Overview: right rail on large monitors

**Where:** `src/app/dashboard/user/page.tsx` (content is `max-w-5xl`, left-aligned, so about 600px is empty at 1920px).

### 2.1 User story

As a customer on a large monitor, I want the space next to my jobs to tell me what needs my attention, when my next appointment is, and how my spending is going, so that I can act without opening other pages.

### 2.2 What goes in the rail, and why

We chose three cards, in this order, because each answers a question customers ask on every visit and each leads to an action:

1. **Needs your action** (the most valuable). Counted items with direct links:
   - "Confirm completion" – jobs where the artisan asked to mark the job done (`completionRequestedAt` set, status `IN_PROGRESS`).
   - "Pay to start" – accepted jobs with an unpaid (`PENDING`) payment.
   - "Review applications" – open jobs with at least one new application.
   - "Unread messages" – conversations with unread messages.
2. **Next appointment.** The earliest upcoming booking with status `PENDING` or `CONFIRMED`: date, time window, service, artisan name and photo, and a link to the booking. Shows "Today" / "Tomorrow" where true.
3. **Spending snapshot.** Net spent this month, the change versus last month (e.g. "▲ GH₵ 420 vs September"), money currently in escrow, a small 6-month sparkline, and "View spending report" (item 4).

We do **not** put marketing, tips or "recommended artisans" here; the owner asked for data the user needs.

### 2.3 Functional requirements

- **FR-2.1 Layout:** at **≥ 1280px** viewport width the Overview becomes two columns: main column (fluid, max about 880px) and the rail (fixed 320–360px), with the whole content area centred or filling the available width so no large empty band remains at 1440 and 1920. At 1920px the empty space to the right of the rail must be under 120px.
- **FR-2.2 Smaller screens:** below 1280px there is no rail. "Needs your action" appears **above** the job list, and only when it has at least one item. "Next appointment" and "Spending snapshot" appear **below** the job list, side by side from 768px and stacked below 768px.
- **FR-2.3** The rail scrolls with the page (not sticky) unless the design shows a sticky version that does not cover content at 1280 × 720.
- **FR-2.4 Needs your action:** each row shows an icon, a short label, a count badge and goes to the right place (the job, the payment page, the applications list, or Messages). When there is one item of a kind, the row links straight to it; when there are several, it links to a filtered list. When everything is 0, the card shows a calm "You're all caught up" state (not hidden on wide screens, so the layout stays stable).
- **FR-2.5 Next appointment:** dates in `en-GB` ("Tue 4 Nov 2026"), times in 12-hour Ghana time ("9:00 am – 11:00 am", timezone `Africa/Accra`). No booking → "No upcoming appointments" with "Book an artisan". A booking missing a time shows the date only.
- **FR-2.6 Spending snapshot:** amounts as `GH₵ 1,234.00`. New customers with no payments see "Your spending will appear here after your first payment" and no chart. The comparison arrow is hidden when last month was 0. The sparkline has a text alternative (e.g. "Spending over the last 6 months, highest in August, GH₵ 2,150").
- **FR-2.7 Loading:** each card has its own skeleton of its final height (no layout shift, see NFR-1.3).
- **FR-2.8 Error / partial:** each card fails independently with "Couldn't load · Try again". One endpoint provides all three (below); if a single section is missing from the response (`null`), only that card shows its fallback.
- **FR-2.9 Freshness:** the rail refreshes when the page regains focus and after any action taken from it (e.g. confirming completion), at most once every 30 s.
- **FR-2.10 Privacy:** the rail shows artisan names and photos only, never phone numbers or emails.

### 2.4 Backend contract

**B6. `GET /customers/me/overview`** (new, CUSTOMER, scoped to the caller, one request for the whole rail)

```json
{
  "message": "Overview retrieved",
  "data": {
    "actionItems": {
      "completionsToConfirm": { "count": 1, "jobId": 812 },
      "paymentsDue": { "count": 1, "jobId": 815 },
      "applicationsToReview": { "count": 4, "jobId": null },
      "unreadMessages": 2
    },
    "nextBooking": {
      "id": 301,
      "scheduledDate": "2026-11-04",
      "startTime": "09:00",
      "endTime": "11:00",
      "status": "CONFIRMED",
      "service": { "id": 3, "name": "Plumbing" },
      "artisan": { "id": 57, "displayName": "Kofi Asante", "avatar": "https://cdn.example.com/avatars/57.webp" }
    },
    "spend": {
      "currency": "GHS",
      "thisMonth": "1840.00",
      "lastMonth": "1420.00",
      "inEscrow": "650.00",
      "last6Months": [
        { "month": "2026-05", "netSpent": "900.00" },
        { "month": "2026-06", "netSpent": "0.00" },
        { "month": "2026-07", "netSpent": "1200.00" },
        { "month": "2026-08", "netSpent": "2150.00" },
        { "month": "2026-09", "netSpent": "1420.00" },
        { "month": "2026-10", "netSpent": "1840.00" }
      ]
    }
  }
}
```

- `jobId` in an action item is set only when `count` is 1 (direct link); otherwise `null`.
- Money is a string with two decimals (as all money columns return today); the frontend converts with `Number()` and formats with `formatCurrency`.
- Spend figures use the same definition as the report (FR-4.2) so the two pages always agree.
- Month boundaries are calculated in `Africa/Accra` time (UTC+0, no daylight saving).
- Response never contains fees, payout or transfer fields, or artisan contact details.

### 2.5 Acceptance criteria

- **AC-2.1** *Given* a 1920 × 1080 window, *when* I open the Overview, *then* the rail shows next to the job list and there is no empty band wider than 120px on the right.
- **AC-2.2** *Given* a 390px phone and one completion to confirm, *then* "Needs your action" appears above the job list and "Next appointment" and "Spending snapshot" appear below it.
- **AC-2.3** *Given* one job awaiting my confirmation, *when* I click "Confirm completion" in the rail, *then* I go to that job's page.
- **AC-2.4** *Given* no payments yet, *then* the spending card shows the first-payment message and no chart.
- **AC-2.5** *Given* this month's net spend is GH₵ 1,840 and last month's GH₵ 1,420, *then* the card shows "GH₵ 1,840.00" and "▲ GH₵ 420.00 vs September", and the report page shows the same October total.
- **AC-2.6** *Given* the overview endpoint fails, *then* the job filters and list still work and each rail card offers "Try again".

---

## 3. Profile photo buttons on mobile

**Where:** `src/app/dashboard/user/settings/page.tsx` (Profile tab, "Profile Photo" card, around lines 421–473).

### 3.1 User story

As a customer on a phone, I want to change or remove my profile photo with buttons that fit my screen and actually work.

### 3.2 Functional requirements

- **FR-3.1 Phone layout (< 640px):** the card stacks vertically: avatar (96px) on top, then name, email, then the buttons. Buttons are full width or wrap onto their own lines; nothing overflows the card at 360px. Each button is at least 44 × 44px.
- **FR-3.2 Tablet and up (≥ 640px):** avatar on the left, text and buttons on the right (current layout), with the text column allowed to shrink (`min-w-0`) and the buttons allowed to wrap.
- **FR-3.3 Long text:** a long name or email (e.g. `oluwaseun.adebayo-mensah.facilities@example.com`) wraps or truncates with the full value available on hover/focus and to screen readers; it never pushes the card wider than the screen.
- **FR-3.4 Card padding** is reduced on phones (16px under 640px, 24px from 640px) for all Settings cards, so the content has room.
- **FR-3.5 Upload:** keeps the existing rules (JPEG, PNG or WebP, up to 5 MB). While uploading, the button shows a spinner and "Uploading…" and both buttons are disabled. On success the new photo appears everywhere (header avatar included) without a reload, with a "Photo updated" toast. On error, the message says what was wrong ("This file is larger than 5 MB").
- **FR-3.6 Remove (now real):**
  - Shown **only** when the customer has a photo.
  - Asks for confirmation in a dialog ("Remove your profile photo? Artisans will see your initials instead.") with "Remove photo" and "Cancel".
  - On success the avatar shows the customer's initials everywhere, with a "Photo removed" toast.
  - On failure the photo stays and an error toast offers "Try again".
- **FR-3.7** The camera icon on the avatar and the "Upload new photo" button do the same thing; the icon has an accessible name ("Change profile photo").
- **FR-3.8** The "Booking Preferences" card's switches are not saved anywhere today. The "Save Payment Method" switch is **removed** (it promises something that does not exist; see item 5). The other switches in that card are either wired to a real saved setting or removed; the design must not show controls that do nothing.

### 3.3 Backend contract

**B1. `DELETE /users/me/avatar`** (new, any signed-in user)

- Sets `profilePicture` to `null`, deletes the stored file (best effort; a failed file delete is logged, not shown to the user).
- Returns the updated user, same shape as `GET /users/me`:

```json
{ "message": "Profile photo removed", "data": { "id": 1042, "firstname": "Ama", "lastname": "Owusu", "email": "ama.owusu@example.com", "profilePicture": null } }
```

(other existing user fields omitted here for brevity; they are unchanged)

- **Hardening (same ticket):** `PATCH /users/me` must stop accepting any free-text `profilePicture` value (today any URL, including tracking links, can be set). Either remove the field from the DTO or only accept URLs from our own avatar storage.

> Security note: Agreed, and the preferred option is to **remove** `profilePicture` from `UpdateMeDto` (`src/users/dto/update-me.dto.ts`). The only way to set it should be `POST /uploads/avatar`. For `DELETE /users/me/avatar`, the file to delete is taken from the caller's stored `profilePicture`, and only when it resolves (after normalisation) inside our own `avatars` folder or storage host. Nothing from the request decides which file is deleted. Add `NotSuspendedGuard` (SEC-2, SEC-5).


### 3.4 Acceptance criteria

- **AC-3.1** *Given* a 360px wide screen, *when* I open Settings → Profile, *then* the photo card has no horizontal overflow and both buttons are fully visible and tappable.
- **AC-3.2** *Given* my email is 48 characters long, *then* it does not push the card wider than the screen.
- **AC-3.3** *Given* I have a photo, *when* I tap Remove and confirm, *then* my initials replace the photo in the card and in the header, and reloading the page still shows initials.
- **AC-3.4** *Given* I have no photo, *then* there is no Remove button.
- **AC-3.5** *Given* I choose a 7 MB file, *then* I see "This file is larger than 5 MB" and nothing is uploaded.
- **AC-3.6** *Given* Settings → Profile, *then* there is no "Save Payment Method" switch.

---

## 4. Spending report and payment history

### 4.1 Where it lives (decision)

**Decision: reuse the existing route `/dashboard/user/report`, titled "Spending" in the page and the sidebar.**

Why:
- The route already exists and the header already has a title mapping for `report`. Today it only redirects to Bookings, because the old page showed made-up numbers. Replacing the redirect with a real page fixes that history instead of leaving a dead route.
- Any old bookmarks to `/report` start working.
- A separate `/spending` route would add a second name for the same thing. If the owner prefers the URL `/dashboard/user/spending`, we add it and make `/report` redirect to it (open question Q4).

The customer sidebar gets a new entry, **"Spending"** (wallet/chart icon), placed after "My Bookings". The header title for this route becomes "Spending".

### 4.2 Spend definition (needs owner sign-off, Q3)

So that every total on every page agrees:

| Payment status | Counts as spent? | Shown in history? |
|---|---|---|
| `HELD` (paid, in escrow) | Yes, and counted as "In escrow" | Yes |
| `PENDING_TRANSFER`, `TRANSFER_FAILED` (being paid out to the artisan) | Yes, counted as "In escrow". Shown to customers with the existing "Withheld" label. | Yes |
| `RELEASED` (paid out to the artisan) | Yes | Yes |
| `REFUNDED` (full or partial) | Yes, minus the refunded amount | Yes |
| `PENDING` (checkout not finished) | No | Yes, as "Awaiting payment" |
| `FAILED`, `CANCELLED` | No | Yes, greyed |

- **Net spent** = sum of (`amount` − `refundedAmount`) over the counted statuses.
- A payment is dated by **when it was paid** (`paidAt`), in Ghana time.
- Platform fees are part of what the customer paid; the report shows only what the customer paid, and never splits out JinVa's fee or the artisan's share.

### 4.3 User story

As a customer, I want one page that shows how much I have spent on JinVa, on which services, with which artisans and over time, plus a searchable list of every payment, so that I can track my costs and find any receipt.

### 4.4 Functional requirements

**Period and filters**

- **FR-4.1** A period selector with: Last 30 days, Last 90 days, Last 12 months (default), All time. The chosen period is in the URL (`?range=12m`) and applies to every number and chart on the page.
- **FR-4.2** Totals and charts follow the spend definition in §4.2.

**Summary cards (top row)**

- **FR-4.3** Four cards: **Net spent** (with change vs the previous period of the same length, hidden for "All time"), **In escrow** (with a one-line explanation "Held safely until you confirm the job is done"), **Refunded**, **Payments** (count, and average per payment).

**Charts**

- **FR-4.4 Spending over time:** a column chart of net spent per bucket (day for 30 days, week for 90 days, month for 12 months and all time). Empty buckets show as 0 (from the server, not invented on the client). Hover/tap/keyboard focus on a column shows the bucket, amount and number of payments.
- **FR-4.5 Where (by service):** a ranked horizontal bar list of service categories with amount and share (%). Top 6 plus "Other". Not a pie chart (bars are easier to compare and read on phones).
- **FR-4.6 On whom (by artisan):** a ranked list of artisans with photo, name, total, number of jobs and "last paid" date. Top 5 with "Show all". Each artisan links to their public profile. No contact details.
- **FR-4.7 How (by method):** a simple split of card vs mobile money vs bank (amount and %). Payments where Paystack did not report a method show as "Other".
- **FR-4.8 Highlights:** a short line of plain facts, e.g. "Your largest payment: GH₵ 2,400.00 for *Rewire 3-bedroom flat* on 12 Aug 2026." No guessed advice.
- **FR-4.9** Every chart has a text alternative and a "View as table" toggle, so the data is available without the chart.
- **FR-4.10** Charts use the app's chart tokens (`--chart-1..5`) and `ChartContainer`, and work in light and dark mode.

> Security note: `ChartContainer`/`ChartStyle` in `src/components/ui/chart.tsx` builds a `<style>` tag with `dangerouslySetInnerHTML`, interpolating **the chart config keys and colours** into CSS. Config keys must therefore be static identifiers (`c1`…`c6`, `other`), and colours must be token references. Service names, artisan names or any other server text must never be used as config keys or colours. Labels are passed as data and rendered by Recharts as text (SEC-22).


**Payment history (bottom of the page; moved from Settings)**

- **FR-4.11** A paginated list (20 per page) of all payments, newest first, with: date paid, job title (links to the job), service, artisan, method, amount, refunded amount (if any), status badge (existing customer labels, unchanged), and reference.
- **FR-4.12** Filters: status (multi-select), service, artisan, and a search box (job title or reference, max 100 characters). Filters are in the URL. A "Clear all filters" button appears when any is set, and the result count is announced to screen readers.

> Security note: Search must escape the SQL `LIKE` wildcards (`%`, `_`, `\`) and use an `ESCAPE` clause with a bound parameter. A `serviceId` or `artisanProfileId` the customer has never paid simply narrows the customer's own rows to an empty page. It must never return 404 or 403, which would let someone probe whether ids exist (SEC-3, SEC-23).

- **FR-4.13** On phones the list becomes stacked cards (keep the current mobile card pattern with expandable details for reference, paid at and released at).
- **FR-4.14 Export (Should):** "Download CSV" exports the history for the current filters. File name `jinva-payments-2026-10-30.csv` (no names or emails in the file name).

> Security note: I disagree with putting export under the analytics throttler alone. Export gets its own stricter throttler (`customer-export`, about 5 per 10 minutes per user), a row cap of 10,000 with a 24-month maximum range (otherwise 400 with "Narrow the date range"), a streamed response, `Content-Disposition: attachment`, `Cache-Control: no-store`, and a `spending_report.exported` security event (filters only). Formula neutralisation applies to **every** text cell (job title, service, artisan name, reference), not only the job title, and also to cells starting with a tab (`0x09`) or carriage return (`0x0D`) (SEC-25, SEC-27, SEC-29).


**States**

- **FR-4.15 Loading:** skeletons for cards, charts and table rows in their final sizes.
- **FR-4.16 Empty (no payments ever):** a friendly empty state ("You haven't made any payments yet. When you pay for a job, you'll see where your money goes here.") with "Post a job". Charts are not drawn.
- **FR-4.17 Empty period:** "No spending in the last 30 days" with a button to switch to "All time".
- **FR-4.18 Error / partial:** the analytics block and the history list load and fail independently, each with "Try again".
- **FR-4.19 Edge cases:**
  - Deleted artisan → "Former artisan", no link, initials avatar.
  - Deleted or renamed service → the name stored at the time if available, else "Other".
  - A payment refunded in a later period counts against the period it was paid in (dated by `paidAt`), and the refund is shown on that row.
  - Very large totals (e.g. GH₵ 1,250,000.00) must fit the summary cards at 360px (wrap or shorten to "GH₵ 1.25M" with the exact value in a tooltip and for screen readers).

### 4.5 Backend contract

**B2. `GET /analytics/customer?range=30d|90d|12m|all`** (new, CUSTOMER, scoped to the caller; reuses the artisan analytics range/bucket helper; `12m` is added to the allowed ranges)

```json
{
  "message": "Spending analytics retrieved",
  "data": {
    "range": "12m",
    "bucket": "month",
    "currency": "GHS",
    "totals": {
      "netSpent": "14820.00",
      "grossPaid": "15420.00",
      "refunded": "600.00",
      "inEscrow": "650.00",
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
      { "artisanProfileId": 57, "displayName": "Kofi Asante", "avatar": "https://cdn.example.com/avatars/57.webp", "netSpent": "4100.00", "count": 5, "lastPaidAt": "2026-10-18T10:22:00.000Z" }
    ],
    "byChannel": [
      { "channel": "mobile_money", "netSpent": "9020.00", "count": 13 },
      { "channel": "card", "netSpent": "5800.00", "count": 6 }
    ],
    "largestPayment": { "id": 4471, "jobId": 790, "jobTitle": "Rewire 3-bedroom flat", "amount": "2400.00", "paidAt": "2026-08-12T14:05:00.000Z" }
  }
}
```

- `previousPeriodNetSpent` is `null` for `all`.
- `series` contains every bucket in the range (zeros filled on the server).
- Rate limited (named throttler `customer-analytics`, about 30 requests/min per user); may be cached per user for up to 60 s (cache key includes the user id).

> Security note: The cache key is `customer-analytics:{userId}:{normalised params}`, and the response carries `Cache-Control: private, no-store` so that no proxy or CDN stores one customer's totals. The cache is in-process or Redis with a TTL of 60 s or less, and is never keyed by params alone (SEC-26).


**B3. `GET /payments/history`** (existing, extended, backward compatible)

- **With no query parameters:** returns exactly today's unpaginated array (two existing pages depend on it), with the new fields below **added** to each row.
- **With any of** `page`, `limit` (max 100, default 20), `status` (comma list), `from`, `to` (ISO dates, range at most 24 months), `serviceId`, `artisanProfileId`, `search` (max 100 chars): returns a paginated result with `pagination` meta.

```json
{
  "message": "Payment history retrieved",
  "data": [
    {
      "id": 4471,
      "reference": "JINVA-7F3K2Q",
      "jobId": 790,
      "job": { "id": 790, "title": "Rewire 3-bedroom flat" },
      "bookingId": null,
      "service": { "id": 5, "name": "Electrical" },
      "artisan": { "id": 57, "displayName": "Kofi Asante", "avatar": "https://cdn.example.com/avatars/57.webp" },
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
  ],
  "pagination": { "page": 1, "limit": 20, "total": 19, "totalPages": 1 }
}
```

- Never returned: `platformFee`, `artisanAmount`, transfer codes/references, `accessCode`, `authorizationUrl`, fraud flags, artisan phone/email/payout details.

**B10. `GET /payments/history/export.csv`** (Should): same filters as B3, owner only, `Cache-Control: no-store`, cells starting with `= + - @` prefixed with `'` to block spreadsheet formula injection.

> Security note: See the note on FR-4.14. Also extend AC-4.8 with an artisan display name that starts with `@` and a reference that starts with a tab character.


**B4. Database index** `payments(customer_id, paid_at)` (migration) so the report stays fast for customers with many payments.

### 4.6 Acceptance criteria

- **AC-4.1** *Given* I am a customer, *when* I open the sidebar, *then* I see "Spending", and it opens `/dashboard/user/report` titled "Spending".
- **AC-4.2** *Given* payments of GH₵ 1,000 (released), GH₵ 500 (held), GH₵ 300 (refunded GH₵ 300) and GH₵ 200 (failed) in the last 30 days, *when* I pick "Last 30 days", *then* Net spent is GH₵ 1,500.00, In escrow is GH₵ 500.00, Refunded is GH₵ 300.00, and the failed payment appears in the history but not in any total.
- **AC-4.3** *Given* I select "Plumbing" in the history service filter, *then* only plumbing payments show, the URL contains the filter, the count is announced, and "Clear all filters" removes it.
- **AC-4.4** *Given* I have never paid, *then* I see the empty state and no charts.
- **AC-4.5** *Given* I am customer A, *when* I call any spending endpoint with any parameters, *then* I only ever receive my own payments; *given* an artisan or admin token, *then* the customer endpoints return 403.
- **AC-4.6** *Given* the 12-month chart, *when* I tab to a column, *then* its month, amount and count are read out; *when* I choose "View as table", *then* the same numbers show as a table.
- **AC-4.7** *Given* the existing job page and pay page that read `/payments/history`, *then* they keep working unchanged after B3 ships.
- **AC-4.8** *Given* a job title that starts with `=SUM(`, *when* I export CSV, *then* the cell starts with `'=SUM(`.

---

## 5. Settings → Payments: payment settings and details

**Where:** `src/app/dashboard/user/settings/page.tsx`, tab `?tab=payments`.

### 5.1 What we can truthfully offer (decision)

Facts from the code today:
- Customers pay through **Paystack's hosted checkout** (card or mobile money). JinVa never sees card numbers.
- JinVa stores **nothing** about how a customer pays, other than which method was used on each past payment.
- Paystack lets us **order or limit** the payment methods shown at checkout (`channels`). On the hosted checkout, it does **not** let us fill in the customer's mobile money number for them; Paystack asks for it each time.
- Saving a card for later ("card on file") is possible with Paystack, but requires storing a token that can charge the card. That needs encryption, a security review and a new "pay with saved card" flow.

**Therefore v2 (Phase A) offers only:**

| Setting | What it really does | Backend work |
|---|---|---|
| **Preferred payment method** (Mobile money / Card) | Paystack checkout opens with that method first. Other methods remain available. | New (B5) |
| **Mobile money network** (MTN, Telecel, AirtelTigo) | Used for the right logo and wording on the pay page, and shown in the saved details. | New (B5) |
| **Mobile money number** (Could, see Q6) | Stored for reference and shown masked. We will **not** claim it skips entering the number at checkout. Only built if Q6 says yes. | New (B5) |
| **Receipts** | Read-only: "Receipts are sent to ama.owusu@example.com" with a link to the existing "Payment receipts" switch in the Notifications tab (not duplicated). | None |
| **Payment details and protection** | Read-only information: payments are processed by Paystack; card details never reach JinVa; how escrow works (paid → held → released when you confirm); how refunds work; link to Support. | None |
| **Payment history** | Moved. A banner: "Your payment history has moved to Spending" with a "Go to Spending" button. | None |

**Not in v2 (Phase B, later, separate security review):** saved cards, one-tap payment, a separate receipt email address (needs email verification to prevent receipts being redirected; see Q7).

### 5.2 User story

As a customer, I want to choose how I usually pay and see how my payments are handled, so that checkout is quicker and I trust where my money goes.

### 5.3 Functional requirements

- **FR-5.1** The tab is renamed **"Payments"** (unchanged label, new content) and contains the sections in §5.1, in this order: Preferred method, Mobile money details, Receipts, Payment protection, and the "history has moved" banner at the top for the first 60 days after release (or until dismissed; dismissal remembered per browser).
- **FR-5.2** Old links `?tab=payments` still open this tab.
- **FR-5.3 Preferred method:** a radio card group (Mobile money, Card, "No preference" default). Saving is explicit with a "Save changes" button that is disabled until something changes. Success toast "Payment preferences saved".
- **FR-5.4 Network:** a radio group with network logos. Required only if a mobile money number is entered.
- **FR-5.5 Number (only if Q6 = yes):**
  - Uses the existing phone input with the Ghana `+233` prefix; accepts `024 123 4567`, `0241234567` or `+233241234567`, saved as E.164.
  - Validated as 9 digits after `+233`, and the prefix must match the selected network (inline error: "This number doesn't look like an MTN number").
  - After saving, it is only shown masked (`+233 24 *** **67`) with "Change" and "Remove".
  - Changing it asks for the account password again (re-confirmation), and an email notice is sent to the account email.

> Security note: I partly disagree. Password re-confirmation does not work for accounts created with Google sign-in: `user.password` is `null` for them (`user.entity.ts`, G5). Those accounts must re-confirm with a 6-digit code sent to the account email instead. A wrong password or code counts towards the existing `auth-credentials` throttler and returns a generic "We couldn't confirm it's you" message. The email notice is sent for **add, change and remove**, never contains the number (masked only), and includes a "This wasn't me" link to Support. Security agrees with the PM's recommended Q6 = **No** for v2, and if Q6 stays No, this whole FR is out of scope (SEC-12, SEC-13, SEC-36).

- **FR-5.6 Honest copy:** helper text states what each setting does, for example: "We'll show Mobile Money first when you pay. You can still choose another method at checkout."
- **FR-5.7 Checkout effect:** when starting a payment, the backend orders Paystack's `channels` with the preferred method first and keeps every other allowed method. If no preference is set, checkout behaves as today. If the settings cannot be read, checkout still proceeds as today (never block payment).

> Security note: The backend builds `channels` from a server-side allowlist constant and only **reorders** it by `preferredChannel`. It never accepts a channel list, amount or callback URL from the client for this purpose, and an unknown stored value falls back to the default order (SEC-14).

- **FR-5.8 States:**
  - Loading: skeleton of the form.
  - Error loading: "Couldn't load your payment settings · Try again"; the information sections still show.
  - Error saving: the form keeps the user's input and shows the server message.
  - Suspended account: settings are readable but "Save" is disabled with an explanation.
- **FR-5.9** The "Save Payment Method" switch in Profile → Booking Preferences is removed (FR-3.8).
- **FR-5.10** Leaving the tab with unsaved changes asks "Discard changes?".

### 5.4 Backend contract

**B5. Customer payment settings** (new table `customer_payment_settings`, one row per customer, created on first save)

`GET /users/me/payment-settings` (CUSTOMER)

```json
{
  "message": "Payment settings retrieved",
  "data": {
    "preferredChannel": "mobile_money",
    "momo": { "network": "MTN", "numberMasked": "+233 24 *** **67" },
    "receiptEmail": "ama.owusu@example.com",
    "updatedAt": "2026-10-30T08:15:00.000Z"
  }
}
```

- `preferredChannel`: `"mobile_money" | "card" | null`. `momo`: `null` when not set. `receiptEmail` is the account email (read-only in v2). The full number is never returned.

`PATCH /users/me/payment-settings` (CUSTOMER, not suspended, throttled about 5/min)

```json
{ "preferredChannel": "card", "momoNetwork": "MTN", "momoNumber": "+233241234567", "currentPassword": "••••••" }
```

- All fields optional. Only these fields are accepted (unknown fields return 400). `currentPassword` is required only when `momoNumber` changes. `momoNumber: null` removes it.

> Security note: `currentPassword` (and the email code alternative in FR-5.5) must be excluded from logs, Sentry and the security-event record, and it is never returned. Validation error messages must not echo submitted values: class-validator's default messages do not, so no custom message may use `$value` (SEC-31).

- Returns the same shape as GET.
- The mobile money number is encrypted at rest, never logged, and erased by the account-purge job.
- Each change writes a security event (which fields changed, never the values).

**Change to `initializePayment`:** pass Paystack `channels` ordered by `preferredChannel` (all allowed channels kept).

### 5.5 Acceptance criteria

- **AC-5.1** *Given* I open `?tab=payments`, *then* I see payment settings and a banner linking to Spending, and no payment list.
- **AC-5.2** *Given* I save "Mobile money" as preferred, *when* I next pay for a job, *then* Paystack checkout opens on Mobile Money and I can still switch to Card.
- **AC-5.3** *Given* I enter `0201234567` with network MTN, *then* I see an error that the number does not match MTN, and nothing is saved.
- **AC-5.4** *Given* a saved number, *then* every screen and API response shows it masked only.
- **AC-5.5** *Given* a request with an extra field such as `userId`, *then* the API returns 400 and nothing changes.
- **AC-5.6** *Given* the settings service is down, *when* I pay, *then* checkout still works as it does today.
- **AC-5.7** *Given* the page, *then* nothing on it suggests that cards are saved or that payment is one-tap.

---

## 6. Bell and envelope: read in place

**Where:** `src/components/dashboard/notifications-popover.tsx`, `src/components/dashboard/messages-popover.tsx`, `src/lib/notifications.ts`.

### 6.1 User story

As a customer, when I open the bell or envelope and tap an item, I want it to open up right there so I can read the whole notification or message, and then choose to go to the related job or conversation.

### 6.2 Functional requirements: shared

- **FR-6.1** Each item is a **disclosure**: tapping it expands it in place, tapping it again collapses it. Only one item is open at a time in each menu (opening another closes the first).
- **FR-6.2** The item's header stays visible when expanded (icon, title/sender, time). The expanded area shows the full text with line breaks kept, the full date and time ("Thu 30 Oct 2026, 2:14 pm") and one or two action buttons.
- **FR-6.3** Expand/collapse uses a smooth height transition (about 200 ms); with reduced motion it opens instantly.
- **FR-6.4** Keyboard: items are buttons with `aria-expanded` and `aria-controls`; Enter/Space toggle; Tab moves into the action buttons; Escape collapses the open item first, and a second Escape closes the menu. Focus stays on the item when it expands.
- **FR-6.5** Long content: the expanded text area scrolls on its own if it is taller than about 240px, and the whole menu's list may grow to 70% of the screen height. The menu never grows taller than the screen.
- **FR-6.6 Phones (< 640px):** the bell and envelope open a **bottom sheet** (drawer) instead of a small popover, so expanded items have room. Same behaviour inside.
- **FR-6.7** Closing the menu collapses everything (nothing stays expanded for the next person who glances at the screen).
- **FR-6.8 Safety:** titles, bodies and messages are shown as plain text only. Links inside the text are not made clickable in v2. Action buttons are built from known ids only (job id, booking id, conversation id) and always point to pages inside `/dashboard/user/…`; never from a URL in the data.

> Security note: Agreed, and this is the main control for item 6. Also render each text block with `dir="auto"` and `unicode-bidi: isolate` (`[unicode-bidi:isolate]` in Tailwind) so that right-to-left override characters in a name or message cannot visually reorder amounts or names. Add `break-words` so a 2,000-character unbroken string cannot widen the popover (SEC-17, SEC-21).


### 6.3 Functional requirements: notifications (bell)

- **FR-6.9** The expanded notification shows the full `body` (already sent by the server in the list), the full date, and an action button by type, for example "View job" (`payload.jobId`), "View booking" (`payload.bookingId`), "Open conversation" (`payload.conversationId`), "View payment" for payment types. No button when there is no valid id.

> Security note: "View payment" must point to an internal route (`/dashboard/user/report?...` or the job's pay page) built from a numeric id, the same as the other buttons. All buttons come from one `notificationHref(type, payload)` function that accepts only positive safe integers and returns a path under `/dashboard/user/`, or `null`. Today the backend sets no `url`/`href` keys in `payload`, and the frontend must ignore them if they ever appear (SEC-18).

- **FR-6.10** Expanding an unread notification marks it as read (after it has been open for about 1 s, so fast scrolling past does not mark things read) and lowers the badge count straight away. If the server call fails, the item goes back to unread quietly.
- **FR-6.11** Message notifications contain only the first 100 characters of the message (server limit). They end with "…" and the button "Open conversation" to read the rest.
- **FR-6.12** The menu still shows the latest 5 and "View all notifications". "Mark all as read" stays.
- **FR-6.13 States:** loading skeleton rows; empty "You're all caught up"; error "Couldn't load notifications · Try again".

### 6.4 Functional requirements: messages (envelope)

- **FR-6.14** Each conversation row becomes a disclosure button (it no longer navigates on tap). Expanded, it shows the **full latest message** (the list already returns it in full, up to 2,000 characters), who sent it ("You:" if it was me), the full time, and the button **"Open conversation"** (and "Reply" which also opens the conversation with the reply box focused).

> Security note: Verified in code: `getConversations` in `src/messages/messages.service.ts` returns `lastMessage.content` in full, and the 100-character cut at line 459 applies only to the notification copy. So no new endpoint is needed, and none must be added. The same list item also carries `lastMessage.attachmentUrl`, which the popover must **never** put into `<img src>`, `href` or a fetch (see FR-6.15, SEC-20). Do not add further fields to the list response (SEC-9).

- **FR-6.15** If the latest message is a photo, show "📷 Photo" text with "Open conversation to view". The photo is not loaded in the menu.
- **FR-6.16** If the conversation has more than one unread message, show "{n} unread messages · Open conversation to read all" under the latest one.
- **FR-6.17 Read status:** expanding marks the conversation read **only if it has exactly one unread message** (the one now shown). With several unread, it stays unread until the conversation is opened, so nothing is silently skipped.
- **FR-6.18** A deleted contact shows "Deleted user" (existing behaviour) and no "Reply".
- **FR-6.19** Polling continues every 30 s; an incoming update must not collapse the item the user is reading or move it under their finger (re-order only when the menu is reopened).
- **FR-6.20 States:** as FR-6.13 with "No messages yet".

### 6.5 Backend contract

- **None required.** `GET /notifications?page=1&limit=5` already returns the full `body`, `payload` and `createdAt`; `PATCH /notifications/:id/read` exists. `GET /messages?page=1&limit=50` already returns `lastMessage.content` in full (checked in `messages.service.ts`; only the notification copy of a message is cut to 100 characters); `PATCH /messages/:id/read` exists (takes the conversation id).
- Frontend change: `mapNotification` must keep `payload` and the original `createdAt` (it currently drops them).
- **B8 (Could):** `GET /notifications/:id` (owner only, 404 otherwise) for deep links from emails.

Example list item already returned today:

```json
{ "id": 9021, "type": "DISPUTE_RESOLVED", "title": "Dispute resolved", "body": "Your dispute on 'Fix leaking kitchen tap' was resolved in your favour. A refund of GH₵ 150.00 has been sent to your original payment method and should arrive within 5 working days.", "isRead": false, "payload": { "jobId": 812 }, "createdAt": "2026-10-30T14:14:00.000Z" }
```

### 6.6 Acceptance criteria

- **AC-6.1** *Given* the dispute notification above, *when* I tap it in the bell menu, *then* I can read the full sentence, see "Thu 30 Oct 2026, 2:14 pm" and a "View job" button that opens job 812.
- **AC-6.2** *Given* it was unread, *when* it has been open for a second, *then* the badge count drops by one; reloading keeps it read.
- **AC-6.3** *Given* one item is open, *when* I tap another, *then* the first closes and the second opens.
- **AC-6.4** *Given* a conversation whose latest message is 600 characters, *when* I tap it in the envelope menu, *then* I read all 600 characters without leaving the page, and "Open conversation" takes me to the thread.
- **AC-6.5** *Given* a conversation with 3 unread messages, *when* I expand it, *then* it shows "3 unread messages" and stays unread.
- **AC-6.6** *Given* a notification body `<img src=x onerror=alert(1)>`, *then* it shows as that literal text and nothing runs.
- **AC-6.7** *Given* a 360px phone, *when* I tap the bell, *then* a bottom sheet opens and expanded items are fully readable.
- **AC-6.8** *Given* keyboard only, *then* I can open the menu, move to an item, expand it, reach "View job", collapse with Escape and close with Escape.

---

## 7. Non-functional requirements

### NFR-1 Performance

- **NFR-1.1** Overview: largest content shown in < 2.5 s and interactive (filters respond) in < 2.5 s on a mid-range Android (e.g. Moto G-class, 4× CPU slowdown in Lighthouse) over "Fast 4G" (about 9 Mbps, 170 ms). On "Slow 4G/3G" the skeleton appears in < 1.5 s.
- **NFR-1.2** Spending page: summary cards in < 2.5 s, charts in < 3.5 s on the same profile. Chart code is loaded only on that page (code-split); the Overview sparkline must not pull in the full charting bundle on phones (use a lightweight SVG sparkline).
- **NFR-1.3** Cumulative layout shift < 0.1 on every changed page (skeletons sized like the final content).
- **NFR-1.4** Filter tap to updated list: < 100 ms visual response (selected state) and < 1 s for results on 4G.
- **NFR-1.5** Expanding a notification/message: < 100 ms, no network wait (data already loaded).
- **NFR-1.6** API (p95 on staging with realistic data of 500 payments per customer): `/jobs/mine/summary` < 150 ms, `/customers/me/overview` < 300 ms, `/analytics/customer` < 500 ms, paginated `/payments/history` < 300 ms.
- **NFR-1.7** No new polling. The rail refreshes on focus, at most every 30 s.
- **NFR-1.8** New JavaScript added to the Overview route ≤ 25 KB gzipped.

### NFR-2 Accessibility (WCAG 2.2 AA)

- **NFR-2.1** Everything works with a keyboard alone, in a logical order, with a visible focus ring (at least 2px, 3:1 contrast) that is never hidden behind sticky headers (WCAG 2.4.11).
- **NFR-2.2** Filter changes and result counts are announced through a polite live region (§1, §4).
- **NFR-2.3** Selected and active states are never shown by colour alone.
- **NFR-2.4** Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI parts) in light and dark mode, including chart labels.
- **NFR-2.5** Touch targets ≥ 44 × 44px on phones (at least 24 × 24 everywhere, WCAG 2.5.8).
- **NFR-2.6** All motion respects `prefers-reduced-motion`; nothing flashes.
- **NFR-2.7** Every chart has a text summary and a table alternative.
- **NFR-2.8** Pages work at 200% zoom and at 320 CSS px width (reflow) without loss of content.
- **NFR-2.9** Dialogs and drawers trap focus and return it to the control that opened them.

### NFR-3 Responsive behaviour

Designs and tests cover these widths:

| Width | Device example | Notes |
|---|---|---|
| 360 | Small Android | Smallest supported. No horizontal scroll anywhere. |
| 390 | Mid-range Android / iPhone | Main phone design. |
| 768 | Tablet portrait | Rail cards below list, side by side. Sidebar collapsed. |
| 1024 | Tablet landscape / small laptop | Sidebar visible, no rail. |
| 1280 | Laptop | Rail appears. |
| 1440 | Desktop | Rail, comfortable spacing. |
| 1920 | Large monitor | Rail; no empty band wider than 120px. |

### NFR-4 Security

- **NFR-4.1** Every new customer endpoint uses `JwtAuthGuard` + `RolesGuard` with `Role.CUSTOMER`, takes the customer only from the signed-in user, never from a parameter, and filters in SQL (`WHERE customer_id = :me`). Another user's id returns 404, not 403.
- **NFR-4.2** Every response uses an explicit DTO. Never returned: platform fee, artisan amount, transfer or payout fields, Paystack access codes/URLs, fraud flags, artisan phone/email/bank details, full mobile money number, any Paystack authorization code.
- **NFR-4.3** Input validation with class-validator, `whitelist` and `forbidNonWhitelisted`; enums for `range`, `status`, `stage`; `limit` ≤ 100; `search` ≤ 100 characters; date ranges ≤ 24 months; all SQL parameterised.
- **NFR-4.4** Rate limits: `customer-analytics` (about 30/min/user) on analytics, overview and export; `payment-settings-write` (about 5/min/user) on settings writes; `NotSuspendedGuard` on writes.

> Security note: Amend as follows: export (B10) uses its own `customer-export` throttler (FR-4.14 note). The app has **no global throttler guard**, so every new route must attach `NamedThrottlerGuard` explicitly, and a test must assert that it is attached (SEC-25).

- **NFR-4.5** No card data ever touches JinVa (Paystack hosted checkout only, PCI SAQ-A).
- **NFR-4.6** User text (notifications, messages, job titles, names) is rendered as plain text; no `dangerouslySetInnerHTML`. Links built from typed ids only.
- **NFR-4.7** A Content Security Policy and security headers (`frame-ancestors 'none'`, `nosniff`, `strict-origin-when-cross-origin`) are added to the frontend (tracked as a separate ticket, should ship with or before v2).

> Security note: I disagree with "tracked as a separate ticket". The CSP is the defence-in-depth layer for item 6 (user text in the header menus on every page) and for item 5 (Paystack script/frame origins). It is a **release gate** for v2: ship it in Report-Only mode at least one week before v2, then switch to enforcing in the same release as items 5 and 6 (SEC-32).

- **NFR-4.8** Tests: a cross-customer (IDOR) test for every new `/me` route; a test that forbidden fields never appear in responses; an XSS rendering test for the popovers; throttler limit tests.

### NFR-5 Privacy (Ghana Data Protection Act, 2012 (Act 843))

- **NFR-5.1** Collect only what a feature uses (the mobile money number only if Q6 = yes).
- **NFR-5.2** Mobile money number encrypted at rest, masked in every response and screen, excluded from logs, error reports and the browser's stored user object.
- **NFR-5.3** New tables (payment settings, security events) are included in the account-purge job and its tests.

> Security note: Purge **deletes** the user's `account_security_events` rows as well. They hold IP addresses and user agents, which are personal data under Act 843. The only exception is a row linked to an open dispute or fraud review, kept until that case closes. Per-user analytics cache entries must expire (TTL of 60 s or less) or be evicted on purge (SEC-37).

- **NFR-5.4** Spending data is used only to show the customer their own report, not for marketing.
- **NFR-5.5** The privacy policy's payment section is reviewed for the new stored data (owner/legal task).

### NFR-6 Observability

- **NFR-6.1** Backend logs each new endpoint's latency and errors (no personal data in log lines; redact `momoNumber`, `email`, `phoneNumber`, `authorization*`).
- **NFR-6.2** Security events recorded for payment-settings changes and CSV exports (who, when, which fields, IP, user agent; never values), kept 12 months.
- **NFR-6.3** Frontend reports failures of the new endpoints to the existing error monitoring, without request bodies.
- **NFR-6.4** Product analytics events (no personal data): `overview_filter_selected {stage}`, `overview_filter_cleared {method: button|chip|stop}`, `rail_action_clicked {type}`, `spending_range_changed {range}`, `spending_export`, `payment_prefs_saved {fields}`, `header_item_expanded {kind}`. Only if the existing analytics setup allows it; otherwise listed for later.

> Security note: Event properties are limited to the enums shown. No amounts, ids, names, search text or reference numbers. `payment_prefs_saved {fields}` sends field **names** only (SEC-34).


### NFR-7 Localisation and formatting

- **NFR-7.1** Locale `en-GB`, timezone `Africa/Accra` for all dates and month boundaries.
- **NFR-7.2** Money always `GH₵ 1,234.00` via `formatCurrency` (two decimals in tables and totals; charts' axes may use whole cedis or "GH₵ 1.2k"; exact value in tooltips).
- **NFR-7.3** Dates: "30 Oct 2026" in lists, "Thu 30 Oct 2026, 2:14 pm" when expanded, relative ("2 h ago") only in compact rows, with the exact time available on hover/focus.
- **NFR-7.4** Pluralisation handled ("1 result", "4 results").
- **NFR-7.5** All copy in plain English that a first-time user understands; no internal status names (e.g. "PENDING_TRANSFER") shown to customers.

### NFR-8 Compatibility and quality

- **NFR-8.1** Latest two versions of Chrome (Android and desktop), Safari (iOS), Samsung Internet, Firefox and Edge.
- **NFR-8.2** Light and dark mode for every new screen.
- **NFR-8.3** Existing behaviour keeps working: existing frontend and backend test suites pass; the job page and pay page that read `/payments/history` are unchanged; artisan and admin screens unchanged.
- **NFR-8.4** New code passes typecheck and lint; new backend endpoints have unit and e2e tests.
- **NFR-8.5** Design uses existing tokens (`globals.css`), Geist font and the `src/components/ui` components; no new UI library.

---

## 8. Backend work list

| # | Item | For | Priority |
|---|---|---|---|
| B1 | `DELETE /users/me/avatar`; lock down `profilePicture` in `PATCH /users/me` | 3 | Must |
| B2 | `GET /analytics/customer` (+ `12m` range, server-filled buckets, throttler, per-user cache) | 4 | Must |
| B3 | `/payments/history` filters, pagination and extra fields (backward compatible) | 4 | Must |
| B4 | Index `payments(customer_id, paid_at)` | 4 | Must |
| B5 | `customer_payment_settings` table, `GET/PATCH /users/me/payment-settings`, `channels` order at checkout, purge + security events | 5 | Must |
| B6 | `GET /customers/me/overview` | 2 | Must |
| B7 | `GET /jobs/mine/summary`; multi-status filter on `/jobs/mine` | 1 | Must (fixes the wrong-counts bug) |
| B8 | `GET /notifications/:id` | 6 | Could |
| B9 | Saved cards (encrypted Paystack authorizations, pay with saved card) | 5 | Later, separate security review |
| B10 | CSV export of payment history | 4 | Should |

## 9. Small fixes to bundle (found during discovery)

- Header title for `bookings` says "My Jobs"; should be "My Bookings".
- Support FAQ (`support-page.tsx`) and mock data mention another brand ("Plumbify") and a "10% platform fee"; replace with JinVa wording confirmed by the owner.
- Split the 1,000+ line Settings page into one component per tab while moving the payment sections (no visible change).

---

## 10. Open questions for the product owner

| # | Question | Recommended default |
|---|---|---|
| **Q1** | Should customers be able to select **more than one** stage at once (e.g. Open + In progress)? | **No, single select.** It matches the "track" design and keeps the list simple. The button reads "Clear filter". If you want multi-select, it becomes "Clear all filters". |
| **Q2** | Should "Awaiting start" (`PENDING`) jobs count as **Open** or **In progress**? | **In progress** (as today): an artisan has been chosen, so it is no longer open to applications. |
| **Q3** | Do you approve the spend definition in §4.2 (held, being paid out, released and refunded payments count; refunds subtracted; unfinished and failed payments excluded)? | **Approve as written.** |
| **Q4** | Keep the URL `/dashboard/user/report` or change to `/dashboard/user/spending`? | **Keep `/report`**, labelled "Spending". |
| **Q5** | Which three cards in the Overview rail? | **Needs your action, Next appointment, Spending snapshot** (§2.2). |
| **Q6** | Should we store the customer's **mobile money number** even though Paystack's hosted checkout will still ask for it? | **No for v2.** Store only preferred method and network. Storing a number we cannot use adds privacy risk (Act 843) for no benefit. Revisit with saved payment methods. |
| **Q7** | Do customers need a **separate receipt email** (e.g. an accounts address)? | **Not in v2.** Receipts go to the account email. A separate address needs email verification and can come later. |
| **Q8** | Saved cards / one-tap pay: when? | **Later phase**, after a dedicated security review and demand check. Nothing in v2 suggests it exists. |
| **Q9** | Quick reply from the envelope menu? | **No for v2.** "Reply" opens the conversation with the reply box focused. |
| **Q10** | CSV export of payment history in v2? | **Yes (Should).** Useful for customers like Kwame who report spend to others. PDF receipts later. |
| **Q11** | Show the "history has moved" banner for how long? | **60 days or until dismissed.** |
| **Q12** | The other "Booking Preferences" switches in Profile (not saved today): wire them up or remove them? | **Remove** in v2 unless you confirm what each should do. |

> Security note: Security agrees with the recommended defaults for Q6 (no number stored), Q7 (no separate receipt email) and Q8 (saved cards later). Each of these, if changed to "yes", brings in the extra requirements in SEC-12, SEC-13 and SEC-15 respectively, and needs a security re-review before build.


---

## 11. Security requirements (security engineer)

| | |
|---|---|
| **Author** | Security engineering |
| **Status** | Draft, reviewed against the code on 30 October 2026 (read only; no code or data changed) |
| **Applies to** | Every item in this document (§1–§6), the backend work list (§8) and the NFRs in §7 |

Each requirement below is a **MUST** unless it is marked *Should*. Where a SEC requirement and an FR disagree, the SEC requirement applies until the product owner decides otherwise. Points of disagreement are marked inline in the sections above as "> Security note:". NFR-4 and NFR-5 remain and are refined here. Each requirement names how it is checked, so QA can turn it into a test.

### 11.1 Baseline found in the code (what we build on)

- **AuthN:** `JwtAuthGuard`. The access token is held in memory only and the refresh token is an httpOnly cookie. The frontend caches the user object in `sessionStorage`.
- **AuthZ:** `RolesGuard` with `@Roles(...)`. `NotSuspendedGuard` is on mutating routes. Existing customer routes already take the owner from `req.user.id`: `getMyHistory` filters `where: { customerId }`, and `verifyPayment` returns 404 when the caller does not own the payment.
- **Minimal shapes already in use:** `getMyHistory` and `getMyEarnings` hand-map their fields. The messages list exposes only id, name and photo for the other person (`toDisplayIdentity`).
- **Global `ValidationPipe`** with `whitelist: true, forbidNonWhitelisted: true, transform: true` (`src/main.ts`).
- **Throttling** uses named throttlers only (`message-send`, `auth-credentials`, `auth-email`, `dispute-write`) through `NamedThrottlerGuard`. **There is no global throttler guard**, so a new route has no rate limit unless one is added to it.
- **Audit:** `AdminAuditService` records admin actions only. Nothing records customer self-service security events.
- **Gaps:** no Content Security Policy in `next.config.ts` or `middleware.ts`. The artisan `payout_account_number` is plaintext. The only `dangerouslySetInnerHTML` is in `src/components/ui/chart.tsx`, and it interpolates chart config keys into CSS. On the positive side, the Paystack webhook stores nothing from the `authorization` object, so we hold **no reusable card tokens** today.

### 11.2 Authorisation and IDOR

- **SEC-1 Owner comes from the token only.** Every new or changed customer route (B2, B3, B5, B6, B7a, B7b, B10, and B1/B8 for any user) takes the owner from `req.user.id`. None of them accepts `customerId`, `userId` or any other owner identifier in the path, query or body. Ownership is applied **in SQL** (`WHERE customer_id = :me`), including inside every sub-query, CTE and join used for aggregates such as by-category, by-artisan or largest payment. Results are never fetched widely and filtered in memory afterwards. *Checked by:* code review and the SEC-6 tests.
- **SEC-2 Guards per route.**

  | Route | Guards | Throttler (SEC-25) |
  |---|---|---|
  | B7a `GET /jobs/mine/summary`, B7b `GET /jobs/mine` | `JwtAuthGuard`, `RolesGuard`, `@Roles(CUSTOMER)` | `customer-analytics` (B7a) |
  | B6 `GET /customers/me/overview` | same | `customer-analytics` |
  | B2 `GET /analytics/customer` | same | `customer-analytics` |
  | B3 `GET /payments/history` (paginated form) | same (unchanged) | `customer-analytics` |
  | B10 `GET /payments/history/export.csv` | same | `customer-export` |
  | B5 `GET /users/me/payment-settings` | same | none |
  | B5 `PATCH /users/me/payment-settings` | same + `NotSuspendedGuard` | `payment-settings-write` |
  | B1 `DELETE /users/me/avatar` | `JwtAuthGuard` + `NotSuspendedGuard` | `profile-media-write` (*Should*) |
  | B8 `GET /notifications/:id` | `JwtAuthGuard` | `notification-read` (*Should*) |

  A wrong role returns **403**. Another user's object, or one that does not exist, returns the **same 404** with the same body, so the two cannot be told apart.
- **SEC-3 No existence checks through filters.** Filter ids (`serviceId`, `artisanProfileId`, `status`) only narrow the caller's own rows. An id the caller has never paid gives an empty result, never a 403 or 404.
- **SEC-4 Server-made links are owner-scoped.** Every id the server returns for a link (action-item `jobId` in B6, `largestPayment.jobId` in B2, `job.id` in B3) comes from a query already scoped to the caller.
- **SEC-5 Avatar removal and hardening (B1).** The file to delete comes from the caller's stored `profilePicture`, and only when its normalised path is inside the `avatars` upload folder or our storage host. No `..` or outside paths are allowed, and nothing in the request picks the file. If the stored value fails the check, the database field is cleared but **no file is deleted**, and a warning is logged without the path. `profilePicture` is removed from `UpdateMeDto` so a free-text URL can no longer be set.
- **SEC-6 Cross-tenant (IDOR) tests, a release gate.** For each route in SEC-2, with fictional customers A (`ama.owusu@example.com`) and B (`kwame.boateng@example.com`):
  1. A, called with every query parameter combination including B's job, service and artisan ids, gets only A's rows and totals.
  2. Any attempt to send `customerId`/`userId` (query or body) gets 400 from `forbidNonWhitelisted`.
  3. An artisan token and an admin token get 403 on the customer routes.
  4. B8 with B's notification id gets 404 for A.

### 11.3 Response shapes and data minimisation

- **SEC-7 Explicit response mapping.** B2, B3, B5, B6, B7a and B8 return an explicit DTO, either `@Expose` with `excludeExtraneousValues` (the same as `NotificationResponseDto`) or a hand-written mapper (the same as `getMyHistory`). No entity is ever returned directly. **Never returned** anywhere in these responses: `platformFee`, `artisanAmount`, `transferCode`, `transferReference`, `paystackRecipientCode`, `accessCode`, `authorizationUrl`, any `authorization*` field, any `fraudFlag*` field, the artisan's `payoutAccountNumber`/`payoutAccountName`/phone/email, the customer's full mobile money number, `nationalId`, or password hashes. The other person in a transaction is shown as `{ id (public profile id), displayName, avatar }` only.
- **SEC-8 Forbidden-field test.** One shared test helper walks every key in each new response, recursively, and fails if any forbidden key from SEC-7 appears. It runs in each new endpoint's e2e spec.
- **SEC-9 No extra data in poll responses.** Item 6 uses the existing list responses (verified: `GET /messages` already returns `lastMessage.content` in full). No new fields are added to the messages or notifications list responses, because they are polled every 30 s.

### 11.4 Payment data (item 5)

- **SEC-10 What may be stored.** For v2, `customer_payment_settings` holds only: `user_id`, `preferred_channel` (`card | mobile_money | null`), `momo_network` (`MTN | TELECEL | AT | null`), the mobile money number **only if Q6 = yes** (SEC-12), `created_at` and `updated_at`.
  - **Must never be stored, logged or sent to JinVa's servers:** card number (PAN), CVV/CVC, card PIN, OTPs, card expiry, Paystack `authorization_code`, or raw Paystack webhook or verify payloads that contain `authorization` or `customer` objects.
  - If a Paystack payload is ever stored for debugging, the `authorization`, `customer` and `metadata` keys are removed before saving.
- **SEC-11 Card data never touches JinVa (PCI DSS SAQ-A).** Card entry happens only on Paystack's hosted checkout (or Paystack Popup from `https://js.paystack.co`). The frontend must have no card number, expiry or CVV fields anywhere. *Checked by:* code review and a lint or grep check in CI for `autocomplete="cc-` and similar.
- **SEC-12 Mobile money number (only if Q6 = yes).**
  - Encrypted at the application level with AES-256-GCM, using a new random 96-bit IV per value. The stored form is `keyId:iv:ciphertext:tag`. The key comes from env or a secret manager and is never stored in the database, the repo or logs. A key-rotation procedure is documented before release.
  - The column is `select: false` and is decrypted only inside the settings service.
  - It is returned **only masked** (`+233 24 *** **67`), using a shared masking helper next to `maskNationalId`.
  - It is never put in the JWT, in the `sessionStorage` user cache, in analytics events or in Sentry.
  - Server-side validation: `^\+233\d{9}$`, plus a prefix-to-network table (MTN, Telecel, AT) that lives on the server. The frontend's own check is only for convenience.
- **SEC-13 Step-up for changes to payment contact details.** Adding, changing or removing the mobile money number requires one of:
  - a current password re-check (accounts with a password), or
  - a 6-digit code sent to the account email (accounts created with Google sign-in, where `user.password` is `null`).

  Failed attempts count towards `auth-credentials`, and the error message is the same whatever failed. A notice goes to the account email after each add, change or remove: masked number only, with a "This wasn't me" link to Support. *Checked by:* unit tests covering both account types.
- **SEC-14 Checkout channel order.** `initializePayment` builds `channels` from a server-side allowlist and only reorders it by the stored `preferredChannel`. It never accepts a channel list from the client. If the settings cannot be read or hold an unknown value, the default order is used and payment is never blocked (FR-5.7).
- **SEC-15 Saved cards (Phase B) are blocked until a separate review.** Before any card-on-file work starts, the design must show:
  - `authorization_code` encrypted at rest (as SEC-12) in its own `customer_payment_methods` table, `select: false`, never returned to any client, and deduplicated by Paystack `signature`;
  - `charge_authorization` allowed only when the method's `user_id` and the job's customer both equal the caller;
  - deletion checks ownership, hard-deletes the row and calls Paystack's deactivate-authorization endpoint;
  - account purge deactivates every authorization.
- **SEC-16 (Should, separate ticket)** Encrypt and mask the existing artisan `payout_account_number` (plaintext `VARCHAR(50)` today), using the same helper as SEC-12.

### 11.5 Showing untrusted text safely (items 1, 2, 4 and 6)

- **SEC-17 Plain text only.** Notification `title`/`body`, message `content`, job titles, service names and people's names are rendered only as React text nodes.
  - Not allowed: `dangerouslySetInnerHTML`, any markdown or HTML renderer, or `innerHTML`.
  - Line breaks come from `whitespace-pre-wrap`, and long words wrap with `break-words`.
  - Add the ESLint rule `react/no-danger` as an **error**, with a single reviewed exception for `src/components/ui/chart.tsx`.
  - *Checked by:* an XSS fixture test. A notification body and a message containing `<img src=x onerror=alert(1)>`, `<script>alert(1)</script>` and `javascript:alert(1)` render as literal text, with no element created and no handler run.
- **SEC-18 Deep links from typed ids only.** All header-menu, rail and report buttons get their `href` from one mapping function, `notificationHref(type, payload)` (or a similar function per feature). It:
  - accepts only `Number.isSafeInteger(id) && id > 0`;
  - returns only paths that start with `/dashboard/user/`, or `null` (no button);
  - ignores `url`, `href`, `link` or any other string key in `payload`.

  *Checked by:* unit tests with `javascript:alert(1)`, `//evil.example.com`, `/\evil.example.com`, `%2F%2Fevil.example.com`, `https://evil.example.com`, `-1`, `1.5`, `"12abc"` and a missing id. All must give `null`.
- **SEC-19 URL parameters are allowlisted.** `stage`, `range`, `status`, `serviceId`, `artisanProfileId`, `page` and `search` read from the page URL are parsed into enums, positive integers or a string trimmed to 100 characters. Anything invalid falls back to the default. Parsed values are shown only as text nodes, and are sent to the API only through `URLSearchParams` (encoded), never by joining strings.
- **SEC-20 No attachments in the header menus.** The popovers never load `lastMessage.attachmentUrl`. They show "📷 Photo · Open conversation to view" (FR-6.15). If attachments are shown in a later version:
  - they load only through the authenticated blob path (`/uploads/private/messages/...` through `SharedMediaService`);
  - object URLs are revoked when the item collapses or unmounts;
  - SVG is offered as a download and never shown inline.
- **SEC-21 (Should) Bidirectional-text spoofing.** User text blocks use `dir="auto"` and `unicode-bidi: isolate`, so a right-to-left override character (U+202E) in a name or message cannot visually reorder nearby amounts, names or dates.
- **SEC-22 Charts cannot carry user text into CSS.** `ChartContainer` builds a `<style>` tag from config keys and colours (`chart.tsx`, `ChartStyle`). Config keys must be static identifiers (`c1`–`c6`, `other`) and colours must be `var(--chart-n)` tokens. Server strings (service or artisan names) are passed only as data and labels, which Recharts renders as SVG text. *Checked by:* code review and a unit test that puts a service named `x;}body{display:none` through the report and checks the page still renders.

### 11.6 Input validation (backend)

- **SEC-23 Query DTOs.** These rules apply on top of the global `whitelist`/`forbidNonWhitelisted` pipe, which no route may override:
  - `range`: enum `30d | 90d | 12m | all`.
  - `status`: comma list, split, trimmed and deduplicated, each value `IsEnum`, at most as many values as the enum has.
  - `page`: integer, 1 to 1,000. `limit`: integer, 1 to 100 (default 20).
  - `from`/`to`: `IsISO8601` dates, `from ≤ to`, span at most 24 months.
  - `serviceId`/`artisanProfileId`: positive integers.
  - `search`: string, trimmed, 1–100 characters, `LIKE` wildcards `%`, `_` and `\` escaped, used with `ESCAPE '\'` and a bound parameter.
  - `preferredChannel`, `momoNetwork`: enums.
  - `momoNumber`: as in SEC-12, nullable to remove.

  All SQL uses bound parameters. No raw query is built from strings.
- **SEC-24 No client-chosen sorting.** History is always sorted newest first on the server. No `sort`/`orderBy` parameter is accepted, so no column name can be injected.

### 11.7 Rate limits, caching and abuse

- **SEC-25 New named throttlers,** added to `THROTTLER_NAMES` and attached per route with `NamedThrottlerGuard` (there is no global guard). They track by **user id** on authenticated routes and fall back to IP. A rejected request gets a 429 with `Retry-After`, and the frontend shows "Too many requests, please wait a moment" without retrying in a loop.

  | Name | Limit (starting point) | Routes |
  |---|---|---|
  | `customer-analytics` | 30 per minute per user | B2, B6, B7a, B3 paginated |
  | `customer-export` | 5 per 10 minutes per user | B10 |
  | `payment-settings-write` | 5 per minute per user | B5 PATCH |
  | `profile-media-write` (*Should*) | 10 per hour per user | B1 and `POST /uploads/avatar` |
  | `notification-read` (*Should*) | 60 per minute per user | B8 |

  *Checked by:* a throttler spec for each name showing that request N+1 gets 429, and a test that each new route has the guard attached.
- **SEC-26 Caching never crosses users.** A server cache for B2 and B6 uses the key `{name}:{userId}:{normalised params}`, with a TTL of 60 s or less. Every `/me` response carries `Cache-Control: private, no-store`. The Next.js frontend must not cache these responses in a shared server cache (fetch them in the browser, or with `cache: 'no-store'`).
- **SEC-27 Bounded exports.** B10 streams the output, allows at most 10,000 rows and a 24-month range (otherwise 400), and returns `Content-Disposition: attachment; filename="jinva-payments-YYYY-MM-DD.csv"`. CSV cells are neutralised against formulas (prefix `'` for a leading `=`, `+`, `-`, `@`, tab or carriage return) on **every** text column.
- **SEC-28 No new polling load.** No new polling, and the existing 30 s intervals for unread counts and messages are not shortened. Mark-as-read calls from expanding items (FR-6.10, FR-6.17) are debounced and sent at most once per item each time the menu is open.

### 11.8 Audit and logging

- **SEC-29 Customer security-event log.** A new append-only table `account_security_events`:

  | Column | Content |
  |---|---|
  | `id` | Primary key |
  | `user_id` | The account |
  | `event` | The event name (list below) |
  | `fields_changed text[]` | Field names only |
  | `ip` | Request IP |
  | `user_agent` | Truncated to 256 characters |
  | `created_at` | Time of the event |

  - **Events:**
    - `payment_settings.updated` (field names only)
    - `momo_number.added`, `momo_number.changed`, `momo_number.removed`
    - `step_up.failed`
    - `spending_report.exported` (filters used, row count)
    - `profile_photo.removed`
    - Phase B: `payment_method.added`/`removed` (brand and last4 only)
  - **Never recorded:** values (numbers, emails, passwords, codes), or reads of analytics, history or notifications.
  - **Write timing:** the settings and number events are written **in the same transaction** as the change, so a change can never go unrecorded. Export and photo events may be best-effort.
  - **No edit or delete API.** A scheduled job removes rows older than 12 months.
- **SEC-30 Admin visibility.** Admins may read a user's security events through the existing admin user-detail screen, and that read is itself recorded through `AdminAuditService`. *Should*, and may follow v2.
- **SEC-31 Logging hygiene.**
  - Add a redaction list to the backend logger and to Sentry `beforeSend`: `password`, `currentPassword`, `code`, `otp`, `momoNumber`, `momo_number*`, `phoneNumber`, `email`, `accountNumber`, `payout_account_number`, `authorization`, `authorization_code`, `card`, `nationalId`.
  - `AllExceptionsFilter` and request logging must not echo request bodies. Validation messages must not include submitted values (no `$value` in custom messages).
  - The frontend error reporting (NFR-6.3) sends the endpoint and status code, never request or response bodies.

### 11.9 Frontend platform controls

- **SEC-32 Content Security Policy and security headers, a release gate for items 5 and 6.** Add these through `next.config.ts` `headers()` or `middleware.ts`, with a per-request nonce:
  - `default-src 'self'`
  - `script-src 'self' 'nonce-{n}' 'strict-dynamic' https://js.paystack.co` (Paystack only if Popup is used)
  - `style-src 'self' 'unsafe-inline'` (needed today by Tailwind and the chart `<style>`; review later)
  - `img-src 'self' blob: data:` plus the avatar/CDN host
  - `connect-src 'self'` plus the API origin and `https://api.paystack.co`
  - `frame-src https://checkout.paystack.com`
  - `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self' https://checkout.paystack.com`, `object-src 'none'`

  Also set `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff` and `Permissions-Policy: camera=(), microphone=(), geolocation=()` (adjust if a feature needs one). Run it in Report-Only mode for at least a week before v2, then enforce.
- **SEC-33 Client state hygiene.**
  - Sign-out clears cached notifications, messages, overview, spending and payment-settings data.
  - Closing a header menu collapses every item (FR-6.7).
  - The only new browser storage allowed is the boolean "history has moved" dismissal flag (FR-5.1).
  - Spending data, settings and message text are never written to `localStorage`/`sessionStorage`. The mobile money number never enters the cached user object.
- **SEC-34 Analytics privacy.** Product analytics events (NFR-6.4) carry only the enum properties listed. They never carry amounts, ids, names, search text, references, emails or phone numbers.

### 11.10 Ghana Data Protection Act, 2012 (Act 843)

- **SEC-35 Purpose limitation.** Payment settings are used only to order checkout methods and show payment details. Spending data is used only for the customer's own report and export. Neither is used for marketing or profiling unless the customer's existing `promotional_offers` preference is on, and even then never the mobile money number.
- **SEC-36 Minimisation.** Collect only what a feature uses. Security supports **Q6 = No** (no mobile money number in v2), **Q7 = No** (no separate receipt email; if added later, the new address must be verified by a link sent to it before any receipt goes there), and **Q8 = later** (no saved cards). Breakdowns show public artisan profile data only.
- **SEC-37 Retention and erasure.**
  - Add `customer_payment_settings` and `account_security_events` to `AccountPurgeService.deleteResidualPersonalData` (`src/users/account-purge.service.ts`) and to its spec.
  - Per-user analytics cache entries expire within 60 s.
  - Payment rows are kept for the statutory retention period confirmed by legal, de-linked from the person as the purge already does.
  - Phase B: purge deactivates every Paystack authorization.
- **SEC-38 Access requests.** The Spending page and CSV export support a customer's right of access. The export contains only the caller's own data and the public display names of artisans.
- **SEC-39 Privacy notice (owner/legal, before release).** Update the privacy policy's payment section to cover: the new stored settings (and the number, if Q6 changes); Paystack as a processor, including that it processes data outside Ghana; the 12-month security-event retention; and how to ask for erasure.

### 11.11 Required security tests (release gate)

| # | Test | Covers |
|---|---|---|
| T-1 | Cross-tenant spec for every route in SEC-2 (customers A and B, all parameter variations; artisan and admin get 403; owner params get 400) | SEC-1 to SEC-6 |
| T-2 | Forbidden-field walker on every new response | SEC-7, SEC-8 |
| T-3 | XSS fixture in both header menus, the report tables and the rail | SEC-17 |
| T-4 | `notificationHref` hostile-input unit tests | SEC-18 |
| T-5 | Chart config injection test | SEC-22 |
| T-6 | Throttler limit spec for each new name, plus a guard-attached check per route | SEC-25 |
| T-7 | CSV formula-injection test (`=SUM(`, `@cmd`, `+1`, `-1`, leading tab or carriage return in title, service, artisan name and reference) | SEC-27 |
| T-8 | Payment settings: unknown field gets 400; number validation and network prefix; step-up for password and Google-only accounts; a security event is written; the number is never present unmasked in any response or log line | SEC-10, SEC-12, SEC-13, SEC-29, SEC-31 |
| T-9 | Purge spec covers the new tables | SEC-37 |
| T-10 | Avatar delete refuses paths outside the `avatars` folder; `PATCH /users/me` with `profilePicture` gets 400 | SEC-5 |
| T-11 | CSP header present in production build responses (Report-Only before release, then enforcing) | SEC-32 |

### 11.12 Release gates by item

| Item | Cannot ship without |
|---|---|
| 1 Overview filters | SEC-1, SEC-2, SEC-19, SEC-23, T-1 (B7a/B7b) |
| 2 Monitor rail | SEC-1, SEC-2, SEC-4, SEC-7, SEC-25, SEC-26, T-1, T-2 (B6) |
| 3 Profile photo | SEC-5, T-10 |
| 4 Spending report | SEC-1 to SEC-4, SEC-7, SEC-8, SEC-22 to SEC-27, SEC-29 (export), T-1, T-2, T-5 to T-7 |
| 5 Payment settings | SEC-10 to SEC-14, SEC-29, SEC-31, SEC-32, SEC-37, SEC-39, T-8, T-9, T-11 |
| 6 Read in place | SEC-9, SEC-17, SEC-18, SEC-20, SEC-28, SEC-32, SEC-33, T-3, T-4, T-11 |
