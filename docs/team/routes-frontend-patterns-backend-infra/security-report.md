# Security Report: Routes, Frontend Patterns & Backend Infra

**Reviewer:** security-engineer · **Date:** 2026-08-27
**Scope:** frontend `1d6aaa3..c38dac2`, backend `41815ba..ea52e86`. BI3 excluded (deferred, not built).
**Baseline pass:** `security-review` skill methodology executed directly (its sub-agent orchestration is unavailable in this thread), then the round-specific manual review below.
**No `.env` / `.env.*` file was opened, read, grepped or inspected. No credential value appears anywhere in this report.** Key-rotation evidence below is established by SHA-1 blob-hash comparison only — no key material was displayed.

## Re-verification pass — 2026-08-27, security-engineer

Fix notes were appended under every open item by backend-engineer (`350dc0b`, `b5d696c`, `ac050a9`) and
frontend-engineer (`518498c`, `287ebe8`, `15e70ac`). **None was taken on trust.** Every finding below now
carries a `Re-verified` block with my own fresh evidence and a status of **Verified fixed** or
**Still present**.

**How I re-tested — my own probes, not the engineers' specs.** I wrote three throwaway probe suites, ran
them, and **deleted them**. `git status` is clean in both repos and no application code was touched:

| Probe (deleted after the run) | What it drove | Result |
|---|---|---|
| `JIN_VA-BACKEND/test/zzsecrev.e2e-spec.ts` | Real Nest app + real DB + real RS256 tokens for **ADMIN / ARTISAN / USER**, `STORAGE_PROVIDER=local` (the harsher mode — the one where `documents/` used to be the *active, publicly served* store). 8 cases: public-mount withholding with the file present on disk, traversal *out of a public folder mount* into `documents/`, every non-admin role, forged/garbage bearer tokens, folder-enum closure, filename walk-out, response-header injection | **8/8 pass** |
| `JIN_VA-BACKEND/src/mail/zzsecrev.spec.ts` | The **real `resend` SDK** (no `jest.mock('resend')`) against a stubbed `fetch`, plus `MailService` + `SmtpMailProvider` driven with a nodemailer-shaped 535. 8 cases including restore-under-a-real-throw and interleaved concurrent sends | **8/8 pass** |
| `JIN_VA-BACKEND/src/uploads/zzsecrev.spec.ts` | `S3StorageProvider.upload()` for both private folders with `AWS_S3_PUBLIC_URL_BASE` set **and** unset, all five public folders, all four env combinations of the mount plan, a 30-case filename fuzz | **6/6 pass** |

As a control I re-ran the engineers' own suites (`src/uploads` + `src/mail` → 109/109, 11 suites; the
`legacy-media-serving` e2e → 14/14) and re-ran `npm audit` in both repos.

**What changed in the verdict.** The KYC HIGH is closed, and all four MEDIUM log/cache items are closed. But
`npm audit` on the **frontend** now surfaces a **new open HIGH/critical**: `next@15.5.4` itself carries a
critical advisory with a *non-breaking* patch available, and several of its HIGH advisories are
middleware-bypass classes that bear directly on this app's `/dashboard/*` gate. The frontend half of the
dependency finding was never actioned (`ac050a9` was backend-only, as its own note says).

## Re-verification pass — round 3 (final), 2026-08-27, security-engineer

The two items left open at the end of round 2 were fixed and re-checked here. **Both are now
Verified fixed**, with my own fresh evidence, not the engineers' claims:

| Item | Fix commits | My evidence | Status |
|---|---|---|---|
| `next@15.5.4` critical + middleware-bypass advisories | `67298ee` / `45c265d` | `npm audit` re-run (both views), my own `npm run build` + `next start` (logged `▲ Next.js 15.5.24`), **16** bypass probes across all three advisory classes, plus 2 controls, source hashes of the gate re-confirmed | **Verified fixed** |
| `SubmitVerificationDto` KYC media fields unvalidated | `48b0ea3` / `a7e35d8` | **11** probe cases through the real DTO, asserting *which constraint fired*; plus a measured confirmation of the same latent gap on all four sibling fields | **Verified fixed** (consequence (1) re-filed as LOW) |

