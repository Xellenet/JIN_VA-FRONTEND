"use client"

import type React from "react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthSplitLayout } from "./auth-split-layout"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AUTH_INPUT_CLASS,
  AUTH_SELECT_TRIGGER_CLASS,
  FormAnnouncer,
  FormField,
} from "@/components/forms/form-field"
import { PhoneField } from "@/components/forms/phone-field"
import { useFormValidation, type ValidationMode } from "@/hooks/use-form-validation"
import { ApiError } from "@/lib/api"
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_MESSAGES,
  phoneToE164,
  validatePhoneNumber,
  type SupportedPhoneCountry,
} from "@/lib/phone"
import {
  AUTH_FORM_CONTAINER_CLASS,
  AUTH_HEADING_CLASS,
  GENDER_OPTIONS,
  GENDER_REQUIRED,
  PASSWORD_HINT,
  ROLE_REQUIRED,
  isPhoneInUse,
  serverFieldMessages,
  validateEmail,
  validateName,
  validateNewPassword,
  validatePasswordConfirmation,
} from "./signup-fields"

/**
 * The only two roles a visitor may self-select. ADMIN is deliberately absent:
 * PRD §5.1 makes admin accounts seed-only and not publicly registerable, so
 * `?role=ADMIN` must be treated exactly like any other junk value — ignored.
 */
const PREFILLABLE_ROLES = ["CUSTOMER", "ARTISAN"] as const

/**
 * LP13 — normalise `?role=` into a starting value for the role selector.
 *
 * Anything that is not exactly CUSTOMER or ARTISAN — absent, misspelled,
 * lowercase, ADMIN, an injected value — returns "", which leaves the selector
 * empty and the existing validation untouched. ADMIN is excluded deliberately,
 * not by omission: PRD §5.1 makes admin accounts seed-only and not publicly
 * registerable, so `?role=ADMIN` has to be treated as junk like anything else.
 *
 * The param is a convenience only. The submitted payload is still what the
 * backend validates.
 */
function roleFromParam(requested: string | null): string {
  if (!requested) return ""
  return (PREFILLABLE_ROLES as readonly string[]).includes(requested) ? requested : ""
}

/*
 * google-signup-prefill (design-spec §1, §3.9, §6.2): inline V-treatment
 * errors instead of toasts and native bubbles, no placeholders, sentence-case
 * labels, the shared country-aware phone field (E.164 out), gender Male/Female
 * only, and the same frame and Select sizing as "Complete your account".
 */

type Field =
  | "firstname"
  | "lastname"
  | "username"
  | "email"
  | "phoneNumber"
  | "gender"
  | "role"
  | "password"
  | "confirmPassword"

const FIELDS: readonly Field[] = [
  "firstname",
  "lastname",
  "username",
  "email",
  "phoneNumber",
  "gender",
  "role",
  "password",
  "confirmPassword",
]

const LABELS: Record<Field, string> = {
  firstname: "First name",
  lastname: "Last name",
  username: "Username",
  email: "Email",
  phoneNumber: "Phone number",
  gender: "Gender",
  role: "Role",
  password: "Password",
  confirmPassword: "Confirm password",
}

