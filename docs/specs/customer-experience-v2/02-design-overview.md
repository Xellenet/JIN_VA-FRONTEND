# Customer Experience v2: Design overview (for owner approval)

| | |
|---|---|
| **Covers** | All six items in `01-requirements.md`, designed in three areas: Overview (items 1–2), Spending (item 4), Settings and inbox (items 3, 5, 6) |
| **Status** | Ready for product owner approval. No product code has been changed. Development starts only after approval. |
| **Date** | 30 October 2026 |
| **Detail** | Each area has its own `spec.md` under `design/`. This document is the shared language, the summary and the approval checklist. |
| **Data** | All people, emails, amounts and references are fictional. |

---

## 1. Design review: what was made consistent

The three areas were designed in parallel. In the review I compared them screen by screen and fixed the differences directly in the mockups (generators re-run, every PNG re-shot, 0px sideways scroll at every width).

| Area | Inconsistency found | Fix |
|---|---|---|
| All | Three different app shells: Spending used a placeholder "J" logo and a slightly different sidebar green; Settings used a smaller logo | One shell everywhere: the real `Logo` mark (32px, `text-2xl` wordmark), sidebar tokens from `globals.css` |
| Overview | Sidebar had no "Spending" entry, though §4.1 adds it after My Bookings | Added |
| Overview, Spending | Header unread badges were red; the app's `HeaderIconBadge` is forest green | Forest-green badge with a 1px ring in all mockups; Overview spec D10 corrected |
| Spending | Active sidebar item had an extra green dot no other screen has | Removed |
| Settings | Page title bold 24px; the other two are semibold 28px | Semibold 28px (24px on phones) everywhere |
| Spending | Page padding 32px vs 24px elsewhere, so the title sat 16px further right | 24px, same as Overview and Settings |
| Overview | List heading 16px; card titles in the other areas are 15px | 15px semibold is the shared card-title size |
| Overview | Load errors used the orange `--attention` colour, the same colour as "Needs your action" counts | Errors use `--destructive` tint (as Spending and Settings do). Orange now means only "this needs you" |
| Spending | Error titles "Your spending summary didn't load" | "Couldn't load your spending summary / payment history", matching "Couldn't load …" in the other areas (FR-2.8, FR-6.13) |
| Overview, Settings | Escrow line "Held by JinVa until you confirm the work is done" and "…the work is done" | FR-4.3's words everywhere: "Held safely until you confirm the job is done" |
| Spending | Row expand 150ms; inbox items 200ms | One disclosure timing: 200ms open / 160ms close |
| Spending | Focus ring `--ring` (2.6:1 in light, fails NFR-2.1); Overview used `--primary` | Shared rule: `--primary` in light, `--ring` in dark |
| Settings | Phone PNGs at 1× while the other areas are 2× | Re-shot at 2× |
| Coverage | FR-1.15 (list error), FR-2.2 (1024–1279 layout), FR-4.12 (no matching payments) and FR-4.18 (history failed) had no mockup | Four new mockups (marked **new** in §5) |

---

## 2. Shared visual language

### 2.1 Principle

JinVa is a quiet, forest-green work tool. **Each screen spends its boldness in one place**, always the deep green `--brand` surface, and always on the thing the customer came to that screen for:

| Screen | The one bold element |
|---|---|
| Overview | The selected stage and the filter bar joined to the list ("this list comes from that stage") |
| Spending | The statement band: Net spent, In escrow, Refunded, Payments |
| Settings → Payments | "Where your money goes": the escrow path |
| Bell and envelope | The open item's green spine |
| Profile photo | The avatar itself (no colour; the focal point is the photo) |

The **dot-and-line track** from the Overview is the product's signature idea and is reused: the escrow path in Settings, and "How paying works" in the Spending empty state. Closed (Overview) and Refunded (Settings) are both "set apart" behind a dashed divider.

### 2.2 Colour tokens (all existing, from `globals.css`; no new colours)

