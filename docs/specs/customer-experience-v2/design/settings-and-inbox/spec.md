# Design spec: Settings → Payments, profile photo, bell and envelope

| | |
|---|---|
| **Covers** | Item 5 (Settings → Payments), item 3 (profile photo on phones), item 6 (read in place in the bell and envelope menus) of `01-requirements.md` |
| **Status** | Draft for product owner approval. No development starts before approval. |
| **Date** | 30 October 2026 |
| **Assumes** | The recommended defaults in §10: **Q6 = No** (no mobile money number stored), **Q7 = No** (no separate receipt email), **Q8 = later** (no saved cards), **Q9 = No** (Reply opens the conversation). |

All people, emails and amounts in this spec and in the mockups are fictional.

---

## 1. Files in this folder

Each HTML file is self-contained (Tailwind CDN 3.4.17, Geist from Google Fonts, JinVa tokens hard-coded). Each has a PNG of the same name next to it. Phone PNGs (360 and 390) are at 2× scale, like the other two areas.

| File | Screen / state | Width |
|---|---|---|
| `payments-1440.html` | Settings → Payments, saved, "history has moved" banner showing | 1440 |
| `payments-1440-dark.html` | Same, dark mode (NFR-8.2) | 1440 |
| `payments-390.html` | Settings → Payments, phone, full scroll | 390 |
| `payments-390-unsaved.html` | Phone with an unsaved change and the sticky save bar | 390 |
| `payments-1440-states.html` | Board: loading, error loading, unsaved, saving, error saving, suspended, "Discard changes?" | 1440 |
| `profile-photo-360.html` | Profile photo card, customer has a photo | 360 |
| `profile-photo-360-no-photo-long-email.html` | No photo (initials, no Remove), 48-character email | 360 |
| `profile-photo-360-uploading.html` | Uploading: progress ring, both buttons disabled | 360 |
| `profile-photo-360-error.html` | File too large | 360 |
| `profile-photo-360-remove-confirm.html` | Remove confirmation dialog | 360 |
| `notifications-1440.html` | Bell popover, collapsed list | 1440 |
| `notifications-1440-expanded.html` | Dispute notification expanded, keyboard focus on its header | 1440 |
| `notifications-1440-expanded-dark.html` | Same, dark mode | 1440 |
| `notifications-390.html` | Bell bottom sheet, collapsed | 390 |
| `notifications-390-expanded.html` | Bell bottom sheet, one item expanded | 390 |
| `messages-1440.html` | Envelope popover, collapsed | 1440 |
| `messages-1440-expanded.html` | 600-character message expanded (AC-6.4) | 1440 |
| `messages-1440-expanded-several-unread.html` | Conversation with 3 unread expanded (AC-6.5) | 1440 |
| `messages-390.html` | Envelope bottom sheet, collapsed | 390 |
| `messages-390-expanded.html` | Envelope bottom sheet, long message expanded and scrolling | 390 |
| `inbox-states-1440.html` | Board: loading, empty, error, photo, deleted contact, message excerpt, hostile text, no valid id | 1440 |

---

## 2. Design direction

### 2.1 Tokens (unchanged from `globals.css`)

| Role | Light | Dark | Token |
|---|---|---|---|
| Forest green: actions, selection | `#193b2a` | `#029e72` | `--primary` |
| Brand surface: the one bold panel | `#193b2a` | `#052015` | `--brand` / `--brand-foreground` |
| Ink | `#0a0a0a` | `#f5f5f5` | `--foreground` |
| Quiet surfaces | `#f5f5f5` | `#191e1c` | `--muted` |
| Secondary text | `#737373` | `#8f8f8f` | `--muted-foreground` |
| Hairlines | `#e5e5e5` | `#222624` | `--border` |
| "Unsaved" marker | `#894b00` | `#ffb900` | `--warning` |
| Errors | `#e7000b` | `#f93f4e` | `--destructive` |

Type is Geist only. Scale used: 28/24 page title (semibold, tight; the same as "Welcome back" and "Your spending"), 17 panel title, 15 section title (semibold), 14 body and controls, 13 descriptive text and popover rows, 12 to 11 metadata. Numbers use tabular figures. No all-caps labels apart from the sidebar group labels that exist today.

