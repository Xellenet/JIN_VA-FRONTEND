# Item 4: Spending report and payment history (design spec)

| | |
|---|---|
| **Covers** | `01-requirements.md` §4 (FR-4.1 to FR-4.19, AC-4.1 to AC-4.8), NFR-1 to NFR-8, and the security items that affect the screen: SEC-17, SEC-18, SEC-19, SEC-21, SEC-22, SEC-25, SEC-27, SEC-33 |
| **Route** | `/dashboard/user/report`. The page title and sidebar label are both "Spending" (§4.1) |
| **Status** | Draft for product owner approval. No build starts before approval |
| **Data** | All people, amounts and references in the mockups are made up |

## 0. Files

| File | What it shows |
|---|---|
| `overview-1440.html/.png` | Default page (Last 12 months) at desktop width. The June column shows the hover/focus tooltip |
| `overview-1440-dark.html/.png` | The same page in dark mode |
| `overview-1440-filtered.html/.png` | History filtered by Status = Paid out and Service = Plumbing, one row expanded, and "Spending over time" switched to **Table** |
| `overview-390.html/.png` | Default page at phone width |
| `overview-390-filtered.html/.png` | Phone: filters applied, one card expanded |
| `filter-sheet-390.html/.png` | Phone: the "Filter payments" bottom sheet open |
| `empty-1440.html/.png`, `empty-390.html/.png` | No payments ever (FR-4.16) |
| `period-empty-390.html/.png` | Payments exist, but none in the chosen period (FR-4.17) |
| `loading-1440.html/.png`, `loading-390.html/.png` | Skeletons at their final sizes (FR-4.15) |
| `error-1440.html/.png` | The summary failed to load while the history loaded (FR-4.18) |
| `history-error-1440.html/.png` | The history failed to load while the summary loaded (FR-4.18) |
| `history-no-match-1440.html/.png` | Filters set, no payment matches: "No payments match these filters" with Clear all filters (FR-4.12) |

The mockups are static. The PNGs were captured with reduced motion, so they show the final frame. Phone PNGs are at 2x.

---

## 1. Design rationale

**What the screen is for.** Kwame needs to answer "how much, on what, with whom, when" at the end of the month. Ama needs to check "have I paid, and is it safe?" on a phone. The page reads from top to bottom in the order of those questions:

1. **How much:** the statement band.
2. **When:** spending over time.
3. **On what:** what you spent on.
4. **With whom:** who you paid.
5. **How:** how you paid.
6. **Which payment exactly:** payment history.

**Where the boldness goes: the statement band.** The page has one deep green `--brand` band. It holds the four summary figures from FR-4.3, with Net spent set large (60px desktop, 44px phone, Geist 600, tight tracking, tabular figures). The pesewas are muted and "GH₵" is set smaller, so the number reads like a statement total rather than a widget. The band is the only coloured surface on the page. Everything below it is white cards with hairline borders, single-hue charts and plain tables, so the band stays the only loud element.

The band uses `--brand` rather than `--primary` because `--brand` stays deep green in dark mode, as globals.css intends for brand surfaces.

**The four cards are cells in one band, not four boxes.** FR-4.3 asks for four cards. They are drawn as four cells divided by hairlines inside one surface:
- The figures are one statement, and they should be read together.
- This avoids the "four identical rounded tiles" look.
- At 390px the band becomes a ledger: the large figure on top, then three label/value rows. Three side-by-side tiles at 390px cannot fit "GH₵ 13,570.00".

**Keeping JinVa's identity.**
- The empty state reuses the dot-and-line idiom from `job-track.tsx` to explain how paying works ("You pay for a job → We hold it safely → You confirm, the artisan is paid").
- The sidebar active item, tokens, status pills and type are unchanged.

**Plain words for every chart title.** "What you spent on", "Who you paid" and "How you paid" replace "By category", "By artisan" and "By method". Every chart has a one-sentence written summary under its title (FR-4.9, NFR-2.7). That sentence also answers the question without reading the chart.

