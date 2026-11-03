#!/usr/bin/env node
/**
 * Artisan setup checklist rules, run against the shipped
 * `src/lib/artisan-setup.ts`: when each of the six steps counts as done (from
 * real data only), the search line (the backend's own `isProfileComplete`),
 * where /setup opens and where "Save and continue" goes.
 *
 * Run: `node --experimental-strip-types scripts/test-artisan-setup.mjs`. Same
 * convention as the other scripts here: no test runner, exit 1 on failure,
 * no network. Every name and number is made up.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const s = await import(pathToFileURL(join(process.cwd(), "src", "lib", "artisan-setup.ts")).href)

let failures = 0
let passed = 0
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    failures++
    console.error(`FAIL ${label}: expected ${e}, got ${a}`)
  } else passed++
}

const brandNew = {
  profile: { services: [], hourlyRate: null, location: null, bio: null, isVerified: false, isProfileComplete: false, missingFields: ["hourlyRate", "location", "services"], payoutDestination: null },
  hasPhoto: false,
  slots: [],
  verification: "none",
}
const finished = {
  profile: {
    services: [{ id: 1, name: "Plumbing" }, { id: 2, name: "Tiling" }],
    hourlyRate: "150.00",
    location: "Osu, Greater Accra",
    bio: "Fixing taps and pipes across Accra.",
    businessName: "Kwesi Mensah Plumbing",
    isVerified: false,
    isProfileComplete: true,
    missingFields: [],
    payoutDestination: { type: "mobile_money", label: "MTN MoMo", last4: "4567", accountName: "Kwesi Mensah", accountNameVerified: true },
  },
  hasPhoto: true,
  slots: [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, isActive: true })),
  verification: "PENDING",
}
const done = (facts) => s.deriveSetup(facts).steps.map((x) => x.done)
const with_ = (base, patch) => ({ ...base, ...patch, profile: { ...base.profile, ...(patch.profile ?? {}) } })

// ── Step order and the brand-new artisan ──────────────────────────────────────
check("step order", s.SETUP_STEPS.map((x) => x.key), ["services", "area", "profile", "hours", "payout", "verify"])
check("brand new: nothing done", done(brandNew), [false, false, false, false, false, false])
const fresh = s.deriveSetup(brandNew)
check("brand new: counts", [fresh.doneCount, fresh.total, fresh.allDone, fresh.firstUnfinished], [0, 6, false, "services"])
check("brand new: not in search", fresh.searchVisible, false)
check("brand new: details", fresh.steps.map((x) => x.detail), [
  "Choose your services and a starting rate",
  "Add your town and region",
  "Add a photo and a short bio",
  "Add the days and times you work",
  "Mobile money or a bank account",
  "Your ID and a selfie",
])

// ── Finished ──────────────────────────────────────────────────────────────────
const all = s.deriveSetup(finished)
check("finished: all done", [all.doneCount, all.allDone, all.firstUnfinished, all.searchVisible], [6, true, null, true])
check("finished: details", all.steps.map((x) => x.detail), [
  "Plumbing and 1 more, from GH₵ 150.00",
  "Osu, Greater Accra",
  "Kwesi Mensah Plumbing",
  "5 days a week",
  "MTN MoMo ••4567",
  "Sent, being reviewed",
])

// ── Step 1: services AND a rate ───────────────────────────────────────────────
check("services without a rate", s.deriveSetup(with_(brandNew, { profile: { services: [{ id: 1, name: "Plumbing" }] } })).steps[0], {
  ...s.SETUP_STEPS[0], done: false, detail: "Add a starting rate",
})
check("rate without services", s.deriveSetup(with_(brandNew, { profile: { hourlyRate: 80 } })).steps[0].detail, "Choose at least one service")
check("rate 0 still counts as set (backend checks null only)", s.deriveSetup(with_(brandNew, { profile: { services: [{ id: 1, name: "Tiling" }], hourlyRate: 0 } })).steps[0].done, true)
check("one service detail", s.deriveSetup(with_(brandNew, { profile: { services: [{ id: 1, name: "Tiling" }], hourlyRate: 95.5 } })).steps[0].detail, "Tiling, from GH₵ 95.50")

// ── Step 2: blank location is not done (backend trims) ───────────────────────
check("blank location", s.deriveSetup(with_(brandNew, { profile: { location: "   " } })).steps[1].done, false)

// ── Step 3: photo AND bio; business name optional ────────────────────────────
check("photo only", s.deriveSetup(with_(brandNew, { hasPhoto: true })).steps[2].detail, "Add a short bio")
check("bio only", s.deriveSetup(with_(brandNew, { profile: { bio: "Tiler." } })).steps[2].detail, "Add a profile photo")
check("whitespace bio", s.deriveSetup(with_(brandNew, { hasPhoto: true, profile: { bio: "  " } })).steps[2].done, false)
check("photo and bio, no business name", s.deriveSetup(with_(brandNew, { hasPhoto: true, profile: { bio: "Tiler." } })).steps[2], {
  ...s.SETUP_STEPS[2], done: true, detail: "Photo and bio added",
})

// ── Step 4: at least one slot switched on ─────────────────────────────────────
check("paused slots only", s.deriveSetup(with_(brandNew, { slots: [{ dayOfWeek: 1, isActive: false }] })).steps[3].detail, "All your hours are switched off")
check("few days listed Monday first", s.deriveSetup(with_(brandNew, { slots: [{ dayOfWeek: 0, isActive: true }, { dayOfWeek: 6, isActive: true }, { dayOfWeek: 6, isActive: true }] })).steps[3].detail, "Sat, Sun")
check("every day", s.deriveSetup(with_(brandNew, { slots: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, isActive: true })) })).steps[3].detail, "Every day")

// ── Step 5: payout destination, or the older fields ──────────────────────────
check("older payout fields", s.deriveSetup(with_(brandNew, { profile: { payoutType: "bank", payoutAccountNumber: "0012345678" } })).steps[4].detail, "Bank account ••5678")

// ── Step 6: sent counts; rejected does not ────────────────────────────────────
for (const [v, d, text] of [
  ["none", false, "Your ID and a selfie"],
  ["PENDING", true, "Sent, being reviewed"],
  ["UNDER_REVIEW", true, "Sent, being reviewed"],
  ["APPROVED", true, "Verified"],
  ["REJECTED", false, "Not approved. Send them again"],
]) {
  const step = s.deriveSetup(with_(brandNew, { verification: v })).steps[5]
  check(`verification ${v}`, [step.done, step.detail], [d, text])
}
check("isVerified wins", s.deriveSetup(with_(brandNew, { profile: { isVerified: true } })).steps[5].done, true)

// ── Search: only the backend's verdict ───────────────────────────────────────
check("search: complete", s.searchVisibility({ isProfileComplete: true, missingFields: [] }), true)
check("search: incomplete", s.searchVisibility({ isProfileComplete: false, missingFields: ["location"] }), false)
check("search: no missingFields is unknown", s.searchVisibility({ isProfileComplete: false }), null)
check("search: disagreeing fields are unknown", s.searchVisibility({ isProfileComplete: true, missingFields: ["location"] }), null)
check("search: never guessed from our steps", s.deriveSetup(with_(finished, { profile: { isProfileComplete: false, missingFields: ["services"] } })).searchVisible, false)
check("search lines", [s.searchLine(true), s.searchLine(null)], ["Clients can find you in search.", null])

// ── Where /setup opens, and where "Save and continue" goes ───────────────────
const half = with_(brandNew, {
  profile: { services: [{ id: 1, name: "Plumbing" }], hourlyRate: 120, location: "Tema, Greater Accra", isProfileComplete: true, missingFields: [] },
  hasPhoto: true,
})
const halfState = s.deriveSetup(half)
check("half: done flags", halfState.steps.map((x) => x.done), [true, true, false, false, false, false])
check("resume: first unfinished", s.resumeView(halfState, null), "profile")
check("resume: ?step= wins", s.resumeView(halfState, "payout"), "payout")
check("resume: bad ?step= ignored", s.resumeView(halfState, "../admin"), "profile")
check("resume: finished opens the completion view", s.resumeView(all, null), "done")
check("resume: finished can still open a step", s.resumeView(all, "hours"), "hours")
check("resume: ?step=done", s.resumeView(halfState, "done"), "done")
check("next: skips done steps", s.nextView(halfState, "services"), "profile")
check("next: wraps to earlier unfinished", s.nextView(s.deriveSetup(with_(finished, { slots: [] })), "verify"), "hours")
check("next: all done → completion", s.nextView(all, "payout"), "done")
check("next: last step, only itself left → completion", s.nextView(s.deriveSetup(with_(finished, { verification: "none" })), "verify"), "done")
check("back", [s.previousStep("services"), s.previousStep("area"), s.previousStep("verify")], [null, "services", "payout"])
check("progress label", s.progressLabel(halfState), "2 of 6 done")

if (failures) {
  console.error(`\n${failures} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`artisan setup: ${passed} checks passed`)