### 2.2 Where the boldness goes (one place per screen)

- **Settings → Payments: "Where your money goes".** The Payment protection section is a deep brand-green panel that draws the escrow path the same way the Overview's job track draws a job: dots joined by a line, *You pay → JinVa holds it → The artisan is paid*, with **Refunded** set apart behind a dashed divider, as Closed is on the job track. Customers already know this visual idea from the Overview, and it answers the trust question ("where does my money go?") in a single picture. Everything else on the tab is quiet: hairline cards, radio cards, plain helper text.
- **Profile photo: the avatar.** A 96px portrait with the camera button sitting on its edge. The buttons below are plain full-width controls.
- **Bell and envelope: the open item.** The item that opens gets a 3px forest-green spine down its left edge and a faint green tint. It is the only coloured thing in the menu. Everything else stays in the existing neutral row style.

### 2.3 Plan review against the brief (what I changed and why)

- *First plan:* a two-column Payments page with the forms on the left and a "trust" sidebar on the right. *Changed* because it breaks the required section order (FR-5.1) on phones and splits a short page into two thin columns. *Now:* stacked sections, each a "label column | controls" row on desktop and a single column on phones. The reading order is the same at every width.
- *First plan:* a coloured "Checkout preview" mock of the Paystack page. *Changed* because it would suggest JinVa controls the Paystack screen. *Now:* a small numbered "Checkout order" strip (the order is a real sequence, so numbering is justified) that only shows what we really change.
- *First plan:* expanding items open a modal. *Changed* because FR-6.1 asks for in-place reading. *Now:* a disclosure inside the list.

---

## 3. Settings → Payments (item 5)

### 3.1 Layout

**1440 (desktop, content max 1080px, left-aligned with the tabs)**

```
┌ Sidebar ┐┌ Header: Settings                              ☾  ✉2  🔔3  (AO) ┐
│         ││ Account Settings                                                │
│         ││ Manage your personal information, notifications, payments…     │
│         ││ [Profile][Notifications][■ Payments][Security]                  │
│         ││ ┌───────────────────────────────────────────────────────────┐   │
│         ││ │(₵) Your payment history has moved to Spending  [Go to Spending] ✕│
│         ││ └───────────────────────────────────────────────────────────┘   │
│         ││ ┌ form: Payment preferences ─────────────────────────────────┐  │
│         ││ │ Preferred payment method │ [●MoMo] [○Card] [○No preference]│  │
│         ││ │ Choose which…            │ Checkout order (1 Mobile money)(2 Card)│
│         ││ │                          │ helper text                      │  │
│         ││ │──────────────────────────┼─────────────────────────────────│  │
│         ││ │ Mobile money network     │ [● MTN MoMo][○ Telecel][○ AT]    │  │
│         ││ │ Optional…                │ helper text        Clear network │  │
│         ││ │──────────────────────────┴─────────────────────────────────│  │
│         ││ │ Last saved 30 Oct 2026, 8:15 am              [Save changes] │  │
│         ││ └────────────────────────────────────────────────────────────┘  │
│         ││ ┌ Receipts                 │ (🧾) Receipts are sent to …  [Receipt email settings]
│         ││ │──────────────────────────┼──────────────────────────────────│ │
│         ││ │ Payment protection       │ ███ Where your money goes ██████ │ │
│         ││ │                          │ ●────●────●   ┊ ○ Refunded       │ │
│         ││ │                          │ 🔒 card fact   🛡 Paystack fact   │ │
│         ││ │                          │ A problem with a payment? Contact Support│
└─────────┘└─────────────────────────────────────────────────────────────────┘
```

- Rows: `grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-10 px-8 py-7`, hairline between rows.
- Two cards: the **editable form** (with its own footer and Save) and the **read-only information**. This keeps "what Save saves" unambiguous.

**390 / 360 (phone)**

