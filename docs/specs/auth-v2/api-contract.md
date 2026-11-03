# Auth v2: sign-up, email codes, code login, Turnstile

Approved by the owner on 3 Nov 2026. The approved screens and copy are in
`/tmp/claude-1000/-home-chamamme-Desktop-Projects-Xellenet-JIN-VA-BACKEND/9d3179a3-b0f9-4a50-ab44-e38b89399d20/scratchpad/jinva-auth-proposal.html`
(read it: flows, mockups, field table, security design, decisions).

## Decisions

- Verification is by a **6-digit code sent by email**, typed in the page. No SMS.
- **No confirm password.** One password field; the rule is unchanged
  (8–128, upper, lower, digit, one of `! @ # $ % ^ & *`, nothing else).
- **Username is generated** at sign-up and editable in Settings.
- **Gender is not asked at sign-up**; optional in Settings → Account.
- **Signed in automatically** once the sign-up code is accepted.
- **Log in with a password or "Email me a code"**, for every account.
- Forgot password uses a **code**, then a new password, then signed in.
- **Google sign-up asks only for role (chosen before Google) and phone.** No area.
- **Role is fixed** after sign-up. ADMIN is never self-registrable (unchanged).
- **Cloudflare Turnstile** on: register, every code request (sign-up resend,
  login code, forgot password), and password login after repeated failures.

## Codes (backend)

- 6 digits from `crypto.randomInt`, stored only as HMAC-SHA-256 (key from config,
  e.g. derived from an `AUTH_CODE_SECRET`, falling back to an existing server secret
  if unset — document which).
- Purpose-bound: `signup` | `login` | `password_reset`. A code only works for its purpose.
- Expires in 10 minutes; single use; issuing a new code for the same email+purpose
  invalidates the previous one.
- 5 wrong attempts kill the code. Constant-time comparison.
- Resend cooldown 60 s; max 5 codes per email per purpose per hour; per-IP limits on
  request and verify endpoints.
- Never logged, never returned in responses (tests may read the hash path via a test
  hook only; e2e reads the code from the mocked mail transport).

## Endpoints (all under /api/v1)

All request bodies may include `turnstileToken` (string). Responses use the existing
`{ status, message, data, meta }` envelope. Errors carry `meta.error` codes listed.

### POST /auth/register
Body: `{ firstname, middlename?, lastname, email, phoneNumber, password, role: "CUSTOMER" | "ARTISAN", turnstileToken }`
- `username` and `gender` are optional and ignored if absent (old clients that still
  send them keep working; a sent username is validated by the existing rule).
- Creates the account unverified with a generated username, sends a `signup` code.
- 201 `{ data: { email, resendAvailableAt } }` — no session yet.
- If the email already exists: respond exactly as for a new account (201, same shape,
  same timing) and email the existing owner "Someone tried to sign up with your
  address" (no code). Phone-in-use keeps today's explicit 409 (it is already exposed).
- Errors: 400 validation, `TURNSTILE_FAILED` 400, rate limit 429.

### POST /auth/code/verify
Body: `{ email, code, purpose: "signup" | "login" }`
- signup: marks the account verified, starts a session (same cookies/tokens as login).
- login: starts a session (and confirms the email if the account was unverified).
- 200 with **the same body as `POST /auth/login`**:
  `{ access_token, expires_at, message, data: <user> }` (`access_token` top-level),
  plus the same httpOnly cookies. Optional `rememberMe` as on login.
- 400 `CODE_INVALID` (wrong or expired — one message: "That code didn't work. Check it or ask for a new one."), `CODE_ATTEMPTS_EXCEEDED`, 429.

### POST /auth/code/request
Body: `{ email, purpose: "signup" | "login", turnstileToken }`
- Always 200 `{ data: { resendAvailableAt } }`, same shape and timing whether or not
  the account exists / is verified. A login code for an unverified account is
  issued as a **`login`-purpose code** (the email is worded like the sign-up
  one); the client verifies it with `purpose: "login"`, which confirms the
  email and signs in. `password_reset` codes stay usable only by
  `/auth/password/reset` and `/auth/password/reset/check`.
- 429 when the cooldown or hourly cap is hit (still no account disclosure).

### POST /auth/password/forgot
Body: `{ email, turnstileToken }` → always 200 `{ data: { resendAvailableAt } }`; sends a
`password_reset` code if the account exists. The existing link-based reset keeps
working for links already sent.

### POST /auth/password/reset/check
Body: `{ email, code }` → 200 `{ data: { valid: true } }` if the `password_reset`
code is right, **without using it up**; 400 `CODE_INVALID` /
`CODE_ATTEMPTS_EXCEEDED` otherwise. A wrong code counts toward the same 5-try
limit. Per-IP rate-limited like reset.

### POST /auth/password/reset
Body: `{ email, code, newPassword }` → 200, signs in, revokes every other session/refresh
token, records a security event, emails "Your password was changed".

### POST /auth/login (existing)
Unchanged contract, plus: after N (e.g. 3) failed attempts for an email or IP, responds
401 with `meta.error = "TURNSTILE_REQUIRED"` until a valid `turnstileToken` is sent.

### Google (existing complete-signup)
Role is chosen before Google and passed through the existing flow; the completion step
needs only `phoneNumber` (gender and location no longer required). Old clients that
still send them keep working.

### Turnstile
- Backend verifies with `https://challenges.cloudflare.com/turnstile/v0/siteverify`
  using `TURNSTILE_SECRET_KEY`, sending the token and the client IP; checks `success`,
  `hostname` (when `TURNSTILE_EXPECTED_HOSTNAME` is set) and the `action` name.