const EMAIL_TAKEN = "This email already has an account."
const USERNAME_TAKEN = "That username is taken. Try another."

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [phoneCountry, setPhoneCountry] = useState<SupportedPhoneCountry>(DEFAULT_PHONE_COUNTRY)

  /**
   * Read `?role=` during render as the initial value, rather than applying it
   * from an effect.
   *
   * This is deliberate and it is the pattern `verify-email-form.tsx` already
   * uses for `?email=`. An effect keyed on the `useSearchParams()` object does
   * work in dev but does NOT apply on `/signup` in a production build, because
   * the route is statically prerendered and the effect does not get a second
   * run once the real params are known. Reading it at render time has no such
   * timing dependency, and it is simpler.
   */
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    username: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    gender: "",
    role: roleFromParam(searchParams.get("role")),
  })

  const update = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  const validateField = (field: Field, mode: ValidationMode): string | null => {
    const submit = mode === "submit"
    switch (field) {
      case "firstname":
        return validateName(formData.firstname, "first", submit)
      case "lastname":
        return validateName(formData.lastname, "last", submit)
      case "username":
        return submit && !formData.username.trim() ? "Choose a username" : null
      case "email":
        return validateEmail(formData.email, submit)
      case "phoneNumber":
        return validatePhoneNumber(formData.phoneNumber, phoneCountry, { requireValue: submit })
      case "gender":
        return submit && !formData.gender ? GENDER_REQUIRED : null
      case "role":
        return submit && !formData.role ? ROLE_REQUIRED : null
      case "password":
        return validateNewPassword(formData.password, submit)
      case "confirmPassword":
        return validatePasswordConfirmation(formData.confirmPassword, formData.password, submit)
    }
  }

  const values = useMemo(() => ({ ...formData, phoneCountry }), [formData, phoneCountry])
  const v = useFormValidation<Field>({ fields: FIELDS, values, validate: validateField, labels: LABELS })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!v.validateAll()) return

    const phoneNumber = phoneToE164(formData.phoneNumber, phoneCountry)
    if (!phoneNumber) return // unreachable: validateAll just accepted it

    setIsLoading(true)

    try {
      const payload = {
        email: formData.email.trim(),
        password: formData.password,
        username: formData.username.trim(),
        firstname: formData.firstname.trim(),
        lastname: formData.lastname.trim(),
        phoneNumber,
        gender: formData.gender,
        role: formData.role,
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message = Array.isArray(data.message) ? data.message.join(" ") : data.message
        throw new ApiError(message || "Registration failed", response.status, data.meta?.error ?? data.error)
      }

      toast.success("Please check your email to verify your account.")

      window.location.href = `/verify-email?email=${encodeURIComponent(payload.email)}`
    } catch (error) {
      // V5: answers about one field land on that field.
      const fieldErrors =
        error instanceof ApiError && error.status === 400 ? serverFieldMessages(error.message, phoneCountry) : {}
      if (isPhoneInUse(error)) {
        v.setServerError("phoneNumber", PHONE_MESSAGES.inUse)
      } else if (error instanceof ApiError && error.status === 409 && /username/i.test(error.message)) {
        v.setServerError("username", USERNAME_TAKEN)
      } else if (
        error instanceof ApiError &&
        error.status === 409 &&
        (error.code === "UserAlreadyExists" || /email/i.test(error.message))
      ) {
        v.setServerError("email", EMAIL_TAKEN)
      } else if (fieldErrors.phoneNumber) {
        v.setServerError("phoneNumber", fieldErrors.phoneNumber)
      } else if (fieldErrors.gender) {
        v.setServerError("gender", fieldErrors.gender)
      } else {
        toast.error(error instanceof Error ? error.message : "Registration failed")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialSignup = async (provider: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/oauth/${provider}`)
      const data = await response.json()

      window.location.href = data.authUrl
    } catch (error) {
      toast.error("Failed to initiate social signup")
      setIsLoading(false)
    }
  }

  // G9: read whichever role is currently selected on the existing role
  // toggle at the moment "Continue with Google" is clicked, and pass it as
  // `?role=` on GET /auth/google — omit entirely if no role is selected yet
  // (backend defaults an unrecognized/missing role to CUSTOMER anyway). Per
  // api-contract.md this is a real full-page navigation (the route itself
  // 302s to Google), not a fetch-then-redirect.
  const handleGoogleSignup = () => {
    const role = formData.role.toLowerCase()
    const query = role ? `?role=${encodeURIComponent(role)}` : ""
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google${query}`
  }

  const emailError =
    v.errors.email === EMAIL_TAKEN ? (
      <>
        {EMAIL_TAKEN}{" "}
        <Link href="/login" className="font-medium underline underline-offset-2">
          Sign in
        </Link>{" "}
        instead.
      </>
    ) : (
      v.errors.email
    )

  return (
    <AuthSplitLayout>
      <div className={AUTH_FORM_CONTAINER_CLASS}>
        <div className="space-y-2">
          <h1 className={AUTH_HEADING_CLASS}>Create account</h1>
          <p className="text-muted-foreground">
            {"Already have an account? "}
            <Link href="/login" className="text-foreground underline hover:text-muted-foreground transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate aria-busy={isLoading} className="space-y-6">
          <FormAnnouncer message={v.announcement} />

          <div className="grid grid-cols-2 gap-4">
            <FormField id="firstname" label="First name" error={v.errors.firstname}>
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  autoComplete="given-name"
                  enterKeyHint="next"
                  value={formData.firstname}
                  onChange={(e) => update("firstname", e.target.value)}
                  onBlur={() => v.handleBlur("firstname")}
                  className={AUTH_INPUT_CLASS}
                  required
                  disabled={isLoading}
                />
              )}
            </FormField>
            <FormField id="lastname" label="Last name" error={v.errors.lastname}>
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  autoComplete="family-name"
                  enterKeyHint="next"
                  value={formData.lastname}
                  onChange={(e) => update("lastname", e.target.value)}
                  onBlur={() => v.handleBlur("lastname")}
                  className={AUTH_INPUT_CLASS}
                  required
                  disabled={isLoading}
                />
              )}
            </FormField>
          </div>

          <FormField id="username" label="Username" error={v.errors.username}>
            {(control) => (
              <Input
                {...control}
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                enterKeyHint="next"
                value={formData.username}
                onChange={(e) => update("username", e.target.value)}
                onBlur={() => v.handleBlur("username")}
                className={AUTH_INPUT_CLASS}
                required
                disabled={isLoading}
              />
            )}
          </FormField>

          <FormField id="email" label="Email" error={emailError}>
            {(control) => (
              <Input
                {...control}
                type="email"
                autoComplete="email"
                enterKeyHint="next"
                value={formData.email}
                onChange={(e) => update("email", e.target.value)}
                onBlur={() => v.handleBlur("email")}
                className={AUTH_INPUT_CLASS}
                required
                disabled={isLoading}
              />
            )}
          </FormField>

          <PhoneField
            value={formData.phoneNumber}
            country={phoneCountry}
            onChange={(value) => update("phoneNumber", value)}
            onCountryChange={setPhoneCountry}
            onBlur={() => v.handleBlur("phoneNumber")}
            onAnnounce={v.announce}
            error={v.errors.phoneNumber}
            disabled={isLoading}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField id="gender" label="Gender" error={v.errors.gender}>
              {(control) => (
                <Select
                  value={formData.gender}
                  onValueChange={(value) => update("gender", value)}
                  disabled={isLoading}
                  required
                >
                  {/* The `id` is what makes `<Label htmlFor="gender">` above
                      actually work — without it, clicking the label text did
                      nothing and no assistive technology could pair the two. */}
                  <SelectTrigger {...control} aria-required="true" className={AUTH_SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField id="role" label="Role" error={v.errors.role}>
              {(control) => (
                <Select
                  value={formData.role}
                  onValueChange={(value) => update("role", value)}
                  disabled={isLoading}
                  required
                >
                  {/* Matches `<Label htmlFor="role">`. Also gives the LP13
                      `?role=` prefill a stable hook — the two triggers were
                      previously distinguishable only by DOM order. */}
                  <SelectTrigger {...control} aria-required="true" className={AUTH_SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="ARTISAN">Artisan</SelectItem>
                    {/* <SelectItem value="ADMIN">Admin</SelectItem> */}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>

          <FormField
            id="password"
            label="Password"
            hint={PASSWORD_HINT}
            error={v.errors.password}
          >
            {(control) => (
              <div className="relative">
                <Input
                  {...control}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="next"
                  value={formData.password}
                  onChange={(e) => update("password", e.target.value)}
                  onBlur={() => v.handleBlur("password")}
                  className={`${AUTH_INPUT_CLASS} pr-10`}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            )}
          </FormField>

          <FormField id="confirmPassword" label="Confirm password" error={v.errors.confirmPassword}>
            {(control) => (
              <div className="relative">
                <Input
                  {...control}
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  value={formData.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  onBlur={() => v.handleBlur("confirmPassword")}
                  className={`${AUTH_INPUT_CLASS} pr-10`}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            )}
          </FormField>

          <Button
            type="submit"
            className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
            disabled={isLoading}
          >
            {isLoading ? "Creating account…" : "Create account"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">OR</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleGoogleSignup}
              disabled={isLoading}
              className="w-full h-10 border border-input bg-background hover:bg-accent font-normal text-foreground hover:text-accent-foreground transition-colors"
            >
              <svg className="mr-3 h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            <Button
              type="button"
              onClick={() => handleSocialSignup("facebook")}
              disabled={isLoading}
              className="w-full h-10 border border-input bg-background hover:bg-accent font-normal text-foreground hover:text-accent-foreground transition-colors"
            >
              <svg className="mr-3 h-5 w-5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Continue with Facebook
            </Button>
          </div>
        </form>
      </div>
    </AuthSplitLayout>
  )
}
