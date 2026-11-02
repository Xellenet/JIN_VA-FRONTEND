# Overview: stage filters and the right rail (design spec)

| | |
|---|---|
| **Covers** | Requirements items 1 (FR-1.x) and 2 (FR-2.x) in `../../01-requirements.md`, plus NFR-1 to NFR-8 and SEC-17, SEC-18, SEC-19 and SEC-21 where they touch this screen |
| **Status** | Draft for product owner approval. No development before approval. |
| **Mockups** | The HTML and PNG files in this folder (listed in §11). All people and amounts are fictional. |
| **Files changed in build** | `src/app/dashboard/user/page.tsx`, `src/components/dashboard/job-track.tsx`, and new `src/components/dashboard/overview/*` (filter bar, rail sections) |

---

## 1. Design rationale

**The problem, as a customer sees it.** The four stage stops already filter the list, but a selected stop only gets a 7% green tint, so the filtered list looks like the whole list. "Show all stages" sounds like a display setting. On a 1920px monitor about 600px on the right is empty.

**Direction.** The job track stays JinVa's signature element: the line from Open to In progress to Completed, with Closed set apart. This screen spends its boldness in one place, which is **the filter state**:

1. The selected stop becomes a **solid forest-green block** with a check mark, a bold label and a reversed count. The other stops dim. You can see the state from across the room, and it does not depend on colour alone (fill, check, weight).
2. Directly under the track, a **forest-green filter bar** joins the top of the job list. A small notch on the bar points up at the selected stop, so the stop, the bar and the list read as one connected thing: "this list comes from that stop." The bar holds the sentence that says what is happening: *Showing [In progress ×] jobs only · 3 results*, with **Clear filter** always in the same place on the right.

Everything else stays quiet: the list card and the rail use the existing white and grey surfaces, hairline borders and Geist type. The rail is a single tinted column (`--muted`-family background) split by hairlines, not three floating cards. This makes it read as a different kind of thing from the job list ("your account at a glance" next to "your jobs") and avoids the same-card-everywhere look.

**Tokens.** No new colours. Everything comes from `globals.css`:

| Role | Token | Light | Dark |
|---|---|---|---|
| Selected stop fill, filter bar | `--primary` / `--brand` | #193b2a | stop `--primary` #029e72; bar `--brand` #052015 with a `--primary`/50 outline |
| Text on the selected stop | `--primary-foreground` (light), `--card` (dark) | #fafafa | #0e1311 (see designer note D4) |
| Rail surface | `--muted` at about 50% over `--background` | #f7f8f7 | #0b100e |
| Count badges in "Needs your action" | `--attention` + white (light), `--attention` + `--card` (dark) | #9f2d00 | #ff8904 |
| Status pills | existing `jobStatusConfig` | unchanged | unchanged |
| Focus ring | `--primary` in light, `--ring` in dark (see designer note D5; shared rule for all three areas) | #193b2a | #029e72 |
| Load errors (icon tint) | `--destructive` at 10% behind a `--destructive` icon. `--attention` orange is kept only for "needs your action" counts | #e7000b | #f93f4e |

**Type.** Geist only. Scale on this screen: 28/36 semibold (greeting), 30 semibold tabular (stop counts, desktop) / 24 (phone), 32 semibold tabular (spend total), 15 semibold (list heading, shared card-title size), 14 medium/semibold (rail section headings, row titles), 14 regular (body), 12 (phone stop labels). All numbers use `tabular-nums`.

---

## 2. Layout per breakpoint

The main content wrapper changes from `max-w-5xl` to a two-column grid at 1280px and above:

```
grid-template-columns: minmax(0, 1fr) 340px;  gap: 24px;            (1280–1599)
grid-template-columns: minmax(0, 1fr) 360px;  gap: 32px; padding 32; (≥1600)
max-width: 1600px; left-aligned in the content area
```

### 2.1 1440 × 900 (rail) — `overview-1440*.html`

