# Artisan side: findings to fix

From the review of 31 Oct 2026 (17 artisan pages, checked in the browser as the seed artisan
yaw.osei@jinva.com). Every item below is confirmed. Fix all of them. IDs are referenced in
commits and reports. FE = jinva-frontend-web, BE = JIN_VA-BACKEND.

## Principles for every fix

- **One product, two roles.** The artisan side must look and behave like the redesigned customer
  side: `src/app/dashboard/user/page.tsx`, `src/components/dashboard/job-track.tsx`,
  `src/components/dashboard/overview/*`, `src/components/spending/*`, `src/components/settings/*`,
  `src/components/dashboard/inbox/*`. Reuse those components (generalise them with a role prop
  where needed) instead of building parallel versions.
- **Role-aware content.** Each role sees what it needs, in its own words: a client "pays" and
  "spends"; an artisan "earns" and "gets paid". Use "client" for the customer everywhere on the
  artisan side (never "customer" in UI copy there).
- **No fake data, no dead controls.** If something has no real backend, remove it or wire it.
  Never ship sample arrays, placeholder contacts or buttons without handlers.
- **Design rules** (frontend-design skill + customer redesign): no spaced ALL-CAPS eyebrows above
  headings; one `<h1>` per page (the header title is not a second h1); sentence-case buttons;
  dates en-GB ("25 Oct 2026"), money GH₵ with 2 decimals; tap targets ≥ 44px on phones;
  every switch/icon button has an accessible name; status never by colour alone; charts have a
  table alternative; respect prefers-reduced-motion; no horizontal overflow from 360 to 1920.
  `Card` has built-in `py-6 gap-6` — pass `py-0 gap-0` (as the customer pages do) where it
  creates a blank band; don't change the primitive.
- **Copy rules:** never "escrow"; never promise times the app can't guarantee (payout arrival,
  refund arrival, "approve within 24 hours", "resolve within 48 hours").

## Critical: fake or dead

- C1 Analytics (`artisan/analytics/page.tsx`) is all hardcoded sample data. Rebuild on real data
  (see B3) using the Spending page's period selector, statement band and chart+table pattern.
