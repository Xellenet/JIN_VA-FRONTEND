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

### [MEDIUM] Legacy media handler applies year-long public immutable caching to KYC documents
- **Category**: CWE-524 Use of Cache Containing Sensitive Information
- **Location**: `JIN_VA-BACKEND/src/uploads/legacy-media.config.ts:87` and `:161-163`; asserted at `JIN_VA-BACKEND/test/legacy-media-serving.e2e-spec.ts:98-104`
- **How found / exploit path**: The new mount sets `immutable: true, maxAge: LEGACY_MEDIA_MAX_AGE_MS` (365 days), so `send` emits `Cache-Control: public, max-age=31536000, immutable` for the whole `/uploads` tree — a tree that contains `documents/` and `selfies/`. The mount it replaced passed no `maxAge`, yielding `public, max-age=0`. So this round newly marks identity-document responses as long-lived, publicly cacheable and non-revalidating. Consequences: any intermediary or shared cache (corporate proxy, ISP cache, or a CDN later placed in front of the app server) retains ID scans and selfies for a year; every browser disk cache on a shared machine persists them across sessions; and `immutable` means a replaced or revoked document keeps being served from cache. Reaching a document still requires knowing its UUID URL, which is what keeps this MEDIUM rather than HIGH.
- **Remediation**: Make the cache policy folder-aware in the `setHeaders` callback that already exists at `:164-169` — keep `public, max-age=31536000, immutable` for `avatars`/`portfolio`/`reviews`/`messages`/`job-attachments`, and emit `Cache-Control: private, no-store` for `documents`/`selfies`. Better still, exclude those two folders from the static mount entirely and gate them behind the authenticated endpoint from the HIGH finding above.
- **Owner**: backend-engineer
- **Status**: Open

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

### [MEDIUM] SMTP auth failures put the `MAIL_USER` value into application logs — and SMTP is the default provider
- **Category**: CWE-532 Insertion of Sensitive Information into Log File
- **Location**: `JIN_VA-BACKEND/src/mail/providers/smtp-mail.provider.ts:29-37`; log sink at `JIN_VA-BACKEND/src/mail/mail.service.ts:45-50`
- **How found / exploit path**: `SmtpMailProvider.send()` awaits `nodemailer.sendMail()` with no catch and no sanitisation, and `MailService`'s catch logs `getErrorMessage(err)` — the raw `.message` — then re-throws. nodemailer surfaces an SMTP auth rejection as `Invalid login: <verbatim server response>`, and many SMTP servers echo the submitted username in their 535 response. The `MAIL_USER` value can therefore land in the application log. This is exactly the risk class the engineer identified and defended against for the *new* provider — `resend-mail.provider.ts:36-40` says so in as many words ("an SMTP `535` response echoes the username, for instance") — but the mitigation was applied only to Resend, leaving the **default, currently-active** transport unprotected. The behaviour is pre-existing (the pre-round `MailService` logged the same raw message), so BI4 did not introduce it; BI4 preserved it while asserting in the DoD that "No credential value appears in any log", which is not accurate for the default path.
- **Remediation**: Give `SmtpMailProvider.send()` the same discipline as `ResendMailProvider`: catch, log and re-throw using nodemailer's `err.code` / `err.responseCode` only, and never `err.message` or `err.response`. Then either correct or re-qualify the DoD line.
- **Owner**: backend-engineer
- **Status**: Open

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

### [LOW] The documented rationale for `dotfiles: 'ignore'` does not hold, and the option is a no-op
- **Category**: CWE-1078 (inconsistent/incorrect rationale) — no exploitable condition
- **Location**: `JIN_VA-BACKEND/src/uploads/legacy-media.config.ts:153-161`
- **How found**: Verified against the installed libraries rather than the comment. The comment says `'deny'` "reports a 403 by calling `next(err)`", reaching Express's `finalhandler` and an HTML stack trace outside production. With the mount as written, `fallthrough` is not set, so it defaults to `true` (`serve-static@2.2.0/index.js:50`) and `forwardError` starts `false` (`:85`). `send@1.2.0`'s dotfile check runs in `pipe()` at `index.js:458-468`, i.e. **before** the `file` event that would flip `forwardError` (`serve-static/index.js:106-109`). A 403 therefore has `statusCode < 500` with `forwardError === false`, so serve-static takes the plain `next()` branch, not `next(err)` (`:115-118`) — a `'deny'` 403 would fall through to Nest's clean JSON 404 exactly as `'ignore'` does. Separately, `'ignore'` is already `send`'s default (`send/index.js:114-116`), so the explicit option changes no behaviour.
  **Does it trade one leak for another? No.** A 404 reveals strictly less than a 403 (which would confirm existence), so the chosen value is the conservative one and the outcome is safe. This is documentation risk only — but it matters, because the stack-trace path the comment describes *is* real for 5xx-class `send` errors (`!(err.statusCode < 500)` → `next(err)` → `finalhandler` → HTML stack when `NODE_ENV !== 'production'`), and it becomes reachable for 403/404 too the moment someone adds `fallthrough: false` on the strength of this comment.
- **Remediation**: Correct the comment to describe the actual mechanism. If the `finalhandler` concern is to be closed properly, register an Express error handler in front of the static mount so no `send` error can reach `finalhandler`. Also add a dotfile request to `test/legacy-media-serving.e2e-spec.ts` — it currently covers traversal, directory listing and clean-404, but never asserts the dotfile behaviour the comment is entirely about.
- **Owner**: backend-engineer
- **Status**: Open

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