```
┌────────┬──────────────────────────────────────────────────────────────────────┐
│JinVa   │ Overview                                         ☾  ✉2  🔔3  (KM)    │
│        ├──────────────────────────────────────────────────────────────────────┤
│Overview│ Welcome back, Kwame            [+ Post a job][Find artisans] ┌───────┐│
│Post a… │ 3 jobs in progress, 3 jobs waiting…                          │Needs  ││
│Find…   │                                                              │your   ││
│…       │ ≡ Filter by stage                         38 jobs in total   │action ││
│        │ ┌──────────────────────────────────────────────────────────┐ │ rows  ││
│        │ │ ●──────────█✓ 3 ██████──────●              ┊  ○         │ ├───────┤│
│        │ │ 3          █ In progress █  27             ┊  5         │ │Next   ││
│        │ │ Open       ████████████████ Completed      ┊  Closed    │ │appoint││
│        │ └──────────────────▲──────────────────────────────────────┘ ├───────┤│
│        │ ████ Showing [In progress ×] jobs only · 3 results  Clear filter ███│Spend- ││
│        │ │ In progress jobs                               Newest first│ │ing    ││
│        │ │ (YB) Rewire consumer unit…  Electrical  28 Oct  [Awaiting]>│ │ spark ││
│        │ │ (KA) Fix leaking kitchen…   Plumbing    24 Oct  [In prog.]>│ │escrow ││
│        │ └────────────────────────────────────────────────────────────┘ └───────┘│
└────────┴──────────────────────────────────────────────────────────────────────┘
 sidebar 224   main column ≈ 804                                        rail 340
```

- Sidebar 224px, content padding 24px, main column about 804px, rail 340px. Space right of the rail: 24px (the page padding).
- The rail's top lines up with the greeting, so the screen fills from the first line.
- From 1280px job rows gain two columns, **service** (112px) and **posted date** (96px). The posted date moves out of the subtitle. This makes use of the wider column and makes rows easy to scan for customers like Kwame with many jobs.

### 2.2 1920 × 1080 (rail) — `overview-1920*.html`

Same structure. Content padding 32px, rail 360px, gap 32px, main column about 1208px. Measured empty space right of the rail: **64px** (32px padding + 32px left over after the 1600px max width). This meets FR-2.1/AC-2.1 (< 120px).

### 2.3 1024–1279 (no rail)

Same as today's single column, full width up to 1100px. "Needs your action" sits between the greeting and the track (only when it has items). "Next appointment" and "Spending" sit side by side below the list.

### 2.4 768–1023

Sidebar collapses (hamburger). Single column. Bottom pair stays side by side (FR-2.2).

### 2.5 390 (and 360) — `overview-390*.html`