**Charts are calm.**
- One series means one colour (`--chart-1`).
- Ranked horizontal bars, not pies (FR-4.5).
- No dual axes and no gradients.
- Gridlines are recessive.
- Only one direct value label on the over-time chart: the highest column.

---

## 2. Layout per breakpoint

The content column is at most 1200px wide, with 24px side padding on desktop (the same page padding as Overview and Settings) and 16px on phones.

### 1440 (also 1280 to 1920)

```
┌ sidebar 224 ┬───────────────────────────────────────────────────────────────┐
│ Overview    │ Spending                                     ☾  ✉2  🔔3  (KM) │ top bar 56
│ Post a Job  ├───────────────────────────────────────────────────────────────┤
│ Find Art.   │ Your spending                       [30 days|90 days|12 months|All time]
│ My Bookings │ What you have paid through JinVa…                              │
│▸Spending •  │ ┌─────────────── statement band (--brand) ──────────────────┐ │
│ My Jobs     │ │ Net spent in the last 12 months ⓘ │In escrow│Refunded│Paym.│ │
│ Favourites  │ │ GH₵ 14,820.00                     │GH₵ 650  │GH₵ 600 │ 19  │ │
│ Messages    │ │ [↗ 59% more] than the previous…   │Held sa… │Return… │Avg… │ │
│             │ │───────────────────────────────────────────────────────────│ │
│ Settings    │ │ Your largest payment: GH₵ 2,400.00 for Rewire 3-bedroom…  │ │
│ Support     │ └───────────────────────────────────────────────────────────┘ │
│             │ ┌ Spending over time (2/3) ───[Chart|Table]┐┌ What you spent on (1/3)┐
│             │ │ summary sentence                          ││ Plumbing  5,200  35%  │
│             │ │  ▁ ▃ ▂ _ ▃ ▄ ▂ ▅ ▃ █ ▄ ▆                  ││ ███████████████       │
│             │ └───────────────────────────────────────────┘└───────────────────────┘
│             │ ┌ Who you paid (2/3): table with bar ───────┐┌ How you paid (1/3) ───┐
│             │ │ KA Kofi Asante  4  18 Oct 2026 ━━━ 3,780  ││ ━━━━━━━━━━━━━━━━━━━━  │
│             │ │ Show all 9 artisans ⌄                     ││ ■ Mobile money 8,420  │
│             │ └───────────────────────────────────────────┘└───────────────────────┘
│             │ ┌ Payment history ──────────────────────────────── [Download CSV] ┐ │
│             │ │ [🔍 Search job title or reference] [Status ⌄][Service ⌄][Artisan ⌄]│
│             │ │ 5 of 21 payments match your filters.  ✕ Clear all filters       │ │
│             │ │ Date paid │ Job/service │ Artisan │ Method │ Amount │ Status │ Ref │›│
│             │ │ Showing 1–20 of 21                    ‹ Previous [1] 2 Next ›   │ │
└─────────────┴───────────────────────────────────────────────────────────────┘
```

- **Grid:** row 2 and row 3 are `grid-cols-3 gap-6`. The wide chart and the artisan table each take 2 columns.
- **1920:** the content column stays at 1200px and is centred. Per NFR-3 there must be no empty band wider than 120px. With the 224px sidebar, the left-over space is shared on both sides (about 248px each).
  - **Designer note D5:** if the owner wants the 120px rule applied literally here, raise the maximum width to 1440px at 1920. Rows 2 and 3 then keep their 2:1 split. Don't add a fourth column.

### 1024 to 1279

- The sidebar stays visible.
- The band keeps its four cells, with Net spent at `text-5xl`.
- Rows 2 and 3 become `grid-cols-2`: the over-time chart takes the full row, "What you spent on" and "How you paid" sit side by side, and "Who you paid" takes the full row.
- The Reference column moves into the expanded row.

### 768

