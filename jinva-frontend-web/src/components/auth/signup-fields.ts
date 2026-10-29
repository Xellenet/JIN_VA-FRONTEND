import { ApiError } from "@/lib/api"
import { PHONE_MESSAGES, type SupportedPhoneCountry } from "@/lib/phone"

/**
 * What `/signup` and "Complete your account" share so they stay identical
 * (google-signup-prefill LY1, LY4, DI5, PH9; design-spec §3.9, §6).
 */

/** LY1 + §3.9 fix 1: no inner padding below `md`, so a 375px screen keeps 343px for the form. */
export const AUTH_FORM_CONTAINER_CLASS = "space-y-8 bg-background md:rounded-lg p-0 md:p-8 w-full md:w-auto"

/** LY1 + §3.9 fix 2: one size down on phones, so the heading fits on two lines at 375px. */
export const AUTH_HEADING_CLASS = "text-3xl sm:text-4xl font-bold tracking-tight text-foreground"

/** DI5: exactly these two, in this order. The backend enum still holds OTHER for old rows. */
export const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
] as const

export const GENDER_REQUIRED = "Choose your gender"
export const ROLE_REQUIRED = "Choose Customer or Artisan"

// The backend DTOs' @MaxLength on firstname/lastname.
export const NAME_MAX_LENGTH = 15

export function validateName(value: string, which: "first" | "last", requireValue: boolean): string | null {
  const text = value.trim()
  if (!text) return requireValue ? `Enter your ${which} name` : null
  return text.length > NAME_MAX_LENGTH ? `Shorten to ${NAME_MAX_LENGTH} characters or fewer` : null
}

/** PH9: `meta.error` on the duplicate-phone 409. */
export const PHONE_IN_USE_CODE = "PHONE_NUMBER_IN_USE"

export function isPhoneInUse(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.code === PHONE_IN_USE_CODE || /phone number already in use/i.test(error.message))
  )
}

/**
 * V5: the field a 400 is about, from the ValidationPipe's messages (joined by
 * `ApiError`). The backend sends no field key, so the known DTO messages are
 * matched by field name and replaced with the form's own copy (V6).
 */
export function serverFieldMessages(
  message: string,
  country: SupportedPhoneCountry,
): { phoneNumber?: string; gender?: string } {
  const result: { phoneNumber?: string; gender?: string } = {}
  if (/phone ?number/i.test(message)) {
    result.phoneNumber = /required/i.test(message) ? PHONE_MESSAGES.required : PHONE_MESSAGES.invalid(country)
  }
  if (/gender/i.test(message)) result.gender = GENDER_REQUIRED
  return result
}

/*
 * Email and password rules shared by every auth form (design-spec §6.2, §6.3),
 * so /signup, login, forgot-password, reset-password and the verify-email
 * resend prompt can't drift apart.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const EMAIL_MESSAGES = {
  required: "Enter your email address",
  invalid: "Enter an email address like name@example.com",
} as const

export function validateEmail(value: string, requireValue: boolean): string | null {
  const text = value.trim()
  if (!text) return requireValue ? EMAIL_MESSAGES.required : null
  return EMAIL_PATTERN.test(text) ? null : EMAIL_MESSAGES.invalid
}

export const PASSWORD_HINT = "8+ characters: upper and lower case, a number and one of ! @ # $ % ^ & *"

/**
 * QA SEC-16: the address a new account must verify, handed from sign-up to
 * /verify-email through sessionStorage. It used to ride in the URL, which put
 * it in browser history, server logs and analytics page views.
 */
export const PENDING_VERIFY_EMAIL_KEY = "jinva:pending-verify-email"

export const PASSWORD_MESSAGES = {
  /** Login: any non-empty password may be tried. */
  enter: "Enter your password",
  create: "Create a password",
  rule: "Use 8 or more characters with an upper-case letter, a lower-case letter, a number and one of ! @ # $ % ^ & *",
  reenter: "Re-enter your password",
  mismatch: "These passwords don't match",
} as const

/**
 * QA VAL-12: the exact rule the backend enforces (PASSWORD_REGEX), so nothing
 * the form accepts is refused after submit. Only the symbols ! @ # $ % ^ & *
 * are allowed, and nothing besides letters, numbers and those symbols.
 */
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,128}$/

export function isStrongPassword(password: string): boolean {
  return PASSWORD_PATTERN.test(password)
}

/** A new password (signup, reset): "Create a password", then the rule. */
export function validateNewPassword(password: string, requireValue: boolean): string | null {
  if (!password) return requireValue ? PASSWORD_MESSAGES.create : null
  return isStrongPassword(password) ? null : PASSWORD_MESSAGES.rule
}

export function validatePasswordConfirmation(
  confirmation: string,
  password: string,
  requireValue: boolean,
): string | null {
  if (!confirmation) return requireValue ? PASSWORD_MESSAGES.reenter : null
  return confirmation === password ? null : PASSWORD_MESSAGES.mismatch
}