```
┌──────────────────────────────┐
│ ☰ Overview       ☾  ✉ 🔔 (AO)│
├──────────────────────────────┤
│ Welcome back, Ama            │
│ 2 jobs in progress, 1 job…   │
│ [+ Post a job][Find artisans]│
│ ┌ Needs your action ───────┐ │  only when ≥1 item
│ │ ✓ Confirm completion  (1)>│ │
│ │ ✉ Unread messages     (1)>│ │
│ └──────────────────────────┘ │
│ ≡ Filter by stage  10 in total│
│ ┌──────────────────────────┐ │
│ │●── █✓2█ ──●   ┊ ○        │ │
│ │1   █In p█  6  ┊ 1        │ │
│ └──────▲───────────────────┘ │
│ ███ Showing [In progress ×] ██│
│ ███ jobs only · 2 results  ███│
│ ███              Clear filter█│
│ │ In progress jobs  Newest… │ │
│ │ (KA) Fix leaking tap…    >│ │
│ │      [In progress]        │ │
│ └──────────────────────────┘ │
│ ┌ Next appointment ────────┐ │
│ │ [Fri 31 Oct] Tomorrow,…  │ │
│ └──────────────────────────┘ │
│ ┌ Spending ────────────────┐ │
│ │ GH₵ 640.00  ▲ … sparkline│ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- "Needs your action" goes **above the track**, not between the track and the list. FR-2.2 only asks for "above the job list", and this placement keeps the track, the filter bar and the list together, so the notch still points at the stop.
- "Next appointment" and "Spending" stack below the list as separate bordered cards.
- The track keeps today's one-row layout, which fits at 360px. The selected block uses the stop's own width, so nothing reflows when you select a stop.
- The filter bar wraps on phones. The sentence goes on the first line(s) and "Clear filter" sits right-aligned on the last line. It is always the last element, so it never jumps.

---

## 3. Component inventory

| Piece | Built from | Notes |
|---|---|---|
| Stage track | existing `JobTrack` / `Stop` (`job-track.tsx`) | New selected and dimmed styles (§4.1). Stage value `active` is renamed to `in_progress` to match the URL (`?stage=in_progress`). `parseStage()` per SEC-19. |
| "Filter by stage" label row | plain markup; `ListFilter` icon (lucide) | Right side: total count, skeleton, or inline error + Try again (`Button variant="link"`). Labels the group via `aria-labelledby`. |
| Filter bar | new `OverviewFilterBar`; chip = `Badge` restyled; × and Clear filter = `Button variant="ghost"` | Notch is a 14px rotated square, positioned with a CSS custom property `--notch-x` set from the selected stop's centre (measured in a `useLayoutEffect` + `ResizeObserver`). |
| Job list card | existing `<section>` + `JobRow` | Heading text changes; right side "See all jobs" (unfiltered, has jobs) or "Newest first" (filtered). Card loses its top radius when the bar is shown. |
| Show more footer | `Button variant="outline"` | "10 of 27 shown". After 50 rows: link "See all completed jobs in My Jobs" (FR-1.7). |
| Empty / filtered-empty / error | `Empty` (`components/ui/empty.tsx`) + `Button` | Copy in §8. |
| Skeletons | `Skeleton` | Sized like final content (NFR-1.3). |
| Rail wrapper | `<aside aria-label="Your account at a glance">` | ≥1280: one `rounded-2xl` tinted panel, sections split with `divide-y`. <1280: each section is its own `Card`. One component with a `layout` prop. |
| Needs your action | `Item` (`components/ui/item.tsx`) rows, `Badge` for counts | Only rows with count > 0 are shown. All zero → "You're all caught up". |
| Next appointment | `Item`, `Avatar`/`AvatarFallback`, `Badge` (success tone) | Date tile is decorative (`aria-hidden`); the date is also written out in text. |
| Spending | custom inline SVG sparkline (no Recharts on Overview, NFR-1.2), `Button variant="outline"` | `role="img"` + `aria-label` with the text summary (FR-2.6). |
| Live region | `<p class="sr-only" aria-live="polite">` | One per page, near the list. |

---

## 4. Interaction details

### 4.1 Stops

| State | Look |
|---|---|
| Default (no filter) | As today: dot (filled `--primary` if count > 0, outlined if 0), count in `--foreground`, label in `--muted-foreground`. Hover: `bg-muted/70`. |
| Selected | `bg-primary`, radius 10px, soft green shadow. The dot becomes an 18px circle in `--primary-foreground` with a 12px check (`Check`, stroke 3) in `--primary`, centred on the same point so the line still runs through it. Count and label in `--primary-foreground`; label semibold. The fill against the unselected outline colour (#e5e5e5) is 9.8:1 (FR-1.3 asks ≥ 3:1). |
| Dimmed (filter on, not selected) | Count and label `--muted-foreground`, filled dots at 45% opacity. Still focusable, still hoverable (hover brings back `bg-muted/70`). Line drops to `primary/20`. |
| Loading | Count is a 32×28 skeleton; button `disabled` up to 1 s, then shows "–" and becomes active (FR-1.12). |
| Count failed | "–" in `--muted-foreground`, outlined dot, `aria-label="Open: count unavailable"`. |
| Focus | 2px ring in `--primary` with a 2px `--card` offset. On the selected stop, the ring sits outside the filled block. |

`aria-pressed` on every stop. Accessible name: "In progress: 3 jobs". Pressing the selected stop clears the filter (FR-1.1).

### 4.2 Filter bar

- Appears only when a filter is on. It is in the DOM directly before the list `<section>`.
- Sentence: `Showing` · chip · `jobs only` · `· 3 results`. The chip *is* the stage name in the sentence, so the bar does not repeat the stage three times. Screen readers get the same meaning from the live region (§7).
- Chip ×: 20px visual, **44×44px hit area** (pseudo-element), name "Remove filter: In progress".
- "Clear filter": text button with an underline, min height 36px desktop / 44px phone, always the last item and right-aligned.
- After either control is used, focus moves to the list heading (`tabindex="-1"`), per FR-1.9.

### 4.3 Show more

10 rows, then "Show more" loads the next 10 in place. The new rows get `data-swap`. Focus stays on the button. When everything is loaded the footer is removed and focus moves to the first new row.

### 4.4 Rail rows

Whole row is the link (min height 44px). Single item → straight to the item (`jobId`); several → filtered list (SEC-18: `href` from the typed mapping only). The hover background is `--card` (on the tinted rail).

---

## 5. Every state

| State | Track | Bar | List | Rail | Mock |
|---|---|---|---|---|---|
| Default | counts | hidden | "Recent jobs", 5 rows, "See all jobs" | 3 sections with data | `overview-1440`, `-1920`, `-390` |
| Filtered | selected + dimmed | shown | "{Stage} jobs", up to 10 rows, "Newest first" | unchanged | `overview-1440-filtered`, `-390-filtered`, `-1440-filtered-dark` |
| Filtered, expanded (Show more) | — | "27 results" | 10 rows + "10 of 27 shown · Show more" | — | `overview-1920-filtered` |
| Filtered empty | selected stop shows 0 | "0 results" | "No open jobs right now" + hint + **Clear filter** (+ "Post a job" for Open only) | unchanged | `overview-1440-filtered-empty`, `-390-filtered-empty` |
| Empty account | all 0, outlined dots | hidden | "You have not posted a job yet" + Post a job; no "See all jobs" | All caught up / No upcoming appointments / first-payment message; phone hides "Needs your action" | `overview-1440-empty`, `-390-empty` |
| Loading | skeleton counts, disabled ≤ 1 s | hidden | 3 skeleton rows | each section a skeleton at final height | `overview-1440-loading` |
| Error, partial | "–" counts + "Couldn't load job counts. Try again" | (works if a filter is chosen) | loads normally | only the failed section shows "Couldn't load … Try again" | `overview-1440-error` |
| List error | counts fine | stays if filtered | "Couldn't load your jobs" + Try again; filter stays selected | unaffected | `overview-1440-list-error` |
| Overview endpoint fails completely | unaffected | | unaffected | all three sections show their own Try again (AC-2.6) | — |
| 429 | | | | "Too many requests, please wait a moment" instead of Try again for 30 s (SEC-25) | — |

The greeting sentence uses account-wide counts (FR-1.11). If the counts fail it reads "Your most recent jobs are below." rather than guessing.

---

## 6. Motion

**One orchestrated moment: choosing a stage.** Total about 320 ms, all transform and opacity:

| t (ms) | What moves | Spec |
|---|---|---|
| 0 | Selected stop fills | `background-color` 150 ms ease-out; dot to check: scale 0.6→1, 180 ms `cubic-bezier(0.16,1,0.3,1)` |
| 0 | Other stops dim | `color`/`opacity` 150 ms |
| 40 | Filter bar appears (from no filter) | `clip-path: inset(0 0 100% 0)` → `inset(0)` + opacity, 200 ms; the list below moves with it |
| 40 | Notch moves (filter to filter) | `translateX` to the new `--notch-x`, 240 ms `cubic-bezier(0.65,0,0.35,1)`, so it travels along the track |
| 100 | List rows swap | existing `data-swap` (220 ms fade + 4px rise) |

Clearing reverses the bar (160 ms) and swaps the list. **First load does not animate the bar or the list** (FR-1.19); the existing `data-enter` / `data-draw` entrance is kept as it is. Rail sections never animate except skeleton pulse.

`prefers-reduced-motion: reduce`: all of the above are instant (no transition), skeletons do not pulse. Nothing flashes.

---

## 7. Accessibility

- Stage group: `role="group"` labelled by "Filter by stage". Each stop is a `<button aria-pressed>`, so Tab and Enter/Space work.
- Selected state uses fill + check + bold, not colour alone (NFR-2.3).
- Live region (polite), exact strings:
  - select: "Showing 3 in progress jobs" / "Showing 1 open job" / "Showing 0 closed jobs"
  - clear: "Filter cleared, showing 5 recent jobs"
  - show more: "Showing 20 of 27 completed jobs"
- Focus after clearing goes to `#job-list-title` (FR-1.9).
- Contrast (light): #fafafa on #193b2a 11.8:1; #737373 on white 4.7:1; white on attention #9f2d00 7.4:1; white at 75% ("· 3 results") on #193b2a is above 7:1. Dark: #0e1311 on #029e72 5.5:1; #0e1311 text on the #ff8904 badge 7.9:1.
- Touch targets ≥ 44px on phones: stops (≈ 88×80), chip × (44 hit area), Clear filter (44), rail rows (44), buttons (40 high with 44 hit area).
- The sparkline is `role="img"` with the FR-2.6 summary. The month labels are `aria-hidden`. The full table alternative lives on the Spending report (NFR-2.7).
- User text (job titles, artisan names) renders as text nodes with `dir="auto"` and `unicode-bidi: isolate` (SEC-17, SEC-21). The stage label in the bar always comes from the parsed enum, never the URL (SEC-19).
- "▲" is `aria-hidden`, with "Up" as screen-reader text before the amount.
- Reflow at 320px and 200% zoom: the bar and the label row wrap; nothing scrolls sideways (checked: 0px overflow at 390 in all phone mocks).