- The sidebar is collapsed (hamburger).
- The band becomes 2×2, with Net spent across the top row.
- Every chart card takes the full width.
- The history still shows the table, without the Method and Reference columns (both move into the expanded row).

### 390 (also 360)

```
┌───────────────────────────────┐
│ ≡ Spending        ☾ ✉ 🔔 (AO) │
│ Your spending                 │
│ What you have paid…           │
│ [30 days|90 days|12 mo|All]   │  4-up segmented, 44px tall
│ ┌ band ─────────────────────┐ │
│ │ Net spent in the last 12… ⓘ│ │
│ │ GH₵ 14,820.00 (44px)      │ │
│ │ [↗ 59% more] than the…    │ │
│ │───────────────────────────│ │
│ │ 🔒 In escrow   GH₵ 650.00 │ │  ledger rows
│ │ Held safely until…        │ │
│ │ Refunded       GH₵ 600.00 │ │
│ │ Payments               19 │ │
│ │───────────────────────────│ │
│ │ Your largest payment: …   │ │
│ └───────────────────────────┘ │
│ Spending over time  [▥][▦]    │  icon-only toggle, 44px targets
│ What you spent on             │
│ Who you paid (list)           │
│ How you paid                  │
│ Payment history         [⤓]   │
│ [🔍 Search…………………………]      │
│ [⚟ Filters (2)] Plumbing, Paid out
│ 5 of 21 payments match…       │
│ ✕ Clear all filters           │
│ ┌ card ─────────────────────┐ │
│ │ Unblock main drain      ⌄ │ │
│ │ Plumbing, Kwabena Owusu   │ │
│ │ [✓ Paid out]   GH₵ 450.00 │ │
│ │ 26 Aug 2026               │ │
│ │ ┌ details (2 columns) ──┐ │ │
│ └───────────────────────────┘ │
│ Showing 1–20 of 21  ‹ Page 1 of 2 › │
└───────────────────────────────┘
```

- **360:** the segmented control labels stay as they are ("12 months" at 13px fits a 82px cell).
- **Large totals (FR-4.19):** Net spent switches to the short form "GH₵ 1.25M" when the full figure is wider than its container. The check is a measurement in a layout effect, not a character count. The exact value stays in the `aria-label` and in a Tooltip on focus or tap.
- **Ledger rows** are `whitespace-nowrap` for the value. Values up to "GH₵ 999,999.99" fit at 360px. Larger values use the same short form.
- **Phone history page size:** the phone mockup shows 8 of the 20 cards on page 1, to keep the image short. The page size is 20 at every width.

---

## 3. Component inventory (mapped to `src/components/ui`)