| Role | Token | Light | Dark | Used for |
|---|---|---|---|---|
| Action, selection, focus | `--primary` | #193b2a | #029e72 | Buttons, selected states, focus ring (light), header badges |
| The one bold surface | `--brand` / `--brand-foreground` | #193b2a / #fafafa | #052015 / #f5f5f5 | Filter bar, statement band, protection panel |
| Ink | `--foreground` | #0a0a0a | #f5f5f5 | Text |
| Secondary text | `--muted-foreground` | #737373 (4.7:1) | #8f8f8f | Labels, metadata, axis labels |
| Quiet surfaces | `--muted` | #f5f5f5 | #191e1c | Rail tint, table header, expanded rows |
| Hairlines | `--border` | #e5e5e5 | #222624 | Dividers, card outlines |
| Needs your action | `--attention` | #9f2d00 | #ff8904 | Only the Overview rail counts |
| Errors, failed | `--destructive` | #e7000b | #f93f4e | Load errors, failed payments, Remove photo |
| Unsaved | `--warning` | #894b00 | #ffb900 | "You have unsaved changes" dot |
| Status pills | `status-badges.ts` | unchanged | unchanged | Job and payment status |
| Charts | `--chart-1/3/4` | see Q-S1 | see Q-S1 | Spending only |

Rules: selection is never colour alone (fill + check/dot + weight); spending up or down is neutral grey (spending more is not good or bad); dark mode text on bright green is dark (`--card`), never near-white (3.1:1 fails).

### 2.3 Type scale (Geist only, tabular figures for all numbers)

| Step | Size / weight | Where |
|---|---|---|
| Statement figure | 60 / 600 (44 on phones), pesewas muted | Spending Net spent |
| Feature figure | 30–32 / 600 | Overview stage counts (24 on phones), rail spend total |
| Page title | 28 / 600, tight tracking (24 on phones) | "Welcome back, Kwame", "Your spending", "Account Settings" |
| Panel title | 17–18 / 600 | Bold-panel headings, sheet titles |
| Card title | 15 / 600 | Job list, chart cards, Payment history, settings sections |
| Row title / control | 14 / 500–600 | Rail rows, job titles, buttons, tabs |
| Body | 14 / 400 | Default text, helper text |
| Compact rows | 13 / 400 | Popover rows (raised from 11px), table secondary lines |
| Metadata | 12 / 400–500 | Dates, counts under labels |
| Badge | 11–12 / 500 | Status pills, count badges |

No all-caps labels except the sidebar's existing "MAIN" and "WORKSPACE".

### 2.4 Spacing, shape, layout

- **Page padding:** 24px desktop, 16px phones (32px from 1600px on the Overview).
- **Gaps:** 24px between blocks on desktop, 20px on phones.
- **Card padding:** 16px under 640px, 24px from 640px (FR-3.4).
- **Radius:** cards 12px; bold panels and the rail 16px; controls 6–8px; avatars and badges full.
- **Shell:** sidebar 224px, top bar 56px, both unchanged.
- **Touch targets:** 44px on phones for every control.
- **Breakpoints:** 360 / 390 phone, 640 sheet ↔ popover, 768 tablet, 1024 sidebar visible, 1280 Overview rail.

### 2.5 Motion (one moment per screen, every step off under reduced motion)

| Token | Value | Used for |
|---|---|---|
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Things arriving: stage fill check, Spending columns rising |
| `ease-standard` | `cubic-bezier(.2, .8, .2, 1)` | Disclosures: inbox items, history rows |
| `ease-travel` | `cubic-bezier(0.65, 0, 0.35, 1)` | Things moving along a path: the filter notch |
| Disclosure | 200ms open / 160ms close | Inbox items, Spending rows and cards |
| Swap | existing `data-swap`, 220ms | Overview list change |

| Screen | The one moment | Length |
|---|---|---|
| Overview | Choosing a stage: stage fills, bar appears, notch travels, list swaps | ≈ 320ms |
| Spending | "The year fills in": columns rise, bars grow, on load and on period change | ≤ 900ms |
| Bell / envelope | The item opening, spine drawing down | ≈ 200ms |
| Settings, Profile | None (instant swaps) | — |

Nothing loops, flashes or counts up; first load of the Overview list does not animate (FR-1.19).

### 2.6 Shared component names (for hand-off)

