/**
 * The one source for JinVa's new-password rule (sign-up form v2).
 *
 * Identical to the backend's `VARIABLES.PASSWORD_REGEX`: 8–128 characters with
 * at least one upper-case letter, one lower-case letter, one number and one of
 * the symbols ! @ # $ % ^ & *, and nothing besides letters, numbers and those
 * symbols. `validateNewPassword` (signup-fields.ts), the live checklist and the
 * "Suggest a strong password" generator all read from here, so they can't drift.
 *
 * No `@/` imports: `scripts/test-signup.mjs` imports this file straight through
 * Node's type stripping.
 */

/** The only symbols allowed, in the order they're listed to people. */
export const PASSWORD_SYMBOLS = "!@#$%^&*"
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/** Same as the backend's PASSWORD_REGEX. */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,128}$/

/** "! @ # $ % ^ & *" — the full allowed list, never "e.g.". */
export const PASSWORD_SYMBOLS_TEXT = [...PASSWORD_SYMBOLS].join(" ")

/**
 * The HTML `passwordrules` attribute (Safari's password generator reads it;
 * other browsers may). Mirrors PASSWORD_PATTERN.
 */
export const PASSWORD_RULES_ATTRIBUTE =
  "minlength: 8; maxlength: 128; required: lower; required: upper; required: digit; required: [!@#$%^&*]; allowed: lower, upper, digit, [!@#$%^&*];"

export type PasswordRuleId = "length" | "upper" | "lower" | "digit" | "symbol" | "allowed"

export interface PasswordRuleState {
  id: PasswordRuleId
  label: string
  met: boolean
}

const UPPER = /[A-Z]/
const LOWER = /[a-z]/
const DIGIT = /\d/
const SYMBOL = /[!@#$%^&*]/
const DISALLOWED = /[^A-Za-z\d!@#$%^&*]/

/**
 * The checklist under a new-password field. The five core rules are always
 * listed; "Only letters, numbers and those symbols" joins them only while a
 * character outside the allowed set is present.
 */
export function passwordRuleStates(password: string): PasswordRuleState[] {
  const tooLong = password.length > PASSWORD_MAX_LENGTH
  const rules: PasswordRuleState[] = [
    {
      id: "length",
      label: tooLong ? `${PASSWORD_MAX_LENGTH} characters or fewer` : `${PASSWORD_MIN_LENGTH} or more characters`,
      met: password.length >= PASSWORD_MIN_LENGTH && !tooLong,
    },
    { id: "upper", label: "An upper-case letter", met: UPPER.test(password) },
    { id: "lower", label: "A lower-case letter", met: LOWER.test(password) },
    { id: "digit", label: "A number", met: DIGIT.test(password) },
    { id: "symbol", label: `One of these symbols: ${PASSWORD_SYMBOLS_TEXT}`, met: SYMBOL.test(password) },
  ]
  if (DISALLOWED.test(password)) {
    rules.push({ id: "allowed", label: "Only letters, numbers and those symbols", met: false })
  }
  return rules
}

/** Every rule met — exactly PASSWORD_PATTERN. */
export function isStrongPassword(password: string): boolean {
  return PASSWORD_PATTERN.test(password)
}

// ── "Suggest a strong password" ────────────────────────────────────────────

const LOWERS = "abcdefghijklmnopqrstuvwxyz"
const UPPERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const DIGITS = "0123456789"
export const PASSWORD_ALPHABET = LOWERS + UPPERS + DIGITS + PASSWORD_SYMBOLS
export const SUGGESTED_PASSWORD_LENGTH = 16

/** `crypto.getRandomValues`, or a stand-in with the same contract (tests). */
export type RandomValues = (array: Uint32Array) => Uint32Array

const defaultRandom: RandomValues = (array) => globalThis.crypto.getRandomValues(array)

/**
 * An unbiased integer in [0, n): rejection sampling over 32-bit values, so no
 * character is more likely than another (a plain `% n` would favour the low end).
 */
function randomBelow(n: number, random: RandomValues): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n
  const buf = new Uint32Array(1)
  for (;;) {
    random(buf)
    if (buf[0] < limit) return buf[0] % n
  }
}

function pick(chars: string, random: RandomValues): string {
  return chars[randomBelow(chars.length, random)]
}

/**
 * A 16-character password that always passes PASSWORD_PATTERN: one character
 * from each class, the rest from the whole allowed set, then a Fisher–Yates
 * shuffle so the guaranteed characters aren't in fixed places.
 */
export function generateStrongPassword(random: RandomValues = defaultRandom): string {
  const chars = [pick(LOWERS, random), pick(UPPERS, random), pick(DIGITS, random), pick(PASSWORD_SYMBOLS, random)]
  while (chars.length < SUGGESTED_PASSWORD_LENGTH) chars.push(pick(PASSWORD_ALPHABET, random))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1, random)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}
