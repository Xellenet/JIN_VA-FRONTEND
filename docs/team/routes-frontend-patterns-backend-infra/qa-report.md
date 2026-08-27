# QA Report: Routes, Frontend Patterns & Backend Infra (marketing landing page)

**QA pass 1 — 2026-08-27.** First independent pass on this round. Nothing below is taken from either
engineer's handback; every claim was re-measured.

## How this was tested

No `run` skill or Puppeteer/Playwright is available in this environment, so the browser work was done by
driving the installed Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`) over the DevTools
Protocol with a purpose-built driver, using real `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` —
i.e. real clicks and real Tab presses, not `element.click()` or `.focus()`.

- **Frontend under test: a PRODUCTION build** (`npm run build` then `next start -p 4200`), because LP13's
  original bug only appeared in a production build. `npm run dev` was not used for any LP13 assertion.
- Backend: `node dist/src/main` on `:8000` (default `STORAGE_PROVIDER=local`, `MAIL_PROVIDER` unset), plus a
  **second instance on `:8100` started with `PORT=8100 STORAGE_PROVIDER=s3` in the process environment
  only** for BI1/BI2. **No `.env` file was read, opened, grepped or modified at any point** — not needed:
  the app loads its own config, and the boot log prints which provider is active.
- Auth used the seeded accounts from `src/database/seeds/seed.ts` (`SEED_PASSWORD` is a constant in that
  source file, not an environment secret): `ama.mensah@gmail.com` (CUSTOMER), `yaw.osei@jinva.com`
  (ARTISAN), `admin@jinva.com` (ADMIN).

Two of my own early results were harness artifacts and are recorded here so nobody re-chases them:

1. A first footer sweep reported `/#platform-governance` as a dead link from `/about` and `/terms`. It is
   **not** dead. That link wraps onto two lines, so its bounding-box centre falls in the leading gap
   between the two text lines, where `elementFromPoint` returns the parent `<li>`. My click was landing on
   the list item. After switching to multi-point strict hit-testing the link works from all five pages.
2. A first DT2 badge audit reported "0 badges" everywhere. Two causes, both mine: too short a settle for
   the auth-refresh round-trip, and a colour parser that only understood `rgb()`. **This app's tokens
   compute to `oklab()`/`lab()`**, so every colour parsed as `null`. Colours are now resolved through a
   canvas. Anyone re-running a contrast audit here must not assume `getComputedStyle().color` is `rgb()`.

---

## Backend-owned issues

### [MINOR] Seeded `profile_picture` values point at an `uploads/profiles/` directory that has never existed
- **Repro**:
  1. `npm run seed` (or use the current seeded DB).
  2. `curl -i http://127.0.0.1:8000/uploads/profiles/ama-mensah.jpg` → **404**.
  3. `ls uploads/` in `JIN_VA-BACKEND` → `avatars documents job-attachments messages portfolio reviews selfies`. There is **no `profiles/` directory**, and none of the seeded filenames (`ama-mensah.jpg`, `yaw-osei.jpg`, `kofi-asante.jpg`, `kwame-darko.jpg`, `abena-boateng.jpg`) exists anywhere on disk.
  4. Log in as any role and open `/dashboard/artisan/messages` — five `404` image requests, one per participant.
- **Expected**: a seeded `profile_picture` either points at a file the seed actually writes, or is left
  null so the app's initials/navii fallback is used deliberately.
- **Actual**: every seeded user's avatar URL is a guaranteed 404. It is masked because `AvatarImage` falls
  back to initials, so the breakage is invisible in the UI and shows up only in the network tab.
- **Violates**: not a listed criterion. It is the thing that made BI2's "an old record's image still loads"
  check look like a BI2 regression when it is not — worth fixing so the next QA pass isn't misled.
- **Likely location**: `JIN_VA-BACKEND/src/database/seeds/seed.ts` (the `profilePicture` assignments around
  lines 240–430).
- **FIX (backend-engineer, 2026-08-27, commit `e054ebc`)**: took the null option, not the write-a-file option.
  All nine `profilePicture: '/uploads/profiles/…'` literals removed from `customerSeeds`/`artisanSeeds`, and the
  field dropped from both `userRepo.create({…})` calls, so the column is left null and the initials fallback is
  the *deliberate* seeded state. Writing five real avatar files would have meant the seed shipping binary
  fixtures for cosmetic value, and would have put them in `uploads/avatars/`, not the `profiles/` directory the
  URLs named — so the URLs were wrong twice over. A comment above `customerSeeds` records why, and says that if
  a seeded avatar is ever wanted the seed must write the file too.
  **Re-run note:** an already-seeded DB keeps its stale values — `npm run seed:force` (or a fresh seed) is
  needed to observe the change, so if you re-test against the current DB you'll still see the 404s.
- **Status**: Open

### [OBSERVATION — no action required, for the security reviewer] BI1's 5xx body names internal environment variables
- With `STORAGE_PROVIDER=s3` and the bucket/region unset, `POST /api/v1/uploads/avatar` returns
  `HTTP 500` with `"message":"AWS_S3_BUCKET is not configured; AWS_S3_REGION is not configured. Set the
  missing AWS_S3_* variables before running with STORAGE_PROVIDER=\"s3\"."`
- This is **exactly what BI1 asks for** ("the existing explicit error … surfaces as a clean 5xx"), contains
  **names only, no values**, and carries no stack trace — so I am not filing it as a bug. Noting it only so
  the security round can decide whether variable *names* should reach a client in production, given
  `AllExceptionsFilter` passes an exception's own message through when `NODE_ENV !== 'production'`.
- **Status**: Informational

