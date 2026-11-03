"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { AUTH_INPUT_CLASS, FormAnnouncer, FormField, fieldErrorId } from "@/components/forms/form-field"
import { PhoneField } from "@/components/forms/phone-field"
import { useFormValidation, type ValidationMode } from "@/hooks/use-form-validation"
import { ApiError, apiFetch, apiFetchBody } from "@/lib/api"
import { persistAuthTokens } from "@/lib/auth"
import { DEFAULT_PHONE_COUNTRY, PHONE_MESSAGES, phoneToE164, validatePhoneNumber, type SupportedPhoneCountry } from "@/lib/phone"
import { homeAfterSignup, type SelfSignupRole } from "@/lib/signup-flow"
import { clearCachedUser } from "@/contexts/auth-context"
import { AuthSplitLayout } from "./auth-split-layout"
import { AUTH_LINK_CLASS, AUTH_SECONDARY_BUTTON_CLASS, AuthHeading, AuthNotice, SubmitButton } from "./auth-ui"
import { RoleCards } from "./role-cards"
import { isPhoneInUse, serverFieldMessages, validateName } from "./signup-fields"

/**
 * The Google "complete your account" step.
 *
 * The backend parks what Google told it in a short-lived pending entry (keyed
 * by the httpOnly `jinva_pending_signup` cookie, 15 min) and sends the browser
 * here; nothing exists in the database until this form is submitted.
 *
 * Every call is `skipAuth`: there is no session yet, and a 401 means "the
 * pending sign-up expired", not "your session ended".
 *
 * Auth v2: the role was chosen on /signup before Google and comes back as
 * `suggestedRole`, so the only question left is the phone number. No gender
 * (optional in Settings), no area (artisans add it in their setup checklist,
 * clients when they post a job). The role cards appear only when no role came
 * through (someone who started from "Continue with Google" on login), and the
 * name fields only when Google's name can't be used as it is (empty, or over
 * the 15-character limit).
 */

const EXPIRED_REDIRECT = "/login?error=signup_expired"
const SIGNUP_EXPIRED_CODE = "SOCIAL_SIGNUP_EXPIRED"
const ROLE_REQUIRED = "Choose how you'll use JinVa"

interface PendingSignup {
  email: string
  firstname: string
  lastname: string
  profilePicture?: string | null
  suggestedRole: SelfSignupRole | null
  provider: string
}

/** `POST /auth/social/complete` answers exactly like `POST /auth/login`. */
interface CompleteSignupResponse {
  access_token?: string
  data?: { role?: string }
}

type Field = "role" | "firstname" | "lastname" | "phoneNumber"
const FIELDS: readonly Field[] = ["role", "firstname", "lastname", "phoneNumber"]
const LABELS: Record<Field, string> = {
  role: "Role",
  firstname: "First name",
  lastname: "Last name",
  phoneNumber: "Phone number",
}

function isSignupExpired(error: unknown): boolean {
  return error instanceof ApiError && (error.code === SIGNUP_EXPIRED_CODE || error.status === 401)
}