| Element | Built from | Notes |
|---|---|---|
| Sidebar entry "Spending" | `dashboard/sidebar.tsx` `userLinks` | Placed after "My Bookings", with the `Wallet` icon. `PAGE_TITLES.report = "Spending"` |
| Period selector | `toggle-group.tsx` (`type="single"`) | Uses `aria-pressed`. The selected item is raised (card surface, ring and semibold), not only recoloured. It writes `?range=` (SEC-19 allowlist) |
| Statement band | Plain `section` on `bg-brand`, same as the auth hero surface | Each cell is a `dl` group. The ⓘ uses `tooltip.tsx` (on phones, `popover.tsx`, because hover is not available) |
| Change chip | `badge.tsx` (variant `outline`, white/10 fill) | Arrow icon plus words ("59% more"). It is neutral, never green or red, because spending more is not good or bad. Hidden for All time |
| Chart cards | `card.tsx` | Title `h3`, summary `p`, and a view toggle |
| Chart / Table toggle | `toggle-group.tsx` (size `sm`) | Icon plus label on desktop. Icon-only on phones, with `aria-label="Show as chart"` / `"Show as table"`. `aria-controls` points to the card body |
| Spending over time | `chart.tsx` `ChartContainer` + Recharts `BarChart` | Config key `c1` only (SEC-22). `ChartTooltip` with a custom content. See §6 for keyboard use |
| What you spent on | Semantic `ol` with HTML bars (`div` widths) | Designer note D3 |
| Who you paid | `table.tsx` (desktop) / `ul` (phone) + `avatar.tsx` (initials fallback) | Name links to `/dashboard/user/artisan/{id}` (typed id, SEC-18). "Show all 9 artisans" expands in place with `collapsible.tsx` |
| How you paid | Stacked HTML bar + legend `ul` | Swatch, icon, label, count, amount and %. Values are always written out |
| Table view of any chart | `table.tsx` with `caption` | Same numbers as the chart. Text only |
| Search | `input-group.tsx` + `input.tsx` | `maxLength=100`, debounced 300 ms, written to `?search=` |
| Status filter | `dropdown-menu.tsx` with `DropdownMenuCheckboxItem` | Multi-select. Trigger reads "Status" or "Status: Paid out" or "Status: 2 selected" |
| Service / Artisan filter | `select.tsx` | First option "All services" / "All artisans". Lists contain only services and artisans the customer has paid |
| Active filter trigger | `button.tsx` (outline) | Tinted `primary/6%` with a `primary/40` border, a ✓ icon and the value written in the trigger. Never colour alone (NFR-2.3) |
| Result line + Clear all filters | `p role="status" aria-live="polite"` + `button.tsx` (link variant with ✕) | "5 of 21 payments match your filters." Shown only when a filter is set (FR-4.12) |
| Phone filters | `drawer.tsx` (bottom sheet) | Title "Filter payments". Status as `checkbox.tsx` rows (48px tall), Service and Artisan selects. Footer: "Clear all filters" and "Show N payments" |
| History table | `table.tsx` + `collapsible.tsx` row | The row toggle is a real `button` with `aria-expanded`, in the last column. The whole row is also clickable, but the button is the accessible control |
| History cards (phone) | Existing Settings card pattern (FR-4.13) | Details are a 2-column `dl` |
| Status pill | `badge.tsx` + `getCustomerPaymentStatusConfig` | Labels unchanged (see D2) |
| Download CSV | `button.tsx` (outline). Icon-only on phones, with `aria-label` | Fetches B10 with the current filters. Shows a `spinner.tsx` while streaming. Uses `sonner` toasts for "Download started" and the 429 message |
| Pagination | `pagination.tsx` | Desktop: Previous, page numbers, Next. Phone: "Page 1 of 2" between icon buttons (44px) |
| Skeletons | `skeleton.tsx` | Final sizes (NFR-1.3) |
| Empty states | `empty.tsx` | See §4 |
| Error panel | `alert.tsx` styling in a card, `role="alert"` | "Try again" is `button.tsx` (outline) |

---

## 4. States and exact copy

### Page header (all states)

- **Heading:** Your spending
- **Subtitle:** What you have paid through JinVa, what it was for and who you paid.
- **Period labels:**

  | Button | Full name (title/aria) | `range` value |
  |---|---|---|
  | 30 days | Last 30 days | `30d` |
  | 90 days | Last 90 days | `90d` |
  | 12 months | Last 12 months | `12m` (default) |
  | All time | All time | `all` |

### Statement band (default)

**Net spent**
- **Label:** "Net spent in the {last 12 months | last 90 days | last 30 days}". For All time: "Net spent since you joined".
- **ⓘ tooltip:** "What you paid, minus refunds. Payments you didn't finish and failed payments aren't counted."

**Change line** (hidden for All time)
- **More:** "{n}% more than the previous {12 months | 90 days | 30 days} (GH₵ x)"
- **Less:** "{n}% less than…"
- **Same:** "The same as the previous {period}"
- **Previous period was zero:** "Nothing spent in the previous {period}". No percentage is shown.

**Other cells**

| Cell | Label | Value | Line under the value |
|---|---|---|---|
| In escrow | 🔒 In escrow | GH₵ x | "Held safely until you confirm the job is done" (FR-4.3) |
| Refunded | Refunded | GH₵ x | "Returned to you, already taken off net spent" |
| Payments | Payments | n | "Average GH₵ x" |

