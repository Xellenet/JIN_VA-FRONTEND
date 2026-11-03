/**
 * Auth v2: the pure logic behind the 6-digit email code and its resend timer.
 *
 * The `CodeInput` component (components/auth/code-input.tsx) and the
 * `useResendCountdown` hook only wire these to the DOM and the clock, so every
 * rule here is checked by `scripts/test-auth-v2.mjs` without a browser.
 *
 * No `@/` imports: the test script imports this file directly.
 */

export const CODE_LENGTH = 6

/** The backend's resend cooldown (api-contract: 60 s), used when a response carries no usable time. */
export const DEFAULT_RESEND_SECONDS = 60

/**
 * Digits only, in order. Full-width and other Unicode decimal digits (a phone
 * keyboard or a pasted email can produce them) are read as their ASCII value;
 * spaces, dashes and anything else are dropped, so "482 913", "482-913" and
 * "Your code is 482913." all give "482913".
 */
export function sanitizeCode(raw: string, max: number = CODE_LENGTH): string {
  let out = ""
  for (const ch of raw ?? "") {
    if (out.length >= max) break
    if (ch >= "0" && ch <= "9") {
      out += ch
      continue
    }
    const value = unicodeDigitValue(ch)
    if (value !== null) out += String(value)
  }
  return out
}

const DECIMAL_DIGIT = /^\p{Nd}$/u

/**
 * The value of a Unicode decimal digit (General Category Nd), or null. Nd
 * digits come in runs of consecutive code points that start at a zero (some
 * runs, like the mathematical digits, hold several sets of ten back to back),
 * so the value is the distance from the start of the run, modulo 10.
 */
function unicodeDigitValue(ch: string): number | null {
  if (!DECIMAL_DIGIT.test(ch)) return null
  const cp = ch.codePointAt(0) ?? 0
  let start = cp
  // The longest Nd run is 50 code points; never walk further than that.
  while (start > 0 && cp - start < 60 && DECIMAL_DIGIT.test(String.fromCodePoint(start - 1))) start--
  return (cp - start) % 10
}

/** An empty code: one "" per box. */
export function emptyCode(length: number = CODE_LENGTH): string[] {
  return Array.from({ length }, () => "")
}

/** The boxes for a code string (shorter strings leave the tail empty). */
export function digitsFromCode(code: string, length: number = CODE_LENGTH): string[] {
  const clean = sanitizeCode(code, length)
  return Array.from({ length }, (_, i) => clean[i] ?? "")
}

export function codeFromDigits(digits: readonly string[]): string {
  return digits.join("")
}

export function isCodeComplete(digits: readonly string[], length: number = CODE_LENGTH): boolean {
  return digits.length === length && digits.every((d) => /^\d$/.test(d))
}

export interface CodeChange {
  digits: string[]
  /** The box that should hold focus next. */
  focus: number
}

/**
 * What typing or pasting `raw` into box `index` does.
 *
 * - One digit: fills that box and moves to the next (the last box keeps focus).
 * - Several digits (a paste, or the phone's one-time-code autofill landing in
 *   the first box): fills from `index` onward; a full-length paste always
 *   fills from the first box, so pasting "482913" anywhere gives the whole code.
 * - Nothing usable (a letter, a space): no change.
 */
export function applyCodeInput(
  digits: readonly string[],
  index: number,
  raw: string,
  length: number = CODE_LENGTH,
): CodeChange {
  const at = clampIndex(index, length)
  const incoming = sanitizeCode(raw, length)
  const next = normalise(digits, length)
  if (!incoming) return { digits: next, focus: at }

  const start = incoming.length >= length ? 0 : at
  for (let i = 0; i < incoming.length && start + i < length; i++) next[start + i] = incoming[i]
  const lastFilled = Math.min(start + incoming.length, length) - 1
  return { digits: next, focus: Math.min(lastFilled + 1, length - 1) }
}