---

## 8. Copy (exact)

| Where | Text |
|---|---|
| Track label | Filter by stage |
| Track total | {n} jobs in total / 1 job in total |
| Counts error | Couldn't load job counts. · button: Try again |
| Stop labels | Open · In progress · Completed · Closed |
| Filter bar | Showing [{Stage}] jobs only · {n} results (1 result) |
| Chip × name | Remove filter: {Stage} |
| Clear button | Clear filter (becomes "Clear all filters" only if Q1 adds multi-select) |
| List heading | Recent jobs / Open jobs / In progress jobs / Completed jobs / Closed jobs |
| List heading right | See all jobs (unfiltered) / Newest first (filtered) |
| Show more | {shown} of {total} shown · Show more |
| Past 50 | See all {stage} jobs in My Jobs |
| Filtered empty, title | No {stage} jobs right now |
| Hint: Open | A job is open while artisans can apply to it. Post a job and it will show here. |
| Hint: In progress | Jobs move here once you choose an artisan, and stay until the work is done. |
| Hint: Completed | Jobs move here when you confirm the work is finished. |
| Hint: Closed | Jobs move here when they are cancelled or expire without an artisan. |
| Empty account | You have not posted a job yet · Describe what needs doing and artisans near you can apply, or browse artisans and book one directly. · Post a job |
| List error | Couldn't load your jobs · Check your connection, then try again. · Try again |
| Rail: action | Needs your action · Confirm completion · Pay to start · Review applications · Unread messages |
| Rail: caught up | You're all caught up · Nothing needs you right now. Requests from artisans will show here. |
| Rail: appointment | Next appointment · View booking · {Service} · {Tue 4 Nov 2026} or Today, / Tomorrow, {Fri 31 Oct 2026} · {9:00 am – 11:00 am} · {Artisan} · Confirmed / Awaiting confirmation |
| Rail: no appointment | No upcoming appointments · Book an artisan |
| Rail: spending | Spending · {October 2026} · GH₵ 1,840.00 · ▲ GH₵ 420.00 vs September (▼ when lower; hidden when last month was 0) · In escrow · Held safely until you confirm the job is done (same words as FR-4.3 on the Spending page) · View spending report |
| Rail: no spend | Your spending will appear here after your first payment. |
| Rail: error | Couldn't load this / Couldn't load your spending · Try again |
| Greeting fallback | Your most recent jobs are below. |