- **Highlight line (FR-4.8):** "Your largest payment: **GH₵ 2,400.00** for [Rewire 3-bedroom flat] on 12 Aug 2026."
  - The job title is a link built from `largestPayment.jobId` (SEC-4, SEC-18).
  - Hidden when there is no payment in the period.

### Chart titles and summaries

The summaries are generated from the data. Templates:

| Chart | Title | Summary template |
|---|---|---|
| Spending over time | Spending over time | "Highest in {bucket} at GH₵ x." + "Nothing spent in {a} or {b}." (up to 2 named; with more: "Nothing spent in {n} months.") |
| What you spent on | What you spent on | "{Top service} is {n}% of your spending." |
| Who you paid | Who you paid | "{Name} received the most: GH₵ x over {n} jobs." |
| How you paid | How you paid | "Most of your payments were by {method}." When no method is more than half: "Your payments were split between {a} and {b}." |

- **Bucket names:**

  | Bucket | Example |
  |---|---|
  | Month | "August 2026" |
  | Week | "the week of 3 Aug 2026" |
  | Day | "12 Aug 2026" |

- **Method names:** Mobile money, Card, Bank, Other.

### Payment history

- **Title:** Payment history
- **Subtitle:** "{n} payments in the {period}, newest first." For All time: "{n} payments, newest first."
- **Search placeholder:** "Search job title or reference"
- **Result line (live region):** "{n} of {total} payments match your filters." Pluralised (NFR-7.4): "1 of 21 payments matches your filters."
- **Clear button:** "Clear all filters" (✕ icon)
- **No matches:** the list body shows "No payments match these filters" / "Try another status, service or artisan." with a "Clear all filters" button (`history-no-match-1440`).
- **Columns:** Date paid, Job (with service under it), Artisan, Method, Amount (refund under it: "GH₵ 300.00 refunded"), Status, Reference, and a details button.
- **Expanded details:**

  | Item | Value |
  |---|---|
  | Reference | e.g. "JINVA-E8R4HM" |
  | Paid | "Thu 11 Jun 2026, 1:10 pm" (NFR-7.3) |
  | Paid to the artisan | Date and time, or "Not yet" |
  | Refunded to you | "GH₵ x", or "Nothing refunded" |

  Then the "View job" button.

**Edge rows**

| Case | What shows |
|---|---|
| Deleted artisan | "Former artisan", muted, not a link, initials avatar in the list (FR-4.19) |
| No method yet (`PENDING`) | Method shows "Not paid yet". Date paid shows the checkout date |
| `FAILED` / `CANCELLED` | The row text drops to `muted-foreground` and the status pill stays at full colour. No strike-through, which would read as "refunded" |

**Download**
- **Button:** "Download CSV"
- **Toasts:**

  | When | Toast |
  |---|---|
  | Download starts | "Your download has started" |
  | 400 from the range cap | "Narrow the date range to 24 months or less, then download again." |
  | 429 | "Too many requests, please wait a moment." (SEC-25). No automatic retry |

### Loading (FR-4.15)

- The band keeps its brand surface with white/10 blocks in the final positions.
- Charts show a column-shaped skeleton. Lists show bar-shaped rows. The table shows 6 rows (4 cards on phones).
- A screen-reader-only status reads "Loading your spending".
- The pulse animation stops under reduced motion.

### Empty: no payments ever (FR-4.16, AC-4.4)

- The period selector, charts, history and CSV are hidden.
- **Title:** You haven't made any payments yet.
- **Body:** When you pay for a job, you'll see where your money goes here.
- **How paying works** (the track idiom, an `ol` with `aria-label="How paying on JinVa works"`):
  1. **You pay for a job.** By mobile money, card or bank, through Paystack.
  2. **We hold it safely.** Your money stays in escrow while the work is done.
  3. **You confirm, the artisan is paid.** Only after you say the job is done.