/**
 * Backspace in box `index`: clears that box if it holds a digit (focus stays);
 * in an empty box it clears the previous one and moves back to it.
 */
export function applyCodeBackspace(digits: readonly string[], index: number, length: number = CODE_LENGTH): CodeChange {
  const at = clampIndex(index, length)
  const next = normalise(digits, length)
  if (next[at]) {
    next[at] = ""
    return { digits: next, focus: at }
  }
  const prev = Math.max(at - 1, 0)
  next[prev] = ""
  return { digits: next, focus: prev }
}

/** Delete in box `index`: clears it, focus stays. */
export function applyCodeDelete(digits: readonly string[], index: number, length: number = CODE_LENGTH): CodeChange {
  const at = clampIndex(index, length)
  const next = normalise(digits, length)
  next[at] = ""
  return { digits: next, focus: at }
}

/** Arrow keys / Home / End: where focus goes. Returns null for any other key. */
export function moveCodeFocus(key: string, index: number, length: number = CODE_LENGTH): number | null {
  const at = clampIndex(index, length)
  switch (key) {
    case "ArrowLeft":
      return Math.max(at - 1, 0)
    case "ArrowRight":
      return Math.min(at + 1, length - 1)
    case "Home":
      return 0
    case "End":
      return length - 1
    default:
      return null
  }
}

/**
 * The box a click or focus should really land on: the first empty one, so a
 * person can't start typing in the middle of an empty code and leave gaps.
 * A full code keeps the box they chose (to correct one digit).
 */
export function focusTargetFor(digits: readonly string[], requested: number, length: number = CODE_LENGTH): number {
  const firstEmpty = normalise(digits, length).findIndex((d) => !d)
  if (firstEmpty === -1) return clampIndex(requested, length)
  return Math.min(clampIndex(requested, length), firstEmpty)
}

/** "6-digit code, 3 of 6 entered" style progress for the live region. */
export function codeProgressLabel(digits: readonly string[], length: number = CODE_LENGTH): string {
  const filled = normalise(digits, length).filter(Boolean).length
  if (filled === 0) return ""
  if (filled === length) return "All 6 digits entered."
  return `${filled} of ${length} digits entered.`
}

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return 0
  return Math.min(Math.max(Math.trunc(index), 0), length - 1)
}

function normalise(digits: readonly string[], length: number): string[] {
  return Array.from({ length }, (_, i) => {
    const d = digits[i] ?? ""
    return /^\d$/.test(d) ? d : ""
  })
}

// ── Resend countdown ─────────────────────────────────────────────────────────

/**
 * When resend becomes available, as epoch ms, from the API's
 * `resendAvailableAt` (ISO 8601). Unusable values fall back to `now +
 * fallbackSeconds`, and a time absurdly far ahead (clock skew or a bad value)
 * is capped at 10 minutes so the button can never be stuck for hours.
 */
export function resendAvailableAtMs(
  value: string | number | null | undefined,
  now: number,
  fallbackSeconds: number = DEFAULT_RESEND_SECONDS,
): number {
  const fallback = now + fallbackSeconds * 1000
  if (value === null || value === undefined || value === "") return fallback
  const ms = typeof value === "number" ? value : Date.parse(value)
  if (!Number.isFinite(ms)) return fallback
  return Math.min(ms, now + 10 * 60 * 1000)
}

/** Whole seconds left until `availableAt` (rounded up, never negative). */
export function secondsUntil(availableAt: number | null | undefined, now: number): number {
  if (availableAt === null || availableAt === undefined || !Number.isFinite(availableAt)) return 0
  return Math.max(0, Math.ceil((availableAt - now) / 1000))
}

/** 42 → "0:42", 75 → "1:15", 0 → "0:00". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** Screen-reader wording: "42 seconds", "1 minute 15 seconds". */
export function countdownWords(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  const parts: string[] = []
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`)
  if (r || !m) parts.push(`${r} second${r === 1 ? "" : "s"}`)
  return parts.join(" ")
}
