# Security Report: Routes, Frontend Patterns & Backend Infra

**Reviewer:** security-engineer · **Date:** 2026-08-27
**Scope:** frontend `1d6aaa3..c38dac2`, backend `41815ba..ea52e86`. BI3 excluded (deferred, not built).
**Baseline pass:** `security-review` skill methodology executed directly (its sub-agent orchestration is unavailable in this thread), then the round-specific manual review below.
**No `.env` / `.env.*` file was opened, read, grepped or inspected. No credential value appears anywhere in this report.** Key-rotation evidence below is established by SHA-1 blob-hash comparison only — no key material was displayed.

## Lead finding — read first

### [HIGH] RS256 JWT signing keypair is recoverable from git history
- **Category**: CWE-798 / CWE-540 · OWASP A07 Identification & Authentication Failures
- **Location**: `JIN_VA-BACKEND/keys/private.key` added at commit `2a8a0e9`, deleted at `cf5faeb`; consumed at `JIN_VA-BACKEND/src/auth/auth.module.ts:24-39` and `JIN_VA-BACKEND/src/auth/strategy/jwt.strategy.ts:9-22`
- **Scope note**: **Pre-existing. Not introduced by this round.** Led with because it is auth-bypass class.
- **How found / exploit path**: `keys/` is correctly untracked and gitignored today (`.gitignore:59`), but `git log --all --diff-filter=A -- keys/private.key` shows the blob was committed at `2a8a0e9` and is still reachable from `develop` and ~10 other branches. That file is the RS256 *signing* key: `loadKey('JWT_PRIVATE_KEY', 'keys/private.key')` with `signOptions.algorithm: 'RS256'`. Anyone with repo, fork, clone or CI-cache access can extract it and mint an access token with an arbitrary `sub` and `role` — including `admin` — against any environment still running that keypair. **Mitigating evidence:** the working-tree pair has been rotated since. Blob hashes differ (`private.key` historical `a15bd50…` vs working `0da340f…`; `public.key` historical `b60f2ac…` vs working `af5eff1…`), so the leaked key is not the current local key. I cannot verify deployed values without reading environment configuration, which is out of bounds.
- **Remediation**: (1) Operator confirms every deployed environment's `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` is the rotated pair, not the historical one — if there is any doubt, rotate again; note that rotation invalidates all live access tokens, so schedule it. (2) Purge the blob from history with `git filter-repo`/BFG across all branches and force-push, then have every contributor re-clone. (3) Add a pre-commit/CI secret scan so a key cannot be re-committed. (4) Consider dropping the on-disk fallback in `loadKey` for production so a stray file can never be picked up.
- **Owner**: backend-engineer + operator
- **Status**: Open

## Backend-owned findings

### [HIGH] The CDN cutover makes KYC identity documents and selfies publicly readable
- **Category**: CWE-200 / CWE-359 Exposure of Private Personal Information · OWASP A01 Broken Access Control
- **Location**: `JIN_VA-BACKEND/src/uploads/providers/s3-storage.provider.ts:206-211` (`buildPublicUrl`); folder union at `JIN_VA-BACKEND/src/uploads/providers/storage-provider.interface.ts:1-9`; upload endpoints at `JIN_VA-BACKEND/src/uploads/uploads.controller.ts:63-101`; consumer at `JIN_VA-FRONTEND/jinva-frontend-web/src/app/dashboard/admin/verifications/page.tsx:349-353`
- **How found / exploit path**: `buildPublicUrl` returns a single public bucket/CDN URL shape for **every** value of `UploadFolder`, and that union includes `documents` and `selfies` — national ID front/back and KYC selfies, uploaded via `POST /uploads/document` and `POST /uploads/selfie`. `S3StorageProvider.upload` sets no ACL, so objects inherit the bucket default; but the admin verification screen renders those stored URLs directly as image tiles (a browser `<img>`/lightbox fetch that carries no `Authorization` header), so the objects **must** be anonymously readable for the feature to work at all. Following BI1's documented cutover therefore requires a publicly-readable prefix containing identity documents, protected only by UUID obscurity, with no expiry, no revocation and no access audit trail. Same shape already applies to the legacy `/uploads` static mount, which this round deliberately preserves. BI3's deferral does not cover this — that decision was about the *upload* leg; this is the *delivery* leg BI1/BI2 explicitly ship.
- **Remediation**: Split the key namespace by sensitivity before flipping `STORAGE_PROVIDER=s3`. Keep `documents` and `selfies` in a private prefix (ideally a separate bucket) that is never fronted by `AWS_S3_PUBLIC_URL_BASE`, and serve them to admins through an authenticated backend endpoint that issues a short-lived presigned GET. Only `avatars`, `portfolio`, `reviews`, `messages` and `job-attachments` belong on the public CDN prefix. The frontend then needs the admin verification tiles pointed at the authenticated endpoint rather than the raw stored URL.
- **Owner**: backend-engineer (frontend-engineer for the admin tile source, once the endpoint exists)
- **Status**: Open

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

