/**
 * The artisan setup checklist (/dashboard/artisan/setup and the Overview's
 * "Finish setting up" card): the six steps, and whether each is done.
 *
 * Nothing here is saved as a "step done" flag. Every answer is worked out from
 * the artisan's real data, read from the endpoints the rest of the app already
 * uses, so the checklist is right on any device and can't drift:
 *
 *   services  `GET /users/me/artisan-profile` → at least one service AND an
 *             hourly rate (the starting price clients filter on)
 *   area      the same profile → a non-blank `location` ("Osu, Greater Accra")
 *   profile   the account's `profilePicture` AND a non-blank `bio`
 *             (business name is optional and never counted)
 *   hours     `GET /availability/my` → at least one slot switched on
 *   payout    the profile's `payoutDestination` (or the older payout fields)
 *   verify    `GET /verification/me` → documents sent: PENDING, UNDER_REVIEW
 *             or APPROVED (or the profile already says `isVerified`).
 *             REJECTED counts as not done: they have to send them again.
 *
 * Search visibility is NOT a seventh rule of ours. It is the backend's own
 * persisted `isProfileComplete` (with `missingFields`), read exactly as the
 * Profile page's "Visible in search" badge reads it
 * (`readProfileCompleteness`): hourly rate + location + at least one service
 * (`computeProfileCompleteness` in the API). That is steps 1 and 2 here, so
 * the checklist and client search always agree.
 *
 * Same pure-module rule as `overview.ts` and `artisan-overview.ts`: no runtime
 * imports, so `scripts/test-artisan-setup.mjs` runs it through Node directly.
 */

export const SETUP_STEP_KEYS = ["services", "area", "profile", "hours", "payout", "verify"] as const
export type SetupStepKey = (typeof SETUP_STEP_KEYS)[number]

/** What a step does for the artisan, shown as a small tag. Never a promise of time. */
export type SetupStepPurpose = "search" | "choose" | "book" | "paid" | "badge"

export interface SetupStepCopy {
  key: SetupStepKey
  /** Step list label and the step screen's heading. */
  title: string
  /** One line under the heading on the step screen. */
  intro: string
  /** "Done when …", shown on the step screen so the rule is never a mystery. */
  doneWhen: string
  purpose: SetupStepPurpose
}

export const SETUP_STEPS: readonly SetupStepCopy[] = [
  {
    key: "services",
    title: "Your services and prices",
    intro: "Choose the work you take on from JinVa's list, then set your starting rate. Clients search by both.",
    doneWhen: "At least one service and a starting rate.",
    purpose: "search",
  },
  {
    key: "area",
    title: "Where you work",
    intro: "Your town and region, so clients near you can find you.",
    doneWhen: "Your town and region are saved.",
    purpose: "search",
  },
  {
    key: "profile",
    title: "Profile photo and bio",
    intro: "A clear photo of you and a few lines about your work. Clients read these before they choose.",
    doneWhen: "A photo and a bio are saved. A business name is optional.",
    purpose: "choose",
  },
  {
    key: "hours",
    title: "Working hours",
    intro: "The days and times you take bookings. You can add time off later in Calendar.",
    doneWhen: "At least one set of hours is switched on.",
    purpose: "book",
  },
  {
    key: "payout",
    title: "Payout method",
    intro: "Where your earnings are sent: mobile money or a bank account in your name.",
    doneWhen: "A payout method is saved.",
    purpose: "paid",
  },
  {
    key: "verify",
    title: "Get verified",
    intro: "Your Ghana Card or another ID, and a selfie. An admin checks them.",
    doneWhen: "Your documents are sent. Approval shows here as a status.",
    purpose: "badge",
  },
]

export const PURPOSE_LABELS: Record<SetupStepPurpose, string> = {
  search: "Needed to appear in search",
  choose: "Helps clients choose you",
  book: "Lets clients request bookings",
  paid: "Needed to get paid",
  badge: "Earns the verified badge",
}

export type VerificationFact = "none" | "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"