export function CompleteSignupForm() {
  const router = useRouter()
  const [pending, setPending] = useState<PendingSignup | null>(null)
  const [askRole, setAskRole] = useState(false)
  const [askName, setAskName] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  // 409: the email was registered between the Google callback and this submit.
  const [accountExists, setAccountExists] = useState(false)
  const accountExistsRef = useRef<HTMLDivElement>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [phoneCountry, setPhoneCountry] = useState<SupportedPhoneCountry>(DEFAULT_PHONE_COUNTRY)
  const [formData, setFormData] = useState({
    role: null as SelfSignupRole | null,
    firstname: "",
    lastname: "",
    phoneNumber: "",
  })
  const update = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  // Strict Mode mounts twice in dev; one GET is enough.
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    apiFetch<PendingSignup>("/auth/social/pending", { skipAuth: true })
      .then((data) => {
        const role = data.suggestedRole === "CUSTOMER" || data.suggestedRole === "ARTISAN" ? data.suggestedRole : null
        const firstname = data.firstname ?? ""
        const lastname = data.lastname ?? ""
        setPending(data)
        setAskRole(!role)
        setAskName(!!(validateName(firstname, "first", true) || validateName(lastname, "last", true)))
        setFormData((prev) => ({ ...prev, role, firstname, lastname }))
      })
      .catch(() => router.replace(EXPIRED_REDIRECT))
  }, [router])

  const isBusy = isSubmitting || isCancelling

  const validateField = (field: Field, mode: ValidationMode): string | null => {
    const submit = mode === "submit"
    switch (field) {
      case "role":
        return submit && !formData.role ? ROLE_REQUIRED : null
      case "firstname":
        return askName ? validateName(formData.firstname, "first", submit) : null
      case "lastname":
        return askName ? validateName(formData.lastname, "last", submit) : null
      case "phoneNumber":
        return validatePhoneNumber(formData.phoneNumber, phoneCountry, { requireValue: submit })
    }
  }
  const values = useMemo(() => ({ ...formData, phoneCountry }), [formData, phoneCountry])
  const v = useFormValidation<Field>({
    fields: FIELDS,
    values,
    validate: validateField,
    labels: LABELS,
    focusTarget: (field) => document.getElementById(field === "role" ? "role-first" : field),
  })

  // A Google name already over the limit is flagged on load (§1.4).
  const namesCheckedRef = useRef(false)
  useEffect(() => {
    if (!pending || !askName || namesCheckedRef.current) return
    namesCheckedRef.current = true
    v.validateFields(["firstname", "lastname"])
  }, [pending, askName, v])

  useEffect(() => {
    if (accountExists) accountExistsRef.current?.focus()
  }, [accountExists])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountExists(false)
    setFormError(null)
    if (!v.validateAll()) return
    const phoneNumber = phoneToE164(formData.phoneNumber, phoneCountry)
    if (!phoneNumber || !formData.role) return // unreachable: validateAll accepted both

    setIsSubmitting(true)
    try {
      const data = await apiFetchBody<CompleteSignupResponse>("/auth/social/complete", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          role: formData.role,
          firstname: formData.firstname.trim(),
          lastname: formData.lastname.trim(),
          phoneNumber,
        }),
      })
      if (!data.access_token) throw new Error("Sign-up failed")
      // Refresh + session cookies arrived as httpOnly Set-Cookie, exactly as on login.
      persistAuthTokens(data.access_token)
      clearCachedUser()
      // A full navigation, as after login and code sign-up: the dashboard
      // boots with the new session cookies and a fresh AuthProvider.
      window.location.replace(homeAfterSignup(data.data?.role ?? formData.role))
    } catch (error) {
      if (isSignupExpired(error)) {
        router.replace(EXPIRED_REDIRECT)
        return
      }
      // Only the email-taken 409 means "go log in"; a phone clash keeps the pending entry (PH9, V5).
      if (error instanceof ApiError && error.status === 409 && error.code === "UserAlreadyExists") {
        setAccountExists(true)
        return
      }
      if (isPhoneInUse(error)) {
        v.setServerError("phoneNumber", PHONE_MESSAGES.inUse)
        return
      }
      if (error instanceof ApiError && error.status === 400) {
        const fields = serverFieldMessages(error.message, phoneCountry)
        if (fields.phoneNumber) {
          v.setServerError("phoneNumber", fields.phoneNumber)
          return
        }
        if (/first ?name|last ?name/i.test(error.message)) {
          setAskName(true)
          setFormError("Check your name: each part can be up to 15 characters.")
          return
        }
      }
      setFormError(
        error instanceof ApiError && error.status < 500 && error.message
          ? error.message
          : "We couldn't create your account. Check your connection and try again.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      await apiFetch("/auth/social/cancel", { method: "POST", skipAuth: true })
    } catch {
      // Best effort: the pending entry expires on its own anyway.
    }
    router.replace("/login")
  }

  if (!pending) {
    return (
      <AuthSplitLayout>
        <div className="space-y-6" role="status">
          <span className="inline-flex rounded-full bg-primary/10 p-3 text-primary">
            <Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          </span>
          <p className="text-muted-foreground">Loading your sign-up&hellip;</p>
        </div>
      </AuthSplitLayout>
    )
  }

  const displayName = [formData.firstname, formData.lastname].filter(Boolean).join(" ")

  return (
    <AuthSplitLayout>
      <div className="space-y-8" data-auth-step="none">
        <AuthHeading
          title="Complete your account"
          description={
            <p>
              Add your phone number to finish creating your account. Nothing is created until you do.
            </p>
          }
        />

        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            {(formData.firstname[0] ?? pending.email[0] ?? "").toUpperCase()}
          </span>
          <div className="min-w-0">
            {displayName && !askName ? <p className="truncate font-medium text-foreground">{displayName}</p> : null}
            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {pending.email}
              <span className="sr-only">, from your Google account</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting} className="space-y-5">
          <FormAnnouncer message={v.announcement} />

          {askRole && (
            <div className="space-y-3">
              <p id="role-heading" className="text-sm font-medium text-foreground">
                How will you use JinVa?
              </p>
              <RoleCards
                id="role"
                value={formData.role}
                onChange={(role) => update("role", role)}
                labelledBy="role-heading"
                describedBy={v.errors.role ? fieldErrorId("role") : undefined}
                invalid={!!v.errors.role}
                disabled={isBusy}
                compact
              />
              {v.errors.role ? (
                <p id={fieldErrorId("role")} className="text-sm text-destructive">
                  {v.errors.role}
                </p>
              ) : null}
            </div>
          )}

          {askName && (
            <div className="grid grid-cols-2 gap-3">
              <FormField id="firstname" label="First name" error={v.errors.firstname}>
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    autoComplete="given-name"
                    value={formData.firstname}
                    onChange={(e) => update("firstname", e.target.value)}
                    onBlur={() => v.handleBlur("firstname")}
                    className={AUTH_INPUT_CLASS}
                    required
                    disabled={isBusy}
                  />
                )}
              </FormField>
              <FormField id="lastname" label="Last name" error={v.errors.lastname}>
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    autoComplete="family-name"
                    value={formData.lastname}
                    onChange={(e) => update("lastname", e.target.value)}
                    onBlur={() => v.handleBlur("lastname")}
                    className={AUTH_INPUT_CLASS}
                    required
                    disabled={isBusy}
                  />
                )}
              </FormField>
            </div>
          )}

          <PhoneField
            value={formData.phoneNumber}
            country={phoneCountry}
            onChange={(value) => update("phoneNumber", value)}
            onCountryChange={setPhoneCountry}
            onBlur={() => v.handleBlur("phoneNumber")}
            onAnnounce={v.announce}
            error={v.errors.phoneNumber}
            disabled={isBusy}
            className="[&_button]:h-11 [&_button]:rounded-lg [&_input]:h-11 [&_input]:rounded-lg"
          />

          {accountExists && (
            <AuthNotice tone="warning" role="alert" noticeRef={accountExistsRef} title="An account with this email already exists">
              <p>Log in to it instead — Continue with Google works there too.</p>
              <Link href="/login" className="mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-4 sm:min-h-0">
                Go to log in
              </Link>
            </AuthNotice>
          )}
          {formError ? (
            <AuthNotice tone="error" role="alert">
              {formError}
            </AuthNotice>
          ) : null}

          <div className="space-y-3 pt-1">
            <SubmitButton busy={isSubmitting} busyLabel="Creating your account…" disabled={isCancelling}>
              Create account
            </SubmitButton>
            <button type="button" onClick={handleCancel} disabled={isBusy} className={`${AUTH_SECONDARY_BUTTON_CLASS} inline-flex items-center justify-center disabled:opacity-60`}>
              {isCancelling ? "Cancelling…" : "Cancel"}
            </button>
          </div>
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            By continuing you agree to the{" "}
            <Link href="/terms" className={AUTH_LINK_CLASS}>
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className={AUTH_LINK_CLASS}>
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </div>
    </AuthSplitLayout>
  )
}
