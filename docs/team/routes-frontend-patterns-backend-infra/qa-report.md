# QA Report: Routes, Frontend Patterns & Backend Infra (marketing landing page)

**QA pass 2 — 2026-08-27 (re-verification).** Both engineers appended fix notes under every open item.
Every one of those items has been re-tested from scratch below; **no item is marked fixed on the strength of
a fix note.** Each carries a `RE-VERIFIED (pass 2)` block with fresh evidence and a `Status` of
**Verified fixed** or **Still failing**. **Four new defects** were confirmed along the way (one major, three
minors — all pre-existing, none introduced by the fixes), plus one informational note. The e2e totals moved
since pass 1 and the change is fully accounted for below; **the 7-failure baseline itself is unchanged.**

### How pass 2 was run

- **Frontend: a from-scratch production build** — `rm -rf .next && npm run build && npx next start`.
- **Browser: a brand-new Chrome profile directory** (`chrome-rv`, created for this pass and never reused),
  driven over the DevTools Protocol with real `Input.dispatchMouseEvent` / `dispatchKeyEvent`. This matters
  for the avatar item: a reused profile could have carried a stale `jinva:user:v3` sessionStorage entry and
  masked the fix. I went further and **planted** a fake `v3` entry before each login to see what the app does
  with it (see that item).
- **Port note that cost me a run, worth recording:** the backend's CORS allow-list (`ALLOWED_ORIGINS`, not
  read — probed black-box with `OPTIONS` + `Origin:` headers) admits **only `http://localhost:3000` and
  `http://localhost:4200`**. My first attempt served the production build on `:4400`; every login failed with
  `No 'Access-Control-Allow-Origin' header`, which looks exactly like a broken login. **Anyone re-testing this
  app in a browser must serve the frontend on 3000 or 4200.** Pass 2's browser work ran on
  `http://localhost:3000` against the API on `:8000` (default local storage provider).
- `.env` / `.env.*` were not read, opened or grepped at any point in this pass, and the narrow DB-credential
  exception was **not** needed — every fact below came from the app's own HTTP surface.
- Seeded accounts as before (`SEED_PASSWORD` is a constant in `seed.ts`, not an environment secret):
  `admin@jinva.com`, `yaw.osei@jinva.com`, `ama.mensah@gmail.com`, plus `adwoa.ansah@jinva.com` for the PDF path.