- If `TURNSTILE_SECRET_KEY` is unset: skip the check and log one startup warning
  (dev/test). Tests use Cloudflare's documented test keys or a mock — never the network
  (test/support/hermetic.ts blocks it).
- Frontend uses `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (a build-time Doppler variable — add it
  to the frontend Docker workflow's list), invisible/managed mode, explicit render, and
  sends the token with the request. If the key is unset, the widget is not rendered.
- Actions: `register`, `code_request`, `forgot`, `login`.

## Usernames
Generated from first + last name only (never email/phone): lower-case, accents folded,
non-allowed characters dropped, `first.last`, then `first.last2`, `first.last3`… on
collision, matching USERNAME_REGEX (3–30, letters/digits/dot/underscore, no leading,
trailing or double dots). Editable in Settings with the existing rule and uniqueness.

## Security events and emails
- Record: signup, code_sent (purpose), code_failed, code_locked, login (method: password
  | code | google), password_reset. Never the code or password.
- "New sign-in to your JinVa account" email on each new sign-in (time, approximate
  device from the user agent), with a "Secure my account" link to forgot password.

## Compatibility
- Old `/auth/verify-email?token=` links keep working until they expire.
- Existing accounts, usernames and genders are untouched.
- The current frontend keeps working against the new backend until the new pages ship
  (old fields accepted, old endpoints kept).

## Backend implementation notes (3 Nov 2026) — deltas from the text above

These are what the backend actually does; where they differ from the text
above, this section wins.

1. **Body shape.** `/api/v1/auth/*` routes are not wrapped by the response
   interceptor (unchanged from today), so success bodies have no
   `status`/`meta`:
   - `register` → 201 `{ message, data: { email, resendAvailableAt } }`
   - `code/request`, `password/forgot` → 200 `{ message, data: { resendAvailableAt } }`
   - `code/verify`, `password/reset` → 200, **exactly the `POST /auth/login`
     body**: `{ access_token, expires_at, message, data: <user> }`, with
     `access_token` at the **top level** (not inside `data`) and the same
     httpOnly refresh/session cookies. That is the one shape; there is no
     `data.access_token`.
   - `password/reset/check` → 200 `{ message, data: { valid: true } }`.
   Errors use the usual envelope (`{ status: "error", message, meta: { error, … } }`).
   `resendAvailableAt` is an ISO timestamp.
2. **`rememberMe`** (optional boolean, as on login) is accepted by
   `code/verify` and `password/reset`.
3. **Per-address 429** (cooldown or hourly cap): `meta.error =
   "AUTH_RATE_LIMIT_EXCEEDED"` (the same code as the per-IP limit),
   `meta.retryAfterSeconds`, and `data.resendAvailableAt`. Identical for
   addresses with and without an account. The hourly cap counts from the first
   send of the window.
4. **Turnstile errors.** 400 `TURNSTILE_FAILED` (missing, rejected, wrong
   action or hostname) on register / code/request / password/forgot.
   **Fail-closed:** 503 `TURNSTILE_UNAVAILABLE` when Cloudflare can't be
   reached (timeout 3 s). On login, a missing *or* failing token after the
   threshold is 401 `TURNSTILE_REQUIRED`. The login threshold is 3 failures
   per email or per IP within 15 minutes; it is only asked when
   `TURNSTILE_SECRET_KEY` is set.
5. **Codes.** `code` must be 6 digits (spaces are stripped; anything else is a
   400 validation error). The 5th wrong try answers `CODE_ATTEMPTS_EXCEEDED`
   (both 400); an address with no account reaches it after the same 5 tries.
   A banned account is sent no code; a valid code for one answers 403
   `ACCOUNT_BANNED`.
6. **Register.** `PHONE_NUMBER_IN_USE` 409 is kept exactly as today (same
   status, message "Phone number already in use" and `meta.error`). The phone check runs first for every request (409
   `PHONE_NUMBER_IN_USE`), so it can't be combined with a known phone to test
   an email. For an existing email whose owner never confirmed it, the owner
   gets a fresh sign-up code instead of the "someone tried" email (same
   response). A `username` an old client sends is kept if free, otherwise a
   generated one is used.
7. **Google complete-signup.** Only `phoneNumber` is required. `role`
   defaults to the role chosen before Google (`suggestedRole`; 400 if neither
   exists), `firstname`/`lastname` default to Google's, and an artisan's
   `serviceIds`, `location` and `hourlyRate` are optional (validated when sent).
8. **Usernames.** A case-insensitive unique index on `lower(username)`
   (migration 1783390000000, re-checked by 1783400000000). Before it is built,
   existing duplicates are renamed deterministically: in each group equal
   ignoring case the lowest id keeps its name and later rows get the smallest
   free number ≥ 2 appended (`ama.mensah` → `ama.mensah2`); the count is
   logged at startup. `PATCH /users/me` with a username another account has,
   in any letter case → 409 `meta.error = "USERNAME_TAKEN"`.
9. **Secret.** `AUTH_CODE_SECRET`; if unset, keys are derived (HKDF) from
   `SESSION_COOKIE_SECRET`, with one startup warning; production refuses to
   start with neither.
10. **Security log names:** `auth.signup`, `auth.code_sent`, `auth.code_failed`,
    `auth.code_locked`, `auth.login` (`details.method`: `password` | `code` |
    `google`), `auth.password_reset`. Failed/locked tries are recorded only when
    the address has an account.
11. **"New sign-in" email** is sent for password, code and Google logins of an
    existing account. It is not sent for the first session after sign-up
    (code or Google) or after a password reset (that sends "Your password was
    changed").
12. **Compatibility gap.** `POST /auth/register` now sends a code, not a
    verification link, and no longer returns the user object. The current
    frontend's "check your email for a link" page won't work for new sign-ups
    until the code screen ships. Links already sent still verify.