/** The fields of `GET /users/me/artisan-profile` the checklist reads. */
export interface SetupProfileFacts {
  services?: { id: string | number; name: string }[] | null
  hourlyRate?: number | string | null
  location?: string | null
  bio?: string | null
  businessName?: string | null
  isVerified?: boolean
  isProfileComplete?: boolean
  missingFields?: string[]
  payoutDestination?: { label?: string | null; last4?: string | null } | null
  payoutType?: string | null
  payoutAccountNumber?: string | null
}

export interface SetupFacts {
  profile: SetupProfileFacts
  /** The account has a profile photo (`profilePicture`). */
  hasPhoto: boolean
  /** `GET /availability/my` → `slots`. */
  slots: { dayOfWeek: number; isActive: boolean }[]
  verification: VerificationFact
}

export interface SetupStepState extends SetupStepCopy {
  done: boolean
  /** One short line: what's saved when done, what's missing when not. */
  detail: string
}

export interface SetupState {
  steps: SetupStepState[]
  doneCount: number
  total: number
  allDone: boolean
  /** The first step not done, in order; null when all six are. */
  firstUnfinished: SetupStepKey | null
  /**
   * The backend's own search gate: true / false, or null when the response
   * didn't say clearly (then nothing is claimed either way).
   */
  searchVisible: boolean | null
}

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** `"150"` → `"GH₵ 150.00"` (same output as `formatGhs`). */
export function formatRate(amount: number | string | null | undefined): string {
  const n = Number(amount)
  return `GH₵ ${(Number.isFinite(n) ? n : 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const hasText = (value: string | null | undefined) => typeof value === "string" && value.trim().length > 0

function hasRate(rate: number | string | null | undefined): boolean {
  if (rate === null || rate === undefined || rate === "") return false
  return Number.isFinite(Number(rate))
}

/**
 * The backend's verdict, read the same way as `readProfileCompleteness` in
 * `profile-completeness.tsx`: both fields must agree, or it's unknown.
 */
export function searchVisibility(profile: SetupProfileFacts): boolean | null {
  const missing = Array.isArray(profile.missingFields)
    ? profile.missingFields.filter((k) => typeof k === "string" && k.length > 0)
    : null
  if (missing === null) return null
  if (profile.isProfileComplete === true && missing.length === 0) return true
  if (profile.isProfileComplete === false && missing.length > 0) return false
  return null
}

function servicesStep(p: SetupProfileFacts): Pick<SetupStepState, "done" | "detail"> {
  const services = p.services ?? []
  const rate = hasRate(p.hourlyRate)
  if (services.length > 0 && rate) {
    const first = services[0].name
    const more = services.length - 1
    return {
      done: true,
      detail: `${more > 0 ? `${first} and ${more} more` : first}, from ${formatRate(p.hourlyRate)}`,
    }
  }
  if (services.length > 0) return { done: false, detail: "Add a starting rate" }
  if (rate) return { done: false, detail: "Choose at least one service" }
  return { done: false, detail: "Choose your services and a starting rate" }
}

function hoursStep(slots: SetupFacts["slots"]): Pick<SetupStepState, "done" | "detail"> {
  const activeDays = new Set(slots.filter((s) => s.isActive).map((s) => s.dayOfWeek))
  if (activeDays.size === 0) {
    return { done: false, detail: slots.length > 0 ? "All your hours are switched off" : "Add the days and times you work" }
  }
  if (activeDays.size === 7) return { done: true, detail: "Every day" }
  if (activeDays.size <= 3) {
    return { done: true, detail: DAY_ORDER.filter((d) => activeDays.has(d)).map((d) => SHORT_DAYS[d]).join(", ") }
  }
  return { done: true, detail: `${activeDays.size} days a week` }
}

function payoutStep(p: SetupProfileFacts): Pick<SetupStepState, "done" | "detail"> {
  const d = p.payoutDestination
  if (d) {
    const last4 = (d.last4 ?? "").slice(-4)
    const label = hasText(d.label) ? d.label!.trim() : "Payout method"
    return { done: true, detail: last4 ? `${label} ••${last4}` : label }
  }
  if (hasText(p.payoutType)) {
    const last4 = (p.payoutAccountNumber ?? "").replace(/\D/g, "").slice(-4)
    const label = p.payoutType === "bank" ? "Bank account" : "Mobile money"
    return { done: true, detail: last4 ? `${label} ••${last4}` : label }
  }
  return { done: false, detail: "Mobile money or a bank account" }
}

function verifyStep(v: VerificationFact, isVerified: boolean | undefined): Pick<SetupStepState, "done" | "detail"> {
  if (isVerified === true || v === "APPROVED") return { done: true, detail: "Verified" }
  if (v === "PENDING" || v === "UNDER_REVIEW") return { done: true, detail: "Sent, being reviewed" }
  if (v === "REJECTED") return { done: false, detail: "Not approved. Send them again" }
  return { done: false, detail: "Your ID and a selfie" }
}

function profileStep(hasPhoto: boolean, p: SetupProfileFacts): Pick<SetupStepState, "done" | "detail"> {
  const bio = hasText(p.bio)
  if (hasPhoto && bio) return { done: true, detail: hasText(p.businessName) ? p.businessName!.trim() : "Photo and bio added" }
  if (hasPhoto) return { done: false, detail: "Add a short bio" }
  if (bio) return { done: false, detail: "Add a profile photo" }
  return { done: false, detail: "Add a photo and a short bio" }
}

export function deriveSetup(facts: SetupFacts): SetupState {
  const p = facts.profile
  const results: Record<SetupStepKey, Pick<SetupStepState, "done" | "detail">> = {
    services: servicesStep(p),
    area: hasText(p.location)
      ? { done: true, detail: p.location!.trim() }
      : { done: false, detail: "Add your town and region" },
    profile: profileStep(facts.hasPhoto, p),
    hours: hoursStep(facts.slots ?? []),
    payout: payoutStep(p),
    verify: verifyStep(facts.verification, p.isVerified),
  }
  const steps = SETUP_STEPS.map((copy) => ({ ...copy, ...results[copy.key] }))
  const doneCount = steps.filter((s) => s.done).length
  return {
    steps,
    doneCount,
    total: steps.length,
    allDone: doneCount === steps.length,
    firstUnfinished: steps.find((s) => !s.done)?.key ?? null,
    searchVisible: searchVisibility(p),
  }
}

/** `?step=` → a step key, or null for anything else. */
export function parseStepParam(value: unknown): SetupStepKey | null {
  return typeof value === "string" && (SETUP_STEP_KEYS as readonly string[]).includes(value)
    ? (value as SetupStepKey)
    : null
}

export type SetupView = SetupStepKey | "done"

/**
 * Where /setup opens: the `?step=` asked for (a step, or `done` for the
 * summary), else the first unfinished step, else the completion view.
 */
export function resumeView(state: Pick<SetupState, "firstUnfinished">, stepParam: unknown): SetupView {
  if (stepParam === "done") return "done"
  return parseStepParam(stepParam) ?? state.firstUnfinished ?? "done"
}

export function stepIndex(key: SetupStepKey): number {
  return SETUP_STEP_KEYS.indexOf(key)
}

/**
 * Where "Save and continue" goes from `current`: the next unfinished step
 * after it, else any unfinished step before it, else the completion view.
 */
export function nextView(state: Pick<SetupState, "steps">, current: SetupStepKey): SetupView {
  const i = stepIndex(current)
  const after = state.steps.slice(i + 1).find((s) => !s.done)
  if (after) return after.key
  const before = state.steps.slice(0, i).find((s) => !s.done)
  return before ? before.key : "done"
}

/** Where "Back" goes: the step before, or null on the first. */
export function previousStep(current: SetupStepKey): SetupStepKey | null {
  const i = stepIndex(current)
  return i > 0 ? SETUP_STEP_KEYS[i - 1] : null
}

/** "3 of 6 done". */
export function progressLabel(state: Pick<SetupState, "doneCount" | "total">): string {
  return `${state.doneCount} of ${state.total} done`
}

/** The search line under the progress: only what the backend actually says. */
export function searchLine(visible: boolean | null): string | null {
  if (visible === true) return "Clients can find you in search."
  if (visible === false) return "Clients can find you in search once your services, rate and area are saved."
  return null
}

/** sessionStorage key for "Hide" on the Overview card: back next session while steps remain. */
export const SETUP_CARD_HIDDEN_KEY = "jinva:setup-card-hidden"
export const SETUP_HREF = "/dashboard/artisan/setup"