---

## 9. Designer notes (where the requirements and the design differ, or need a decision)

- **D1. FR-2.1 "main column max about 880px" conflicts with "< 120px empty at 1920".** With an 880px main column and a 360px rail there are about 400px left over at 1920, whether left-aligned or centred (about 200px each side). The design lets the main column grow (`minmax(0,1fr)`) inside a 1600px wrapper. To keep wide rows useful, rows gain Service and Posted columns from 1280px. Please confirm.
- **D2. Chip and Clear filter together are three ways to clear one filter** (stop, chip ×, Clear filter). The design keeps all three as specified, but puts the chip *inside* the sentence ("Showing [In progress ×] jobs only"), so it does not repeat the stage name. If you want to simplify later, drop the chip ×; the stop and "Clear filter" are enough.
- **D3. "Needs your action" on phones goes above the track,** not just above the list. This keeps the track, bar and list together.
- **D4. Dark-mode selected stop uses dark text on bright green.** `--primary-foreground` in dark is near-white on #029e72, which is 3.1:1 and fails AA for the 14px label. The design uses `--card` (#0e1311) on `--primary` (5.5:1), in line with the DT1 "dark-on-bright" rule in `globals.css`.
- **D5. Focus ring.** `--ring` in light is #a1a1a1 (2.6:1 on white), below NFR-2.1's 3:1. The Overview controls use `--primary` for the ring in light mode. A global `--ring` change is suggested as a separate small fix.
- **D6. Spending change arrow is neutral grey, not red or green.** Spending more is not good or bad, and red/green would suggest a judgement.
- **D7. Rows with a count of 0 in "Needs your action" are hidden**, so the card shows only what needs doing. The card itself stays on wide screens (FR-2.4).
- **D8. Show the job title when an action has one item** ("Confirm completion · Fix leaking kitchen sink") would help, but B6 returns only `jobId`. Optional `jobTitle` (plain text, SEC-17) on single-item action entries is suggested for the backend. The design works without it.
- **D9. Rail is not sticky** (FR-2.3 default). On a 1920 screen with a long filtered list the rail ends before the list; this is fine and avoids covering content at 1280 × 720.
- **D10. Header badges** use the existing `HeaderIconBadge` style (forest-green `--primary` with a 1px `--background` ring), the same in all three design areas. They are unchanged by this work.