### [MEDIUM] Legacy media handler applies year-long public immutable caching to KYC documents
- **Category**: CWE-524 Use of Cache Containing Sensitive Information
- **Location**: `JIN_VA-BACKEND/src/uploads/legacy-media.config.ts:87` and `:161-163`; asserted at `JIN_VA-BACKEND/test/legacy-media-serving.e2e-spec.ts:98-104`
- **How found / exploit path**: The new mount sets `immutable: true, maxAge: LEGACY_MEDIA_MAX_AGE_MS` (365 days), so `send` emits `Cache-Control: public, max-age=31536000, immutable` for the whole `/uploads` tree — a tree that contains `documents/` and `selfies/`. The mount it replaced passed no `maxAge`, yielding `public, max-age=0`. So this round newly marks identity-document responses as long-lived, publicly cacheable and non-revalidating. Consequences: any intermediary or shared cache (corporate proxy, ISP cache, or a CDN later placed in front of the app server) retains ID scans and selfies for a year; every browser disk cache on a shared machine persists them across sessions; and `immutable` means a replaced or revoked document keeps being served from cache. Reaching a document still requires knowing its UUID URL, which is what keeps this MEDIUM rather than HIGH.
- **Remediation**: Make the cache policy folder-aware in the `setHeaders` callback that already exists at `:164-169` — keep `public, max-age=31536000, immutable` for `avatars`/`portfolio`/`reviews`/`messages`/`job-attachments`, and emit `Cache-Control: private, no-store` for `documents`/`selfies`. Better still, exclude those two folders from the static mount entirely and gate them behind the authenticated endpoint from the HIGH finding above.
- **Owner**: backend-engineer
- **Status**: Open

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
- **Status**: Open

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

### [MEDIUM] SMTP auth failures put the `MAIL_USER` value into application logs — and SMTP is the default provider
- **Category**: CWE-532 Insertion of Sensitive Information into Log File
- **Location**: `JIN_VA-BACKEND/src/mail/providers/smtp-mail.provider.ts:29-37`; log sink at `JIN_VA-BACKEND/src/mail/mail.service.ts:45-50`
- **How found / exploit path**: `SmtpMailProvider.send()` awaits `nodemailer.sendMail()` with no catch and no sanitisation, and `MailService`'s catch logs `getErrorMessage(err)` — the raw `.message` — then re-throws. nodemailer surfaces an SMTP auth rejection as `Invalid login: <verbatim server response>`, and many SMTP servers echo the submitted username in their 535 response. The `MAIL_USER` value can therefore land in the application log. This is exactly the risk class the engineer identified and defended against for the *new* provider — `resend-mail.provider.ts:36-40` says so in as many words ("an SMTP `535` response echoes the username, for instance") — but the mitigation was applied only to Resend, leaving the **default, currently-active** transport unprotected. The behaviour is pre-existing (the pre-round `MailService` logged the same raw message), so BI4 did not introduce it; BI4 preserved it while asserting in the DoD that "No credential value appears in any log", which is not accurate for the default path.
- **Remediation**: Give `SmtpMailProvider.send()` the same discipline as `ResendMailProvider`: catch, log and re-throw using nodemailer's `err.code` / `err.responseCode` only, and never `err.message` or `err.response`. Then either correct or re-qualify the DoD line.
- **Owner**: backend-engineer
- **Status**: Open

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

