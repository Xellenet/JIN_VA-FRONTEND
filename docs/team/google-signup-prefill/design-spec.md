# Fast direct-input sign-up, custom field validation & optional artisan bio — Design Spec (round 2)

**Author:** ux-designer · **Date:** 2026-10-19 (round 2, after the user's design review) · **Scope:** one inline
field-validation treatment for all five auth forms (V1–V8); "Complete your account" rebuilt to look like
`/signup` (LY1–LY7) with a country-aware phone (PH1–PH11), two location fields with suggestions (LOC1–LOC11),
gender as the `/signup` dropdown with Male/Female only (DI5); the optional artisan bio (B1, B3, B4); and the
round-3 privacy rule where it touches the UI (PR1–PR5). GP8/GP9, B2, B5 and PR6 are backend-only.

**Grounded in:** `requirements.md` in full, including the round-2 DECISION block (D1–D6, with Q9 = Ghana + the
15 other West African countries, Q10 = gender required, Q11 = Role as a dropdown) and the round-3 DECISION
(PR1–PR6). Its tool picks are followed, not re-opened: **`libphonenumber-js` 1.13.15 (`/max`)** for phone,
**Photon through a JinVa proxy** (`GET /locations/suggestions`) for Town, **GeoNames admin1 as static per-country
JSON** for Region, and the installed **`cmdk` + `ui/command.tsx` + `ui/popover.tsx`** as the combobox widget.

**Read before anything below was proposed:** `signup-form.tsx` (all 452 lines), `auth-split-layout.tsx`,
`globals.css` (`:root`, `.dark`), `ui/select.tsx`, `ui/command.tsx`, `ui/popover.tsx`, `ui/input.tsx`,
`ui/label.tsx`, `ui/phone-input.tsx`, `components/logo.tsx`, `components/brand/brand-pattern.tsx`; the round-1
spec and its reads (`complete-signup-form.tsx`, `field.tsx`, the other auth forms, `profile-completeness.tsx`,
the artisan page). The running `/signup` was rendered with headless Chrome at 1440 and 375px, light and dark,
and measured (§3.10). **No request went to `photon.komoot.io` or any other external service** while producing
this round: the Chrome session allowed only `localhost`, which blocked one third-party request the app makes on
its own (`va.vercel-scripts.com`, §9 item 5). No `.env` file was opened.

---

## 0. What changed from round 1

| Area | Round 1 | Round 2 (this spec) | Decision |
|---|---|---|---|
| Overall look | Own order and headings, role cards | **`/signup`'s frame, header, field styles, spacing, field order and two-up rows** | D6, LY1–LY6 |
| Role | Two role cards above the names | **The `/signup` `Select`**, beside Gender | Q11, LY3 |
| Gender | Four chips including "Other" and "Prefer not to say", optional | **The `/signup` `Select`, Male / Female only, required** ("Choose your gender") | D3, D5, Q10, DI5 |
| Phone | Ghana-shaped copy, optional for customers as an alternative | **Required for everyone. Country picker (16 countries, Ghana pinned and preselected), rules and example per country, E.164 out** | D4, PH1–PH11 |
| Location | Hand-built Ghana towns list + optional native Region `<select>` | **Town: free-text combobox with Photon suggestions via JinVa. Region: required closed-list combobox from GeoNames. Both follow the phone country** | D2, LOC1–LOC11 |
| Email | Hint left for the user to rule on (old D3) | **Read-only, prefilled, hint "The Google account you signed in with." kept** | D1 |
| Privacy | — | **Suggestion request carries only typed text + country; OSM credit footer; mockups use fictional example.com people** | PR1–PR5, LOC9 |

Unchanged from round 1 and still standing: the validation system (§1), no placeholders, no native bubbles, the
optional bio and its surfaces (§3.7, §5), no extra Google scopes, no device geolocation.

### 0.1 Superseded (kept short so old references resolve)
- **Gender chips, "Other", "Prefer not to say", the `PREFER_NOT` UI value** (old §3.5, old D5, D10): gone. Gender
  is the Select in §3.5.
- **Single-country phone copy** ("Enter a Ghana number…" as the only rule, "Enter a full number for {Country}",
  the Ghana-only `InputGroup` alternative): replaced by §3.3's per-country rules.
- **The static Ghana towns list, its draft contents and `aliases` matching** (old §3.4, DI3): no hand-built list.
- **Optional native Region `<select>`** (old §3.4, DI4): replaced by the required Region combobox.
- **Role cards and the "names above email / phone on its own row / role first" reorder** (old §3.1, old D8):
  replaced by `/signup`'s order (§3.1). Phone still gets a full row, as on `/signup`.
- **Old decisions D3, D4, D5, D8, D9, D10:** answered by round 2 (§10).

---

## 1. The field validation system (V1–V8) — decided once, for every in-scope form

Unchanged from round 1 except where noted **(r2)**.

### 1.1 Anatomy

```
Label  (optional)                ← text-sm text-muted-foreground font-medium; suffix font-normal
┌────────────────────────────┐
│ control                    │   ← Input / PhoneInput / combobox / SelectTrigger, h-10 (40px)
└────────────────────────────┘
ⓘ message slot                   ← ONE slot: helper text OR error, never both (§1.3)
```

- **Label:** `/signup`'s `text-sm text-muted-foreground` (4.73:1 light, 6.22:1 dark). Sentence case ("First name").
- **Required vs optional (V7):** required fields carry **no marker**; optional fields carry `(optional)` in a
  `font-normal` span. On "Complete your account" only Bio, Years of experience and Business name are optional
  **(r2: Gender and Region are now required, so nothing on the customer form is optional)**. No asterisks.
- **Message slot:** `min-h-4`, so a one-line helper and a one-line error take the same height.

### 1.2 States

| State | Border | Ring | Background | Message slot | Notes |
|---|---|---|---|---|---|
| Default | `border-input` | — | `bg-background` (light) / `dark:bg-input/30` (dark — this is what renders on `/signup`, measured) | helper or empty | No placeholder |
| Focus | `border-ring` | `ring-ring/50` 3px | unchanged | unchanged | existing `focus-visible` |
| Filled | `border-input` | — | unchanged | helper | No green tick |
| Read-only (email) | `border-input` | ring on focus | `bg-muted` | helper | `readOnly`, not `disabled` |
| Disabled (submitting) | — | — | — | — | existing `disabled:opacity-50`, only while `isBusy` |
| Error | `border-destructive` | — | unchanged | error + icon | driven by `aria-invalid="true"`; label turns `text-destructive` |
| Error + focus | `border-destructive` | `ring-destructive/20` light, `/40` dark | unchanged | error | existing classes on `input.tsx` / `select.tsx` |

### 1.3 The message slot
- Helper: `text-xs text-muted-foreground`, `id="{field}-hint"`.
- Error: `flex items-start gap-1.5 text-sm text-destructive` + lucide `CircleAlert` `size-4 mt-0.5`
  (`aria-hidden`), `id="{field}-error"`.
- **An error replaces the helper**, so every error stands alone and repeats any example it needs ("Enter a valid
  Ghana number, like 024 123 4567").
- Exception: the bio counter stays visible on the right while an error shows on the left.
- Error text never sits on a tinted box (`text-destructive` on `bg-destructive/10` fails AA in dark, 3.83:1).

### 1.4 When errors appear and clear (V4)

| Moment | What happens |
|---|---|
| Page load, typing in a fresh field | Nothing |
| Blur of a field the user typed in | Format rules only (phone validity, name length, rate, Region not on the list). Empty on blur is **not** an error |
| Submit | Everything, including empty required fields; **all** errors at once; focus the first (§1.5) |
| A field already showing an error | Re-validate on every change; clears the moment it's valid |
| Server field error (V5) | On its field; cleared on that field's next change |
| Prefilled value invalid on load (Google name > 15 chars) | Shown on load |
| **(r2)** Phone country changed while the number shows an error | Re-validate the number against the new country at once |

Submit is never disabled to signal invalidity; only while a request is in flight.

### 1.5 Focus and scroll to the first error (V3)
1. Errors in DOM order (= visual order; two-up rows read left then right).
2. `focus({ preventScroll: true })` then `scrollIntoView({ block: "center" })` (`"auto"` under reduced motion);
   `scroll-mt-24` as fallback.
3. **Focus target (r2):** text input → the input; phone → the **number** input; Gender / Role → the
   `SelectTrigger` (Radix: Space/Enter/↓ opens it); Town → its input; Region → its input; services → the first
   checkbox.
4. Update the form's live region with the count.

### 1.6 Screen-reader wiring (V2, V8)
- `aria-invalid="true"` only while an error shows; `aria-describedby` = whatever the slot shows
  (`{field}-hint` or `{field}-error`, plus `bio-count`).
- `required` stays on required inputs (under `noValidate`). **(r2)** Radix `SelectTrigger` is a button, so it
  gets `aria-required="true"` explicitly.
- One polite `sr-only` status per form: "2 fields need fixing." / "1 field needs fixing." on submit;
  "{Label}: {message}" on a blur error; nothing on clear. Combobox announcements (§3.3, §3.4) use the same
  region, so there is only one live region per page.
- Services is a `<fieldset>` + `<legend>` with its error referenced from the fieldset.
- `ui/field.tsx` changes (only primitive edits): `FieldError` drops `role="alert"`, renders the icon, accepts
  `id`; `FieldDescription` takes `text-xs` at the call site.

### 1.7 Contrast (V8), measured (unchanged)

| Pair | Light | Dark | Needed |
|---|---|---|---|
| `text-destructive` on `--background` | 4.76:1 | 5.59:1 | 4.5 |
| on `--card` (dark) | — | 5.22:1 | 4.5 |
| `text-muted-foreground` on `--background` | 4.73:1 | 6.22:1 | 4.5 |
| `border-destructive` vs background | 4.76:1 | 5.59:1 | 3 |
| `text-destructive` on `bg-destructive/10` | 4.39:1 | 3.83:1 | **not used** |
| `text-foreground` on `bg-muted` (email) | 18.15:1 | 15.44:1 | 4.5 |
| **(r2)** `text-muted-foreground` on `--popover` (suggestion region text, OSM footer) | 4.73:1 (popover = white) | 5.80:1 (popover = card) | 4.5 |

Pre-existing findings carried over (not caused by this round): light `--input` border 1.26:1 against white;
the light focus ring is faint.

### 1.8 Placeholders
No input placeholders on the five auth forms, **including `/signup`** (LY4 removes "John", "Doe", "johndoe",
"example@gmail.com", "123-456-7890", "Format: XXX-XXX-XXXX", the password placeholders) and **the phone
component's default `placeholder = "Phone number"`** (PH1). Two non-input texts stay because they are a control's
own empty label, not a placeholder: the Select triggers' "Select gender" / "Select role". **(r2)** The country
picker's search box has **no placeholder**: a leading search icon plus `aria-label="Search countries"`.

### 1.9 Suppressing native bubbles (V1)
`noValidate` on all five forms; keep `required` / `type` as semantics; no `:invalid` / `:user-invalid` styling;
hourly rate and experience become `type="text"` + `inputMode`.

---

## 2. Screen inventory

| # | Surface | Route | Status | Start in |
|---|---|---|---|---|
| 1 | **Complete your account** | `/auth/complete-signup` | MODIFIED, main surface | `complete-signup-form.tsx` |
| 2 | Field primitives | all auth forms | MODIFIED (§1.6) | `ui/field.tsx` |
| 3 | **Country-aware phone** | complete-signup, `/signup`, both settings pages (PH11) | MODIFIED (§3.3) | `ui/phone-input.tsx` |
| 4 | **Town + Region comboboxes** | complete-signup (artisan) | NEW (§3.4) | `components/auth/location-field.tsx` |
| 5 | Region data | — | NEW data files (LOC7) | `regions/{CC}.json` + `scripts/generate-regions.mjs` |
| 6 | Sign-up (email/password) | `/signup` | MODIFIED: V, shared phone, Male/Female, no placeholders, sentence case, Select fix (§3.9) | `signup-form.tsx` |
| 7 | Login, forgot, reset | auth routes | MODIFIED: V only | the three forms |
| 8 | Auth layout mobile padding | all auth routes | MODIFIED, layout only (§3.9) | `auth-split-layout.tsx` |
| 9 | Profile completeness: bio "recommended" | `/dashboard/artisan/*` | MODIFIED (§5.1) | `profile-completeness.tsx` |
| 10 | Artisan page: no fabricated bio | `/dashboard/user/artisan/[id]` | MODIFIED (§5.2) | `page.tsx:357` |
| 11 | Credits page lines (OSM ODbL, GeoNames CC BY) | legal/credits | COPY only (§3.4.6) | privacy-policy owner |

**Mockups** (`mockups/`, self-contained: token values copied from `globals.css`, Geist embedded as a data URI,
no external requests of any kind — checked by loading each file with all non-`file:` requests blocked: zero
attempted). They **replace** the round-1 mockups, which must not be used as a build reference (LY7):
- `complete-signup-desktop-light.html` — 1440px light. A: customer, filled. B: artisan typing "legon" with the
  suggestion list and OSM footer open. Full split layout with the brand panel unclipped.
- `complete-signup-mobile-dark.html` — 375px dark. Customer submit with 2 errors; artisan submit with 4 errors;
  server 409 on phone; Nigeria selected with the Nigerian example; the country picker open.
- `complete-signup-states.html` — loading, empty (×2), error, success at 375px light; success at 1440px **dark**;
  bio surfaces; DI8 counts.
- `field-states.html` — every control state, light and dark: email, phone (9 states incl. paste and unsupported
  code), Gender/Role selects, Town (5 states), Region (6 states incl. country change), services, bio.

All people in the mockups are obviously fictional (**Esi Sample**, **Kojo Demo**, `@example.com`). Suggestion
rows are written from the requirements text (row 25), not fetched. The brand panel's "Kwame Asante" sample card
is the layout's own existing copy; its photo is drawn as a plain circle.

---

## 3. "Complete your account" — the page

### 3.1 Frame, header and order (LY1, LY2, LY3)

Same `AuthSplitLayout` as `/signup`: logo top-left, form column centred in the left half, brand panel on the
right at `lg:`. The form wrapper is `/signup`'s exactly: `space-y-8 bg-background md:rounded-lg md:p-8 p-4
w-full md:w-auto`; header `space-y-2`, H1 `text-4xl font-bold tracking-tight text-foreground`, subtitle
`text-muted-foreground`; form `space-y-6`; field wrappers `space-y-2`; two-up rows `grid grid-cols-2 gap-4`.

```
H1  Complete your account
    A few more details and you're in. Nothing is created until you finish.

First name                     Last name               ← prefilled from Google, editable
[ Esi              ]           [ Sample           ]
Email                                                  ← read-only, bg-muted (D1)
[ esi.sample@example.com                        ]
The Google account you signed in with.
Phone number                                           ← full row, as on /signup
[ 🇬🇭 +233 ▾ ][ 024 123 4567                    ]
We'll use this for booking updates. For example, 024 123 4567.
Gender                         Role                    ← the /signup Selects, two-up
[ Female          ▾ ]          [ Customer         ▾ ]

── artisan only (revealed below Role; nothing above moves) ──
Your work                                              ← sub-heading, border-t
Services you offer             [checkbox box]
Town or area                   Region                  ← two-up at sm+, stacked at 375
[ ⌖ East Legon     ]           [ Greater Accra    ▾ ]
Hourly rate (GH₵)
[ 50                                           ]
Optional — you can add these later                     ← muted sub-heading, border-t
Bio (optional)                 [textarea]  0 / 1,000
Years of experience (optional) Business name (optional)

[            Create account            ]               ← /signup's primary button
[               Cancel                 ]               ← /signup's outline button style, space-y-3 gap
```

**Where this page differs from `/signup`, and why** (everything else is identical):
1. **No username, password, "OR" divider or social buttons** — Google already authenticated the user (LY2).
2. **Email is read-only with a hint** (D1). `/signup`'s email is editable.
3. **A Cancel button** under Create account — it discards the pending Google sign-up (existing behaviour). It
   reuses `/signup`'s outline button classes (the "Continue with Google" style), 12px below the primary (`space-y-3`,
   the same gap `/signup` uses between its social buttons).
4. **Two artisan sub-headings** ("Your work", "Optional — you can add these later"), `text-sm font-medium`,
   `border-t pt-6`. `/signup` has no conditional block; here a block appears when Role = Artisan, and the
   heading says what was added and why the page got longer. Required-first order inside it lets a fast artisan
   stop scanning at Hourly rate.
5. **Role preselected** from `suggestedRole`; `/signup` preselects from `?role=` the same way.

### 3.2 Defaults, autofill tokens, keyboards (DI2, DI6)

| Field | Default | `autoComplete` | `type` / `inputMode` | `enterKeyHint` | Required |
|---|---|---|---|---|---|
| First name | Google `given_name` | `given-name` | text | next | yes |
| Last name | Google `family_name` | `family-name` | text | next | yes |
| Email | Google email, read-only | `email` | email | — | n/a |
| Phone country | **GH** (ISO code, not "+233") | — (button, R9) | — | — | — |
| Phone number | empty | `tel-national` | `tel` | next | **yes, both roles** |
| Gender | none | — (button, R9) | Select | — | **yes** |
| Role | `suggestedRole`, else none | — | Select | — | yes |
| Services | none | — | checkboxes | — | yes (artisan) |
| Town or area | empty | `address-level2` | text, `autoCapitalize="words"` | next | yes (artisan) |
| Region | empty; set by a town choice | `address-level1` | text (combobox) | next | **yes (artisan)** |
| Hourly rate (GH₵) | empty | `off` | text + `inputMode="decimal"` | next | yes (artisan) |
| Years of experience | empty | `off` | text + `inputMode="numeric"` | next | no |
| Business name | empty | `organization` | text | next | no |
| Bio | empty | `off` | textarea | — | no |

**Tab order** = DOM order: first name → last name → email → country button → phone number → Gender → Role →
*[artisan]* services… → Town → Region → hourly rate → bio → experience → business name → Create account → Cancel.
Enter on a text input moves to the next field; it submits only from the last field. Enter inside an **open**
list never submits (§3.3, §3.4).

### 3.3 Phone number (PH1–PH6, PH9, DI2) — `ui/phone-input.tsx` + `libphonenumber-js/max`

**Look:** the existing component — `flex gap-2`: country button `h-10 w-[120px]` (flag, "+233", chevron, the
`/signup` outline-input look) then the number `Input` `h-10 flex-1`. Error state goes on the **number input**
only; the country button stays neutral. Flags are the component's emoji; Windows shows them as letter pairs
("GH"), which is acceptable because the name is in the button's `aria-label` and in every list row.

**Component changes (PH1, hand-off):**
1. The value is the **ISO alpha-2 code** (`"GH"`), never the calling code (`+44` is GB, GG, JE, IM).
2. The list is `SUPPORTED_PHONE_COUNTRIES` (Q9: GH, BJ, BF, CV, CI, GM, GN, GW, LR, ML, MR, NE, NG, SN, SL, TG).
   Calling codes from `getCountryCallingCode()`, names from `Intl.DisplayNames(["en"], {type: "region"})`.
3. Fallback is **GH**, not `countries[0]` (Benin).
4. Default `placeholder` removed. Forward `id`, `aria-invalid`, `aria-describedby`, `aria-required`,
   `autoComplete`, `onBlur`, `enterKeyHint` to the number `Input`; `<Label htmlFor="phoneNumber">` lands on it.
5. Country button `aria-label="Country code: Ghana +233"` (updates with the country).

**Country list (popover):** `PopoverContent w-[280px] p-0` → `Command`:
- top: search row (search icon, **no placeholder**, `aria-label="Search countries"`), filters by name or code
  ("nig", "234", "+234");
- **Ghana pinned first**, a separator, then the other 15 sorted by display name; each row: check (selected),
  flag, name, `+code` muted;
- empty search result: "No country found. Check the spelling.";
- keys: the trigger opens on Enter/Space/↓; ↑↓ move, Enter chooses, Esc closes and returns focus to the button.
  **Choosing a country moves focus to the number input** and announces "Country set to Nigeria +234.";
- choosing a country never clears the typed number; it re-validates it if the field was already flagged (§1.4).

**Input behaviour:**

| User does | Field shows | Picker | Submitted |
|---|---|---|---|
| types `0241234567` | as typed → **`024 123 4567` on blur** | GH | `+233241234567` |
| types `024 123 4567`, `024-123-4567`, `(024) 123-4567`, `024.123.4567`, `24 123 4567` | → `024 123 4567` on blur | GH | `+233241234567` |
| types/pastes `+233 24 123 4567`, `+2330241234567` or `00233 24 123 4567` | `024 123 4567` (the code moves out of the field) | GH | `+233241234567` |
| pastes or autofills `+234 802 123 4567` | `0802 123 4567` | **switches to Nigeria** + announcement | `+2348021234567` |
| Nigeria selected, types `0803 123 4567` | `0803 123 4567` | NG | `+2348031234567` |
| pastes `+44 7700 900123` (not supported) | as pasted | **unchanged** | — → "can't take" error |
| types `123-456-7890` with GH | as typed | GH | — → invalid error |

- **No reformatting while typing** (caret jumps, Android keyboards). `formatNational()` on blur, valid numbers only.
- The `+CC` / `00CC` detection runs on every change, so typing, paste and autofill behave the same and
  `+233 +233…` can't happen.
- **No `maxLength`.** Length is the library's rule (PH4/PH5).

**Copy (helper + errors), per country** — `{Country}` is the `Intl.DisplayNames` name; `{example}` is the curated
example (GH `024 123 4567`), else `getExampleNumber(country, examples).formatNational()`:

| Case | Text |
|---|---|
| Helper | We'll use this for booking updates. For example, {example}. |
| Empty (submit) | Enter your phone number |
| Invalid for the selected country (blur/submit) | Enter a valid {Country} number, like {example} |
| `+CC` not in the list | We can't take numbers from this country yet. Use a number from a country in the list. |
| Server 409 `PHONE_NUMBER_IN_USE` (PH9) | This number is already used by another JinVa account. Enter a different number. |

Examples rendered in the mockups: Ghana "024 123 4567"; Nigeria "0802 123 4567" (illustrative — the build takes
whatever the library's example returns, unless a curated one is added).

**Required for everyone (PH6):** no "(optional)" on either form, either role.

**Same component on `/signup` and both settings pages** (PH11): settings load a stored E.164 value with the
picker set from the number and the national format shown.

### 3.4 Town or area + Region (LOC1–LOC11) — artisans only

Customers see neither field. For artisans both are required. Layout: `grid grid-cols-1 sm:grid-cols-2 gap-4`,
Town left, Region right; stacked at 375px, Town first (LOC1, LY6).

#### 3.4.1 Both fields follow the phone country (LOC2)
The country chosen in the phone picker drives both: Town queries `country=<ISO>`, and Region loads
`regions/<ISO>.json`. Because that link is not obvious, **Region's helper names the country**: "Regions in
Ghana, from your phone number's country." When the phone country changes:
- Town keeps its text; the next query uses the new country (no query is fired by the change itself);
- Region is cleared **unless** the same name exists in the new country's list; if cleared, the live region says
  "Region cleared. Choose a region in Nigeria." and the helper switches to "Regions in Nigeria, from your phone
  number's country.";
- the Region file for the new country lazy-loads; while it loads (normally instant) the list shows one muted
  row "Loading regions…".
R13 (a Nigerian number used by an artisan working in Accra gets Nigerian suggestions) is accepted for this round;
the helper line is what tells that user why, and free text in Town still works.

#### 3.4.2 Town or area — free-text combobox with suggestions (LOC3, LOC4, LOC6, LOC8)

**Control:** a real text input (the `Input` styles + lucide `MapPin` `size-4 text-muted-foreground` at the left,
`pl-9`), wired as an editable WAI-ARIA combobox: `role="combobox" aria-autocomplete="list" aria-expanded
aria-controls="town-listbox" aria-activedescendant`. The list is a `Popover` anchored to the input
(`PopoverAnchor`, `onOpenAutoFocus` prevented so focus stays in the input) containing
`<Command shouldFilter={false}>` (the server already filtered). It is **not** cmdk's search box inside a
popover, and nothing ever replaces what the user typed except an explicit choice.

**List panel:** `bg-popover text-popover-foreground border rounded-md shadow-md p-1`, 4px below the input,
**as wide as the Town | Region row** (so "East Legon Extension · Greater Accra" fits on desktop; full width on
mobile), `max-h` 8 rows.
- **Row:** `CommandItem` `px-2 py-1.5 text-sm`: place name in `text-foreground` with the typed text in
  `font-semibold`; on the right `text-xs text-muted-foreground` "city, region" when Photon gives a parent city
  ("Nhyiaeso · Kumasi, Ashanti"), else just the region ("Greater Accra"). The region text is shown **without**
  the " Region" suffix Photon returns ("Greater Accra Region" → "Greater Accra"), the same normalisation LOC4
  uses. Same-name places (Madina × 3) are told apart by that right-hand text.
- **Active row:** `bg-accent text-accent-foreground`. **No row is active when the list opens** — only ↓/↑ make
  one active. So Enter or Tab with nothing active keeps the typed text (never silently swaps in the first
  suggestion). *Engineer's note:* cmdk 1.x auto-selects the first item; control its `value` (reset to `""` on
  each new result set) or, if it can't be held empty, build Town as a plain WAI-ARIA combobox as the hand-off
  allows.
- **Footer (LOC9, PR):** while any suggestion row is on screen, a `border-t px-3 py-1.5 text-xs
  text-muted-foreground` footer reads **"Suggestions © OpenStreetMap contributors"**, with "OpenStreetMap
  contributors" linked to `https://www.openstreetmap.org/copyright` (`target="_blank" rel="noopener"`; it is
  reachable by Tab from the input and is the only focusable thing in the panel besides the rows).

**Behaviour:**

| Moment | What the user sees | Announced (polite) |
|---|---|---|
| Focus, empty or 1 character | nothing opens; helper "Start typing and pick from the list, or type your own." | — |
| 2+ characters, 250 ms after the last keystroke | request sent (§3.4.4). First query: panel opens with one muted row, spinner + "Looking for places…". Later queries keep the previous rows until new ones arrive (no flicker) | — |
| Results (1–8) | rows + footer | "{n} suggestions. Use up and down arrows to choose." |
| No results, **or the service is down / slow / offline** (proxy returns `[]`, or the client gives up after 2 s) | panel closes; helper "Not on our list? That's fine — we'll save it as you type it." No error, no toast, nothing blocked (LOC8). The two cases look the same on purpose: the user's action is the same | "No suggestions. You can keep typing." |
| ↓/↑ | moves the active row (wraps) | the row is read via `aria-activedescendant` |
| Enter / click / tap on a row | Town = the place name; **Region = the row's region if it matches the country's list** (LOC4: ignore case and diacritics, drop trailing " Region" / " State" / " Province"); panel closes; focus moves to **Hourly rate** (Region is already done); Region's helper becomes "Filled in from your town. You can change it." If the region doesn't match, Region is left as it was — never guessed | "East Legon chosen. Region set to Greater Accra." (or "East Legon chosen.") |
| Esc | panel closes, text kept; a second Esc does nothing else | — |
| Tab with the panel open | panel closes, text kept, focus moves on (to the footer link first if a row list is showing, then Region) | — |
| Blur with free text | kept exactly as typed (trimmed), never "corrected" | — |
| Browser autofill (`inputType` empty or `insertReplacementText`) | accepted as free text; **no query is sent** | — |
| Empty on submit | "Enter your town or area" | via form count |
| Town + Region longer than 150 characters | "Shorten to 150 characters or fewer (town and region together)" | |

**R8 (two popups):** ours never opens on focus or after autofill, so a browser's saved-value popup gets the
field to itself; if both show, the keyboard drives ours and Esc on ours leaves the browser's alone.

#### 3.4.3 Region — closed-list combobox (LOC5, LOC7)
**Control:** the same input look with a `ChevronDown` at the right (the `SelectTrigger` look), but a real text
input with `role="combobox" aria-autocomplete="list"` so `autocomplete="address-level1"` can fill it (R9 is
why it isn't a Radix `Select`). The list is a `Popover` + `<Command>` **with** cmdk's own filtering over the
country's full first-level list (Ghana: Ahafo, Ashanti, Bono, Bono East, Central, Eastern, Greater Accra,
North East, Northern, Oti, Savannah, Upper East, Upper West, Volta, Western, Western North). No attribution
footer here: GeoNames is credited on the credits page (LOC7).
- Opens on click, on ↓, or on the first typed character; a check marks the current value.
- Filtering from the first character ("up" → Upper East, Upper West). Nothing matches → one row "No region
  matches. Check the spelling."
- Enter/click chooses and closes; focus moves to Hourly rate. Esc closes, text kept.
- **Closed list:** on blur, typed text that matches one entry after LOC4's normalisation is accepted and shown
  in the list's spelling ("greater accra" → "Greater Accra"); anything else shows **"Choose your region from the
  list"** (format error, blur). Empty on submit: **"Choose your region"**. An autofilled value is matched the
  same way.
- Helper: "Regions in {Country}, from your phone number's country." → after a town choice "Filled in from your
  town. You can change it."

#### 3.4.4 What the suggestion request contains (PR1, PR4, PR5, LOC9, LOC10)
The browser calls **only** `GET {API}/locations/suggestions?q=<typed text>&country=<ISO>` — never
`photon.komoot.io`. The design depends on these, so they are listed as UI rules:
- **Nothing personal in the request:** no name, email, phone, user ID or pending-signup ID in the query; the
  call is made with `credentials: "omit"` so the pending-signup cookie isn't attached; no custom headers.
- **Only what the user typed into Town**, at 2+ characters, after the debounce. Nothing is sent on focus, on
  autofill, on a country change, or for a prefilled value. In-flight requests are aborted when a newer one starts.
- No location text is written to `localStorage`, analytics or error reporting.
- The proxy side (no forwarded IP/`Referer`/`Cookie`, generic `JinVa/<version>` User-Agent, no logging of `q`,
  in-memory IP throttle only) is PR1, PR2, PR5 — backend, no UI.
- Tests and demos use mocked rows and made-up place text only (PR4); the mockups follow the same rule.

#### 3.4.5 Submitted value (LOC11)
`location = "Town, Region"` (e.g. "East Legon, Greater Accra") into the existing string, `@MaxLength(150)`.
No DTO or schema change.

#### 3.4.6 Credits page copy (LOC7, LOC9 — for the privacy-policy owner)
"Place suggestions use data © OpenStreetMap contributors, available under the Open Database License." (link
`/copyright`) · "Region lists from GeoNames (geonames.org), CC BY 4.0." · Privacy policy: "When you type a
town, the text you type and your country are sent to komoot's Photon service to suggest places. Nothing else
about you is sent."

### 3.5 Gender and Role — the `/signup` Select (DI5, LY3)
- **Exactly the `/signup` markup:** `Select` → `SelectTrigger id="gender"` → `SelectValue placeholder="Select
  gender"`; items **Male** (`MALE`), **Female** (`FEMALE`), in that order. No "Other", no "Prefer not to say",
  no default. Role: `SelectTrigger id="role"`, Customer / Artisan, preselected from `suggestedRole`.
- Two-up `grid grid-cols-2 gap-4`, Gender left, Role right, at every width (LY6).
- **Required.** Empty on submit: "Choose your gender" / "Choose Customer or Artisan". `/signup`'s gender and role
  toasts are removed.
- Error state: `aria-invalid` on the trigger (the destructive border is already in `select.tsx`), label turns
  destructive, message under the trigger. The `SelectContent` is the existing popper.
- `autocomplete="sex"` is not applied (a Radix trigger is a button; R9 accepted).
- **Backend `Gender` enum keeps `OTHER`** for existing rows (no migration); no endpoint accepts it as new input.
  No UI shows `OTHER`: if a settings page ever loads an existing `OTHER`, it shows the trigger empty and leaves
  the stored value alone unless the user picks Male/Female (settings is the follow-up pass, Q3).

### 3.6 Email (D1, DI6, DI7)
`Input readOnly`, `bg-muted`, `autoComplete="email"`, helper "The Google account you signed in with." It stays
in the tab order and is read by screen readers. No other Google wording anywhere.

### 3.7 Artisan fields
- **Services you offer:** the existing checkbox box (`grid-cols-2`), now `bg-input-bg` like the inputs. Error:
  box `border-destructive` + message under it. Loading: four `Skeleton` rows. Failure: "We couldn't load the list
  of services." + `Button variant="outline" size="sm"` "Try again" (refetches; nothing typed is lost).
- **Hourly rate (GH₵):** `inputMode="decimal"`; `50`, `50.5`, `50,5` accepted. Helper "What you charge per hour.
  You can change it any time."
- **Bio (optional), B1:** helper "A few lines about your work help customers choose you. You can add this
  later." Counter `{n} / 1,000` right-aligned (`id="bio-count"`); over the limit it turns destructive with "Use
  1,000 characters or fewer". No hard `maxLength`.
- **Years of experience (optional)**, **Business name (optional)**: two-up at `sm:` with `items-end` so the
  longer label wrapping doesn't misalign the inputs; stacked at 375.

### 3.8 Buttons and non-field messages
- **Create account:** `/signup`'s primary (`w-full h-10 bg-primary … font-medium text-base`). Submitting:
  `Loader2` + "Creating your account…", `aria-busy`, form disabled.
- **Cancel:** outline, "Cancelling…" while busy.
- **Email registered meanwhile (409):** the existing warning banner above the buttons, copy unchanged except
  sentence case ("An account with this email already exists" / "Sign in to it instead — Continue with Google will
  work there too." / "Go to sign in"); add `role="alert"` and move focus to it.
- **Expired pending entry:** redirect to `/login?error=signup_expired` (unchanged).
- **Network / 5xx:** toast "We couldn't create your account." / "Check your connection and try again."
- **Field-shaped 400s and the phone 409:** on the field (V5), with §6 copy.

### 3.9 Responsive, and the changes `/signup` gets at the same time (LY1, LY4, LY6)

| Width | Behaviour |
|---|---|
| < 640 (375) | Names 2-up, Gender/Role 2-up (as `/signup`); Town/Region and Experience/Business stack. H1 `text-3xl` |
| 640–1023 | Town/Region and Experience/Business 2-up. Brand panel hidden |
| ≥ 1024 | Split layout with the brand panel, form column `max-w-md`. H1 `text-4xl` |

Three layout fixes, each made **to both pages in the same change** (LY1), so they never drift:
1. **Mobile padding.** Today at 375px the content is **279px** wide (`p-8` outer + `p-4` inner, measured). With a
   120px country button that leaves ~151px for the number. Change the layout's form wrapper and logo wrapper to
   `p-4 sm:p-8`, and the form container to `p-0 md:p-8` → **343px** at 375.
2. **H1 `text-3xl sm:text-4xl`.** At 36px, "Complete your account" takes three lines at 375.
3. **Select triggers full width and 40px.** On the running `/signup` the Gender/Role triggers render **36px high
   and content-width** (140px), because `SelectTrigger`'s `data-[size=default]:h-9` and `w-fit` beat the `h-10`
   passed in. Pass `className="w-full data-[size=default]:h-10 …"` on both pages so triggers line up with the
   40px inputs and their error messages sit under a full-width control. The mockups show the fixed version.

**Dark mode:** all tokens; the measured dark input fill is `dark:bg-input/30` (white at 3.6%) on
`--background`, and popovers use `--popover` (= `--card`). No special casing.

### 3.10 Side-by-side check against the running `/signup`
Rendered `http://localhost:4200/signup` (1440 and 375, light and dark, external requests blocked) and compared
with the mockups. Measured and matched: form column x = 168 / width 384 at 1440; H1 36/40 bold; subtitle 16/24
muted; label 14/20 medium muted; inputs 40px, 8px radius, 12px padding, 14px text (16px below `md`); helper
12/16; form gap 24, label gap 8, two-up gap 16; primary button 40px, 16px medium; outline button style; logo 32px
mark + 24px wordmark at 32px padding; the brand panel (gradient, 40px grid + 20px dots at 10%, card, sample chip,
"Every trade, one platform", dots, Support). Intended differences are only those in §3.1 and §3.9.

---

## 4. The four states and the DI8 walk-through

### 4.1 States (`complete-signup-states.html`)

| State | What the user sees |
|---|---|
| **Loading** (GET `/auth/social/pending`) | The existing centred spinner + "Loading your sign-up…", `role="status"` |
| **Empty** | (a) No `family_name`: Last name empty, a normal required field. (b) No `suggestedRole`: Role shows "Select role"; submitting shows "Choose Customer or Artisan"; artisan fields stay hidden until Artisan is picked. (c) Services failed: "Try again". (d) Town with no match **or the suggestion service unavailable**: free-text helper, nothing blocked. (e) Region list for a new country loading: "Loading regions…" row |
| **Error** | Field errors (§1, §6); server field errors on the field; non-field banner / redirect / toast (§3.8) |
| **Success** | "Creating your account…" → toast → `router.replace(dashboard)`. Customer: "Your account is ready." Artisan: "Your account is ready, and customers can now find you." + (no bio) "Add a short bio from your profile to stand out." |

### 4.2 DI8 (375px, no autofill, role suggested)

| Path | Steps | Taps | Keys |
|---|---|---|---|
| Customer | tap Phone → `0241234567` → tap Gender → tap Female → tap Create account | **4** | 10 |
| Artisan | tap Phone → 10 digits → tap Gender → tap Male → tap a service → tap Town → `ku` → tap "Kumasi · Ashanti" (Region fills) → tap Hourly rate → `50` → tap Create account | **8** | 14 |

No suggested role: +2 taps. Phone autofill: phone step 1 tap, 0 keys. "Next" on the keyboard replaces the tap on
Hourly rate. Required gender is the round-2 cost (+2 taps on both paths); any further required step is a defect.

---

## 5. Bio surfaces outside sign-up (B3, B4) — unchanged from round 1

### 5.1 `profile-completeness.tsx` (B3)
`FIELD_ORDER` drops `bio` (3 required items). New `BioNudge` on `/dashboard/artisan/profile` while bio is
empty: dashed `rounded-lg border border-dashed p-4`, `Lightbulb`, "Add a short bio", "Optional. Artisans with a
bio are easier for customers to choose.", outline badge "Recommended", outline button "Add" (`onFixField("bio")`).
The compact variant never mentions bio.

### 5.2 Artisan page (B4)
Replace the fabricated text with *"{First name} hasn't added a bio yet."* (`text-muted-foreground italic`) under
"About {name}". Search cards have no bio fallback; no change.

---

## 6. Copy table (V6)

Voice: imperative, says what to do, stands alone, no DTO text, no "invalid".

### 6.1 Complete your account

| Field | Label | Helper | Empty (submit) | Format / rule (blur or submit) | Server |
|---|---|---|---|---|---|
| First name | First name | — | Enter your first name | Shorten to 15 characters or fewer | — |
| Last name | Last name | — | Enter your last name | Shorten to 15 characters or fewer | — |
| Email | Email | The Google account you signed in with. | — | — | banner (§3.8) |
| Phone | Phone number | We'll use this for booking updates. For example, {example}. | Enter your phone number | Enter a valid {Country} number, like {example} · We can't take numbers from this country yet. Use a number from a country in the list. | 409: This number is already used by another JinVa account. Enter a different number. |
| Country button | aria-label "Country code: {Country} +{code}" | — | — | — | — |
| Country search | aria-label "Search countries" · empty: "No country found. Check the spelling." | | | | |
| Gender | Gender | — (trigger: "Select gender") | Choose your gender | — | — |
| Role | Role | — (trigger: "Select role") | Choose Customer or Artisan | — | — |
| Services | Services you offer | — | Choose at least one service you offer | — | One of these services is no longer available. Refresh the list and choose again. |
| Town | Town or area | Start typing and pick from the list, or type your own. | Enter your town or area | Shorten to 150 characters or fewer (town and region together) | — |
| Town (no match / service down) | — | Not on our list? That's fine — we'll save it as you type it. | — | — | — |
| Town list | loading row "Looking for places…" · footer "Suggestions © OpenStreetMap contributors" | | | | |
| Region | Region | Regions in {Country}, from your phone number's country. · after a town: Filled in from your town. You can change it. | Choose your region | Choose your region from the list | — |
| Region list | empty "No region matches. Check the spelling." · loading "Loading regions…" | | | | |
| Hourly rate | Hourly rate (GH₵) | What you charge per hour. You can change it any time. | Enter your hourly rate | Enter an amount above 0, like 50 · Use up to 2 decimal places, like 50.50 | — |
| Experience | Years of experience (optional) | — | — | Enter a whole number from 0 to 80 | — |
| Business name | Business name (optional) | — | — | Shorten to 150 characters or fewer | — |
| Bio | Bio (optional) | A few lines about your work help customers choose you. You can add this later. | — | Use 1,000 characters or fewer | — |
| Headings | Your work · Optional — you can add these later | | | | |
| Buttons | Create account / Creating your account… · Cancel / Cancelling… | | | | |
| Live region | "2 fields need fixing." / "1 field needs fixing." / "{Label}: {message}" / "Country set to {Country} +{code}." / "{n} suggestions. Use up and down arrows to choose." / "No suggestions. You can keep typing." / "{Town} chosen. Region set to {Region}." / "Region cleared. Choose a region in {Country}." | | | | |

### 6.2 Sign up (email/password)

| Field | Label | Helper | Empty | Format / rule | Server |
|---|---|---|---|---|---|
| First / Last name | First name / Last name | — | Enter your first name / last name | Shorten to 15 characters or fewer | — |
| Username | Username | — | Choose a username | — | 409: That username is taken. Try another. |
| Email | Email | — | Enter your email address | Enter an email address like name@example.com | 409: This email already has an account. **Sign in** instead. |
| Phone | as §6.1 (same component) | as §6.1 | as §6.1 | as §6.1 | as §6.1 |
| Gender | Gender | — | Choose your gender | — | — |
| Role | Role | — | Choose Customer or Artisan | — | — |
| Password | Password | At least 8 characters with letters, numbers, and symbols | Create a password | Use at least 8 characters, with a letter, a number and a symbol | — |
| Confirm | Confirm password | — | Re-enter your password | These passwords don't match | — |
| Button | Create account / Creating account… | | | | |

### 6.3 Login, forgot, reset — unchanged from round 1
Login: "Enter your email address" / "Enter an email address like name@example.com" / "Enter your password";
wrong credentials stays a toast. Forgot: email as login. Reset: "Create a password" / the password rule /
"Re-enter your password" / "These passwords don't match"; bad token stays a toast.

---

## 7. Copy guidelines
- Sentence case for labels, buttons, headings; "Email", not "E-mail".
- Errors start with a verb and stand alone; never "Invalid", "is required", "XXX-XXX-XXXX", "MALE, FEMALE, or OTHER".
- Examples come from the selected country (GH `024 123 4567`, GH₵, Kumasi, East Legon).
- No Google wording beyond the D1 email hint. The only third-party credit on the page is the OSM footer.
- "(optional)" lowercase as a label suffix; "Recommended" only on the bio nudge.
- Sample people in any design, doc or test: obviously fictional, `@example.com` (PR3).

---

## 8. Component reuse map

| Need | Reuse | Change |
|---|---|---|
| Field wrapper / helper / error | `ui/field.tsx` | `FieldError` icon + `id`, no `role="alert"` |
| Text inputs | `ui/input.tsx` | none |
| Phone | `ui/phone-input.tsx` + `libphonenumber-js/max` | ISO value, `SUPPORTED_PHONE_COUNTRIES`, GH fallback, no placeholder, prop forwarding, aria-label, pinned Ghana |
| Gender, Role | `ui/select.tsx` (as `/signup`) | call-site `w-full data-[size=default]:h-10` on both pages |
| Town | `ui/input.tsx` + `ui/popover.tsx` (`PopoverAnchor`) + `ui/command.tsx` (`shouldFilter={false}`) | composition in `location-field.tsx` |
| Region | same + cmdk filtering over `regions/{CC}.json` | composition |
| Services, bio, banners, nudge | `checkbox`, `skeleton`, `button`, `textarea`, `badge` | none |
| Icons | lucide `CircleAlert`, `MapPin`, `ChevronDown`, `Check`, `Search`, `Loader2`, `Lightbulb` | — |

No new colour, token or hex. Passes `scripts/check-color-tokens.mjs`.

---

## 9. Dependencies and flags (plain language)

1. **Phone 409 code** `meta.error = "PHONE_NUMBER_IN_USE"` (PH9) — the field placement needs it.
2. **Field key on DTO 400s**, or the frontend maps the known messages to fields (V5).
3. **`/locations/suggestions` must return `[]` (200) on any upstream failure** (LOC8). The UI deliberately has no
   "service unavailable" state; an error status would need one.
4. **Proxy filtering of facilities** (R17: power plants, a flour mill) — otherwise such rows appear in Town.
5. **Privacy flag outside this feature (for the user):** the app's root layout loads **Vercel Analytics**
   (`@vercel/analytics`, `<Analytics />` in `src/app/layout.tsx`), which requested `va.vercel-scripts.com` when
   `/signup` was rendered locally. Under the round-3 wish ("nor the application"), the user may want to decide
   whether that stays.
6. **PR3 flag (for the user):** `JIN_VA-BACKEND/src/database/seeds/seed.ts` uses **`@gmail.com` addresses**
   for its seed customers (e.g. lines 230–266). They look made-up, but a gmail address can belong to a real
   person. Recommend moving them to `@example.com`. The mockups do not use them.
7. **B1 + B2 ship together**, or the artisan success copy is false.

---

## 10. Decisions — status after round 2

| # | Decision | Status |
|---|---|---|
| D1 | Validation timing (§1.4) | Standing (round 1) |
| D2 | One message slot (§1.3) | Standing (round 1) |
| D3 | Email hint | **Answered by D1:** keep "The Google account you signed in with." |
| D4 | Location shape | **Answered by D2:** Town + required Region, both with suggestions (Photon + GeoNames) |
| D5 | Gender control | **Answered by D3/D5:** `/signup` Select, Male/Female, required |
| D6 | No placeholders | Standing; extended to `/signup` and the phone component |
| D7 | Bio optional + nudge + empty state | Standing |
| D8 | Layout reorder | **Answered by D6:** `/signup`'s order and frame |
| D9 | Phone required for customers | **Answered by D4:** required for everyone, per-country |
| D10 | Signup gender rule | **Answered by D5:** required on both forms |

**For the user to look at in this round** (design choices made inside the decisions, not re-opened decisions):
- **R2-a** Region helper names the phone's country ("Regions in Ghana, from your phone number's country.") so the
  phone→location link is visible (§3.4.1).
- **R2-b** No suggestion is pre-highlighted; Enter/Tab never swap in the first suggestion (§3.4.2). This may need
  a plain combobox if cmdk can't be held with nothing selected.
- **R2-c** Choosing a town jumps to Hourly rate (Region is already filled) (§3.4.2).
- **R2-d** The three layout fixes applied to `/signup` too: mobile padding, mobile H1 size, full-width 40px
  Select triggers (§3.9).
- **R2-e** "Your work" / "Optional — you can add these later" sub-headings — the only visual addition `/signup`
  doesn't have (§3.1 item 4).
- **R2-f** Region's closed-list error "Choose your region from the list" (blur) as a second message beside
  LOC1's "Choose your region" (submit).

---

## 11. Definition-of-Done crosswalk (design items)

| Requirement | Where satisfied |
|---|---|
| **V1** no native bubbles | §1.9 |
| **V2** inline errors, `aria-invalid` + `aria-describedby`, no field toasts | §1.1–1.3, §1.6, §3.5 (toasts removed); `field-states.html` |
| **V3** focus first error, scroll | §1.5 (r2 focus targets); `mobile-dark` frames 1–2 |
| **V4** timing once | §1.4 |
| **V5** server errors on the field | §3.3 (409), §3.8; `mobile-dark` frame 3 |
| **V6** copy | §6, §7 |
| **V7** optional visible | §1.1; all mockups |
| **V8** contrast, announced, not colour-only | §1.7 (+ popover row), §1.6, §1.2 |
| **DI2** phone autofill | §3.2, §3.3 table (autofill row) |
| **DI5** Select, Male/Female, required, enum keeps OTHER | §3.5; `field-states.html` gender rows |
| **DI6** defaults + tokens | §3.2, §3.6 |
| **DI7** no Google data/UI, no Google Maps | §3.6, §7; Photon not Places (§3.4) |
| **DI8** step counts | §4.2; `states` strip |
| **PH1** picker, GH pinned/preselected, ISO value, no placeholder, aria-label | §3.3; `mobile-dark` frame 5, `field-states` country list |
| **PH2** accepted inputs | §3.3 table |
| **PH3** paste/autofill sets country; unsupported code copy | §3.3; `field-states` paste + unsupported rows |
| **PH4** per-country validation + example copy | §3.3 copy table; `mobile-dark` frame 4 |
| **PH5** no live formatting, blur format, no `maxLength`, `tel` | §3.3 |
| **PH6** required for everyone | §3.2, §3.3, §6.2 |
| **PH7/PH8/PH10** E.164, backend, migration | backend; the UI submits E.164 (§3.3) |
| **PH9** 409 on the field | §3.3, §6.1; `mobile-dark` frame 3 |
| **PH11** settings pages | §3.3 last line, §2 #3 |
| **LOC1** two required fields, 2-up/stacked, errors | §3.4; `desktop-light` B, `mobile-dark` frame 2 |
| **LOC2** country-driven | §3.4.1; `field-states` "after country change" |
| **LOC3** 2 chars, 250 ms, ≤8, row format, keys, Enter doesn't submit | §3.4.2 |
| **LOC4** town fills Region, normalisation, never guessed | §3.4.2 |
| **LOC5** Region closed-list combobox | §3.4.3; `field-states` region rows |
| **LOC6** free text | §3.4.2; `states` empty frame |
| **LOC7** GeoNames static, credited | §3.4.3, §3.4.6 |
| **LOC8** service down → free text, no error | §3.4.2 table; `states` empty frame; §9 item 3 |
| **LOC9** OSM footer, browser never calls Photon | §3.4.2 footer, §3.4.4; all Town mockups |
| **LOC10** proxy | backend; request shape §3.4.4 |
| **LOC11** stored value | §3.4.5 |
| **LY1–LY6** frame, order, Role Select, shared components, rhythm, responsive | §3.1, §3.9, §3.10 |
| **LY7** spec + mockups revised | this document; the four regenerated mockups |
| **PR1** nothing personal reaches Photon | §3.4.4 (UI side: request content, `credentials: "omit"`) |
| **PR2** generic User-Agent | backend (§3.4.4 note) |
| **PR3** no personal data in docs/mockups | §2 (fictional people, example.com); §9 item 6 (seed flag) |
| **PR4** no live Photon in tests/verification | §3.4.4; this round's verification made zero external requests |
| **PR5** no location text logged | §3.4.4 (frontend: no storage/analytics/error reporting) |
| **PR6** email logs | backend only, no UI |
| **B1, B3, B4** | §3.7, §5; `states` bio surfaces |
| Four states; mobile + desktop; light + dark | §4.1; `states` (375 light + 1440 dark), `desktop-light`, `mobile-dark`, `field-states` (both themes) |
| R8, R9, R13, R17 | §3.4.2 (R8), §3.4.3/§3.5 (R9), §3.4.1 (R13), §9 item 4 (R17) |