| Name | Built from | Areas |
|---|---|---|
| `JobTrack` (existing) | Stage stops with `aria-pressed` | Overview |
| `OverviewFilterBar` | `Badge`, `Button variant="ghost"` | Overview |
| `AccountRail` (`layout="rail" or "cards"`) | `Item`, `Badge`, `Avatar`, inline SVG sparkline | Overview |
| `SpendingStatement` | Plain section on `bg-brand` | Spending |
| `ProtectionPath` | `<ol>` on `bg-brand`, reuses the track idea | Settings, Spending empty state |
| `DisclosureItem` | `Collapsible` (or `Accordion type="single"`) | Bell, envelope, Spending history |
| `LoadError` | `Empty` pattern, destructive tint, "Couldn't load … / Try again" | All |
| `ResultLine` | `p role="status" aria-live="polite"` + "Clear filter / Clear all filters" | Overview, Spending |

Copy tone: plain, second person, sentence case, no internal status names. Shared phrases: "Couldn't load …", "Check your connection, then try again.", "Try again", "Too many requests, please wait a moment.", "Clear filter" (Overview, single stage) / "Clear all filters" (Spending, several filters), "Held safely until you confirm the job is done".

---

## 3. Per-area summary

### Overview: stage filters and right rail (items 1–2): `design/overview/spec.md`

- The selected stage becomes a solid green block with a check mark and a bold label. The other stages dim but stay clickable.
- A green filter bar joins the top of the list, with a notch pointing at the stage: "Showing [In progress ×] jobs only · 3 results", and **Clear filter** always on the right. This replaces "Show all stages".
- "Filter by stage" and "38 jobs in total" sit above the track so it reads as a filter. Each stage has its own empty-state hint, with Clear filter repeated.
- **Rail (≥ 1280px):** one tinted column holding Needs your action (orange counts, only non-zero rows), Next appointment and a Spending snapshot (total, neutral change, sparkline, escrow). At 1920 the gap to the right is 64px (limit 120px).
- **Below 1280px:** "Needs your action" goes above the track; the other two go below the list.

### Spending: report and payment history (item 4): `design/spending/spec.md`

- **Route and name:** `/dashboard/user/report`, called "Spending" in the page and the sidebar.
- **Layout:** the period selector (30 days, 90 days, 12 months, All time) sits above one deep-green statement band. Below it come four calm charts: Spending over time, What you spent on, Who you paid and How you paid. Each chart has a one-sentence summary and a Chart/Table switch.
- **Payment history:** search, Status (multi-select), Service and Artisan filters, "Clear all filters", a result line read out to screen readers, and Download CSV. On phones the filters open in a bottom sheet and the rows become stacked cards.
- **Data source:** the summary and the history load, and fail, independently.

### Settings → Payments, profile photo, bell and envelope (items 3, 5, 6): `design/settings-and-inbox/spec.md`

- **Payments tab:**
  - A "history has moved" banner.
  - One editable card with Preferred method as radio cards and a "Checkout order" strip, plus the mobile money network and an explicit Save. On phones the Save bar sticks to the bottom of the screen.
  - One read-only card: Receipts, and Payment protection drawn as the escrow path.
  - Nothing suggests saved cards.
- **Profile photo under 640px:**
  - The avatar is centred, with a 44px camera button.
  - "Upload new photo" and "Remove photo" are full width and stacked; Remove only shows when there is a photo and opens a confirmation.
  - Long emails wrap, and upload errors show inline under the buttons.
- **Bell and envelope:**
  - Each item opens in place, one at a time, with a green spine. Long text scrolls inside the item above 240px.
  - The menus are 400px wide with 13px text, and open as a bottom sheet on phones.
  - Photos are never loaded. Several unread messages stay unread until the conversation is opened.

---

## 4. Requirement coverage

Every FR with a UI has a mocked state, except the toast-only or text-only states listed under the table. Their exact copy is in the area specs.