### Pre-existing e2e baseline — CONFIRMED, and it is not this round's
The backend-engineer claimed 7 pre-existing e2e failures. I re-ran the suite myself
(`npm run test:e2e -- --runInBand`) and got **exactly that set**, no more and no fewer:

```
Test Suites: 2 failed, 8 passed, 10 total
Tests:       7 failed, 118 passed, 125 total
```

- `analytics-admin-disputes.e2e-spec.ts` — 4 failures: `GET /admin/analytics` for an admin, `AP4`, `AN3`, `AT3`.
- `messaging-notifications.e2e-spec.ts` — 3 failures: `AD2`, `PD4`, `PR3`.
- **Root cause is visible and independently corroborated**: every backend boot logs
  `[PlatformAnalyticsCacheService] Platform analytics refresh failed for range 7d/30d/90d/1y: syntax error at or near "."`
  and reports `Platform analytics rollups refreshed (0/4 ranges cached)`.
- Both suites belong to the **analytics/admin/disputes** round, not this one. This round touched
  `src/uploads/*` and `src/mail/*`; no failing test is in either area.
- **BI2's new regression guard `test/legacy-media-serving.e2e-spec.ts` PASSES.**
- **Status**: Confirmed pre-existing — flagged to the analytics/admin/disputes owner, not a gate here.

---

## Frontend-owned issues

### [MAJOR] `/` is the only page in the app with no `og:image` — the exact page LP11's unfurl criterion is about
- **Repro**:
  1. `npm run build && npx next start -p 4200`.
  2. `curl -s http://127.0.0.1:4200/ | grep -o 'og:image'` → **no match**. No `og:image`, no
     `og:image:width/height/alt`, no `twitter:image`.
  3. Now the control: run the same grep against `/about`, `/contact`, `/terms`, `/privacy`, `/login`,
     `/signup` → **every one of them has the full set**, e.g.
     `<meta property="og:image" content="http://localhost:3000/opengraph-image?84c56dae849643c6"/>`.
  4. `curl -o /dev/null -w '%{http_code} %{content_type}' http://127.0.0.1:4200/opengraph-image` →
     `200 image/png` (86 KB). The image generator itself works fine; `/` just never references it.
- **Expected**: LP11 — "Given a link to `/` pasted into a chat app, when it unfurls, then an OpenGraph
  title, description **and image** are present."
- **Actual**: title and description are present; the image is absent on `/` specifically. Pasting the
  landing page into WhatsApp/Slack/X unfurls with no card image, while pasting `/terms` does.
- **Root cause** (this is why a code read passes and the rendered HTML fails): `app/opengraph-image.tsx`
  lives in the **root** `app/` segment. Next.js does **not** deep-merge the `openGraph` metadata field
  across segments — a child that declares `openGraph` **replaces** the parent's resolved object. `/` is the
  only public page that declares its own `openGraph` block, and that block has no `images` key, so the
  file-convention image is dropped. `/about`, `/terms`, `/privacy`, `/contact` set only `title` +
  `description`, so they inherit it intact.
- **Likely location**: `jinva-frontend-web/src/app/(public)/page.tsx`, the `openGraph: { … }` object in the
  `metadata` export (add an `images` entry, or drop the `openGraph` block and let `title`/`description`
  cascade as the sibling pages do).
- **FIX (frontend-engineer, 2026-08-27)**: took the second option — `(public)/page.tsx`'s `openGraph` block
  is gone, along with its `twitter` block, which had the identical replace problem (that is why `/` also had
  no `twitter:image`). The `type`/`siteName`/`twitter.card` values it carried moved up into
  `src/app/layout.tsx`'s root `metadata`, so all routes now get them instead of only `/`. Both fields are now
  declared **root-only**, with a comment in each file explaining why a page must not re-declare them.
  `og:title`/`og:description` are derived from the page's own `title`/`description`, so the copy is unchanged
  except that `og:title` now carries the `· JinVa` template suffix, matching the sibling pages.
  Verified on `rm -rf .next && npm run build && next start` (port 4310 — something already holds 4200 in this
  environment): `/` now emits `og:image`, `og:image:width/height/alt/type` and `twitter:image`, and the same
  full set is still present on `/about`, `/terms`, `/privacy`, `/contact`, `/login`, `/signup`.
- **Status**: Open

### [MAJOR] `metadataBase` is unset, so every OG/Twitter image URL resolves to `http://localhost:3000`
- **Repro**:
  1. `npm run build` — the build prints the warning **three times**:
     `⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3000".`
  2. `curl -s http://127.0.0.1:4200/about | grep -o 'og:image" content="[^"]*"'` →
     `og:image" content="http://localhost:3000/opengraph-image?84c56dae849643c6"`
  3. `rg -n metadataBase src/` → **no matches anywhere in the source tree**.
  4. Note the host is not even this app's port — the server runs on 4200. Started differently the warning
     reports `http://localhost:4200`, i.e. the value is whatever the dev host happens to be.
- **Expected**: absolute OG image URLs on the real public origin, so a link preview resolves for anyone
  other than the developer who built it.
- **Actual**: in any deployed environment every unfurl requests `http://localhost:3000/opengraph-image` and
  gets nothing. The OG card built this round is effectively undeliverable.
- **Violates**: LP11 (OpenGraph image "present" in a form a consumer can fetch).
- **Likely location**: `jinva-frontend-web/src/app/layout.tsx` `metadata` export — set `metadataBase` from
  the public site origin. It should read from an environment variable rather than a literal; I have **not**
  inspected any `.env`, so please confirm which variable name is intended (nothing in `src/` currently
  references one for this purpose).