**Two deliberate data changes I made through the app's own API** (no direct DB writes, no `.env`), recorded
so nobody is surprised by them: artisan `adwoa.ansah@jinva.com` now has a **new PENDING verification
(record #11)** whose `documentFrontUrl` is a real PDF and whose selfie is the first object ever written to
`uploads/selfies/` — that is how the untested PDF branch got tested. Nothing else was created or deleted.

---

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
- **RE-VERIFIED (QA pass 2)**: **fixed in the source, not observable at runtime — and the prescribed way to
  observe it does not work.**
  1. Source confirmed: `rg "profilePicture|uploads/profiles" src/database/seeds/seed.ts` returns **only the
     two explanatory comments**, no assignments. `uploads/profiles/` still does not exist on disk. Good.
  2. I followed the re-run note and ran **`npm run seed:force`. It crashes before touching any data**:
     `Seed failed: TypeORMError: Entity metadata for Review#photos was not found.` Filed as a separate new
     item below — it is **not** caused by this fix (`git show e054ebc -- src/database/seeds/seed.ts` touches
     only `profilePicture` lines and comments; the seed's hand-written `entities: [...]` array has never
     listed `ReviewPhoto`, which arrived in `2e7df42`).
  3. So the live DB still holds the old values, and the original symptom still reproduces end to end. Via
     `GET /admin/users` as admin (no DB credentials needed, no `.env` touched), **8 seeded users still carry
     `/uploads/profiles/<name>.jpg`**: `yaw.osei`, `akua.frimpong`, `efua.agyeman`, `kweku.amoah`,
     `adwoa.ansah`, `kofi.asante`, `abena.boateng`, `kwame.darko`. In the browser each of those is now
     requested from **`http://localhost:8000/uploads/profiles/…`** (correctly resolved — see the avatar item)
     and fails, e.g. on `/dashboard/user/search`: five `net::ERR_BLOCKED_BY_ORB` avatar requests in one page
     load. (`ERR_BLOCKED_BY_ORB` rather than a plain 404 because Chrome's Opaque Response Blocking rejects a
     JSON 404 body delivered to an `<img>`.)
  4. `ama.mensah@gmail.com` is the one seeded user whose avatar renders, and only because a **real upload**
     replaced her seeded value at some point: `/uploads/avatars/91964fab-….jpg`, which serves `200` and
     decodes at 200×200 on every screen she appears on.
- **Status**: **Verified fixed at source · Still failing at runtime** — nothing more for the backend-engineer
  to do on *this* item, but it cannot be closed until `npm run seed` works again, and any environment seeded
  before `e054ebc` keeps 404ing until then. Blocked by the seed crash below.

### [MAJOR — NEW in pass 2] `npm run seed` and `npm run seed:force` both crash on startup: `Entity metadata for Review#photos was not found`
- **Repro** (100% reproducible — 4 runs: 2× `npm run seed`, 2× `npm run seed:force`, identical output every
  time):
  1. `cd JIN_VA-BACKEND && npm run seed:force`
  2. Output:
     ```
     Seed failed: TypeORMError: Entity metadata for Review#photos was not found.
     Check if you specified a correct entity object and if it's connected in the connection options.
         at EntityMetadataBuilder.computeInverseProperties (...)
         at async DataSource.initialize (...)
     ```
  3. It fails inside `dataSource.initialize()` — **before** the `--force` check, before any read or write. So
     `npm run seed` on an **empty** database fails identically. No partial data is written; nothing is
     corrupted.
- **Expected**: the seed populates (or re-populates) a development database. It is the only documented way to
  get a working dataset, and the only login credentials a new developer has.
- **Actual**: seeding is impossible. A fresh clone cannot be brought up at all; an existing dev DB cannot be
  refreshed.
- **Root cause**: `src/database/seeds/seed.ts` builds its own `DataSource` with a **hand-maintained
  `entities: [...]` array** (25 entries). `Review` declares `@OneToMany(() => ReviewPhoto, p => p.review)
  photos`, but **`ReviewPhoto` is not in that array**, so TypeORM cannot resolve the inverse side. The same
  applies to any other entity added since the array was last updated —
  `src/reviews/entities/review-moderation-action.entity.ts` is also absent, and would be the next failure.
- **Scope honesty**: **pre-existing, and not this round's.** `ReviewPhoto` landed in `2e7df42`
  ("feat(reviews): add moderation status, photos, moderation-log, and weighted-rating schema"), several rounds
  ago; `grep -c ReviewPhoto src/database/seeds/seed.ts` → **0** at every commit since. It is reported now
  because it is what **blocks re-verification of this round's own seed fix** (`e054ebc`), whose fix note
  explicitly prescribes `npm run seed:force` as the way to observe it.
- **Suggested direction (backend-engineer's call)**: point the seed's `DataSource` at the same entity glob the
  app uses (or import the app's `TypeOrmModule` options) so the list cannot drift again, rather than adding
  two more imports and leaving the next entity to break it.
- **Severity note**: major on the dev/QA workflow, **zero product-runtime impact** — seeds do not run in a
  deployed environment. Flagged separately in the verdict for that reason.
- **Status**: Open — new, needs the backend-engineer.

### [MINOR — NEW in pass 2] The seeded verification rows reference 13 KYC files the seed never writes; 8 of the 13 are 404
- **Repro**:
  1. As admin: `GET /api/v1/verification?limit=50` → 5 rows, 13 non-null
     `documentFrontUrl`/`documentBackUrl`/`selfieUrl` references.
  2. Resolve each through the new endpoint, `GET /api/v1/uploads/kyc/{folder}/{file}` with an admin token:
     ```
     #10 REJECTED     Adwoa Akos Ansah    front:404 back:404 selfie:404
     #9  PENDING      (no legal name)     front:200 selfie:200
     #8  UNDER_REVIEW Efua Abena Agyeman  front:200 back:200 selfie:200
     #7  APPROVED     Akua Adwoa Frimpong front:404 selfie:404
     #6  APPROVED     Yaw Kofi Osei       front:404 back:404 selfie:404
     ```
     **5 refs resolve, 8 do not.** The 5 that resolve do so only because the frontend-engineer placed local
     fixture files (disclosed, gitignored, expected). Nothing in the repo writes them.
  3. In the UI (admin → Verifications → review any of rows #6/#7/#10) all tiles read **"This file is no
     longer available."** — three whole records look like data loss when they are simply seeded fiction.
- **Expected**: same principle the backend-engineer applied to the avatar seed in `e054ebc` — a seeded media
  reference either points at a file the seed writes, or is left null.
- **Actual**: `seed.ts` writes 13 literal paths and no files. This is the **same class of bug as the avatar
  seed**, one folder over.
- **Second, smaller defect in the same data**: every seeded `selfieUrl` points into
  **`/uploads/documents/`**, not `/uploads/selfies/` (`seed.ts:730, 746, 764, 775, 790`). It "works" because
  the KYC endpoint accepts `documents` as a folder, but it means the `selfies` folder was **never exercised by
  any seeded row** — I had to submit a real verification to get the first object into `uploads/selfies/` at
  all (see the PDF item).
- **Likely location**: `JIN_VA-BACKEND/src/database/seeds/seed.ts:720–798`.
- **Status**: Open — new, backend-engineer. Cosmetic/dev-data only; blocks nothing.

### [MINOR — NEW in pass 2] `booking-concurrency` A4 e2e test is timing-dependent: asserts `[201, 409]`, sometimes gets `[201, 400]`
- **Repro** (5 observed runs: **1 fail, 4 pass**):
  - Full suite, `npm run test:e2e -- --runInBand`, run 1 → **FAIL**:
    ```
    ● Bookings — A4 real concurrent-request race (e2e) › never lets two concurrent requests … both succeed
      expect(received).toEqual(expected)
        Array [ 201, -409, +400 ]
      at booking-concurrency.e2e-spec.ts:179:22
    ```
  - Full suite, run 2 → **PASS**. Suite alone (`… --runInBand test/booking-concurrency.e2e-spec.ts`),
    3 consecutive runs → **PASS, PASS, PASS**. It only failed under the load of the full in-band run.
- **Expected**: a stable assertion.
- **Actual**: `BookingsService.create` has **two** guards, and which one rejects the loser depends on
  interleaving: a fast-fail pre-check (`computeBookableWindows` → `BadRequestException`, **400**,
  `bookings.service.ts:187`) and the authoritative transactional overlap check (`ConflictException`, **409**,
  `:243`). If the winner commits before the loser's pre-check runs, the loser gets 400. The spec pins the
  exact pair `[201, 409]`.
- **Why this is a test defect and not a product defect**: the invariant A4 exists for — *never two
  successes* — **held in every run, including the failing one** (exactly one `201`). Both statuses are
  correct refusals.
- **Suggested direction**: assert one `201` and one refusal in `{400, 409}` (and keep the "exactly one row"
  assertion, which is the real guard), rather than pinning which guard won the race.
- **Scope**: pre-existing spec (`ce50f35`, untouched since 21 Aug). **Not part of the 7-failure baseline** —
  it passed in pass 1 and in the confirming run here, so treat it as a flake to fix, not a new regression.
- **Likely location**: `JIN_VA-BACKEND/test/booking-concurrency.e2e-spec.ts:179`.
- **Status**: Open — new, backend-engineer (test-only change).

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

#### RE-CONFIRMED (QA pass 2) — same 7 failures, same 2 suites; the *total* moved and here is why
Re-run twice on the current tree (several commits have landed since pass 1):

```
Test Suites: 2 failed, 8 passed, 10 total
Tests:       7 failed, 126 passed, 133 total          ← pass 1 was 7 failed / 118 passed / 125 total
```

- **The 7 failing test names are byte-for-byte the pass-1 set**, extracted from the full log rather than a
  summary line: analytics — `GET /admin/analytics returns the platform rollup for an admin`, `AP4`, `AN3`,
  `AT3`; messaging — `AD2`, `PD4`, `PR3`. Same two suites. Same `syntax error at or near "."` analytics
  rollup cause in the boot log.
- **The +8 total is fully accounted for and is a *good* change**: `test/legacy-media-serving.e2e-spec.ts` grew
  **6 → 14 tests** in `350dc0b` (the KYC hardening). `git show aac19e0:test/legacy-media-serving.e2e-spec.ts
  | grep -c "^\s*it("` → 6; current → 14; 125 + 8 = 133. **All 14 pass.** No other suite changed size.
- **One extra failure appeared in the first of the two runs and is a flake, not a regression** — the
  `booking-concurrency` A4 status-pair assertion, filed as its own minor item above (4 of 5 runs pass; the
  invariant it guards never broke).
- Unit suite also moved and is green: **363/363 in 40 suites** (pass 1: 319/319 in 37). The three new suites
  all arrived with `350dc0b`, the KYC hardening: `src/uploads/kyc-media.service.spec.ts`,
  `src/uploads/upload-folders.spec.ts`, `src/uploads/legacy-media.config.spec.ts` (`git log -1 --` on each
  confirms the commit). Nothing was removed.
- **Status**: Baseline confirmed unchanged at 7 failures in the same two suites. Still the analytics/admin/
  disputes owner's, still not a gate here.

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
- **RE-VERIFIED (QA pass 2)**: **fixed.** Re-ran my own pass-1 repro against a from-scratch production build
  (`rm -rf .next && npm run build && npx next start`), curling the served HTML rather than reading source:

  | page | `og:image` | `twitter:image` | w×h | `og:image:alt` |
  |---|---|---|---|---|
  | **`/`** | **present** | **present** | 1200×630 | yes |
  | `/about` | present | present | 1200×630 | yes |
  | `/contact` | present | present | 1200×630 | yes |
  | `/terms` | present | present | 1200×630 | yes |
  | `/privacy` | present | present | 1200×630 | yes |
  | `/login` | present | present | 1200×630 | yes |
  | `/signup` | present | present | 1200×630 | yes |

  `/`'s `<title>` is `Find verified artisans — book, pay and rate in one place · JinVa` (the template suffix
  the fix note predicted), and `GET /opengraph-image` still returns `200 image/png`. `rg "openGraph|twitter:"
  src/app/\(public\)/page.tsx` → no matches, i.e. the replacing block is genuinely gone rather than patched
  with an `images` key.
- **Status**: **Verified fixed** (LP11 image half).

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
- **RE-VERIFIED (QA pass 2)**: **fixed, with one caveat that belongs to the operator, not the code.**
  1. `grep -ci "metadataBase.*is not set" rv-fe-build.log` on a clean `rm -rf .next && npm run build` →
     **0 occurrences** (pass 1: 3). The build's only remaining output is the 5 pre-existing lint warnings.
  2. `rg -n "metadataBase" src/` now matches `src/app/layout.tsx:49` — `metadataBase: new URL(SITE_URL)`,
     `SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4200"`, with the variable documented in
     a comment block at the point of use. I did **not** open any `.env` to check whether the variable is set
     anywhere; I only observed what the built HTML emits.
  3. Rendered value in this environment: `og:image content="http://localhost:4200/opengraph-image?84c56…"` on
     **all seven** public pages — i.e. the documented fallback, which tells me `NEXT_PUBLIC_SITE_URL` is not
     set here. The value now comes from the app's own configuration rather than from whichever port ran the
     build (my build ran on neither 4200 nor 3000, and the emitted host was still 4200 — that is the proof
     that it is configuration-driven now).
  4. **Caveat for release, not a code bug**: until an operator sets `NEXT_PUBLIC_SITE_URL` in the deployed
     environment, unfurls will still point at `localhost:4200`. QA cannot close that half — please confirm it
     is set in the deploy pipeline. Since it is a `NEXT_PUBLIC_*` value it is **inlined at build time**, so it
     must be present *when the image is built*, not merely at runtime.
- **Status**: **Verified fixed** in code (LP11). Operator action outstanding: set `NEXT_PUBLIC_SITE_URL` at
  build time in each deployed environment.

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
- **RE-VERIFIED (QA pass 2)**: **fixed**, and I re-tested it the way the wider fix demands — **a brand-new
  Chrome profile directory** (created for this pass, never reused, so no `v3`-keyed sessionStorage could be
  carrying an old resolved value), production build, all three roles, **33 dashboard screens**.

  | role | screens | requests for `/uploads/…` hitting the **frontend** origin | `/uploads/…` images rendered | broken |
  |---|---|---|---|---|
  | artisan (`yaw.osei`) | 12 | **0** | 4 | 0 |
  | customer (`ama.mensah`) | 9 | **0** | 28 | 0 |
  | admin (`admin@jinva.com`) | 12 | **0** | 19 | 0 |

  - **My original repro page passes.** `/dashboard/artisan/messages` (which, as the fix note correctly points
    out, was not one of the six files I listed) now requests
    `http://localhost:8000/uploads/avatars/91964fab-….jpg` — **port 8000, the API origin** — and the `<img>`
    decodes at **200×200**. Pass 1's signature (`http://localhost:4200/uploads/…` → 404) does not occur once
    in 33 page loads.
  - **The source-side value is resolved too.** After login the `jinva:user:v4` cache entry reads
    `"avatar":"http://localhost:8000/uploads/profiles/yaw-osei.jpg"` — absolute, API origin. (That file does
    not exist, which is the seed item above, not this one. The *resolution* is what this item is about and it
    is correct.)
  - **Precision correction to the fix note, not a defect**: the note says v3 was "added to the cleanup list".
    I planted `sessionStorage["jinva:user:v3"]` before each login; after a successful login **both `v3` and
    `v4` are present** — `clearCache()` (which does the removal) only runs on logout / auth failure, not on a
    successful fetch. This has **zero impact**: nothing reads `v3` any more, so a stale entry cannot be
    served. The fix's effective mechanism is the key rename, not the cleanup. Worth recording so nobody
    relies on the cleanup claim later. (Verified the other direction too: after a real logout, cookies are
    cleared and the cache is emptied.)
  - Sweep also confirmed, on the same 33 screens: **zero raw `$` amounts** anywhere (GH₵ counts non-zero on
    every money screen — artisan earnings 8, admin transactions 24, user report 7), and **no console errors**
    beyond the two known pre-existing ones (`_vercel/insights` 404 and the 401-then-refresh round-trip).
- **Status**: **Verified fixed.**

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
- **RE-VERIFIED (QA pass 2)**: **fixed.** Re-ran my exact pass-1 repro in the browser on
  `/this-does-not-exist`:
  - `[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>h.tagName+': '+h.innerText)` →
    `["H1: We couldn’t find that page", "H2: Product", "H2: Company", "H2: Support", "H2: Legal"]` — the
    outline now starts at `h1` and descends without skipping. `document.querySelectorAll('h1').length === 1`.
  - `document.title` → **`Page not found · JinVa`** (pass 1: the generic default).
  - HTTP status still a real **404**; exactly **one** `robots` meta (no duplicate, as the note claims).
  - The h1's computed style is `font-size: 18px; font-weight: 500` — identical type to the `EmptyTitle` div it
    replaced, so the claim of a pixel-identical render holds.
  - All five links still present with the same hrefs (`/`, `/about`, `/#faq`, `/contact`, `/login`).
- **Status**: **Verified fixed** (LP10).

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
- **RE-VERIFIED (QA pass 2)**: **fixed as decided.** On `/` in the browser, the mock card's own text now reads
  `Sample content | Kwame Asante | Plumbing · Accra | Verified | 4.8 | (37)` — the marker is **inside the
  card**, first in reading order, above the avatar row and not adjacent to the "Verified" pill. It is a
  `[data-slot="badge"]` containing an `svg` (the `Info` icon), i.e. structurally the same treatment as the
  testimonials marker; the page now carries exactly **two** "Sample content" badges (hero + testimonials).
  Numbers and the name are unchanged, as claimed. Screenshot retained (`rv/hero-card.png`).
- **Status**: **Verified fixed** (LP8, per the recorded decision).

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
- **RE-VERIFIED (QA pass 2)**: **fixed**, tested by real clicks on the label text, not by reading attributes.
  - `document.querySelector('#gender')` and `#role` both resolve, both to a `BUTTON` (Radix forwards the id to
    the trigger, as claimed).
  - Real mouse click on the **"Role"** label → `#role[aria-expanded]` flips to `true`, a `[role="listbox"]`
    opens, and its options are exactly `["Customer", "Artisan"]` (no ADMIN — PRD §5.1 still holds).
    `#gender` stays `aria-expanded="false"`, i.e. the right control opened.
  - Real mouse click on the **"Gender"** label → `#gender` expands with `["Male", "Female", "Other"]`, and
    `#role` stays collapsed.
  - Every one of the 9 labels on the form now points at a control that exists.
  - **LP13 regression re-run while I was there** (this file was the LP13 file): `?role=ARTISAN` → "Artisan",
    `?role=CUSTOMER` → "Customer", `?role=ADMIN` → "Select role", no query → "Select role". Zero console errors.
- **Status**: **Verified fixed.**

### [VERIFIED FIXED — NEW in pass 2] Admin KYC media now loads through the authenticated endpoint (backend `350dc0b` + frontend `287ebe8`)
This landed after pass 1 was written, so it had no item of its own — only the backend-engineer's heads-up at
the bottom of this report. Tested end to end in pass 2, both halves.

**(a) The tiles genuinely render for an admin.** Admin → Verifications → open each of the 5 records:

| record | tiles | rendered from | pixels |
|---|---|---|---|
| #8 `UNDER_REVIEW` Efua | front, back, selfie | `blob:` object URL | 1024×1024 each |
| #9 `PENDING` (profile #14) | front, selfie | `blob:` object URL | 1024×1024 each |
| #6 / #7 / #10 | all tiles | — | "This file is no longer available.", **no Retry offered** (contract says 404 is not retryable) — those are the seeded rows with no file behind them, filed as its own minor above |

- Every byte came from `GET /api/v1/uploads/kyc/{folder}/{file}` returning `200`. **Zero requests to
  `/uploads/documents/…` or `/uploads/selfies/…` across all five records** — the old public path is not being
  hit anywhere, by anything.
- Opening the full-size lightbox **re-uses the already-fetched blob**: KYC request count before opening = 4,
  after = 4. So a second admin-audited read is not triggered for the same object, as the fix note claims.
- `Escape` closes the lightbox and leaves the review dialog open (the capture-phase handler works).
- Screenshot: `rv/kyc-dialog.png`, `rv/kyc-lightbox.png`.

**(b) A non-admin is refused, tested by attempting it.** Real bearer tokens, real requests:

| caller | result |
|---|---|
| anonymous (no header) | **401** `Unauthorized` |
| `ama.mensah@gmail.com` (CUSTOMER) | **403** `Access denied. Required role(s): ADMIN.` |
| `yaw.osei@jinva.com` (ARTISAN) | **403** same |
| `admin@jinva.com` (ADMIN) | **200**, `image/jpeg`, 123 363 B, real JPEG magic bytes |

Also confirmed from inside the browser: navigating a logged-in tab straight to
`http://localhost:8000/api/v1/uploads/kyc/documents/efua-ghana-card-front.jpg` renders the **401** JSON
envelope — an `<img>`/address-bar request carries no `Authorization` header, which is the whole point.
Response headers on the 200 are exactly as contracted: `Cache-Control: private, no-store`,
`X-Content-Type-Options: nosniff`, `Content-Disposition: inline; filename="…"`, raw bytes (not the JSON
envelope). Path validation: `avatars/…` and `portfolio/…` → **400** (`Unknown KYC media folder`),
`documents/.env` → **400** (`Invalid KYC media filename`), `documents/..%2f..%2fpackage.json` → **400**,
a well-formed but absent filename → **404** with the same message as a wrong-folder object, so existence is
never confirmed. *(One expectation of mine was wrong, not the code: raw `documents/../../package.json` is
path-normalised by Express **before** routing, so it becomes `GET /api/v1/uploads/package.json` → 404
`Cannot GET`, not a 400. Nothing traverses, nothing leaks.)*

**(c) The old direct path truly 404s, in the storage mode actually running here** (default local provider —
confirmed by the upload endpoint returning relative `/uploads/...` URLs):

- `GET /uploads/documents/efua-ghana-card-front.jpg` → **404**, **even though that exact file is sitting on
  disk** (`ls uploads/documents/` lists it at 123 363 B). Same for `efua-selfie.jpg`, also on disk. A
  non-existent path (`/uploads/selfies/anything.jpg`) and the bare directory (`/uploads/documents/`) also 404,
  so the two cases are indistinguishable from outside — which is the point.
- **And still 404 when sent with a valid admin bearer token** — there is no back door through the static
  mount; the guarded endpoint is the only door.
- The five public folders are untouched: `avatars`, `portfolio`, `reviews`, `messages`, `job-attachments` all
  still serve `200` anonymously with `Cache-Control: public, max-age=31536000, immutable`.

**(d) The PDF branch — no longer untested.** Every seeded reference is a `.jpg`, so I created a real one
through the app's own API rather than reporting the path as unverified: artisan `adwoa.ansah@jinva.com`
(previously REJECTED, so re-submission is allowed) `POST /uploads/document` with a 593-byte valid
`%PDF-1.4` file → `200`, stored as `/uploads/documents/25e6a10c-….pdf`; `POST /uploads/selfie` → stored in
`/uploads/selfies/` (**the first object ever written to that folder** — see the seed minor above);
`POST /verification` → `201`, record **#11 PENDING**. Then as admin:

- `GET /uploads/kyc/documents/25e6a10c-….pdf` → `200`, **`Content-Type: application/pdf`**, 593 B, `%PDF-`
  magic bytes. `GET /uploads/kyc/selfies/b4c5127b-….jpg` → `200 image/jpeg` — the `selfies` folder branch
  works.
- In the UI, the front tile renders the **labelled "PDF document" file affordance** (no `<img>`, no broken
  image icon) and stays clickable with `aria-label="Open Ghana Card — front full size"`; the selfie tile next
  to it renders as an image at 1024×1024.
- Clicking the PDF tile opens the lightbox with an **`<iframe src="blob:…">`** at 768×840, and Chrome's PDF
  viewer renders page 1/1 with the fixture's text visible. Screenshots: `rv/kyc-pdf-dialog.png`,
  `rv/kyc-pdf-lightbox.png`.
- **Status**: **Verified fixed / verified working**, including the PDF and `selfies` branches that had never
  been exercised. One defect surfaced while doing it — the z-index item immediately below.

### [MINOR — NEW in pass 2] The full-size KYC lightbox paints *behind* the review dialog, so the enlarged document is half-covered
- **Repro**:
  1. Log in as `admin@jinva.com` → `/dashboard/admin/verifications`.
  2. Open the review dialog for a record whose files exist (#8 Efua or #9, profile #14).
  3. Click any document tile ("Tap any document to open it full-size").
  4. The lightbox opens **underneath the review dialog**. The document is there and correct — the middle
     ~55% of it is simply covered by the dialog panel.
- **Expected**: clicking a tile shows the document full-size, unobstructed. That is the entire purpose of the
  affordance, and the instruction on screen says so.
- **Actual**, measured rather than eyeballed, with the lightbox open:
  ```
  lightbox z-index: 50      dialog-content z-index: 50      dialog-overlay z-index: 50
  DOM order:                lightbox BEFORE dialog
  document.elementFromPoint(viewport centre)        → DIV.grid grid-cols-2 gap-3 text-sm  (inside the DIALOG)
  document.elementFromPoint(centre of the lightbox image) → the same dialog DIV
  lightbox <img>: 1024×1024 natural, 768×768 on screen, src = blob:…  (it IS rendered, just covered)
  ```
  Equal `z-index: 50` on both layers, so paint order falls back to DOM order — and Radix portals
  `DialogContent` to the **end of `<body>`**, while the lightbox is rendered inline in the page tree. The
  later element wins. Screenshots make it unambiguous: `rv/kyc-lightbox.png` (image) and
  `rv/kyc-pdf-lightbox.png` (PDF, where the viewer's toolbar is visible above the dialog and the page area is
  covered).
- **Pre-existence confirmed independently** (the frontend-engineer's claim checked, not taken):
  `git show 287ebe8^:…/admin/verifications/page.tsx` renders `<Lightbox>` at the **same place** — a sibling
  after `</Dialog>`, lines 739–743 — and `git log --oneline -- src/components/ui/lightbox.tsx` shows one
  commit, `ab2f7c1`, which predates this round. `287ebe8` changed only what goes *inside* the lightbox. So the
  defect is **pre-existing and out of this round's scope**; it was invisible before only because the tiles it
  enlarged were themselves broken (`<img src>` on a now-404 path), so nobody got as far as looking at the
  enlargement.
- **Impact**: an admin cannot examine an ID document at full size — the one thing this screen exists for.
  Worth prioritising despite being out of scope. Workaround while it is open: the tile thumbnails are
  legible-ish at 1024×1024 natural resolution but displayed tiny.
- **Likely location**: `jinva-frontend-web/src/components/ui/lightbox.tsx:60` (`z-50` on the overlay root) or
  the call site in `src/app/dashboard/admin/verifications/page.tsx:754`. Raising the lightbox above Radix's
  layer (e.g. `z-[60]`) fixes the paint order; note the shared `Lightbox` is used by four callers
  (portfolio gallery, review photos, message images, this screen), so a blanket bump should be checked against
  the admin dispute conversation viewer, which opens it from **inside** a Sheet.
- **Status**: Open — new, frontend-engineer. **Pre-existing / out-of-scope for this round**, same treatment as
  the other pre-existing findings here.

### [OBSERVATION] Every authenticated page load burns a 401 round-trip before refreshing
- On each dashboard navigation the pattern is: preflight `204` → data requests `401` → `POST /auth/refresh-token`
  `200` → same requests retried `200`. Example on `/dashboard/user`: `/jobs/mine`, `/notifications/unread-count`
  and `/messages` all 401 first, then succeed. It happens **seconds after a successful login**, so it is not
  genuine token expiry.
- Functionally correct — the refresh path in `lib/api.ts` does its job and the user sees nothing. Noted
  because it triples the request count on every page and fills the console and the backend error log with
  noise that masks real 401s. Out of this round's scope; no criterion covers it.
- **Pass 2**: unchanged — reproduces on **every one of the 33 dashboard screens** swept, for all three roles.
  It is the sole source of console noise on authenticated pages, and it is now the thing most likely to hide a
  real 401 during the next round's QA. Still informational, still nobody's item this round.
- **Status**: Informational

### [OBSERVATION — NEW in pass 2] The dev database is accumulating e2e fixture users: 239 of 254
- `GET /admin/users` (paginated, as admin) reports **254 users, of which 239 are `*@test.jinva.local`** —
  `a4-customer-a-…`, `cron-artisan-…` and friends, created by `booking-concurrency` and `cron-idempotency`
  on every e2e run and never cleaned up. 12 are the seeded accounts; the rest are real signups.
- Nothing is broken by it, and no criterion covers it, but it has two side effects worth knowing: the admin
  **Clients** screen renders a 13.5 KB wall of test users (I saw it in the sweep), and `/admin/users`
  pagination now reports **127 pages** at `limit=2`. Any future "does this list look right" check will be
  fighting it. A cleanup in the specs' `afterAll`, or a periodic `seed:force`, would fix it — the latter
  needs the seed crash fixed first.
- **Status**: Informational — backend-engineer's call whether to act.

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

> **Pass-2 update:** this caveat is now discharged, and the expectation in its last sentence is deliberately
> obsolete. KYC media no longer goes through `resolveMediaUrl()` at all; both folders were exercised for real
> in pass 2 (5 fixture files in `documents/`, plus the first-ever object in `selfies/` from a live submission).
> See "[VERIFIED FIXED — NEW in pass 2] Admin KYC media …" in the frontend section.

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

**Pass-2 regression pass on adjacent features** (the avatar fix touched 33 call sites in 31 files, so the
blast radius is the whole authenticated app — this is the sweep that covers it):

- **33 dashboard screens across all three roles** loaded on a production build with a fresh browser profile.
  Every screen rendered its own `h1`, no blank sections, no stuck spinners, no unhandled errors. Full
  per-screen output (images, origins, GH₵/`$` counts, console) retained.
- **Role boundaries, re-attempted not re-read**: artisan → 5 forbidden paths, all bounce to
  `/dashboard/artisan`; customer → 4, all bounce to `/dashboard/user`; admin → 2, both bounce to
  `/dashboard/admin`. Admin-only KYC bytes refused for both non-admin roles at the API (403) as well as at the
  route level.
- **Auth session, end to end, per role**: login through the real form → `jinva_session` + `refresh_token` both
  `httpOnly`, `SameSite=Lax`, `Path=/`; access token **not** in a readable cookie and the refresh token
  **not** in the JSON body; the in-tab `jinva:user:v4` cache is written; **logout via the real user menu**
  ("Profile / Settings / Log out") clears **all** cookies, and a protected route then redirects to
  `/login?redirect=%2Fdashboard%2F…` with the param preserved. **Verified separately for all three roles**;
  on the artisan run I also confirmed `sessionStorage` comes back **completely empty** after logout (so
  `clearCache()` does run on that path — it is only a *successful login* that leaves a stale `v3` key alone,
  which is harmless).
- **Money**: GH₵ present and no raw `$` on every money-bearing screen (artisan earnings, artisan/admin
  analytics, admin transactions ×24 amounts, user report, admin disputes). Decimal inconsistency is the
  separate deferred ticket, untouched here.
- **Paginated list shapes**: `/admin/verifications`, `/admin/reviews`, `/payments/admin/all` and `/admin/users`
  all answer `data: [...]` + `meta.pagination {total,page,limit,totalPages}`; `/verification` the same. Each
  backing screen rendered its rows (admin verifications 5–6 rows, transactions 10 avatars, orders 6). No
  shape mismatch seen this pass.
- **`_vercel/insights` 404** still the only console error on public pages (unchanged, deferred by decision).

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

**Standard checks — QA pass 2, re-run in full on the current tree**

| Check | Result | vs pass 1 |
|---|---|---|
| FE `npm run check:colors` | pass — **243** files, 0 hardcoded palette classes or hex literals, 4 allowlisted | +1 file (`components/admin/kyc-media.tsx`), still clean |
| FE `npm run lint` | **0 errors**, 5 warnings | identical set, all pre-existing |
| FE `npm run build` | pass (after `rm -rf .next`) — `/` still `○` prerendered static; **0 `metadataBase` warnings** | was 3 `metadataBase` warnings |
| BE `npm run lint` | **0 errors**, 25 warnings | unchanged |
| BE `npm run build` | pass | unchanged |
| BE `npm run test` | **363/363 pass, 40 suites** | +44 tests, +3 suites, all green |
| BE `npm run test:e2e` | 126/133; **the same 7 failures in the same 2 suites** | +8 tests (all pass), baseline unchanged |
| BE `npm run seed` / `seed:force` | **CRASHES** — `Entity metadata for Review#photos was not found` | not run in pass 1; new major above |

> **Two process notes from pass 2, neither a code defect.**
> 1. `npm run lint` in the backend is `eslint --fix`, so it **rewrites files in place**. On Windows it left
>    three files (`seed.ts`, `main.ts`, `app.e2e-spec.ts`) showing as modified in `git status` with an
>    **empty `git diff`** — line-ending churn only. I restored them with `git checkout --` so the tree is
>    clean; worth knowing before anyone chases a phantom diff after a lint run.
> 2. The backend's CORS allow-list admits only `localhost:3000` and `localhost:4200`. A browser pass served
>    from any other port fails every login with a CORS error that looks exactly like broken auth. See the
>    pass-2 header.

> **Build note, not a bug:** my first `npm run build` failed with
> `EINVAL: invalid argument, readlink '.next/postcss.js.map'`. That was a stale `.next` left by a dev
> server running concurrently on port 4200. `rm -rf .next` then `npm run build` succeeds every time. Not a
> code defect — recorded so it isn't mistaken for one.

---

## Summary — QA pass 2 (re-verification), 2026-08-27

### Every item that carried a fix note, re-tested

| # | Item | Owner | Pass-2 verdict |
|---|---|---|---|
| 1 | `/` has no `og:image` (MAJOR, LP11) | frontend | **Verified fixed** — all 7 public pages emit `og:image` + `twitter:image` 1200×630 with alt |
| 2 | `metadataBase` unset (MAJOR, LP11) | frontend | **Verified fixed** in code — 0 build warnings (was 3), value now config-driven. Operator must set `NEXT_PUBLIC_SITE_URL` **at build time** |
| 3 | Avatar URLs bypass `resolveMediaUrl()` (MAJOR) | frontend | **Verified fixed** — 33 screens, 3 roles, fresh profile: **0** `/uploads/` requests to the frontend origin, 51 media images decoded, 0 broken |
| 4 | Public 404 has no `<h1>` (MINOR, LP10) | frontend | **Verified fixed** — outline `h1 → h2×4`, `<title> Page not found · JinVa`, still a real 404, 1 robots tag |
| 5 | Hero's unlabelled 4.8/37 (MINOR, LP8) | frontend | **Verified fixed** per the recorded decision — "Sample content" badge + `Info` icon inside the card |
| 6 | Signup label `htmlFor` ids (MINOR) | frontend | **Verified fixed** — real clicks on both labels open the *correct* dropdown; LP13 prefill still green |
| 7 | Seeded `profile_picture` 404s (MINOR) | backend | **Fixed at source · still failing at runtime** — the DB still holds 8 stale `/uploads/profiles/…` values and the prescribed `seed:force` **crashes** (new major #8) |
| 8 | KYC media via the authenticated endpoint (landed post-pass-1) | backend + frontend | **Verified working** — admin tiles render from `blob:` at 1024×1024; 401 anon / 403 customer / 403 artisan / 200 admin; old public path 404s even with an admin token; **PDF and `selfies` branches now exercised for the first time** |

### New in pass 2

| Severity | Item | Owner | Scope |
|---|---|---|---|
| **MAJOR** | `npm run seed` / `seed:force` crash: `Entity metadata for Review#photos was not found` | backend | **pre-existing** (since `2e7df42`), zero product-runtime impact, but blocks item 7's runtime verification and blocks any fresh environment |
| MINOR | Seeded verification rows reference 13 KYC files the seed never writes (8 of 13 → 404); seeded selfies stored under `documents/` | backend | pre-existing, dev-data only |
| MINOR | Full-size KYC lightbox paints **behind** the review dialog (both `z-50`, Radix portal DOM order) | frontend | **pre-existing** — confirmed against `287ebe8^`; only the lightbox's *contents* changed this round |
| MINOR | `booking-concurrency` A4 e2e pins `[201, 409]`, intermittently gets `[201, 400]` (1 fail / 5 runs) | backend | pre-existing test defect; the invariant it guards never broke |
| — | Dev DB accumulating e2e fixture users (239 of 254) | backend | informational |

Untouched by request, exactly as instructed: DT2's two sub-AA colour tokens (**Closed — accepted**),
`formatCurrency()` decimals (pre-existing, separate ticket), `_vercel/insights` console 404 (pre-existing).

### Release readiness

**This round's own scope is release-ready: zero open blockers and zero open majors attributable to it.**
All six frontend fix items are verified fixed by re-running my own repros, and the KYC media path — the one
piece of new behaviour that landed after pass 1 — is verified on all four axes I was asked to check, including
the PDF branch that had never been exercised by any stored reference.

**One open major stands outside that scope and should not be swept up in the verdict silently: the seed
crash.** Applying the "zero open blocker/major" bar literally, it is the single item between this report and a
clean sheet. My reading: it does not gate *shipping* this round (seeds never run in a deployed environment,
and nothing in the product path depends on them), but it does gate two things that matter right now — the
final closure of item 7, and any developer or QA pass starting from a fresh database. It is a small, contained
fix (point the seed's `DataSource` at the app's entity glob instead of a hand-maintained array). **Recommend:
ship the round, fix the seed immediately after, then item 7 closes on the next `seed:force`.**

**Open minors: 6** (none blocking):
1. `_vercel/insights` console 404 — pre-existing, deferred by decision.
2. `formatCurrency()` decimal inconsistency — pre-existing, separate ticket.
3. Seeded `profile_picture` values still 404 in this DB — code fixed, runtime blocked on the seed crash.
4. Seeded verification rows reference 13 KYC files that are never written — new, dev-data only.
5. `booking-concurrency` A4 status-pair flake — new, test-only.
6. **KYC lightbox paints behind the review dialog** — new, pre-existing, and the one I would pull forward
   despite being out of scope: an admin currently cannot view an identity document full-size, which is the
   entire purpose of the screen this round just rewired.

(DT2's two sub-AA tokens remain **Closed — accepted**, not counted. The e2e fixture-user build-up is
informational, not counted.)

Still not closeable by QA alone, unchanged from pass 1: **BI1/BI2's live S3 cutover** and **BI4's
`MAIL_PROVIDER=resend`** (user action — code paths verified ready), plus the new **`NEXT_PUBLIC_SITE_URL`**
build-time variable, which must be set in each deployed environment before any link preview resolves.

---

## Summary — QA pass 1 (superseded by the table above; kept for the audit trail)

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

<!-- Pass 2 is complete: every item that carried a fix note has a RE-VERIFIED block with fresh evidence.
     Five items remain open and need a fix note appended under them, after which I will re-run only those:
       backend  — [MAJOR] seed crash (Review#photos); seeded KYC document refs; A4 e2e status-pair flake
       frontend — [MINOR] KYC lightbox z-index vs the review dialog
       (item 7, seeded profile_picture, needs no code change — it re-verifies itself once the seed runs)
     Re-test notes for whoever picks these up:
       * serve the frontend on port 3000 or 4200, or every login fails on CORS;
       * for the seed fix I will run `npm run seed:force` and then re-check `GET /admin/users` for null
         profilePicture plus a browser pass for zero `/uploads/profiles/` requests;
       * for the z-index fix I will re-measure `document.elementFromPoint()` at the centre of the lightbox
         image with the review dialog open, and re-check the other three Lightbox callers (portfolio gallery,
         review photos, message images) plus the admin dispute conversation viewer, which opens it inside a
         Sheet. -->