| FR | Mockup(s) |
|---|---|
| FR-1.1, 1.3, 1.4, 1.5, 1.9–1.10 (focus, live text in HTML) | overview-1440-filtered, -390-filtered, -1440-filtered-dark |
| FR-1.2, 1.6, 1.11 | overview-1440, -390, -1920 |
| FR-1.7 Show more | overview-1920-filtered |
| FR-1.12 loading | overview-1440-loading |
| FR-1.13 empty account | overview-1440-empty, -390-empty |
| FR-1.14 filtered empty | overview-1440-filtered-empty, -390-filtered-empty |
| FR-1.15, 1.16 errors | overview-1440-error (counts + rail section), overview-1440-list-error (list) |
| FR-2.1 rail | overview-1440, -1920 |
| FR-2.2 smaller screens | overview-1024, overview-390 |
| FR-2.4 to 2.6, including the empty variants | overview-1440, overview-1440-empty |
| FR-2.7 loading, FR-2.8 error | overview-1440-loading, overview-1440-error |
| FR-3.1, 3.3, 3.4, 3.7 | profile-photo-360, -no-photo-long-email |
| FR-3.5 | profile-photo-360-uploading, -error |
| FR-3.6 | profile-photo-360-remove-confirm, -no-photo-long-email (no Remove) |
| FR-4.1 to 4.10 | spending overview-1440, -1440-dark, -390, -1440-filtered (Table view) |
| FR-4.11 to 4.13 | overview-1440-filtered, -390-filtered, filter-sheet-390, history-no-match-1440 |
| FR-4.15 to 4.18 | loading-1440/390, empty-1440/390, period-empty-390, error-1440, history-error-1440 |
| FR-4.19 deleted artisan | overview-1440 (row "Former artisan") |
| FR-5.1 to 5.4, 5.6 | payments-1440, -1440-dark, -390 |
| FR-5.8, 5.10 | payments-1440-states, payments-390-unsaved |
| FR-6.1 to 6.4, 6.9, 6.10 | notifications-1440-expanded, -expanded-dark |
| FR-6.5, 6.6 | messages-1440-expanded, messages-390-expanded, notifications-390(-expanded) |
| FR-6.11, 6.13, 6.15, 6.18, 6.20, 6.8 | inbox-states-1440 |
| FR-6.12 | notifications-1440 |
| FR-6.14, 6.16, 6.17 | messages-1440, -1440-expanded, -1440-expanded-several-unread |

**Described in the specs but not drawn:**
- **Toasts:**
  - "Photo updated" and "Photo removed".
  - The remove-failure toast with Try again.
  - "Payment preferences saved".
  - The CSV toasts.
- **States without a mockup:**
  - FR-1.7: the "See all {stage} jobs in My Jobs" link after 50 jobs.
  - FR-4.19: the "GH₵ 1.25M" short form for very large totals.
  - FR-3.2: the ≥ 640px profile layout, which is today's layout.
  - FR-3.8: the Booking Preferences switches removed.
- **Screen sizes without a mockup:** 768px for every area, and Spending at 1920 (see Q-X2).
- **Not drawn at all:** motion, because the mockups are static.

---

## 5. Mockup index for approval

Paths are relative to `docs/specs/customer-experience-v2/design/`. Size is the PNG in pixels. Phone PNGs are at 2× scale, so a 390px screen is 780px wide. **New** means the mockup was added in this review.

### Overview (15)

| Path | Screen | Size | State |
|---|---|---|---|
| overview/overview-1440.png | Overview, desktop | 1440 × 939 | Default, rail with data |
| overview/overview-1440-filtered.png | Overview, desktop | 1440 × 939 | In progress selected, 3 results |
| overview/overview-1440-filtered-empty.png | Overview, desktop | 1440 × 939 | Open selected, 0 jobs |
| overview/overview-1440-filtered-dark.png | Overview, desktop | 1440 × 939 | Filtered, dark mode |
| overview/overview-1440-empty.png | Overview, desktop | 1440 × 900 | New customer: no jobs, caught up, no appointment, no spend |
| overview/overview-1440-loading.png | Overview, desktop | 1440 × 900 | Skeletons everywhere |
| overview/overview-1440-error.png | Overview, desktop | 1440 × 900 | Counts failed ("–"), Spending section failed |
| overview/overview-1440-list-error.png | Overview, desktop | 1440 × 939 | **New.** Filtered, job list failed, filter kept |
| overview/overview-1024.png | Overview, small laptop | 1024 × 1472 | **New.** No rail: action card above the track, two cards below the list |
| overview/overview-1920.png | Overview, large monitor | 1920 × 1080 | Default, 64px right gap |
| overview/overview-1920-filtered.png | Overview, large monitor | 1920 × 1321 | Completed selected, 10 of 27 with Show more |
| overview/overview-390.png | Overview, phone | 780 × 3452 | Default |
| overview/overview-390-filtered.png | Overview, phone | 780 × 3020 | In progress selected |
| overview/overview-390-filtered-empty.png | Overview, phone | 780 × 3170 | Closed selected, 0 jobs |
| overview/overview-390-empty.png | Overview, phone | 780 × 2050 | New customer (action card hidden) |