- **Buttons:** "Post a job" (primary), "Find artisans" (outline).

### Empty period (FR-4.17)

- The band is replaced by a dashed card:
  - **Figure:** "Net spent in the last 30 days", "GH₵ 0.00" in muted text.
  - **Title:** No spending in the last 30 days
  - **Body:** Your earlier payments are still here. Choose a longer period to see them.
  - **Button:** "Show all time" (sets `range=all`).
- Charts are not drawn.
- The history card shows only its header, with "No payments in the last 30 days."

### Error / partial (FR-4.18)

The analytics block and the history list load and fail independently.

**Summary failed** (the band and the four charts become one panel, `role="alert"`)
- **Title:** Couldn't load your spending summary
- **Body:** The totals and charts couldn't be fetched. Your payment history below is up to date. Check your connection, then try again.
- **Button:** Try again

**History failed** (inside the history card)
- **Title:** Couldn't load your payment history
- **Body:** Check your connection, then try again.
- **Button:** Try again

**429** (in either block): "Too many requests, please wait a moment." The Try again button is disabled for the `Retry-After` seconds and shows a countdown ("Try again in 12 s").

### Filtered (AC-4.3)

- Every active control states its value ("Status: Paid out", "Service: Plumbing") and shows a ✓ icon.
- The result line and "Clear all filters" appear.
- On phones the Filters button shows a count badge, and the active values are written beside it: "Plumbing, Paid out".

### Expanded

- **Desktop:** the row toggles a full-width details row. The chevron rotates from › to ⌄.
- **Phone:** the details open as a tinted panel inside the card.
- Only one row is open at a time, as in Settings today.

### Dark mode