```
┌ ≡ Settings          ☾ ✉ 🔔 (AO) ┐
│ Account Settings                │
│ [Profile][Notifications][■Payments][Sec…→  (scrolls; active tab scrolled into view)
│ ┌ banner ───────────────────✕ ┐ │
│ │ (₵)                          │ │
│ │ Your payment history has…   │ │
│ │ [      Go to Spending      ] │ │
│ └──────────────────────────────┘ │
│ ┌ Preferred payment method ────┐ │
│ │ (●) [▣] Mobile money …       │ │  radio cards stack, radio on the left
│ │ (○) [▭] Card …               │ │
│ │ (○) [▤] No preference …      │ │
│ │ Checkout order               │ │
│ │ (1 Mobile money) (2 Card)    │ │
│ │ Mobile money network         │ │
│ │ (●) MTN MoMo / Telecel / AT  │ │
│ │ Clear network                │ │
│ │ Last saved …                 │ │
│ │ [       Save changes       ] │ │  44px, full width
│ └──────────────────────────────┘ │
│ ┌ Receipts / Payment protection ┐ │
│ │ ● You pay                     │ │  the path turns vertical
│ │ │                             │ │
│ │ ● JinVa holds it              │ │
│ │ │                             │ │
│ │ ● The artisan is paid         │ │
│ │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │ │
│ │ ○ Refunded                    │ │
└──────────────────────────────────┘
```

When the form has unsaved changes on a phone, a **sticky bottom bar** appears ("You have unsaved changes", Cancel, Save changes), so Save is reachable without scrolling (`payments-390-unsaved`). It replaces the in-card footer while it is visible.

### 3.2 Components (mapped to `src/components/ui`)

| Part | Primitive |
|---|---|
| Tabs | `tabs.tsx` (existing, `?tab=payments`) |
| Banner | `alert.tsx` (custom tint `border-primary/20 bg-primary/[0.04]`) + `button.tsx` (`variant="outline"`) + an icon `button` for dismiss |
| Section cards | `card.tsx`; padding `p-4 sm:p-6` (FR-3.4) and `px-8` on the desktop rows |
| Preferred method, network | `radio-group.tsx` (`RadioGroupItem` inside a `<label>` card), `label.tsx` |
| Checkout order strip | Plain `<ol>`, `badge.tsx` style chips |
| Save / Cancel | `button.tsx`, `spinner.tsx` while saving |
| Discard dialog | `alert-dialog.tsx` |
| Loading | `skeleton.tsx`, sized to the final cards |
| Error loading | `empty.tsx` pattern |
| Toasts | `sonner.tsx` ("Payment preferences saved") |
| Protection panel | Plain markup on `bg-brand text-brand-foreground` |

Nothing on this tab is a card, expiry or CVV input (SEC-11). No `autocomplete="cc-*"` anywhere.

### 3.3 States

| State | What the customer sees |
|---|---|
| Loading | Skeleton of both rows and the footer. The information card renders straight away (it needs no data). |
| Loaded, saved | Radio cards show the saved values. Footer: "Last saved 30 Oct 2026, 8:15 am" (from `updatedAt`). **Save changes** is disabled. |
| No settings yet | "No preference" is selected and no network is selected. The footer shows no "Last saved" line. |
| Unsaved changes | Footer: amber dot + "You have unsaved changes", **Cancel** (restores the saved values) and **Save changes** enabled. On phones, the sticky bar. |
| Saving | Save shows a spinner and "Saving…". The radio groups are read-only. |
| Saved | Toast "Payment preferences saved". The footer goes back to "Last saved …". |
| Error saving | The customer's choices stay. The footer shows the server message in red with an icon (`role="alert"`), e.g. "Too many changes in a short time. Wait a minute, then save again." Save stays enabled. |
| Error loading | Inside the form card: "Couldn't load your payment settings", "Your payments still work as usual.", **Try again**. The information card still shows (FR-5.8). |
| Suspended | Controls at 60% opacity and disabled. The footer says "Your account is suspended, so you can't change payment settings. Contact Support". Save is disabled. "Clear network" is hidden. |
| Leaving with changes | `AlertDialog` "Discard changes?" / "Your new payment preferences haven't been saved." with **Keep editing** (focused first) and **Discard changes**. |
| Banner dismissed | The banner is removed. Only the boolean flag is stored (SEC-33). |