---

## 10. Hand-off notes for frontend

- Keep the stage literals in one place: `type Stage = 'open' | 'in_progress' | 'completed' | 'closed'`; `parseStage(searchParams.get('stage'))`; `router.replace` with `URLSearchParams`.
- Notch: the bar sets `style={{ '--notch-x': px }}`; the notch uses `translateX(var(--notch-x))` with the §6 transition. Recalculate on resize and on font load.
- New JS on the Overview route must stay within 25 KB gzipped (NFR-1.8): the sparkline is about 30 lines of SVG, no chart library.
- Rail data: one `GET /customers/me/overview` call in the browser (`cache: 'no-store'`), refetch on window focus at most every 30 s (FR-2.9). Section `null` → only that section falls back (FR-2.8).

---

## 11. Files

| File | What it shows |
|---|---|
| `overview-1440.html/.png` | Default, rail with data |
| `overview-1440-filtered.html/.png` | In progress selected, 3 results |
| `overview-1440-filtered-empty.html/.png` | Open selected with 0 jobs |
| `overview-1440-empty.html/.png` | New customer: no jobs, caught up, no appointment, no spend |
| `overview-1440-loading.html/.png` | Skeletons everywhere |
| `overview-1440-error.html/.png` | Counts failed ("–"), spending section failed, everything else works |
| `overview-1440-filtered-dark.html/.png` | Filtered, dark mode |
| `overview-1440-list-error.html/.png` | In progress selected, the job list failed; the filter and bar stay (FR-1.15) |
| `overview-1024.html/.png` | 1024–1279: sidebar, no rail; Needs your action above the track, Next appointment and Spending side by side below the list (FR-2.2) |
| `overview-1920.html/.png` | Default on a large monitor (64px right gap) |
| `overview-1920-filtered.html/.png` | Completed selected, 10 of 27 with Show more |
| `overview-390.html/.png` | Phone default (action card above the track, others below the list) |
| `overview-390-filtered.html/.png` | Phone, In progress selected |
| `overview-390-filtered-empty.html/.png` | Phone, Closed selected with 0 jobs |
| `overview-390-empty.html/.png` | Phone, new customer (action card hidden) |

Mockups are static. The motion in §6 is described, not animated. Phone PNGs are at 2× scale.
