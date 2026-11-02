/**
 * Usernames (sign-up form v2). Same rule as the backend's
 * `VARIABLES.USERNAME_REGEX`, which applies to new values only (register,
 * PATCH /users/me): 3–30 letters, numbers, dots and underscores, not starting
 * or ending with a dot, no two dots in a row. Usernames stored before the
 * rule still work for sign-in and display.
 *
 * No `@/` imports: `scripts/test-signup.mjs` imports this file directly.
 */

export const USERNAME_PATTERN = /^(?!\.)(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{3,30}$/
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30

export const USERNAME_HINT = "Letters, numbers, dots and underscores"

export const USERNAME_MESSAGES = {
  required: "Choose a username",
  tooShort: `Use at least ${USERNAME_MIN_LENGTH} characters`,
  tooLong: `Use ${USERNAME_MAX_LENGTH} characters or fewer`,
  characters: "Use only letters, numbers, dots and underscores",
  edgeDot: "Start and end with a letter, number or underscore, not a dot",
  doubleDot: "Don't use two dots in a row",
  taken: "That username is taken. Try another.",
} as const

/**
 * Removes every whitespace character as the person types or pastes, and says
 * where the caret should go: it moves back by the number of characters removed
 * before it, so typing in the middle keeps its place.
 */
export function sanitizeUsername(raw: string, caret: number | null = null): { value: string; caret: number | null } {
  const value = raw.replace(/\s+/g, "")
  if (caret === null) return { value, caret: null }
  const removedBefore = raw.slice(0, caret).length - raw.slice(0, caret).replace(/\s+/g, "").length
  return { value, caret: caret - removedBefore }
}

/** The first rule a username breaks, or null. Empty is an error only on submit. */
export function validateUsername(raw: string, requireValue: boolean): string | null {
  const value = raw.trim()
  if (!value) return requireValue ? USERNAME_MESSAGES.required : null
  if (/[^A-Za-z0-9._]/.test(value)) return USERNAME_MESSAGES.characters
  if (value.length < USERNAME_MIN_LENGTH) return USERNAME_MESSAGES.tooShort
  if (value.length > USERNAME_MAX_LENGTH) return USERNAME_MESSAGES.tooLong
  if (value.startsWith(".") || value.endsWith(".")) return USERNAME_MESSAGES.edgeDot
  if (value.includes("..")) return USERNAME_MESSAGES.doubleDot
  return USERNAME_PATTERN.test(value) ? null : USERNAME_MESSAGES.characters
}