### [MEDIUM] Known-vulnerable dependencies in both repos
- **Category**: CWE-1035 / OWASP A06 Vulnerable and Outdated Components
- **Location**: `JIN_VA-BACKEND/package.json`, `JIN_VA-FRONTEND/jinva-frontend-web/package.json`
- **How found**: `npm audit` in both repos.
  - **Backend, production deps** (`--omit=dev`): 30 vulnerabilities — 1 critical, 14 high. `handlebars@4.7.8` **CRITICAL** (GHSA-2w6w-674q-4c4q, CVSS 9.8, JS injection via AST type confusion). **Reachability assessed as low**: `src/mail/mail.template.ts:11-33` compiles only static `.hbs` files read from the repo, there are no dynamic partials, and there is no triple-stache anywhere under `src/mail/`, so template source is never attacker-controlled and only the data context is user-supplied. `nodemailer@<=9.0.0` **HIGH** (several CRLF / SMTP-command-injection advisories) sits directly in BI4's path. Also high: `validator`, `axios`, `form-data`, `jws`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`, `lodash`, `path-to-regexp`, `glob`, `minimatch`, `brace-expansion`.
  - **Frontend**: 14 vulnerabilities — 2 critical (`tar`), high (`sharp`), moderate (`postcss`, `yaml`). All are build/dev-time transitives under `next`.
  - **`resend@6.24.0` specifically** (new this round, checked to the leaves as asked): adds `postal-mime@2.7.5`, `standardwebhooks@1.0.0`, `@stablelib/base64`, `fast-sha256`. **None appears in any advisory.** The new package introduces no known-vulnerable subdependency.
- **Remediation**: Run `npm audit fix` in both repos — it clears `nodemailer`, `validator`, `form-data`, `tar` and `yaml` without breaking changes. Upgrade `handlebars` to ≥4.7.9 on its own merits even though the critical path is not reachable. Defer `firebase-admin` and `sharp` (both require breaking major bumps) to a tracked ticket rather than this round.
- **Owner**: backend-engineer / frontend-engineer
- **Status**: Open

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

### [LOW] The documented rationale for `dotfiles: 'ignore'` does not hold, and the option is a no-op
- **Category**: CWE-1078 (inconsistent/incorrect rationale) — no exploitable condition
- **Location**: `JIN_VA-BACKEND/src/uploads/legacy-media.config.ts:153-161`
- **How found**: Verified against the installed libraries rather than the comment. The comment says `'deny'` "reports a 403 by calling `next(err)`", reaching Express's `finalhandler` and an HTML stack trace outside production. With the mount as written, `fallthrough` is not set, so it defaults to `true` (`serve-static@2.2.0/index.js:50`) and `forwardError` starts `false` (`:85`). `send@1.2.0`'s dotfile check runs in `pipe()` at `index.js:458-468`, i.e. **before** the `file` event that would flip `forwardError` (`serve-static/index.js:106-109`). A 403 therefore has `statusCode < 500` with `forwardError === false`, so serve-static takes the plain `next()` branch, not `next(err)` (`:115-118`) — a `'deny'` 403 would fall through to Nest's clean JSON 404 exactly as `'ignore'` does. Separately, `'ignore'` is already `send`'s default (`send/index.js:114-116`), so the explicit option changes no behaviour.
  **Does it trade one leak for another? No.** A 404 reveals strictly less than a 403 (which would confirm existence), so the chosen value is the conservative one and the outcome is safe. This is documentation risk only — but it matters, because the stack-trace path the comment describes *is* real for 5xx-class `send` errors (`!(err.statusCode < 500)` → `next(err)` → `finalhandler` → HTML stack when `NODE_ENV !== 'production'`), and it becomes reachable for 403/404 too the moment someone adds `fallthrough: false` on the strength of this comment.
- **Remediation**: Correct the comment to describe the actual mechanism. If the `finalhandler` concern is to be closed properly, register an Express error handler in front of the static mount so no `send` error can reach `finalhandler`. Also add a dotfile request to `test/legacy-media-serving.e2e-spec.ts` — it currently covers traversal, directory listing and clean-404, but never asserts the dotfile behaviour the comment is entirely about.
- **Owner**: backend-engineer
- **Status**: Open

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