### 3.4 Exact copy

- Banner: **Your payment history has moved to Spending** / See every payment, what it was for and who you paid, with totals by month. / button **Go to Spending** / dismiss button `aria-label="Dismiss"`.
- Preferred payment method / Choose which method checkout shows first.
  - **Mobile money**: MTN MoMo, Telecel Cash or AirtelTigo Money.
  - **Card**: Visa or Mastercard, typed on Paystack's page.
  - **No preference**: Checkout shows every method in its usual order.
  - Checkout order: `1 Mobile money` `2 Card` (or reversed), or "Paystack's usual order".
  - Helper (FR-5.6), one per choice:
    - Mobile money: "We'll show Mobile Money first when you pay. You can still choose another method at checkout."
    - Card: "We'll show Card first when you pay. You can still choose another method at checkout."
    - No preference: "Checkout opens as it does today. You choose a method each time you pay."
- Mobile money network / Optional. The network you usually pay from. Options **MTN MoMo**, **Telecel Cash**, **AirtelTigo Money**. Helper: "We use this to show your network on the pay page. Paystack still asks for your mobile money number each time you pay." Text button: **Clear network**.
- Footer: "Last saved {d MMM yyyy, h:mm a}", "You have unsaved changes", **Cancel**, **Save changes**, "Saving…". Toast: "Payment preferences saved".
- Receipts / Where we send a receipt after each payment. "Receipts are sent to {account email}", button **Receipt email settings** (goes to `?tab=notifications` and scrolls to the "Payment receipts" switch). Helper: "Receipts always go to your account email. Turn receipt emails on or off in the Notifications tab."
- Payment protection / How JinVa keeps your money safe until the work is done.
  - Panel: **Where your money goes** / Your payment waits with JinVa until you confirm the job is done.
  - **You pay**: By card or mobile money, on Paystack's secure checkout.
  - **JinVa holds it**: The artisan can see the job is paid but can't withdraw the money yet.
  - **The artisan is paid**: Only after you confirm the job is done.
  - **Refunded**: If a dispute is decided in your favour, the money goes back to how you paid.
  - Facts: "Card details are typed on Paystack's page. They never reach JinVa, and JinVa never stores them." / "Every payment is processed by Paystack. JinVa keeps a record of what you paid and which method you used."
  - "A problem with a payment? **Contact Support**"
- Error loading: "Couldn't load your payment settings" / "Your payments still work as usual." / **Try again**.

Nothing on the page suggests saved cards or one-tap payment (AC-5.7).

### 3.5 Designer notes (requirements kept as written)

1. **Network without a number has little value on its own.** With Q6 = No, the network only changes a logo and some wording on the pay page. I kept the section as specified. I recommend showing it only when "Mobile money" is the preferred method, so the form is shorter for card payers. This is the owner's decision; the mockups show it always visible, as written.
2. **Clearing a radio group.** FR-5.4 makes the network optional, but a radio group cannot be unselected. I added a **Clear network** text button (it sends `momoNetwork: null`).
3. **Network marks.** The MTN, Telecel and AT tiles are monograms in the networks' colours, used as placeholders. Shipping real logos needs the official assets and permission to use them; until then use these monograms.
4. **Refund and escrow copy needs an operations/legal check** before release. In particular: "the money goes back to how you paid", and that artisans "can't withdraw" held money. The payment-protection text must match what JinVa really does.
5. **If Q6 changes to Yes**, the number goes under the network in the same row. It uses the existing `phone-input.tsx`. Once saved, it shows only masked (`+233 24 *** **67`) with **Change** and **Remove**, and a step-up dialog asks for the password or an email code (SEC-13). This is not mocked, because it is out of scope under the recommended default.

---

## 4. Profile photo on phones (item 3)

### 4.1 Layout

**< 640px** (`profile-photo-360*`), card padding 16px:

