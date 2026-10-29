# Requirements: Fast direct-input sign-up, custom field validation & optional artisan bio

> **Source & re-verification note — 2026-10-19 (revised the same day after the user's decision below, and again
> after the user's round-2 design review — see the round-2 DECISION block)**
> This document turns five asks from the user (2026-10-19) into scoped work. It follows the
> "Complete your account" step that was just built and is **still uncommitted** in both repos:
> `jinva-frontend-web/src/app/auth/complete-signup/page.tsx` →
> `jinva-frontend-web/src/components/auth/complete-signup-form.tsx` (frontend) and
> `src/auth/auth.service.ts` `handleOAuthCallback` / `completeSocialSignup`,
> `src/auth/pending-social-signup.service.ts`, `src/auth/dto/complete-social-signup.dto.ts` (backend).
> **Every statement about current behaviour below was checked against the code on 2026-10-19.** The parts
> about what Google can supply come from Google's official documentation, and each one cites its URL. They
> are kept for the record but no longer drive the design (see the decision below).
> The user asked to **review these requirements and the UI/UX design before anything is implemented**.
> No build starts until the Open Questions marked "before build" are answered.

> **DECISION (user, 2026-10-19): collect phone, location and gender directly from the user — no extra
> Google scopes.** In the user's words: "Let's receive the other data from the users directly so that we
> don't need to wait for that long." The wait being avoided is Google's sensitive-scope verification lead
> time (R2). This overrides the earlier Google-prefill recommendations (asks 2–4):
> - **No** People API, **no** phone/address/gender from Google, **no** "Fill from Google" button, **no**
>   incremental authorisation, **no** Google sensitive-scope verification work. Google stays at the existing
>   `email profile` scopes (name, email, picture — already prefilled today).
> - Phone, location and gender are typed or picked by the user on "Complete your account", made as fast as
>   possible: the Ghana-friendly phone field (Q2 recommendation), a built-in Ghana towns list for location,
>   native browser autofill through the HTML `autocomplete` attribute (`tel`, `address-level2`,
>   `address-level1`, `sex` — fact-check item 9), and sensible defaults (Ghana as the default country). These
>   are the new **DI** ("direct input") criteria.
> - **Unchanged and still in scope:** custom field validation (V1–V8), optional bio and its
>   search-visibility change (B1–B5), and dropping the unused offline access / `prompt=consent` (GP8 — it
>   improves sign-in and needs no verification).
> - GP1–GP7 and GP10 are **DESCOPED** (each marked below with its reason). GP8 and GP9 stay.
> - Open Questions 4, 5 and 7 are **answered by this decision** (moot). Questions 1, 2, 3, 6 and 8 stay open;
>   this document designs to the PM's recommended answers and notes the alternatives.

> **DECISION (user review, 2026-10-19, round 2): answers to the design review.** The user reviewed this
> file, `design-spec.md` and the mockups, and answered the six design choices. The user's words are quoted. Each
> line gives the PM's reading and the criteria that now carry it. Where this block and older text below
> disagree, **this block wins**. Older criteria are kept and marked SUPERSEDED, not deleted, so existing
> references still resolve.
> - **D1 Email.** "the email should be from the google account". Email stays prefilled from Google and
>   read-only. The hint **"The Google account you signed in with." stays** (answers design D3). DI6, DI7.
> - **D2 Location.** "the location should be the two fields with the suggestions showing, use an existing
>   tool if there is one for helping users select that". Location is **two fields, Town or area + Region**,
>   and **both show suggestions as the user types**. The suggestions come from an **existing, maintained
>   service or dataset**, not a list we write by hand. They follow the user's selected country, so they keep
>   working when JinVa expands. This replaces the static Ghana towns list (DI3, re-verification row 16) and
>   the optional Region (DI4). It answers design D4. **LOC1–LOC11**, with the tool choice in "Tool
>   recommendation (round 2)" below.
> - **D3 Gender control.** "The gender should be the normal drop down". Gender uses the **same Radix `Select`
>   as `/signup`** (`signup-form.tsx:301–324`), not tap chips. This replaces design §3.5 and answers design D5.
>   **DI5 (revised)**.
> - **D4 Phone.** "The phone should also be required. And the format of the phone should also be from the
>   country they are from, I am anticipating that we might expand the application in the near future."
>   Phone is **required for every role** on both sign-up paths. A **country picker defaults to Ghana (+233)**.
>   The number is **validated and formatted by that country's rules**, stored in **E.164**, and the backend
>   validates the same way with the same library. The US-style regex goes. This answers Open Question 2 and
>   design D9. **PH1–PH11**.
> - **D5 Gender options.** "There should be only male and female." The options are **Male and Female only**:
>   no "Other" and no "Prefer not to say", on this page **and** on `/signup`. *The PM's ruling (the user asked
>   the PM to decide):* gender is **required** on both forms. Reasons: `/signup` already requires it
>   (`signup-form.tsx:131`), D6 asks the two pages to match, and with "Prefer not to say" removed, a
>   required-here, optional-there split would be the only difference left between them. The backend `Gender`
>   enum **keeps `OTHER`** (`JIN_VA-BACKEND/src/common/types/enums.ts:7–11`, the
>   `users_gender_enum` Postgres type) so existing rows stay valid, but **no endpoint accepts `OTHER` as new
>   input** any more. This answers design D10. **DI5 (revised)**, Q10.
> - **D6 Look and layout.** "Let the design have similar to the signup page." "Complete your account" uses
>   `/signup`'s container, heading, spacing, components, field order and two-column rows
>   (`signup-form.tsx` + `auth-split-layout.tsx`), including **Role as a `Select` next to Gender** in place of
>   the role cards. Design D8's reorder is replaced by signup's order. **LY1–LY7**, Q11.
> - **Still standing from round 1** (not re-opened): no extra Google scopes (DI7); custom inline validation on
>   all 5 auth forms with no native bubbles **and no placeholders** (V1–V8, Q3 and Q8 answered "all 5 auth
>   forms" and "both"); bio optional, and artisans without a bio still listed in search (B1–B5, Q1 answered
>   "yes"); no device geolocation this round (Q6 answered "no"); dropping `access_type=offline` /
>   `prompt=consent` (GP8).
> - **Now answered:** Open Questions 1, 2, 3, 6 and 8, and design decisions D3, D4, D5, D8, D9 and D10.
>   **Still open for the user:** Q9 (which countries the picker offers at launch), plus two PM rulings to
>   confirm: Q10 (gender required) and Q11 (Role as a dropdown).
>   *Update, same day:* the user accepted the recommended answers ("go on") — **Q9: Ghana + the 15 other West
>   African countries in `phone-input.tsx`; Q10: gender required on both forms; Q11: Role as a dropdown.**