### Spending (14)

| Path | Screen | Size | State |
|---|---|---|---|
| spending/overview-1440.png | Spending, desktop | 1440 × 3144 | Default, Last 12 months, June tooltip |
| spending/overview-1440-dark.png | Spending, desktop | 1440 × 3144 | Default, dark mode |
| spending/overview-1440-filtered.png | Spending, desktop | 1440 × 2466 | Status = Paid out, Service = Plumbing, row expanded, chart as Table |
| spending/history-no-match-1440.png | Spending, desktop | 1440 × 1002 | **New.** Filters set, no matching payment |
| spending/history-error-1440.png | Spending, desktop | 1440 × 900 | **New.** History failed, summary loaded |
| spending/error-1440.png | Spending, desktop | 1440 × 1955 | Summary failed, history loaded |
| spending/loading-1440.png | Spending, desktop | 1440 × 1414 | Skeletons |
| spending/empty-1440.png | Spending, desktop | 1440 × 900 | No payments ever, "How paying works" |
| spending/overview-390.png | Spending, phone | 780 × 7972 | Default |
| spending/overview-390-filtered.png | Spending, phone | 780 × 7720 | Filters applied, card expanded |
| spending/filter-sheet-390.png | Spending, phone | 780 × 1688 | "Filter payments" bottom sheet |
| spending/period-empty-390.png | Spending, phone | 780 × 1688 | Nothing in the last 30 days |
| spending/loading-390.png | Spending, phone | 780 × 3792 | Skeletons |
| spending/empty-390.png | Spending, phone | 780 × 1796 | No payments ever |

### Settings and inbox (21)

| Path | Screen | Size | State |
|---|---|---|---|
| settings-and-inbox/payments-1440.png | Settings → Payments, desktop | 1440 × 1470 | Saved, banner showing |
| settings-and-inbox/payments-1440-dark.png | Settings → Payments, desktop | 1440 × 1470 | Saved, dark mode |
| settings-and-inbox/payments-1440-states.png | Settings → Payments, board | 1440 × 2845 | Loading, error loading, unsaved, saving, error saving, suspended, Discard changes? |
| settings-and-inbox/payments-390.png | Settings → Payments, phone | 780 × 5180 | Saved, full scroll |
| settings-and-inbox/payments-390-unsaved.png | Settings → Payments, phone | 780 × 1688 | Unsaved change, sticky Save bar |
| settings-and-inbox/profile-photo-360.png | Profile photo, small phone | 720 × 2000 | Has photo |
| settings-and-inbox/profile-photo-360-no-photo-long-email.png | Profile photo, small phone | 720 × 1936 | Initials, no Remove, 48-character email |
| settings-and-inbox/profile-photo-360-uploading.png | Profile photo, small phone | 720 × 2000 | Uploading, buttons disabled |
| settings-and-inbox/profile-photo-360-error.png | Profile photo, small phone | 720 × 2206 | File larger than 5 MB |
| settings-and-inbox/profile-photo-360-remove-confirm.png | Profile photo, small phone | 720 × 1560 | Remove confirmation dialog |
| settings-and-inbox/notifications-1440.png | Bell popover, desktop | 1440 × 900 | Collapsed list |
| settings-and-inbox/notifications-1440-expanded.png | Bell popover, desktop | 1440 × 900 | Item expanded, focus on header |
| settings-and-inbox/notifications-1440-expanded-dark.png | Bell popover, desktop | 1440 × 900 | Expanded, dark mode |
| settings-and-inbox/notifications-390.png | Bell sheet, phone | 780 × 1688 | Collapsed |
| settings-and-inbox/notifications-390-expanded.png | Bell sheet, phone | 780 × 1688 | One item expanded |
| settings-and-inbox/messages-1440.png | Envelope popover, desktop | 1440 × 900 | Collapsed |
| settings-and-inbox/messages-1440-expanded.png | Envelope popover, desktop | 1440 × 900 | 600-character message expanded |
| settings-and-inbox/messages-1440-expanded-several-unread.png | Envelope popover, desktop | 1440 × 900 | 3 unread, stays unread |
| settings-and-inbox/messages-390.png | Envelope sheet, phone | 780 × 1688 | Collapsed |
| settings-and-inbox/messages-390-expanded.png | Envelope sheet, phone | 780 × 1688 | Long message scrolling inside the item |
| settings-and-inbox/inbox-states-1440.png | Bell and envelope, board | 1440 × 1880 | Loading, empty, error, photo, deleted contact, excerpt, hostile text, no valid id |

