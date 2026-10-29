"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AUTH_INPUT_CLASS,
  AUTH_SELECT_TRIGGER_CLASS,
  FormAnnouncer,
  FormField,
  FormFieldLabel,
  FormFieldMessage,
} from "@/components/forms/form-field"
import { PhoneField } from "@/components/forms/phone-field"
import { useFormValidation, type ValidationMode } from "@/hooks/use-form-validation"
import { ApiError, apiFetch, apiFetchBody, apiFetchWithMeta } from "@/lib/api"
import { persistAuthTokens, dashboardPathForRole } from "@/lib/auth"
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_MESSAGES,
  phoneToE164,
  validatePhoneNumber,
  type SupportedPhoneCountry,
} from "@/lib/phone"
import { clearCachedUser } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import { AuthSplitLayout } from "./auth-split-layout"
import {
  LocationFields,
  formatLocation,
  useRegionList,
  validateRegion,
  validateTown,
} from "./location-field"
import {
  AUTH_FORM_CONTAINER_CLASS,
  AUTH_HEADING_CLASS,
  GENDER_OPTIONS,
  GENDER_REQUIRED,
  ROLE_REQUIRED,
  isPhoneInUse,
  serverFieldMessages,
  validateName,
} from "./signup-fields"

/**
 * The Google "complete your account" step.
 *
 * The backend no longer creates an account during the OAuth callback for an
 * email it has never seen. It parks what Google told it in a short-lived
 * pending entry (keyed by the httpOnly `jinva_pending_signup` cookie, 15 min)
 * and sends the browser here. Nothing exists in the database until this form
 * is submitted, so closing the tab simply lets the entry expire and the next
 * Google sign-in asks again.
 *
 * Every call here is `skipAuth`: there is no session yet, and a 401 from these
 * endpoints means "the pending sign-up expired", not "your session ended" — it
 * must not trigger lib/api.ts's refresh-and-redirect to /login?session-ended=1.
 *
 * google-signup-prefill round 2 (design-spec §3): `/signup`'s frame, order and
 * components (LY1–LY6), the shared phone field (PH), Gender/Role `Select`s
 * (DI5, LY3), Town + Region with suggestions for artisans (LOC), an optional
 * bio (B1) and inline validation with no native bubbles or toasts (V1–V8).
 */

const EXPIRED_REDIRECT = "/login?error=signup_expired"
const SIGNUP_EXPIRED_CODE = "SOCIAL_SIGNUP_EXPIRED"

// CompleteSocialSignupDto's @MaxLength on bio and businessName.
const BIO_MAX_LENGTH = 1000
const BUSINESS_NAME_MAX_LENGTH = 150

type SelfSelectableRole = "CUSTOMER" | "ARTISAN"

interface PendingSignup {
  email: string
  firstname: string
  lastname: string
  profilePicture?: string | null
  suggestedRole: SelfSelectableRole | null
  provider: string
}

interface ServiceOption {
  id: string
  name: string
}

/** `POST /auth/social/complete` answers exactly like `POST /auth/login`. */
interface CompleteSignupResponse {
  access_token?: string
  data?: { role?: string }
}

type Field =
  | "firstname"
  | "lastname"
  | "phoneNumber"
  | "gender"
  | "role"
  | "services"
  | "town"
  | "region"
  | "hourlyRate"
  | "bio"
  | "experienceYears"
  | "businessName"

/** DOM order = visual order (two-up rows read left, then right). */
const FIELDS: readonly Field[] = [
  "firstname",
  "lastname",
  "phoneNumber",
  "gender",
  "role",
  "services",
  "town",
  "region",
  "hourlyRate",
  "bio",
  "experienceYears",
  "businessName",
]

const LABELS: Record<Field, string> = {
  firstname: "First name",
  lastname: "Last name",
  phoneNumber: "Phone number",
  gender: "Gender",
  role: "Role",
  services: "Services you offer",
  town: "Town or area",
  region: "Region",
  hourlyRate: "Hourly rate",
  bio: "Bio",
  experienceYears: "Years of experience",
  businessName: "Business name",
}

function isSignupExpired(error: unknown): boolean {
  return error instanceof ApiError && (error.code === SIGNUP_EXPIRED_CODE || error.status === 401)
}