- C2 Report (`artisan/report/page.tsx`) redirects to the fake Analytics; redirect to Earnings.
- C3 Support (`components/dashboard/support-page.tsx`, used by both roles) is a "Plumbify"
  template: fake email/phone/live chat/tickets/resources, "10% fee", "2–3 business days",
  EST hours. Rewrite with real channels only (support email from `src/lib/legal-entity.ts`,
  which may be blank → show the contact page link), role-specific FAQs that match the backend
  (fee read from config — say "a percentage of each completed job, shown in your earnings
  breakdown"; payout starts when the client confirms or 48 hours after the artisan marks the job
  done if the client doesn't respond). Remove tickets/chat/phone/resources until they exist.
- C4 Artisan Settings → Availability tab is fake (hardcoded hours, dead Save Schedule, Available/
  Busy, Vacation). Remove it; link to Calendar where working hours really live.
- C5 Artisan Settings photo controls (camera, Upload new photo, Remove) do nothing. Reuse the
  customer settings profile-photo block (`components/settings/*`) — it uses the real
  avatar upload and `DELETE /users/me/avatar`.
- C6 "Enable 2FA" switch does nothing (artisan settings ~l.1020 and customer settings). Remove
  on both until 2FA exists.
- C7 Profile "Edit Profile" button has no handler; "Jobs Completed" reads `user.jobsCompleted`
  which is never set (always 0).
- C8 Reviews page shows a debug "New screen" eyebrow (`artisan/reviews/page.tsx:175`).

## High: broken logic

- H1 `isMyJob` treats any job without an accepted artisan as mine (`artisan/jobs/page.tsx:416`,
  `artisan/jobs/[id]/page.tsx:231`), so Request completion / Report a problem show on jobs that
  aren't the artisan's. Use `acceptedArtisan?.id === user.id` strictly; `completionRequestedAt`
  is also exposed now — remove the stale comments that say otherwise.
- H2 Jobs list and Overview load `/jobs` once with the default limit 10: no pagination, filters
  built from a partial list, stats counted from page 1. Add pagination/load more; take counts
  from the summary endpoint (B1).
- H3 Overview "Available Jobs" lists expired and completed jobs and promises "upcoming
  appointments" it never shows; four oversized stat cards push content below the fold on phones;
  wrong icons (DollarSign for reviews); clickable `<tr>` rows without keyboard access; EXPIRED has
  no status config (raw enum). Rebuild as "what needs me now" (see B1): booking requests with
  one-tap Accept/Decline, today's and the next appointment (with client notes and location),
  jobs to start / waiting on the client, an earnings line (held, paid this month), and a separate
  "Open jobs near you" list (status OPEN) — same layout language as the customer Overview and rail.
- H4 Calendar: booking requests are ~3,100px down on a phone; "Upcoming" includes past bookings
  (filters by status only, `calendar/page.tsx:372`); client notes, artisanNotes, location not
  shown; `service: null` renders "Service — Ama Mensah"; Summary shows the unsaved status as
  current; 10 unlabelled switches; 28px delete buttons without labels and no confirmation;
  `<Label>` without htmlFor; h1 says "Availability" but nav says "Calendar". Put requests and
  upcoming bookings first, split past ("Needs follow-up") from upcoming, show notes/location,
  move working hours + time off below or into a second tab, fix the a11y issues.
- H5 Notifications: artisan notifications have no actions (`lib/notifications.ts` builds only
  `/dashboard/user/...`; popover enables actions for customers only). Add an artisan route map:
  booking → calendar (or the Overview request), job → `/dashboard/artisan/jobs/:id`, payout →
  earnings, review → reviews, dispute → `/dashboard/artisan/disputes/:id`. "JOB_EXPIRED" is filed
  under Assignment by name matching; "All (n)" counts loaded rows only.
- H6 Disputes are unreachable for artisans: no list, no notification link, no "response needed"
  prompt. Add a Disputes section (list from the party disputes endpoint) reachable from My Jobs
  and the Overview "needs me" rail when a response is due; link dispute ↔ job (needs `jobId`, B5).
- H7 Earnings: "Withheld" label for normal HELD money (`status-badges.ts`); the Pending card mixes
  "client paid, job not done" with "transfer failed"; refunded and unpaid rows still show a
  payout amount; payout-timing text contradicts other pages; a dev note "full fee breakdown isn't
  available from this list yet" is shown to users; no fee breakdown, statement, period filter,
  payout history or CSV. Rebuild as a statement (B2): this month's net as the hero figure,
  "Paid by client (waiting for sign-off) / On its way / Needs your action / Refunded", gross, fee,
  net per row, transfer reference, period selector and CSV — reuse the spending components.
- H8 Job detail never shows money for a completed job (payment card only when an earnings row
  exists); job deadline, booking date/time not shown; location has no directions link; client
  card reads email/phone/photo that the API never sends; timeline shows raw enums and US
  timestamps with seconds; DollarSign icon next to GH₵; disabled "Report a problem" with a
  system-internals explanation (hide when ineligible). Always show a Payment section (agreed
  price → held / on its way / paid / not paid yet).
- H9 "Application sent" is local state only, so it's forgotten on reload. Use `hasApplied` (B4).
- H10 After "Request completion" the jobs list doesn't change (sets IN_PROGRESS again, never sets
  completionRequestedAt). Show "Waiting on client".
- H11 Payout setup: "Add payout method" links to settings without anchoring the form; the
  no-method alert doesn't say how much is waiting; no masked destination ("MTN MoMo ••1234");
  failed transfers give no reason; "Vodafone Cash" should be "Telecel Cash"; bank payouts ask for
  a raw bank code — use a bank picker (B6); validation is toast-only; two save models in one tab.
- H12 Reviews: star-filter counts, "4★ & above" and "Awaiting your reply" computed from the loaded
  page only, and the latter counts rating-only reviews; chips and Reply are 28px; stars have no
  text alternative. Take counts from the server (B7).

## Mobile

- M1 Artisan Settings: photo block Remove button overflows at 360/390; tab bar clips Security
  (hides Delete account); Availability time inputs run off-screen (gone with C4).