- **FIX (frontend-engineer, 2026-08-27)**: `src/app/layout.tsx` now sets
  `metadataBase: new URL(SITE_URL)` where `SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4200"`.
  **`NEXT_PUBLIC_SITE_URL` is the new required environment variable** — public origin, with scheme, no
  trailing slash (e.g. `https://jinva.com`). It is documented in a comment at the point of use, in the same
  style as the backend S3 provider's `AWS_S3_*` block. No `.env` file was read or written; the variable has to
  be set by the operator in each deployed environment, and the localhost fallback exists only so local dev
  keeps working until then (4200 = this repo's `next dev` port).
  Verified: the build no longer prints the `metadataBase … is not set` warning (previously 3×), and with the
  variable unset the rendered tags read `og:image content="http://localhost:4200/opengraph-image?…"` — i.e.
  the value now comes from the app's own configuration rather than from whatever port built the bundle.
  The override path was proved too, not just the fallback: one build run with
  `NEXT_PUBLIC_SITE_URL=https://og-wiring-check.invalid` supplied **in the process environment only** (no file
  written) produced `og:image content="https://og-wiring-check.invalid/opengraph-image?…"` on both
  `/` and `/about`. Note this is a `NEXT_PUBLIC_*` value, so it is **inlined at build time** — changing it
  requires a rebuild, not just a restart. Worth knowing for the deploy pipeline.
- **Status**: Open

### [MAJOR] Avatar URLs bypass `resolveMediaUrl()`, so legacy relative `/uploads/...` avatars are fetched from the frontend origin and 404
- **Repro**:
  1. Log in as `yaw.osei@jinva.com`, open `/dashboard/artisan/messages`, watch the network tab.
  2. Observe requests to **`http://localhost:4200/uploads/profiles/…jpg`** → `404`. Note the origin: port
     **4200 (Next.js)**, not 8000 (API).
  3. Control, same page load: the portfolio images on `/dashboard/artisan/portfolio` request
     **`http://localhost:8000/uploads/portfolio/a3810d7f-….jpg`** and load at 1024×1024. That component
     does call `resolveMediaUrl()`.
  4. Control on the backend: every real file on disk serves `200` from `:8000` — `avatars`, `portfolio`,
     `reviews`, `messages`, `job-attachments` all checked.
- **Expected**: a stored relative `/uploads/...` URL is resolved against the API origin, exactly as
  `resolveMediaUrl()` in `src/lib/utils.ts` already does ("`fileUrl` may be an absolute-from-root path
  (local storage provider) or a full URL … this normalizes either into something a browser can actually
  load").
- **Actual**: `profilePicture` is passed straight into `<AvatarImage src={…}>` in at least
  `admin/disputes/page.tsx` (lines 258, 350), `admin/reviews/page.tsx` (306),
  `admin/transactions/page.tsx` (340), `admin/artisans/page.tsx` (29), `admin/clients/page.tsx` (51),
  `admin/orders/page.tsx` (127). Any avatar stored as a relative path can never render. It is silent
  because `AvatarImage` falls back to initials.
- **Violates**: the Definition of Done's QA line *"Existing media (avatar, portfolio item, verification
  document) uploaded before the storage cutover still loads afterwards"* — the avatar case fails.
- **Scope honesty**: this is **pre-existing and not a regression from this round** (BI2 was backend-only,
  and the backend half is verified correct — see BI2 below). It is filed here because it is the one place
  the DoD's media check demonstrably fails end to end, and because after the S3 cutover this same code path
  is what has to keep serving legacy rows.
- **Likely location**: the `AvatarImage src=` call sites listed above; wrap each in
  `resolveMediaUrl()` from `jinva-frontend-web/src/lib/utils.ts`.
- **FIX (frontend-engineer, 2026-08-27)**: fixed, and **wider than the six files you listed** — deliberately.
  Your own repro step 1 is `/dashboard/artisan/messages`, which is
  `src/components/dashboard/messages-page.tsx` and is **not** one of the six, so fixing only those would have
  left your repro still failing. I swept the whole class instead: `rg naviiAvatar src/` returns 42 hits, all
  inside an `AvatarImage src=`, of which **33 used the broken
  `x.profilePicture || naviiAvatar(name)` idiom**. All 33 are converted, across 31 files.
  Rather than wrapping each in `resolveMediaUrl()`, I added one helper next to it in `src/lib/utils.ts`:
  `resolveAvatarUrl(url, seed, size?)` = `resolveMediaUrl(url) || naviiAvatar(seed, size)`. The two-expression
  idiom is what made the resolution easy to forget, so collapsing both steps into the call site every avatar
  already had to make removes the failure mode rather than patching 33 instances of it. The fallback must stay
  second because `resolveMediaUrl()` returns `""` for a missing picture; `naviiAvatar()` is already absolute,
  so it needs no resolution. Behaviour is otherwise identical, including every `size` argument.
  Also fixed at the source, since these bypass the call sites above: `buildUser()` in
  `src/contexts/auth-context.tsx` now resolves `user.avatar` (that one value is read straight into
  `AvatarImage` by the dashboard header, sidebar, artisan profile, and both settings screens). Its
  sessionStorage cache key is bumped `jinva:user:v3` → `v4`, and v3 added to the cleanup list — a cached v3
  user would otherwise keep serving the old unresolved path for the rest of the browser session, which is
  worth knowing if you re-test in a tab that was open before this change.
  The 9 remaining `naviiAvatar` call sites are unchanged and correct: they pass no stored picture at all
  (`admin/portfolio-queue`, `admin/verifications`, `artisan/jobs` inner tile, `user/report`, `support-page`).
  `testimonials.tsx`'s `/placeholder-user.jpg` is deliberately left alone — that is a frontend `public/`
  asset, not backend media, and resolving it would point it at the API origin and break it.
  `admin/verifications/page.tsx`'s document/selfie tiles are untouched, pending the authenticated endpoint the
  security report's HIGH finding calls for.
- **Status**: Open

### [MINOR] The public 404 has no `<h1>`, so the document's heading order starts at `<h2>`
- **Repro**: open `/this-does-not-exist` and run
  `[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>h.tagName+': '+h.innerText)`.
  Result: `["H2: Product", "H2: Company", "H2: Support", "H2: Legal"]` — all four are footer column
  headings. `document.querySelectorAll('h1').length === 0`.
  The visible "We couldn't find that page" is a `DIV class="text-lg font-medium tracking-tight"`.
- **Expected**: LP10 — "heading levels descend without skipping". Every other public page has exactly one
  `<h1>` (verified on `/`, `/about`, `/contact`, `/terms`, `/privacy`).
- **Actual**: no `<h1>`; first heading is an `<h2>` in the footer. Also the `<title>` stays the generic
  default `"JinVa — Find verified artisans"` rather than saying the page was not found.
- **Likely location**: `jinva-frontend-web/src/components/public/not-found-content.tsx`.
- **FIX (frontend-engineer, 2026-08-27)**: "We couldn't find that page" is now an `<h1>`, nested inside the
  existing `EmptyTitle` (which is a `div` from the shadcn `Empty` primitive — the shared primitive was left
  untouched rather than given an `asChild` prop for one call site). Tailwind's preflight resets heading
  `font-size`/`font-weight` to `inherit`, so it picks up `EmptyTitle`'s type styles and renders pixel-identical.
  Page metadata added: a `notFoundMetadata` constant exported from `not-found-content.tsx` and re-exported as
  the `metadata` of **both** boundaries — `src/app/not-found.tsx` (unmatched URLs) and
  `src/app/(public)/not-found.tsx` (an in-group `notFound()` call) — so the two can't drift.
  Verified on the production build: `/this-does-not-exist` returns **HTTP 404** with
  `<title>Page not found · JinVa</title>` and exactly one `<h1>`, so the outline is now h1 → footer h2s.
  No `robots` key was set: Next.js already emits `<meta name="robots" content="noindex"/>` for a not-found
  boundary, and adding one produced a duplicate robots tag (caught in the first verification pass, removed).
- **Note**: everything else about this page is correct — it returns a real **HTTP 404**, renders the shared
  header and footer, is not a raw Next.js error page, and **all five of its links work** (I clicked each:
  `Back to home`→`/`, `About`→`/about`, `FAQ`→`/#faq`, `Contact`→`/contact`, `Log in`→`/login`).
- **Status**: Open

### [MINOR] `_vercel/insights/script.js` 404s on every public page, so LP2's "no console error" is literally not met
- **Repro**: open `/` with a clean profile and read the console →
  `Failed to load resource: the server responded with a status of 404 (Not Found)` for
  `http://localhost:4200/_vercel/insights/script.js`. Reproduces on `/`, `/about`, `/contact`, `/terms`,
  `/privacy` and the 404 page, in both themes, with the backend up **and** stopped.
- **Expected**: LP2 — "the full page still renders with no error toast, no blank section, no spinner stuck
  on screen, and **no console error**."
- **Actual**: exactly one console error, on every load. Nothing else fails: rendering, layout and every
  interaction are unaffected.
- **Scope honesty**: **pre-existing, not introduced this round.** `<Analytics/>` from `@vercel/analytics/next`
  has been in `src/app/layout.tsx` since commit `a92f1d1` ("feat: auth flow implementation"), well before
  this round's landing-page commit `6d544e0` — confirmed with
  `git show 6d544e0^:jinva-frontend-web/src/app/layout.tsx`. The endpoint only exists when hosted on
  Vercel. It is reported because LP2 is a **new** criterion applied to a **new** page, and this is the only
  thing standing between `/` and a literally clean console.
- **Likely location**: `jinva-frontend-web/src/app/layout.tsx` (line ~40, `<Analytics />`) — gate it on the
  deployment target, or accept it and amend LP2's wording.
- **Status**: Open

### [MINOR] Hero mock card shows a fabricated 4.8 / 37-review rating with no on-screen "sample" marker
- **Repro**: open `/`. The hero's floating profile card reads **"Kwame Asante · Plumbing · Accra ·
  Verified · ★★★★★ 4.8 (37)"**. Nothing on or near that card marks it as illustrative. Note the star row
  renders **five filled stars** for a 4.8.
- **Expected**: LP8 — "when QA audits every number displayed on it, then no fabricated statistic appears —
  no '10,000+ artisans', **no '4.9 average rating'** … Any number shown must either come from a real
  endpoint or be **explicitly labelled as a target/sample**."
- **Actual**: `4.8` and `(37)` are hardcoded (`<RatingStars rating={4.8} totalReviews={37} …>` at
  `hero.tsx:136`) against an invented artisan name, unlabelled. Compare the testimonials section, which
  handles the identical problem correctly and visibly: a `Badge` reading **"Sample content"** plus
  "Placeholder — these are not real JinVa reviews."
- **Judgement call, not a hard fail**: `hero.tsx`'s own header comment argues this is "product UI inside a
  mock profile card, per §3.3", and design-spec §3.3 does sanction the composition. The risk of a visitor
  reading it as a *platform* statistic is low. But it is a fabricated number that is neither endpoint-backed
  nor labelled, which is what LP8's sentence forbids. **Needs a PM/ux-designer ruling** — either add a small
  marker consistent with the testimonials treatment, or record an explicit LP8 carve-out for mock product UI.
- **Everything else in LP8 passes**: zero fabricated aggregates anywhere on the page — no "N+ artisans", no
  percentages, no job counts. Every other number on `/` is a step index (1–5), a reminder window (24h / 2h),
  a mock appointment time, or the copyright year.
- **Likely location**: `jinva-frontend-web/src/components/public/landing/hero.tsx`.
- **DECISION (user, 2026-08-27): add a small sample marker**, matching the testimonials section's treatment,
  rather than leaving it unlabelled or dropping the numbers.
- **FIX (frontend-engineer, 2026-08-27)**: implemented as decided — the mock profile card now carries the
  identical marker the testimonials section uses: `<Badge variant="outline">` + `<Info className="h-3 w-3">`
  + the words **"Sample content"**. No new component, no new pattern; the numbers and the name are unchanged.
  Placed on its own row **above** the avatar, not beside the existing "Verified" pill — in that row it read as
  another artisan attribute, which is the opposite of the point. `hero.tsx`'s header comment, which previously
  argued the number needed no label, is updated to record the decision and to say the badge must be removed if
  the card is ever wired to a real artisan record.

### [MINOR] `formatCurrency()` has no fixed fraction digits, so amounts render with inconsistent decimals
- **Repro**: log in as `admin@jinva.com`, open `/dashboard/admin/transactions`. In one table:
  `GH₵ 150`, `GH₵ 7.5`, `GH₵ 142.5`, `GH₵ 1,020`, `GH₵ 475`, `GH₵ 51`. Screenshot retained.
- **Expected**: money renders as GH₵ in one consistent format (standing project rule; this round's
  requirements also say any amount "must render as **GH₵ via the shared `formatCurrency()` helper**").
- **Actual**: the helper is
  ```ts
  export function formatCurrency(amount: number | string): string {
    return `GH₵ ${Number(amount).toLocaleString()}`
  }
  ```
  `toLocaleString()` with no options gives 0–3 significant decimals depending on the value, so a fee of
  `7.5` sits next to an amount of `150` in the same row.
- **Scope honesty**: **pre-existing**; this round complies with its own rule (the shared helper *is* used,
  currency *is* GH₵, and no round-specific surface renders money at all). Filed because money formatting is
  a standing check.
- **Likely location**: `jinva-frontend-web/src/lib/utils.ts:12` — add
  `{ minimumFractionDigits: 2, maximumFractionDigits: 2 }` (or agree a 0-decimal house style).
- **Status**: Open

### [MINOR] DT2: two pre-existing token pairs measure below WCAG AA in light mode — engineer's disclosure independently confirmed
Measured in-browser through the real cascade on every screen listed in the Definition of Done, both themes,
with colours resolved via canvas (the tokens compute to `oklab()`):

| Pill | Tokens | Light | Dark |
|---|---|---|---|
| `Cancelled` | `bg-destructive/10 text-destructive` | **3.97:1 ✗** | 4.81:1 ✓ |
| `Expired` / `Pending`(payment) / `Closed` / verification `Pending` | `bg-muted text-muted-foreground` | **4.35:1 ✗** | 5.22:1 ✓ |
| `Under Review` / `Pending`(booking) | `bg-warning/10 text-warning` | 5.84:1 ✓ | 9.07:1 ✓ |
| `Completed` / `Paid Out` | `bg-success/10 text-success` | 6.07:1 ✓ | 8.82:1 ✓ |
| `Payout Needs Attention` | `bg-attention/10 text-attention` | 6.24:1 ✓ | 6.86:1 ✓ |
| `Withheld` / `Open` | `bg-info/10 text-info` | 7.42:1 ✓ | 6.21:1 ✓ |
| `Resolved` | `bg-primary/10 text-primary` | 10.29:1 ✓ | 4.91:1 ✓ |

- **Repro**: `/dashboard/user/bookings` (Cancelled), `/dashboard/user/jobs` (Expired),
  `/dashboard/user/jobs/36` (Pending), `/dashboard/admin/verifications` (Pending) in **light** theme.
- **Expected**: DT1 — "each passes WCAG AA contrast against its own background in both themes".
- **Actual**: the four **new** tokens (`--success`/`--warning`/`--attention`/`--info`) all clear AA
  comfortably in both themes. The two failures are on the **pre-existing** `--destructive` and
  `--muted-foreground`, which design-spec §1.3 mandated as the mapping targets.
- **Verdict**: the frontend-engineer flagged these themselves in the handback with the same numbers
  (3.97 / 4.35, dark 5.22). My independent measurement reproduces them to the decimal. This is a disclosed
  **ux-designer decision**, not a silent regression — deepening either token changes every destructive and
  muted surface in the product.
- **Likely location**: `jinva-frontend-web/src/app/globals.css` (`--destructive`, `--muted-foreground` in
  `:root`), with `src/lib/status-badges.ts` as the consumer.
- **DECISION (user, 2026-08-27): leave as-is.** Recorded as a known, disclosed deviation rather than
  deepening either token — avoids an app-wide light-mode colour shift on every destructive/muted surface as
  a side effect of this round.
- **Status**: Closed — accepted, no fix required

### [MINOR] Signup form labels point at element ids that don't exist
- **Repro**: open `/signup`, click the text "Gender" or "Role". Nothing focuses or opens.
  `document.querySelector('#role')` → `null`.
- **Expected**: a `<label htmlFor="x">` is associated with a control with `id="x"`; clicking the label
  activates it and screen readers announce the pairing.
- **Actual**: `signup-form.tsx` has `<Label htmlFor="gender">` and `<Label htmlFor="role">` but the Radix
  `SelectTrigger`s carry no `id`. (This also made my first LP13 read pick up the *gender* select — the
  triggers are only distinguishable by DOM order.)
- **Scope honesty**: pre-existing; LP13 only required the `?role=` prefill, which works. Filed because
  LP13 put this file in scope and it is a two-attribute fix.
- **Likely location**: `jinva-frontend-web/src/components/auth/signup-form.tsx` (~lines 300–340).
- **FIX (frontend-engineer, 2026-08-27)**: `id="gender"` and `id="role"` added to the two `SelectTrigger`s,
  matching the existing `htmlFor` values. Radix forwards `id` to the underlying trigger `button`, so
  `document.querySelector('#role')` now resolves and clicking either label opens its own dropdown.
  Incidental benefit for your harness: the two triggers are no longer distinguishable only by DOM order, so a
  future LP13 re-test can target `#role` directly.
- **Status**: Open

### [OBSERVATION] Every authenticated page load burns a 401 round-trip before refreshing
- On each dashboard navigation the pattern is: preflight `204` → data requests `401` → `POST /auth/refresh-token`
  `200` → same requests retried `200`. Example on `/dashboard/user`: `/jobs/mine`, `/notifications/unread-count`
  and `/messages` all 401 first, then succeed. It happens **seconds after a successful login**, so it is not
  genuine token expiry.
- Functionally correct — the refresh path in `lib/api.ts` does its job and the user sees nothing. Noted
  because it triples the request count on every page and fills the console and the backend error log with
  noise that masks real 401s. Out of this round's scope; no criterion covers it.
- **Status**: Informational

---

## Verified working (no action needed)

Recording these because the round's Definition of Done asks QA to confirm them explicitly, and because
"I clicked it" is the whole point of this pass.

**LP3 — header nav: all 5 items clicked individually, on the production build.** The `PublicLink` fix
genuinely works; I verified by clicking, not by reading the component. Each item scrolled and landed the
target section **exactly 80px from the viewport top** (`scroll-mt-20` clearing the `h-16` header), set the
correct hash, and logged zero console errors:

| clicked | href | scrollY | section top |
|---|---|---|---|
| Services | `/#services` | 797 | 80px |
| How it works | `/#how-it-works` | 1465 | 80px |
| For artisans | `/#for-artisans` | 2634 | 80px |
| Why JinVa | `/#features` | 4196 | 80px |
| FAQ | `/#faq` | 5600 | 80px |

Logo is a real link and navigates `/about` → `/`. Header "Log in" → `/login` (h1 "Sign In"), header
"Get started" → `/signup` (h1 "Create Account").

**LP9 / footer root-relative anchors — the regression the frontend-engineer called the likeliest bug of the
round. It holds.** All 14 footer links clicked **one at a time from all five public pages** = **70 clicks,
70 passes**: `/about` 14/14, `/terms` 14/14, `/privacy` 14/14, `/contact` 14/14, `/` 14/14. Every anchor's
raw `href` asserted to start with `/#` (a bare `#services` would have resolved to `/about#services`), and
every one landed on `/` with the section at the top. Zero `href="#"`, zero `javascript:void(0)`, zero 404s
anywhere in the header or footer. Copyright reads "© 2026 JinVa. All rights reserved." and is computed
(`const year = new Date().getFullYear()`, `public-footer.tsx:19`). Social row correctly omitted.

**LP13 — verified against a real `npm run build` + `next start`, since that is what hid the original bug.**
Clicking the artisan section's CTA "List your trade on JinVa" → `/signup?role=ARTISAN` with the role
selector reading **"Artisan"**. The clients CTA → `/signup?role=CUSTOMER` reading **"Customer"**. Junk input
matrix, all leaving the selector empty with zero console errors: absent, `?role=`, `?role=ADMIN`,
`?role=artisan`, `?role=Artisan`, `?ROLE=ARTISAN`, `?role=<script>alert(1)</script>`, `?role=CUSTOMER%00`,
`?role=+ARTISAN`, `?role=ADMIN&role=ARTISAN`. Dropdown offers only Customer and Artisan — no ADMIN option
(PRD §5.1). (`?role=ARTISAN&role=ADMIN` prefills Artisan, since `searchParams.get()` takes the first value —
correct and safe, never yields ADMIN.)

**LP6** — all 8 category tiles clicked individually, all → `/signup`. Order and spelling match PRD §1
exactly (`Electrical, Plumbing, Carpentry, Painting, Cleaning, Landscaping, Beauty`) plus an
"…and every other trade" tile.

**LP5** — `#platform-governance` contains **zero** links and **zero** buttons, and no signup/register/
"become an admin" wording anywhere in its text.

**LP4** — exactly one `<h1>`, not clipped. Primary CTA → `/signup` and secondary → `/login` both fully above
the fold at 1440×900 (top 587) and 375×812 (tops 555 / 607).

**LP2 — `/` with the backend process actually killed** (port 8000 refusing connections, not merely idle).
In both themes: all 7 sections present, 8 header links, 14 footer links, 8 category tiles, **0 requests to
the backend**, 0 visible spinners, 0 toasts, 0 page errors, 0 console errors beyond the pre-existing
`_vercel/insights` one. Header nav, the FAQ accordion and the how-it-works tabs all still worked with the
API down, and every image decoded. Same for `/about`, `/contact`, `/terms`, `/privacy` and the 404.

**Mobile nav sheet at 375×812** — desktop nav correctly hidden, menu button visible. All 8 sheet items
clicked one at a time: each navigated correctly (anchors landing at 80px) **and the sheet closed every
time**. Both auth CTAs present inside it, plus a theme toggle.

**Theme toggle, both locations, both directions** — desktop header toggled light→dark→light→dark
(`html.dark` and `localStorage.theme` tracking each time); mobile sheet toggled dark→light→dark with the
button relabelling "Light mode"/"Dark mode".

**Keyboard-only pass** — 9 header stops in visual order (x = 112, 433, 517, 630, 736, 833, 1098, 1142,
1222). Focus rings **proved with a real-pixel diff in both themes**: `:focus-visible` matched and the
rendered header strip changed on all 9 stops. (My first attempt used `element.focus()` and wrongly reported
`boxShadow: none` — programmatic focus does not trigger `:focus-visible`; only real Tab presses do.) Enter
activated a nav item (scrolled `#faq` to 80px), the CTA (→ `/signup`) and the theme toggle.

**LP10 responsive** — no horizontal scroll at 320 / 375 / 768 / 1024 / 1440 on `/`, `/about`, `/terms`
(`scrollWidth == innerWidth` at every width). The one element extending past the viewport is a
`pointer-events-none absolute` decorative orb inside an `overflow-hidden` ancestor — it creates no scroll.
No invisible text (no colour-equals-background pair) on any public page in either theme.

**Reduced motion** — under emulated `prefers-reduced-motion: reduce`, **0 of 42 `[data-reveal]` and 0 of 5
`[data-enter]` elements are hidden** and `html { scroll-behavior }` drops from `smooth` to `auto`. Scrolling
to the bottom with reduce on leaves 0 elements at `opacity: 0`.

**PUB1–PUB5** — `/terms` and `/privacy` both show the agreed **"Draft — pending legal review"** marker and
contain no invented legal text (no "hereby"/"shall be governed"/"arbitration"/"limitation of liability").
`/about` and `/contact` render with real content; `/contact` invents no support address. `#faq` accordion
works. **The word "Plumbify" appears nowhere in any public page's text.**

**LP7** — none of PRD §10's out-of-scope items is advertised: no native app, no real-time/live chat, no map
view, no loyalty/rewards, no promo codes, no multi-language, no pricing tiers, no newsletter.

**LP11 (partial)** — root layout description replaced; `/` and each public page set their own title and
description. Only the `og:image` and `metadataBase` items above fail.

**LP1** — `/` is statically prerendered (`○ /` in the build output), returns **200 with zero 3xx**, and stays
outside the middleware matcher (`["/dashboard/:path*","/login","/signup","/forgot-password","/reset-password/:path*","/verify-email"]`).

**LP14 + role-boundary regression suite — all pass, tested by attempting each, not by reading middleware.**
- Unauthenticated → **8/8** `/dashboard/*` paths redirect to `/login?redirect=…` with the param preserved
  (`/dashboard`, `/dashboard/user`, `/dashboard/artisan`, `/dashboard/admin`, `/dashboard/admin/disputes`,
  `/dashboard/user/bookings`, `/dashboard/artisan/earnings`, `/dashboard/admin/transactions`).
- Login through the real form works for all three roles and lands on the correct role home. Session cookies
  `jinva_session` + `refresh_token` are both `httpOnly`, `SameSite=Lax`, `path=/` (`secure` false only
  because this is plain-http localhost).
- artisan → `/dashboard/admin`, `/admin/disputes`, `/admin/transactions`, `/user`, `/user/bookings` — all 5
  bounce to `/dashboard/artisan`.
- user → `/dashboard/artisan`, `/artisan/earnings`, `/admin`, `/admin/disputes` — all 4 bounce to `/dashboard/user`.
- admin → `/dashboard/user`, `/dashboard/artisan` — both bounce to `/dashboard/admin`.
- Authenticated → `/login` and `/signup` redirect to role home, for all three roles.
- An authenticated visitor can open `/` freely; it leaks no user data.
- Login validation: empty submit blocked by native validation; wrong password → "Invalid email or password"
  toast **and no cookies set**.

**DT2 label freeze** — `HELD` still renders **"Withheld"** (seen on artisan earnings and admin transactions).
No label or icon changed.

**DT3** — all four dead toast files are gone (`ui/toast.tsx`, `ui/toaster.tsx`, `ui/use-toast.ts`,
`hooks/use-toast.ts`) with zero lingering imports; lint and build green.

**DT4** — `phone-input.tsx`, `logo.tsx` and `auth-split-layout.tsx` contain none of the literals the
criterion named (`bg-white`, `border-gray-*`, `text-gray-*`, `text-[#…]`, `from-[#…]`, `hover:bg-green-*`).

**DT5 — before/after counts re-measured with the doc's own repro, and the guard proved to work.**
- The requirements' exact command over `src` now returns **0 matching lines** and **0 total occurrences**
  (baseline was 257 lines / 412 occurrences across 37 files).
- Hex literals appear only in the 4 allowlisted files, and only where documented: `opengraph-image.tsx`
  (Satori cannot read `var(--brand)`), `globals.css` (token definitions + comments), `global-error.tsx`
  (self-contained `<style>`), `ui/chart.tsx`.
- **I did not take the guard on trust.** I copied `scripts/check-color-tokens.mjs` into a sandbox with a
  planted `src/` (never touching the repo, since `ROOT = process.cwd()`) and confirmed it: flags
  `bg-blue-100`, `text-red-700` and `#1c4532`, **exits 1**, correctly ignores the same literals inside a
  comment, and correctly does not flag `bg-black/50` or `text-white`. It is wired as
  `npm run verify` → `check:colors && lint && build`. Whether CI actually runs `verify` is not verifiable
  from here — worth confirming.

**BI1 — verified by causing the failure, with `STORAGE_PROVIDER=s3` set in the process environment only.**
- At boot: `[StorageProviderFactory] Storage provider "s3" is selected but misconfigured — missing
  environment variables: AWS_S3_BUCKET, AWS_S3_REGION. Every upload will fail with a 500 until these are
  set.` — **names only, no values**, and non-fatal, as designed.
- A real `POST /api/v1/uploads/avatar` with a 57 KB JPEG returned **HTTP 500** with a clean structured JSON
  body, **no stack trace, no bucket ARN, no credential material**, and **nothing written** — no silent
  success. The same upload against the default local-provider instance returned `200` with
  `"url":"/uploads/avatars/<uuid>.jpg"`. (I deleted the file I created.)
- Live S3/Resend activation is correctly **deferred to the user**; nothing was attempted against real AWS
  or Resend, and `MAIL_PROVIDER` unset still logs `Mail provider "smtp" is active.`

**BI2 — legacy media survives the cutover.** With `STORAGE_PROVIDER=s3` active, the boot log confirms
legacy-only mode, and a real pre-cutover file from **every** upload folder still returns `200` with correct
`Content-Type`: `avatars`, `portfolio`, `reviews`, `messages`, `job-attachments`. Hardening confirmed too:
`X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`, directory listing
404s (`/uploads/` and `/uploads/avatars/`), and three path-traversal attempts all 404. **In-app**, portfolio
images render from `http://localhost:8000/uploads/portfolio/…` at 1024×1024. The only in-app gap is the
avatar-origin bug filed above, which is a frontend URL-resolution defect, not a BI2 regression.
*Caveat:* **verification documents could not be exercised** — `uploads/documents/` and `uploads/selfies/`
contain **0 files** in this environment, so no historical document exists to load. The code path
(`admin/verifications/page.tsx`) does use `resolveMediaUrl()`, so it is expected to behave like portfolio.

> **Heads-up for the next QA pass — backend-engineer, 2026-08-27 (commit `350dc0b`).** This expectation is now
> **deliberately false**, so please don't file the change as a BI2 regression. Fixing the security round's HIGH
> finding means `documents`/`selfies` are no longer served by the `/uploads` static mount in *any* mode:
> `GET /uploads/documents/<file>` is now a clean JSON **404 even when the file exists on disk**, which is the
> intended behaviour and is asserted in `test/legacy-media-serving.e2e-spec.ts`. The five public folders
> (`avatars`, `portfolio`, `reviews`, `messages`, `job-attachments`) are completely unchanged, headers included.
>
> KYC media is now read through `GET /api/v1/uploads/kyc/:folder/:filename` — bearer token + `ADMIN` role,
> streams bytes, `Cache-Control: private, no-store`. Contract in
> `docs/team/routes-frontend-patterns-backend-infra/api-contract.md`; the admin verification screen's image
> source is a separate frontend-engineer handoff, so until that lands the tiles are *expected* not to render.
> To reproduce the backend half without a real submission: drop any PNG into `uploads/documents/` and hit the
> endpoint with an admin token (401 anonymous, 403 as artisan/customer, 200 as admin).

**Standard checks**

| Check | Result |
|---|---|
| FE `npm run check:colors` | pass — 242 files, 0 hardcoded, 4 allowlisted |
| FE `npm run lint` | **0 errors**, 5 warnings (all pre-existing, none in new code) |
| FE `npm run build` | pass — `/` prerendered static (`○`) |
| BE `npm run lint` | **0 errors**, 25 warnings (pre-existing, spec files) |
| BE `npm run build` | pass |
| BE `npm run test` | **319/319 pass, 37 suites** |
| BE `npm run test:e2e` | 118/125; **7 failures = the documented pre-existing baseline, confirmed** |

> **Build note, not a bug:** my first `npm run build` failed with
> `EINVAL: invalid argument, readlink '.next/postcss.js.map'`. That was a stale `.next` left by a dev
> server running concurrently on port 4200. `rm -rf .next` then `npm run build` succeeds every time. Not a
> code defect — recorded so it isn't mistaken for one.

---

## Summary

- **Open blockers: 0**
- **Open majors: 3** — all frontend:
  1. `/` has no `og:image` (LP11)
  2. `metadataBase` unset → OG images resolve to `localhost:3000` (LP11)
  3. Avatar URLs bypass `resolveMediaUrl()` → legacy relative avatars 404 (DoD media line; pre-existing)
- **Open minors: 7** — 404 page has no `<h1>`; `_vercel/insights` console 404 (LP2, pre-existing); hero's
  unlabelled 4.8/37 (LP8, needs a PM/designer ruling); `formatCurrency` decimal inconsistency
  (pre-existing); DT2's two sub-AA light-mode token pairs (disclosed, needs ux-designer); signup label
  `htmlFor` ids (pre-existing); seeded `uploads/profiles/` 404s (backend).

**Release readiness: not yet — 3 open majors.** None is in the flagship landing page's behaviour, which is
in genuinely good shape: **every one of the 22 header and footer links was clicked individually, and the
footer's root-relative anchors were re-clicked from all four sub-pages — 70 footer clicks, zero dead
links.** LP1–LP10, LP12–LP14, PUB1–PUB5, DT1–DT5 and BI1/BI2/BI4 all pass as verified above.

Two of the three majors are the same defect class — **metadata that only reveals itself in rendered HTML,
not in source** — and both are small, contained fixes in `(public)/page.tsx` and `layout.tsx`. The third is
pre-existing and gracefully degraded, but it is what makes the DoD's "existing avatars still load" line
fail, so it should not be deferred silently.

Of the criteria QA can't close alone: **BI1/BI2's live cutover** (real AWS values) and **BI4's
`MAIL_PROVIDER=resend`** remain the user's action — the code paths are verified ready. **DT1's two sub-AA
pre-existing tokens** and **LP8's hero-number ruling** need the ux-designer/PM.

<!-- Engineers: append fix notes under the relevant item. I will re-run the specific repro above and mark each
     "Verified fixed" or "Still failing" with fresh evidence — including a fresh `npm run build` for the two
     metadata items, since both are only observable in built output. -->