/** "50", "50.5" and "50,5" are all accepted (§3.7). */
function parseRate(raw: string): number | null {
  const text = raw.trim().replace(",", ".")
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : null
}

function validateRate(raw: string, requireValue: boolean): string | null {
  if (!raw.trim()) return requireValue ? "Enter your hourly rate" : null
  const rate = parseRate(raw)
  if (rate === null || rate <= 0) return "Enter an amount above 0, like 50"
  if (!/^\d+([.,]\d{1,2})?$/.test(raw.trim())) return "Use up to 2 decimal places, like 50.50"
  return null
}

function validateExperience(raw: string): string | null {
  if (!raw.trim()) return null
  const text = raw.trim()
  return /^\d+$/.test(text) && Number(text) <= 80 ? null : "Enter a whole number from 0 to 80"
}

export function CompleteSignupForm() {
  const router = useRouter()
  const [pending, setPending] = useState<PendingSignup | null>(null)
  // null = loading, "error" = the list could not be fetched.
  const [services, setServices] = useState<ServiceOption[] | null | "error">(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  // 409: someone (or a parallel tab) registered this email between the
  // Google callback and this submit. Shown as a banner with a way to sign in,
  // not a toast, because there is nothing left to retry on this page.
  const [accountExists, setAccountExists] = useState(false)
  const accountExistsRef = useRef<HTMLDivElement>(null)
  const [phoneCountry, setPhoneCountry] = useState<SupportedPhoneCountry>(DEFAULT_PHONE_COUNTRY)
  const [formData, setFormData] = useState({
    role: "" as SelfSelectableRole | "",
    firstname: "",
    lastname: "",
    phoneNumber: "",
    gender: "",
    serviceIds: [] as string[],
    town: "",
    region: "",
    hourlyRate: "",
    bio: "",
    businessName: "",
    experienceYears: "",
  })
  const regions = useRegionList(phoneCountry)

  const update = useCallback(
    <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
      setFormData((prev) => ({ ...prev, [key]: value })),
    [],
  )
  const setTown = useCallback((value: string) => update("town", value), [update])
  const setRegion = useCallback((value: string) => update("region", value), [update])

  // Strict Mode mounts twice in dev; one GET is enough.
  const loadedRef = useRef(false)

  const loadServices = useCallback(() => {
    setServices(null)
    // Same response-shape handling as the customer search page: the list
    // endpoint has returned both a bare array and `{ items }`.
    apiFetchWithMeta<ServiceOption[] | { items: ServiceOption[] }>("/services", { skipAuth: true })
      .then(({ data }) => setServices(Array.isArray(data) ? data : (data?.items ?? [])))
      .catch(() => setServices("error"))
  }, [])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    apiFetch<PendingSignup>("/auth/social/pending", { skipAuth: true })
      .then((data) => {
        setPending(data)
        setFormData((prev) => ({
          ...prev,
          // No preselection when the backend has no suggestion: the whole point
          // of this page is that the user picks, rather than defaulting to
          // CUSTOMER the way the old callback did.
          role: data.suggestedRole === "CUSTOMER" || data.suggestedRole === "ARTISAN" ? data.suggestedRole : "",
          firstname: data.firstname ?? "",
          lastname: data.lastname ?? "",
        }))
      })
      .catch(() => router.replace(EXPIRED_REDIRECT))

    loadServices()
  }, [router, loadServices])

  const isArtisan = formData.role === "ARTISAN"
  const isBusy = isSubmitting || isCancelling
  const serviceList = Array.isArray(services) ? services : []

  /** Mirrors the backend DTO's rules so most mistakes never leave the browser (V6 copy). */
  const validateField = (field: Field, mode: ValidationMode): string | null => {
    const submit = mode === "submit"
    switch (field) {
      case "firstname":
        return validateName(formData.firstname, "first", submit)
      case "lastname":
        return validateName(formData.lastname, "last", submit)
      case "phoneNumber":
        return validatePhoneNumber(formData.phoneNumber, phoneCountry, { requireValue: submit })
      case "gender":
        return submit && !formData.gender ? GENDER_REQUIRED : null
      case "role":
        return submit && !formData.role ? ROLE_REQUIRED : null
    }
    if (!isArtisan) return null
    switch (field) {
      case "services":
        return submit && formData.serviceIds.length === 0 ? "Choose at least one service you offer" : null
      case "town":
        return validateTown(formData.town, formData.region, { requireValue: submit })
      case "region":
        // While the list loads, only emptiness can be judged.
        return validateRegion(formData.region, regions === undefined ? null : regions, { requireValue: submit })
      case "hourlyRate":
        return validateRate(formData.hourlyRate, submit)
      case "experienceYears":
        return validateExperience(formData.experienceYears)
      case "businessName":
        return formData.businessName.trim().length > BUSINESS_NAME_MAX_LENGTH
          ? "Shorten to 150 characters or fewer"
          : null
      case "bio":
        return formData.bio.trim().length > BIO_MAX_LENGTH ? "Use 1,000 characters or fewer" : null
    }
    return null
  }

  const values = useMemo(() => ({ ...formData, phoneCountry, regions }), [formData, phoneCountry, regions])
  const v = useFormValidation<Field>({
    fields: FIELDS,
    values,
    validate: validateField,
    labels: LABELS,
    focusTarget: (field) => {
      if (field === "services") {
        const first = serviceList[0]
        return document.getElementById(first ? `service-${first.id}` : "services")
      }
      return document.getElementById(field)
    },
  })

  // A Google name already over the 15-character limit is flagged on load (§1.4).
  const namesCheckedRef = useRef(false)
  useEffect(() => {
    if (!pending || namesCheckedRef.current) return
    namesCheckedRef.current = true
    v.validateFields(["firstname", "lastname"])
  }, [pending, v])

  useEffect(() => {
    if (accountExists) accountExistsRef.current?.focus()
  }, [accountExists])

  const toggleService = (id: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      serviceIds: checked ? [...prev.serviceIds, id] : prev.serviceIds.filter((s) => s !== id),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountExists(false)
    if (!v.validateAll()) return

    const phoneNumber = phoneToE164(formData.phoneNumber, phoneCountry)
    if (!phoneNumber) return // unreachable: validateAll just accepted it

    setIsSubmitting(true)
    try {
      const bio = formData.bio.trim()
      const rate = parseRate(formData.hourlyRate)
      // Artisan-only fields are left off entirely for a customer, rather than
      // sent empty, so the backend never has to decide what "" means there.
      const payload = {
        role: formData.role,
        firstname: formData.firstname.trim(),
        lastname: formData.lastname.trim(),
        phoneNumber,
        gender: formData.gender,
        ...(isArtisan
          ? {
              serviceIds: formData.serviceIds.map(Number),
              location: formatLocation(formData.town, formData.region),
              hourlyRate: rate,
              ...(bio ? { bio } : {}),
              ...(formData.businessName.trim() ? { businessName: formData.businessName.trim() } : {}),
              ...(formData.experienceYears.trim() ? { experienceYears: Number(formData.experienceYears.trim()) } : {}),
            }
          : {}),
      }

      const data = await apiFetchBody<CompleteSignupResponse>("/auth/social/complete", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify(payload),
      })

      if (!data.access_token) throw new Error("Sign-up failed")

      // Refresh + session cookies arrived as httpOnly Set-Cookie on this
      // response, exactly as on login; only the access token is ours to hold.
      persistAuthTokens(data.access_token)
      clearCachedUser()
      if (isArtisan) {
        toast.success("Your account is ready, and customers can now find you.", {
          description: bio ? undefined : "Add a short bio from your profile to stand out.",
        })
      } else {
        toast.success("Your account is ready.")
      }
      router.replace(dashboardPathForRole(data.data?.role ?? formData.role))
    } catch (error) {
      if (isSignupExpired(error)) {
        router.replace(EXPIRED_REDIRECT)
        return
      }
      // Only the email-taken 409 means "go sign in"; a phone-number clash is
      // also a 409 but keeps the pending entry, so it lands on the phone field
      // (PH9, V5) and the user can fix the number and resubmit.
      if (error instanceof ApiError && error.status === 409 && error.code === "UserAlreadyExists") {
        setAccountExists(true)
        return
      }
      if (isPhoneInUse(error)) {
        v.setServerError("phoneNumber", PHONE_MESSAGES.inUse)
        return
      }
      if (error instanceof ApiError && error.status === 400) {
        const fieldErrors = serverFieldMessages(error.message, phoneCountry)
        if (fieldErrors.phoneNumber) {
          v.setServerError("phoneNumber", fieldErrors.phoneNumber)
          return
        }
        if (fieldErrors.gender) {
          v.setServerError("gender", fieldErrors.gender)
          return
        }
        if (/service/i.test(error.message) && isArtisan) {
          v.setServerError(
            "services",
            "One of these services is no longer available. Refresh the list and choose again.",
          )
          return
        }
      }
      if (error instanceof ApiError && error.status < 500) {
        toast.error(error.message)
      } else {
        toast.error("We couldn't create your account.", { description: "Check your connection and try again." })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      await apiFetch("/auth/social/cancel", { method: "POST", skipAuth: true })
    } catch {
      // Cancel is best-effort: the pending entry expires on its own anyway.
    }
    router.replace("/login")
  }

  if (!pending) {
    return (
      <AuthSplitLayout>
        <div className="space-y-8 text-center bg-background rounded-lg p-8 shadow-sm" role="status">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
            </div>
          </div>
          <p className="text-muted-foreground">Loading your sign-up&hellip;</p>
        </div>
      </AuthSplitLayout>
    )
  }

  const bioLength = formData.bio.trim().length
  const servicesError = v.errors.services

  return (
    <AuthSplitLayout>
      <div className={AUTH_FORM_CONTAINER_CLASS}>
        <div className="space-y-2">
          <h1 className={AUTH_HEADING_CLASS}>Complete your account</h1>
          <p className="text-muted-foreground">
            A few more details and you&apos;re in. Nothing is created until you finish.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting} className="space-y-6">
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
                  enterKeyHint="next"
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

          {/* D1: the Google account's email, read-only (not disabled, so it
              stays in the tab order and is read by screen readers). */}
          <FormField id="email" label="Email" hint="The Google account you signed in with.">
            {(control) => (
              <Input
                {...control}
                type="email"
                autoComplete="email"
                value={pending.email}
                readOnly
                className={cn(AUTH_INPUT_CLASS, "bg-muted dark:bg-muted")}
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
            disabled={isBusy}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField id="gender" label="Gender" error={v.errors.gender}>
              {(control) => (
                <Select
                  value={formData.gender}
                  onValueChange={(value) => update("gender", value)}
                  disabled={isBusy}
                  required
                >
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
                  onValueChange={(value) => update("role", value as SelfSelectableRole)}
                  disabled={isBusy}
                  required
                >
                  <SelectTrigger {...control} aria-required="true" className={AUTH_SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="ARTISAN">Artisan</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>

          {/* Artisan-only: exactly what the backend's profile-completeness check
              needs (services, location, rate), so a new artisan shows up in
              search straight away. Bio is optional (B1). */}
          {isArtisan && (
            <div className="space-y-6">
              <h2 className="border-t pt-6 text-sm font-medium text-foreground">Your work</h2>

              <fieldset
                id="services"
                tabIndex={-1}
                className="space-y-2 scroll-mt-24 outline-none"
                disabled={isBusy}
                aria-describedby={servicesError ? "services-error" : undefined}
              >
                <FormFieldLabel as="legend" invalid={!!servicesError}>
                  Services you offer
                </FormFieldLabel>
                {services === null ? (
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-input p-3" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className="h-5" />
                    ))}
                  </div>
                ) : services === "error" ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">We couldn&apos;t load the list of services.</p>
                    <Button type="button" variant="outline" size="sm" onClick={loadServices}>
                      Try again
                    </Button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "max-h-44 overflow-y-auto rounded-md border border-input p-3 grid grid-cols-2 gap-2 dark:bg-input/30",
                      servicesError && "border-destructive",
                    )}
                  >
                    {serviceList.map((service) => {
                      const id = `service-${service.id}`
                      return (
                        <div key={service.id} className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            checked={formData.serviceIds.includes(String(service.id))}
                            onCheckedChange={(checked) => toggleService(String(service.id), !!checked)}
                          />
                          <Label htmlFor={id} className="text-sm font-normal text-foreground cursor-pointer">
                            {service.name}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                )}
                <FormFieldMessage id="services" error={servicesError} />
              </fieldset>

              <LocationFields
                country={phoneCountry}
                regions={regions}
                town={formData.town}
                region={formData.region}
                onTownChange={setTown}
                onRegionChange={setRegion}
                onTownBlur={() => v.handleBlur("town")}
                onRegionBlur={() => v.handleBlur("region")}
                townError={v.errors.town}
                regionError={v.errors.region}
                onAnnounce={v.announce}
                nextFocusId="hourlyRate"
                disabled={isBusy}
              />

              {/* Unit in the label, not a "$" icon — same as the artisan
                  profile page, since rates are in cedis. */}
              <FormField
                id="hourlyRate"
                label="Hourly rate (GH₵)"
                hint="What you charge per hour. You can change it any time."
                error={v.errors.hourlyRate}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    enterKeyHint="next"
                    value={formData.hourlyRate}
                    onChange={(e) => update("hourlyRate", e.target.value)}
                    onBlur={() => v.handleBlur("hourlyRate")}
                    className={AUTH_INPUT_CLASS}
                    required
                    disabled={isBusy}
                  />
                )}
              </FormField>

              <h2 className="border-t pt-6 text-sm font-medium text-muted-foreground">
                Optional — you can add these later
              </h2>

              <FormField
                id="bio"
                label="Bio"
                optional
                hint="A few lines about your work help customers choose you. You can add this later."
                error={v.errors.bio}
                describedBy="bio-count"
                aside={
                  <span
                    id="bio-count"
                    className={cn(
                      "shrink-0 text-xs text-muted-foreground tabular-nums",
                      bioLength > BIO_MAX_LENGTH && "text-destructive",
                    )}
                  >
                    {bioLength.toLocaleString("en")} / 1,000
                  </span>
                }
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={4}
                    autoComplete="off"
                    value={formData.bio}
                    onChange={(e) => update("bio", e.target.value)}
                    onBlur={() => v.handleBlur("bio")}
                    className="bg-background border-input text-foreground"
                    disabled={isBusy}
                  />
                )}
              </FormField>

              <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
                <FormField id="experienceYears" label="Years of experience" optional error={v.errors.experienceYears}>
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      enterKeyHint="next"
                      value={formData.experienceYears}
                      onChange={(e) => update("experienceYears", e.target.value)}
                      onBlur={() => v.handleBlur("experienceYears")}
                      className={AUTH_INPUT_CLASS}
                      disabled={isBusy}
                    />
                  )}
                </FormField>
                <FormField id="businessName" label="Business name" optional error={v.errors.businessName}>
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      autoComplete="organization"
                      enterKeyHint="done"
                      value={formData.businessName}
                      onChange={(e) => update("businessName", e.target.value)}
                      onBlur={() => v.handleBlur("businessName")}
                      className={AUTH_INPUT_CLASS}
                      disabled={isBusy}
                    />
                  )}
                </FormField>
              </div>
            </div>
          )}

          {accountExists && (
            <div
              ref={accountExistsRef}
              role="alert"
              tabIndex={-1}
              className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground outline-none"
            >
              <p className="font-medium">An account with this email already exists</p>
              <p className="mt-0.5">Sign in to it instead — Continue with Google will work there too.</p>
              <Link
                href="/login"
                className="mt-1 inline-block font-medium underline underline-offset-2 hover:text-warning"
              >
                Go to sign in
              </Link>
            </div>
          )}

          <div className="space-y-3">
            <Button
              type="submit"
              className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
              disabled={isBusy}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? "Creating your account…" : "Create account"}
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              disabled={isBusy}
              className="w-full h-10 border border-input bg-background hover:bg-accent font-normal text-foreground hover:text-accent-foreground transition-colors"
            >
              {isCancelling ? "Cancelling…" : "Cancel"}
            </Button>
          </div>
        </form>
      </div>
    </AuthSplitLayout>
  )
}