- The same layout, using the `.dark` tokens.
- The band uses dark `--brand` (deep green, below the sidebar's lightness).
- Charts use dark `--chart-1` (emerald).

---

## 5. Motion

**The one orchestrated moment is "the year fills in".** It runs on first load and on each period change:
- The over-time columns rise from the baseline: `scaleY` 0 to 1, 640 ms, `cubic-bezier(0.16, 1, 0.3, 1)`, staggered 40 ms left to right, starting at 120 ms.
- The ranked bars in "What you spent on", "Who you paid" and "How you paid" grow from the left in the same window: `scaleX`, 720 ms, staggered 50 ms.
- The total sequence is 900 ms or less.
- The statement band uses the existing `data-enter` fade only. There is no count-up on numbers, so screen readers and copy-paste always get the real value.

**Responses to an action** (not decorative):
- **Period change:** column heights tween to the new values over 250 ms. When the bucket count changes, the columns cross-fade instead.
- **Row or card expand:** height and opacity, 200 ms open / 160 ms close, `cubic-bezier(.2,.8,.2,1)`: the same disclosure timing as the bell and envelope items.
- **Chart / Table toggle:** a 120 ms cross-fade.

**Hover and focus:** the other columns drop to 40% opacity and the focused column gets a 2px ring in `--chart-1`. This is instant, with no transition.

**`prefers-reduced-motion: reduce`:**
- None of the above runs. Bars render at their final size.
- Skeleton pulse stops.
- Expand and collapse are instant.

The mockups put all of this behind `@media (prefers-reduced-motion: no-preference)`. In code, use the same guard as `[data-enter]` in globals.css.

---

## 6. Accessibility (WCAG 2.2 AA)

**Charts are never colour-only.**
- Single-series charts use one colour, and the meaning is in the labels.
- "How you paid" writes every method's name, count, amount and % next to its swatch. It also has an icon per method (phone, card, bank).
- The stacked bar has `role="img"` with a full text `aria-label` ("Mobile money 57%, card 39%, bank 4%").

**Text alternatives.**
- Every chart has a visible summary sentence and a Table view (FR-4.9, AC-4.6).
- Each table has a `caption`. Money is right-aligned with tabular figures.

**Keyboard on the column chart.**
- Each column is a focusable `button`. Zero buckets also get a 3px stub so they can be focused.
- Its `aria-label` is "{bucket}: GH₵ x, n payments", e.g. "June 2026: GH₵ 1,890.00, 2 payments".
- One tab stop enters the chart. Arrow Left and Right move between columns (roving `tabindex`). Home and End jump to the ends.
- Focus shows the same tooltip as hover.
- Recharts' own SVG gets `aria-hidden`. The buttons are an overlay layer of transparent hit areas at least 24px wide, so the accessibility tree is clean.

**Live regions.**
- The period change announces "Showing the last 90 days" (polite).
- Filter changes announce the result line (NFR-2.2).

**Focus.**
- 2px focus outline with a 2px offset on every control (NFR-2.1): `--primary` in light mode, `--ring` in dark, the shared rule from the Overview spec's D5.
- The sticky 56px top bar gets `scroll-margin-top: 72px` on focusable rows so focus is never hidden behind it (WCAG 2.4.11).

**Touch targets.**
- On phones these are all at least 44px: period buttons, view toggles, Filters, Download, pagination, checkbox rows and select triggers.
- The desktop table row toggle is 32px (24px minimum met).

**Selected states.**
- Period buttons use a raised surface plus semibold.
- Chart/Table toggles use a raised surface.
- Filter triggers use a ✓ icon plus the value written out.
- Checkboxes use a check glyph.

**Contrast.**
- Band text is white at 70% or more on `--brand` (#193b2a). That gives more than 7:1 for 80% white and about 6.5:1 for 65% white, so it passes AA for 13px text.
- Axis labels use `--muted-foreground` (4.7:1 on white).
- The amber method colour is below 3:1 on white (2.9:1). This is allowed because every value is also written as text (NFR-2.4, dataviz rule).

**Untrusted text (SEC-17, SEC-21).**
- Job titles, service and artisan names are rendered as text nodes with `dir="auto"`, `unicode-bidi: isolate` and `break-words`.
- Long titles wrap; they are never cut mid-word on phones.

**Reflow.** At 320px and at 200% zoom the page uses the phone layout, and nothing scrolls sideways. The history table is never shown below 768px.

**Drawer.** Focus is trapped while the drawer is open, Escape closes it, and focus returns to the "Filters" button (NFR-2.9).

---

## 7. Colour

- **Tokens:** all from globals.css: `--brand`, `--primary`, `--muted*`, `--border`, `--ring`, the status tokens, and `--chart-*`.
- **Status pills:** unchanged (`status-badges.ts`).
- **Validation:** the method palette was checked with the dataviz validator.

| Mode | Colours | Result |
|---|---|---|
| Light | `#17895b`, `#be8700`, `#3d78b2` | Passes. Worst CVD ΔE 8.4, normal-vision ΔE 19.5 |
| Dark | `#029e72`, `#ff9900`, `#ad4aff` | Passes CVD (ΔE 11.3). Amber sits slightly above the lightness band; see D1 |

---

## 8. Designer notes (decisions for the owner)

- **D1. Chart colours in light mode.**
  - **Problem:** light `--chart-1` is the shadcn default orange (`oklch(0.646 0.222 41)`), and light `--chart-3` (`oklch(0.398 0.07 227)`) fails the lightness band. Following FR-4.10 literally would paint the main chart orange on a forest-green product. In dark mode `--chart-1` is already emerald, so light and dark would also disagree.
  - **Proposal:** override three tokens on the Spending page wrapper only (`.spending-chart-tokens`), so artisan and admin analytics stay unchanged (§0.3 non-goal):

    | Token | New value | Approx. hex | Used for |
    |---|---|---|---|
    | `--chart-1` | `oklch(0.56 0.12 160)` | `#17895b` | Green, single-series and mobile money |
    | `--chart-3` | `oklch(0.66 0.14 80)` | `#be8700` | Amber, card |
    | `--chart-4` | `oklch(0.56 0.11 250)` | `#3d78b2` | Blue, bank |

    "Other" uses `--muted-foreground` at 45%.
  - **Dark mode:** keep the tokens. Optionally lower dark `--chart-3` lightness to 0.72 so it sits inside the band.
  - **Why this is still within FR-4.10:** the colours are still `var(--chart-n)` token references, and the config keys stay static (`c1`, `c3`, `c4`, `other`), so SEC-22 is unaffected.
  - **Alternative if the owner prefers:** change the light tokens app-wide, which needs a check of the artisan analytics page.

- **D2. Status labels.**
  - FR-4.11 says to keep existing customer labels. The table in §4.2 asks for `PENDING` to show as "Awaiting payment", but the existing label is "Pending". The mockups follow §4.2 ("Awaiting payment", because "Pending" is ambiguous next to "Withheld").
  - Two existing labels read oddly on a spending page:
    - **"Withheld"** (for `HELD`, `PENDING_TRANSFER` and `TRANSFER_FAILED`) sounds as if JinVa is keeping the customer's money. The band above calls the same money "In escrow, held safely". **Recommendation:** customer label "Held safely". Keep the `Lock` icon and the info tone.
    - **"Paid out"** reads as money paid to the customer. **Recommendation:** "Paid to artisan".
  - These label changes are not in the mockups because DT2 froze the labels. They need owner sign-off.
  - The mockups write "Paid out" in sentence case. The code today says "Paid Out", and the build keeps the code's casing unless the owner approves the change.

- **D3. HTML bars for the ranked lists.** "What you spent on", "Who you paid" and "How you paid" are drawn as HTML lists with `div` bars, not Recharts. Only "Spending over time" uses `ChartContainer`. Reasons:
  - The text and the bar sit in one DOM node, so the list itself is the accessible table.
  - It wraps cleanly at 360px.
  - It costs no extra JS (NFR-1.2).
  - It cannot inject CSS (SEC-22).
  - Colours still come from `--chart-*` tokens.
  - The "Table" toggle is still offered on each chart card for consistency, but on these lists it shows the same rows with counts as columns.

- **D4. Does the history follow the period?** FR-4.1 says the period applies to "every number and chart on the page", so the mockups scope the history to the period, and its subtitle names the period. As a result, finding a payment from 14 months ago means switching to All time first. If the owner wants the history always to cover all time, drop the period from the history query and change the subtitle to "{n} payments, newest first."

- **D5. 1920 width.** See §2. The mockups keep a 1200px maximum, which leaves about 248px on each side at 1920. That is wider than NFR-3's "no empty band over 120px". Pick one:
  - (a) allow 1440px at 1920 or wider, or
  - (b) accept the centred column on this page, because the rail does not exist here and long table lines get hard to scan beyond about 1300px.

  **Recommendation:** (a), with the history table capped at 1200px inside the wider column.

- **D6. "Show all" artisans.** It expands in place to the full list (up to 50 rows), not a dialog. The `byArtisan` payload must therefore include more than 5 rows, or the frontend fetches the rest on demand. Backend to confirm.

- **D7. Previous period is zero.** A percentage change from zero is meaningless, so the change line says "Nothing spent in the previous {period}" instead of "∞% more".

---

## 9. Hand-off checklist for frontend

- [ ] Sidebar entry and `PAGE_TITLES.report = "Spending"`. Remove the redirect.
- [ ] URL state: `range`, `status`, `serviceId`, `artisanProfileId`, `search`, `page`. All parsed through allowlists (SEC-19) and sent with `URLSearchParams`.
- [ ] Two independent queries (B2, B3), each with its own skeleton, error and Try again.
- [ ] `formatCurrency` for every amount, `en-GB` and `Africa/Accra` for dates.
- [ ] The motion guard matches globals.css `[data-enter]`.
- [ ] No spending data in `localStorage` or `sessionStorage` (SEC-33).
- [ ] Analytics events limited to `spending_range_changed {range}` and `spending_export` (SEC-34).
