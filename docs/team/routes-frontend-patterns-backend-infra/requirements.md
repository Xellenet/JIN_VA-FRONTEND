# Requirements: Routes, Frontend Patterns & Backend Infra (marketing landing page first)

> **Source & re-verification note — 2026-08-27**
> This document turns the "Cross-cutting: routes, frontend patterns, backend infra" section of
> `docs/team/prd-gap-audit-2026-08-18.md` into scoped work. That audit is 9 days old and real fixes
> have landed since, so **every one of its 7 cross-cutting bullets was re-verified against the code
> on 2026-08-27 before being written into this spec.** Three of them are no longer accurate and are
> **not** deliverables here — see "Re-verification results" below. PRD source of truth:
> `jinva-frontend-web/JinVa-PRD.html` (identical content to the root `JinVa-PRD.pdf`), §1–§2 (overview
> / problem), §3–§4 (objectives / roles), §5 (feature modules), §6 (route structure + frontend
> patterns), §7 (backend stack), §9 (non-functional).

---

## Problem statement

JinVa has no front door: `/` hard-redirects to `/signup`, so a first-time visitor is asked to create an
account before they are told what the product is, who it is for, or what it costs them — and there is no
public page anywhere that explains the platform. Separately, a cluster of PRD-vs-code deviations in route
shape, colour discipline and backend infrastructure has accumulated: hardcoded Tailwind colours in 37
files (up from the audit's ~27–28) break the app's real dark theme, and file storage/email still run on the
local-disk + generic-SMTP setup rather than the PRD's CDN-backed storage and named email provider. This
round ships the marketing landing page as the flagship deliverable and resolves — or formally accepts —
each remaining deviation so the gap list stops being re-litigated every audit.

## Target role(s)

- **Prospective visitor (unauthenticated — not yet a JinVa role)** — the primary audience for the
  flagship deliverable. Gains a real landing page at `/` that explains the platform, speaks to their
  role, and routes them into `/signup` or `/login`. This is the only role for whom something new appears.
- **user (client)** — no functional change. Indirectly gains a correctly-rendering dark theme on booking,
  job, payment and review screens once the colour-token cleanup lands.
- **artisan** — no functional change. Same dark-theme benefit, plus a public "For artisans" pitch that
  explains the value proposition their signup was previously missing.
- **admin** — no functional change. The landing page describes platform governance as a credibility
  signal, but **must not** offer an admin signup path: PRD §5.1 states admin accounts are created via
  backend seeding only and are not publicly registerable.
- **Backend (no role-facing change)** — storage and email infrastructure items are internal; no UI.

---

## Re-verification results (what is actually still true, as of 2026-08-27)

| # | Audit bullet (2026-08-18) | Re-verified status | Disposition in this spec |
|---|---|---|---|
| 1 | Marketing landing page `/` doesn't exist — hard-redirects to `/signup` | **STILL TRUE.** `src/app/page.tsx` is 5 lines: `redirect("/signup")`. No public marketing route of any kind exists. | **Deliverable — flagship.** LP1–LP14 + PUB1–PUB4. **NEW SCREENS → ux-designer.** |
| 2a | Routes use `/login`, `/signup` etc. instead of PRD's `/auth/*` prefix | **STILL TRUE.** Pages live in the `(auth)` route group → `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`. (Note: a literal `/auth/callback` route *does* exist for Google OAuth, so the app half-uses the prefix already.) | **Explicit call required — recommend ACCEPT AS DEVIATION, do not rename.** See R1 + Open Question 1. |
| 2b | `reset-password/[token]` path segment missing | **STILL TRUE but working end-to-end.** Token travels as `?token=` and the backend's link builder (`src/mail/listeners/user-mail.listener.ts`) generates exactly that shape for both reset and verify. Frontend and backend agree. | **Recommend ACCEPT AS DEVIATION.** Bundled into R1 / Open Question 1. |
| 2c | `messages/[jobId]` dynamic segment missing | **ALREADY OWNED ELSEWHERE.** `docs/team/messaging-notifications/requirements.md` explicitly puts PRD's job-scoped thread lifecycle and `/messages/:jobId`-shaped routes **out of scope**, with a flagged decision for a human. Deep-linking works today via `?artisan=&job=&booking=`. | **NOT a deliverable here.** Do not re-scope; defer to that document. |
| 3 | Admin "Users" split into clients/artisans, no per-user detail route | **ALREADY SCOPED ELSEWHERE, backend already built.** `docs/team/analytics-admin-disputes/requirements.md` **AT4** specifies `/dashboard/admin/users/[id]`, and its `design-spec.md` §10.4 already designs that screen (item 12 in its screen inventory). `GET /admin/users/:id` plus `suspend`/`activate`/`ban`/`unban` all exist on the backend admin controller today. | **NOT a deliverable here.** Do not re-scope. Whether the two lists merge into one `/dashboard/admin/users` is that document's Open Question 5. |
| 4 | No role-mismatch redirect (artisan can open `/dashboard/admin`) | **ALREADY FIXED.** `src/middleware.ts` verifies the signed httpOnly `jinva_session` cookie at the edge and redirects on role mismatch to `ROLE_HOME[role]`; each of the three dashboard layouts additionally wraps its subtree in `<RoleGuard allow="…">`, which re-checks the real `/users/me` role client-side. Both layers exist. | **NOT a deliverable.** Regression-guard only (see QA line in Definition of Done). |
| 5 | Hardcoded Tailwind colours violate the design-token rule in ~27–28 files | **STILL TRUE AND WORSE — 257 occurrences across 37 files.** PRD §6 "Key Frontend Patterns" states: *"Design tokens used exclusively for colours — no hardcoded Tailwind colour classes (e.g. `bg-primary/10` not `bg-blue-100`)."* | **Deliverable.** DT1–DT5. **Mostly engineer fixes; DT1 needs ux-designer for token values.** |
| 6 | File storage is local disk proxied through the app server, not S3/Cloudinary + CDN | **PARTIALLY FIXED.** A provider abstraction now exists: `src/uploads/providers/storage-provider.factory.ts` selects between `LocalStorageProvider` and a complete `S3StorageProvider` (with optional `AWS_S3_PUBLIC_URL_BASE` for a CDN domain) via `STORAGE_PROVIDER`. **Local remains the default** and `main.ts` still serves `/uploads/*` off the app server with `useStaticAssets`. Uploads also still arrive as multipart through the API rather than PRD §6's presigned direct-to-storage. | **Deliverable, reduced scope. BACKEND-ONLY — zero UI/UX design needed.** BI1–BI3. |
| 7 | Email uses generic SMTP via nodemailer, not confirmed SendGrid/Resend | **STILL TRUE in code.** `src/mail/mail.config.ts` builds a raw `nodemailer.createTransport` from `MAIL_HOST`/`MAIL_PORT`/`MAIL_USER`/`MAIL_PASS`. **Cannot be confirmed further without reading `.env`, which is prohibited** — SendGrid and Resend both expose SMTP endpoints, so the current code could already be pointed at one. | **Needs a one-line answer from the user before it is scoped as work.** BI4 + Open Question 8. **BACKEND-ONLY.** |

---

## User stories

### Landing page (flagship)

- As a **prospective client**, I want to land on `/` and immediately understand what JinVa does and
  whether it covers the trade I need, so that I decide to sign up on purpose instead of being dumped on a
  signup form for a product I can't evaluate.
- As a **prospective client**, I want to see the service categories JinVa covers, so that I can tell in
  one glance whether my job (a leaking pipe, a rewire, a repaint) belongs here.
- As a **prospective artisan**, I want a section that speaks to me specifically — reputation, schedule
  control, reliable payouts — so that I understand why I'd list my trade here rather than keep relying on
  word of mouth.
- As a **prospective visitor of any kind**, I want every link in the header and footer to actually go
  somewhere, so that the site doesn't feel abandoned or broken.
- As a **visitor evaluating trust**, I want to see how the platform protects both sides (verification,
  escrowed payments, reviews tied to real completed jobs, dispute resolution), so that I believe my money
  and my time are safe.
- As a **visitor on a phone**, I want the whole page — including the nav — to work at 375px, so that I can
  actually read and act on it.

### Route shape

- As a **developer or QA engineer**, I want one written decision on whether auth routes move under
  `/auth/*`, so that the PRD-vs-code difference stops being re-flagged as a bug in every audit.

### Design tokens

- As a **user of any role who has dark mode on**, I want status badges, alerts and inputs to be readable,
  so that job statuses, payment states and phone-number fields aren't washed-out or invisible.

### Backend infra

- As a **platform operator**, I want uploaded media served from a CDN rather than the app server, so that
  media traffic doesn't compete with API traffic and PRD §9's "10,000+ providers / 1M+ media assets"
  target is reachable.
- As a **platform operator**, I want transactional email to run on a provider with deliverability
  reporting, so that verification and reset emails reliably land.

---

## Acceptance criteria

Every criterion below is written so QA can mark it pass/fail without asking a question. IDs are stable —
`qa-report.md` and `security-report.md` should cite them.

### LP — Marketing landing page at `/` (flagship, highest priority)

**LP1 — The route exists and is public.**
- Given a visitor with no session and no cookies, when they open `/`, then a full marketing landing page
  renders. No redirect to `/signup`, `/login` or anywhere else occurs (verify: browser network tab shows
  no 3xx for `/`).
- Given `src/middleware.ts`'s matcher currently covers only `/dashboard/:path*` and the auth paths, when
  `/` is added, then it stays outside the matcher — the landing page must never require or consult a
  session to render.

**LP2 — The page renders with the backend unreachable.**
- Given the backend API is stopped, when a visitor opens `/`, then the full page still renders with no
  error toast, no blank section, no spinner stuck on screen, and no console error. (All landing content is
  either static or, if LP6 is answered "live", degrades to the static fallback list.)

**LP3 — Header nav: every link resolves.**
- Given the landing page header, when a visitor clicks each nav item in turn, then each one either scrolls
  smoothly to a section that exists on the page, or navigates to a route that returns 200. Zero links
  resolve to `#`, `/`-with-no-target, `javascript:void(0)`, or a 404. QA must click **every** header link.
- Given the header, when a visitor clicks the JinVa logo, then it navigates to `/` (the logo must be a
  link, not a bare `<div>` — it is a bare `<div>` in `src/components/logo.tsx` today).
- Given the header, when a visitor clicks "Log in", then `/login` loads; when they click the primary CTA
  ("Get started" / equivalent), then `/signup` loads.
- Given a viewport under the `lg` breakpoint, when a visitor opens the mobile menu, then every nav item
  and both auth CTAs are reachable from inside it, and the menu closes after a selection.
- Given keyboard-only navigation, when a visitor tabs through the header, then every nav item and CTA is
  focusable in visual order with a visible focus ring, and Enter activates it.

**LP4 — Hero content traces to the PRD.**
- Given the hero, when it renders, then it contains exactly one `<h1>`, and that headline plus its
  supporting paragraph are traceable to PRD §1 (Product Overview) and/or §2 (Problem Statement) — a
  reviewer must be able to point at the PRD sentence each claim came from. No invented product claims, no
  invented pricing, no invented launch dates.
- Given the hero, when it renders, then it contains a primary CTA to `/signup` and a secondary CTA to
  `/login`, both visible without scrolling at 1440×900 and at 375×812.

**LP5 — Role sections: one per PRD role, with the right CTA (or none).**
- Given the page, when a visitor scrolls it end to end, then there is a distinct section addressing each
  of PRD §4's three roles — client, artisan, admin — and each section's claims map to that role's PRD §3
  objective and §4 key capabilities.
- Given the artisan section, when it renders, then it has its own CTA into signup.
- Given the admin section, when it renders, then it contains **no signup or "become an admin" CTA of any
  kind**, because PRD §5.1 makes admin accounts seed-only and not publicly registerable. (Explicit fail
  condition: any CTA that implies a visitor can create an admin account.)

**LP6 — Service categories showcase.**
- Given the categories section, when it renders, then it shows the PRD §1 list — **electrical, plumbing,
  carpentry, painting, cleaning, landscaping, beauty** — plus one final tile conveying PRD §1's "and more"
  (e.g. "…and every other trade"). Spelling and ordering are checked against PRD §1.
- Given a category tile, when a visitor clicks it, then it goes to `/signup` (there is no public artisan
  browse route today — see Out of scope). No tile is a dead click.
- Given Open Question 3 is answered "live", then instead of the static list the section reads from the
  public `GET /services` endpoint, and when that call fails or returns empty, then the PRD §1 static list
  renders as the fallback with no visible error.

**LP7 — How it works / feature highlights.**
- Given the page, when a visitor reads the how-it-works section, then it presents the client journey and
  the artisan journey as ordered steps, and each step is traceable to a PRD §5 module (§5.2 discovery,
  §5.3 profile, §5.5 booking, §5.6 job lifecycle, §5.7 payments, §5.8 reviews, §5.12 analytics).
- Given the feature-highlight section, when it renders, then each highlighted capability exists in PRD §5.
  Nothing is advertised that the PRD does not specify — in particular, **no** claim of a native mobile
  app, real-time chat, a map view, loyalty/rewards, promo codes or multi-language support, all six of
  which PRD §10 puts explicitly out of scope for v2.0.

**LP8 — Trust / social proof is unmistakably placeholder.**
- Given there is no testimonial data source anywhere in either repo, when the trust section renders, then
  its quotes/names/avatars come from a single clearly-named module-level constant (e.g.
  `PLACEHOLDER_TESTIMONIALS`) carrying a comment that says it is placeholder content, **and** the section
  carries a visible on-screen marker (e.g. a `Badge` reading "Sample content") that a reviewer can see
  without reading source.
- Given the whole page, when QA audits every number displayed on it, then **no fabricated statistic
  appears** — no "10,000+ artisans", no "4.9 average rating", no "50,000 jobs completed". Any number shown
  must either come from a real endpoint or be explicitly labelled as a target/sample. (PRD §9's
  "10,000+ providers" is a scalability target, not a current fact, and must not be presented as one.)
- Given placeholder avatars are needed, when they render, then they use existing assets in
  `jinva-frontend-web/public/` (`placeholder-user.jpg`) or the app's standard navii.dev + `<UserRound>`
  fallback — no new stock imagery is committed.

**LP9 — Footer: complete and no dead links.**
- Given the footer, when it renders, then it contains grouped links covering: About, Contact/Support,
  FAQ/Help, Terms of Service, Privacy Policy, plus product links back into the page's own sections and
  into `/login` and `/signup`.
- Given each footer link, when QA clicks it one by one, then it resolves to a 200 page or an on-page
  anchor that exists. **Zero `href="#"` placeholders, zero 404s.** This is the hard interpretation of the
  user's "all navs work" requirement, and it gates PUB1–PUB4.
- Given the footer, when it renders, then a copyright line shows the **current** year computed at render
  time (not a hardcoded literal) alongside the JinVa name.
- Given social icons, when Open Question 5 is answered, then either every icon points at a real JinVa
  account URL, or the social row is omitted entirely. An icon linking to `#` or to a platform homepage is
  a fail.

**LP10 — Responsive and accessible.**
- Given viewports at 375px, 768px, 1024px and 1440px, when the page renders at each, then there is no
  horizontal scroll, no overlapping text, no clipped CTA, and no image overflowing its container.
- Given PRD §9's WCAG 2.1 AA requirement, when QA runs an accessibility pass, then: all images have
  meaningful `alt` text (decorative ones `alt=""`), heading levels descend without skipping, all
  interactive elements are keyboard-reachable with a visible focus state, and text/background contrast
  meets AA at every breakpoint **in both light and dark themes**.
- Given the app's `next-themes` setup with `defaultTheme="system"`, when a visitor with an OS dark
  preference opens `/`, then the page renders correctly in dark mode — no white-on-white, no invisible
  text. (This is why LP uses tokens, not literals — see LP12.)

**LP11 — SEO / metadata basics.**
- Given `/`, when it is fetched, then the page exports Next.js `metadata` with a JinVa-specific `title`
  and a `description` drawn from PRD §1. The current root-layout description
  ("Application for managing hard skills and services") must not be what a search engine or link preview
  shows for the landing page.
- Given a link to `/` pasted into a chat app, when it unfurls, then an OpenGraph title, description and
  image are present.

**LP12 — The landing page introduces zero new hardcoded colours.**
- Given the new landing page code, when QA greps it for literal Tailwind palette classes
  (`bg-*-[0-9]{2,3}`, `text-*-[0-9]{2,3}`, `border-*-[0-9]{2,3}`) and for hex literals (`#1c4532`,
  `#2d5a42`, `[#…]`), then there are **zero matches**. The brand green is expressed via `--primary` and
  the tokens added in DT1. This is non-negotiable for new code even while DT2's backlog is being worked
  through.

**LP13 — Artisan-role signup entry (small, tagged separately).**
- Given the artisan section's CTA, when a visitor clicks it, then `/signup` opens with the role selector
  already set to Artisan. **Engineer fix, no design input:** `src/components/auth/signup-form.tsx` holds
  role in local state (`role: ""`) with no URL-param prefill today; the CTA links to `/signup?role=ARTISAN`
  and the form reads that param on mount.
- Given a `?role=` value that is anything other than `ARTISAN` or `CUSTOMER` (or is absent), when the
  signup form mounts, then the selector stays empty and existing validation behaviour is unchanged —
  no crash, no silently-wrong role.
- If Open Question 6 is answered "don't touch the signup form", LP13 is dropped and the artisan CTA links
  plainly to `/signup`; LP3's no-dead-links criterion still applies.

**LP14 — Existing behaviour not broken.**
- Given an authenticated user of any role, when they visit `/login` or `/signup`, then they are still
  redirected to their role home (middleware's existing `isAuthPage && role` branch is unchanged).
- Given an unauthenticated visitor, when they visit any `/dashboard/*` path, then they are still
  redirected to `/login?redirect=…` (unchanged).

### PUB — Public supporting pages (required by LP9's no-dead-links rule)

Each of these is a **NEW screen → ux-designer**, but deliberately minimal: a shared simple public layout
(header + footer reused from the landing page + a prose content column), not four bespoke designs.

**PUB1 — `/terms` (Terms of Service) and PUB2 — `/privacy` (Privacy Policy).**
- Given the footer links to them, when a visitor clicks either, then a real page renders at that path with
  the shared public header/footer and readable prose.
- Given neither document exists anywhere in the repo and **no agent may author binding legal text**, when
  these pages are built, then their body copy is supplied by the user; until it is, the page renders a
  clearly-labelled "Draft — pending legal review" placeholder rather than invented terms. (Open Question 4.)

**PUB3 — `/about`.**
- Given the footer's About link, when clicked, then `/about` renders, and its content is drawn from PRD
  §1–§3 (overview, problem statement, objectives) with no invented company history, team bios, funding or
  founding dates.

**PUB4 — `/contact` (support).**
- Given the footer's Contact/Support link, when clicked, then `/contact` renders with at least one
  **working** way to reach JinVa.
- Given the only support tooling that exists today is inside the authenticated dashboard
  (`/dashboard/*/support`, `/dashboard/*/report`), when `/contact` is built, then it either exposes a real
  contact address supplied by the user, or clearly directs signed-in users to the in-dashboard support
  flow — it must not render a form that posts nowhere. (Open Question 7.)

**PUB5 — FAQ.**
- Given the footer's FAQ/Help link, when clicked, then it resolves to a working destination — recommended:
  an on-page `#faq` accordion section on `/` rather than a separate `/faq` route.
- Given the existing in-dashboard FAQ content in `src/components/dashboard/support-page.tsx` refers to the
  platform as **"Plumbify"** (leftover template copy) and describes plumbing-only services, when the
  public FAQ is written, then **none of that copy is reused verbatim** and no public-facing text contains
  the word "Plumbify". (Found during re-verification; the in-dashboard copy itself is a separate bug — see
  Out of scope.)

### R — Route-shape decision

**R1 — One written decision, applied consistently.**
- Given Open Question 1 is answered, when this round closes, then either (a) this file's "Accepted
  deviations" note records that JinVa's auth routes are `/login`, `/signup`, `/forgot-password`,
  `/reset-password?token=`, `/verify-email?token=` and that PRD §6's `/auth/*` + `/reset-password/[token]`
  shapes are **deliberately not adopted**, or (b) a separate migration ticket is opened.
- Given option (b) is chosen, when the migration ships, then all of the following change in the same
  release, and QA verifies each: the 26 hardcoded auth-path references across 10 frontend files
  (`middleware.ts` ×7 including its `matcher`, `contexts/auth-context.tsx`, `lib/api.ts`,
  `app/page.tsx`, and the five auth form components); the backend's two link builders in
  `src/mail/listeners/user-mail.listener.ts`; the Google OAuth redirect/callback configuration; and
  permanent redirects from every old path to its new one so verification and reset emails **already
  delivered to real inboxes** continue to work.
- Given either option, when this round closes, then the deviation is recorded in exactly one place so the
  next audit reads it as accepted rather than re-reporting it. (Precedent: the payments round already
  deviates from PRD §5.7's Stripe naming and records that as accepted.)

### DT — Colour design-token discipline

**DT1 — Semantic status tokens exist before anything is migrated. (ux-designer input required.)**
- Given `src/app/globals.css` today defines `--primary`, `--secondary`, `--muted`, `--accent`,
  `--destructive`, `--border`, `--input`, `--ring`, `--chart-1..5` and the sidebar set — and **no**
  success / warning / info token — when DT1 lands, then semantic tokens covering at minimum
  success, warning and info (each with the foreground/border variants the badge pattern needs) are
  defined for **both** `:root` and `.dark`, and exposed through the `@theme inline` block the same way the
  existing tokens are.
- Given those tokens, when they are used at badge scale, then each passes WCAG AA contrast against its
  own background in both themes. **The ux-designer specifies the values; engineers do not invent them.**

**DT2 — The shared status-badge helper is migrated first (highest leverage).**
- Given `src/lib/status-badges.ts` is the single source for booking, payment, dispute and
  dispute-outcome badges across the customer, artisan and admin surfaces, and given it currently uses
  light-mode-only literals (`bg-yellow-100 text-yellow-700 border-yellow-200`, `bg-green-100 …`,
  `bg-red-100 …`, `bg-blue-100 …`, `bg-orange-100 …`, `bg-gray-100 text-gray-600 …`) with **no `dark:`
  variants**, when DT2 ships, then every entry in `bookingStatusConfig`, `paymentStatusConfig`,
  `disputeStatusConfig` and `disputeOutcomeConfig` uses DT1 tokens.
- Given the dark theme, when QA views a booking list, a job detail, the customer payment history, artisan
  earnings, admin transactions and the admin disputes queue, then every status pill is legible on every
  one of those screens. (`notificationTypeConfig` in the same file already uses tokens — leave it alone.)
- Given the labels, when DT2 ships, then **no label text changes** — in particular `HELD` stays
  "Withheld", per the approved copy note in that file.

**DT3 — Dead files are deleted, not migrated.**
- Given `src/components/ui/toast.tsx`, `src/components/ui/toaster.tsx` and `src/hooks/use-toast` are
  imported by nothing outside themselves (the app uses Sonner, mounted in `src/app/layout.tsx`), and given
  `toast.tsx` carries `text-red-300 / text-red-50 / ring-red-400 / ring-offset-red-600` literals, when DT3
  ships, then those files are removed rather than token-migrated, and `npm run build` plus `npm run lint`
  stay green.

**DT4 — Genuinely broken-in-dark-mode components are fixed.**
- Given `src/components/ui/phone-input.tsx` hardcodes `bg-white`, `border-gray-200`, `text-gray-900`,
  `placeholder:text-gray-400` and `hover:bg-green-100`, when DT4 ships, then it uses
  `bg-background`/`border-input`/`text-foreground`/`text-muted-foreground`/`hover:bg-accent`, and the
  country selector and number field are both legible in dark mode.
- Given `src/components/logo.tsx` hardcodes `text-[#1c4532]` and `text-gray-400`, when DT4 ships, then the
  mark uses `text-primary` and the wordmark uses a foreground token, and the logo is legible on the light
  page background, on the dark sidebar (`--sidebar`), and in dark mode.
- Given `src/components/auth/auth-split-layout.tsx` hardcodes the brand gradient
  (`from-[#1c4532] to-[#2d5a42]`) and a stack of `text-gray-*`/`bg-white` literals, when DT4 ships, then
  it uses tokens. **Note for the ux-designer:** this file is the existing definition of JinVa's marketing
  visual language and the landing page should extend it (see UI/UX notes), so DT4 and LP should agree on
  how the brand gradient is tokenised.

**DT5 — The remaining backlog is measurable and shrinking.**
- Given the baseline measured on 2026-08-27 — **257 literal palette-class occurrences across 37 files**
  under `jinva-frontend-web/src` (repro:
  `rg -c "(bg|text|border|ring|from|to|via)-(red|green|blue|yellow|orange|purple|pink|indigo|amber|emerald|teal|cyan|sky|violet|fuchsia|rose|lime|slate|gray|zinc|neutral|stone)-[0-9]{2,3}" src`)
  — when DT5 ships, then that count is reported before and after in `qa-report.md`, and the top offenders
  are cleared: `lib/status-badges.ts` (19), `components/auth/signup-form.tsx` (31),
  `app/dashboard/artisan/report/page.tsx` (31), `app/dashboard/admin/report/page.tsx` (25),
  `components/auth/login-form.tsx` (19), `components/auth/verify-email-form.tsx` (14),
  `app/dashboard/user/report/page.tsx` (14), `components/auth/reset-password-form.tsx` (11).
- Given an explicit allowlist is needed for conventions that are not theme colours, when DT5 ships, then
  that allowlist is written down in one place and is short. Known candidate: `rating-stars.tsx`'s
  `fill-yellow-400 text-yellow-400` gold star — either add a dedicated rating token or allowlist it, but
  decide and record it (Open Question 2).
- Given the rule is meant to hold going forward, when DT5 ships, then a mechanical check exists (lint rule
  or a CI grep against the allowlist) so the count cannot silently climb again — this is the third audit
  round to report this same item.

### BI — Backend infrastructure (BACKEND-ONLY: no screens, no UX design, no frontend work)

**BI1 — S3 becomes the active provider in deployed environments.**
- Given `StorageProviderFactory` already returns `S3StorageProvider` when `STORAGE_PROVIDER === 's3'`, and
  given no environment sets that today, when BI1 ships, then deployed environments run on the S3 provider
  and a fresh avatar / portfolio item / verification document upload returns an absolute S3-or-CDN URL
  rather than a relative `/uploads/...` path.
- Given required configuration is missing, when the S3 provider is active without a bucket configured,
  then the existing explicit error ("`AWS_S3_BUCKET` is not configured…") surfaces as a clean 5xx with a
  logged message — never a silent success that writes nothing or a stack trace to the client.
- **No agent reads or edits any `.env` file for this.** The variable names are already documented in the
  provider's own header comment; actual values and the cutover itself are the user's action.

**BI2 — Media is served from a CDN, not the app server.**
- Given PRD §9 ("All files served from CDN (S3/Cloudinary); never proxied through app server") and given
  `src/main.ts` currently does `app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })`,
  when BI2 ships, then media responses come from the CDN/bucket domain (`AWS_S3_PUBLIC_URL_BASE`) and no
  media request is served by the NestJS process in a deployed environment.
- Given historical records may still hold relative `/uploads/...` URLs written while local storage was
  active, when BI2 ships, then those existing rows still resolve — either by keeping the static handler
  for legacy paths only, or by migrating the stored URLs. QA verifies an old record's image still loads.
  **This must not silently break existing avatars, portfolio items or verification documents.**

**BI3 — Presigned direct-to-storage upload (scope decision required).**
- Given PRD §6 specifies "Presigned URL → S3/Cloudinary — direct-to-storage, no proxying through app" and
  given uploads currently arrive as multipart through the API and are then put to storage by the server,
  when Open Question 9 is answered "build it", then the upload leg also stops passing file bytes through
  the app server, and PRD §5.4's 50MB-per-file limit still holds. Otherwise BI3 is deferred and recorded
  as an accepted deviation with BI1/BI2 delivering the CDN-delivery half.
- **This is the one BI item with a frontend consequence** (upload components would change), which is
  exactly why it needs an explicit decision before anyone starts.
- **DEFERRED — recorded 2026-08-27 (backend-engineer).** Per Open Question 9, BI3 was not built. No
  presigned-URL endpoint exists and uploads still arrive as multipart through the API, so PRD §6's exact
  upload shape is an **accepted deviation**; BI1/BI2 deliver the CDN-*delivery* half only. Nothing in the
  frontend's upload components needs to change, and `api-contract.md` is deliberately untouched.

**BI4 — Transactional email provider (blocked on an answer).**
- Given `src/mail/mail.config.ts` builds a generic nodemailer SMTP transport, and given PRD §7 names
  "SendGrid or Resend", and given whether the current SMTP host already *is* one of those cannot be
  determined without reading `.env` (prohibited), when the user answers Open Question 8, then either the
  current setup is recorded as already-compliant, or a migration is scoped.
- Given a migration is scoped, when it ships, then send failures still log and re-throw as they do today,
  verification/reset/notification emails all still send, and no message template changes.

---

## API needs (rough — backend owns the actual design)

Deliberately minimal: the flagship deliverable is a static marketing page and **needs no backend work at
all** in its default form.

- **Landing page, default shape: nothing.** No new endpoint, no auth, no data fetch. LP2 requires the page
  to render with the API down, so this is the recommended default.
- **Optional, only if Open Question 3 is answered "live":** the landing page reads the service-category
  list from the already-public, already-built `GET /services` (public read, no auth — confirmed on the
  services controller). No new endpoint, no new fields; the page just needs names. It must fall back to
  the PRD §1 static list on any failure.
- **Explicitly not needed:** any public "platform stats" endpoint. LP8 forbids fabricated numbers, and
  building real public counters is not something the user asked for — do not add one speculatively.
- **Storage (BI1–BI3):** configuration and provider selection only; no new API surface unless BI3
  (presigned upload) is approved, in which case the frontend needs a way to request an upload target and
  then confirm the completed upload. Backend designs the shape.
- **Email (BI4):** transport-layer only. No API surface change.
- **Nothing in this round changes any existing request/response shape.** If an engineer finds themselves
  altering an existing contract, stop and flag it.

---

## UI/UX notes

### General reuse rules (all deliverables)

- Component library is already installed and rich — **compose from `src/components/ui/`, don't add
  dependencies**. Available and relevant: `navigation-menu`, `sheet` (mobile nav), `accordion` (FAQ),
  `carousel` (testimonials), `card`, `badge`, `button`, `separator`, `avatar`, `aspect-ratio`, `tabs`,
  `hover-card`, `skeleton`, `empty`.
- Fonts are already wired: `GeistSans` / `GeistMono` via the root layout. Icons are `lucide-react`
  throughout. Toasts are Sonner (`import { toast } from "sonner"`), already mounted globally.
- Theme: `next-themes` with `attribute="class"`, `defaultTheme="system"`. **Every new surface must be
  designed and checked in both light and dark.** The dark palette is a real, tuned emerald-tinted theme
  (see `.dark` in `globals.css`), not an afterthought.
- Colours: tokens only (LP12/DT). `--primary` is JinVa's deep green (`oklab(32.107% -0.04748 0.01739)`,
  ≈ `#1c4532`) in light and a brighter emerald (`oklch(0.62 0.13 165)`) in dark.
- Money: see the Money/currency section — none expected on these surfaces.

### Landing page (`/`) — detailed notes for the ux-designer

**Mission.** Make a visitor who has never heard of JinVa understand it in 10 seconds, believe it in 60,
and sign up. Tone: **fancy but professional** — confident, warm, credible. Not a crypto landing page, not
a government form. This is a trades marketplace in Ghana: it must feel trustworthy to a homeowner with a
broken pipe *and* aspirational to a carpenter building a business.

**Existing visual language to extend (do not invent a new one).**
`src/components/auth/auth-split-layout.tsx` is JinVa's only existing marketing surface and already defines
the aesthetic. Extend it; the landing page and the auth screens should feel like one product:
- Deep-green brand gradient panel (currently `from-[#1c4532] to-[#2d5a42]`, to be tokenised per DT4).
- A subtle SVG grid + dot pattern overlaid at ~10% opacity on the green (the `<pattern id="grid">` /
  `<pattern id="dots">` defs in that file are directly reusable).
- Crisp white `rounded-2xl` cards with generous padding and `shadow-2xl`, floating over the green.
- Small floating "stat widget" cards (the existing "Monthly Bookings / 347" card) as depth devices.
- Restrained motion: `transition-all duration-300/500`, gentle `hover:scale-105`, one decorative blurred
  gradient orb. **Keep motion this restrained** — no parallax, no scroll-jacking, no autoplaying video.
- Caveat: that file's copy is beauty-vertical-specific ("Grow your beauty business"). JinVa is
  **all trades** (PRD §1). Match its *visual* language, not its copy.

**Section-by-section.**

1. **Sticky header.** Logo (linked to `/`) left; nav centre; actions right. Nav items — the on-page
   anchors and only these routes: `#services`, `#how-it-works`, `#for-artisans`, `#features` (or "Why
   JinVa"), `#faq`; then "Log in" (`variant="ghost"` → `/login`) and the primary CTA (default variant →
   `/signup`). Include the theme toggle — reuse the exact pattern in
   `src/components/dashboard/header.tsx` (`useTheme()` + a `mounted` state guard + Sun/Moon at
   `h-[1.1rem]`), because rendering the icon before mount causes a hydration mismatch. Under `lg`,
   collapse nav into a `Sheet` (the dashboard sidebar already uses `Sheet`-style mobile behaviour). Add a
   subtle border/blur on scroll. Every link must satisfy LP3.

2. **Hero.** One `<h1>`, one supporting paragraph, two CTAs, one visual. Headline must trace to PRD §1–§2
   (LP4). Candidate directions, all PRD-derived — pick and refine one, don't ship a mix:
   - *Capability-first:* "Find skilled, verified artisans. Book, pay and rate — all in one place."
   - *Category-first:* "Every trade, one platform. Electrical, plumbing, carpentry, painting, cleaning,
     landscaping, beauty and more."
   - *Problem-first (strongest, from PRD §2's core-gap callout):* "Hiring an artisan shouldn't depend on
     word of mouth." — supported by PRD §1's second sentence: JinVa "replaces fragmented, informal hiring
     with a structured platform for discovery, booking, payment, and reputation-building."
   Supporting paragraph should carry PRD §2's client pain (can't evaluate quality, price or availability;
   no booking or payment trail; no recourse when work goes wrong). Hero visual: the green gradient +
   pattern panel with a floating white card composition, per the existing language. **Imagery constraint:**
   the only real photos in `public/` are `artisan-in-blue-uniform.jpg`, `artisan-in-hard-hat.jpg`,
   `artisan-in-orange-vest.jpg`, `artisan-in-red-vest.jpg` and six plumbing-job photos in
   `public/portfolio/`. Design within that set — do not spec imagery that requires commissioning or
   licensing new assets.

3. **Trust strip (immediately under hero).** Short, honest reassurance row — e.g. verified artisans
   (PRD §5.3/§5.13 admin verification + verified badge), payment held until the job is confirmed complete
   (PRD §5.7 escrow), reviews only from clients with a completed job (PRD §5.8). Icons + 3–5 words each.
   **No numbers here** (LP8).

4. **Service categories (`#services`).** The PRD §1 list in PRD order — Electrical, Plumbing, Carpentry,
   Painting, Cleaning, Landscaping, Beauty — plus one "…and more" tile. A responsive grid of `Card`s or
   `Item`s: 2 columns at 375px, 4 at desktop. **Use `lucide-react` icons, not photos** — there is no photo
   for beauty, landscaping or electrical, and mixing one photo tile with six icon tiles looks broken.
   Suggested glyphs: `Zap`, `Droplet`/`Wrench`, `Hammer`, `PaintRoller`/`Paintbrush`, `Sparkles`,
   `Trees`/`Leaf`, `Scissors`, `Grid2x2Plus` for "and more". Whole tile clickable → `/signup` (LP6).
   Note: the seeded backend catalogue is Plumbing, Electrical, Hair Braiding, Carpentry, Painting, Tiling,
   Cleaning, Landscaping — close to but not identical to PRD §1 (no generic "Beauty"; adds Tiling and Hair
   Braiding). The spec follows the PRD; see Open Question 3 if the live catalogue should drive it instead.

5. **How it works (`#how-it-works`).** Two journeys, PRD §5-sourced. Recommended treatment: a `Tabs`
   control ("For clients" / "For artisans") over a numbered 4–5 step row, so the section stays compact and
   the visitor self-selects.
   - *Client:* search & filter verified artisans (§5.2) → review profile, portfolio and ratings (§5.3,
     §5.4, §5.8) → pick an available slot and request the booking (§5.5) → pay, with funds held until the
     job is confirmed complete (§5.7) → confirm completion and leave a review (§5.6, §5.8).
   - *Artisan:* create your profile with services and pricing (§5.3) → upload your portfolio (§5.4) → set
     weekly hours and block dates (§5.5) → accept or decline requests within 24 hours (§5.5) → get paid to
     your bank or mobile wallet (§5.7) → track earnings, ratings and repeat clients (§5.12).

6. **Role sections.** Three blocks, PRD §3 objective as the section headline and PRD §4 capabilities as
   the supporting bullets. Alternate image/content sides for rhythm.
   - **Clients** — §3: "transparent, trustworthy, and frictionless access to verified artisans." §4:
     search, book, pay, review, message, dispute. CTA → `/signup`.
   - **Artisans (`#for-artisans`)** — §3: "tools to build a professional reputation, manage their schedule,
     and get paid reliably." §4: portfolio, calendar, analytics, messaging, payouts. CTA → `/signup`
     (role-prefilled per LP13). This section should feel like a genuine pitch, not a footnote — artisan
     supply is the harder side of a marketplace.
   - **Admin / platform governance** — §3: "full visibility into platform activity, with tools to enforce
     quality and resolve disputes." §4: user mgmt, moderation, transactions, analytics, disputes. Frame
     this as *why the marketplace is safe* (someone verifies artisans, moderates portfolios and reviews,
     oversees transactions and resolves disputes), **not** as a product a visitor can sign up for.
     **Hard rule: no signup CTA in this section** (LP5, PRD §5.1 — admins are seeded only).

7. **Feature highlights (`#features`).** 6–9 PRD §5 capabilities as a token-styled icon-card grid:
   verified artisan badges (§5.3/§5.13), portfolio galleries with lightbox (§5.4), availability calendar
   and appointment reminders (§5.5), transparent job status timeline (§5.6), escrowed payments with card /
   mobile money / cash and emailed receipts (§5.7), reviews tied to completed jobs with a "Verified
   Booking" badge (§5.8), favourites (§5.9), in-app messaging (§5.10), notifications (§5.11), artisan
   earnings and ratings analytics (§5.12), dispute resolution (§5.13). Nothing from PRD §10's out-of-scope
   list (LP7).

8. **Trust / social proof (`#testimonials`).** 2–3 testimonial cards — `Avatar` +
   quote + name + role + a small star row (`rating-stars`). May use `carousel` on mobile.
   **This content is placeholder and must look like it** (LP8): one clearly-named constant, a comment
   marking it placeholder, and a visible "Sample content" `Badge` on the section. Design the badge so it
   reads as an intentional internal marker, and make the section trivially deletable/swappable once real
   review data exists (real reviews *are* stored — this section could later read them, but that is not in
   this round's scope).

9. **Final CTA band.** Full-width green gradient + pattern, one line of copy, two buttons ("Get started"
   → `/signup`, "Log in" → `/login`). Closes the page before the footer.

10. **Footer.** Four link columns + brand block. Columns: **Product** (How it works, Service categories,
    For artisans, Log in, Get started) · **Company** (About → `/about`) · **Support** (FAQ → `#faq`,
    Contact → `/contact`) · **Legal** (Terms of Service → `/terms`, Privacy Policy → `/privacy`). Brand
    block: logo + one-line descriptor + social icons **only if real account URLs exist** (Open Question 5).
    Bottom bar: `© {new Date().getFullYear()} JinVa. All rights reserved.` — computed, never hardcoded
    (LP9). Design the footer as a reusable component: PUB1–PUB4 reuse the same header and footer.

**Anti-requirements for the landing page** (things that would fail review): fabricated statistics or
testimonial attributions presented as real; a newsletter signup (nothing exists to receive it); pricing
tables (JinVa's fee model is a configurable platform percentage, not published tiers); a cookie-consent
banner (not asked for, and it implies a consent-management story that doesn't exist); any claim from PRD
§10's out-of-scope list; hardcoded hex or palette colours; a hero carousel that autoplays.

### PUB1–PUB4 (public supporting pages)

One shared minimal public layout: the landing page's header + footer wrapping a single readable prose
column (`max-w-3xl`, generous leading, `<h1>` + `<h2>` hierarchy). No hero, no cards, no illustrations.
These pages exist to make the footer honest, not to be designed individually. `/terms` and `/privacy` are
long-form prose; `/about` is 3–4 short PRD-derived paragraphs; `/contact` is a short block with a real
contact route. FAQ uses the existing `accordion` primitive, on `/` at `#faq`.

### DT items

No new screens. DT1 is a **design-system decision** (token values, light + dark, AA-verified) that the
ux-designer owns and hands to engineers as concrete values. DT2–DT5 are mechanical engineer fixes against
existing screens — **no design review needed** beyond DT1's values, with one exception: DT4's brand-gradient
tokenisation in `auth-split-layout.tsx` should be agreed with whoever designs the landing page so the two
surfaces stay consistent.

### BI items

**No UI. No UX design. No frontend work.** BI1, BI2 and BI4 are backend-engineer tasks with zero visual
surface. BI3 is the only one that would touch frontend upload components, which is why it is gated behind
an explicit decision (Open Question 9).

---

## Money / currency

Nothing in this round should render a monetary amount.

- The landing page must **not** show prices, fee percentages, "starting from GH₵…" figures or any other
  amount. JinVa's platform fee is a configurable percentage (PRD §5.7) and the seeded per-service prices
  are development data, not published rates. Advertising either would be a factual claim nobody approved.
- **If** any amount does end up on any surface in this round, it must render as **GH₵ via the shared
  `formatCurrency()` helper in `src/lib/utils.ts`** — never a raw number, never `$`, never `USD`, never a
  locally-formatted string. This is a standing project rule and QA checks it regardless of feature.
- DT2's payment-status badge migration touches the components that display money but must not change any
  amount, its formatting or its label — labels are explicitly frozen (`HELD` → "Withheld").

---

## Edge cases & error states

**Landing page**
- **Backend down / API unreachable:** page renders fully (LP2). This is the single most important
  robustness property — a marketing page that dies with the API is worse than no marketing page.
- **`GET /services` empty, slow or failing** (only if Open Question 3 = "live"): PRD §1 static list renders
  as fallback; no error toast, no empty grid, no layout collapse, no infinite skeleton.
- **Already-authenticated visitor opens `/`:** must not error and must not be trapped. `/` is outside the
  middleware matcher, so today they would see the marketing page with "Log in / Get started" CTAs. Clicking
  either bounces them to their role home via the existing `isAuthPage && role` branch — functional, if
  slightly odd. See Open Question 10 for whether the header should instead show "Go to dashboard".
- **Banned or suspended user opens `/`:** sees the same public page as anyone else. The landing page must
  not leak account state.
- **Deep link to an anchor that doesn't exist** (e.g. a stale `/#pricing`): page loads at the top; no
  crash, no console error.
- **JS disabled / hydration failure:** hero copy, category list and footer links are server-rendered and
  readable. Only the mobile `Sheet` nav and the theme toggle may be inert.
- **Long text / small screens:** headline doesn't clip at 320–375px; category tile labels don't truncate
  mid-word; footer columns stack rather than overflow.
- **Dark mode as the very first paint:** no flash of unreadable content; the theme toggle uses the
  `mounted` guard pattern so the icon doesn't hydration-mismatch.

**Permission boundaries (must not regress)**
- `/` and PUB1–PUB4 are public. **They must not call any authenticated endpoint, render any user-specific
  data, or expose any admin-only concept.**
- The role-mismatch protections already in place must keep working after any routing change: edge
  middleware (signed `jinva_session` cookie → `ROLE_HOME` redirect) **and** the per-layout `<RoleGuard>`.
  If Open Question 1 is answered "rename", the middleware `matcher` is the single highest-risk line in the
  change — a stale matcher silently unprotects `/dashboard/*`. QA must explicitly retest: artisan → 
  `/dashboard/admin` redirects; user → `/dashboard/artisan` redirects; unauthenticated → `/dashboard/*`
  redirects to login with the `redirect` param preserved.
- No new route may become a way to enumerate users, artisans or jobs without auth.

**Route rename (only if Open Question 1 = rename)**
- **Live emails already in inboxes** point at `/verify-email?token=…` and `/reset-password?token=…`. Those
  links must keep working, or real users are locked out. Permanent redirects are mandatory, not optional.
- Google OAuth's configured redirect URI must be updated in the same change or social login breaks.
- `lib/api.ts`'s 401-refresh path and `contexts/auth-context.tsx`'s logout redirect both hardcode
  `/login`; missing either produces an infinite redirect loop rather than an obvious error.

**Design tokens**
- Migrating a status colour must not change *which* status is shown, its label, or its icon — only the
  colour source. A badge that changes meaning is a blocker bug.
- Deleting `toast.tsx`/`toaster.tsx`/`use-toast` must not break the build or remove a toast surface that
  is actually rendering somewhere unexpected — verify with a build plus a manual pass on any screen that
  raises a toast (login errors, ban/unban, dispute actions).
- New tokens must not change the light theme's existing appearance in ways nobody asked for; if a status
  colour visibly shifts hue in light mode, that is a design decision to surface, not a silent side effect.

**Backend infra**
- **Existing media must keep resolving** after the storage cutover — old rows may hold relative
  `/uploads/...` URLs (BI2). Broken historical avatars, portfolio items or verification documents are a
  blocker.
- Storage misconfiguration must fail loudly at the point of upload with a logged, non-leaking error — never
  a silent success, and never a stack trace or bucket credential detail returned to the client.
- Email provider change must not drop or duplicate verification/reset mail; the resend cooldown
  (`RESEND_VERIFICATION_COOLDOWN_SECONDS`) and anti-enumeration behaviour on forgot-password must be
  unaffected.
- **No credential value from any environment may appear in logs, error messages, commit contents, reports
  or agent output — ever.** Reference variables by name only.

---

## Out of scope

- **`messages/[jobId]` and PRD's job-scoped thread lifecycle.** Owned by
  `docs/team/messaging-notifications/requirements.md`, which already put it out of scope with a flagged
  human decision. Not re-opened here.
- **`/dashboard/admin/users/[id]`, the admin users list merge, and suspend/activate UI.** Owned by
  `docs/team/analytics-admin-disputes/requirements.md` (AT3, AT4) and already designed in that folder's
  `design-spec.md` §10.4. Not re-scoped here.
- **Role-mismatch redirect.** Already implemented (middleware + `RoleGuard`); regression-check only.
- **A public artisan browse/search page.** Search lives at `/dashboard/user/search` behind auth. Making
  artisan discovery public is a real product and privacy decision (PRD §5.3 says the profile page is
  "accessible to any authenticated user"), not a landing-page detail. Landing CTAs therefore route to
  `/signup`.
- **Real testimonials, real review-driven social proof, and any public platform-stats counter.** LP8 ships
  labelled placeholders; wiring real data is a separate scope.
- **Blog, careers, press, pricing page, newsletter capture, live chat widget, cookie-consent banner.** None
  requested; several imply infrastructure that doesn't exist.
- **Anything on PRD §10's v2.0 out-of-scope list** (loyalty/rewards, promo tools, native mobile app,
  WebSocket messaging, map view, multi-language) — including *advertising* any of it on the landing page.
- **Fixing the "Plumbify" brand leak and plumbing-only copy inside the authenticated
  `dashboard/support-page.tsx` FAQ.** Real bug, found during re-verification, but it is dashboard content,
  not this cluster. PUB5 only forbids reusing that copy publicly. Worth its own small ticket.
- **Rewriting `auth-split-layout.tsx`'s beauty-vertical copy** ("Grow your beauty business" on a
  general-trades platform). Noted as an inconsistency; only its *colour* literals are in scope (DT4).
- **Making the platform fee runtime-configurable**, PRD's geographic-distribution analytics, and portfolio
  view tracking — all already flagged as open questions in the analytics/admin round.
- **Any `.env` / `.env.*` file, in either repo, for any reason.** BI1/BI2/BI4 name variables; the user sets
  values. No agent opens, greps, tails or otherwise inspects those files.

---

## Open questions

Ranked by how much they change scope. 1, 3, 4, 8 and 9 should be answered before build starts.

1. **Do the auth routes move to PRD §6's `/auth/*` prefix (and `/reset-password/[token]`), or is the
   current shape recorded as an accepted deviation?**
   **DECISION (user, 2026-08-27): keep the current routes — recorded as an accepted deviation, no rename.**
   This mirrors how the payments round already deviates from PRD §5.7's Stripe naming and records it as
   accepted. R1(a) applies: `/login`, `/signup`, `/forgot-password`, `/reset-password?token=`,
   `/verify-email?token=` stand as JinVa's auth route shapes going forward; the next PRD audit should read
   this as accepted, not re-report it.
2. **Is the gold rating star (`fill-yellow-400 text-yellow-400` in `rating-stars.tsx`) a token or an
   allowlisted convention?** *Recommendation:* add a dedicated rating token so dark mode is controllable,
   but either answer is fine as long as it is written down once (DT5).
3. **Should the landing page's category showcase be the static PRD §1 list, or read live from the public
   `GET /services`?** **DECISION: static PRD §1 list** (PM's recommendation, accepted by default) — it is
   the marketing message, it can't break, and it satisfies LP2. The live catalogue genuinely differs (it
   has Tiling and Hair Braiding, and no generic "Beauty"), so the two would visibly disagree; revisit if
   the user wants the live catalogue to drive it instead.
4. **Who supplies the Terms of Service and Privacy Policy copy?** **DECISION (user, 2026-08-27): ship as
   visibly labelled "Draft — pending legal review."** No agent authors binding legal text; real copy must
   be supplied and swapped in before any public launch. A marketplace handling payments and personal data
   with no published terms or privacy policy is a real compliance exposure, not just a missing page — this
   is a placeholder, not a resolution of that exposure.
5. **Does JinVa have real social media accounts, and what are the URLs?** **DECISION: none supplied — omit
   the social icon row.** "All navs work" leaves no room for an icon linking to `#`; revisit if real
   account URLs surface later.
6. **Is it acceptable to add `?role=` prefill support to the signup form (LP13)?** **DECISION: yes** (PM's
   recommendation, accepted by default) — it is a few lines and the artisan CTA is much stronger for it.
7. **What should `/contact` actually do?** **DECISION: no real support email was supplied, so none is
   invented.** `/contact` directs signed-in visitors to the existing in-dashboard support flow and gives
   everyone else a clear "sign up to reach support" path — it must not fabricate a contact address, per the
   same no-fabrication rule as LP8. Revisit with a real address if one is supplied later.
8. **Is the currently-configured SMTP host already SendGrid or Resend?** **DECISION (user, 2026-08-27): no
   — it's a different SMTP provider.** BI4 is a real backend migration ticket to SendGrid or Resend, not an
   already-compliant closure.
9. **Is PRD §6's presigned direct-to-storage upload in scope (BI3), or is CDN *delivery* (BI1/BI2) enough
   for now?** **DECISION (user, 2026-08-27): CDN delivery only — ship BI1/BI2, defer BI3.** The presigned
   upload leg (which would change frontend upload components and interacts with the security round's
   MIME/extension hardening at the server-side put) is formally deferred and recorded as an accepted
   deviation from PRD §6's exact upload shape.
10. **Should the landing header detect an existing session and show "Go to dashboard" instead of
    "Log in / Get started"?** **DECISION: no** (PM's recommendation, accepted by default) — keep `/` fully
    static and public (protects LP2, keeps it cacheable); an authenticated visitor clicking "Log in" is
    already bounced to their dashboard by the existing middleware.
11. **Is the landing page expected to ship before or alongside the DT token cleanup?** **DECISION: DT1**
    (token definitions only) **lands with the landing page; DT2–DT5's sweep follows separately** (PM's
    recommendation, accepted by default).

---

## Definition of Done

**Scoping / documentation**
- [x] Open Questions 1, 3, 4, 8 and 9 answered and recorded in this file before build starts (user,
      2026-08-27; see "Open questions" above). Questions 2, 5, 6, 7, 10 and 11 resolved by accepting the
      PM's stated recommendation by default, also recorded above.
- [x] The route-shape decision (R1) is written down once, in one place (Open Question 1: keep current
      routes, accepted deviation), so the next PRD audit reads it as accepted rather than re-reporting it.
- [ ] This file's "Re-verification results" table is the record of what was dropped and why — the audit's
      items 2c, 3 and 4 are **not** re-scoped here.

**Backend (BI items only — no UI)** — *backend-engineer, 2026-08-27*

- [x] **BI1 — the S3 cutover path is production-ready.** The code half is done; **activating it is not an
      engineer action and was not performed** (see the open item below). What changed in
      `src/uploads/providers/`:
      - Every AWS SDK failure on upload is now translated into a fixed generic 5xx
        (`"File storage is temporarily unavailable. Please try again later."`). Previously they propagated
        raw, and `AllExceptionsFilter` returns an exception's own message to the client whenever
        `NODE_ENV !== 'production'` — S3 error payloads can carry access-key identifiers and bucket ARNs.
      - `AWS_S3_REGION` is now validated, not just documented. Left unset, the SDK could still pick a
        region up from an ambient `AWS_REGION` and upload *successfully* while the URL written to the
        database embedded `undefined` as the host segment — a silently-wrong success that breaks the asset
        permanently.
      - The bucket check is now a deliberate `InternalServerErrorException` rather than a bare `Error` that
        only became a 500 by accident of the global filter, and a whitespace-only value counts as unset.
      - New `IStorageProvider.missingConfiguration()` (names, never values) lets
        `StorageProviderFactory` log a misconfigured cutover **at boot**. Non-fatal on purpose, because
        BI1's own criterion requires the failure to surface as a 5xx at the point of upload.
      - Logs record the AWS error *name* and HTTP status only — never the SDK message or stack.
- [x] **BI2 — media is no longer unconditionally served by the app process.** `main.ts`'s blanket
      `useStaticAssets` is replaced by `applyLegacyMediaServing()` in `src/uploads/legacy-media.config.ts`,
      whose header comment carries the full reasoning. **Chose "keep the static handler for legacy paths
      only" over "migrate the stored URLs"**: the legacy files live on the app server's disk and *not* in
      the bucket, so a migration could rewrite the URL columns but could not copy the bytes — every
      rewritten row would 404, irreversibly. The two URL shapes already self-distinguish (local = relative
      `/uploads/...`, S3 = absolute), so once `STORAGE_PROVIDER=s3` nothing new can be written under
      `/uploads` and that prefix becomes a closed, read-only set that only shrinks. **No schema change, no
      row touched, so no historical media can break.** The handler is also hardened (no directory index,
      no redirects, `nosniff`, year-long immutable caching since filenames are UUIDs).
      `test/legacy-media-serving.e2e-spec.ts` is the regression guard for the blocker: it boots the real
      app with `STORAGE_PROVIDER=s3` and proves a pre-cutover file still returns 200.
- [x] **BI3 — deferred, per Open Question 9's recorded decision.** Not built. No presigned-URL endpoint
      exists; uploads still arrive as multipart through the API. Recorded here and in this file's BI3
      criterion as an accepted deviation from PRD §6's exact upload shape.
- [x] **BI4 — scoped and built as a real migration**, per Open Question 8's recorded decision (the current
      SMTP host is not already SendGrid or Resend). `src/mail/providers/` now mirrors the storage
      abstraction exactly: `IMailProvider` + `MailProviderFactory` selecting on `MAIL_PROVIDER`, the same
      shape as `IStorageProvider` + `StorageProviderFactory` selecting on `STORAGE_PROVIDER`.
      `SmtpMailProvider` wraps the existing untouched `createTransporter` and remains the **default**, so
      an environment that has not set the new variable is unaffected. `ResendMailProvider` is the new
      option, on Resend's official Node SDK (`resend`, added to `package.json`).
      - The trap worth knowing: `resend`'s `emails.send()` does **not** throw on an API-level rejection, it
        resolves with `{ data: null, error }`. The provider inspects `error` and throws, so
        `MailService`'s log-and-re-throw is preserved rather than silently reporting phantom successes for
        every unsent verification email.
      - Unchanged on purpose and covered by `src/mail/mail.service.spec.ts`: every template and subject,
        the plain-text derivation, template rendering staying outside the try block, and the
        `RESEND_VERIFICATION_COOLDOWN_SECONDS` cooldown (a constant in `variables.constants.ts`, not
        configuration). Forgot-password anti-enumeration is untouched — mail is still dispatched through
        the event emitter, so no send outcome can change an auth response.
- [x] No `.env` file was read, opened, grepped or modified. Not for BI1, BI2 or BI4 — none of them needs a
      live DB or a real credential.
- [x] No credential value appears in any log, error, report, commit or agent output. Every new diagnostic
      names variables only, and the new specs assert this (a fake key planted in a simulated AWS/Resend
      error must not appear in either the thrown message or the log line).
- [x] `api-contract.md` **not** created/updated — correct, since BI3 was not approved and nothing in
      BI1/BI2/BI4 changes any request or response shape.
- [x] Backend `npm run lint` (0 errors; 25 pre-existing warnings in untouched spec files), `npm run build`
      and `npm run test` (**319/319 pass, 37 suites**) all green.
- [x] `npm run test:e2e` — **this round introduced zero new failures**, verified by running the suite on
      the pre-round commit (`41815ba`) and getting the *identical* result: 7 failures in
      `messaging-notifications` (AD2 / PD4 / PR3 — dispute resolve returns 400) and
      `analytics-admin-disputes` (AN1 / AP4 / AN3 / AT3 — `GET /admin/analytics` 500s on a
      `PlatformAnalyticsCacheService` SQL error, *"syntax error at or near `.`"*, logged on every boot).
      **Both belong to the analytics/admin/disputes round, not this one** — flagged for that owner rather
      than fixed here. New `test/legacy-media-serving.e2e-spec.ts` passes (6/6).
      - Note for whoever runs the suite next: it must be run via `npm run test:e2e`, not a bare
        `npx jest --config test/jest-e2e.json`. The script's `--experimental-vm-modules` flag is required
        for `loadEsm('file-type')`, and without it every upload endpoint 500s and ~14 tests fail for a
        reason that has nothing to do with the code under test. Running it with `--runInBand` also avoids
        cross-suite DB contention (10 suites each booting the whole app against one Postgres).

**Still open — operator actions, deliberately not taken by an engineer:**
- [ ] Set `STORAGE_PROVIDER=s3` (plus `AWS_S3_BUCKET`, `AWS_S3_REGION`, optionally
      `AWS_S3_PUBLIC_URL_BASE` and the access key/secret pair) in the deployed environments. Until this
      happens, BI1's *"deployed environments run on the S3 provider"* and BI2's *"media responses come
      from the CDN/bucket domain"* remain unmet — by design; the values and the cutover are the user's.
- [ ] Optional, after the cutover: copy the existing on-disk `uploads/` tree into the bucket and set
      `SERVE_LEGACY_UPLOADS=false` to reach BI2's literal *"no media request is served by the NestJS
      process"*. Defaults to **on** so flipping `STORAGE_PROVIDER` alone can never break existing media.
- [ ] Set `MAIL_PROVIDER=resend` + `RESEND_API_KEY` (and keep `MAIL_FROM` on a domain verified in Resend)
      to complete BI4's migration. Leaving `MAIL_PROVIDER` unset keeps the current SMTP transport.
- [ ] **New environment variable names introduced this round** — names only, no values anywhere:
      `SERVE_LEGACY_UPLOADS`, `MAIL_PROVIDER`, `RESEND_API_KEY`.

**Design (ux-designer)**
- [ ] Landing page design covering all ten sections in the UI/UX notes, in **both light and dark**, at
      375 / 768 / 1024 / 1440, composed from existing `src/components/ui/` primitives and named explicitly.
- [ ] Shared minimal public layout for PUB1–PUB4 (reusing the landing header/footer).
- [ ] DT1 semantic status token values (success / warning / info + variants) specified for `:root` and
      `.dark`, each AA-verified at badge scale.
- [ ] Brand-gradient tokenisation agreed between the landing page and DT4's `auth-split-layout.tsx` fix.
- [ ] Every landing-page claim annotated with the PRD section it came from.

**Frontend** — built 2026-08-27 (frontend-engineer). Verified against a **production build**
(`npm run build` + `npm start`), driven in headless Chrome, in both themes, at 320/375/768/1024/1440.

- [x] LP1–LP12 all pass. LP13 passes (Open Question 6 = yes).
      - LP1: `/` is `src/app/(public)/page.tsx`; the old `src/app/page.tsx` redirect is deleted. Static
        prerender (`○ /`), still outside the middleware matcher.
      - LP2: measured — `/` issues **0 off-origin requests and 0 API-path requests**. Renders identically
        with the backend stopped.
      - LP3/LP9: all **22** header + footer links clicked individually; every route 200, every one of the
        6 on-page anchors lands 80px from the viewport top (`scroll-mt-20` clearing the `h-16` header).
        Zero `href="#"`, zero `javascript:void(0)`, zero 404s.
      - LP4: exactly one `<h1>`; both CTAs above the fold at 1440×900 and 375×812.
      - LP5: `#platform-governance` contains no signup link of any kind.
      - LP10: no horizontal scroll at any of the five widths; heading levels descend without skipping;
        every header control keyboard-reachable in visual order with a visible focus ring; all images
        have `alt`.
      - LP11: root metadata description replaced; `/` and each public page set their own title +
        description; OG card generated via `next/og`.
      - LP12: zero palette classes and zero hex literals in any new file — enforced by
        `npm run check:colors`.
      - LP13: verified in prod for `ARTISAN`/`CUSTOMER`, and for absent / empty / `ADMIN` / lowercase /
        mixed-case / script payload / null byte / `?ROLE=`, all of which leave the selector empty with no
        console error.
- [x] PUB1–PUB5 exist and **every single header and footer link resolves** — all 22 clicked one at a
      time from `/`, and every footer anchor re-clicked from `/terms`, `/about`, `/privacy` and
      `/contact` to prove the root-relative `/#anchor` form (design-spec §3.12's flagged risk).
- [x] DT1 tokens defined (`--success`/`--warning`/`--attention`/`--info` + `-foreground` pairs, plus
      `--brand`/`--brand-accent`/`--brand-foreground` and `--rating`); DT2 (`status-badges.ts`) migrated
      per design-spec §1.3 with labels and icons frozen; DT3 dead toast files deleted (all four:
      `ui/toast.tsx`, `ui/toaster.tsx`, `ui/use-toast.ts`, `hooks/use-toast.ts`); DT4 (`phone-input`,
      `logo`, `auth-split-layout`) fixed, with the SVG pattern extracted to
      `components/brand/brand-pattern.tsx`.
      - Contrast **measured in-browser through the real cascade** (not derived): all four new tokens pass
        AA in both themes at badge scale — warning 5.84 / 10.11, success 6.07 / 9.86, attention
        6.24 / 7.57, info 7.42 / 6.87 (light / dark).
      - ⚠️ **Two pre-existing token pairs measure below AA in light mode and DT2 widened their use.**
        `bg-destructive/10 text-destructive` = **3.97:1** and `bg-muted text-muted-foreground` =
        **4.35:1** (both fine in dark: 5.22:1). Not introduced here — `--destructive` and
        `--muted-foreground` are pre-existing and design-spec §1.3 mandates the mapping — but
        `CANCELLED`/`DECLINED`/`REFUND_CLIENT` and `EXPIRED`/`REFUNDED`/`CLOSED`/`MUTUAL` were slightly
        *better* on the old literals in light mode. **Needs a ux-designer decision** (deepening either
        token changes every destructive/muted surface in the product), so it is left as-is and flagged
        rather than silently changed. Same class of finding as design-spec §1.4.
- [x] DT5: before/after literal-colour counts reported, top offenders cleared, allowlist written down,
      and a mechanical check added so the count cannot silently climb again.
      - **Before:** 257 matching lines / **412 individual occurrences** across **37 files** (the doc's
        `rg -c` repro sums to 257 because it counts matching *lines*, not occurrences).
      - **After:** **0**, in both measures, outside the allowlist. All eight named top offenders cleared.
      - **Allowlist — 4 files, recorded with its reasons in `jinva-frontend-web/scripts/check-color-tokens.mjs`**
        (the single authoritative place; the script enforces it):
        `src/app/opengraph-image.tsx` (Satori runs outside the CSS cascade and cannot read
        `var(--brand)`) · `src/app/globals.css` (where the tokens are defined) ·
        `src/app/global-error.tsx` (self-contained `<style>` that must survive the stylesheet failing to
        load) · `src/components/ui/chart.tsx` (unmodified shadcn; its hexes are *attribute selectors*
        matching Recharts' defaults in order to override them).
      - Open Question 2 answered **"token, not allowlist"**: the gold star is `--rating`
        (`fill-rating text-rating`).
      - Check: `npm run check:colors`, chained as `npm run verify` ahead of lint and build. It ignores
        comments (so a migration note can still quote the literal it replaced) and does not flag
        `bg-black/50` scrims or `text-white` over a photo, which carry no numeric shade.
- [x] Zero new hardcoded palette classes or hex literals in any file touched this round.
- [x] `npm run lint` (0 errors; 5 pre-existing warnings, none in new code) and `npm run build` green;
      manually verified in a browser in both themes, including the mobile `Sheet` opening, navigating and
      closing, and the reduced-motion path.
- [x] **Entrance/scroll animation respects `prefers-reduced-motion`** (user requirement, LP10/WCAG AA).
      Measured under emulated `prefers-reduced-motion: reduce`: of 42 `[data-reveal]` elements and 5
      `[data-enter]` elements, **0 are hidden**, and `html { scroll-behavior }` drops to `auto`. The
      hidden state is additionally guarded by `scripting: enabled`, so a visitor with JS off also gets
      the content immediately.

**QA**
- [ ] `/` renders fully with the backend stopped (LP2).
- [ ] Every header and footer link clicked individually: zero 404s, zero `href="#"`, zero dead anchors.
- [ ] Keyboard-only pass through the entire landing page; visible focus throughout; mobile `Sheet` nav
      opens, navigates and closes.
- [ ] Both themes checked on `/`, PUB1–PUB4, and on every screen DT2 touches (booking list, job detail
      customer + artisan, customer payment history, artisan earnings, admin transactions, admin disputes).
- [ ] No fabricated statistic anywhere on any public page; the placeholder trust section is visibly marked.
- [ ] Admin section contains no signup CTA.
- [ ] **Role-boundary regression suite re-run** (these already work — prove they still do): artisan →
      `/dashboard/admin` redirects to `/dashboard/artisan`; user → `/dashboard/artisan` redirects to
      `/dashboard/user`; unauthenticated → `/dashboard/*` redirects to `/login?redirect=…`; authenticated
      → `/login` redirects to role home.
- [ ] Existing media (avatar, portfolio item, verification document) uploaded before the storage cutover
      still loads afterwards.
- [ ] Zero open blocker/major bugs in `qa-report.md`.

**Security**
- [ ] `/` and PUB1–PUB4 call no authenticated endpoint and leak no user, artisan, job or admin data.
- [ ] Adding public routes did not widen the middleware matcher's gap — `/dashboard/*` is still fully
      covered, and the signed-session verification path is unchanged.
- [ ] Storage cutover exposes no bucket credentials, no internal paths and no stack traces in responses;
      uploaded-file extension/MIME hardening is preserved by whichever provider is active.
- [ ] No secret value present in code, logs, docs or commit history.
- [ ] Zero open critical/high findings in `security-report.md`.