### [LOW — accepted] Missing-configuration errors return `AWS_S3_*` variable names to the client outside production
- **Category**: CWE-209 Generation of Error Message Containing Sensitive Information
- **Location**: `JIN_VA-BACKEND/src/uploads/providers/s3-storage.provider.ts:156-165`; filter behaviour at `JIN_VA-BACKEND/src/common/filters/all-exceptions.filter.ts:99-101`
- **How found / assessment**: `requireConfiguration()` throws an `InternalServerErrorException` whose message names the absent variables, and the filter returns a 5xx exception's own message verbatim whenever `NODE_ENV !== 'production'`. Names only, never values — and BI1's acceptance criterion explicitly asks for this message to surface, so I am recording it as **accepted**, not a defect. Operators should note that in production the filter substitutes the generic string, so the diagnostic must be read from the log.
- **Verified good, same file (BI1 priority 3 — checked through the filter, not the provider in isolation)**: the AWS-failure path is correctly sanitised end to end. `failLoudly` (`:177-189`) constructs a **new** exception with the fixed `CLIENT_FAILURE_MESSAGE` and never chains the SDK error as `cause`, so the filter's non-production message passthrough **and** its unconditional `stack:` log line (`all-exceptions.filter.ts:79-86`) both see only the sanitised exception. `describeAwsFailure` (`:257-262`) emits error name plus HTTP status only. No bucket value, region value, access-key identifier, SDK message or SDK stack reaches either the client or the log. The object key (`folder/uuid.ext`) is logged, which is operationally necessary and carries no credential.
- **Owner**: backend-engineer
- **Status**: Open (accepted — no change requested)

### [LOW — informational] `resend` adds unused transitive attack surface
- **Category**: CWE-1104 Use of Unmaintained/Unnecessary Third-Party Components
- **Location**: `JIN_VA-BACKEND/package.json`; lock additions `postal-mime@2.7.5`, `standardwebhooks@1.0.0`, `@stablelib/base64`, `fast-sha256`
- **How found**: The round uses only `emails.send()`. Neither `postal-mime` (MIME parsing) nor `standardwebhooks` (webhook signature verification) is reachable from JinVa code. No advisory currently maps to any of them.
- **Remediation**: None required. Note it so a future `resend.webhooks` or inbound-email feature gets its own review.
- **Owner**: backend-engineer
- **Status**: Open (informational)

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
  No behaviour change for any current caller — all are `/#…` or `/about#…` constants. Re-verified in a browser
  on the production build: all 5 header nav anchors and all 14 footer links still navigate and land on-section;
  see the fix note on the QA report's LP3/LP9 items for the click evidence.
- **Owner**: frontend-engineer
- **Status**: Open

### Verified clean — no findings (evidence recorded so QA/audit need not redo it)

**Public-surface data isolation (DoD: "`/` and PUB1–PUB4 call no authenticated endpoint and leak no user, artisan, job or admin data") — PASS.** Read every file under `src/app/(public)/` and `src/components/public/` rather than trusting the design doc. The complete import closure is: UI primitives from `src/components/ui/`, `lucide-react`, `next`/`next/link`/`next/image`, `next-themes`, `@radix-ui/react-slot`, `react`, `@/components/brand/brand-pattern`, `@/components/logo`, `@/hooks/use-reveal-on-scroll`, and `@/lib/status-badges` (imported only by `landing/hero.tsx:10` for `getBookingStatusConfig` — a static config map of class names and labels, no data access). Zero `fetch`, zero `@/lib/api`, zero `useAuth`/`auth-context`, zero cookie/session/`localStorage`/`sessionStorage` access, zero `/users/me`, zero `Authorization`, zero `mock-data` import. Critically, `src/app/layout.tsx` mounts only `ThemeProvider`, `Toaster` and `Analytics` — **no auth provider at the root** — so no global provider can fire an authenticated request on a public page. No user, artisan, job or admin data appears on any of the five pages. `/contact` has no form at all (deliberately), so there is no public input path to any query.

**Middleware matcher and signed-session path (DoD: "Adding public routes did not widen the middleware matcher's gap … and the signed-session verification path is unchanged") — PASS, byte-for-byte.** SHA-256 over `src/middleware.ts` at pre-round `1d6aaa3` and post-round `c38dac2`: both `29e6c8b5f48b88762ee5b6a5b45c8d54e45e443430f68a5cadaa9acda9f4a567`. `src/lib/session-cookie.ts`: both `557488616f4c347734d17e19b5e3e8ede239970b0b22dddea9299a4771be7c06`. Neither file appears in the round's diff at all. Matcher remains `["/dashboard/:path*", "/login", "/signup", "/forgot-password", "/reset-password/:path*", "/verify-email"]` — `/dashboard/*` fully covered, `/` and the four new pages correctly outside it. `(public)` is a route group and contributes no URL segment; `find` confirms exactly one `middleware.ts` exists in the repo (`src/middleware.ts`), and the old `src/app/page.tsx` is deleted so there is no duplicate-route conflict at `/`. **The matcher did not change at all, which is the expected result given no route renaming happened** — nothing to flag.