> **DECISION (user, 2026-10-19, round 3): no personal data on Photon's server or in the application.**
> "Don't let any of my data's be on the Photon's server nor the application as well." Raised after the round-2
> fact-check put the developer's email address in the User-Agent of 11 test queries to `photon.komoot.io`.
> This is a hard rule for build, test and operation, and it outranks every LOC* criterion below:
> - **PR1 — Nothing personal reaches Photon.** The proxy sends `photon.komoot.io` only the typed place text, the
>   country code and fixed query parameters. No email, name, phone, user ID, session or cookie, and no client
>   IP: the proxy does not forward `X-Forwarded-For`, `Forwarded`, `Referer` or `Cookie`.
> - **PR2 — A generic identity.** The proxy's `User-Agent` is the app name and version only (e.g.
>   `JinVa/1.0 (+https://<public app domain>)`). It is never a person's name or email, hard-coded or from
>   `.env`. If Photon ever requires a contact, use a role mailbox (e.g. a support@ address), never a person's.
> - **PR3 — No personal data in the codebase or test fixtures.** No real person's email, name, phone or account
>   in source, seeds, tests, docs or mockups. Use obviously fictional data on reserved domains
>   (`example.com`, RFC 2606) and the existing seed accounts.
> - **PR4 — Tests never call Photon live.** Unit and e2e tests mock the upstream; nothing in CI, dev scripts or
>   agent verification sends requests to `photon.komoot.io`. Manual checks use only made-up place text.
> - **PR5 — No user data logged around location lookups.** The proxy logs neither the query text nor who made
>   it (consistent with LOC9). Rate limiting keys on IP in memory only and never writes it to logs.
> - **PR6 — Fix the existing plaintext email logs.** `auth.service.ts` logs the full email on social login
>   ("Social login successful for user: …", "User profile retrieved from …", "Generating tokens for social
>   login user: …"), email/password registration logs it too ("Registering User with email …", "User
>   registered with email …"), and `google-auth.strategy.ts` logs "Successfully fetched Google user profile for
>   email: …".
>   Replace each with the user ID or the existing `hashEmailForLog` hash, matching `UsersService`.

---

## Problem statement

A new Google user who arrives at "Complete your account" still has to type their phone number, location
and gender. Name and email are the only fields prefilled today, and that will stay true: getting the rest
from Google would put the release behind Google's verification process (R2), so instead the page must make
typing them **fast**. Today it doesn't. The phone input is `type="text"` with a US `123-456-7890`
placeholder and formatter (`complete-signup-form.tsx:368–379`), so mobile users get a letter keyboard, and
no input sets `autoComplete`, so browsers never offer a saved number or town (fact-check item 9). The
artisan Location is a blank free-text field with only a placeholder ("e.g., East Legon, Accra").

When the user makes a mistake, the form answers in two inconsistent ways. Fields with an HTML `required`
attribute get the browser's own grey bubble ("Please fill out this field"), which can't be styled, follows
the browser's language rather than the page's, and looks different in every browser. Everything else gets
a `toast.error` in the corner, away from the field. Neither one shows the error next to the field that
caused it. The same pattern repeats across the other four auth forms. Dashboard pages mostly have no
`<form>` element, so they never show native bubbles, but they report errors through toasts. The exception is
`user/post-job`, which already shows inline errors (see re-verification row 10).

On top of that, an artisan **must** write a bio before their account can exist. The bio requirement is
also wired into search visibility, so making it optional is a product decision, not just a frontend tweak.
Finally, the phone field accepts only a US-style `XXX-XXX-XXXX` number on a Ghanaian marketplace. That
already blocks real users typing `024 123 4567` or `+233 24 123 4567`, and it would also reject a number a
browser autofills in international form.

## Target role(s)

- **New Google user choosing CUSTOMER**: the country-aware phone field (required, Ghana by default), the
  normal gender dropdown (Male/Female, required), inline JinVa-styled errors, and a page that looks like
  `/signup`.
- **New Google user choosing ARTISAN**: the same, plus Town or area + Region with suggestions (LOC), and **no
  mandatory bio**.
- **Email/password sign-up user (`signup-form.tsx`)**: the same phone field (PH), gender without "Other"
  (DI5), the V treatment and no placeholders (LY4).
- **Existing users / artisans editing their profile**: the phone field on both settings pages (PH11), their
  stored number migrated to E.164 (PH10), and the bio/search-visibility change (B2).
- **Returning Google user (login)**: no longer sees the full consent screen on every sign-in (GP8).
- **admin**: no change. Admins are seeded and never use social sign-up.
- **Backend (no role-facing change)**: GP8, phone normalisation and validation in three DTOs plus the
  migration, the gender validator change, the new `/locations/suggestions` proxy, and the bio completeness
  rule. **No** new Google scopes.

---

## Re-verification results (what is actually true, as of 2026-10-19)

| # | Claim / assumption | Re-verified status | Disposition |
|---|---|---|---|
| 1 | Google currently supplies only name, email, picture | **TRUE.** `src/auth/strategy/google-auth.strategy.ts` requests `scope: 'email profile'` and reads `GOOGLE_USERINFO_URL` (`https://www.googleapis.com/oauth2/v3/userinfo`, `variables.constants.ts:55`). `GoogleUserInfoResponse` has only `email, given_name, family_name, picture, sub`. The userinfo endpoint never returns phone, address or gender. | **Unchanged by design (decision 2026-10-19).** Scope stays `email profile` (DI9). |
| 2 | The auth URL is also requesting offline access | **TRUE.** `access_type: 'offline'` and `prompt: 'consent'` are set (`google-auth.strategy.ts:57–58`), but nothing stores or uses a Google refresh token. Each sign-in shows the full consent screen again. | **Deliverable (small).** GP8. **BACKEND-ONLY.** |
| 3 | Pending signup can't carry phone/location/gender | **TRUE.** `PendingSocialSignup` (`pending-social-signup.service.ts`) holds `email, firstname, lastname, profilePicture, provider, providerId, suggestedRole, createdAt` only. It lives in memory with a 15-min TTL (`VARIABLES.PENDING_SOCIAL_SIGNUP_TTL_MS`). | **No change needed** — phone/location/gender now come from the form submission, not the pending entry (GP4 descoped). |
| 4 | Phone is required and US-format | **TRUE.** `CompleteSocialSignupDto.phoneNumber` is `@IsNotEmpty`, `@MaxLength(12)`, `@Matches(VARIABLES.PHONENUMBER_REGEX)`, where `PHONENUMBER_REGEX = /^\d{3}-\d{3}-\d{4}$/` (`variables.constants.ts:6`). The same regex is used in `users/dto/create-user.dto.ts:83` and `users/dto/update-me.dto.ts:53`. In those two DTOs phone is `@IsOptional`, so the backend requires it only on social completion. The email/password form makes it required on the frontend only. The frontend copies the regex (`complete-signup-form.tsx:40` `PHONE_REGEX`, `signup-form.tsx:88`). Seed data uses `020-000-0001`-style values (`seed.ts:206`). `0241234567` and `+233241234567` are **rejected**. All three DTOs also set `@MaxLength(12)`, and the complete-signup input sets `maxLength={12}`, so a Ghana E.164 number (13 characters) fails on length as well as on format. | ~~Blocking open question (Q2).~~ **Answered round 2 (D4): PH1–PH10.** |
| 5 | A Ghana-aware phone component already exists | **TRUE, but unused.** `src/components/ui/phone-input.tsx` has a country-code picker that includes `+233 Ghana`. Nothing imports it (grep, 2026-10-19). Note: when `countryCode` matches no entry it falls back to `countries[0]`, which is **Benin** (`+229`), so Ghana must be passed explicitly as the default. | Reuse for PH1 (round 2: its country list is replaced by `SUPPORTED_PHONE_COUNTRIES`). |
| 6 | Gender column can hold "not provided" | **TRUE.** `user.entity.ts:57–64`: `gender` is a nullable enum `MALE / FEMALE / OTHER`. A code comment (G5) says "Google never supplies gender", which stays true under the decision. | DI5. No schema change. |
| 7 | Bio is required for an artisan at sign-up | **TRUE.** The DTO's `bio` is `@ValidateIf(isArtisan)` + `@Matches(NOT_BLANK)` + `@MaxLength(1000)`. The frontend `validate()` toasts "Tell customers a little about your work". The textarea has `required`. | **Deliverable.** B1–B5. |
| 8 | Bio gates search visibility | **TRUE.** `computeProfileCompleteness` (`src/artisans/artisans.service.ts:45–56`) requires `bio`, `hourlyRate`, `location`, `services`. `GET /artisans` filters `ap.isProfileComplete = true` (`:367`). The frontend `profile-completeness.tsx` lists `bio` as one of the four required rows ("About you"). | **Collision. Open Question 1.** Optional at sign-up but still required for search would make a new artisan silently invisible. |
| 9 | The customer-facing artisan page invents a bio when empty | **TRUE.** `app/dashboard/user/artisan/[id]/page.tsx:357` renders `artisan.bio \|\| "Professional artisan specializing in … Committed to quality workmanship…"`. Today no searchable artisan can lack a bio, so this text never appears. Once bio is optional, it would show fabricated copy as if the artisan wrote it. | **Deliverable.** B4. **ux-designer** (empty state). |
| 10 | Native browser validation bubbles are in use | **TRUE, auth forms only (corrected 2026-10-19).** No file in `src/` sets `noValidate` (grep). The HTML `required` **attribute** appears only in the 5 auth forms: `signup` (9), `complete-signup` (6), `login` (2), `reset-password` (2), `forgot-password` (1). The word "required" also shows up in 9 other `.tsx` files, but only in comments, labels or toast strings, never as an attribute. Native bubbles also need a `<form>` submit, and only 7 files render `<form>`: the 5 auth forms, `user/post-job` and `user/book/[id]`. `book/[id]` has only an unconstrained `Textarea`, so it can't raise a native bubble. `post-job` can, through `min={today}` on the date and `type="number" min="0"` on both budgets. It already has **inline, touched/submit-gated field errors** (`showError`, `post-job/page.tsx:152–154`), an in-app precedent. Auth custom checks report through `toast.error` (`complete-signup-form.tsx` has 11 calls), not next to the field. | **Deliverable.** V1–V8. **Scope is Open Question 3.** |
| 11 | A field-error primitive already exists | **PARTLY.** `ui/input.tsx:13` already styles `aria-invalid` (destructive border + ring). `ui/form.tsx` (react-hook-form `FormMessage`) and `ui/field.tsx` exist, but **nothing in `src/` imports either** (grep). `post-job` has a hand-rolled inline-error pattern (row 10). | ux-designer specifies the treatment and builds on these. Don't invent a new primitive. |
| 12 | Customer addresses have a structured table | **TRUE, but a poor fit.** `users/entities/address.entity.ts` has non-nullable `street, city, country, zipCode`. Many Ghanaian addresses have no ZIP. The complete-signup form collects **no** customer address today. The artisan `location` is a free-text `string` (`artisan-profile.entity.ts:88`, DTO `@MaxLength(150)`). | DI3/DI4 cover **artisan `location` only**, stored in the existing string. Customer address is out of scope. |
| 13 | OAuth client is in "Testing" mode, accessed through a VS Code dev tunnel | **Per the user; not verifiable from code.** | No longer a blocker: basic `email profile` scopes need no sensitive-scope verification (R2). |
| 14 | No input on the sign-up forms helps the browser or the keyboard | **TRUE (added in revision, 2026-10-19).** The complete-signup phone is `type="text"` with `placeholder="123-456-7890"` and a US `formatPhoneNumber` on change (`complete-signup-form.tsx:368–379`). No auth form sets `autoComplete` (grep). | DI1, DI2, DI4. |
| 15 | Gender is a custom (non-native) control | **TRUE (added in revision).** Gender is a Radix `Select` with a `SelectTrigger` button and `MALE / FEMALE / OTHER` items (`complete-signup-form.tsx:382–398`). Browser autofill fills native `input`/`select`/`textarea` elements, so `autocomplete="sex"` has nothing to attach to as built. | DI5, R9. |
| 16 | A "built-in Ghana towns list" exists | **FALSE (added in revision).** Town names appear only as placeholder or testimonial text (`complete-signup-form.tsx` placeholder, `components/public/landing/testimonials.tsx`); no towns data file exists in `src/` (grep for Kumasi/Tamale/Takoradi/East Legon). | ~~DI3: create a static list.~~ **Superseded round 2 (D2):** no hand-built list. Town suggestions come from Photon (LOC3), and Region from GeoNames data (LOC7). |
| 17 | No phone library is installed in either repo | **FALSE (round 2, 2026-10-19).** Frontend: `react-phone-input-2` `^2.15.1` is in `package.json` and installed, but **nothing in `src/` imports it** (grep). It came in with commit `fab040e`. On npm its last publish was 2022-07-01 (`npm view`). Backend: `class-validator` 0.14.2 depends on `libphonenumber-js` `^1.11.1` (1.12.15 installed), and its `@IsPhoneNumber` calls `libphonenumber-js/max` `parsePhoneNumber` (`node_modules/class-validator/cjs/decorator/string/IsPhoneNumber.js`). It is a **transitive** dependency only; no backend code imports it. | PH8: make `libphonenumber-js` a **direct, pinned** dependency in both repos. Remove the unused `react-phone-input-2`. |
| 18 | libphonenumber-js handles the DI1 inputs and the seed numbers | **TRUE (run 2026-10-19 against the backend's installed 1.12.15, `max` metadata).** With default country GH, `0241234567`, `024 123 4567`, `24 123 4567`, `+233 24 123 4567` and `+2330241234567` all give `+233241234567` (valid, MOBILE, national `024 123 4567`). The seed values `020-000-0001`, `020-111-0001` and `020-222-0005` give `+233200000001`, `+233201110001` and `+233202220005` (all valid). `+234 803 123 4567` gives `+2348031234567`, country NG. `123-456-7890` with GH is **invalid**. `getCountries()` returns 245 countries. **Re-run (fact-check round 2) against the pinned 1.13.15 (`max`): identical results**, plus: national `0` + 9 digits with prefixes 020, 023, 024, 026, 027, 028, 050, 053, 054, 055, 056, 057 and 059 are all valid `MOBILE`; the national significant number is **9 digits**; 8- or 10-digit inputs (`024123456`, `02412345678`) are invalid; `025…` is invalid; landlines `0302 123 456` (Accra) and `0322 123 456` (Kumasi) are valid `FIXED_LINE`; `00233 24 123 4567` gives `+233241234567`; `(024) 123-4567` and `024.123.4567` parse; `+44 7911 123456` parses as country **GG** (Guernsey), not GB, so country detection for a shared calling code follows the number range. | PH2, PH4, PH10. |
| 19 | The seed has `OTHER` genders / only `020-…` phones | **TRUE / TRUE.** `seed.ts` sets only `Gender.MALE` / `Gender.FEMALE` (10 users, lines 204–387) and 10 phones in `020-NNN-NNNN` form (lines 206–388: one `phoneNumber:` literal at 206, nine `phone:` literals at 232–388). `VALIDATION_MESSAGES.GENDER_INVALID` reads "Gender must be either MALE, FEMALE, or OTHER." (`validation-messages.constants.ts:12`). The frontend has no gender field outside the two auth forms (grep; `auth-context.tsx:20` types it as `string`). | D5 is a validator and copy change. No data migration for gender (DI5). |
| 20 | `/auth/register` validates gender and phone | **PARTLY.** `/auth/register` binds `CreateUserDto` (`auth.controller.ts:158`), where `phoneNumber` and `gender` are both `@IsOptional`. The same DTO is reused internally for social creation (`auth.service.ts:1162`) and by `users.controller.ts:92`. So "required" is enforced by the frontend only. | PH6 and DI5 require the **register path** to reject a missing phone or gender. The backend engineer picks the mechanism, for example a `RegisterUserDto` that extends `CreateUserDto`, so the shared DTO's optional fields don't change. |
| 21 | The phone 409 carries a code | **FALSE.** `typeorm-exception.filter.ts:53–54` returns `message: 'Phone number already in use'` with `meta` holding only `timestamp`, `path` and `statusCode`. The frontend reads codes from `meta.error` (`src/lib/api.ts:169–176`, api-contract §3.1). | PH9: add `meta.error: "PHONE_NUMBER_IN_USE"`. |
| 22 | Other screens send a phone number | **TRUE.** `/dashboard/user/settings` (`page.tsx:263`) and `/dashboard/artisan/settings` (`page.tsx:328`) send a raw `phoneNumber` from a plain `Input` to `PATCH /users/me` (`UpdateMeDto`). | PH11: they adopt the same phone field. Otherwise the stricter backend rejects edits with no guidance. |
| 23 | `/signup` layout facts that D6 copies | **TRUE.** Container `space-y-8 bg-background md:rounded-lg md:p-8 p-4 w-full md:w-auto` (`signup-form.tsx:206`), H1 `text-4xl font-bold tracking-tight` (`:208`), form `space-y-6`, two-column rows `grid grid-cols-2 gap-4` (`:218`, `:301`), labels `text-sm text-muted-foreground`, inputs `h-10`. Order: first/last name → username → email → phone → **Gender `Select` + Role `Select` side by side** (`:301–345`) → password → confirm. `/signup` still has placeholders on every input (`:226–385`). The complete-signup page uses **role cards** (`complete-signup-form.tsx:293`) and puts phone and gender on one row. | LY1–LY7. |
| 24 | Ghana's 16 regions are available from a maintained source | **TRUE (downloaded 2026-10-19).** GeoNames `admin1CodesASCII.txt` lists exactly 16 GH entries: Ahafo, Ashanti, Bono, Bono East, Central, Eastern, Greater Accra, North East, Northern, Oti, Savannah, Upper East, Upper West, Volta, Western, Western North. These match the design's list (§3.4). | LOC7. |
| 25 | Which location source actually covers Ghanaian towns and neighbourhoods | **Measured 2026-10-19.** *Photon* (`photon.komoot.io`, `countrycode=GH`, layers city/district/locality, 10 queries): it found all 10 (East Legon, Madina, Nhyiaeso, Santasi, Osu, Spintex, Tafo, Kasoa, Sefwi Wiawso, and partial input "legon"), each with its region ("Greater Accra Region") and, for neighbourhoods, sometimes the parent city ("Nhyiaeso · Kumasi"). Duplicates are told apart by region (Madina in Greater Accra, Bono East and Upper West). *GeoNames `GH.zip`:* 15,997 populated places, mostly villages. "East Legon" exists only as "East Legon Residential Area", "Osu" matches only villages elsewhere, and **Nhyiaeso and Santasi are missing**. *Spot-check of major towns (fact-check round 2, Photon, same parameters, 1 req/s):* Accra, Kumasi, Tamale, Sekondi-Takoradi (also Sekondi and Takoradi separately), Tema, Ho, Cape Coast and Koforidua are each the **first** result with the correct region (Greater Accra, Ashanti, Northern, Western, Greater Accra, Volta, Central, Eastern); partial "kum" → Kumasi first. Noise seen: Koforidua returns four same-name places (Eastern, Central, Ashanti, Bono East), and the `locality` layer also returns facilities ("Takoradi CCGT Power Plant", "Takoradi Flour Mill Limited" placed in Greater Accra). GeoNames `GH.txt` has all 8 major towns as `PPLA`/`PPLC`/`PPL` entries. | LOC3 uses Photon for towns. GeoNames is used for the Region list only (LOC7). |

---

## What Google can actually supply (research, 2026-10-19 — background only)

> **Superseded by the DECISION (user, 2026-10-19).** None of the People API data below is requested. The
> section is kept because it records *why* Google prefill was dropped (verification lead time, the 100-user
> cap, low hit rate) and because its non-Google alternatives (browser `autocomplete`, the Ghana towns list,
> geolocation) are what DI1–DI6 and Q6 now build on.

| Item | How | Scope (Google's own description) | Returned only if… | Format |
|---|---|---|---|---|
| Phone | People API `people.get` on `people/me`, `personFields=phoneNumbers` | `user.phonenumbers.read`: "See and download your personal phone numbers" | the user has added a phone to their Google **profile** (About me / Personal info). Third-party reports say the account-recovery / 2-Step phone is kept separate and is **not** returned. That is anecdotal, so it must be confirmed in the GP prototype. | `value` as typed, plus `canonicalForm`: "the canonicalized ITU-T E.164 form" (e.g. `+233241234567`). `metadata.verified`, `metadata.primary`. |
| Address | same call, `personFields=addresses` | `user.addresses.read`: "View your street addresses" | the user has saved an address on their profile. Rare in practice. | `formattedValue`, `streetAddress`, `city`, `region`, `postalCode`, `country`, `countryCode` (ISO-3166 alpha-2) |
| Gender | same call, `personFields=genders` | `user.gender.read`: "See your gender" | the user has set gender on their profile | `value`: `male`, `female`, `unspecified`, or a custom string; `addressMeAs` (pronouns) |

Sources:
- `people.get`, scopes and `personFields` (400 if omitted; `sources` defaults to PROFILE + CONTACT):
  https://developers.google.com/people/api/rest/v1/people/get
- Field shapes (`canonicalForm`, Address fields, Gender values, `FieldMetadata.verified/primary`):
  https://developers.google.com/people/api/rest/v1/people
- Scope descriptions: https://developers.google.com/identity/protocols/oauth2/scopes
- Phone-from-recovery caveat (third-party, **unverified**):
  https://community.auth0.com/t/phone-number-not-returned-in-user-profile-from-google-oauth/48357

**Verification and consent facts that drive this design:**
- An app requesting sensitive or restricted scopes "probably need[s] to complete the verification process
  unless your app's use qualifies for an exception". Requirements: narrowest scope, a publicly accessible
  homepage, a privacy policy "hosted within the same domain as your application's home page", domains
  verified in Google Search Console, a justification for each sensitive scope, and a demo video uploaded to
  YouTube as Unlisted. Exception: "if your app is in the development, testing, or staging phases,
  verification isn't required."
  https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- **Review time: Google's pages disagree.** The page above says sensitive-scope review "typically takes 3–5
  business days". Google's FAQ says "about 10 business days" for sensitive scopes and 2–3 days for brand
  verification, "not guaranteed". https://support.google.com/cloud/answer/13463817 Plan for **two weeks**
  plus our own time to build the homepage, privacy policy and video.
- An unverified app using sensitive scopes shows users the **"unverified app" warning screen**. It also has
  a **100-new-user cap over the project's whole lifetime**, which "can't be reset", and once it is used up,
  Google sign-in can be disabled. (Same FAQ.)
- In **Testing** status with an external user type, refresh tokens expire after 7 days, **except** when the
  app asks only for basic identity scopes (email, profile, openid).
  https://developers.google.com/identity/protocols/oauth2
- **Granular consent:** "users may not grant your app access to all of them". The app must check which
  scopes were actually granted and degrade gracefully. **Incremental authorisation**
  (`include_granted_scopes=true`) lets the app ask for extra scopes "in context", which Google calls "a
  best user-experience practice". https://developers.google.com/identity/protocols/oauth2/web-server
- **Not confirmed from an official page:** whether each of the three People scopes is labelled "sensitive".
  Google says the Cloud Console's consent-screen configuration shows a *sensitive* indicator per scope. The
  backend engineer must check this in the console (Open Question 5). Every secondary source treats all three
  as sensitive, and this document plans on that basis.

**Non-Google alternatives where Google is weak:**
- **Location (best alternative): browser Geolocation.** It is "available only in secure contexts (HTTPS)"
  (the dev tunnel provides HTTPS), and "users must grant explicit permission via a prompt". The success
  callback gets a `GeolocationPosition` holding `coords` (latitude, longitude, accuracy…) and a
  `timestamp`, with **no address**, so turning it into a place name needs a separate reverse-geocoding service.
  https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
  https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API/Using_the_Geolocation_API
  **JinVa already does this:** `dashboard/user/post-job/page.tsx:118–144` (`handleGetLocation`) calls
  `navigator.geolocation.getCurrentPosition` and then the public Nominatim `/reverse` endpoint directly from
  the browser. A GP10 could reuse it.
  Reverse-geocoding options:
  - **Google Geocoding API**: needs a Maps API key with billing enabled.
  - **OpenStreetMap Nominatim** (public server): "an absolute maximum of 1 request per second", "a valid
    HTTP Referer or User-Agent identifying the application" (a browser call sends a Referer, so a custom
    User-Agent is not strictly required), "Clearly display attribution", "Results must be cached on your
    side", and **no autocomplete** ("you must not implement such a service on the client side using the
    API"). https://operations.osmfoundation.org/policies/nominatim/ The existing `post-job` call shows no
    OSM attribution and does no caching (grep, 2026-10-19). That is an existing compliance gap to fix in any
    reuse.
  Either one adds a third-party processor to the privacy policy.
- **Browser autofill (no consent screen, no API): the HTML `autocomplete` attribute.** MDN: browser
  suggestions "typically … come from past values entered by the user, but they may also come from
  pre-configured values". Relevant tokens: `tel` ("A full telephone number, including the country
  code"), `tel-national`, `address-level2` (city/town/locality), `address-level1` (region) and `sex`.
  None of the complete-signup or signup inputs set `autoComplete` today (grep, 2026-10-19).
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
- **Location (no-permission alternative): a suggestion list of Ghanaian towns/areas** on the free-text
  field, from a static list we ship. No API, no consent, and it works offline.
- **Phone:** apart from browser autofill (`autocomplete="tel"`, above), the web has no other source. The
  practical win is a **Ghana-default phone input** (`+233` preselected, accepts `024…`) with
  `autocomplete="tel"`, and it helps every user, not only Google ones.
- **Gender:** none, and none needed. It is already optional. One tap on a select is cheaper than a consent
  prompt.

---

## Tool recommendation (round 2, 2026-10-19), for D2 (location) and D4 (phone)

All sources were fetched on 2026-10-19. The package versions come from the npm registry (`npm view`) that day.
The coverage figures come from re-verification rows 18 and 25.

### Phone (D4): `libphonenumber-js` 1.13.15 in both repos, driving the existing `ui/phone-input.tsx`

**Pick:** **`libphonenumber-js`, pinned exactly to `1.13.15`** (MIT, npm latest, published 2026-10-08), as a
direct dependency of **both** `jinva-frontend-web` and `JIN_VA-BACKEND`, imported from
**`libphonenumber-js/max`** on both sides. The UI stays the repo's own shadcn-styled
`src/components/ui/phone-input.tsx`, which already uses `cmdk` + `Popover` and matches `/signup` (D6). The
library replaces only its hand-typed list of 16 codes and adds the parsing, validation and formatting.

Why:
- **It is the library both sides effectively use already.** The backend's `class-validator` `@IsPhoneNumber`
  is built on `libphonenumber-js/max` (row 17). Using the same package, version and metadata in the browser
  and in the DTOs means the form and the API cannot disagree about a number (PH8).
- **It is per country by design.** It is "a simpler and smaller rewrite of Google Android's libphonenumber
  library". `parsePhoneNumber(input, defaultCountry)` reads national input such as `024…` for the selected
  country, `.number` gives E.164, `formatNational()` gives the local display, `isValidPhoneNumber()` "validates
  both phone number length and phone number digits", and `getCountries()` / `getCountryCallingCode()` /
  `getExampleNumber()` supply the picker and the helper example for every country. Adding a country is a
  config change, not code (PH1).
  https://gitlab.com/catamphetamine/libphonenumber-js (the canonical repo named by npm's `repository` field;
  the GitHub copy was last pushed 2026-06-18, while npm releases continue roughly every two weeks).
- **Proven on our inputs** (row 18): every DI1 Ghana form and every seed number normalises correctly. A US
  number is rejected.
- **Cost and licence:** free, MIT. **Bundle:** the README's sizes are for the **metadata JSON alone**:
  `min` "about 80 kilobytes", `max` "about 145 kilobytes", `mobile` "about 95 kilobytes". The code adds
  about 65 kB, so `max` is roughly 210 kB minified before compression. Measured on 1.13.15:
  `metadata.max.json` is 157 kB raw and 39 kB gzipped (`min` is 84 kB / 19 kB). We pick `max` because with
  `min`, `isValid()` only validates length, "effectively causing `isValid()` to behave same way as if it was
  `isPossible()`", so it would not catch a wrong prefix. The cost lands on the auth and settings routes only (Next.js splits per route). If it matters, the
  library can build **custom metadata for just the supported countries** (R16).
- **Upkeep:** the README warns that `isValidPhoneNumber()` "could get stale over time and start rejecting
  freshly-assigned phone number ranges". That is why we pin both repos to the same version and bump them
  together on a schedule (R11).

Not chosen:
- **`react-phone-input-2` 2.15.1 (installed, unused).** Last published 2022-07-01. It formats with its own
  masks, not libphonenumber metadata, so its idea of "valid" would differ from the backend's. It also ships
  its own CSS, outside the design tokens. **Remove it from `package.json`.**
- **`react-phone-number-input` 3.4.18** (MIT, published 2026-08-20, same author, built on
  libphonenumber-js). A fair alternative if the engineer would rather not maintain `phone-input.tsx`. We don't
  pick it because restyling it to match `/signup` costs about as much as finishing our own component, which
  already matches.
- **The class-validator regex/`@IsPhoneNumber` on its own.** `@IsPhoneNumber(region)` fails any number whose
  country isn't `region`, and without a region it needs a `+` prefix. Neither normalises. The backend
  therefore uses `libphonenumber-js` directly in a `@Transform` plus a small custom validator (PH7).

**Fallback:** none is needed at runtime, because the library and its metadata are bundled. No network call,
so it works offline. If the metadata doesn't know a newly issued range, that number is rejected until the
next version bump (R11). The error copy tells the user what to enter, and support can confirm by checking
the library's demo.

### Location (D2): Photon via a JinVa backend proxy for Town, and GeoNames data for Region

**Pick, Town or area:** **Photon**, komoot's open-source OpenStreetMap geocoder. Call its public API
(`https://photon.komoot.io/api/`) **only from a new JinVa backend endpoint** (`GET /locations/suggestions`,
LOC10), never from the browser. Pass `countrycode=<selected country>`, `layer=city|district|locality`,
`limit=8` and `lang=en`.

Why:
- **Best coverage of how Ghanaians name places** (row 25): all 10 test queries were found, including the
  Kumasi neighbourhoods GeoNames lacks (Nhyiaeso, Santasi). Partial input works ("legon" → Legon, South
  Legon, East Legon Extension), and every result carries its region, which fills our Region field (LOC4).
- **Type-ahead is allowed.** Photon lists "Typeahead suggestion" as a feature, and its API has `countrycode`
  ("one or more countries, two-letter codes"), `layer`, `limit` and `lang`, so one integration serves every
  country we expand into. Nominatim's policy forbids exactly this ("must not implement such a service on the
  client side", research section).
  https://photon.komoot.io/ · https://github.com/komoot/photon/blob/master/docs/api-v1.md
- **Cost:** free. **Licence:** the software is Apache-2.0 (https://github.com/komoot/photon). The data is
  OpenStreetMap under ODbL: "you are required to … Provide credit to OpenStreetMap by displaying our
  attribution notice" and "Make clear that the data is available under the Open Database License" (the
  linked copyright page does this). The attribution guidelines add "Geocoders that use OpenStreetMap data
  must credit OpenStreetMap", "Applications that incorporate such a geocoder must credit OpenStreetMap", and
  "A group of geocoding results need not maintain attribution attached to the results, as long as it does
  not form a Derivative Database" (LOC9). https://www.openstreetmap.org/copyright ·
  https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- **Rate limit / ToS:** fair use only: "please be fair - extensive usage will be throttled", with "no
  guarantee for the availability" (photon.komoot.io), and on GitHub "Extensive usage will be throttled or
  completely banned". Our load is small: only artisans at sign-up, at least 2 characters, a 250 ms
  debounce and a 24 h cache. That is a handful of upstream calls per sign-up. The proxy makes us a single,
  identifiable, cacheable client (LOC10), and R10 holds the exit plan.
- **Privacy:** the proxy forwards only the typed text and the country code. The user's IP address and
  browser never reach komoot. Name komoot as a processor in the privacy policy.
- **Offline / outage:** no suggestions, and the field silently stays free text (LOC6, LOC8). Free text is
  allowed anyway, by the round-1 decision.

**Pick, Region:** **GeoNames first-level subdivisions** (`admin1CodesASCII.txt`, **CC BY**: "You should give
credit to GeoNames … with a link or another reference"). A build-time script converts it into one small static
JSON file per supported country, committed with its source URL, licence and retrieval date. It is
**lazy-loaded per country**, with no runtime call to GeoNames. Ghana's file holds the 16 regions (row 24).
https://www.geonames.org/export/ · https://download.geonames.org/export/dump/admin1CodesASCII.txt
Why: Region is a **closed list**, so it should be data we control and can check, not a live search. GeoNames
is maintained, covers every country (so expansion means re-running the script), and costs nothing. It's the
same reason the Region list stays usable when Photon is down.

**UI widget (D2 "use an existing tool"):** both comboboxes reuse what the repo already ships: `cmdk`
(`^1.0.4` in `package.json`, 1.0.4 installed; npm latest 1.1.1, MIT) through `ui/command.tsx` +
`ui/popover.tsx`, the shadcn "Combobox" pattern that `ui/phone-input.tsx` already uses. Two adjustments
the engineer must make: Town's results are already filtered by the server, so its `Command` needs
`shouldFilter={false}` (a documented `cmdk` prop) or cmdk will re-filter and hide valid server matches; and
Town must be a real text input that keeps free text (LOC6), not cmdk's search box inside a popover. Region
can use cmdk's built-in filtering over its 16-entry static list.

**Exit plan (no frontend change, because the proxy owns the provider):** (a) self-host Photon (Apache-2.0,
Java 21+; "a planet-wide database requires about 95GB disk space … At least 64GB RAM are recommended". The
README also says GraphHopper publishes weekly Photon database dumps "for the world-wide dataset and for
selected country datasets", so a country-limited instance is possible; size to be measured), or (b) switch
the proxy to a keyed provider (rows below).

Alternatives evaluated:

| Option | Ghana coverage | Licence / terms | Cost | Type-ahead allowed | Multi-country | Verdict |
|---|---|---|---|---|---|---|
| **Photon public API (via proxy)** | All 10 test places, with region (row 25) | Apache-2.0 software; OSM ODbL data, attribution required | Free; fair use, may throttle | **Yes** | `countrycode` param | **Chosen for Town** |
| **GeoNames admin1 (static)** | 16 GH regions exact (row 24) | CC BY, credit GeoNames | Free | n/a (static) | All countries | **Chosen for Region** |
| GeoNames populated places (static, per-country file) | 15,997 places, mostly villages; key neighbourhoods missing (row 25) | CC BY | Free; offline | n/a | All countries | Rejected for Town: noisy and misses neighbourhoods. Kept in mind as an offline fallback list if R10 bites |
| `country-state-city` 3.2.1 (npm latest; last published 2023-09-18) | Measured on 3.2.1 (fact-check round 2): all 16 GH regions; 121 GH cities, including Accra, Kumasi, Tamale, Sekondi-Takoradi, Takoradi, Tema, Ho, Cape Coast, Koforidua and Kasoa, but **no neighbourhoods** (East Legon, Madina, Osu, Legon absent) | **GPL-3.0** (copyleft, a poor fit in a closed-source bundle); `city.json` 8.06 MB raw (17.5 MB unpacked package) | Free | n/a | Yes | Rejected: licence, size, no neighbourhoods, unmaintained for 3 years |
| Google Places Autocomplete (New) | Expected to be strong; not measured | Google Maps Platform ToS, Google attribution, **API key + billing account** | Google's pricing page (fetched 2026-10-19): Places API (New) "Autocomplete Requests" have a 10,000/month free cap, then $2.83 per 1,000 up to 100,000 (lower tiers above); "Autocomplete Session Usage" is listed as unlimited. https://developers.google.com/maps/billing-and-pricing/pricing | Yes | `includedRegionCodes` | Exit-plan option (b) |
| Geoapify Autocomplete | Not measured (OSM-based) | API key; Geoapify's FAQ says the Free plan may be used "for commercial websites, apps, and business projects, including in production", within its quota and with "the required Geoapify and data-source attribution" | Free 3,000 credits/day, up to 5 req/s; paid from $59/month (10,000 credits/day, 12 req/s) (https://www.geoapify.com/pricing) | Yes | Yes | Exit-plan option (b) |
| Nominatim public search | OSM | Policy forbids client-side autocomplete | Free | **No** | — | Rejected (policy) |
| Mapbox Search | Not evaluated this round | Key + account | — | — | — | Not evaluated |

---

## User stories

### Validation (V)
- As **anyone filling a JinVa form**, I want an error to appear next to the field it's about, in JinVa's own
  styling and words, so I don't hunt for a grey browser bubble or a toast in the corner.
- As a **screen-reader user**, I want the error announced and tied to its field, so I know what to fix
  without seeing it.

### Direct input (DI / PH / LOC / LY) — revised for round 2
- As a **new user**, I want the phone field to already be set to my country (Ghana by default), to accept my
  number the way I normally write it, and to tell me in my country's format when it's wrong, so I don't have
  to reformat it for the form. (PH)
- As a **user outside Ghana once JinVa expands**, I want to pick my country and have my number checked by my
  country's rules, not Ghana's or the US's. (PH)
- As a **new user whose browser already knows my number**, I want the browser to offer it when I tap the
  field, so I fill it in one tap. (DI2)
- As a **new artisan**, I want my town or area suggested after a couple of letters, with my region filled in
  for me, and I still want to be able to type a place that isn't suggested. (LOC)
- As a **new user**, I want gender to be a normal dropdown with Male and Female, like on the sign-up page. (DI5)
- As a **new Google user**, I want "Complete your account" to look and behave like the sign-up page I may have
  just come from. (LY)
- As **any new Google user**, I want sign-up to ask Google for nothing beyond my name and email, and I want to
  see that the email shown is the Google account I used. (DI7, D1)

### Google sign-in (GP — kept)
- As a **returning Google user**, I want to sign in without seeing the full consent screen every time.

### Bio (B)
- As a **new artisan**, I want to create my account without writing a bio now, so I can add one later when I
  have time.
- As a **customer**, I never want to read a bio the artisan didn't write.

---

## Acceptance criteria

IDs are stable. `design-spec.md`, `qa-report.md` and `security-report.md` should cite them. Descoped IDs
are kept and marked DESCOPED, not renumbered, so earlier references still resolve.

### V — Custom field validation (scope per Open Question 3; minimum = all 5 auth forms)

**V1 — No native bubbles.** Given any in-scope form, when it is submitted with an empty `required` field or
an invalid `type="email"` / `type="number"` / `min` / `max` / `maxLength` value, then **no** browser-native
validation bubble appears in Chrome (Android + desktop), Safari (iOS) or Firefox. Verify by submitting each
form empty. Implementation hint (non-binding): `noValidate` on the `<form>`, keeping the HTML constraints as
semantics (MDN: `novalidate` "stops the form from showing its own error message bubbles" but "doesn't
disable … the constraint validation API").
https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation

**V2 — Inline, field-attached errors.** Given an invalid field, when the user submits, then a message appears
directly under that field in the ux-designer's specified style. The input carries `aria-invalid="true"` and
`aria-describedby` pointing at the message. Field validation must **not** use `toast.error`. Toasts stay
only for server/network failures that aren't about one field.

**V3 — Focus the first error.** Given several invalid fields, when the user submits, then focus moves to the
first invalid field in visual order, and on mobile it scrolls into view above the keyboard.

**V4 — When errors appear and clear.** Errors appear on submit, then re-validate on change/blur for a field
that has already been flagged. A message clears as soon as its field becomes valid. No error shows on a field
the user has not yet submitted or left (no "red on first keystroke"). The ux-designer may refine this, but
must decide it once for all forms.

**V5 — Server field errors land on the field.** Given the backend returns a 400 or 409 about a specific field
(e.g. the phone-number 409 that keeps the pending entry, per `complete-signup-form.tsx`, which now carries
`meta.error = "PHONE_NUMBER_IN_USE"`, PH9), then the message shows on that field, not as a toast. Non-field errors (expired signup, email-taken banner) keep their
current treatment.

**V6 — Copy.** Every message says what to do in plain JinVa voice ("Enter your phone number"), never raw DTO
text ("phoneNumber should not be empty") and never browser-locale text. The ux-designer owns the copy table.

**V7 — Required vs optional is visible before submit.** Each field visibly signals whether it's optional. The
current "(optional)" suffix convention is acceptable if the designer keeps it. The rule is applied
consistently on every in-scope form.

**V8 — Accessibility.** Error text meets WCAG AA contrast in light **and** dark themes (use the `destructive`
token; no hardcoded red, per the DT rule from `routes-frontend-patterns-backend-infra`). Errors are announced
(`aria-live="polite"` or equivalent), and colour is never the only signal (icon or text too).

### DI — Direct input of phone, location and gender (decision 2026-10-19; revised round 2)

These apply to `complete-signup-form.tsx`. Every PH criterion and DI5 also apply to `signup-form.tsx`. PH11
extends the phone field to the two settings pages.

**DI1 — SUPERSEDED (round 2) by PH1–PH5.** Its Ghana input examples still hold, as PH2's Ghana rows.

**DI2 — Phone autofill (kept).** The national-number input carries `autoComplete="tel-national"`. Given
Chrome (desktop + Android) or Safari (iOS) holds a saved phone, the browser offers it on focus, and accepting
it gives a value that passes PH4 without editing. If the autofilled value is international (`+CC…`), PH3
applies. If the browser offers nothing, the field behaves exactly as PH1–PH5.

**DI3 — SUPERSEDED (round 2) by LOC3–LOC6.** The static, hand-built Ghana towns list is dropped (D2: "use an
existing tool"). The draft list in design §3.4 isn't needed.

**DI4 — SUPERSEDED (round 2) by LOC1, LOC5 and LOC7.** Region is now **required**, a suggestion field, and
filled automatically from the town. The tokens `address-level2` (Town) and `address-level1` (Region) are
kept. R8 still applies.

**DI5 — Gender: the normal dropdown, Male and Female only, required (revised round 2, D3 + D5).**
- **Control:** the same Radix `Select` markup as `/signup` (`signup-form.tsx:302–324`: `SelectTrigger
  id="gender"`, `h-10`), on **both** forms. The round-1 chips, "Other" and "Prefer not to say" are all gone.
- **Options:** exactly two, **Male** (`MALE`) and **Female** (`FEMALE`), in that order. There is **no
  default**. The trigger's empty state reads "Select gender". This is the dropdown's own empty label, not
  an input placeholder, so the no-placeholder rule doesn't apply to it.
- **Required** on both forms (PM ruling, Q10). Submitting with none chosen shows the V-treatment error
  **"Choose your gender"** on the field. `/signup`'s toast (`signup-form.tsx:131–134`) is removed.
- **Backend:**
  - `CompleteSocialSignupDto.gender` becomes required: `@IsNotEmpty` + `@IsIn([MALE, FEMALE])`.
  - The `/auth/register` path rejects a missing gender (row 20; the mechanism is the backend's choice).
  - `CreateUserDto` and `UpdateMeDto` accept only `MALE` / `FEMALE` as **input** (`@IsIn`). `UpdateMeDto`
    stays optional.
  - `GENDER_INVALID` reads "Gender must be either MALE or FEMALE."
  - **The `Gender` enum and the `users_gender_enum` Postgres type keep `OTHER`.** Dropping a Postgres enum
    value means recreating the type, and existing real rows created through `/signup` may hold it. No data
    migration: existing `OTHER` (and `null`) values are left untouched and still read back.
- `autoComplete="sex"` is **not** applied: a Radix trigger is a button, so the browser can't fill it (R9,
  accepted).

**DI6 — Sensible defaults, nothing assumed (revised round 2).** Country = **Ghana** (PH1). Region has no
default unless a town suggestion sets it (LOC4). Gender has no default (DI5). The role default is unchanged
(`suggestedRole` from the pending entry). Hourly rate stays labelled in GH₵. Name is prefilled from Google;
**email is prefilled from Google, read-only, with the helper "The Google account you signed in with."**
(D1). The inputs carry `autoComplete="given-name"`, `"family-name"` and `"email"`.

**DI7 — Nothing extra from Google (kept).** The authorisation URL's `scope` is exactly `email profile`, and no
request goes to the People API. No "Fill from Google" / "From Google" UI is rendered. The D1 email hint is
explicitly allowed: it describes the read-only field and doesn't claim any extra Google data. Google Places
is **not** used (Tool recommendation), so no Google Maps call happens either.

**DI8 — Speed check (revised round 2).** On a 375px phone with no autofill: a new **customer** completes the
page with the phone number (typed), **gender (2 taps: open, pick)** and "Create account". A new **artisan**
needs at most: services, 2–4 letters + 1 tap for Town (which also fills Region), the hourly rate, the phone
and gender. No bio. QA records the tap and keystroke counts. Any further required step is a defect.

### PH — Country-aware phone number (new, round 2, D4)

**PH1 — Country picker, Ghana by default.**
- Built on the existing `ui/phone-input.tsx` (`cmdk` + `Popover`). Its hand-typed 16-entry list is replaced
  by a shared constant, `SUPPORTED_PHONE_COUNTRIES` (ISO 3166-1 alpha-2). The **same list** lives in the
  frontend and the backend.
- Calling codes come from `getCountryCallingCode()` and country names from `Intl.DisplayNames`. Neither is
  typed by hand.
- The launch list is Q9 (recommended: GH + the 15 West African countries the component lists today).
  **Ghana is preselected and pinned first.** The rest are sorted by name and searchable by name or code.
- The component's fallback changes from `countries[0]` (Benin) to GH.
- The component's country value becomes the **ISO alpha-2 code** (`"GH"`), not the calling code. Today its
  `countryCode` prop and its `find` match on `"+233"`, which can't tell apart countries that share a
  calling code (`+1` US/CA, `+44` GB/GG/JE/IM, `+7` RU/KZ) once the list grows.
- The component's default `placeholder = "Phone number"` is removed (Q8 / LY4: no input placeholders).
- The country button has `aria-label="Country code: Ghana +233"` (design §3.3).

**PH2 — Accepted input.** Spaces, dashes, dots and parentheses are ignored. National input is accepted with
or without the trunk `0`, and international input as `+CC…` (`00CC…` is read as `+CC…`). Parsing uses
`parsePhoneNumber(input, selectedCountry)`. Ghana examples (each gives `+233241234567`): `0241234567`,
`024 123 4567`, `24 123 4567`, `+233 24 123 4567`, `+2330241234567`. With Nigeria selected, `0803 123 4567`
gives `+2348031234567` (row 18).

**PH3 — Paste and autofill set the country.** When the input starts with `+CC` (on change, so paste, typing
and autofill behave the same), the picker switches to that country and the field shows the national part.
`+233 +233…` can't happen. If `+CC` isn't in `SUPPORTED_PHONE_COUNTRIES`, the picker doesn't change and
the field shows **"We don't accept numbers from this country yet."** (final copy is the ux-designer's).

**PH4 — Validated by that country's rules.**
- `isValidPhoneNumber(input, selectedCountry)` from `libphonenumber-js/max` checks length and number
  pattern for the country.
- Empty → **"Enter your phone number"**. Invalid → **"Enter a valid {Country} number, like {example}"**.
  `{example}` comes from a small curated per-country map, with
  `getExampleNumber(country, examples).formatNational()` as the fallback. Ghana's curated example is
  `024 123 4567`. The library's own GH example (`examples.mobile.json`, 1.13.15) is `023 123 4567`. That
  is a valid mobile range but a less familiar prefix to most users, which is why a curated map exists.
- The V4 timing applies. Any mobile or fixed-line number the library calls valid is accepted.
- No US regex remains anywhere: `PHONE_REGEX` (`complete-signup-form.tsx:40`), `validatePhone` and
  `formatPhoneNumber` (`signup-form.tsx:86–110`, `complete-signup-form.tsx:70–75`) are deleted.

**PH5 — Formatting and hint.** No reformatting while typing (design §3.3). On blur, a valid number is shown
in `formatNational()` (e.g. `024 123 4567`). The helper text is "We'll use this for booking updates. For
example, {example}." The input is `type="tel"` with `enterKeyHint="next"`. There is **no `maxLength`**: the
current `maxLength={12}` (`signup-form.tsx:296`, `complete-signup-form.tsx:377`) is removed. Length is
enforced by PH4.

**PH6 — Required for everyone.** Phone is required for customers and artisans on complete-signup and on
`/signup`, so the label has no "(optional)". Backend: `CompleteSocialSignupDto.phoneNumber` stays required.
The `/auth/register` path must also reject a missing phone (row 20; today it is `@IsOptional` and only the
frontend enforces it). `UpdateMeDto.phoneNumber` stays optional (omit = unchanged), but when present it must
pass PH7.

**PH7 — One canonical stored form (E.164), validated the same way on the backend.** The frontend submits
`parsePhoneNumber(...).number` (e.g. `+233241234567`). In all three DTOs that use `PHONENUMBER_REGEX`
(`auth/dto/complete-social-signup.dto.ts:63`, `users/dto/create-user.dto.ts:83`,
`users/dto/update-me.dto.ts:53`):
- a `@Transform` normalises defensively. It parses with default country **GH** when there is no `+` and
  outputs `.number`. Unparseable input is left as-is so the validator rejects it.
- a shared custom validator (e.g. `@IsSupportedPhoneNumber()`) checks `isValidPhoneNumber` (`max`) **and**
  that the parsed country is in `SUPPORTED_PHONE_COUNTRIES`.
- `@MaxLength(12)` becomes `@MaxLength(16)`. E.164 allows at most 15 digits, plus the `+`. Its message
  `PHONE_NUMBER_MAX_LENGTH` ("Phone number cannot be more than 12 characters.",
  `validation-messages.constants.ts:11`) changes to match.
- `PHONENUMBER_REGEX` (`variables.constants.ts:6`) is deleted once unused.
- `PHONE_NUMBER_INVALID` becomes "phoneNumber must be a valid phone number for a supported country". That is
  developer text; users see PH4's copy (V6).
- The Swagger examples change from `123-456-7890` to `+233241234567`.

**PH8 — Same library, same version, both repos.** `libphonenumber-js` is a **direct** dependency pinned to
the same exact version (1.13.15 at writing) in `jinva-frontend-web` and `JIN_VA-BACKEND`. The backend no
longer relies on the copy that comes through `class-validator` (row 17). A **shared fixture table** (input,
country → expected E.164 or invalid, covering at least the PH2 rows, `123-456-7890` and an unsupported `+44`
number) runs in both repos' tests, so the two sides can't drift. Both repos bump the version together (R11).

**PH9 — "Number already in use" lands on the field.** `typeorm-exception.filter.ts` adds
`meta.error: "PHONE_NUMBER_IN_USE"` to the `phone_number` 23505 response (row 21). The frontend matches on
that code, falling back to the message, and shows "This number is already used by another JinVa account.
Enter a different number." **on the phone field** (V5). The pending signup entry survives, as today. Because
every stored number is now E.164 (PH10), `024…` and `+233 24…` count as the same number for this check.

**PH10 — Migrate existing numbers and seeds to E.164.**
- A TypeORM migration runs in one transaction. It rewrites each non-null `users.phone_number` to E.164,
  parsing national forms with default GH (`020-000-0001` → `+233200000001`, row 18).
- Rows that don't parse as valid are **left unchanged** and counted in the migration log by user id only, no
  numbers logged. They are not nulled.
- If two rows normalise to the same E.164 value, the migration **aborts** with the colliding user ids, so
  the unique index never fails half-way. `down()` is a documented no-op.
- `seed.ts` (lines 206–388) is changed to E.164 literals. The e2e fixtures (`social-complete-signup.e2e-spec.ts:80–84`,
  `auth-residual-findings.e2e-spec.ts:113–115`) move to E.164 and to PH2 inputs. Their generators must
  produce numbers in **valid** Ghana ranges: today they emit `0NN-…` (e.g. `001-…`) and `02N-…` (e.g.
  `021-…`), which libphonenumber-js rejects for GH, so e.g. `+23324` + 7 unique digits.
- `social-complete-signup.e2e-spec.ts:280` currently asserts that `phoneNumber: '0241234567'` is a **400**.
  Under PH2 that input is valid, so the case flips: it moves to the accepted set (expect E.164 stored), and
  the invalid set gets `123-456-7890` and a too-short number instead.

**PH11 — Same phone field wherever a phone is edited.** `/dashboard/user/settings` and
`/dashboard/artisan/settings` (row 22) use the same phone component. A stored E.164 value loads with the
picker set from the number and the national format shown, and saving submits E.164. Errors follow V2
locally. A full move of the settings forms to V is still the follow-up pass (Q3).

### LOC — Location: two fields with suggestions (new, round 2, D2) — artisans only

**LOC1 — Two required fields.** "Town or area" and "Region", both **required** for artisans. They sit in a
two-column row at `sm:` and above (`grid grid-cols-2 gap-4`, D6) and stack at 375px, Town first. Customers
still see no location field. Errors: "Enter your town or area" and "Choose your region".

**LOC2 — Driven by the selected country.** Both fields use the **country selected in the phone picker**
(PH1); the user's words were "the country they are from". If the country changes, the typed town is kept,
the town suggestions re-query for the new country, and Region is cleared unless the same name exists in
the new country's list. One country choice per user is assumed (R13).

**LOC3 — Town suggestions from Photon, through JinVa.**
- Suggestions open after **2 characters**, debounced about 250 ms, and show up to **8** results from
  `GET /locations/suggestions?q=…&country=GH` (LOC10). They never open on focus or after autofill (R8 rules,
  design §3.4).
- Each row shows the name, then the region in muted text. When Photon gives a parent city, the row reads
  "Nhyiaeso · Kumasi, Ashanti", so same-name places (Madina × 3, row 25) can be told apart.
- The control follows the WAI-ARIA combobox keys and the announcement copy in design §3.4. Enter chooses an
  option and does not submit while the list is open.
- `autoComplete="address-level2"`.

**LOC4 — Choosing a town fills Region.** Choosing a suggestion sets Town to its name, sets Region to the
suggestion's region **matched against the country's Region list** (LOC7), and moves focus on. Matching
ignores case and diacritics, and drops a trailing " Region", " State" or " Province" ("Greater Accra
Region" → "Greater Accra"). With no match, Region is left as it was and never guessed. Region stays
editable.

**LOC5 — Region suggestions.** Region is a combobox over the country's **complete** first-level list
(Ghana: the 16 regions, row 24). It filters from the first typed character and also opens on click or ↓,
because the list is short. It is a **closed list**: the value must be one of its entries. Typed text that
exactly matches one entry (after LOC4's normalisation) is accepted on blur, and anything else shows "Choose
your region". `autoComplete="address-level1"`, and an autofilled value is matched the same way.

**LOC6 — Free text always allowed for Town.** Typed text that matches no suggestion is submitted exactly as
typed and never cleared or "corrected" on blur. With no match, the helper reads "Not on our list? That's
fine — we'll save it as you type it." (design §3.4).

**LOC7 — Region data from GeoNames, shipped static.** A script (e.g. `scripts/generate-regions.mjs`) builds
`regions/{CC}.json` for each `SUPPORTED_PHONE_COUNTRIES` entry from GeoNames `admin1CodesASCII.txt`. The
output is committed with its source URL, the CC BY licence and the retrieval date in the file header, and
loaded per country on demand. There are **no runtime calls to GeoNames**. GeoNames gets a credit on the
site's legal/credits page.

**LOC8 — Graceful when the suggestion service is unavailable.** On an upstream timeout (1.5 s), a 429 or 5xx,
or a client offline, `/locations/suggestions` returns an empty list (200) or the client times out. The Town
field then behaves as LOC6: no error, no toast, nothing blocked. Region (LOC5) still works from its static
file. Sign-up must never fail because Photon is down.

**LOC9 — Attribution and privacy.** Whenever Photon suggestions are on screen, the list's footer reads
"Suggestions © OpenStreetMap contributors", linked to `https://www.openstreetmap.org/copyright`, in
`text-xs text-muted-foreground`. The browser never calls `photon.komoot.io` directly. Only the typed text and
the country code leave JinVa, and the typed text isn't logged. The privacy policy lists komoot (Photon) as a
processor.

**LOC10 — The proxy endpoint (`JIN_VA-BACKEND`).**
- `GET /locations/suggestions?q&country` is public, because the user has no session yet.
- `q` is trimmed, 2–100 characters; `country` must be in `SUPPORTED_PHONE_COUNTRIES`. Anything else gives a
  400.
- A per-IP throttle uses the existing `@nestjs/throttler` (e.g. 30/min).
- An in-memory LRU cache keyed by (country, normalised q) holds results for 24 h.
- The upstream call goes through `@nestjs/axios` (installed) with a 1.5 s timeout and a descriptive
  `User-Agent`, with `layer=city&layer=district&layer=locality&limit=8&lang=en`.
- The response is `[{ name, region, city?, countryCode }]`. Upstream errors are never passed through.
- Unit tests mock Photon. No test calls the public server.

**LOC11 — Stored value unchanged.** The submitted `location` is `"Town, Region"` (e.g. "East Legon, Greater
Accra") into the existing free-text `location` (`@MaxLength(150)`, `artisan-profile.entity.ts:88`). There is
no schema or DTO change, and structured location columns are out of scope (R13).

### LY — Look and layout like `/signup` (new, round 2, D6)

**LY1 — Same frame.** Inside `AuthSplitLayout`: the container is `space-y-8 bg-background md:rounded-lg
md:p-8 p-4 w-full md:w-auto` (`signup-form.tsx:206`) and the H1 is `text-4xl font-bold tracking-tight
text-foreground` (`:208`), with the subtitle in `text-muted-foreground`. The form is `space-y-6`, each field
wrapper `space-y-2`, labels `text-sm text-muted-foreground`, inputs and triggers `h-10 bg-background
border-input text-foreground`, and two-up rows `grid grid-cols-2 gap-4`. Any later change to these
(e.g. design §3.9's mobile padding and heading tweak) is made to **both** pages at once.

**LY2 — Same field order.** Signup's order, minus the fields Google makes unnecessary: First name | Last name
→ Email (read-only, D1 hint) → Phone (full row) → **Gender | Role** (two-up, as `signup-form.tsx:301–345`) →
*artisan only:* Services, Town or area | Region, Hourly rate, then the optional group (bio, years of
experience, business name; design §3.1) → Create account → Cancel. There is no username and no password.

**LY3 — Role is the same `Select` as `/signup`** (`SelectTrigger id="role"`, Customer / Artisan), replacing
the role cards (`complete-signup-form.tsx:293`). It is preselected from `suggestedRole` as today. Choosing
Artisan reveals the artisan fields below without moving the fields above it. (PM ruling for "same layout,
components"; Q11.)

**LY4 — Same components, shared.** Both pages use one phone component (PH), the same `Select` for gender and
role, and the same V error primitive. The round-2 changes go into both pages, so they stay identical:
sentence-case labels ("First name"), V treatment, **no input placeholders** (Q8; this also removes `/signup`'s
`John` / `johndoe` / `example@gmail.com` / password placeholders, row 23).

**LY5 — Artisan block in the same rhythm.** Same `space-y-6` spacing and label style. The services checkbox
box is unchanged. Town | Region is a two-up row like signup's name row.

**LY6 — Responsive.** At 375px, two-up rows stay two-up where signup's do (names, Gender | Role). Town |
Region stacks (LOC1), and so does any row that wouldn't fit. There is no horizontal scroll.

**LY7 — Mockups updated before build.** The ux-designer revises `design-spec.md` and the four mockups for
D1–D6: Select gender (Male/Female, required), Role select, required Region combobox with the attribution
footer, the country-aware phone with an example for a non-Ghana country, and signup's order and spacing. The
round-1 mockups still show chips, role cards and an optional Region, and **must not** be used as the build
reference.

### GP — Google sign-in (prefill criteria descoped by the decision of 2026-10-19)

**GP1 — DESCOPED.** "Fill from Google" with incremental authorisation needs People scopes, which the
decision rules out.

**GP2 — DESCOPED.** Phone from Google needs `user.phonenumbers.read` (sensitive-scope verification). Replaced
by DI1/DI2.

**GP3 — DESCOPED.** Gender from Google needs `user.gender.read`. Replaced by DI5. (Q7 moot.)

**GP4 — DESCOPED.** Location from Google needs `user.addresses.read`. Replaced by DI3/DI4.

**GP5 — DESCOPED.** "From Google" markers only make sense with Google-sourced values; DI7 now forbids them.

**GP6 — DESCOPED.** Data-minimisation rules for People data have no data to govern. The surviving rule is in
DI7 (no new Google data), and the existing logging rule stays: the current `this.logger.log` of the email
stays and no other PII is added to logs.

**GP7 — DESCOPED.** Partial/denied People consent can't happen when no People scope is requested.

**GP8 — Stop asking for offline access (KEPT).** Given nothing stores a Google refresh token, then the authorisation
URL drops `access_type: 'offline'` and `prompt: 'consent'` (use `select_account` if account choice is wanted).
This stops returning users from seeing the consent screen on every sign-in and stops Google issuing refresh
tokens that nobody uses. (Corrected 2026-10-19: Google's 7-day Testing refresh-token expiry depends on the
**scopes** requested, not on `access_type`. Testing apps get "a refresh token expiring in 7 days, unless the
only OAuth scopes requested are a subset of name, email address, and user profile". The base `email profile` login is already exempt.
https://developers.google.com/identity/protocols/oauth2) Needs no Google verification.

**GP9 — Existing users are unaffected (KEPT, as a regression guard).** Given an email that already has an
account, then login behaves exactly as today (`handleOAuthCallback` → `updateSocialLoginInfo`), apart from
GP8's removal of the repeated consent screen.

**GP10 — DESCOPED from Google prefill; device location stays under Open Question 6.** Browser geolocation
is not a Google scope, so the decision doesn't forbid it, but it is not part of this round per the Q6
recommendation (round 2: LOC's Photon suggestions instead; DI3's towns list is superseded). If Q6 is answered "yes", the old wording applies: tap "Use my
current location" → browser prompt → reverse-geocode to "area, city" → prefill (without any "From Google"
marker); on deny/error the field is unchanged with one neutral line; coordinates not stored; OSM attribution
and caching added to the reused `post-job` flow.

### B — Artisan bio optional

**B1 — Sign-up doesn't require a bio.** `CompleteSocialSignupDto.bio` becomes optional for ARTISAN
(`@IsOptional`, keep `@MaxLength(1000)`). An empty or whitespace bio is stored as null, not `""`. The
frontend drops the `required` attribute and the "Tell customers…" check, and labels the field optional.

**B2 — Search visibility follows Open Question 1.** Recommended: remove `bio` from
`computeProfileCompleteness` so an artisan with services + rate + location is searchable at once. Then
recompute `isProfileComplete` for existing profiles (one-off backfill), so artisans already hidden only for
lack of a bio become visible.

**B3 — Bio still encouraged, never blocking.** `profile-completeness.tsx` stops listing bio as *required*.
If the designer keeps it, it appears as a "recommended" nudge visually distinct from required items. The
API's `missingFields` no longer includes `bio`.

**B4 — No fabricated bio.** `app/dashboard/user/artisan/[id]/page.tsx:357` stops showing the invented
"Professional artisan specializing in…" text. An artisan without a bio gets an honest empty state
(ux-designer). Search cards are checked for the same fallback.

**B5 — Same rule everywhere bio is edited.** Already true at field level (verified 2026-10-19):
`CreateArtisanProfileDto.bio` is `@IsOptional` (`users/dto/create-artisan-profile.dto.ts:26–29`, inherited by
`UpdateArtisanProfileDto` via `PartialType`), and the `/dashboard/artisan/profile` bio textarea has no
`required`. Today bio is enforced **only** through `computeProfileCompleteness` / `missingFields`. What
remains is the contract: the `missingFields` documentation (`users/dto/artisan-profile-response.dto.ts:98`
example `['bio', 'hourlyRate']`) and the `PATCH /users/me/artisan-profile` response no longer list `bio`
under B2.

---

## Out of scope

- **Any extra Google scope or Google People API call** (`user.phonenumbers.read`, `user.addresses.read`,
  `user.gender.read`, `user.birthday.read`), a "Fill from Google" step, incremental authorisation, and the
  Google sensitive-scope verification submission. **Decision (user, 2026-10-19).** Revisit only as a new round
  if the user later wants Google prefill and accepts the verification lead time.
- **Google Places, or any geocoder called directly from the browser.** Town suggestions go through JinVa's
  proxy to Photon (LOC3, LOC10). Google Places and Geoapify are exit-plan options only (Tool recommendation).
  *(Round 2: this replaces the round-1 line "A geocoding or places-autocomplete API … DI3 is a static list
  on purpose". D2 asked for an existing tool.)*
- **Nominatim for search or type-ahead.** Its policy forbids it. The existing `post-job` reverse-geocoding
  compliance gap (`post-job/page.tsx:128`: no attribution, no caching) is a **separate ticket**, not this
  round's.
- **Structured location storage** (separate country / region / town columns, coordinates). `location` stays
  one string (LOC11, R13).
- **Customer street addresses or customer location at sign-up.** The `Address` table's non-nullable
  `zipCode` is a poor fit for Ghana.
- **Removing `OTHER` from the `Gender` enum / Postgres type, or migrating existing `OTHER` rows** (DI5).
- **A separate "country of residence" field** apart from the phone country (LOC2, R13).
- **Date of birth / age.** Not asked for.
- **Phone verification by SMS/OTP.** A valid-format number is not a verified number.
- **Browser geolocation for Location (GP10).** Q6 was answered "not this round".
- **Moving the dashboard/settings forms fully to the V treatment.** That's the follow-up pass (Q3). PH11 only
  swaps the phone input there.
- **Storing or refreshing Google tokens**, and re-syncing profile data from Google after sign-up.
- **Any `.env` / `.env.*` file, in either repo.** No agent reads them. No new secret is needed: Photon and
  GeoNames need no key. GP8 is a code change only.

---

## Risks

- **R1 — Conversion drop from extra consent. RETIRED by the decision.** The remaining risk is form length,
  which DI8 bounds. Round 2 adds required gender (2 taps) and required Region, which the town choice usually
  fills.
- **R2 — Google verification lead time and the 100-user cap. AVOIDED — keep as a guardrail.** Any future
  change that adds a Google scope must come back through the PM. DI7 makes the current scope a tested
  criterion.
- **R3 — Autofill yield is browser- and user-dependent.** Autofill is a bonus, never a dependency (PH, LOC,
  DI8).
- **R4 — Towns-list quality. RETIRED (round 2).** There is no hand-built list any more. It is replaced by R10
  and R17.
- **R5 — Phone uniqueness.** `phone_number` is `unique` (`user.entity.ts:48`). A number that already belongs
  to another account hits the 409, which PH9 now codes and V5 shows on the field.
- **R6 — Format migration. Now concrete in PH10.** Mixed formats would let duplicates slip past the unique
  index. PH10 normalises them in one transaction and aborts on a collision.
- **R7 — Bio change surfaces artisans with thin profiles.** Intended. B4's empty state must ship first.
- **R8 — Two suggestion popups on Town (and Region).** The browser's autofill dropdown and JinVa's list can
  open together. Design §3.4's rules apply to both comboboxes. QA checks Chrome Android and Safari iOS.
- **R9 — Custom controls don't autofill.** The gender and role `Select`s and the phone country button are
  buttons, so `sex` autofill never happens (accepted). PH3 sets the country from an autofilled `+CC…`
  number.
- **R10 (new) — Photon public-server availability.** It's fair use with no SLA; komoot may throttle, ban or
  change it.
  Mitigation:
  - the proxy is our single identifiable client, with a 24 h cache, debounce, 2-character minimum and
    per-IP throttle (LOC10);
  - sign-up never depends on it, because free text and the static Region list keep working (LOC6, LOC8);
  - provider swap behind the same endpoint: self-hosted Photon, Google Places (key + billing), or Geoapify
    (key), with no frontend change.
  - *Trigger to act:* sustained upstream 429s or 5xx in the proxy's logs, or artisan sign-ups above roughly
    1,000 a day.
- **R11 (new) — Phone metadata goes stale.** New number ranges are rejected until the library is updated
  (README warning). Mitigation: an exact pin in both repos, a scheduled lockstep bump (e.g. monthly, or with
  Renovate), and PH8's shared fixtures.
- **R12 (new) — Frontend and backend phone rules drift.** One side gets bumped, or one side uses `min`
  metadata. PH8 requires the same version and `max` metadata, plus a shared fixture table in both test
  suites.
- **R13 (new) — Phone country is used as location country, and `location` stores no country.** A diaspora
  artisan with a Nigerian number working in Accra gets Nigerian suggestions (they can still type free text),
  and "East Legon, Greater Accra" won't say "Ghana" once other countries exist. Accepted for this round,
  while only Ghana has artisans. Structured location and a separate country field are out of scope, to
  revisit before the first non-Ghana launch.
- **R14 (new) — Required binary gender.** Some users may not want to answer, and gender isn't needed to
  deliver the service (data minimisation). This is the user's decision (D5). It is noted for the privacy
  policy, and Q10 confirms "required".
- **R15 (new) — Migration edge cases.** Unparseable legacy numbers stay as they are and are reported. A
  collision aborts the migration before any write. A pre-production dry run on a copy of real data (if any)
  is required by DoD.
- **R16 (new) — Bundle size.** `max` metadata is ~145 kB (README; 157 kB raw / 39 kB gzipped measured), plus
  ~65 kB of library code, on the auth and settings routes. If Lighthouse on
  `/signup` regresses noticeably, generate custom metadata for `SUPPORTED_PHONE_COUNTRIES` only.
- **R17 (new) — OSM data quality.** Spelling variants and same-name places (Madina × 3, Koforidua × 4) exist,
  and the `locality` layer also returns facilities (power plants, a flour mill, one placed in the wrong
  region; row 25). Consider filtering those out in the proxy, by `osm_key`/`type`, once real queries are seen. Mitigation:
  the region shows in every row (LOC3), free text is allowed (LOC6), and Region stays editable (LOC4). Fixes
  go upstream to OpenStreetMap.

---

## Recommendation for each of the user's asks (revised after round 2)

1. **No default validation message → V1–V8 on all 5 auth forms now** (Q3 answered). Unchanged.
2. **Phone → required for everyone, country-aware, stored in E.164 (PH1–PH11)**, using `libphonenumber-js`
   1.13.15 in both repos on top of the existing `phone-input.tsx`.
3. **Location → two required fields with suggestions (LOC1–LOC11).** Town uses Photon through a JinVa proxy.
   Region uses a static GeoNames list. Free text stays allowed for Town.
4. **Gender → the signup `Select`, Male and Female only, required on both forms (DI5).** The enum keeps `OTHER`
   for existing data.
5. **Bio not required → B1–B5, and artisans without a bio stay searchable** (Q1 answered). Unchanged.
6. **Look → mirror `/signup` (LY1–LY7)**, including Role as a dropdown beside Gender.

Plus **GP8** (drop `offline` / `prompt=consent`), unchanged.

---

## Open questions

After round 2, **only Q9 must be answered before build**. Q10 and Q11 are PM rulings the build follows unless
the user overrides them. Every other question is answered.

1. ~~**Bio vs search visibility.**~~ **ANSWERED (user, round 1 standing, confirmed 2026-10-19 round 2):**
   yes. Artisans without a bio stay in search. B2–B4 as written.
2. ~~**Phone format and storage.**~~ **ANSWERED (user, round 2, D4):** required for everyone, validated per
   the selected country, stored as E.164, the same rules on the backend. PH1–PH11.
3. ~~**Validation scope.**~~ **ANSWERED (user, round 1):** all 5 auth forms now. Dashboard forms follow in a
   later pass.
4. ~~**Ask for Google data up front or incrementally?**~~ **ANSWERED (round 1):** neither. Moot.
5. ~~**Google verification.**~~ **ANSWERED (round 1):** not needed with `email profile` only.
6. ~~**Browser geolocation for artisan location (GP10)?**~~ **ANSWERED (user, round 1):** not this round.
7. ~~**Gender from Google?**~~ **ANSWERED (round 1):** no.
8. ~~**Bubbles, placeholders or both?**~~ **ANSWERED (user, round 1):** both. No native bubbles, no input
   placeholders (LY4 extends this to `/signup`).
9. **Before build — which countries does the phone picker offer at launch?** This list
   (`SUPPORTED_PHONE_COUNTRIES`) also decides which countries the backend accepts and which Region lists are
   generated.
   *Recommendation:* **Ghana (default, pinned) plus the 15 other West African countries `phone-input.tsx`
   lists today** (BJ, BF, CV, CI, GM, GN, GW, LR, ML, MR, NE, NG, SN, SL, TG). That keeps today's picker
   contents, lets regional customers sign up, and adding a country later is a one-line config change in each
   repo.
   *Alternatives:* **Ghana only.** The picker is still shown, so it's ready for expansion, but every non-Ghana
   number is rejected (PH3 copy). **All 245 countries.** This allows diaspora numbers, but it widens what we
   accept before any market exists, and Region files would be generated for all of them.
10. **Confirm — gender required?** *PM ruling:* **required** on both forms (D5 reasoning in the round-2
    decision block). *Alternative:* optional on both. The `Select` simply starts empty and may be left so,
    with label "Gender (optional)", and DI8 drops 2 taps.
11. **Confirm — Role as a dropdown next to Gender, like `/signup`?** *PM ruling:* **yes** (D6 "similar to the
    signup page"; LY3). *Alternative:* keep the two role cards. They are more visible and need one tap
    instead of two, but they differ from `/signup`.

---

## Hand-off notes

**ux-designer (revise before build, LY7):**
- **`design-spec.md` + mockups for round 2.**
  - §3.1 order and frame per LY1–LY2.
  - §3.3 phone per PH1–PH5: the country list UI, per-country helper example, the "not accepted yet" error,
    and an example with a non-Ghana country.
  - §3.4 per LOC1–LOC9: Region becomes a **required combobox**; the town row is "name · city, region"; the
    OSM attribution footer; behaviour when the service is down.
  - §3.5 replaced by DI5: the `Select`, Male/Female, required, "Choose your gender".
  - Role `Select` per LY3.
  - The copy table §6 updated (PH4, PH9, LOC1, LOC5, DI5).
- The decisions list §10: mark D3, D4, D5, D8, D9 and D10 answered by round 2.
- `/signup` gets the same treatment (LY4: no placeholders, sentence case, the shared phone field, gender
  without "Other").
- The DI8 walk-through redone for the new counts.

**Backend (`JIN_VA-BACKEND`, no design):**
- **PH6–PH10:**
  - add `libphonenumber-js` as a direct dependency pinned to `1.13.15`;
  - a shared `SUPPORTED_PHONE_COUNTRIES` constant;
  - a `@Transform` normaliser and a custom validator in `complete-social-signup.dto.ts`, `create-user.dto.ts`
    and `update-me.dto.ts`;
  - `@MaxLength(12)` → `16`;
  - delete `PHONENUMBER_REGEX`;
  - updated messages and Swagger examples;
  - the register path requires phone (and gender, DI5);
  - the TypeORM migration to E.164 with collision abort;
  - `seed.ts` and the e2e fixtures in E.164;
  - the shared fixture table.
- **PH9:** `meta.error: "PHONE_NUMBER_IN_USE"` in `typeorm-exception.filter.ts`.
- **DI5:**
  - `CompleteSocialSignupDto.gender` required + `@IsIn([MALE, FEMALE])`;
  - `@IsIn([MALE, FEMALE])` on create-user and update-me input;
  - `GENDER_INVALID` copy;
  - the `Gender` enum and Postgres type unchanged.
- **LOC10:** the new `GET /locations/suggestions` module: validation, throttle, LRU cache, axios with a
  timeout and User-Agent, mapping from Photon's `name/city/state/countrycode`, and tests with Photon mocked.
- **GP8, GP9, B1/B2/B5:** unchanged from round 1. `location` needs no change (LOC11).

**Frontend engineer (after the design revision):**
- **Phone:** finish `ui/phone-input.tsx` per PH1–PH5 and design §3.3: forward `id`/`aria-*`/`autoComplete`,
  make the fallback GH, key the country by ISO code, drop the default placeholder, and replace the
  hard-coded list.
  - Use it on complete-signup, `/signup` and both settings pages (PH11).
  - Add `libphonenumber-js` pinned to `1.13.15` and remove `react-phone-input-2`.
  - Delete the US regex and formatters.
- **Location:** a `location-field.tsx` with Town and Region comboboxes on the existing `cmdk`/`Popover`
  primitives or a plain WAI-ARIA combobox (LOC3–LOC6), plus the region-data script and JSON files (LOC7).
- **Gender:** the DI5 `Select` on both forms.
- **Layout:** LY1–LY6.
- **V and B items:** V on all 5 auth forms; B4 copy removal.

**Privacy policy owner:** add komoot (Photon) as a processor of typed location text (LOC9), and credit
OpenStreetMap (ODbL) and GeoNames (CC BY) on the credits page.

---

## Definition of Done

**Scoping**
- [x] Open Questions 1, 2, 3, 4, 5, 6, 7 and 8 answered and recorded (rounds 1 and 2).
- [ ] Q9 (launch country list) answered. Q10 and Q11 confirmed, or the PM rulings accepted.
- [ ] `design-spec.md` and the mockups revised for round 2 (LY7) and approved by the user.

**Validation**
- [ ] V1: QA submits every in-scope form empty in Chrome Android, Safari iOS and Firefox, and sees zero native
      bubbles.
- [ ] V2–V8 pass. No `toast.error` remains for a single-field validation on in-scope forms, and dark-mode
      contrast is checked.

**Phone (PH)**
- [ ] PH1: Ghana is preselected and pinned. The picker lists exactly `SUPPORTED_PHONE_COUNTRIES`, and no
      code path falls back to Benin.
- [ ] PH2–PH5: each PH2 Ghana input and the Nigeria example submit the expected E.164. `123-456-7890` and
      a short number show the per-country error. A pasted `+233…` doesn't double the code, and an
      unsupported `+44…` shows the "not accepted yet" message. A number keypad shows on mobile, and no
      `maxLength={12}` remains.
- [ ] PH6: an empty phone is blocked on both forms for both roles. `POST /auth/register` without a phone
      returns 400.
- [ ] PH7/PH8: the three DTOs accept the PH2 inputs and store E.164. `PHONENUMBER_REGEX` is gone (grep).
      Both repos pin the same `libphonenumber-js` version, and the shared fixture table passes in both test
      suites.
- [ ] PH9: a duplicate number (entered as `024…` against a stored `+233…`) returns 409 with
      `meta.error = PHONE_NUMBER_IN_USE` and shows on the phone field. The pending entry survives.
- [ ] PH10: the migration dry run on a copy of the data reports converted, unparseable and collision
      counts. It applies cleanly to a seeded database, and the seed holds only E.164 numbers.
- [ ] PH11: both settings pages load a stored E.164 number in national format and save E.164.

**Location (LOC)**
- [ ] LOC1/LOC5: an artisan can't submit without Town and a Region from the list. A customer sees neither.
- [ ] LOC3/LOC4: typing "legon" with Ghana selected shows Legon/East Legon rows with their region. Choosing
      "Nhyiaeso" fills Region "Ashanti". Keyboard-only use works and is announced.
- [ ] LOC6/LOC8: with Photon blocked (proxy pointed at an unreachable host) or the network off, sign-up
      still completes with a free-text town. No error or toast appears.
- [ ] LOC7: `regions/GH.json` has the 16 regions, with source, licence and date in the header.
- [ ] LOC9: the attribution footer shows with the suggestions. In the browser network tab, no request goes to
      `photon.komoot.io`.
- [ ] LOC10: the endpoint returns 400 for a 1-character `q` or an unsupported country, throttles at the set
      rate, serves a repeat query from the cache, and the unit tests use no real network.

**Gender, layout, Google**
- [ ] DI5: both forms show a `Select` with exactly Male and Female. Empty submit shows "Choose your gender".
      The API rejects `OTHER` on create-user, update-me and complete-social-signup, and existing `OTHER`
      rows still load.
- [ ] LY1–LY6: a side-by-side review of `/signup` and complete-signup at 375px and 1440px, in light and dark,
      shows the same frame, spacing, label style, order and components. Role is a `Select`, and no input
      placeholders remain on either page.
- [ ] DI6/DI7: email is read-only with the D1 hint, and the `autoComplete` tokens are present. The scope is
      exactly `email profile`, with no `people.googleapis.com` and no Google Maps calls.
- [ ] DI8: customer and artisan step counts recorded at 375px and meeting the criterion.
- [ ] GP8/GP9: no `access_type=offline` and no `prompt=consent`; existing-user Google login otherwise
      unchanged.
- [ ] No Google PII or tokens appear in backend logs beyond the existing email line, and no typed location
      text is logged (security review).

**Bio**
- [ ] An artisan created without a bio can sign up, is searchable, and shows the designed empty state. No
      fabricated bio text remains.
- [ ] The backfill recomputes `isProfileComplete`, and the count of newly visible artisans is reported.

**Regression**
- [ ] The existing auth e2e suites (`test/social-complete-signup.e2e-spec.ts`,
      `test/auth-residual-findings.e2e-spec.ts`) pass, updated for E.164, required gender and the bio rule.

---

## Fact-check log — 2026-10-19

An independent fact-check against the code in both repos and against Google's and MDN's official pages. None
of the PM's recommendations were reversed. Where a recommendation's supporting facts were wrong, the facts
were corrected and the change is flagged below.

**Corrected (factual errors)**
1. **Row 10 + Q3: native `required` was over-counted.** The HTML `required` attribute appears only in the 5
   auth forms. The other 9 files the grep found contain "required" in comments, labels or toasts. Only 7 files
   render a `<form>`, and outside auth only `user/post-job` can raise a native bubble (`min` on the date and
   budgets). `post-job` already has inline errors. Q3's follow-up scope was reworded to match, and **the
   recommendation itself (auth forms now, the rest later) is unchanged.** The problem statement was adjusted
   the same way.
2. **Row 11:** `ui/form.tsx` and `ui/field.tsx` are imported **nowhere** in `src/`, not just "by no auth form".
   Added `post-job` as the existing inline-error precedent.
3. **Row 4 + Q2:** the `signup-form.tsx` regex is at line 88, not 90. Added two missing facts. First, all
   three DTOs and the complete-signup input cap phone at 12 characters, so E.164 `+233…` (13 characters) also
   fails on length. Second, `CreateUserDto`/`UpdateMeDto` phone is `@IsOptional`, so "required matches today"
   is true only of complete-signup and the email/password form's frontend check. Q2 now says to raise the
   length caps.
4. **GP8 rationale:** the 7-day Testing refresh-token rule depends on the scopes requested, not on
   `access_type=offline` (Google: "…expiring in 7 days, unless the only OAuth scopes requested are a subset of
   name, email address, and user profile"). The recommendation to drop `offline`/`consent` stands, now with
   the correct reasons: an unused refresh token, and a consent screen on every login.
5. **B5:** bio is already optional in `CreateArtisanProfileDto`/`UpdateArtisanProfileDto` and not
   `required` on `/dashboard/artisan/profile`. It is enforced only through
   `computeProfileCompleteness`/`missingFields`. B5 now names what is actually left (the `missingFields`
   contract and docs example).
6. **Verification quote:** the quote "will probably need verification before its first public release" is
   not on Google's page. It was replaced with the page's real wording, plus the Testing-phase exception and
   the Unlisted-YouTube and same-domain privacy-policy requirements.
7. **Geolocation quote:** the quote "To get a human-readable address, you would need a separate
   reverse-geocoding service" is not on MDN's Geolocation pages. It was replaced with MDN's real wording
   (secure context, explicit permission, a `GeolocationPosition` with coords + timestamp).
8. **Nominatim:** the policy needs "a valid HTTP Referer **or** User-Agent", not specifically a custom
   User-Agent. Added its caching requirement.
9. **"There is no real alternative source on the web" for phone was wrong.** Browser autofill through the
   HTML `autocomplete` attribute (`tel`, `address-level2`, `address-level1`, `sex`) needs no consent screen
   and no API. No sign-up input sets `autoComplete` today. It was added as an alternative.
   **Flag for the PM/ux-designer:** this strengthens recommendations 2–4 (cheap prefill without People
   scopes) but doesn't overturn them.

**Added (missing facts that affect recommendations)**
10. **`post-job` already ships geolocation → Nominatim reverse geocoding** from the browser
    (`post-job/page.tsx:118–144`), with no OSM attribution and no caching. That is an existing policy gap. Q6
    now notes that GP10's build cost is lower than stated. **The recommendation is unchanged.**
11. **GP2:** `ui/phone-input.tsx` has only 16 West African codes, so a non-West-African Google number can't
    be shown until the list grows.

**Contradictions resolved / clarified**
12. **Required phone vs an empty Google phone (GP7):** GP7's "no blocking" now explicitly means Google adds
    no blocking condition. Phone keeps its own Q2 rule and normal V2 error. GP7 also notes that the full-page
    re-authorisation loses React state, so "typed values survive" needs explicit persistence to be testable.
13. **Bio optional vs `computeProfileCompleteness`:** checked. B1 alone, without B2, would hide new artisans
    from search, because `GET /artisans` filters on `isProfileComplete = true` (`artisans.service.ts:367`).
    The document already makes B2 depend on Q1 and lists Q1 as "before build", and DoD says "searchable per
    Q1". No silent contradiction remains, **provided B1 and B2 ship together.** If Q1 is answered "no", the
    PM must add a post-signup "you're hidden until you add a bio" criterion, which is not written yet.

**Verified as stated (no change)**
- Scope `email profile`, the userinfo endpoint (`variables.constants.ts:55`) and the
  `GoogleUserInfoResponse` fields; `access_type: 'offline'` + `prompt: 'consent'`.
- The `PendingSocialSignup` fields and the 15-minute TTL; the complete-social-signup DTO's bio/phone
  validators; `PHONENUMBER_REGEX` (`variables.constants.ts:6`) and its uses at `create-user.dto.ts:83` and
  `update-me.dto.ts:53`; seed phones `020-…` (`seed.ts:206`).
- `user.entity.ts:48` (phone unique) and `:57–64` (nullable gender, the G5 comment);
  `computeProfileCompleteness` (`artisans.service.ts:45`) and the `:367` filter; `profile-completeness.tsx`
  bio row "About you"; the fabricated bio at `user/artisan/[id]/page.tsx:357` (no other `.bio` fallback in
  search cards); `address.entity.ts` non-nullable `zipCode`; artisan `location` at
  `artisan-profile.entity.ts:88`, DTO `@MaxLength(150)`; the `aria-invalid` styling in `ui/input.tsx:13`;
  `ui/phone-input.tsx` unused, with `+233`.
- Google: People `people.get` (`personFields` required, 400 if omitted; default sources PROFILE +
  CONTACT; `people/me`); `canonicalForm` as E.164; the Address fields; Gender values
  `male`/`female`/`unspecified`/custom and `addressMeAs`; `FieldMetadata.primary/verified`; the scope
  descriptions as quoted; the FAQ's 10 vs 3–5 business days, brand verification 2–3 days, and the lifetime,
  non-resettable 100-user cap that can disable Google sign-in; granular consent and
  `include_granted_scopes`; `prompt` values; MDN `novalidate`.
- **Still unconfirmed officially:** whether the three People scopes are classified "sensitive". No Google
  page lists their classification, and Google points to the console's Data Access page. Open Question 5
  stays open. The Auth0 recovery-phone report remains third-party and unverified, as the document says.

**Observation (not changed; for the PM)**
- `/dashboard/artisan/profile` sends `bio: bio || undefined` (`page.tsx:301`), so an artisan can't clear an
  existing bio. Once bio is optional, decide whether clearing it should be possible (B5).

**Revision — 2026-10-19 (after the user's decision)**
- Revised for the DECISION (user, 2026-10-19) to collect phone, location and gender directly: GP1–GP7 and GP10 marked DESCOPED, GP8/GP9 kept, DI1–DI8 added, re-verification rows 1, 3, 6, 12, 13 re-dispositioned and rows 14–16 added (`type="text"` US phone input with no `autoComplete`; Radix gender `Select` can't be autofilled; no towns list exists in `src/`; `phone-input.tsx` falls back to Benin), Risks/Out of scope/Open questions (Q4, Q5, Q7 answered)/Hand-off/DoD rewritten. Fact-check items 1–13 above are unchanged; item 9 is now the basis of DI2/DI4/DI5. The "Open Question 5 stays open" note above is historical: Q5 is now moot, and the unconfirmed "sensitive" classification no longer matters for this round.

**Revision — 2026-10-19, round 2 (after the user's design review)**

What changed:
- Added the DECISION (round 2) block (D1–D6), re-verification rows 17–25 and the "Tool recommendation
  (round 2)" section.
- Criteria:
  - DI1, DI3 and DI4 marked SUPERSEDED. DI5, DI6 and DI8 revised. DI2 and DI7 kept.
  - New criteria PH1–PH11, LOC1–LOC11 and LY1–LY7. V5 now cites the PH9 code.
- Rewrote Target roles, the DI user stories, Out of scope, Risks (R4 retired, R10–R17 added), the
  Recommendations, Open Questions (1, 2, 3, 6 and 8 answered; Q9 open; Q10 and Q11 PM rulings),
  Hand-off and DoD.
- Dispositions of rows 4, 5 and 16 updated.

How the facts were checked:
- **Code (2026-10-19):**
  - `signup-form.tsx` (all of it), `complete-signup-form.tsx` (lines 1–80, 280–470), `ui/phone-input.tsx`
    and `package.json`;
  - backend `enums.ts`, the three phone DTOs, `typeorm-exception.filter.ts`, `seed.ts`, `user.entity.ts`,
    `main.ts` (`ValidationPipe` `transform: true`), and class-validator's `IsPhoneNumber.js`;
  - the settings pages' phone payloads.
- **Run locally:**
  - libphonenumber-js 1.12.15 parse results (row 18);
  - the GeoNames `admin1CodesASCII.txt` and `GH.zip` contents (rows 24–25);
  - 10 Photon queries, at 1 request/s with a descriptive User-Agent (row 25).
- **Web, official pages:** libphonenumber-js README, photon.komoot.io, komoot/photon README + `docs/api-v1.md`,
  OSM copyright + OSMF attribution guidelines, GeoNames export page, the country-state-city README, Geoapify
  pricing, and the npm registry. ~~The Google Places pricing figures come from search results quoting
  Google's pricing page and weren't fetched directly.~~ *Fetched directly in fact-check round 2 and
  confirmed (see below).*
- **No `.env` file was read.**

---

## Fact-check log — round 2 (2026-10-19)

This was an independent check of the round-2 revision. It covers the code in both repos, the npm registry,
the downloaded package tarballs (`libphonenumber-js` 1.13.15, `country-state-city` 3.2.1), the GeoNames
dumps, live Photon queries (1 req/s), and the official policy and pricing pages. **No recommendation was
reversed.** Photon (Town), GeoNames admin1 (Region), `libphonenumber-js` `max` (phone), the existing
`cmdk`/`Popover` combobox and the PM rulings all stand. The errors below were fixed in place.

**Corrected (factual errors)**
1. **Row 19, seed counts:** `seed.ts` has **10** phone literals, not 11 (`phoneNumber:` at 206, plus nine
   `phone:` entries at 232–388). The genders run from lines 204 to **387**, not 372.
2. **Phone bundle size (Tool recommendation, R16):** the README's 80 / 145 / 95 kB figures are the **metadata
   JSON sizes alone**, not the bundle. The library code adds ~65 kB. Measured on 1.13.15:
   `metadata.max.json` is 157 kB raw / 39 kB gzipped, and `metadata.min.json` is 84 kB / 19 kB. The `min`
   quote was replaced with the README's own wording (with `min`, `isValid()` behaves "as if it was
   `isPossible()`").
3. **libphonenumber-js source link:** the canonical repo is **GitLab** (`gitlab.com/catamphetamine/libphonenumber-js`,
   per npm's `repository`). The cited GitHub repo was last pushed 2026-06-18, while npm publishes about
   every two weeks (1.13.10 to 1.13.15, July to October 2026).
4. **`country-state-city`:** the latest version is **3.2.1**, not 3.2.0. It was last published 2023-09-18. Its
   coverage was "Not measured" and is now measured: 16 GH regions and 121 GH cities, with all 8 spot-check
   towns present but **no neighbourhoods**. `city.json` is 8.06 MB raw. The licence GPL-3.0 is confirmed.
   It is still rejected, now for four reasons (licence, size, no neighbourhoods, stale).
5. **OSM attribution quote:** "need not keep attribution with each result" is not on the OSMF page. It was
   replaced with the real text: "A group of geocoding results need not maintain attribution attached to the
   results, as long as it does not form a Derivative Database". Two missing quotes were added: "Applications
   that incorporate such a geocoder must credit OpenStreetMap", and the copyright page's second duty,
   "Make clear that the data is available under the Open Database License". The LOC9 link to `/copyright`
   satisfies that duty.
6. **Geoapify:** "Limited Commercial Use" is not on the pricing page. Geoapify's FAQ says the Free plan may
   be used for commercial production use, within quota and with attribution. Added the $59 tier's limits
   (10,000 credits/day, 12 req/s).
7. **Google Places pricing** was quoted from search results and is now **fetched directly** from Google's
   pricing page. It is confirmed: 10,000/month free, then $2.83 per 1,000 up to 100,000, and "Autocomplete
   Session Usage" is unlimited. The round-2 revision note was amended.
8. **PH4, the "unusual" 023 prefix:** in the library's metadata, `023…` is a valid `MOBILE` range. It was
   reworded to "a valid mobile range but a less familiar prefix". The curated example still stands.
9. **GP10:** a stale reference to "DI3's towns list" now points to LOC.

**Added (missing facts that affect the build)**
10. **PH1, the `phone-input.tsx` design flaw:** the component keys countries by **calling code** (`"+233"`),
    which is ambiguous for shared codes. For example, `+44 7911 123456` parses as **GG**, not GB. PH1 now
    requires the ISO alpha-2 code as the value.
11. **PH1 / hand-off, placeholder:** `phone-input.tsx` defaults to `placeholder = "Phone number"`, which
    breaks the no-placeholder rule (Q8). It must be removed.
12. **PH7:** the `PHONE_NUMBER_MAX_LENGTH` copy ("…more than 12 characters", `validation-messages.constants.ts:11`)
    must change along with `@MaxLength(16)`.
13. **PH10, e2e tests:** `social-complete-signup.e2e-spec.ts:280` asserts that `0241234567` gets a **400**.
    Under PH2 that case flips. Both e2e phone generators emit numbers that are invalid for GH (`001-…`,
    `021-…`), so they must generate numbers in valid ranges.
14. **D2 "existing tool" for the widget:** the Tool recommendation now names the installed `cmdk` 1.0.4
    (`^1.0.4`; npm latest 1.1.1, MIT) with `ui/command.tsx` + `ui/popover.tsx` as the combobox. It records
    two requirements: Town needs `shouldFilter={false}` (confirmed in cmdk's types), and Town must be a real
    free-text input.
15. **Exit plan:** the Photon README says GraphHopper publishes weekly dumps for selected countries, so a
    self-hosted, country-limited instance is feasible. Java 21+ is required.
16. **R17 / row 25, data noise:** Photon's `locality` layer also returns facilities (power plants, a flour
    mill, one placed in the wrong region), and Koforidua has 4 same-name entries. A proxy-side filter was
    suggested.

**Verified as stated (no change)**
- **Phone (`libphonenumber-js` 1.13.15):** npm `latest` = 1.13.15, published 2026-10-08, MIT.
  - **Ghana, re-run on 1.13.15 (row 18 extended):** 020/023/024/026/027/028/050/053/054/055/056/057/059 +
    7 digits are all valid MOBILE. The **NSN is 9 digits**, and 8 or 10 digits are invalid. Landlines
    0302…/0322… are valid FIXED_LINE.
  - **Input forms:** every PH2 input → `+233241234567`, and `00233…` is accepted. `123-456-7890` and the seed
    numbers behave as stated. `getCountries()` = 245, and `getCountryCallingCode('GH')` = 233.
  - **Quotes and class-validator:** the README quotes ("simpler and smaller rewrite", "validates both phone
    number length and phone number digits", "could get stale over time…") are accurate. Backend
    `class-validator` 0.14.2 depends on `libphonenumber-js ^1.11.1` (1.12.15 installed), and its
    `IsPhoneNumber.js` requires `libphonenumber-js/max`, rejects a region mismatch, and needs `+` without a
    region. No backend `src/` file imports it.
  - **`react-phone-input-2`:** 2.15.1, last published 2022-07-01, own masks. It is installed, unused, and was
    added in `fab040e`.
  - **`react-phone-number-input`:** 3.4.18, MIT, published 2026-08-20, depends on `libphonenumber-js
    ^1.13.11`.
- **Photon:**
  - **Terms:** the homepage lists "Typeahead suggestion" and says "please be fair - extensive usage will be
    throttled. We do not guarantee for the availability". The README says "Extensive usage will be throttled
    or completely banned", gives 95 GB / 64 GB RAM for a planet build, and the repo licence is Apache-2.0
    (GitHub API; repo active, latest release 1.3.0 on 2026-08-07).
  - **API parameters:** `docs/api-v1.md` documents `countrycode` (repeatable), `layer`
    (city/district/locality, among others), `limit` and `lang`.
  - **Towns:** Accra, Kumasi, Tamale, Sekondi-Takoradi, Tema, Ho, Cape Coast and Koforidua each come back
    first, with the correct region. "East Legon" and "kum" work as partial input.
- **GeoNames:**
  - **Regions:** `admin1CodesASCII.txt` has exactly 16 `GH.*` entries, matching row 24. The names carry no
    " Region" suffix, so LOC4's stripping rule is needed against Photon's "Greater Accra Region".
  - **Towns:** `GH.txt` has 15,997 populated places. East Legon is present only as "East Legon Residential
    Area", Nhyiaeso and Santasi are absent, and all 8 major towns are present.
  - **Licence:** CC BY, with "You should give credit to GeoNames…" confirmed.
- **Nominatim policy:** confirmed verbatim: 1 req/s maximum, "Referer or User-Agent", "Clearly display
  attribution", "Results must be cached on your side", and under strictly forbidden, "Auto-complete search …
  you must not implement such a service on the client side using the API". The `post-job` gaps are
  confirmed: Nominatim `/reverse` at `post-job/page.tsx:128`, no attribution, `showError` at `:153`.
- **Repo claims:**
  - **`signup-form.tsx`:** container `:206`, H1 `:208`, form `space-y-6` `:217`, two-up rows `:218` / `:301`,
    gender `Select` `:302–324` with `SelectTrigger id="gender"` and items MALE/FEMALE/OTHER, Role `Select`
    beside it, the gender toast at `:131`, `validatePhone` / `formatPhoneNumber` `:86–110`, regex `:88`,
    `maxLength={12}` `:296`, and placeholders on every input `:226–385`.
  - **`complete-signup-form.tsx`:** `PHONE_REGEX` `:40`, formatter `:71–76`, role cards `:293`, phone and
    "Gender (optional)" on one row with `type="text"`, the US placeholder and `maxLength={12}`
    (`:368–379`), Select `:382–398`, 11 `toast.error` calls, and email `readOnly`.
  - **`phone-input.tsx`:** 16 West African codes, `countries[0]` = Benin fallback, `cmdk` + `Popover`, and
    imported nowhere. `cmdk` `^1.0.4` and `react-phone-input-2` `^2.15.1` are in `package.json`.
  - **Backend:** the `Gender` enum `enums.ts:7–11` includes OTHER; the three DTOs (phone
    `@MaxLength(12)` + `PHONENUMBER_REGEX`; `CreateUserDto` / `UpdateMeDto` phone and gender `@IsOptional`;
    complete-social gender optional); `PHONENUMBER_REGEX` at `variables.constants.ts:6` and the userinfo URL
    at `:55`; `GENDER_INVALID` at `:12`; the filter's 409 at `typeorm-exception.filter.ts:54` with no
    `meta.error`.
  - **Wiring:** `auth.controller.ts:158` binds `CreateUserDto`, `auth.service.ts:1162`,
    `users.controller.ts:92`, and `api.ts:169–176` reads `meta.error`.
  - **Other screens:** the settings phone payloads at `user/settings:263` and `artisan/settings:328`;
    `user.entity.ts:48` (unique phone) and the nullable gender enum; `@nestjs/axios` ^4.0.1 and
    `@nestjs/throttler` ^6.5.0 installed; Google scope `email profile` with `access_type`/`prompt` at
    `google-auth.strategy.ts:55–58`; the `isProfileComplete` filter at `artisans.service.ts:367`.
- **Decisions D1–D6:** each one is reflected and nothing contradicts it. Specifically:
  - **D1:** DI6/DI7 (read-only Google email + hint).
  - **D2:** LOC1–LOC11 (two fields, both suggest, existing service/data, country-driven).
  - **D3:** DI5 (signup's `Select`).
  - **D4:** PH1–PH11 (required for all, GH default, per-country validation, E.164, same library on the
    backend, the regex removed).
  - **D5:** DI5 (Male/Female only on both forms, a stated "required" ruling, enum `OTHER` kept for existing
    rows).
  - **D6:** LY1–LY7.
  - **Round-1 standing items:** no extra scopes (DI7), V1–V8 with no placeholders, B1–B5, GP8.
  - **Older text:** the older round-1 text (the "built-in Ghana towns list", `sex` autofill, "Gender … already
    optional") is either in historical, explicitly superseded sections or marked SUPERSEDED, and the
    round-2 block says it wins.

**Not changed (for the PM)**
- An existing-row nuance: `parsePhoneNumber` throws on garbage input. PH7's "left as-is so the validator
  rejects it" therefore needs a try/catch in the `@Transform`. That is an implementation detail and is
  already implied.
- Pre-existing markdown-lint "bare URL" warnings follow the document's own citation style and were left.
- No `.env` file was read.