**Verdict change: ship-blocking items go from 1 to 0.** See [Release readiness](#release-readiness). The
residual `postcss`-via-`next` entry is **not** an open high in my judgement — reasoning under that finding.

**Scope discipline.** I re-tested only these two items plus the regression surface they touch. Everything
marked Verified fixed in round 2 was left alone; nothing in either fix commit goes near it (`67298ee` is
`package.json` + `package-lock.json` only; `48b0ea3` is one DTO file, purely additive). The
`security-review` skill was re-run scoped to both diffs as a cross-check and returned **no findings** —
correctly, since one diff has no source change and the other only narrows an accepted input set.

**No `.env` / `.env.*` file was opened, read or grepped in this round either.** The one env-name question
that came up (`S3_PUBLIC_URL_HOST` vs `AWS_S3_PUBLIC_URL_BASE`) was answered by grepping **code references**
only, which is sufficient to establish the mismatch. No credential value appears anywhere in this report.

## Lead finding — read first

### [HIGH] RS256 JWT signing keypair is recoverable from git history
- **Category**: CWE-798 / CWE-540 · OWASP A07 Identification & Authentication Failures
- **Location**: `JIN_VA-BACKEND/keys/private.key` added at commit `2a8a0e9`, deleted at `cf5faeb`; consumed at `JIN_VA-BACKEND/src/auth/auth.module.ts:24-39` and `JIN_VA-BACKEND/src/auth/strategy/jwt.strategy.ts:9-22`
- **Scope note**: **Pre-existing. Not introduced by this round. Explicitly out of this re-verification round's scope** (confirmed with the requesting lead) — nothing here has changed and nothing was re-tested. It still needs the operator action specified below.
- **How found / exploit path**: `keys/` is correctly untracked and gitignored today (`.gitignore:59`), but `git log --all --diff-filter=A -- keys/private.key` shows the blob was committed at `2a8a0e9` and is still reachable from `develop` and ~10 other branches. That file is the RS256 *signing* key: `loadKey('JWT_PRIVATE_KEY', 'keys/private.key')` with `signOptions.algorithm: 'RS256'`. Anyone with repo, fork, clone or CI-cache access can extract it and mint an access token with an arbitrary `sub` and `role` — including `admin` — against any environment still running that keypair. **Mitigating evidence:** the working-tree pair has been rotated since. Blob hashes differ (`private.key` historical `a15bd50…` vs working `0da340f…`; `public.key` historical `b60f2ac…` vs working `af5eff1…`), so the leaked key is not the current local key. I cannot verify deployed values without reading environment configuration, which is out of bounds.
- **Remediation**: (1) Operator confirms every deployed environment's `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` is the rotated pair, not the historical one — if there is any doubt, rotate again; note that rotation invalidates all live access tokens, so schedule it. (2) Purge the blob from history with `git filter-repo`/BFG across all branches and force-push, then have every contributor re-clone. (3) Add a pre-commit/CI secret scan so a key cannot be re-committed. (4) Consider dropping the on-disk fallback in `loadKey` for production so a stray file can never be picked up.
- **Owner**: backend-engineer + operator
- **Status**: **Open — pre-existing, tracked separately, does not gate this round's new code**

> **Re-verified (security-engineer):** nothing to re-verify — out of round by agreement. One incidental
> positive I can record from this round's probes: the *consuming* side is sound.
> `src/auth/strategy/jwt.strategy.ts:22` pins `algorithms: ['RS256']` (no `alg`-confusion / `none` downgrade),
> `ignoreExpiration: false`, and `validate()` rejects a banned user. My probe **P4** fired four bad tokens at
> the new admin-only endpoint — empty, garbage, a well-formed HS256 token carrying `role: "ADMIN"` signed with
> the wrong key, and a valid admin token with a mutated signature — and got **401 on all four**. So the
> exposure is purely "does any environment still run the leaked pair", which only the operator can answer.

## Backend-owned findings

### [HIGH] The CDN cutover makes KYC identity documents and selfies publicly readable
- **Category**: CWE-200 / CWE-359 Exposure of Private Personal Information · OWASP A01 Broken Access Control
- **Location**: `JIN_VA-BACKEND/src/uploads/providers/s3-storage.provider.ts:206-211` (`buildPublicUrl`); folder union at `JIN_VA-BACKEND/src/uploads/providers/storage-provider.interface.ts:1-9`; upload endpoints at `JIN_VA-BACKEND/src/uploads/uploads.controller.ts:63-101`; consumer at `JIN_VA-FRONTEND/jinva-frontend-web/src/app/dashboard/admin/verifications/page.tsx:349-353`
- **How found / exploit path**: `buildPublicUrl` returns a single public bucket/CDN URL shape for **every** value of `UploadFolder`, and that union includes `documents` and `selfies` — national ID front/back and KYC selfies, uploaded via `POST /uploads/document` and `POST /uploads/selfie`. `S3StorageProvider.upload` sets no ACL, so objects inherit the bucket default; but the admin verification screen renders those stored URLs directly as image tiles (a browser `<img>`/lightbox fetch that carries no `Authorization` header), so the objects **must** be anonymously readable for the feature to work at all. Following BI1's documented cutover therefore requires a publicly-readable prefix containing identity documents, protected only by UUID obscurity, with no expiry, no revocation and no access audit trail. Same shape already applies to the legacy `/uploads` static mount, which this round deliberately preserves. BI3's deferral does not cover this — that decision was about the *upload* leg; this is the *delivery* leg BI1/BI2 explicitly ship.
- **Remediation**: Split the key namespace by sensitivity before flipping `STORAGE_PROVIDER=s3`. Keep `documents` and `selfies` in a private prefix (ideally a separate bucket) that is never fronted by `AWS_S3_PUBLIC_URL_BASE`, and serve them to admins through an authenticated backend endpoint that issues a short-lived presigned GET. Only `avatars`, `portfolio`, `reviews`, `messages` and `job-attachments` belong on the public CDN prefix. The frontend then needs the admin verification tiles pointed at the authenticated endpoint rather than the raw stored URL.
- **Owner**: backend-engineer (frontend-engineer for the admin tile source, once the endpoint exists)
- **Status**: **Verified fixed** (2026-08-27, security-engineer — 14 independent probe cases)

> **Fix note — backend-engineer, 2026-08-27 (commit `350dc0b`).** The sensitivity split now lives in one
> place, `src/uploads/upload-folders.ts`, and is applied to both providers and to the static mount.
>
> - **S3.** `upload()` keys through `buildS3ObjectKey()`: public folders keep their exact existing key, while
>   `documents`/`selfies` go under a `private/` prefix. `buildPublicUrl` is no longer reachable for a private
>   folder at all — `upload()` returns `buildPrivateMediaReference()` instead, so **no public URL for a KYC
>   object is ever minted or persisted**, not even an unreadable one (a stored public URL is what turns a
>   later bucket-policy mistake into a breach). `delete()` targets the same prefixed key.
> - **Local.** `applyLegacyMediaServing` is now an **allow-list**: one static handler per public folder at
>   `/uploads/<folder>`, rather than one for the whole tree. `documents`/`selfies` match no handler and fall
>   through to Nest's clean JSON 404 — even when the file exists on disk, which the e2e now asserts. On-disk
>   layout is deliberately unchanged (`uploads/documents/…`), because moving the files would break every
>   historical row.
> - **Both.** One reader: `GET /api/v1/uploads/kyc/:folder/:filename` — `JwtAuthGuard` + `RolesGuard`
>   `@Roles(ADMIN)`, streams the bytes with `Cache-Control: private, no-store`, `nosniff`, and a log line
>   naming the acting admin and the object key (your "no access audit trail" point). It reads local disk
>   **first**, then the active provider, so the whole pre-cutover verification backlog still resolves after
>   the cutover — the same legacy problem BI2 solved for public media, but behind an admin guard instead of a
>   public URL. `folder` is restricted to the two KYC values (a public folder is a 400, so it can't become a
>   general file proxy) and `filename` must match `^[A-Za-z0-9][A-Za-z0-9._-]*$` with no `..`.
>
> **Chose streaming over a presigned GET, deliberately** (your remediation allowed either): a presigned URL
> is a bearer credential in a query string — copyable from devtools, forwardable, loggable by an
> intermediary, leakable via referrer — and the failure being fixed *is* "an anonymously-readable URL to an
> identity document", so not minting one is the stronger answer. It also gives local and S3 mode one
> identical code path, and needs no new dependency (`@aws-sdk/s3-request-presigner` isn't installed) or
> signing secret. **Accepted cost, please weigh it:** these bytes pass through the app server, contrary to
> PRD §9 — scoped to this one prefix, admin-only, low-volume, ≤10MB per object.
>
> New tests: `src/uploads/upload-folders.spec.ts`, `src/uploads/kyc-media.service.spec.ts`, a
> `KYC key separation` block in `s3-storage.provider.spec.ts` (asserts no CDN host, no bucket name and no
> `https:` in a private upload's returned URL even with `AWS_S3_PUBLIC_URL_BASE` set, and that all five
> public folders still get the identical CDN URL they got before), and e2e coverage of the 401 / 403 / 200
> boundary plus the "public mount does not serve KYC" case in `test/legacy-media-serving.e2e-spec.ts`.
>
> `docs/team/routes-frontend-patterns-backend-infra/api-contract.md` is written and documents the endpoint,
> the stored-reference → request-path mapping, and the blob-fetch consequence for the admin tiles.
>
> **Not covered, flagged rather than widened:** an artisan viewing their own submitted document.
> `GET /verification/me` returns references an artisan cannot resolve, because the guard is ADMIN-only per
> your remediation. If that screen needs a thumbnail, it's a product-manager scope call.

> **Fix note — frontend-engineer, 2026-08-27.** The delivery-leg consumer is now wired to the authenticated
> endpoint, so no part of the app asks for a KYC object over an anonymous URL any more.
>
> - **`src/app/dashboard/admin/verifications/page.tsx`** no longer puts `documentFrontUrl` /
>   `documentBackUrl` / `selfieUrl` into `<img src>`, and **no longer imports `resolveMediaUrl` at all** —
>   that helper would rebuild exactly the dead-and-now-404 `/uploads/documents/…` path this change closes.
>   Those three fields are treated as stored references and used only as map keys.
> - **New `src/components/admin/kyc-media.tsx`** owns the whole mechanism: `kycMediaPath()` does the
>   contract's §1.2 mapping (`/uploads/{folder}/{file}` → `/uploads/kyc/{folder}/{file}`, rejecting anything
>   that isn't that exact shape), `useKycMedia()` fetches each reference once as a blob and hands the DOM an
>   object URL, and `KycMediaTile` / `KycMediaFull` render it. Object URLs are revoked when the reviewed
>   record changes and on unmount, in a separate effect from the fetch so a retry can't revoke a URL the DOM
>   is still displaying.
> - **`src/lib/api.ts`**: added `apiFetchBlob()`. The bearer header, the one-shot 401 refresh-and-retry and
>   the `ApiError` mapping were extracted into a shared `authedRequest()` so the raw-bytes endpoint gets
>   identical auth handling to every other call rather than a second hand-rolled fetch. `apiFetch` and
>   `apiFetchWithMeta` are unchanged in behaviour.
> - All three tiles and the lightbox read from **one** fetch per object, so opening a document full-size does
>   not hit your admin-audited endpoint a second time for bytes already in memory (measured: 6 KYC requests
>   before opening the lightbox, 6 after).
> - Error states follow §1's table: 404 and 400 render "This file is no longer available." with **no** retry
>   affordance (400 additionally `console.error`s, since it means the caller built the path wrong); 403
>   renders "You do not have access to this file."; 5xx/network renders "Couldn't load this file." **with** a
>   Retry button. `contentType` is branched on rather than assumed, so `application/pdf` gets a labelled file
>   affordance in the tile and an embedded viewer in the lightbox.
>
> **Verified in Chrome (CDP, real clicks) against a production build** — `npm run build` + `next start`, and a
> real login as the seeded `admin@jinva.com`, not a code read:
>
> | Assertion | Result |
> |---|---|
> | Tiles render from `blob:` object URLs, never a remote URL | **PASS** — 3/3 tiles, `blob=true` |
> | Images decode to real pixels | **PASS** — 1024×1024 on all three |
> | Bytes arrive via `GET /uploads/kyc/…` | **PASS** — `200` per object (plus the CORS `204` preflight) |
> | Direct requests to `/uploads/documents|selfies` | **PASS — 0**, across all 5 verification records opened |
> | Missing object | **PASS** — `404` → "This file is no longer available.", no retry button |
> | Lightbox re-uses the cached blob | **PASS** — no refetch |
> | Anonymous fetch of the same path | **401** (checked directly with `curl`, outside the browser) |
> | Legacy public path for the same file | **404** (as designed) |
>
> Test fixtures: the seeded verification rows point at filenames that were never written to disk (the same
> class as the seeded-avatar issue in the QA report), so every record rendered the 404 tile and the success
> path was untestable as shipped. I placed local fixture files in the backend's **gitignored** `uploads/`
> directory for two records (profiles #13 and #14) and left #12/#15 without files, which is why both states
> above are evidenced. **No backend source was modified**, and one verification submission was exercised
> through the real `POST /uploads/document` + `/uploads/selfie` endpoints to confirm the upload→reference→read
> round trip. To reach the screen at all I ran my local backend instance with `ALLOWED_ORIGINS` including my
> test port in the **process environment only** — no `.env` file was read or written at any point.
>
> **Two things I did not close, flagged rather than papered over:**
> 1. **The PDF branch is coded but NOT exercised.** `POST /uploads/document` accepts `application/pdf`, and
>    the tile/lightbox branch on `Content-Type` for it, but every stored reference I could reach ends `.jpg`
>    and I can't attach a new reference to an existing verification row without DB access. Worth a targeted
>    re-test when a PDF submission exists.
> 2. **Pre-existing, and NOT introduced by this change:** the full-size lightbox paints *behind* the review
>    dialog, because `Lightbox`'s backdrop and Radix's `DialogContent` are both `z-50` and the dialog is in a
>    body-appended portal, so it wins on DOM order. My diff changed only the lightbox's *contents*, not its
>    placement, so this behaved identically before. It makes "Tap any document to open it full-size" much less
>    useful on this screen. Left alone because it is out of this round's scope and the real fix touches the
>    shared `Lightbox` primitive used by four other screens (portfolio gallery, review photos, message images,
>    dispute conversation panel) — worth its own ticket.

> ### Re-verified — **Verified fixed** (security-engineer, 2026-08-27)
>
> I did not accept either fix note. Fourteen of my own probe cases, run against the real app, all pass.
>
> **(a) "No code path can produce a public URL for a private folder, in either storage mode."** Holds. Two
> independent lines of evidence:
> - *Static:* `buildPublicUrl` is `private` and has exactly **one** call site,
>   `s3-storage.provider.ts:131`, inside the ternary `isPrivateUploadFolder(options.folder) ?
>   buildPrivateMediaReference(...) : this.buildPublicUrl(...)`. A repo-wide grep for `buildPublicUrl` returns
>   only that call, the declaration, and three comments. There is no second URL builder.
> - *Dynamic (probes U1–U3):* I drove `upload()` for `documents` and `selfies` with `AWS_S3_BUCKET`,
>   `AWS_S3_REGION` **and** `AWS_S3_PUBLIC_URL_BASE` all set, and again with the CDN base **deleted** so the
>   `https://<bucket>.s3.<region>.amazonaws.com` fallback would be in play. In all four combinations the
>   returned `url` contained no `http`, no CDN host, no bucket name, no region, no `amazonaws`, and not even
>   the `private/` prefix — it was exactly `/uploads/<folder>/<uuid>.<ext>`. The prefix appears only on the
>   S3 *key* (`private/documents/<uuid>.jpg`, confirmed in the provider's own log line). All five public
>   folders still resolve to the identical `<CDN>/<folder>/<uuid>.jpg` they did before — no regression.
>
> **(b) "The guard actually rejects non-admin roles."** Holds, and more broadly than the engineer's e2e
> asserted (which covered anonymous + artisan). Probe **P3** minted real RS256 tokens for all three roles
> against the real DB: anonymous → **401**, `ARTISAN` → **403**, `USER`/customer → **403**, and in every
> rejection the response body was JSON, not the PNG bytes. `ADMIN` → **200** with the exact bytes (P5).
> Probe **P4**: four bad tokens including a well-formed HS256 token claiming `role: "ADMIN"` → **401 × 4**.
> Guard ordering is correct by construction: `JwtAuthGuard` is class-level (`uploads.controller.ts:51`) and
> so runs before the method-level `RolesGuard` (`:198`), which is what populates `req.user` for
> `roles.guard.ts:43`.
>
> **(c) "It can't become a general file-read proxy."** Holds. Probe **P6** fired 13 folder values at the
> endpoint with a valid admin token — all five public folders, `Documents`, `DOCUMENTS`, `documents%20`,
> `private`, `private%2fdocuments`, `..`, `%2e%2e`, `.` — every one was **≥400** and none returned file
> bytes. The check is `isPrivateUploadFolder()`, an exact-match `includes` on a two-element `as const` array,
> so it is case-sensitive and closed. Probe **P7** fired 13 filenames including `..%2f..%2fpackage.json`,
> `..%5c..%5cpackage.json`, `....%2f%2f`, `%2e%2e%2f`, `.env`, `..`, `.`, a NUL byte, an attempt to hop
> sideways into `avatars/`, and a 4000-char name — all **≥400**, none leaked `package.json` and none leaked
> the public fixture. Probe **U5** fuzzed `isSafeMediaFilename` with 30 hostile strings (CRLF header
> injection, quotes, backslashes, shell metacharacters, BOM, encoded traversal, leading/trailing space) —
> **all rejected**; three legitimate UUID-shaped names accepted. Defence is doubled downstream by
> `basename()` in `LocalStorageProvider.readPrivate` (`local-storage.provider.ts:80`).
>
> **(d) The public mount really is an allow-list, in *local* mode too.** The engineer's e2e only exercised
> the public-mount withholding under `STORAGE_PROVIDER=s3`. I ran probe **P1** under
> `STORAGE_PROVIDER=local` — the harsher case, because `documents/` used to be the *active, publicly served*
> store there — with both `uploads/documents/<file>` and `uploads/selfies/<file>` physically written to disk:
> both returned **404 with `application/json`**, no `image/*` content type, and no `Cache-Control` containing
> `public` or `immutable`. Control in the same run: `/uploads/avatars/<file>` returned **200** with
> `immutable`, so the 404s are the allow-list working rather than a broken fixture. Probe **U4** confirms
> `resolveLegacyMediaPlan` excludes both KYC folders in **all nine** `STORAGE_PROVIDER` ×
> `SERVE_LEGACY_UPLOADS` combinations, and that `servedFolders` is exactly the five public folders.
>
> **(e) The attack the engineer did *not* test, and the one I most wanted to run: climbing out of a public
> folder mount into a private one.** Each folder now has its own `useStaticAssets` rooted at
> `uploads/<folder>`, so the question is whether `send` can be walked up one level. Probe **P2** fired 13
> shapes — `/uploads/avatars/../documents/<kyc>`, `..%2f`, `..%2F`, `%2e%2e/`, `..%5c`, `....//`,
> `/uploads/portfolio/../documents/…`, `/uploads/documents%2f<kyc>`, `//uploads/…`, `/uploads//documents/…`,
> `/uploads/./documents/…`, and two case variants. **Every one was ≥400, none returned an `image/*` content
> type, and none returned the PNG bytes.**
>
> **On the presigned-URL-vs-streaming choice:** I accept the reasoning and would have made the same call. My
> original remediation offered either; "never mint a fetchable URL for an identity document" is strictly
> stronger than "mint a short-lived one", and it removes the referrer/devtools/proxy-log copies entirely. The
> accepted PRD §9 deviation is correctly scoped and documented — admin-only, ≤10MB, one prefix.
>
> **Two small residuals, neither blocking, both recorded so they are not rediscovered as surprises:**
> 1. `S3StorageProvider.readPrivate` (`:188`) calls `requireConfiguration()`, which **throws** a 500 when the
>    `AWS_S3_*` variables are absent. `KycMediaService.open` (`kyc-media.service.ts:74-83`) calls it whenever
>    the active provider isn't local and the object wasn't on disk — so in a half-configured `s3` environment
>    a *missing* KYC object becomes a 500 instead of a 404. Cosmetic and fail-closed (no bytes, no detail
>    beyond the fixed `CLIENT_FAILURE_MESSAGE`), but it makes the "existence is never confirmed" property
>    depend on configuration. Suggest catching it and treating it as "not in this store".
> 2. The endpoint is **not rate-limited** (the only `ThrottlerGuard` in the codebase is on message-send). It
>    streams up to 10MB per call through the app server. Admin-only, so the blast radius is a compromised or
>    malicious admin session; noted under the pre-existing rate-limiting item below rather than as a new
>    finding for this round.

### [MEDIUM] Legacy media handler applies year-long public immutable caching to KYC documents
- **Category**: CWE-524 Use of Cache Containing Sensitive Information
- **Location**: `JIN_VA-BACKEND/src/uploads/legacy-media.config.ts:87` and `:161-163`; asserted at `JIN_VA-BACKEND/test/legacy-media-serving.e2e-spec.ts:98-104`
- **How found / exploit path**: The new mount sets `immutable: true, maxAge: LEGACY_MEDIA_MAX_AGE_MS` (365 days), so `send` emits `Cache-Control: public, max-age=31536000, immutable` for the whole `/uploads` tree — a tree that contains `documents/` and `selfies/`. The mount it replaced passed no `maxAge`, yielding `public, max-age=0`. So this round newly marks identity-document responses as long-lived, publicly cacheable and non-revalidating. Consequences: any intermediary or shared cache (corporate proxy, ISP cache, or a CDN later placed in front of the app server) retains ID scans and selfies for a year; every browser disk cache on a shared machine persists them across sessions; and `immutable` means a replaced or revoked document keeps being served from cache. Reaching a document still requires knowing its UUID URL, which is what keeps this MEDIUM rather than HIGH.
- **Remediation**: Make the cache policy folder-aware in the `setHeaders` callback that already exists at `:164-169` — keep `public, max-age=31536000, immutable` for `avatars`/`portfolio`/`reviews`/`messages`/`job-attachments`, and emit `Cache-Control: private, no-store` for `documents`/`selfies`. Better still, exclude those two folders from the static mount entirely and gate them behind the authenticated endpoint from the HIGH finding above.
- **Owner**: backend-engineer
- **Status**: **Verified fixed** (2026-08-27, security-engineer)

> **Fix note — backend-engineer, 2026-08-27 (commit `350dc0b`).** Took your "better still" option rather than
> the `setHeaders` one, because it is strictly stronger: a cache header only helps if the response happens at
> all, and now it doesn't. The mount is an allow-list of the five public folders (one static handler each at
> `/uploads/<folder>`), so `documents`/`selfies` are not part of this tree in **any** mode — including
> `STORAGE_PROVIDER=local`, where they were previously served as the active store. There is therefore no
> response left to attach `immutable` to: a request for `/uploads/documents/<file>` is Nest's clean JSON 404
> even with the file present on disk.
>
> The KYC reader added for the HIGH above sends `Cache-Control: private, no-store` (plus `nosniff` and
> `Content-Disposition: inline`), so the folder-aware policy you asked for exists — it just lives on the
> authenticated endpoint instead of on a public mount.
>
> `LEGACY_MEDIA_MAX_AGE_MS` / `immutable` are untouched for the five public folders, whose UUID filenames make
> them genuinely immutable; the existing e2e assertion on `max-age=31536000, immutable` for `/uploads/avatars/…`
> still passes. `resolveLegacyMediaPlan` now returns `servedFolders`/`withheldFolders` and says so in the boot
> log line, and `legacy-media.config.spec.ts` asserts the KYC folders are absent from `servedFolders` in all
> four env combinations — an allow-list rather than a filter, so there's no predicate to invert by accident.

> ### Re-verified — **Verified fixed** (security-engineer, 2026-08-27)
>
> The claim to test was "there is no public response left to attach caching headers to" — asserted, not
> assumed. Probe **P1**, in `STORAGE_PROVIDER=local` mode with real files on disk at
> `uploads/documents/<uuid>.png` and `uploads/selfies/<uuid>.png`, asserted on the response headers directly:
> both paths returned **404**, `content-type: application/json`, and a `Cache-Control` that contains neither
> `immutable` **nor** `public` (the header is absent entirely). No `image/*` content type. So the caching
> concern is genuinely gone by construction, not merely re-headered — the response does not exist.
>
> The replacement policy is real: probe **P5** asserted the admin reader returns exactly
> `Cache-Control: private, no-store` (strict equality, not `toContain`), plus
> `X-Content-Type-Options: nosniff`.
>
> The public folders' caching is confirmed **unregressed** in the same probe run: `/uploads/avatars/<file>` →
> **200** with `immutable`. Probe **U4** confirms the withholding across all nine env combinations rather than
> the four the engineer's spec covers. `LEGACY_MEDIA_SERVED_FOLDERS` is `PUBLIC_UPLOAD_FOLDERS` by direct
> reference (`legacy-media.config.ts:132`) — an allow-list with no invertible predicate, as claimed.

### [MEDIUM] The Resend SDK logs the full provider error payload to `console.error`, defeating the provider's sanitisation
- **Category**: CWE-532 Insertion of Sensitive Information into Log File
- **Location**: `JIN_VA-BACKEND/src/mail/providers/resend-mail.provider.ts:57-71`; SDK sink at `JIN_VA-BACKEND/node_modules/resend/dist/index.cjs:1304-1310` (`resend@6.24.0`); untestable-by-construction spec at `JIN_VA-BACKEND/src/mail/providers/resend-mail.provider.spec.ts:16-22`
- **How found / exploit path**: The provider is careful — it throws `error.name` plus `error.statusCode` only, deliberately dropping Resend's free-text `message`. But I read the installed SDK rather than trusting the description, and `Resend.logError()` is invoked on **every** API error branch of `fetchRequest` and does:
  ```js
  logError(error, path, status) {
    if (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production")
      console.error("[Resend API Error]:", { ...status !== void 0 && { status }, error, path });
  }
  ```
  `error` there is the complete parsed Resend payload — including the exact `message` field the provider excludes. This fires before the provider ever sees the result, so the sanitisation is bypassed in any environment where `NODE_ENV !== 'production'`. It also writes to raw stdout/stderr rather than through the app's winston logger, so it is outside whatever redaction or transport policy the app applies. The specs cannot catch this because they `jest.mock('resend')`, replacing the very object that logs. What actually leaks: Resend's own error text — recipient addresses in `validation_error` payloads, domain-verification detail, the request path. I traced the SDK's request construction and found no path where the API key itself appears in an error string (`Authorization` is set at `index.cjs:1299` and never echoed), so this is provider-detail + recipient-PII disclosure to process logs, **not** key disclosure.
- **Remediation**: The SDK exposes no option to disable `logError`, so pick one: (a) record the limitation honestly in the provider header and correct the DoD line that currently claims no provider error detail can reach a log line — it is accurate for the thrown message, not for the SDK's own logging; (b) if the guarantee must hold, wrap the `emails.send()` call in a scoped `console.error` suppression; (c) ensure deployed non-production environments treat process logs as sensitive. Separately, add a spec that drives the *real* SDK against a stubbed `fetch` so the leak-prevention claim is actually exercised end to end instead of against a mock.
- **Owner**: backend-engineer
- **Status**: **Verified fixed** (2026-08-27, security-engineer — including the restore-under-throw path)

> **Fix note — backend-engineer, 2026-08-27 (commit `b5d696c`).** Took option **(b)**, the actual fix, rather
> than (a)'s documentation-only route — reasoning below, since you asked for it either way.
>
> **Why (b) and not (a).** (a) would have been honest but would have left a real disclosure standing on a path
> the operator is expected to flip on (`MAIL_PROVIDER=resend`), in every environment that isn't
> `NODE_ENV=production` — which in practice means staging, where real recipient addresses do appear. The
> leaking value is recipient PII in `validation_error` payloads, and PII disclosure to a log sink outside the
> app's redaction policy isn't something to write down and keep. It was also cheap to close properly, and the
> interception is verifiable, which (a) is not.
>
> **What it does.** `send()` now runs the SDK call inside `withSdkErrorLoggingSuppressed()`, which for the
> duration of that one call replaces `console.error` with a wrapper that drops calls whose **first argument is
> exactly** `'[Resend API Error]:'` — a strict `===` on the SDK's own sentinel, not a substring or regex match.
> Everything else written to `console.error` by anything, at any time, is forwarded verbatim. A depth counter
> (not a bare save/restore) handles concurrent sends, since mail is dispatched from event listeners, and the
> restore is in a `finally` so a throw can't leave the patch installed. The diagnostic isn't lost, only
> redirected: the provider still throws `error.name` + HTTP status, which `MailService` logs through winston.
>
> **And your separate ask, which is the part I'd re-verify first:** new
> `src/mail/providers/resend-mail.provider.sdk.spec.ts` loads the **real** `resend` package (no
> `jest.mock('resend')`) and stubs `global.fetch`. It asserts, in the exact condition the leak occurs in
> (`NODE_ENV=test`, which it also asserts explicitly so the test can't silently stop proving anything): a
> planted sentinel in the payload's free-text `message` reaches neither `console.error`/`log`/`warn` nor the
> thrown message; `console.error` is not called at all on an SDK error; an *unrelated* `console.error` raised
> during a send **does** get through; and `console.error` is restored afterwards, proven by re-emitting the SDK's
> own sentinel and observing it pass. 7 tests, all green.
>
> **DoD line.** Even so, I'd narrow the wording rather than leave it absolute — it now holds for the SDK's
> `logError` sink specifically, which is the one that existed; it is not a general guarantee about every future
> dependency's internal logging. Recorded here rather than edited into `requirements.md`, since the DoD is the
> product-manager's document.
>
> Also worth noting for your re-test: your judgement that the API key never appears in an SDK error string
> matched what I found — this closes provider-detail and recipient-PII disclosure, not a credential leak.

> ### Re-verified — **Verified fixed** (security-engineer, 2026-08-27)
>
> I wrote my own suite against the **real** SDK rather than reading theirs, because a `finally`-based restore
> claim is exactly the kind of thing that reads fine and fails in practice. 6 cases, all pass.
>
> **The sink is contained, and it is the only sink.** `grep -n "console\.\(error\|warn\|log\|info\|debug\)"`
> over the installed `resend@6.24.0` `dist/index.cjs` returns **exactly one** hit — line 1305, the
> `console.error("[Resend API Error]:", …)` in `logError`. So the strict `===` sentinel match covers the whole
> surface; there is no `console.warn` or second format string to miss. **R1**: a canary planted in the
> payload's free-text `message` reached **none** of `console.error`/`log`/`warn`/`info`, `console.error` was
> called **zero** times, and neither the thrown message nor its stack contained the canary — while the thrown
> message still carried `validation_error`, so the diagnostic survives.
>
> **The scoping is as narrow as claimed. R4** raised two `console.error` calls from inside the stubbed
> `fetch`, i.e. mid-window: an unrelated one, and a deliberate near-miss whose first argument *starts with*
> the sentinel but is not equal to it. **Both were forwarded verbatim** (2 calls captured, 0 dropped). So the
> `===` is not silently behaving like a `startsWith`, and unrelated diagnostics are not being swallowed.
>
> **The restore claim, tested on a real failure path — this is the part worth the effort. R2** checks
> `console.error === theOriginalReference` (identity, not behaviour) after a rejected send: restored. **R3**
> goes further: the SDK swallows every `fetch` failure internally, so no fetch stub can make `emails.send()`
> *throw* — the `finally` branch is unreachable that way. I therefore primed the provider's lazily-built
> client and replaced `client.emails.send` with a function that throws synchronously, so the exception
> propagates out of the wrapped `fn()`. Result: `provider.send()` rejects **and**
> `console.error` is identical to the pre-call reference; re-emitting the SDK's own sentinel afterwards is
> passed through, proving the patch really is gone and not just shadowed.
>
> **Concurrency, with a throw in the middle. R5** starts a slow send (fetch parked on a promise), then runs a
> second send that throws synchronously and unwinds first. While the slow one is still in flight I emit the
> SDK sentinel by hand: it is **still suppressed** (the inner unwind did not unpatch the outer), the slow send
> then completes with `validation_error`, and only then is `console.error` restored to the original reference.
> The depth counter behaves correctly.
>
> **On the DoD wording:** I agree with the engineer's own narrowing, and it is the accurate statement. The
> guarantee now holds for this SDK's `logError` sink. It is *not* a general property of the process, because
> the mechanism is a scoped global monkey-patch: if another library patched `console.error` during a send
> window, the restore would overwrite that patch. Nothing in this codebase does (winston/Nest do not touch
> `console.error`), so this is a note for future maintainers, not a finding.

### [MEDIUM] SMTP auth failures put the `MAIL_USER` value into application logs — and SMTP is the default provider
- **Category**: CWE-532 Insertion of Sensitive Information into Log File
- **Location**: `JIN_VA-BACKEND/src/mail/providers/smtp-mail.provider.ts:29-37`; log sink at `JIN_VA-BACKEND/src/mail/mail.service.ts:45-50`
- **How found / exploit path**: `SmtpMailProvider.send()` awaits `nodemailer.sendMail()` with no catch and no sanitisation, and `MailService`'s catch logs `getErrorMessage(err)` — the raw `.message` — then re-throws. nodemailer surfaces an SMTP auth rejection as `Invalid login: <verbatim server response>`, and many SMTP servers echo the submitted username in their 535 response. The `MAIL_USER` value can therefore land in the application log. This is exactly the risk class the engineer identified and defended against for the *new* provider — `resend-mail.provider.ts:36-40` says so in as many words ("an SMTP `535` response echoes the username, for instance") — but the mitigation was applied only to Resend, leaving the **default, currently-active** transport unprotected. The behaviour is pre-existing (the pre-round `MailService` logged the same raw message), so BI4 did not introduce it; BI4 preserved it while asserting in the DoD that "No credential value appears in any log", which is not accurate for the default path.
- **Remediation**: Give `SmtpMailProvider.send()` the same discipline as `ResendMailProvider`: catch, log and re-throw using nodemailer's `err.code` / `err.responseCode` only, and never `err.message` or `err.response`. Then either correct or re-qualify the DoD line.
- **Owner**: backend-engineer
- **Status**: **Verified fixed** (2026-08-27, security-engineer — tested through the real log line, not the provider in isolation)

> **Fix note — backend-engineer, 2026-08-27 (commit `b5d696c`).** Done as specified. `SmtpMailProvider.send()`
> now wraps `sendMail()` in a try/catch and re-throws through a new `describeSmtpFailure()` helper that reads
> **only** `err.code` (nodemailer's own classification — `EAUTH`, `ECONNECTION`, `ETIMEDOUT`, `EENVELOPE`, …)
> and `err.responseCode` (the SMTP status number), producing e.g. `EAUTH / SMTP 535`. `err.message` and
> `err.response` are never read. When nodemailer classified nothing at all, it falls back to the error *name* —
> a class name, not text built from the server's reply.
>
> There is no separate log call in the provider, on purpose: `MailService`'s existing catch logs the thrown
> message, so adding one would double-log the same line. The sanitisation is on the thrown string, which is
> what makes that existing log line clean — the mirror of how `ResendMailProvider` already worked. So
> `MailService` is untouched, and "log and re-throw" is unchanged.
>
> Five new assertions in `smtp-mail.provider.spec.ts`, built on a fixture shaped like what nodemailer actually
> produces for a 535 (`Invalid login: 535 5.7.8 … for user <sentinel>`, plus `code`, `responseCode`, `response`,
> `command`): the thrown message contains `EAUTH / SMTP 535`, and contains none of the sentinel, `Invalid login`,
> `5.7.8`, the configured `MAIL_USER`, or the configured `MAIL_PASS`. Plus: it still throws (a sanitised failure
> is not a swallowed one), the no-classification fallback, and that a connection failure stays distinguishable
> from an auth failure.
>
> On the DoD claim: I'd re-qualify rather than delete it. It is now accurate for both mail paths and for the S3
> path, which is what it was written about; what it can't be is a blanket guarantee about a dependency's internal
> logging (see the Resend note above). Left for the product-manager to word.

> ### Re-verified — **Verified fixed** (security-engineer, 2026-08-27)
>
> The engineer's spec asserts on the *thrown* message. The finding was about the **log line**, so I tested
> that end of it instead: probe **S1** constructs the real `MailService` with the real `SmtpMailProvider`,
> injects a transporter that rejects with a nodemailer-shaped 535 (`Invalid login: 535 5.7.8 … for user
> <canary>`, plus `code: 'EAUTH'`, `responseCode: 535`, `response`, `command: 'AUTH PLAIN'`), configures
> `MAIL_USER`/`MAIL_PASS` to canary values, and **captures what `Logger.prototype.error` is actually called
> with** — plus all four console sinks, the thrown message and the thrown stack.
>
> Result: the log line reads `❌ Failed to send mail to … : … EAUTH / SMTP 535 …`, and the union of
> log + console + message + stack contains **none** of the canary, `Invalid login`, `5.7.8`, or `AUTH PLAIN`.
> It still **throws** — a sanitised failure is not a swallowed one. **S2** confirms an unclassified transport
> failure (`connect ECONNREFUSED <canary>:587` with no `code`) degrades to the error *name* only: neither the
> canary nor `ECONNREFUSED` appears.
>
> **"No code path still lets a raw nodemailer error reach a log line."** Confirmed by tracing every route out
> of nodemailer, not just the happy failure:
> - `grep` for `sendMail|createTransport|nodemailer` shows the **only** `sendMail()` call in `src/` is
>   `smtp-mail.provider.ts:45`, and it is inside the `try`. `getTransporter()` → `createTransporter()` is
>   *also* inside that `try`, so a transport-construction failure is sanitised too.
> - `MailService` (`mail.service.ts:45-50`) logs `getErrorMessage(err)` of the **sanitised** `Error` and
>   re-throws it. The original nodemailer error is never referenced again and is not attached as `cause`, so
>   no filter or logger downstream can walk to it.
> - `src/mail/mail.config.ts:11-19` does **not** set nodemailer's `logger` or `debug` options. That matters:
>   `logger: true` would print the raw SMTP conversation — including the base64 `AUTH PLAIN` line — straight
>   to stdout, entirely bypassing this fix. It is off, and I checked rather than assumed.
> - Mail is dispatched from 15 event-listener call sites (`domain-mail.listener.ts`, `user-mail.listener.ts`),
>   all through `MailService.sendMail`, so there is no second path to the transport.
>
> I agree with the engineer's re-qualification of the DoD line; it is now accurate for both mail transports
> and the S3 path.

### [MEDIUM] Known-vulnerable dependencies in both repos
- **Category**: CWE-1035 / OWASP A06 Vulnerable and Outdated Components
- **Location**: `JIN_VA-BACKEND/package.json`, `JIN_VA-FRONTEND/jinva-frontend-web/package.json`
- **How found**: `npm audit` in both repos.
  - **Backend, production deps** (`--omit=dev`): 30 vulnerabilities — 1 critical, 14 high. `handlebars@4.7.8` **CRITICAL** (GHSA-2w6w-674q-4c4q, CVSS 9.8, JS injection via AST type confusion). **Reachability assessed as low**: `src/mail/mail.template.ts:11-33` compiles only static `.hbs` files read from the repo, there are no dynamic partials, and there is no triple-stache anywhere under `src/mail/`, so template source is never attacker-controlled and only the data context is user-supplied. `nodemailer@<=9.0.0` **HIGH** (several CRLF / SMTP-command-injection advisories) sits directly in BI4's path. Also high: `validator`, `axios`, `form-data`, `jws`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`, `lodash`, `path-to-regexp`, `glob`, `minimatch`, `brace-expansion`.
  - **Frontend**: 14 vulnerabilities — 2 critical (`tar`), high (`sharp`), moderate (`postcss`, `yaml`). All are build/dev-time transitives under `next`.
  - **`resend@6.24.0` specifically** (new this round, checked to the leaves as asked): adds `postal-mime@2.7.5`, `standardwebhooks@1.0.0`, `@stablelib/base64`, `fast-sha256`. **None appears in any advisory.** The new package introduces no known-vulnerable subdependency.
- **Remediation**: Run `npm audit fix` in both repos — it clears `nodemailer`, `validator`, `form-data`, `tar` and `yaml` without breaking changes. Upgrade `handlebars` to ≥4.7.9 on its own merits even though the critical path is not reachable. Defer `firebase-admin` and `sharp` (both require breaking major bumps) to a tracked ticket rather than this round.
- **Owner**: backend-engineer / frontend-engineer
- **Status**: **Backend — Verified fixed as far as it goes (residual highs assessed unreachable, see below).
  Frontend — Still present, and materially worse than my original text recorded. Split into its own HIGH
  finding below.**

> **Fix note — backend-engineer, 2026-08-27 (commit `ac050a9`), backend repo only.** `npm audit fix` (no
> `--force`) run to a fixed point, plus `handlebars` raised from `^4.7.8` to `^4.7.9` in `package.json` so the
> vulnerable version can no longer be resolved on a fresh install. Before/after, both counts you asked for:
>
> | | before | after |
> |---|---|---|
> | all deps | **70** — 2 critical, 24 high, 38 moderate, 6 low | **9** — 4 high, 5 moderate |
> | `--omit=dev` | **30** — 1 critical, 14 high, 14 moderate, 1 low | **7** — 2 high, 5 moderate |
>
> Cleared: `handlebars` (the critical), `validator`, `form-data`, `jws`, `lodash`, `path-to-regexp`, `glob`,
> `minimatch`, `brace-expansion`, `adm-zip`, `webpack`, `@nestjs/core`, `@nestjs/platform-express`,
> `@nestjs/swagger`. Both criticals are gone.
>
> **One correction to the finding, please re-check this rather than take my word:** `npm audit fix` does **not**
> clear `nodemailer`. It bumped 7.0.7 → 7.0.13, but the advisory range is `<=9.0.0`, so it stays flagged as
> high; clearing it needs `--force` and a breaking major bump on the live mail path, which I did not take
> unilaterally in a fix round. The remaining high is
> "SMTP command injection via unsanitized `envelope.size`" — `envelope` is never set anywhere in this codebase
> (`MailService` passes only `from`/`to`/`subject`/`html`/`text`), so I read the injection vector as
> unreachable, but that's your call to confirm.
>
> Also still open, both needing breaking majors and left for a tracked ticket as you suggested for
> `firebase-admin`: `axios` (high, via `@nestjs/axios`), and `uuid`/`teeny-request`/`retry-request`/
> `@google-cloud/storage` (moderate, all under `firebase-admin`).
>
> Full unit suite green after the upgrade: **363/363, 40 suites** (was 319/319 in 37; the delta is this round's
> three new spec files). The frontend half of this finding is the frontend-engineer's.

> ### Re-verified (security-engineer, 2026-08-27) — backend **fixed**, frontend **Still present**
>
> **Backend counts reproduce exactly.** I re-ran both audits myself:
>
> | | my original | engineer's claim | **my re-run** |
> |---|---|---|---|
> | all deps | 70 — 2 crit, 24 high | 9 — 4 high, 5 moderate | **9 — 0 crit, 4 high, 5 moderate** ✔ |
> | `--omit=dev` | 30 — 1 crit, 14 high | 7 — 2 high, 5 moderate | **7 — 0 crit, 2 high, 5 moderate** ✔ |
>
> Both criticals are gone; `handlebars` no longer appears at all. Remaining, all-deps: `nodemailer`,
> `axios`, `adm-zip` and `sonarqube-scanner` (the last two dev-only) high; `firebase-admin`,
> `@google-cloud/storage`, `retry-request`, `teeny-request`, `uuid` moderate.
>
> **The `nodemailer` reasoning holds — and it holds more broadly than the engineer claimed.** They named one
> advisory. The audit actually lists **six** against `nodemailer@7.0.13`, so I checked each against how this
> codebase calls it (`mail.config.ts:11-19` and `smtp-mail.provider.ts:45-51`, which pass only
> `host`/`port`/`secure`/`auth` and `from`/`to`/`subject`/`html`/`text`):
>
> | Advisory | Vector | Reachable here? |
> |---|---|---|
> | SMTP command injection via `envelope.size` | `envelope` option | **No** — never set |
> | CRLF injection via transport `name` (EHLO/HELO) | `name` option | **No** — never set |
> | CRLF injection in `List-*` header comments | `list` option | **No** — never set |
> | `jsonTransport` bypasses `disableFileAccess`/`disableUrlAccess` | `jsonTransport` | **No** — SMTP transport only |
> | Improper TLS cert validation in OAuth2 token fetch | OAuth2 auth | **No** — plain `user`/`pass` |
> | Message-level `raw` bypasses file/URL access controls (file read + SSRF) | `raw` option | **No** — never set |
>
> So: **confirmed unreachable, and confirmed for all six vectors rather than the one.** Not taking the
> breaking major on the live mail path in a fix round was the right call. It should still be ticketed — the
> reachability argument is a property of today's call sites, and the next person to add an attachment or an
> `envelope` makes it wrong.
>
> `axios` (high, all DoS/prototype-pollution classes via `@nestjs/axios`) and the `firebase-admin` moderates
> remain, both needing breaking majors — agreed as a tracked ticket, not this round.
>
> **Frontend: not actioned, and my original one-line summary of it was wrong.** `ac050a9` was backend-only.
> Re-running the audit in `jinva-frontend-web` gives **14 total — 2 critical, 10 high, 2 moderate**; prod-only
> (`--omit=dev`) is **7 — 1 critical, 5 high, 1 moderate**. My original text said "all are build/dev-time
> transitives under `next`", which does not survive contact with the actual output: the critical is
> **`next` itself**, a direct production dependency. Correcting my own record and splitting it out as its own
> finding immediately below, because it changes the release verdict.

### [HIGH — NEW, found during re-verification] The frontend runs `next@15.5.4`, which carries a critical advisory and known middleware-bypass advisories, with a non-breaking patch available
- **Category**: CWE-1395 / CWE-937 · OWASP A06 Vulnerable and Outdated Components
- **Location**: `JIN_VA-FRONTEND/jinva-frontend-web/package.json` (`"next": "15.5.4"`, installed 15.5.4); the middleware this bears on is `JIN_VA-FRONTEND/jinva-frontend-web/src/middleware.ts:58-107`
- **How found**: `npm audit` in `jinva-frontend-web`. `next` is reported **critical** in its own right (not as a transitive), range `9.3.4-canary.0 – 16.3.0-preview.10`, with `fixAvailable: { name: "next", version: "15.5.24", isSemVerMajor: false }`. The critical is GHSA-9qr9-h5gf-34mp, *RCE in the React flight protocol* — the App Router's RSC transport, which this app uses on every route. Alongside it, several HIGH advisories are directly relevant to how JinVa is built rather than theoretically:
  - GHSA-267c-6grr-h53f and its incomplete-fix follow-up GHSA-26hh-7cqf-hhc6 — **middleware/proxy bypass in App Router apps via segment-prefetch routes**
  - GHSA-492v-c6pp-mqqv — **middleware/proxy bypass via dynamic route parameter injection**
  - GHSA-c4j6-fc7j-m34r — SSRF via WebSocket upgrades; GHSA-p9j2-gv94-2wf4 — SSRF via rewrites
  - plus a cluster of RSC/Server-Component DoS advisories
  `src/middleware.ts` is exactly the component those bypass advisories target: it is what gates `/dashboard/:path*` on the signed `jinva_session` cookie and what role-partitions `/dashboard/admin` vs `/artisan` vs `/user` (`:78-93`).
- **Assessment / why HIGH and not critical**: the middleware bypass is **not** a data-exposure auth bypass on its own, and I want that stated precisely so this is not over-read. Real authorization is independent and server-side: every dashboard fetch goes through `src/lib/api.ts`'s `authedRequest()` with a bearer JWT, and the backend enforces `JwtAuthGuard` + `RolesGuard` per route (verified again this round — my probes P3/P4 got 403/401 from the API for non-admin and forged tokens). So a bypassed middleware yields an empty page shell, not another user's data. What it does defeat is the edge-level gate the S2 work exists to provide, and it undermines the "matcher integrity" DoD line. The **critical** RCE advisory is the part I cannot bound from here without exercising it, which I will not do. Between an unbounded critical against a production framework and a non-breaking patch sitting one command away, this is a HIGH open item.
- **Remediation**: `npm install next@15.5.24` in `jinva-frontend-web` (non-semver-major per npm's own fix metadata), then `npm run verify` and a smoke pass over the five public pages and one dashboard route per role. Then re-run `npm audit`: the same bump also clears the `postcss` and `sharp` entries, which are pinned by `next`. Separately, `npm audit fix` clears `tar` (critical), `lodash`, `lodash-es`, `nanoid`, `flatted`, `js-yaml`, `minimatch`, `brace-expansion`, `picomatch`, `ajv` and `yaml` without breaking changes. Add a CI `npm audit --audit-level=high` gate in both repos so a critical in a production dependency fails the build rather than waiting for a review round to notice.
- **Owner**: frontend-engineer
- **Status**: **Verified fixed** (2026-08-27, security-engineer — audit counts reproduced, all three bypass classes re-probed against my own production build; residual `postcss` re-classified LOW-in-context, see below)

> **Fix note — frontend-engineer, 2026-08-27 (commit `67298ee`), frontend repo only.** `next` moved
> `15.5.4` → `15.5.24`. It was pinned **exact**, not a range, so I matched that with `--save-exact` rather than
> loosening it to `^15.5.24` — the pin style is unchanged, only the number moved. Then `npm audit fix` (no
> `--force`) to a fixed point. Both counts you asked for:
>
> | | before | after |
> |---|---|---|
> | all deps | **14** — 2 critical, 10 high, 2 moderate | **2** — 0 critical, 1 high, 1 moderate |
> | `--omit=dev` | **7** — 1 critical, 5 high, 1 moderate | **2** — 0 critical, 1 high, 1 moderate |
>
> Your before-numbers reproduced exactly on my machine before I touched anything, so we were measuring the
> same tree. **0 critical in both views**, which was the gate. GHSA-9qr9-h5gf-34mp (the flight-protocol RCE) is
> gone, as are all four middleware/proxy-bypass and SSRF advisories you named — after the bump there are **no
> advisories against `next`'s own code at all**. `npm audit fix` cleared `tar` (the second critical),
> `lodash`, `lodash-es`, `nanoid`, `flatted`, `js-yaml`, `minimatch`, `brace-expansion`, `picomatch`, `ajv`,
> `yaml` and `sharp`, all in the lockfile — `package.json` carries a **one-line** diff (the `next` pin) and
> nothing else.
>
> **Two corrections to the finding's remediation text — please re-check these rather than take my word.**
>
> 1. The bump clears `sharp` but **not** `postcss`. Both residual entries are one root cause:
>    `node_modules/next/node_modules/postcss` @ **8.4.31**, the copy `next` pins internally. The advisory range
>    is `<=8.5.22` (GHSA-r28c-9q8g-f849 high + GHSA-6g55-p6wh-862q high, plus two moderates), and npm's fix
>    metadata for it is now `next@16.3.3`, `isSemVerMajor: **true**`. So the remaining high is not reachable by
>    any non-breaking action, and I did not take a framework major in a patch round.
> 2. The `next` entry itself is now flagged **moderate**, and only as `via: [postcss]` — i.e. it is the same
>    residual reported a second time through its parent, not a distinct advisory against `next`.
>
>    Our own top-level `postcss` devDependency is fine at **8.5.26** (above the range) — the vulnerable copy is
>    exclusively next's nested one. My read, for you to confirm or reject: this is build-time CSS processing over
>    first-party stylesheets, and all four advisories need attacker-controlled CSS (a crafted `sourceMappingURL`
>    in a comment), so there is no request-path exposure at runtime. I'd suggest it becomes the tracked
>    `next@16` ticket alongside `firebase-admin`/`axios` rather than gating this round, but that is your call,
>    not mine.
>
> **Verification.** `npm run verify` (colour tokens → lint → build) exits **0**: 243 files scanned/0 hardcoded
> palette classes, ESLint **0 errors** with the same 5 pre-existing warnings as before the bump (unused vars in
> `artisan/calendar`, `artisan/report`, `signup-form`, `support-page`; one `react-hooks/exhaustive-deps` in
> `reset-password-form`) — none introduced by this change, and the production build compiled every route with
> `ƒ Middleware 39.8 kB` still emitted.
>
> Smoke pass done against the **production** build (`next start`, which logged `▲ Next.js 15.5.24`) in real
> Chrome via Playwright, not just curl, since you flagged middleware specifically:
>
> | Check | Result |
> |---|---|
> | `/` renders, `h1` visible, hydrates | **PASS** — 200, no page errors |
> | `/login` email + password inputs hydrate and accept typing | **PASS** |
> | `/login` submit with empty email stays on `/login` (client validation) | **PASS** |
> | `/dashboard/{user,admin,artisan}` with no cookie → `/login?redirect=…` | **PASS** — 307, redirect param preserved |
> | Same three under `RSC: 1` and `RSC: 1` + `Next-Router-Prefetch: 1` | **PASS** — still 307, no shell served |
> | Segment-prefetch path form (`/dashboard/admin.txt` + `Next-Router-Segment-Prefetch`) | **PASS** — still 307 |
> | Spoofed `x-middleware-subrequest` header (the bypass-vector class) | **PASS** — still 307, not honoured |
>
> The last four are the ones the bypass advisories are about, so I probed them deliberately rather than
> assuming a version number settles it. Only console noise is the pre-existing `_vercel/insights/script.js`
> 404 you already recorded at `:639` — nothing new.
>
> **One thing I left alone, flagging it rather than silently fixing it:** `eslint-config-next` is still pinned
> `15.5.4`, so it now trails `next` by a patch. It carries no advisory, it is a dev-only lint config, and lint
> passes clean, so I did not touch it inside a contained security fix. Worth syncing on the next dependency
> pass. I also did not add the CI `npm audit --audit-level=high` gate you recommended — there is no CI workflow
> in this repo for me to add it to, and standing up one is out of scope for this fix; it needs its own ticket.

> ### Re-verified — **Verified fixed** (security-engineer, 2026-08-27)
>
> I did not accept the fix note. I re-ran the audit, rebuilt the app myself, and re-fired the bypass classes.
>
> **(a) Both audit counts reproduce exactly.** `npm audit` in `jinva-frontend-web`:
>
> | | my round-2 measurement | engineer's claim | **my re-run** |
> |---|---|---|---|
> | all deps | 14 — 2 crit, 10 high, 2 moderate | 2 — 0 crit, 1 high, 1 moderate | **2 — 0 crit, 1 high, 1 moderate** ✔ |
> | `--omit=dev` | 7 — 1 crit, 5 high, 1 moderate | 2 — 0 crit, 1 high, 1 moderate | **2 — 0 crit, 1 high, 1 moderate** ✔ |
>
> **Zero critical in both views.** GHSA-9qr9-h5gf-34mp (the flight-protocol RCE) is gone, and so are all four
> middleware/proxy-bypass and SSRF advisories I named. I checked this structurally rather than by reading the
> summary: parsing `npm audit --json`, the entire advisory set is now **two entries with one root cause**. The
> `next` entry is `severity: moderate`, `via: ["postcss"]` — a bare parent reference with **no advisory object
> of its own** — so the engineer's correction #2 is right: there is no remaining advisory against `next`'s own
> code. `npm ls` confirms the vulnerable copy is `node_modules/next/node_modules/postcss@8.4.31` **only**;
> our top-level `postcss` is `8.5.26` and `@tailwindcss/postcss`/`autoprefixer` both dedupe to it.
>
> **The pin is intact.** `package.json:57` reads `"next": "15.5.24"` — exact, no caret — and
> `git diff 67298ee~1 45c265d -- jinva-frontend-web/package.json` is a **one-line** diff. No other dependency
> moved in `package.json`; everything else `npm audit fix` did is lockfile-only, as claimed.
>
> **(b) The three bypass classes, re-probed on my own build — this is the part I would not take on trust.**
> `npm run build` (clean, `ƒ Middleware 39.8 kB` emitted) then `next start`, which logged
> **`▲ Next.js 15.5.24`**, confirming the running binary and not just the manifest. **16** gate probes with no cookie, plus 2 controls:
>
> | Probe | Result |
> |---|---|
> | `GET /dashboard/{admin,artisan,user}` | **307** → `/login?redirect=…`, redirect param preserved, 3/3 |
> | `RSC: 1` / `RSC: 1` + `Next-Router-Prefetch: 1` / `RSC: 1` + `Next-Router-State-Tree` | **307** × 3 |
> | Segment-prefetch path form: `/dashboard/admin.txt` (+ `Next-Router-Segment-Prefetch`), bare `.txt`, `/dashboard/admin/__PAGE__.txt` | **307** × 3 |
> | Spoofed `x-middleware-subrequest`: `middleware`, `src/middleware`, `pages/_middleware`, **and the chained `middleware:middleware:middleware:middleware:middleware`** form | **307** × 4 — none honoured |
> | `x-nextjs-data: 1` | **307** |
> | `//dashboard/admin`, `/dashboard//admin` | **308** normalise, then **307**; following the chain lands on `/login?redirect=%2Fdashboard%2Fadmin` |
> | Control: `GET /`, `GET /login` | **200** — so the 307s are the gate working, not a broken server |
>
> Every dashboard shape redirected; **no page shell was served in any case** (36–51 bytes of redirect body).
> I added the chained `x-middleware-subrequest` variant and the two path-normalisation shapes, which the
> engineer's pass did not cover.
>
> **The gate logic itself is untouched by the bump**, so the round-1 baseline still applies: SHA-256 of
> `src/middleware.ts` is still `29e6c8b5f48b88762ee5b6a5b45c8d54e45e443430f68a5cadaa9acda9f4a567` and
> `src/lib/session-cookie.ts` still `557488616f4c347734d17e19b5e3e8ede239970b0b22dddea9299a4771be7c06` —
> byte-for-byte identical to pre-round `1d6aaa3`.
>
> **(c) The residual `postcss` — my independent call, and I would label it differently to both of us.**
> Non-blocking, agreed, but neither "an open high" nor merely "a moderate":
>
> - **No request-path exposure. Confirmed, not assumed.** All four advisories (GHSA-6g55-p6wh-862q high,
>   GHSA-r28c-9q8g-f849 high, GHSA-fxqj-rqcc-2cmp + one more moderate) are CWE-22/CWE-200: an arbitrary
>   `.map` file read driven by an attacker-controlled `sourceMappingURL` **in the CSS source postcss parses**.
>   `postcss` is a build-time tool; `next start` serves pre-compiled CSS. A repo-wide grep for
>   `postcss|styleSheet|insertRule|CSSStyleSheet` across `src/**/*.ts{,x}` returns **zero** hits, so the app
>   has no runtime CSS processing and no user-supplied-CSS path at all — no themes, no CSS uploads, no
>   stylesheet content from the database. The only CSS reaching next's pipeline is first-party, on a trusted
>   build machine, and the worst outcome is disclosure of a `.map` file to that same machine's build output.
>   **Contextual severity is LOW, not high** — the CVSS 7.5 assumes a context where the CSS input is
>   attacker-controlled, which is not this app's.
> - **The engineer's correction #1 is confirmed, with the reasoning pinned down.** `next@15.5.24` declares
>   `postcss: 8.4.31` as an exact dependency (`npm view next@15.5.24 dependencies.postcss`), and
>   `npm view next@'>=15.5.24 <16' version` returns **only `15.5.24`** — it is the newest 15.x in existence, so
>   there is no later patch to take. npm's own `fixAvailable` is `next@16.3.3`, `isSemVerMajor: true`. Not
>   taking a framework major inside a security patch round was the right call.
> - **But there *is* a non-breaking path the fix note ruled out, and I want it on the ticket.** An npm
>   `overrides` entry — `"overrides": { "next": { "postcss": "^8.5.26" } }` — would force next's nested copy to
>   the already-installed patched version (the advisory ranges top out at `<=8.5.22`, so `8.5.26` clears all
>   four) and would likely dedupe to a single copy. That is a lockfile-level change with no major bump. I have
>   **not** validated it, and deliberately did not touch `package.json` — it needs frontend-engineer to apply
>   it and confirm `npm run build` still produces byte-equivalent CSS, since next pins that version exactly and
>   may rely on it. Cheaper first option for the ticket than waiting on `next@16`.
>
> **So: this finding is closed.** The residual is recorded below as a LOW-in-context tracked item, not an open
> high, and it does **not** gate the release.
>
> **Two open recommendations from my original remediation were not actioned, both correctly flagged rather
> than silently skipped, neither blocking:** the CI `npm audit --audit-level=high` gate (no CI workflow exists
> in the repo to add it to — it needs its own ticket, and I agree standing one up is out of scope for a
> contained fix), and `eslint-config-next` still pinned `15.5.4` (dev-only lint config, carries no advisory,
> lint passes clean).

### [LOW] The documented rationale for `dotfiles: 'ignore'` does not hold, and the option is a no-op
- **Category**: CWE-1078 (inconsistent/incorrect rationale) — no exploitable condition
- **Location**: `JIN_VA-BACKEND/src/uploads/legacy-media.config.ts:153-161`
- **How found**: Verified against the installed libraries rather than the comment. The comment says `'deny'` "reports a 403 by calling `next(err)`", reaching Express's `finalhandler` and an HTML stack trace outside production. With the mount as written, `fallthrough` is not set, so it defaults to `true` (`serve-static@2.2.0/index.js:50`) and `forwardError` starts `false` (`:85`). `send@1.2.0`'s dotfile check runs in `pipe()` at `index.js:458-468`, i.e. **before** the `file` event that would flip `forwardError` (`serve-static/index.js:106-109`). A 403 therefore has `statusCode < 500` with `forwardError === false`, so serve-static takes the plain `next()` branch, not `next(err)` (`:115-118`) — a `'deny'` 403 would fall through to Nest's clean JSON 404 exactly as `'ignore'` does. Separately, `'ignore'` is already `send`'s default (`send/index.js:114-116`), so the explicit option changes no behaviour.
  **Does it trade one leak for another? No.** A 404 reveals strictly less than a 403 (which would confirm existence), so the chosen value is the conservative one and the outcome is safe. This is documentation risk only — but it matters, because the stack-trace path the comment describes *is* real for 5xx-class `send` errors (`!(err.statusCode < 500)` → `next(err)` → `finalhandler` → HTML stack when `NODE_ENV !== 'production'`), and it becomes reachable for 403/404 too the moment someone adds `fallthrough: false` on the strength of this comment.
- **Remediation**: Correct the comment to describe the actual mechanism. If the `finalhandler` concern is to be closed properly, register an Express error handler in front of the static mount so no `send` error can reach `finalhandler`. Also add a dotfile request to `test/legacy-media-serving.e2e-spec.ts` — it currently covers traversal, directory listing and clean-404, but never asserts the dotfile behaviour the comment is entirely about.
- **Owner**: backend-engineer
- **Status**: **Verified fixed** (2026-08-27, security-engineer — one stale version pin noted, non-blocking)

> **Fix note — backend-engineer, 2026-08-27 (commit `350dc0b`).** Comment rewritten to your behavioural
> analysis, which I re-checked against the installed libraries rather than transcribing. It now records that
> (i) `'ignore'` is already `send`'s default so the option changes no behaviour, and (ii) `'deny'` would resolve
> to the *same* clean JSON 404 — `fallthrough` unset → defaults `true`, `forwardError` starts `false` and is
> only flipped by the `file` event, and `send`'s dotfile check runs in `pipe()` before that event, so a 403 has
> `statusCode < 500` with `forwardError === false` and serve-static takes the plain `next()` branch.
>
> It also keeps the two reasons `'ignore'` is still the right value, which are the ones that actually hold: a
> 404 discloses strictly less than a 403, and it stays correct if someone later adds `fallthrough: false` —
> under which a `'deny'` 403 *would* be forwarded. And it records that the HTML-stack-trace path is real but
> reachable only for 5xx-class `send` errors.
>
> **I did not add the Express error handler.** With the mount now split per folder there are five handlers to
> front, the 5xx-`send`-error case has no known trigger here (the tree is UUID-named files on the app's own
> disk), and inserting middleware ahead of Nest's router is a change with more blast radius than the residual
> risk. Flagging it as a deliberate non-fix rather than an oversight — say if you'd rather it were closed.
>
> Dotfile e2e case added (`answers a dotfile request with a clean JSON 404, not a 403 and not an HTML stack
> trace`): four paths — a dotfile that genuinely **exists on disk** and is written for the test, plus
> `.env` inside a folder, `/uploads/.env` and `/uploads/.git/config`. Each asserted `404`, JSON content-type,
> no `<pre>`, no `at SendStream`, no `process.cwd()` in the body, and not the file's bytes. The existing
> traversal / directory-listing / clean-404 cases still pass unchanged after the per-folder remount.

> ### Re-verified — **Verified fixed** (security-engineer, 2026-08-27)
>
> Spot-checked the corrected comment (`legacy-media.config.ts:216-237`) against the **installed** library
> source, clause by clause. Every mechanical claim is accurate:
>
> | Claim in the comment | Installed source | ✔ |
> |---|---|---|
> | `'ignore'` is already `send`'s default | `send/index.js` — `this._dotfiles = opts.dotfiles !== undefined ? opts.dotfiles : 'ignore'` | ✔ |
> | `fallthrough` unset → defaults `true` | `serve-static/index.js` — `var fallthrough = opts.fallthrough !== false` | ✔ |
> | `forwardError` starts `false` | `serve-static/index.js` — `var forwardError = !fallthrough` | ✔ |
> | flipped only by the `file` event | `stream.on('file', function onFile () { forwardError = true })`, inside `if (fallthrough)` | ✔ |
> | dotfile check runs in `pipe()`, before that event | `if (containsDotFile(parts)) { switch (this._dotfiles) { case 'deny': this.error(403) … } }` in `pipe()` | ✔ |
> | so a 403 takes the plain `next()` branch | `if (forwardError \|\| !(err.statusCode < 500)) { next(err); return } next()` | ✔ |
> | HTML-stack path is real but only for 5xx-class `send` errors | same predicate — `!(err.statusCode < 500)` | ✔ |
>
> **One nit, non-blocking:** the comment cites `send@1.2.0 index.js:114-116` and
> `serve-static@2.2.0 index.js:50`, but the versions actually installed after `ac050a9`'s dependency work are
> **`send@1.2.1` and `serve-static@2.2.1`**. The line numbers still land on the right code and the behaviour
> is identical, so this is a stale pin rather than a wrong analysis — worth dropping the patch digit (or the
> line numbers) next time the file is touched, since a version-pinned comment goes stale on every
> `npm audit fix`.
>
> The dotfile e2e case is present at `test/legacy-media-serving.e2e-spec.ts:161-187`, covers all four paths
> including one that genuinely exists on disk, and **passes in my own control run** (14/14 in that suite). I
> also accept the deliberate non-fix on the Express error handler: with five per-folder handlers to front and
> no known 5xx trigger in a tree of UUID-named local files, the residual is smaller than the blast radius of
> inserting middleware ahead of Nest's router. Recorded as an accepted risk, not an oversight.

### [LOW — accepted] Missing-configuration errors return `AWS_S3_*` variable names to the client outside production
- **Category**: CWE-209 Generation of Error Message Containing Sensitive Information
- **Location**: `JIN_VA-BACKEND/src/uploads/providers/s3-storage.provider.ts:156-165`; filter behaviour at `JIN_VA-BACKEND/src/common/filters/all-exceptions.filter.ts:99-101`
- **How found / assessment**: `requireConfiguration()` throws an `InternalServerErrorException` whose message names the absent variables, and the filter returns a 5xx exception's own message verbatim whenever `NODE_ENV !== 'production'`. Names only, never values — and BI1's acceptance criterion explicitly asks for this message to surface, so I am recording it as **accepted**, not a defect. Operators should note that in production the filter substitutes the generic string, so the diagnostic must be read from the log.
- **Verified good, same file (BI1 priority 3 — checked through the filter, not the provider in isolation)**: the AWS-failure path is correctly sanitised end to end. `failLoudly` (`:177-189`) constructs a **new** exception with the fixed `CLIENT_FAILURE_MESSAGE` and never chains the SDK error as `cause`, so the filter's non-production message passthrough **and** its unconditional `stack:` log line (`all-exceptions.filter.ts:79-86`) both see only the sanitised exception. `describeAwsFailure` (`:257-262`) emits error name plus HTTP status only. No bucket value, region value, access-key identifier, SDK message or SDK stack reaches either the client or the log. The object key (`folder/uuid.ext`) is logged, which is operationally necessary and carries no credential.
- **Owner**: backend-engineer
- **Status**: Open (accepted — no change requested)

> **Re-verified (security-engineer, 2026-08-27):** unchanged and still correctly sanitised after `350dc0b`.
> `failLoudly` now also covers the new `readPrivate` path (`s3-storage.provider.ts:203`) and still builds a
> fresh exception carrying only `CLIENT_FAILURE_MESSAGE`, with no `cause` chain. `describeAwsFailure` still
> emits name + HTTP status only — visible in my control run's log output as
> `S3 read failed for private/documents/abc.pdf: AccessDenied (HTTP 403)`: the object key, the AWS error
> name, the status, and nothing else. Still **accepted**. See the residual note under the KYC HIGH about
> `requireConfiguration()` turning a missing object into a 500 in a half-configured s3 environment.

### [LOW — informational] `resend` adds unused transitive attack surface
- **Category**: CWE-1104 Use of Unmaintained/Unnecessary Third-Party Components
- **Location**: `JIN_VA-BACKEND/package.json`; lock additions `postal-mime@2.7.5`, `standardwebhooks@1.0.0`, `@stablelib/base64`, `fast-sha256`
- **How found**: The round uses only `emails.send()`. Neither `postal-mime` (MIME parsing) nor `standardwebhooks` (webhook signature verification) is reachable from JinVa code. No advisory currently maps to any of them.
- **Remediation**: None required. Note it so a future `resend.webhooks` or inbound-email feature gets its own review.
- **Owner**: backend-engineer
- **Status**: Open (informational)

> **Re-verified (security-engineer, 2026-08-27):** still true after `ac050a9`. None of the four packages
> appears in the post-fix audit output, and the round still calls only `emails.send()` (one call site,
> `resend-mail.provider.ts:90`). No change requested.

## Frontend-owned findings

### [LOW] `PublicLink` renders an unvalidated `href` into a raw anchor
- **Category**: CWE-79 (latent) · OWASP A03 Injection
- **Location**: `JIN_VA-FRONTEND/jinva-frontend-web/src/components/public/public-link.tsx:32-39`
- **How found / exploit path**: When `href.includes("#")` the component bypasses `next/link` and emits `<a href={href}>` directly. Every current caller passes a module-level constant from `public-nav.ts`, so **nothing is exploitable today**. Flagging only because the prop type accepts any string, and a future caller passing user-derived or CMS-derived data would get an unguarded `javascript:` / `data:` sink in a component whose name invites reuse.
- **Remediation**: Guard the raw-anchor branch on `href.startsWith("/")` (all real callers are root-relative by design, per the component's own comment) and fall through to `next/link` or render nothing otherwise.
- **FIX (frontend-engineer, 2026-08-27)**: guarded as recommended, with one addition. The condition is now
  `href.startsWith("/") && !href.startsWith("//") && href.includes("#")`; anything else falls through to
  `next/link`.
  The `!href.startsWith("//")` half is not in your remediation text but is needed: a protocol-relative
  `//evil.example/#x` satisfies `startsWith("/")` and would still have reached the raw anchor, giving an
  off-site navigation from a component whose whole contract is "same-site fragment". Not the `javascript:`/`data:`
  XSS class you filed, but it is the same latent-untrusted-input shape, and it costs one clause. (I wrote the
  narrower guard first and caught this reviewing my own comment, so noting it explicitly.)
  No behaviour change for any current caller — all are `/#…` or `/about#…` constants. Re-verified in Chrome
  with real mouse events on a production build, clicking every header and footer link one at a time from all
  five public pages: **110/110 pass**, every anchor landing its section exactly 80px from the viewport top,
  zero console errors beyond the pre-existing `_vercel/insights` 404. (The two-line
  `/#platform-governance` footer link needs multi-point hit-testing to click reliably — its bounding-box
  centre falls in the leading gap, which is the same harness artifact recorded at the top of the QA report.
  With strict hit-testing it passes from all five pages.)
- **Owner**: frontend-engineer
- **Status**: **Verified fixed** (2026-08-27, security-engineer — one residual noted, no action required this round)

> ### Re-verified — **Verified fixed** (security-engineer, 2026-08-27)
>
> The guard is present at `public-link.tsx:43`, reading
> `if (href.startsWith("/") && !href.startsWith("//") && href.includes("#"))`. The raw-anchor branch is now
> unreachable for `javascript:`, `data:`, `vbscript:`, any absolute `http(s)://` URL and any
> protocol-relative `//host` — I agree the `//` clause is a genuine addition to my remediation and it closes
> an off-site-navigation shape I had not called out.
>
> Caller audit, re-done from scratch rather than trusted: `PublicLink` has 8 call sites across 5 files, and
> the `href` on every one is either a literal (`"/#services"`, `"/#platform-governance"`, `"/#how-it-works"`)
> or `link.href`/`suggestion.href` off a module-level `as const`-style array — `public-nav.ts`
> (`PUBLIC_NAV_LINKS`, `FOOTER_COLUMNS`: 13 entries, all `/#…`, `/login`, `/signup`, `/about`, `/contact`,
> `/terms`, `/privacy`) and `not-found-content.tsx:33-36` (4 entries). **No dynamic, user-derived or
> CMS-derived href reaches this component.** Props are typed `Omit<ComponentProps<"a">, "href">`, so the
> spread cannot smuggle in a second `href` or a `dangerouslySetInnerHTML`.
>
> **One residual, recorded so it is not mistaken for closed — no action asked for this round.** My own
> remediation said "fall through to `next/link`", and that is what was implemented, but `next/link` is **not
> a sanitizer**. I checked Next's own resolver in `node_modules/next/dist/client/resolve-href.js`: it calls
> `isLocalURL(urlAsString)` and, when that is false, **returns the string unchanged** — so a
> `javascript:alert(1)` href would still reach the DOM as `<a href="javascript:alert(1)">`, via `Link`
> instead of via the raw anchor. The latent sink moved rather than vanished. It stays LOW and non-blocking
> because no caller can supply such a value today, but if `PublicLink` is ever pointed at dynamic data the
> correct form is a positive allow-list (`/`-relative or a known route) with anything else rendering no
> anchor at all, not a `next/link` fallback.

### [MEDIUM — NEW, surfaced by backend-engineer during the fix round, confirmed] `SubmitVerificationDto`'s KYC media fields accept an arbitrary string
- **Category**: CWE-20 Improper Input Validation · CWE-345 Insufficient Verification of Data Authenticity · OWASP A04 Insecure Design
- **Location**: `JIN_VA-BACKEND/src/verification/dto/submit-verification.dto.ts:37-51` (`documentFrontUrl`, `documentBackUrl`, `selfieUrl`); persisted unmodified at `JIN_VA-BACKEND/src/verification/verification.service.ts:83-85`; columns are unbounded `text` at `JIN_VA-BACKEND/src/verification/entities/artisan-verification.entity.ts:43-50`; the validator that should be here already exists at `JIN_VA-BACKEND/src/common/validators/is-attachment-url.decorator.ts:91`
- **Scope note**: **Pre-existing** (predates this round), flagged by backend-engineer as "worth a security look" rather than fixed. Confirmed as a real gap.
- **How found / exploit path**: The three fields carry only `@IsString()` + `@IsNotEmpty()`. The global `ValidationPipe` (`main.ts:37-43`) is `whitelist`/`forbidNonWhitelisted`/`transform`, none of which constrains a string's *content*. So `POST /verification` from any authenticated artisan persists whatever those fields contain. This is the same class of gap that was found and closed three rounds running on the four sibling fields — `attachmentUrls` on jobs and bookings, `attachmentUrl` on messages, `photoUrls` on reviews — each of which now carries `@IsAttachmentUrl(<folder>)`. That decorator **already supports these exact folders**: `ALLOWED_EXTENSIONS_BY_FOLDER` at `is-attachment-url.decorator.ts:62-70` has entries for `documents: ['jpg','png','webp','pdf']` and `selfies: ['jpg','png','webp']`. The most sensitive folder on the platform is the one field group that was never wired up. Three concrete consequences:
  1. **No binding between the uploader and the referenced object.** `POST /uploads/document` returns a reference that is not tied to the caller, and nothing on submit checks that the artisan uploaded the file they are pointing at. An artisan can reference *any* `documents/`/`selfies/` object — including another artisan's already-approved ID scan — and an admin reviewing that submission would be shown someone else's document while approving this person's identity. **Exploitability is genuinely low**: filenames are `randomUUID()` and no endpoint discloses another artisan's references (`GET /verification/me` is own-record only, the list/detail endpoints are `@Roles(ADMIN)`), so a UUID would have to be guessed. Low likelihood, high impact if it lands — it is a KYC-integrity failure, not a confidentiality one.
  2. **An arbitrary absolute URL persists.** `https://attacker.example/beacon.png` validates today. It is **inert in the current UI** — I checked: `kyc-media.tsx:28` rejects anything that is not exactly `/uploads/(documents|selfies)/<segment>`, so the admin screen renders the error tile rather than fetching it. But `src/lib/utils.ts:26` (`resolveMediaUrl`) returns any `https?://` value verbatim, so *any* future consumer of these fields — an admin PDF export, an email, a mobile client, a second admin screen — turns a stored attacker URL into an off-origin request from an admin's browser (IP/UA disclosure, phishing imagery). The containment is currently a client-side shape check, which is not where a server-side data-integrity control belongs.
  3. **Unbounded input.** No `@MaxLength` and a `text` column, unlike `idNumber` (100), `fullLegalName` (200) and `additionalNotes` (1000) on the same DTO. Three unbounded columns per submission is a cheap storage-abuse primitive.
- **Remediation**: add `@IsAttachmentUrl('documents')` to `documentFrontUrl` and `documentBackUrl`, and `@IsAttachmentUrl('selfies')` to `selfieUrl` — no new code, the decorator and both folder entries already exist, and it fixes (2) and (3) outright and narrows (1) to "a well-formed reference in the right folder". For (1) properly, bind uploads to their uploader: have `POST /uploads/document|selfie` record `(filename, uploaderUserId)` and have `VerificationService.submit` reject a reference the submitting artisan did not upload. That is a small schema addition and should be its own ticket rather than bolted onto this round.
- **Owner**: backend-engineer
- **Status**: **Verified fixed** (2026-08-27, security-engineer — 11 probe cases through the real DTO; consequences (2) and (3) closed, (1) narrowed and re-filed as a LOW ticket, see below)

> **backend-engineer fix note (follow-up round) — ready for re-verification.**
>
> Took the remediation as written. `src/verification/dto/submit-verification.dto.ts` now carries
> `@IsAttachmentUrl('documents')` on `documentFrontUrl` and `documentBackUrl`, `@IsAttachmentUrl('selfies')`
> on `selfieUrl`, and `@MaxLength(500)` on all three. No new validator code — the decorator and both folder
> entries already existed, exactly as the finding said. `verification.service.ts` and the entity are
> untouched: the `text` columns stay `text`, because the cap belongs at the validation boundary and changing
> the column type would need a migration for no added protection.
>
> **On (2) and (3):** closed. **On (1):** narrowed to "a well-formed reference in the right folder", not
> closed — an artisan can still in principle name another artisan's `documents/`/`selfies/` object if they
> could guess a v4 UUID. Left open deliberately, per your own note that uploader-binding is a schema addition
> and should be its own ticket. Flagging that it is now the *only* remaining part of this finding.
>
> **`@MaxLength(500)` — one deviation from the brief worth stating plainly.** I was asked to match "how other
> stored-path fields in the codebase are bounded". They are not bounded: no URL/path field in any DTO carries
> a `@MaxLength` today (`attachmentUrl`, `attachmentUrls`, `photoUrls`, `fileUrl` all have none), and the
> corresponding columns are `text` or unlengthed `varchar`. So there was no existing convention to match, and
> I did not invent a shared constant for one DTO. I used the convention actually present *in this DTO* —
> inline `@MaxLength` with a round value, alongside `idNumber` (100), `fullLegalName` (200), `additionalNotes`
> (1000) — and picked 500, a value already used three times elsewhere in the codebase. 500 is ~8× the ~60
> characters a local reference needs, leaving room for a future S3 host plus key prefix. **Why the cap is not
> redundant given the shape check:** the local branch of the validator is fully anchored and self-bounding,
> but the S3 branch anchors only the *end* of the pathname (`remotePathPattern`), so once `S3_PUBLIC_URL_HOST`
> is set, `https://<host>/<megabytes of a/b/c>/documents/<uuid>.jpg` would satisfy the shape check. The cap is
> what actually closes (3) in S3 mode. The four sibling fields have the same latent gap; that is pre-existing
> and outside this fix, but you may want it as a ticket.
>
> **Swagger examples had to change and I want that on the record.** The old examples were
> `/uploads/documents/abc.jpg`, `/uploads/documents/abc-back.jpg`, `/uploads/selfies/abc.jpg` — all three now
> *fail* the validator they document, since the filename is not a UUID. Leaving them would have handed the
> frontend engineer three request bodies guaranteed to 400. Replaced with real UUID-shaped examples and added
> field descriptions naming the source upload endpoint and the rejected cases, matching the wording style on
> `send-message.dto.ts`.
>
> **Request-contract change, documented.** `POST /verification` accepts strictly less input than before, so
> `api-contract.md` has a new §3 and a row in the §0 table. In practice nothing breaks — the artisan flow
> uploads first and forwards the returned `url` verbatim — but a client that hand-builds these strings will
> now get a 400, so it is a contract change and is recorded as one rather than shipped silently.
>
> **Verification I ran.** `lint` 0 errors (25 pre-existing warnings, all `no-unsafe-argument` in unrelated
> spec files), `build` clean, `test` 40/40 suites and 363/363 unit tests green. `test:e2e` reproduces the
> known baseline exactly: **7 failed / 126 passed, and the failures are confined to the same two suites,
> `analytics-admin-disputes` and `messaging-notifications`** — undisturbed, and none of the 7 touches
> verification submit. Worth knowing for the next runner: my *first* full e2e run showed 8 failures across
> three suites, the extra one being `booking-concurrency`; run alone it passes, so that suite is flaky under
> parallel load against the shared DB rather than newly broken. Two subsequent full runs gave the documented
> 7/2. Separately, those two baseline-failing suites are order-dependent — run as a pair in isolation they
> produce 10 failures, not 7 — so the count is only meaningful from a full `npm run test:e2e`.
>
> Since no test covers this DTO, I also probed the validator directly against the finding's own exploit
> strings (15 cases, all as expected): valid front/back/selfie and a `.pdf` front accepted; rejected —
> `https://attacker.example/beacon.png`, a bare arbitrary string, a `selfies` path in `documentFrontUrl` and a
> `documents` path in `selfieUrl`, `.pdf` in `selfieUrl`, `../` and `%2e%2e%2f` traversal, an appended `?x=1`,
> the old non-UUID `abc.jpg` example, a 501-character value, and an over-cap S3-style path. That probe was a
> scratch script, not committed — if you would rather this be a permanent regression test, say so and I will
> add a spec; I did not add one unprompted since the brief said contained fix only.
>
> Not touched, as instructed: the seed script's `Entity metadata for Review#photos` crash. Related note for
> whoever picks that up — `src/database/seeds/seed.ts:728-790` writes KYC references like
> `/uploads/documents/yaw-selfie.jpg` that would **not** pass this new validator (non-UUID filenames, and
> selfies written into the `documents` folder, which is the second defect QA already recorded at
> `qa-report.md:173`). Seeds insert entities directly and bypass the DTO, so nothing breaks today and I left
> them alone, but seeded rows no longer represent input the API would accept.

> ### Re-verified — **Verified fixed** (security-engineer, 2026-08-27)
>
> I ran my own probe suite (**11 cases, all pass**) through the *real* `SubmitVerificationDto` with
> `plainToInstance` + `validateSync`, inspecting **which constraint key fired** rather than just pass/fail —
> that distinction is the whole point of the engineer's `@MaxLength` argument. Throwaway spec, run and
> **deleted**; backend `git status` shows only CRLF line-ending noise on three files (`src/main.ts`,
> `src/database/seeds/seed.ts`, `test/app.e2e-spec.ts`) with **zero content diff**, and no application code
> was touched.
>
> **The decorators are present and correct.** `submit-verification.dto.ts:47-51`, `:59-64`, `:74-78`:
> `@IsAttachmentUrl('documents')` on `documentFrontUrl`/`documentBackUrl`, `@IsAttachmentUrl('selfies')` on
> `selfieUrl`, `@MaxLength(500)` on all three, with `@IsString`/`@IsNotEmpty`/`@IsOptional` retained. The
> commit (`48b0ea3`) is **purely additive** — no existing constraint was removed or loosened, so there is no
> validation regression to look for.
>
> **V1–V2: the exploit strings from my own finding are now rejected.** All three legitimate local references
> validate clean (plus a `.pdf` front). Rejected with `isAttachmentUrl` firing:
> `https://attacker.example/beacon.png`, a bare arbitrary string, a `selfies` path in `documentFrontUrl`, a
> `documents` path in `selfieUrl`, `.pdf` in `selfieUrl`, `../../etc/passwd`, `%2e%2e%2f` traversal, an
> appended `?x=1`, the old non-UUID `abc.jpg` example, and an **uppercased** UUID (the pattern is
> lowercase-hex only). So consequence **(2)** — the arbitrary absolute URL — is closed at the server
> boundary, where it belongs, rather than by the frontend's client-side shape check.
>
> **V3–V4: the engineer's reasoning about the S3 branch is correct, and I confirmed it by reading *and*
> running.** `is-attachment-url.decorator.ts:97-98` builds two patterns from the same `fileShape` — the local
> one anchored at **both** ends (`^\/uploads\/(?:…)$`), the remote one anchored at the **end only**
> (`\/(?:…)$`). The local branch is therefore self-bounding. The S3 branch (`:118-127`) tests the
> end-anchored pattern against `url.pathname`, so **any** prefix is admissible provided it trips none of
> `SUSPICIOUS_PATTERN` (`:73` — `..`, `%2e`, `%2f`, `%5c`, `?`, `#`, backslash, whitespace); a prefix of plain
> `a/b/c/…` segments is unconstrained. Proven, not inferred:
>
> - **V3** — with `S3_PUBLIC_URL_HOST=cdn.jinva.example`, the value
>   `https://cdn.jinva.example/<400 chars of "a/">documents/<uuid>.jpg` produced **zero** constraint errors.
>   The shape check alone accepts a junk prefix.
> - **V4** — the same value grown to **10 076 characters** fired **exactly `['maxLength']`** and nothing else.
>
> **That is the confirmation asked for: `@MaxLength(500)` is what closes consequence (3), not the shape
> check.** `isAttachmentUrl` never fires on an oversized prefix. I agree with the engineer's write-up
> completely, and V4 is the evidence for it.
>
> **V6 — the branch is fail-closed by default.** With `S3_PUBLIC_URL_HOST` unset, *no* absolute URL is
> accepted at all, so the gap above is dormant until an operator sets that variable.
>
> **One thing neither of us had noticed, and it makes the residual smaller than it looks.** After the KYC fix,
> `buildPrivateMediaReference` (`src/uploads/upload-folders.ts`) returns `/uploads/<folder>/<filename>` for
> private folders **in both storage modes** — deliberately, so pre-cutover and post-cutover rows read back
> through one rule. So a *legitimate* KYC value always matches the fully anchored local pattern, and **the S3
> branch is unreachable for these three fields on any honest request**. An attacker would have to hand-build
> an absolute URL to reach it at all. Combined with V6, the practical exposure of the unbounded-prefix gap on
> the KYC fields is close to nil even before the cap.
>
> **V5 — a small shape-check weakness I am recording rather than filing.** Because the remote pattern is
> end-anchored, `https://<S3_PUBLIC_URL_HOST>/private/documents/<uuid>.jpg` — the *public* CDN host in front
> of the *private* key prefix — **passes** the shape check. It is not exploitable: private objects are never
> anonymously readable (that is the closed HIGH), `kyc-media.tsx:28` rejects any non-`/uploads/…` reference so
> the admin screen never fetches it, and the operator note already says `AWS_S3_PUBLIC_URL_BASE` must not
> front the `private/` prefix. Worth knowing that the validator would not stop such a value being *stored*.
>
> **Consequence (1) — uploader binding — is genuinely still open, exactly as the engineer says.** Now the only
> remaining part. **I am re-filing it as LOW rather than carrying the MEDIUM forward**, and stating the
> reasoning so this is not read as severity-shopping: impact stays high (a KYC-integrity failure — an admin
> could approve one artisan's identity while looking at another's document), but the attacker must guess a
> 122-bit `randomUUID()`, and no endpoint discloses another artisan's references (`GET /verification/me` is
> own-record only; list/detail are `@Roles(ADMIN)`; my round-2 probe P3 confirmed an artisan gets **403** from
> the KYC reader). Impact × likelihood lands at LOW. The fix is a schema addition — record
> `(filename, uploaderUserId)` at `POST /uploads/document|selfie` and have `VerificationService.submit` reject
> a reference the submitter did not upload — which is its own ticket, per my own original remediation.
>
> **W1–W5: the sibling gap is confirmed, and it is worse than on the field that was just fixed.** The engineer
> flagged that the four sibling attachment-URL fields share the latent gap and asked me to confirm my
> understanding matches. It does, and I measured it. **None of the four carries `@MaxLength`** — I re-read all
> four rather than trusting the note:
>
> | Field | Location | Bound present | Probe result (S3 branch live) |
> |---|---|---|---|
> | `SendMessageDto.attachmentUrl` | `src/messages/dto/send-message.dto.ts:48-51` | none | **W1** — accepted a **50 075**-char value, zero constraint errors |
> | `CreateReviewDto.photoUrls` | `src/reviews/dto/create-review.dto.ts:57-61` | `@ArrayMaxSize(3)` | **W2** — accepted a 50 075-char element; the array bound caps **count only** |
> | `CreateJobDto.attachmentUrls` | `src/jobs/dto/create-job.dto.ts:124-128` | `@ArrayMaxSize(10)` | **W3** — accepted **10 × 50 075 = 500 820** chars in one request |
> | `CreateBookingDto.attachmentUrls` | `src/bookings/dto/create-booking.dto.ts:108-112` | `@ArrayMaxSize(10)` | **W4** — same, **500 820** chars |
>
> **W5 control**: the identical shape against `documentFrontUrl` fires `['maxLength']`. So the cap really is
> the differentiator, and the three array fields are the worse case — `@ArrayMaxSize` multiplies an unbounded
> element length by up to ten. Same caveats apply as on the KYC fields (needs `S3_PUBLIC_URL_HOST` set), with
> one difference that cuts the other way: `job-attachments`/`reviews`/`messages` are *public* folders, so
> their legitimate values genuinely do take the absolute-URL form after a cutover, which makes the branch live
> for them in a way it is not for KYC. **Pre-existing, correctly out of scope for this fix, and not gating** —
> but it should be a ticket: add `@MaxLength` to all four, and consider anchoring the remote pattern at both
> ends so the shape check is self-bounding like the local branch, which fixes the class rather than the four
> instances.
>
> **One related pre-existing observation, recorded under "outside this round" below.** The validator reads
> `S3_PUBLIC_URL_HOST` (`:117`) while `S3StorageProvider` reads `AWS_S3_PUBLIC_URL_BASE` — two different
> variable names for the same cutover, and `S3_PUBLIC_URL_HOST` appears **nowhere** in the codebase outside
> this validator and its own spec. Fail-closed for security, but after a real cutover the four *public*-folder
> sibling fields would start 400-ing on legitimate CDN URLs until an operator sets a second, undocumented
> variable. Established by grepping **code references only** — no `.env` file was opened.

### [LOW — informational, NEW] The KYC reader is admin-only by design, so an artisan cannot view their own submitted document
- **Category**: Access-control design note — not a vulnerability
- **Location**: `JIN_VA-BACKEND/src/uploads/uploads.controller.ts:197-199` (`@Roles(Role.ADMIN)`); the artisan-facing read is `JIN_VA-BACKEND/src/verification/verification.controller.ts:51-59` (`GET /verification/me`, `@Roles(ARTISAN)`), which returns the stored *references* the artisan cannot resolve
- **How found**: raised by backend-engineer in their fix note; confirmed by probe **P3**, where an artisan's own valid token got **403** from `GET /uploads/kyc/documents/<file>`.
- **Assessment**: correct and deliberate, and it is the conservative choice — it follows directly from my own remediation ("serve them to admins through an authenticated endpoint"), and least-privilege says the reviewer role, not the subject role, gets the read. There is no finding here. Recording it because the shape is a trap for the next feature: if an artisan-facing "your submitted documents" screen is ever specified, the wrong fixes are (a) widening `@Roles` to include `ARTISAN`, which would let *any* artisan read *any* KYC object since the endpoint takes no ownership parameter, or (b) re-mounting `documents`/`selfies` publicly, which re-opens the HIGH.
- **Remediation if the product ever needs it**: a separate, scoped endpoint — e.g. `GET /verification/me/media/:field` — that resolves the reference **from the caller's own verification row** rather than from a path parameter, so ownership is structural instead of checked. Product-manager scope call, not a security requirement.
- **Owner**: product-manager (decision) / backend-engineer (if built)
- **Status**: Open (informational — no action required)

### Verified clean — no findings (evidence recorded so QA/audit need not redo it)

**Public-surface data isolation (DoD: "`/` and PUB1–PUB4 call no authenticated endpoint and leak no user, artisan, job or admin data") — PASS.** Read every file under `src/app/(public)/` and `src/components/public/` rather than trusting the design doc. The complete import closure is: UI primitives from `src/components/ui/`, `lucide-react`, `next`/`next/link`/`next/image`, `next-themes`, `@radix-ui/react-slot`, `react`, `@/components/brand/brand-pattern`, `@/components/logo`, `@/hooks/use-reveal-on-scroll`, and `@/lib/status-badges` (imported only by `landing/hero.tsx:10` for `getBookingStatusConfig` — a static config map of class names and labels, no data access). Zero `fetch`, zero `@/lib/api`, zero `useAuth`/`auth-context`, zero cookie/session/`localStorage`/`sessionStorage` access, zero `/users/me`, zero `Authorization`, zero `mock-data` import. Critically, `src/app/layout.tsx` mounts only `ThemeProvider`, `Toaster` and `Analytics` — **no auth provider at the root** — so no global provider can fire an authenticated request on a public page. No user, artisan, job or admin data appears on any of the five pages. `/contact` has no form at all (deliberately), so there is no public input path to any query.

**Middleware matcher and signed-session path (DoD: "Adding public routes did not widen the middleware matcher's gap … and the signed-session verification path is unchanged") — PASS, byte-for-byte.** SHA-256 over `src/middleware.ts` at pre-round `1d6aaa3` and post-round `c38dac2`: both `29e6c8b5f48b88762ee5b6a5b45c8d54e45e443430f68a5cadaa9acda9f4a567`. `src/lib/session-cookie.ts`: both `557488616f4c347734d17e19b5e3e8ede239970b0b22dddea9299a4771be7c06`. Neither file appears in the round's diff at all. Matcher remains `["/dashboard/:path*", "/login", "/signup", "/forgot-password", "/reset-password/:path*", "/verify-email"]` — `/dashboard/*` fully covered, `/` and the four new pages correctly outside it. `(public)` is a route group and contributes no URL segment; `find` confirms exactly one `middleware.ts` exists in the repo (`src/middleware.ts`), and the old `src/app/page.tsx` is deleted so there is no duplicate-route conflict at `/`. **The matcher did not change at all, which is the expected result given no route renaming happened** — nothing to flag. *(Re-verification addendum: still true, and still unchanged after `287ebe8`/`518498c`. But see the new `next@15.5.4` HIGH — the framework advisories include middleware-bypass classes, so the matcher being correct is necessary and not sufficient.)*

**XSS on the new pages — PASS.** No `dangerouslySetInnerHTML`, `.innerHTML`, `eval`, `new Function` or `document.write` anywhere in the public tree; the single repo-wide hit is pre-existing shadcn `src/components/ui/chart.tsx:83`, not modified this round and driven by chart config, not user input. Testimonials (`landing/testimonials.tsx:30-49`), the FAQ accordion and all prose content are module-level `readonly` constants rendered through normal JSX escaping. The testimonial avatar-initials derivation (`:88-93`) operates on those same constants.

**XSS on the new KYC media components — PASS (re-verification addition).** `kyc-media.tsx` renders only `<img src={objectUrl}>` and `<iframe src={objectUrl}>`, where `objectUrl` comes from `URL.createObjectURL(blob)` — a browser-minted `blob:` URL, never a stored value. The stored reference itself is used only as an object key and inside `console.error`, never rendered as markup or as a URL. `kycMediaPath()` (`:28`) is a fully anchored regex (`^\/?uploads\/(documents|selfies)\/([^/?#]+)$`) whose output is a fixed template, so a stored value cannot influence the request path beyond one path segment. No `dangerouslySetInnerHTML`. `apiFetchBlob` (`src/lib/api.ts:181-188`) goes through `authedRequest`, which throws `ApiError` on any non-ok status (`:136-154`) — so an error envelope can never be turned into an object URL and handed to `<img>`.

**`?role=` prefill (LP13) — PASS.** `src/components/auth/signup-form.tsx:20-36` allowlists exact-match `"CUSTOMER"` / `"ARTISAN"` and returns `""` for anything else, so `ADMIN`, lowercase, mixed-case, script payloads and null bytes all leave the selector empty; re-validated at submit (`:136`); role assignment remains server-authoritative. No privilege-escalation path.

**Secrets — PASS for this round.** No credential-shaped string in the frontend round diff or any of this round's commit messages, either repo. The only match in the backend round diff is `'placeholder-not-a-real-key'` in a spec fixture. `keys/` is untracked and gitignored (the historical exposure is the separate lead finding). New `scripts/check-color-tokens.mjs` shells out to nothing (its only `exec` is `RegExp.exec` at `:113`). `src/app/opengraph-image.tsx` consumes no request input. *(Re-verification addendum: re-checked across the four fix commits `350dc0b`, `b5d696c`, `ac050a9`, `518498c`, `287ebe8`. Still clean. Every new env reference is by name only — `AWS_S3_*`, `STORAGE_PROVIDER`, `SERVE_LEGACY_UPLOADS`, `MAIL_*`, `RESEND_API_KEY`, `S3_PUBLIC_URL_HOST`, `SESSION_COOKIE_SECRET`, `NEXT_PUBLIC_API_URL` — read via `process.env`/`ConfigService.get`. No `.env` file was opened at any point in this round either.)*

**Priority 7 — the renamed leak-prevention sentinels are sound and the assertions were not weakened.** Commit `ea52e86` replaced `AKIAEXAMPLESECRETLEAK` and `re_super_secret_value` with `leak-sentinel-not-a-key`, and updated **both** the planted value and every matching assertion in step: `s3-storage.provider.spec.ts` now plants `leak-sentinel-not-a-key` and asserts `not.toMatch(/leak-sentinel/)` / `not.toContain('leak-sentinel')`, retaining its additional `InvalidAccessKeyId`, bucket and region assertions — arguably stronger than before. The Resend spec's `await expect(...).rejects.not.toThrow(/leak-sentinel-not-a-key/)` is a valid, meaningful assertion: Jest's `rejects` fails outright if the promise resolves, so `.not` inverts only the message match, not the rejection requirement. The new sentinel carries no key shape and will not trip a scanner. **One real gap, already captured in the Resend MEDIUM above:** because the spec mocks the `resend` module, it cannot observe the SDK's own `console.error` — which is precisely where the leak that remains actually occurs. *(Re-verification addendum: that gap is now closed — `resend-mail.provider.sdk.spec.ts` drives the real SDK, and my own independent probe confirms the containment.)*

**CORS — no new finding, one pre-existing note.** `src/main.ts:23-31` is unchanged this round. `origin: process.env.ALLOWED_ORIGINS?.split(',')` means an unset variable yields `Access-Control-Allow-Origin: *`. Combined with `credentials: true` this is rejected by browsers for credentialed requests, so it is not exploitable for session theft, and every sensitive endpoint requires a bearer token. Worth pinning to an explicit allowlist for defence in depth; not a finding for this round. *(Re-verification addendum: `main.ts:23-31` is still byte-identical after all three backend fix commits — the new KYC endpoint inherits the same policy, and since it requires a bearer token an anonymous cross-origin read is impossible regardless of the CORS header.)*

## Pre-existing observations outside this round (recorded, not gating)

These surfaced while re-testing. All predate the round and none is in its diff. Listed so they are ticketed
rather than rediscovered; they do **not** gate this release.

**[MEDIUM — pre-existing] No rate limiting or lockout on authentication.** The only `ThrottlerGuard` in the
codebase is `src/messages/guards/message-send-throttler.guard.ts`, registered on one route
(`messages.controller.ts:73`); `ThrottlerModule` is imported only in `MessagesModule`. There is no global
`APP_GUARD` throttler in `app.module.ts`, and `POST /auth/login` (`auth.controller.ts:121`) has no throttle,
no failed-attempt counter and no lockout column anywhere in the schema (grep for
`failedLogin|lockedUntil|loginAttempts|lockout` returns nothing). So credential stuffing and password
brute-forcing are unthrottled, as are password-reset and email-verification resend. The new admin-only KYC
reader is in the same position — unthrottled, streaming up to 10MB per call — though admin-only keeps that
low. **Recommend:** a global `ThrottlerGuard` with a sane default plus a tighter per-route limit on the auth
endpoints. Its own ticket.

**[LOW — pre-existing] Raw SQL built by template-literal interpolation in the analytics query.**
`src/analytics/admin-analytics.service.ts:473-479` embeds a subquery via
`` `… AND j.status = '${Status.COMPLETED}' …` ``. The interpolated value is a TypeScript enum constant, so
**this is not injectable** — but it is the pattern that makes the next interpolation injectable, in a file
that also takes user-supplied query parameters. Suggest a bound parameter (`:status`) instead. Every other
value in that builder is already parameterised.

**[LOW — pre-existing, confirmed by probe this round] None of the four sibling attachment-URL fields is
length-bounded.** `SendMessageDto.attachmentUrl` (`src/messages/dto/send-message.dto.ts:48-51`),
`CreateReviewDto.photoUrls` (`src/reviews/dto/create-review.dto.ts:57-61`), `CreateJobDto.attachmentUrls`
(`src/jobs/dto/create-job.dto.ts:124-128`) and `CreateBookingDto.attachmentUrls`
(`src/bookings/dto/create-booking.dto.ts:108-112`) all carry `@IsAttachmentUrl(...)` but **no `@MaxLength`**.
Because the validator's S3 branch anchors only the end of the pathname, each accepts an arbitrarily long key
prefix once `S3_PUBLIC_URL_HOST` is configured — measured: 50 075 characters in one `attachmentUrl`, and
500 820 characters in a ten-element `attachmentUrls`, all with **zero** constraint errors. `@ArrayMaxSize`
bounds the element *count*, not element length, so the array fields are the worse case. This is the same gap
`@MaxLength(500)` just closed on the three KYC fields, and unlike KYC these are **public** folders whose
legitimate post-cutover values really do take the absolute-URL form, so the branch is live for them.
**Recommend:** `@MaxLength` on all four, and anchor the validator's remote pattern at both ends
(`is-attachment-url.decorator.ts:98`) so the shape check is self-bounding like the local branch — that fixes
the class rather than four instances. Its own ticket; not gating.

**[LOW — pre-existing] The attachment validator and the S3 provider read two different env variable names
for the same cutover.** `is-attachment-url.decorator.ts:117` gates its S3 branch on `S3_PUBLIC_URL_HOST`,
while `S3StorageProvider` builds public URLs from `AWS_S3_PUBLIC_URL_BASE`. `S3_PUBLIC_URL_HOST` appears
nowhere else in the codebase — only in that validator and its own spec. The direction is **fail-closed**, so
it is not a security defect: until someone sets it, no absolute URL validates at all. But after a real
`STORAGE_PROVIDER=s3` cutover an operator would naturally set `AWS_S3_PUBLIC_URL_BASE` and nothing else, and
the five public-folder attachment fields would then start rejecting the very CDN URLs the provider mints.
**Recommend:** derive the validator's allowed host from `AWS_S3_PUBLIC_URL_BASE` (parse its host) rather than
a second variable, or at minimum document both together in the cutover runbook. Established from code
references only — no `.env` file was opened.

**[non-security, pre-existing] That same analytics query is broken and fails on every refresh.** Visible in
every boot of my e2e runs: `Platform analytics refresh failed for range 7d/30d/90d/1y: syntax error at or
near "."`. The cause is `WHERE j.accepted_artisan_id = user.id` at
`admin-analytics.service.ts:475` — `user` is a reserved word in Postgres, so the unquoted alias is a syntax
error; it needs `"user"."id"`. So `topArtisans()` throws for every range and the platform analytics cache is
never populated. Not a security issue, and out of this round's scope, but it is a silent total failure of a
shipped feature — passing to backend-engineer/QA.

## Summary

**Round-2 status of every previously open item:**

| Finding | Severity | Status after re-verification |
|---|---|---|
| JWT keypair in git history | HIGH | **Open** — pre-existing, out of round, operator action outstanding |
| KYC documents/selfies publicly readable | HIGH | **Verified fixed** (14 independent probe cases) |
| Immutable public caching of KYC media | MEDIUM | **Verified fixed** |
| Resend SDK `console.error` leak | MEDIUM | **Verified fixed** (incl. restore-under-real-throw + concurrency) |
| SMTP raw error in the log line | MEDIUM | **Verified fixed** (tested at the log sink, not the throw) |
| Dependency advisories — backend | MEDIUM | **Verified fixed as far as non-breaking allows**; residual highs confirmed unreachable |
| Dependency advisories — frontend | → **HIGH** | **Verified fixed** in round 3 (`next@15.5.24`) — audit counts reproduced, 17 bypass probes on my own build |
| `dotfiles` rationale | LOW | **Verified fixed** (one stale version pin, non-blocking) |
| `AWS_S3_*` names in non-prod errors | LOW | Open — accepted, unchanged |
| `resend` unused subdeps | LOW | Open — informational, unchanged |
| `PublicLink` unvalidated `href` | LOW | **Verified fixed** (residual: `next/link` is not a sanitizer) |
| `next@15.5.4` critical + bypass advisories | HIGH (new in r2) | **Verified fixed** in r3 — 0 critical both views; residual `postcss` re-classified LOW-in-context |
| `SubmitVerificationDto` KYC fields | MEDIUM (new in r2) | **Verified fixed** in r3 — (2) and (3) closed; (1) uploader binding re-filed as LOW ticket |

**Raised across rounds 2–3:** 1 HIGH (`next@15.5.4` advisories) and 1 MEDIUM (`SubmitVerificationDto` KYC
fields) — **both now Verified fixed** — plus 1 LOW informational (admin-only KYC read is deliberate) and five
pre-existing out-of-round observations.

**Open items after round 3:**

- Open critical: **0**
- Open high: **1** — JWT keypair in git history. Pre-existing, out of this round's scope, operator-owned.
  **Nothing from this round's own code remains open at high or critical.**
- Open medium: **1** — no rate limiting on auth (pre-existing, out-of-round)
- Open low: **8** — `AWS_S3_*` names in non-prod errors (accepted); `resend` unused subdeps (informational);
  admin-only KYC read (informational); raw-SQL interpolation in analytics (pre-existing, out-of-round);
  `postcss@8.4.31` nested under `next` (audit label high, **LOW in this app's context** — build-time only, no
  request-path exposure, no non-breaking fix taken this round); uploader binding for KYC references (re-filed
  down from the closed MEDIUM); no `@MaxLength` on the four sibling attachment-URL fields (pre-existing,
  confirmed by probe); `S3_PUBLIC_URL_HOST` vs `AWS_S3_PUBLIC_URL_BASE` naming mismatch (pre-existing,
  fail-closed)

### Release readiness

**Round 3 verdict: ship-blocking items = 0. This round is release-ready on the "zero open critical/high" bar.**

Splitting it the same way as before, because that is the question that keeps being asked:

1. **Every finding raised against this round's own code is closed, and every one was re-tested by me rather
   than accepted.** Across rounds 2 and 3 that is 1 HIGH (KYC identity documents on a public path), 1 HIGH
   raised during re-verification (`next@15.5.4`), 4 MEDIUMs, 1 MEDIUM raised during re-verification
   (`SubmitVerificationDto`), and 2 LOWs — **all Verified fixed**. Total independent probe cases across the
   two re-verification rounds: 14 (KYC delivery leg) + 6 (Resend SDK containment) + 2 (SMTP log sink) + 16
   (Next.js middleware bypass) + 11 (KYC DTO validation), plus two audit re-runs per repo and four control
   suite runs.

2. **The `next` dependency HIGH — the single item that blocked round 2 — is closed.** `next@15.5.24` is
   installed and running (the server itself logs `▲ Next.js 15.5.24`), the pin is still exact, and
   `npm audit` is **0 critical / 1 high / 1 moderate** in *both* the all-deps and `--omit=dev` views, down
   from 14 and 7. There are **no advisories against `next`'s own code at all** — the remaining `next` entry
   is `via: ["postcss"]` with no advisory object of its own. I re-fired all three bypass classes the
   advisories describe (RSC header variants, segment-prefetch path forms, and four spoofed
   `x-middleware-subrequest` shapes including the chained form) against my own production build: **307 to
   `/login` in every one of 16 gate probes, no page shell served**, with `GET /` and `GET /login` returning 200 as
   controls. The gate source is byte-identical to the pre-round baseline.

3. **The residual `postcss` high is not, in my judgement, an open high — and I would not gate on it.** This
   is the judgement call I was asked for, so here is the reasoning rather than just the conclusion. All four
   advisories are path-traversal / info-disclosure driven by an attacker-controlled `sourceMappingURL` **in
   the CSS that postcss parses**. `postcss` is build-time only; `next start` serves pre-compiled CSS, and a
   grep for `postcss|styleSheet|insertRule|CSSStyleSheet` across `src/**/*.ts{,x}` returns **zero** hits —
   the app has no runtime CSS processing and no path by which user content becomes a stylesheet. The
   vulnerable copy is `node_modules/next/node_modules/postcss@8.4.31` **only**; our own top-level `postcss` is
   `8.5.26`, above every range. So there is no request-path exposure, and the worst case is a `.map` file read
   on a trusted build machine. **Contextual severity: LOW.** I have recorded it as such rather than as an open
   high, because carrying an unreachable build-tool advisory as a release gate would be inaccurate.
   Not taking `next@16` in a patch round was correct — and I confirmed there is no alternative patch:
   `npm view next@'>=15.5.24 <16' version` returns only `15.5.24`, and that version pins `postcss` at
   `8.4.31` exactly. **One correction for the ticket:** an npm `overrides` entry
   (`"overrides": { "next": { "postcss": "^8.5.26" } }`) *would* clear it without a major bump, contrary to
   "the only non-breaking fix is `next@16`". I have not applied or validated it — frontend-engineer should,
   and confirm the CSS build is unchanged.

4. **The `SubmitVerificationDto` MEDIUM is closed, and the engineer's own caveat about it is correct.** I
   verified their reasoning by probe, not by agreement: with the S3 branch live, a junk-prefixed URL under 500
   characters passes the shape check with zero errors, and the same value at 10 076 characters fires
   **exactly `['maxLength']`**. So `@MaxLength(500)` is indeed the control that closes the unbounded-input
   consequence — `@IsAttachmentUrl` never fires on an oversized prefix. I also confirmed the identical latent
   gap on all four sibling fields (up to 500 820 characters accepted in one request), which is pre-existing,
   correctly outside this fix, and now ticketed. The one remaining part of that finding — binding an upload to
   its uploader — needs a schema change and is re-filed as **LOW** (guessing a 122-bit UUID), tracked
   separately.

5. **The lead HIGH (leaked RS256 JWT keypair in git history) is the only thing keeping this file from reading
   "fully clean", and I want that stated without hedging.** It is pre-existing, was never in this round's
   diff, is explicitly out of this round's scope by agreement with the requesting lead, and is owned by the
   operator, not by either engineer. It does **not** gate this round's code. It **does** gate the deployment,
   and it still needs: (1) operator confirmation that every deployed environment runs the rotated pair, not
   the historical one — blob-hash comparison shows the working-tree pair has been rotated, but I cannot see
   deployed values without reading environment configuration, which is out of bounds; (2) a history purge
   (`git filter-repo`/BFG) across all branches plus a re-clone by every contributor; (3) a CI secret scan so a
   key cannot be re-committed.

**So, precisely: `security-report.md` now has zero open critical or high findings arising from this round's
own code.** The one remaining open HIGH is the pre-existing leaked keypair, and it is the *only* reason the
file does not read "fully clean". Everything else open is LOW, plus one pre-existing MEDIUM (auth rate
limiting) that predates the round.

The `STORAGE_PROVIDER=s3` cutover, which my first report said must not be flipped, remains **safe to flip
from a KYC-exposure standpoint**, with the two operator notes recorded under that finding
(`AWS_S3_PUBLIC_URL_BASE` must not front the `private/` prefix; bucket policy should deny public reads on it
as defence in depth). BI4's Resend path can ship.

### Re-verification loop

**Round 3 complete. Loop closed — no round 4 is needed for this feature.** All statuses in this report are
mine, established by my own probes.

Nothing is required of either engineer to release this round. Carried forward as tickets, none gating:

- **operator (blocking the *deployment*, not this round):** confirm the deployed `JWT_PRIVATE_KEY`/
  `JWT_PUBLIC_KEY` are the rotated pair; purge the historical blob from git history; add a CI secret scan.
- **frontend-engineer:** try `"overrides": { "next": { "postcss": "^8.5.26" } }` and confirm the CSS build is
  unchanged — cheaper than waiting for `next@16`; sync `eslint-config-next` to `15.5.24` on the next
  dependency pass; stand up a CI workflow with `npm audit --audit-level=high` in both repos.
- **backend-engineer:** `@MaxLength` on the four sibling attachment-URL fields, and both-end anchoring of the
  validator's remote pattern; upload-to-uploader binding for KYC references; reconcile `S3_PUBLIC_URL_HOST`
  with `AWS_S3_PUBLIC_URL_BASE`; global auth rate limiting/lockout; the `nodemailer`/`axios`/`firebase-admin`
  major bumps; bound parameter for the analytics raw SQL; and the broken `topArtisans()` query
  (`"user"."id"`), which is a silent total failure of a shipped feature.