- M2 Portfolio: delete button only visible on hover (never on touch), 28px, no label; reorder is
  drag-only (add move up/down buttons); filter tabs clipped at 360/390; status badges on photos
  barely readable (solid background or below the image).
- M3 Tap targets under 44px across jobs filters/buttons, calendar inputs (h-8), notifications
  filters, reviews chips, messages back arrow (also no aria-label).
- M4 Stat-card stacks fill the first phone screen (Overview, Jobs, Earnings, Analytics, Profile
  hero, Portfolio zero stats) — use the compact strip / statement band pattern.

## Profile, services, portfolio, verification

- P1 Profile: no verified badge though `isVerified` is fetched; no "Preview as a client" (client
  view is `/dashboard/user/artisan/[id]` — link to it or render it); name/phone/service area
  editable in both Profile and Settings (keep one place: Profile); Reviews tab duplicates the
  Reviews page without reply (replace with a summary + link); 32px camera button without label;
  load errors swallowed and saveable empty fields shown; lone card in a 2-column grid.
- P2 Services: card price is the catalogue price ("From GH₵…") but reads as if the platform sets
  the artisan's price — label "Typical starting price" (or add per-artisan pricing if the backend
  supports it); Remove fires with no confirmation — confirm, and warn when removing the last
  service hides the artisan from search; compact list instead of tall identical cards; pin active
  services first; load failure shows "No services found / adjust your search" (wrong).
- P3 Portfolio: upload categories are a hardcoded list (HVAC, etc.) — use the artisan's services;
  empty state has no upload button and shows four zero stats + a red 0; success toast promises
  "approve within 24 hours".
- P4 Verification: approved state claims "Your profile shows the verified badge" (fix with P1);
  rejected state has no "Submit again" heading or prefill; file inputs have no preview, no selfie
  `capture="user"`; remove buttons 28px.

## Cross-cutting

- X1 Two `<h1>` per page (header title + page heading) — make the header title not an h1 on
  dashboard pages.
- X2 Uppercase tracked eyebrows ("ARTISAN DASHBOARD", "SETTINGS", "PAYMENTS", "MESSAGES",
  "NOTIFICATIONS", "ARTISAN") and uppercase table headers; Title Case buttons; US dates
  (`toLocaleDateString()` without en-GB) — fix on every artisan page.
- X3 Page names differ between nav, header and h1 (Calendar/Availability, My Jobs/Jobs,
  Notifications/Activity feed). Use the nav name.
- X4 App-wide: every full reload logs 401s before the session refresh (in-memory token lost).
  Make the first auth'd call wait for the refresh instead of firing and failing.
- X5 Booking notification says "Monday 7 July 2026" for 2026-07-07, which is a Tuesday — find the
  backend template's day-name bug.

## Backend needed (BE)

- B1 `GET` artisan overview/summary: job counts by artisan stage (to start = PENDING, in progress,
  waiting on client = completion requested, done, closed), pending booking requests (with client
  name, service, date/time, location, notes), next and today's confirmed bookings, earnings
  (held, paid this month, needs action). Owner from the token, rate-limited, private no-store.
- B2 Earnings: extend `/payments/my-earnings` (or add a paginated statement endpoint) with gross
  amount, platform fee, net, status, transfer reference, failure reason (if stored), paid/released
  dates, filters by period and status, monthly totals, and a capped formula-safe CSV export
  (reuse `csv.util`). Masked payout destination on the artisan profile response.
- B3 Artisan analytics on real data: earnings by period, jobs completed, rating trend, top
  services, repeat-client rate. Check `src/analytics/artisan-analytics.service.ts` — it may
  already exist; reuse it.
- B4 `hasApplied` on job list/detail for the requesting artisan.
- B5 `jobId` in the party dispute response; a party disputes list includes jobId and whether a
  response is due.
- B6 Ghana bank list for the payout bank picker (Paystack's bank list, cached server-side).
- B7 Artisan review summary counts (by star, 4★+ share, awaiting reply excluding rating-only).
- B8 Decided: do NOT expose the client's phone number (Act 843 data minimisation; messages are
  the channel). Remove the dead client-card email/phone/photo code instead (H8).