---

## 6. Open design questions for the owner

**Across all areas**
- **Q-X1 Focus ring.** `--ring` in light mode is 2.6:1, which fails NFR-2.1. The mockups use `--primary` for focus. Should we fix `--ring` across the app as one small separate change? (Recommended.)
- **Q-X2 Wide screens.**
  - At 1920 the Overview fills the width (64px gap), but Spending keeps a centred 1200px column, which leaves about 248px on each side.
  - Recommended: allow Spending up to 1440px at ≥ 1920, with the history table capped at 1200px. The NFR-3 "no band over 120px" rule then holds everywhere.
- **Q-X3 Sparkline vs chart colour.**
  - The Overview sparkline uses `--primary` (dark green). The Spending charts use the proposed lighter `--chart-1` green.
  - Recommended: keep `--primary` for the small sparkline. If Q-S1 is applied app-wide, switch the sparkline to `--chart-1` as well.
- **Q-X4 States not drawn.** Do you accept the toast-only and text-only states in §4 as specified, without mockups?

**Overview**
- **Q-O1 (D1)** Let the main column grow beyond about 880px, with Service and Posted columns from 1280px, so that the 1920 gap stays under 120px.
- **Q-O2 (D2)** There are three ways to clear one filter. Keep the chip × or drop it?
- **Q-O3 (D8)** Backend to add an optional `jobTitle` to single-item actions ("Confirm completion · Fix leaking kitchen sink")?

**Spending**
- **Q-S1 (D1)** Chart colours: green, amber and blue on the Spending page only, instead of today's orange `--chart-1`?
- **Q-S2 (D2)** Customer status labels:
  - "Awaiting payment" instead of "Pending".
  - "Held safely" instead of "Withheld", which would also match the escrow wording on all three screens.
  - "Paid to artisan" instead of "Paid out".
  - Sentence case.
- **Q-S3 (D4)** Should the payment history follow the chosen period (as specified) or always show all time?
- **Q-S4 (D6)** "Show all 9 artisans" needs the backend to return more than 5 artisans, or a second fetch. Backend to confirm.

**Settings and inbox**
- **Q-P1** Show the mobile money network only when Mobile money is the preferred method?
- **Q-P2** Network marks are placeholder monograms. Do we get permission to use the official MTN, Telecel and AirtelTigo logos?
- **Q-P3** Operations or legal check of the refund and escrow wording ("goes back to how you paid", "can't withdraw yet").
- **Q-P4** Confirm the 400px popover with 13px text, up from 384px and 11px.
- **Q-P5** Confirm the defaults the designs assume: Q6 = No, Q7 = No, Q8 = later, Q9 = No.

---

## 7. How the mockups are produced

The mockups are static HTML: Tailwind 3.4.17 CDN, Geist, and tokens copied from `globals.css`. They are generated, and screenshotted with Chrome under reduced motion, by scripts in the session scratchpad. Those scripts are not part of the repo. To change a mockup, edit its generator and re-run its shooter. The shooters fail loudly if a page scrolls sideways.