```
┌ Profile photo ───────────────────┐
│ Artisans see this on your jobs…  │
├──────────────────────────────────┤
│            ( photo )             │  96px avatar, camera button on the edge
│              [📷]                │  36px visual, 44px hit area
│           Ama Owusu              │  wraps, never widens the card
│     ama.owusu@example.com        │  overflow-wrap:anywhere + title attr
│ [ ⇪  Upload new photo          ] │  44px, full width, primary
│ [ 🗑  Remove photo             ] │  44px, full width, outline (only with a photo)
│   JPEG, PNG or WebP, up to 5 MB. │
└──────────────────────────────────┘
```

At **≥ 640px** the existing layout stays: avatar on the left, then a text column with `min-w-0` and `flex-wrap` buttons (`size="sm"`), and the email truncates with the full value in `title`.

Centring on phones makes the avatar the clear focal point, and gives the long email the full card width to wrap.

### 4.2 Components

`avatar.tsx` (`AvatarImage`/`AvatarFallback` with initials on `bg-primary`), `button.tsx`, `alert-dialog.tsx` for Remove, `sonner.tsx` toasts, `spinner.tsx`. The hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` stays as it is today.

### 4.3 States

| State | Behaviour |
|---|---|
| Has photo | Upload and Remove are shown. |
| No photo | Initials avatar ("AO"). **No Remove button** (AC-3.4). |
| Uploading | The photo dims and a progress ring with a spinner sits on it. Upload reads "Uploading…". Both buttons and the camera button are disabled. |
| Upload success | The new photo appears here and in the header and sidebar avatars without a reload. Toast "Photo updated". |
| Too large / wrong type | Inline `role="alert"` under the buttons: **This file is larger than 5 MB** / Choose a JPEG, PNG or WebP photo up to 5 MB. Wrong type: **This file type isn't supported**, with the same second line. Nothing is uploaded. |
| Remove: confirm | `AlertDialog` shows a before → after pair (photo → initials), the title **Remove your profile photo?**, the text "Artisans will see your initials instead.", and the buttons **Remove photo** (destructive) and **Cancel** (focused first). On phones the buttons stack full width. |
| Remove success | Initials everywhere. Toast "Photo removed". |
| Remove failure | The photo stays. Error toast "Couldn't remove your photo" with a **Try again** action. |

Also on this tab: the "Save Payment Method" switch is removed (FR-3.8). The other "Booking Preferences" switches follow Q12 (removed unless the owner wires them up).

### 4.4 Designer notes

1. Upload errors show **inline and not only as a toast**: a toast at the bottom of a phone screen is easy to miss and disappears. FR-3.5 only says "the message says what was wrong", so this is compatible.
2. The camera button's visual is 36px inside a 44px button, which meets NFR-2.5 without crowding the avatar.

---

## 5. Bell and envelope: read in place (item 6)

### 5.1 Layout

**Desktop (≥ 640px): popover**, `align="end"` under the icon. The width goes from 384 to **400px**, and the row text from 11–12px to **13px** for reading.

```
┌ Notifications  2 unread            Mark all read ┐
├──────────────────────────────────────────────────┤
▌(⚖) Dispute resolved                  2 h ago   ⌃ │  ← open item: 3px green spine, faint tint
▌     Your dispute on 'Fix leaking kitchen tap'…   │    full text, pre-wrap, dir=auto
▌     …within 5 working days.                      │
▌     Thu 30 Oct 2026, 2:14 pm                     │
▌     [View job]                                   │
├──────────────────────────────────────────────────┤
│(💬) New message from Kofi Asante   2 h ago  ●  ⌄ │  collapsed: one-line preview
│     Good afternoon Madam Ama, I checked the…     │
├──────────────────────────────────────────────────┤
│                View all notifications            │
└──────────────────────────────────────────────────┘
```

- List `max-h-[70vh] overflow-y-auto`. The popover never goes taller than the screen.
- The expanded text area scrolls on its own above 240px (`max-h-[240px] overflow-y-auto`), with a 28px fade at the bottom as a cue. The area is focusable (`tabindex="0"`, `aria-label="Full message"`) so keyboard users can scroll it.

**Phones (< 640px): bottom sheet** (`drawer.tsx`, vaul), `max-h-[85vh]`, with a grab handle, a title row with a 44px **Close** button, the list, and a footer link. Rows are at least 64px tall and action buttons are 44px tall, sharing the row width.

```
┌──── ═══ ─────────────────────────┐
│ Messages  1 unread            ✕  │
├──────────────────────────────────┤
▌(KA) Kofi Asante        1:52 pm ⌃ │
▌     Good afternoon Madam Ama,    │
▌     …(scrolls inside, fades)…    │
▌     Latest message, Thu 30 Oct…  │
▌     [Open conversation][⤺ Reply] │
├──────────────────────────────────┤
│(AB③) Abena Boateng   11:05 am ⌄  │
│                                  │
│        View all messages         │
└──────────────────────────────────┘
```

### 5.2 Anatomy of a row

- The **header is the disclosure button**: `aria-expanded`, `aria-controls`. It contains the icon or avatar, the title or sender, the relative time (`<time title="Thu 30 Oct 2026, 2:14 pm">`), an unread dot (with sr-only "Unread"), and a chevron that turns 180° when open. Unread is also shown by a **semibold title**, not by colour alone.
- When open, the header stays put, the one-line preview is hidden, and the title may wrap. The body panel (`role="region"`, labelled by the title) is indented to the text column (60px). It holds:
  - **Notification:** the full `body` (`whitespace-pre-wrap break-words`, `dir="auto"`, `unicode-bidi:isolate`), the full date, and one action from `notificationHref(type, payload)`: **View job**, **View booking**, **Open conversation** or **View payment**. There is no button when that function returns `null`.
  - **Message notification (100-character excerpt):** the text ends with "…", followed by the line "This is the start of the message. Open the conversation to read the rest." and the button **Open conversation**.
  - **Conversation:** the full `lastMessage.content` ("You: " prefix when it is mine), then "Latest message, Thu 30 Oct 2026, 1:52 pm", then **Open conversation** (primary) and **Reply** (outline, opens the thread with the reply box focused). There is no Reply for "Deleted user".
  - **Several unread:** a muted strip "**3 unread messages** · Open conversation to read all". Expanding does **not** mark it read (FR-6.17).
  - **Photo:** a dashed tile with an image icon, "Photo" and "Open conversation to view". `attachmentUrl` is never loaded (SEC-20).

### 5.3 Components

`popover.tsx` (desktop) and `drawer.tsx` (phones), switched by `use-mobile.tsx`. Each row: `collapsible.tsx` (Radix Collapsible: `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`) with single-open state held in the menu. `accordion.tsx` with `type="single" collapsible` also works and gives the same ARIA; use whichever the developers prefer, but Escape handling (§5.6) must be custom either way. Also `avatar.tsx`, `button.tsx` (`size="sm"` on desktop, `h-11` on phones), `skeleton.tsx`, `scroll-area.tsx` (optional) for the 240px area, and the existing `HeaderIconBadge`.

### 5.4 States

| State | Copy / behaviour |
|---|---|
| Loading | 3 skeleton rows (avatar circle + 2 lines). |
| Empty (bell) | **You're all caught up** / New notifications about your jobs and payments show up here. |
| Empty (envelope) | **No messages yet** / When you message an artisan, the latest reply shows up here. |
| Error | **Couldn't load notifications** (or **messages**) / Check your connection, then try again. / **Try again** |
| Collapsed | One-line previews. The "{n} unread" count is next to the title. **Mark all read** shows only when something is unread. |
| One expanded | As in §5.2. Opening another item closes the first (AC-6.3). |
| Read after open | After 1s open, the dot disappears, the title weight drops and the header badge goes down by one at once. If the server call fails, the item quietly returns to unread. |
| Polling while open | The open item stays open and in place. New items and reordering wait until the menu is reopened (FR-6.19). |
| Menu closed | Everything collapses (FR-6.7, SEC-33). |
| Hostile text | `<img src=x onerror=…>` and `<script>` render as literal characters. A 2,000-character unbroken string wraps inside the row (see the board). |

### 5.5 Motion: the one orchestrated moment

The disclosure opening is the only motion added in these three areas, and it answers the customer's tap:

1. 0 ms: the chevron starts its 180° turn (200 ms, `cubic-bezier(.2,.8,.2,1)`).
2. 0 ms: the body height grows from 0 to auto through `grid-template-rows: 0fr → 1fr` (200 ms, same curve), or Radix Collapsible's `--radix-collapsible-content-height` with `data-[state=open]:animate-collapsible-down`.
3. 0 to 240 ms: the green spine draws top to bottom (`scaleY 0 → 1`, origin top).
4. 60 ms: the body content fades from 0 to 1 opacity over 140 ms, so text does not appear before it has room.

Collapse runs the same steps in reverse in 160 ms. The bottom sheet uses vaul's own slide-up. **`prefers-reduced-motion: reduce`:** every step is instant (no transitions, no spine draw, no sheet slide beyond vaul's reduced-motion handling). No motion starts on its own; nothing loops or flashes.

The Payments tab adds no automatic motion. Choosing a method swaps the "Checkout order" chips instantly, and that is enough.

### 5.6 Keyboard and screen readers

- Tab order: header icon → (menu opens on Enter/Space) → "Mark all read" → item 1 → item 2 … → "View all". In an open item, Tab moves into its actions (and the scrollable text area) before reaching the next item.
- Enter/Space toggles an item. Focus **stays on the item header** when it opens (`notifications-1440-expanded` shows the 2px inset focus ring).
- Escape: the first press collapses the open item and focus stays on its header. The second press closes the menu and returns focus to the bell or envelope (NFR-2.9). The sheet traps focus.
- The badge has a label, e.g. `aria-label="Notifications, 2 unread"`. Marking an item read updates a polite live region: "Marked as read".

### 5.7 Designer notes

1. **"📷 Photo" uses an icon instead of the emoji.** Emoji render differently on each Android vendor and read as "camera" to screen readers. The visible word "Photo" is unchanged; the icon is `aria-hidden`.
2. **The popover is 400px wide, not 384, with 13px text.** FR-6.5 asks for reading long text in the menu, and the current 11px body text is too small for that. Width stays inside every desktop viewport (≥ 640px).
3. **"View payment"** depends on item 4's route (`/dashboard/user/report?…`). Until that ships, `notificationHref` returns the job's pay page or `null`.
4. The requirement's "{n} unread messages · Open conversation to read all" is used word for word. The "View all" footer stays as today.

---

## 6. Accessibility checklist (all three areas)

- Contrast: body text on white ≥ 4.5:1. `muted-foreground #737373` on white is 4.7:1. Brand-panel secondary text (`brand-foreground` at 75%) on `#193b2a` is about 8:1. In dark mode `#8f8f8f` on `#0e1311` is about 6:1. The disabled Save (`primary/40`) is exempt as a disabled control, but its state is also given by `disabled` / `aria-disabled`.
- Selection is never shown by colour alone: radio dots fill, selected cards gain a ring, unread titles are bold, and open items have a chevron turn and `aria-expanded`.
- Touch targets: every phone control is 44px (camera, close, dismiss, actions, Save).
- Reflow: tested at 360px with no horizontal scroll in any mockup. The 48-character email and the 2,000-character string both wrap.
- Radio cards: the whole card is the `<label>`. Arrow keys move within the group (Radix). The group has `aria-label`.
- The escrow path is an `<ol>` with sr-only "Step n:" prefixes. The Refunded branch comes after it in reading order.
- User text (names, titles, bodies, emails) uses `dir="auto"` and `unicode-bidi:isolate` (SEC-21).

## 7. Security reflected in the design

- No card fields anywhere. Payment settings show only the method and the network (SEC-10, SEC-11).
- Every popover action is a fixed internal route built from a typed id. None comes from the data, and a missing id means no button (SEC-18; see the board).
- All text is plain; markup in data shows as text (SEC-17, AC-6.6).
- Attachments are never loaded in the menus (SEC-20).
- The only browser storage is the banner-dismissed flag (SEC-33).
