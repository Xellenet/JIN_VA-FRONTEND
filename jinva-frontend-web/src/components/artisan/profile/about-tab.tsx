"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Mail, Lock, MapPin, Loader2, AlertTriangle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { ApiError, apiFetch } from "@/lib/api"
import { PhoneField } from "@/components/forms/phone-field"
import { PHONE_IN_USE_CODE } from "@/components/auth/signup-fields"
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_MESSAGES,
  phoneUpdateFor,
  splitStoredPhone,
  type SupportedPhoneCountry,
} from "@/lib/phone"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { BioNudge, ProfileCompleteness, readProfileCompleteness } from "@/components/artisan/profile-completeness"
import { ProfilePhotoCard } from "@/components/settings/profile-photo-card"

/** The backend's UpdateMeDto and artisan-profile DTO limits. */
const NAME_MAX = 15
const MAX_SERVICE_RADIUS_KM = 500
const CANCELLATION_POLICY_MAX = 1000

export interface BackendArtisanProfile {
  id: string
  bio?: string | null
  experienceYears?: number
  hourlyRate?: number
  businessName?: string
  averageRating: number
  totalReviews: number
  availabilityStatus: string
  isVerified: boolean
  location?: string
  serviceRadiusKm?: number | null
  cancellationPolicy?: string | null
  services?: { id: string; name: string }[]
  // C2: the persisted search-visibility flag and the ordered list of
  // still-missing required fields. Optional because a legacy response may omit
  // them, which the completeness component reads as "unknown".
  isProfileComplete?: boolean
  missingFields?: string[]
}

/**
 * FE-2: the fields `PATCH /users/me/artisan-profile` owns. When that half of
 * the save is rejected while the contact half has already committed, these are
 * the inputs holding a value the server does not have — so they are the ones
 * that get marked.
 */
type ProfessionalField =
  | "bio"
  | "location"
  | "experienceYears"
  | "hourlyRate"
  | "businessName"
  | "serviceRadiusKm"
  | "cancellationPolicy"

type FieldErrorKey =
  | "firstname"
  | "lastname"
  | "experience"
  | "hourlyRate"
  | "businessName"
  | "bio"
  | "location"
  | "radius"
  | "cancellationPolicy"

/**
 * FE-2: an amber ring on an input whose value is not what is stored.
 * Deliberately not `aria-invalid`: nothing typed is invalid; the state is "not
 * saved", which the note below the field says in words.
 */
const UNSAVED_FIELD_CLASS = "border-warning focus-visible:border-warning focus-visible:ring-warning/30"

function UnsavedFieldNote({ id }: { id: string }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs font-medium text-warning">
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      Not saved yet
    </p>
  )
}

function FieldMessage({ id, error }: { id: string; error?: string }) {
  if (!error) return null
  return (
    <p id={`${id}-error`} className="text-sm text-destructive">
      {error}
    </p>
  )
}

/** `aria-describedby` for an input: its error and/or its "not saved yet" note. */
function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const list = ids.filter(Boolean)
  return list.length ? list.join(" ") : undefined
}

export type ProfileLoadState = "loading" | "error" | "ready"

/**
 * Profile → About: the photo and the details clients read (name, phone,
 * service area, bio, rate, policy), with the completeness checklist. The
 * profile itself is loaded by the page, which also shows it in the header;
 * `loadedAt` changes on each fresh load, which is when the form is refilled
 * (a save updates `profile` but never overwrites what is typed).
 */
