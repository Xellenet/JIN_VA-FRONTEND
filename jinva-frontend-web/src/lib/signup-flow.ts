/**
 * Auth v2 sign-up: which step is showing, and the draft that lets a refresh
 * keep the form.
 *
 * The step lives in the URL (`/signup?step=details&role=ARTISAN`), so Back and
 * refresh behave. The typed fields live in sessionStorage under
 * `SIGNUP_DRAFT_KEY`, and only the non-secret ones: the password is never
 * written anywhere (`serializeSignupDraft` has no way to carry it).
 *
 * No `@/` imports: `scripts/test-auth-v2.mjs` imports this file directly.
 */

export const SIGNUP_DRAFT_KEY = "jinva:signup-draft"

export const SIGNUP_STEPS = ["role", "details", "code"] as const
export type SignupStep = (typeof SIGNUP_STEPS)[number]

export const SIGNUP_STEP_LABELS: Record<SignupStep, string> = {
  role: "Role",
  details: "Your details",
  code: "Email code",
}

/** The only roles a visitor may pick. ADMIN is seed-only (PRD §5.1) and never accepted here. */
export const SELF_SIGNUP_ROLES = ["CUSTOMER", "ARTISAN"] as const
export type SelfSignupRole = (typeof SELF_SIGNUP_ROLES)[number]

/** `?role=` → a role, or null for anything else (absent, lower-case, ADMIN, junk). */
export function roleFromParam(value: string | null | undefined): SelfSignupRole | null {
  return value === "CUSTOMER" || value === "ARTISAN" ? value : null
}

export interface SignupDraft {
  role: SelfSignupRole | null
  firstname: string
  middlename: string
  showMiddlename: boolean
  lastname: string
  email: string
  phoneNumber: string
  phoneCountry: string
  /** Set once the account was created and a code sent: step 3 needs it. */
  codeEmail: string | null
  /** ISO time from the API's `resendAvailableAt`. */
  resendAvailableAt: string | null
}

export const EMPTY_SIGNUP_DRAFT: SignupDraft = {
  role: null,
  firstname: "",
  middlename: "",
  showMiddlename: false,
  lastname: "",
  email: "",
  phoneNumber: "",
  phoneCountry: "GH",
  codeEmail: null,
  resendAvailableAt: null,
}

const MAX_FIELD = 320

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, MAX_FIELD) : fallback
}

/**
 * The draft as stored. Builds a fresh object from the known non-secret keys
 * only, so a password (or anything else) passed in by mistake is dropped.
 */
export function serializeSignupDraft(draft: Partial<SignupDraft> & Record<string, unknown>): string {
  const safe: SignupDraft = {
    role: roleFromParam(draft.role as string | null),
    firstname: str(draft.firstname),
    middlename: str(draft.middlename),
    showMiddlename: draft.showMiddlename === true,
    lastname: str(draft.lastname),
    email: str(draft.email),
    phoneNumber: str(draft.phoneNumber),
    phoneCountry: /^[A-Z]{2}$/.test(String(draft.phoneCountry ?? "")) ? String(draft.phoneCountry) : "GH",
    codeEmail: typeof draft.codeEmail === "string" && draft.codeEmail ? str(draft.codeEmail) : null,
    resendAvailableAt:
      typeof draft.resendAvailableAt === "string" && draft.resendAvailableAt ? str(draft.resendAvailableAt) : null,
  }
  return JSON.stringify(safe)
}

/** A stored draft, or the empty draft for anything missing, malformed or tampered with. */
export function parseSignupDraft(raw: string | null | undefined): SignupDraft {
  if (!raw) return { ...EMPTY_SIGNUP_DRAFT }
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_SIGNUP_DRAFT }
    return JSON.parse(serializeSignupDraft(value as Record<string, unknown>)) as SignupDraft
  } catch {
    return { ...EMPTY_SIGNUP_DRAFT }
  }
}

/**
 * The step to show for the URL's `?step=` and what the draft holds. A step is
 * never shown without what it needs: details needs a role, the code step needs
 * the email a code was sent to. So a stale or hand-typed URL falls back to the
 * furthest step that can actually be shown.
 */
export function resolveSignupStep(
  requested: string | null | undefined,
  state: { role: SelfSignupRole | null; codeEmail: string | null },
): SignupStep {
  const wanted: SignupStep = (SIGNUP_STEPS as readonly string[]).includes(requested ?? "")
    ? (requested as SignupStep)
    : "role"
  if (wanted === "code" && state.codeEmail) return "code"
  if ((wanted === "details" || wanted === "code") && state.role) return "details"
  return "role"
}

/** 1-based position, for "Step 2 of 3". */
export function signupStepNumber(step: SignupStep): number {
  return SIGNUP_STEPS.indexOf(step) + 1
}

/** Where a brand-new account lands once it is signed in. */
export function homeAfterSignup(role: string | null | undefined): string {
  return role === "ARTISAN" ? "/dashboard/artisan/setup" : "/dashboard/user"
}