**XSS on the new pages — PASS.** No `dangerouslySetInnerHTML`, `.innerHTML`, `eval`, `new Function` or `document.write` anywhere in the public tree; the single repo-wide hit is pre-existing shadcn `src/components/ui/chart.tsx:83`, not modified this round and driven by chart config, not user input. Testimonials (`landing/testimonials.tsx:30-49`), the FAQ accordion and all prose content are module-level `readonly` constants rendered through normal JSX escaping. The testimonial avatar-initials derivation (`:88-93`) operates on those same constants.

**`?role=` prefill (LP13) — PASS.** `src/components/auth/signup-form.tsx:20-36` allowlists exact-match `"CUSTOMER"` / `"ARTISAN"` and returns `""` for anything else, so `ADMIN`, lowercase, mixed-case, script payloads and null bytes all leave the selector empty; re-validated at submit (`:136`); role assignment remains server-authoritative. No privilege-escalation path.

**Secrets — PASS for this round.** No credential-shaped string in the frontend round diff or any of this round's commit messages, either repo. The only match in the backend round diff is `'placeholder-not-a-real-key'` in a spec fixture. `keys/` is untracked and gitignored (the historical exposure is the separate lead finding). New `scripts/check-color-tokens.mjs` shells out to nothing (its only `exec` is `RegExp.exec` at `:113`). `src/app/opengraph-image.tsx` consumes no request input.

**Priority 7 — the renamed leak-prevention sentinels are sound and the assertions were not weakened.** Commit `ea52e86` replaced `AKIAEXAMPLESECRETLEAK` and `re_super_secret_value` with `leak-sentinel-not-a-key`, and updated **both** the planted value and every matching assertion in step: `s3-storage.provider.spec.ts` now plants `leak-sentinel-not-a-key` and asserts `not.toMatch(/leak-sentinel/)` / `not.toContain('leak-sentinel')`, retaining its additional `InvalidAccessKeyId`, bucket and region assertions — arguably stronger than before. The Resend spec's `await expect(...).rejects.not.toThrow(/leak-sentinel-not-a-key/)` is a valid, meaningful assertion: Jest's `rejects` fails outright if the promise resolves, so `.not` inverts only the message match, not the rejection requirement. The new sentinel carries no key shape and will not trip a scanner. **One real gap, already captured in the Resend MEDIUM above:** because the spec mocks the `resend` module, it cannot observe the SDK's own `console.error` — which is precisely where the leak that remains actually occurs.

**CORS — no new finding, one pre-existing note.** `src/main.ts:23-31` is unchanged this round. `origin: process.env.ALLOWED_ORIGINS?.split(',')` means an unset variable yields `Access-Control-Allow-Origin: *`. Combined with `credentials: true` this is rejected by browsers for credentialed requests, so it is not exploitable for session theft, and every sensitive endpoint requires a bearer token. Worth pinning to an explicit allowlist for defence in depth; not a finding for this round.

## Summary

- Open critical: **0**
- Open high: **2** — JWT keypair in git history (pre-existing, out-of-round); KYC documents on the public CDN prefix (this round, BI1/BI2)
- Open medium: **4** — immutable public caching of KYC media; Resend SDK `console.error` leak; SMTP username in logs; dependency advisories
- Open low: **4** — `dotfiles` rationale incorrect; `AWS_S3_*` names in non-prod errors (accepted); `resend` unused subdeps (informational); `PublicLink` unvalidated `href` (latent)

**Release readiness.** Per the DoD's "zero open critical/high findings" gate, this round is **not release-ready as a whole**, with an important split:

- **The frontend half passes cleanly.** All four frontend security DoD lines are verified: public-surface isolation, matcher integrity, no secrets, no XSS. The only frontend finding is latent and LOW. From a security standpoint the landing page, the four supporting pages and the design-token migration can ship.
- **The backend cutover should not be flipped on yet.** `STORAGE_PROVIDER=s3` must not be set in any deployed environment until the KYC-folder separation (HIGH) and the cache policy (MEDIUM) are resolved — flipping it as currently documented would publish identity documents to a public CDN prefix. BI4's Resend path can ship, with the two MEDIUM log-hygiene items fixed and the DoD's "no credential value in any log" claim corrected to match reality.
- The lead HIGH is pre-existing and does not gate this round's code, but it does gate the next release: it needs operator confirmation of rotation plus a history purge, tracked separately.

**Re-verification loop.** Engineers should append fix notes under each finding, leaving `Status` for me. I will re-test and mark each **Verified fixed** or **Still present**. For the two log-hygiene items specifically, I will re-check against the real SDK/transport rather than the mocked specs.