export function AboutTab({
  profile: artisanProfile,
  loadState,
  loadedAt,
  onReload,
  onSaved,
}: Readonly<{
  profile: BackendArtisanProfile | null
  loadState: ProfileLoadState
  loadedAt: number
  onReload: () => void
  onSaved: (saved: BackendArtisanProfile) => void
}>) {
  const { user, refreshUser } = useAuth()

  // Personal info form
  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [phoneCountry, setPhoneCountry] = useState<SupportedPhoneCountry>(DEFAULT_PHONE_COUNTRY)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  // Artisan profile form
  const [bio, setBio] = useState("")
  const [location, setLocation] = useState("")
  const [experienceYears, setExperienceYears] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [serviceRadiusKm, setServiceRadiusKm] = useState("")
  const [cancellationPolicy, setCancellationPolicy] = useState("")

  const [isSaving, setIsSaving] = useState(false)

  // FE-2: set when the contact half of a save committed and the professional
  // half was rejected — the only outcome where the page shows a mix of stored
  // and unstored values. Cleared by the next successful save.
  const [professionalHalfUnsaved, setProfessionalHalfUnsaved] = useState(false)

  /**
   * C2.4: a completeness row's action lands the caret in the input that fixes
   * it, not just the viewport. Retries a few frames in case the input is still
   * mounting.
   */
  const focusProfileField = useCallback((anchorId: string) => {
    let attempts = 0
    const tryFocus = () => {
      const el = document.getElementById(anchorId)
      if (!el) {
        if (attempts++ < 20) requestAnimationFrame(tryFocus)
        return
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true })
    }
    requestAnimationFrame(tryFocus)
  }, [])

  // Populate personal fields from auth user
  useEffect(() => {
    if (!user) return
    const parts = user.name.split(" ")
    setFirstname(user.firstname ?? parts[0] ?? "")
    setLastname(user.lastname ?? parts.slice(1).join(" "))
    setEmail(user.email ?? "")
    const storedPhone = splitStoredPhone(user.phone)
    setPhone(storedPhone.national)
    setPhoneCountry(storedPhone.country)
    setPhoneError(null)
  }, [user])

  const fillForm = (profile: BackendArtisanProfile) => {
    setBio(profile.bio ?? "")
    setLocation(profile.location ?? "")
    setExperienceYears(profile.experienceYears != null ? String(profile.experienceYears) : "")
    setBusinessName(profile.businessName ?? "")
    setHourlyRate(profile.hourlyRate != null ? String(profile.hourlyRate) : "")
    setServiceRadiusKm(profile.serviceRadiusKm != null ? String(profile.serviceRadiusKm) : "")
    setCancellationPolicy(profile.cancellationPolicy ?? "")
  }

  useEffect(() => {
    if (artisanProfile && loadState === "ready") fillForm(artisanProfile)
    // Only on a fresh load (or on mount): never on a save, which would
    // overwrite what is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedAt, loadState])

  /**
   * FE-2: which professional inputs currently differ from what the server
   * holds (`artisanProfile`, which a failed save leaves untouched). Numeric
   * fields compare as numbers: the API returns `95.00` for a typed `95`.
   */
  const unsavedFields = useMemo<Set<ProfessionalField>>(() => {
    const marked = new Set<ProfessionalField>()
    if (!professionalHalfUnsaved) return marked

    const differsAsText = (typed: string, stored: string | null | undefined) => typed.trim() !== (stored ?? "").trim()
    const differsAsNumber = (typed: string, stored: number | null | undefined) => {
      if (typed.trim() === "") return stored != null
      return stored == null || Number(typed) !== Number(stored)
    }

    if (differsAsText(bio, artisanProfile?.bio)) marked.add("bio")
    if (differsAsText(location, artisanProfile?.location)) marked.add("location")
    if (differsAsText(businessName, artisanProfile?.businessName)) marked.add("businessName")
    if (differsAsText(cancellationPolicy, artisanProfile?.cancellationPolicy)) marked.add("cancellationPolicy")
    if (differsAsNumber(experienceYears, artisanProfile?.experienceYears)) marked.add("experienceYears")
    if (differsAsNumber(hourlyRate, artisanProfile?.hourlyRate)) marked.add("hourlyRate")
    if (differsAsNumber(serviceRadiusKm, artisanProfile?.serviceRadiusKm)) marked.add("serviceRadiusKm")
    return marked
  }, [
    professionalHalfUnsaved,
    artisanProfile,
    bio,
    location,
    businessName,
    cancellationPolicy,
    experienceYears,
    hourlyRate,
    serviceRadiusKm,
  ])

  // QA ART-03: the server's limits, checked before anything is sent, with the
  // message under the field rather than raw validator text in a toast.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldErrorKey, string>>>({})
  const clearFieldError = (key: FieldErrorKey) =>
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))

  const validate = () => {
    const errors: typeof fieldErrors = {}
    if (!firstname.trim()) errors.firstname = "Enter your first name."
    else if (firstname.trim().length > NAME_MAX) errors.firstname = `Use at most ${NAME_MAX} characters.`
    if (!lastname.trim()) errors.lastname = "Enter your last name."
    else if (lastname.trim().length > NAME_MAX) errors.lastname = `Use at most ${NAME_MAX} characters.`
    if (location.length > 150) errors.location = "Service area can be at most 150 characters."
    if (serviceRadiusKm.trim()) {
      const n = Number(serviceRadiusKm)
      if (!Number.isInteger(n) || n < 1 || n > MAX_SERVICE_RADIUS_KM)
        errors.radius = `Enter whole kilometres from 1 to ${MAX_SERVICE_RADIUS_KM}.`
    }
    if (cancellationPolicy.length > CANCELLATION_POLICY_MAX)
      errors.cancellationPolicy = `Cancellation policy can be at most ${CANCELLATION_POLICY_MAX.toLocaleString("en-GB")} characters.`
    if (bio.length > 1000) errors.bio = "Bio can be at most 1,000 characters."
    if (experienceYears.trim()) {
      const n = Number(experienceYears)
      if (!Number.isInteger(n) || n < 1 || n > 80) errors.experience = "Enter whole years from 1 to 80."
    }
    if (hourlyRate.trim()) {
      const n = Number(hourlyRate)
      if (!Number.isFinite(n) || n <= 0) errors.hourlyRate = "Enter a rate above 0."
      else if (!/^\d+(\.\d{1,2})?$/.test(hourlyRate.trim())) errors.hourlyRate = "Use at most 2 decimal places, like 50.25."
    }
    if (businessName.length > 150) errors.businessName = "Business name can be at most 150 characters."
    setFieldErrors(errors)
    const first = Object.keys(errors)[0]
    if (first) document.getElementById(first)?.focus()
    return !first
  }

  const handleSaveProfile = async () => {
    const wasIncomplete = readProfileCompleteness(artisanProfile).state === "incomplete"
    const phoneUpdate = phoneUpdateFor(user?.phone, phone, phoneCountry)
    if (!validate()) return
    if (phoneUpdate.error) {
      setPhoneError(phoneUpdate.error)
      document.getElementById("phone")?.focus()
      return
    }

    setIsSaving(true)
    try {
      // FE-4: sequential, never `Promise.all` — if the user-record PATCH fails
      // (e.g. phone already in use), the profile write is never sent, so the
      // common failure is all-or-nothing.
      await apiFetch("/users/me", {
        method: "PATCH",
        // `email` is deliberately absent: UpdateMeDto rejects it.
        // PH11: phone is E.164, and sent only when edited.
        body: JSON.stringify({
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          ...(phoneUpdate.phoneNumber ? { phoneNumber: phoneUpdate.phoneNumber } : {}),
        }),
      })

      let savedProfile: BackendArtisanProfile
      try {
        savedProfile = await apiFetch<BackendArtisanProfile>("/users/me/artisan-profile", {
          method: "PATCH",
          body: JSON.stringify({
            // B5: a blank bio is sent as null so clearing it sticks.
            bio: bio.trim() ? bio : null,
            experienceYears: experienceYears ? Number(experienceYears) : undefined,
            businessName: businessName || undefined,
            hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
            location: location || undefined,
            ...(serviceRadiusKm.trim() ? { serviceRadiusKm: Number(serviceRadiusKm) } : {}),
            cancellationPolicy: cancellationPolicy || undefined,
          }),
        })
      } catch (profileErr: unknown) {
        // Half-saved: contact details landed, professional ones didn't. Say so
        // plainly, keep what was typed, and mark the unsaved fields (FE-2).
        // `artisanProfile` stays the stored truth.
        setProfessionalHalfUnsaved(true)
        await refreshUser()
        const reason = profileErr instanceof Error ? profileErr.message : ""
        toast.error(
          reason
            ? `Your name and phone were saved, but your work details weren’t: ${reason}`
            : "Your name and phone were saved, but your work details weren’t. Try again.",
        )
        return
      }

      // C2: the PATCH response carries fresh completeness, so the checklist
      // and the hero badge update straight from the save.
      onSaved(savedProfile)
      setProfessionalHalfUnsaved(false)
      await refreshUser()
      const nowComplete = readProfileCompleteness(savedProfile).state === "complete"
      toast.success(wasIncomplete && nowComplete ? "Profile saved. Clients can now find you in search." : "Profile saved")
    } catch (err: unknown) {
      // Only the user-record half can reach this, so nothing was committed.
      if (err instanceof ApiError && err.code === PHONE_IN_USE_CODE) {
        setPhoneError(PHONE_MESSAGES.inUse)
        return
      }
      toast.error(err instanceof Error ? err.message : "Couldn’t save your profile. Try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* C2/§3.2: the completeness checklist, above the form. */}
      <ProfileCompleteness
        variant="card"
        profile={artisanProfile}
        isLoading={loadState === "loading"}
        onFixField={focusProfileField}
      />

      {/* B3: bio is optional — a "Recommended" nudge, driven by the stored bio. */}
      {loadState === "ready" && artisanProfile && !artisanProfile.bio?.trim() && (
        <BioNudge onAdd={() => focusProfileField("bio")} />
      )}

      {/* The photo clients see (upload and remove), as in customer Settings. */}
      <ProfilePhotoCard user={user} refreshUser={refreshUser} />

      {loadState === "loading" ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" aria-label="Loading your profile" />
        </div>
      ) : loadState === "error" ? (
        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-foreground">Couldn&apos;t load your profile</p>
            <p className="mt-1 text-sm text-muted-foreground">Nothing has changed. Try again to edit your details.</p>
            <Button variant="outline" className="mt-4 max-sm:h-11" onClick={onReload}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <form
          noValidate
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSaveProfile()
          }}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="gap-0 py-0">
              <div className="border-b p-4 sm:p-6">
                <h2 className="font-semibold text-foreground">Personal information</h2>
                <p className="text-sm text-muted-foreground">Your name appears on your profile and in messages.</p>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstname" className={fieldErrors.firstname ? "text-destructive" : undefined}>First name</Label>
                    <Input
                      id="firstname"
                      className="max-sm:h-11"
                      autoComplete="given-name"
                      maxLength={NAME_MAX}
                      value={firstname}
                      aria-invalid={fieldErrors.firstname ? true : undefined}
                      aria-describedby={describedBy(fieldErrors.firstname && "firstname-error")}
                      onChange={(e) => {
                        setFirstname(e.target.value)
                        clearFieldError("firstname")
                      }}
                    />
                    <FieldMessage id="firstname" error={fieldErrors.firstname} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastname" className={fieldErrors.lastname ? "text-destructive" : undefined}>Last name</Label>
                    <Input
                      id="lastname"
                      className="max-sm:h-11"
                      autoComplete="family-name"
                      maxLength={NAME_MAX}
                      value={lastname}
                      aria-invalid={fieldErrors.lastname ? true : undefined}
                      aria-describedby={describedBy(fieldErrors.lastname && "lastname-error")}
                      onChange={(e) => {
                        setLastname(e.target.value)
                        clearFieldError("lastname")
                      }}
                    />
                    <FieldMessage id="lastname" error={fieldErrors.lastname} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    {/* `PATCH /users/me` rejects `email` — changing it needs its own verified flow. */}
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
                      <Input
                        id="email"
                        className="cursor-not-allowed bg-muted/50 pl-10 pr-9 text-muted-foreground max-sm:h-11"
                        value={email}
                        readOnly
                        aria-describedby="email-hint"
                      />
                    </div>
                    <p id="email-hint" className="text-xs text-muted-foreground">Email can&apos;t be changed.</p>
                  </div>
                  <PhoneField
                    id="phone"
                    label="Phone"
                    value={phone}
                    country={phoneCountry}
                    onChange={(value) => {
                      setPhone(value)
                      setPhoneError(null)
                    }}
                    onCountryChange={(next) => {
                      setPhoneCountry(next)
                      setPhoneError(null)
                    }}
                    error={phoneError}
                    disabled={isSaving}
                    // 44px tap targets on phones, like the other inputs here.
                    className="max-sm:[&_button]:h-11 max-sm:[&_input]:h-11"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <div className="border-b p-4 sm:p-6">
                <h2 className="font-semibold text-foreground">Where you work</h2>
                <p className="text-sm text-muted-foreground">Clients search by area. Set how far you&apos;ll travel.</p>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="location" className={fieldErrors.location ? "text-destructive" : undefined}>Service area</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <Textarea
                        id="location"
                        className={cn("pl-10", unsavedFields.has("location") && UNSAVED_FIELD_CLASS)}
                        value={location}
                        onChange={(e) => {
                          setLocation(e.target.value)
                          clearFieldError("location")
                        }}
                        placeholder="e.g. East Legon, Accra"
                        rows={2}
                        maxLength={150}
                        aria-invalid={fieldErrors.location ? true : undefined}
                        aria-describedby={describedBy(
                          fieldErrors.location && "location-error",
                          unsavedFields.has("location") && "location-unsaved",
                        )}
                      />
                    </div>
                    {unsavedFields.has("location") && <UnsavedFieldNote id="location-unsaved" />}
                    <FieldMessage id="location" error={fieldErrors.location} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="radius" className={fieldErrors.radius ? "text-destructive" : undefined}>
                      How far you&apos;ll travel <span className="font-normal">(km, optional)</span>
                    </Label>
                    <Input
                      id="radius"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_SERVICE_RADIUS_KM}
                      step={1}
                      placeholder="e.g. 25"
                      className={cn("max-sm:h-11 md:w-1/2", unsavedFields.has("serviceRadiusKm") && UNSAVED_FIELD_CLASS)}
                      value={serviceRadiusKm}
                      aria-invalid={fieldErrors.radius ? true : undefined}
                      aria-describedby={describedBy(
                        fieldErrors.radius && "radius-error",
                        unsavedFields.has("serviceRadiusKm") && "radius-unsaved",
                      )}
                      onChange={(e) => {
                        setServiceRadiusKm(e.target.value)
                        clearFieldError("radius")
                      }}
                    />
                    {unsavedFields.has("serviceRadiusKm") && <UnsavedFieldNote id="radius-unsaved" />}
                    <FieldMessage id="radius" error={fieldErrors.radius} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cancellationPolicy" className={fieldErrors.cancellationPolicy ? "text-destructive" : undefined}>
                      Cancellation policy <span className="font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      id="cancellationPolicy"
                      className={unsavedFields.has("cancellationPolicy") ? UNSAVED_FIELD_CLASS : undefined}
                      placeholder="e.g. Free cancellation up to a day before the job."
                      value={cancellationPolicy}
                      maxLength={CANCELLATION_POLICY_MAX}
                      rows={3}
                      aria-invalid={fieldErrors.cancellationPolicy ? true : undefined}
                      aria-describedby={describedBy(
                        "cancellationPolicy-hint",
                        fieldErrors.cancellationPolicy && "cancellationPolicy-error",
                        unsavedFields.has("cancellationPolicy") && "cancellationPolicy-unsaved",
                      )}
                      onChange={(e) => {
                        setCancellationPolicy(e.target.value)
                        clearFieldError("cancellationPolicy")
                      }}
                    />
                    {unsavedFields.has("cancellationPolicy") && <UnsavedFieldNote id="cancellationPolicy-unsaved" />}
                    <FieldMessage id="cancellationPolicy" error={fieldErrors.cancellationPolicy} />
                    <p id="cancellationPolicy-hint" className="text-xs text-muted-foreground">
                      Shown on your profile so clients know it before they book.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0 lg:col-span-2">
              <div className="border-b p-4 sm:p-6">
                <h2 className="font-semibold text-foreground">Professional details</h2>
                <p className="text-sm text-muted-foreground">What clients read before they hire you.</p>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="bio" className={fieldErrors.bio ? "text-destructive" : undefined}>
                      Bio <span className="font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      id="bio"
                      className={unsavedFields.has("bio") ? UNSAVED_FIELD_CLASS : undefined}
                      value={bio}
                      onChange={(e) => {
                        setBio(e.target.value)
                        clearFieldError("bio")
                      }}
                      placeholder="Your experience, what you specialise in and what clients can expect."
                      rows={4}
                      maxLength={1000}
                      aria-invalid={fieldErrors.bio ? true : undefined}
                      aria-describedby={describedBy(fieldErrors.bio && "bio-error", unsavedFields.has("bio") && "bio-unsaved")}
                    />
                    {unsavedFields.has("bio") && <UnsavedFieldNote id="bio-unsaved" />}
                    <FieldMessage id="bio" error={fieldErrors.bio} />
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="experience" className={fieldErrors.experience ? "text-destructive" : undefined}>Years of experience</Label>
                      <Input
                        id="experience"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="80"
                        step="1"
                        className={cn("max-sm:h-11", unsavedFields.has("experienceYears") && UNSAVED_FIELD_CLASS)}
                        value={experienceYears}
                        onChange={(e) => {
                          setExperienceYears(e.target.value)
                          clearFieldError("experience")
                        }}
                        placeholder="e.g. 5"
                        aria-invalid={fieldErrors.experience ? true : undefined}
                        aria-describedby={describedBy(
                          fieldErrors.experience && "experience-error",
                          unsavedFields.has("experienceYears") && "experience-unsaved",
                        )}
                      />
                      {unsavedFields.has("experienceYears") && <UnsavedFieldNote id="experience-unsaved" />}
                      <FieldMessage id="experience" error={fieldErrors.experience} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hourlyRate" className={fieldErrors.hourlyRate ? "text-destructive" : undefined}>Hourly rate (GH₵)</Label>
                      {/* No currency icon: lucide's DollarSign is a "$". The label carries the unit. */}
                      <Input
                        id="hourlyRate"
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        className={cn("max-sm:h-11", unsavedFields.has("hourlyRate") && UNSAVED_FIELD_CLASS)}
                        value={hourlyRate}
                        onChange={(e) => {
                          setHourlyRate(e.target.value)
                          clearFieldError("hourlyRate")
                        }}
                        placeholder="e.g. 50"
                        aria-invalid={fieldErrors.hourlyRate ? true : undefined}
                        aria-describedby={describedBy(
                          fieldErrors.hourlyRate && "hourlyRate-error",
                          unsavedFields.has("hourlyRate") && "hourlyRate-unsaved",
                        )}
                      />
                      {unsavedFields.has("hourlyRate") && <UnsavedFieldNote id="hourlyRate-unsaved" />}
                      <FieldMessage id="hourlyRate" error={fieldErrors.hourlyRate} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="businessName" className={fieldErrors.businessName ? "text-destructive" : undefined}>
                        Business name <span className="font-normal">(optional)</span>
                      </Label>
                      <Input
                        id="businessName"
                        maxLength={150}
                        className={cn("max-sm:h-11", unsavedFields.has("businessName") && UNSAVED_FIELD_CLASS)}
                        value={businessName}
                        onChange={(e) => {
                          setBusinessName(e.target.value)
                          clearFieldError("businessName")
                        }}
                        placeholder="e.g. Osei Plumbing"
                        aria-invalid={fieldErrors.businessName ? true : undefined}
                        aria-describedby={describedBy(
                          fieldErrors.businessName && "businessName-error",
                          unsavedFields.has("businessName") && "businessName-unsaved",
                        )}
                      />
                      {unsavedFields.has("businessName") && <UnsavedFieldNote id="businessName-unsaved" />}
                      <FieldMessage id="businessName" error={fieldErrors.businessName} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="max-sm:h-11 max-sm:w-full" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Save profile
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
