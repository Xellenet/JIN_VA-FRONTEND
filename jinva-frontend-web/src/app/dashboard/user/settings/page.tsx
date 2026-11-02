"use client"

import { useCallback, useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  User,
  Bell,
  Shield,
  Mail,
  MapPin,
  Trash2,
  AlertTriangle,
  Loader2,
  Lock,
  CreditCard,
  Eye,
  EyeOff,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { ApiError, apiFetch } from "@/lib/api"
import { PhoneField } from "@/components/forms/phone-field"
import { isStrongPassword, PASSWORD_MESSAGES, PHONE_IN_USE_CODE } from "@/components/auth/signup-fields"
import {
  NEW_PASSWORD_INPUT_PROPS,
  PasswordChecklist,
  PasswordMatch,
  SuggestPasswordButton,
} from "@/components/auth/password-checklist"
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_MESSAGES,
  phoneUpdateFor,
  splitStoredPhone,
  type SupportedPhoneCountry,
} from "@/lib/phone"
import { loginUrlAfterAccountDeletion } from "@/lib/auth"
import { applyPushPreference } from "@/lib/push-notifications"
import { stripPreferenceMetadata } from "@/lib/notifications"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { PaymentsTab } from "@/components/settings/payments-tab"
import { ProfilePhotoCard } from "@/components/settings/profile-photo-card"
import { useLeaveGuard } from "@/components/settings/use-leave-guard"

/** Matches the backend's UpdateMeDto limits. */
const NAME_MAX = 15
const NATIONAL_ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{4,29}$/

function UserSettingsContent() {
  const { user, refreshUser, logout } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get("tab") ?? "profile"

  const [firstname, setFirstname] = useState("")
  const [middlename, setMiddlename] = useState("")
  const [lastname, setLastname] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [phoneCountry, setPhoneCountry] = useState<SupportedPhoneCountry>(DEFAULT_PHONE_COUNTRY)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [street, setStreet] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [nationalId, setNationalId] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [currentPass, setCurrentPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [showNewPass, setShowNewPass] = useState(false)
  const [isUpdatingPass, setIsUpdatingPass] = useState(false)

  // ── Delete account (F4 / C1) ────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // C1.1: the backend refuses deletion with a 409 while the account still owes
  // somebody something, and its message names every outstanding item. That has
  // to be readable *in the open dialog* — a toast would vanish before the user
  // finished reading a list of things to go and resolve.
  const [deleteRefusal, setDeleteRefusal] = useState<string | null>(null)

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteRefusal(null)
    try {
      // `purgeAt` is the server-computed restore deadline (api-contract.md) —
      // carried to the login form so the confirmation there can name the real
      // date instead of a client-side "+30 days".
      const deleted = await apiFetch<{ purgeAt?: string }>("/users/me", { method: "DELETE" })
      // C1.2/C1.3: clear this device's client state, then land the user on the
      // login form deliberately. `logout()`'s own redirect can't be relied on
      // here: its `POST /auth/logout` is 401 for a principal that no longer
      // resolves, so it never gets to clear the httpOnly session cookie, and
      // whichever redirect wins the race decides whether the user reaches the
      // login form or bounces off middleware into the dashboard. The markers
      // (see lib/auth.ts) are what keep the restore path reachable while that
      // cookie is still signed and unexpired, AND what put the "you have until
      // <date> to restore it" confirmation on the page they land on. It is not
      // a toast: this navigation tears the toast container down long before
      // one could be read (qa-report.md FE-1).
      await logout()
      globalThis.location.href = loginUrlAfterAccountDeletion(deleted?.purgeAt)
    } catch (err: unknown) {
      // Branch on the code, not the message text (api-contract.md). The
      // account is untouched and the user is still logged in, so the dialog
      // stays open with the confirm button live for a retry once they've
      // resolved what it names.
      if (err instanceof ApiError && err.status === 409) {
        setDeleteRefusal(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : "Couldn't delete your account. Try again.")
      }
      setIsDeleting(false)
    }
  }

  // ── Notification preferences ────────────────────────────────────────────
  interface CustomerNotifPrefs {
    bookingConfirmations: boolean; jobStatusUpdates: boolean; paymentReceipts: boolean
    promotionalOffers: boolean; serviceReminders: boolean; reviewRequests: boolean
    jobExpired: boolean; messageReceived: boolean
    emailEnabled: boolean; smsEnabled: boolean; pushEnabled: boolean
  }
  const [notifPrefs, setNotifPrefs] = useState<Partial<CustomerNotifPrefs>>({})
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false)
  // Saving defaults over preferences we never read would silently change them, so a failed load hides the form.
  const [notifsLoadFailed, setNotifsLoadFailed] = useState(false)
  const [isSavingNotifs, setIsSavingNotifs] = useState(false)

  useEffect(() => {
    setIsLoadingNotifs(true)
    apiFetch<CustomerNotifPrefs>("/notifications/preferences")
      .then(setNotifPrefs)
      .catch(() => setNotifsLoadFailed(true))
      .finally(() => setIsLoadingNotifs(false))
  }, [])

  const toggleNotif = (key: keyof CustomerNotifPrefs, val: boolean) => {
    setNotifPrefs((p) => ({ ...p, [key]: val }))
    // PN1: the push channel toggle is where browser permission is requested and
    // this device's FCM token is registered/unregistered.
    if (key === "pushEnabled") applyPushPreference(val)
  }

  const handleSaveNotifications = async () => {
    setIsSavingNotifs(true)
    try {
      await apiFetch("/notifications/preferences", {
        method: "PATCH",
        // stripPreferenceMetadata drops the row `id` the GET response carries —
        // PATCH validates against a whitelist DTO and 400s the entire save if
        // an undeclared property is present. See its doc comment.
        body: JSON.stringify(stripPreferenceMetadata(notifPrefs)),
      })
      toast.success("Notification preferences saved.")
    } catch {
      toast.error("Couldn't save your notification preferences. Try again.")
    } finally {
      setIsSavingNotifs(false)
    }
  }

  // ── Payments tab: unsaved-changes guard (FR-5.10) ─────────────────────
  const [paymentsDirty, setPaymentsDirty] = useState(false)
  const { confirmLeave, dialog: leaveDialog } = useLeaveGuard(paymentsDirty)
  const changeTab = useCallback(
    (tab: string, extra?: Record<string, string>) => {
      const params = new URLSearchParams({ tab, ...extra })
      confirmLeave(() => router.replace(`?${params.toString()}`, { scroll: false }))
    },
    [confirmLeave, router],
  )

  // "Receipt email settings" lands on the Notifications tab with the
  // "Payment receipts" switch in view (BR-5.10). Only this one target exists.
  const highlight = searchParams.get("highlight") === "payment-receipts" ? "payment-receipts" : null
  useEffect(() => {
    if (activeTab !== "notifications" || !highlight || isLoadingNotifs) return
    const row = document.getElementById(highlight)
    if (!row) return
    row.scrollIntoView({ block: "center", behavior: "smooth" })
    row.querySelector<HTMLElement>("button[role=switch]")?.focus({ preventScroll: true })
  }, [activeTab, highlight, isLoadingNotifs])

  // Keep the active tab in view.
  const tabsListRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    tabsListRef.current
      ?.querySelector<HTMLElement>("[data-state=active]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeTab])

  useEffect(() => {
    if (!user) return
    const parts = user.name.split(" ")
    setFirstname(user.firstname ?? parts[0] ?? "")
    setMiddlename(user.middlename ?? "")
    setLastname(user.lastname ?? parts.slice(1).join(" "))
    setEmail(user.email ?? "")
    const storedPhone = splitStoredPhone(user.phone)
    setPhone(storedPhone.national)
    setPhoneCountry(storedPhone.country)
    setPhoneError(null)
    setStreet(user.address?.street ?? "")
    setCity(user.address?.city ?? "")
    setCountry(user.address?.country ?? "")
    setZipCode(user.address?.zipCode ?? "")
    setNationalId(user.nationalId ?? "")
  }, [user])

  if (!user) return null

  const handleSaveProfile = async () => {
    const phoneUpdate = phoneUpdateFor(user.phone, phone, phoneCountry)
    if (phoneUpdate.error) {
      setPhoneError(phoneUpdate.error)
      document.getElementById("phone")?.focus()
      return
    }
    // QA CUS-02/03/07: PATCH /users/me takes only the account fields; the
    // address has its own endpoints. Sending `addresses` there was rejected,
    // so nothing on this card could ever be saved.
    const nameError = !firstname.trim()
      ? "Enter your first name."
      : !lastname.trim()
        ? "Enter your last name."
        : firstname.trim().length > NAME_MAX || middlename.trim().length > NAME_MAX || lastname.trim().length > NAME_MAX
          ? `First, middle and last name can each be at most ${NAME_MAX} characters.`
          : null
    if (nameError) {
      toast.error(nameError)
      return
    }
    const addressFields = { street: street.trim(), city: city.trim(), country: country.trim(), zipCode: zipCode.trim() }
    const saved = user.address
    const addressChanged =
      addressFields.street !== (saved?.street ?? "") ||
      addressFields.city !== (saved?.city ?? "") ||
      addressFields.country !== (saved?.country ?? "") ||
      addressFields.zipCode !== (saved?.zipCode ?? "")
    if (addressChanged && Object.values(addressFields).some((v) => v === "")) {
      toast.error("Fill in street, city, country and zip code to save your address.")
      return
    }
    const newNationalId = !user.nationalId && nationalId.trim() ? nationalId.trim().toUpperCase() : undefined
    if (newNationalId && !NATIONAL_ID_PATTERN.test(newNationalId)) {
      toast.error("Enter your national ID as letters, numbers and dashes, like GHA-123456789-0.")
      document.getElementById("nationalId")?.focus()
      return
    }

    // Only sent when edited, so "" (clear) is never sent by accident.
    const middlenameChanged = middlename.trim() !== (user.middlename ?? "")

    setIsSaving(true)
    let accountSaved = false
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstname: firstname.trim(),
          ...(middlenameChanged ? { middlename: middlename.trim() } : {}),
          lastname: lastname.trim(),
          // PH11: E.164, and only when edited (see phoneUpdateFor).
          ...(phoneUpdate.phoneNumber ? { phoneNumber: phoneUpdate.phoneNumber } : {}),
          ...(newNationalId ? { nationalId: newNationalId } : {}),
        }),
      })
      accountSaved = true
      if (addressChanged) {
        await apiFetch(saved?.id ? `/users/me/addresses/${saved.id}` : "/users/me/addresses", {
          method: saved?.id ? "PATCH" : "POST",
          body: JSON.stringify(addressFields),
        })
      }
      await refreshUser()
      toast.success("Profile saved.")
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === PHONE_IN_USE_CODE) {
        setPhoneError(PHONE_MESSAGES.inUse)
        return
      }
      const reason = err instanceof Error ? err.message : "Couldn't save your changes."
      if (accountSaved) {
        await refreshUser()
        toast.error(`Your details were saved, but your address wasn't: ${reason}`)
      } else {
        toast.error(reason)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (newPass !== confirmPass) {
      toast.error("New passwords do not match.")
      return
    }
    if (!isStrongPassword(newPass)) {
      toast.error(PASSWORD_MESSAGES.rule)
      return
    }
    setIsUpdatingPass(true)
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        // FE-1: `confirmNewPassword` is required by the endpoint's DTO
        // (`ChangePasswordDto extends ResetPasswordDto`), which re-checks the
        // match server-side. Omitting it made every attempt 400 with the
        // validation array joined into a toast that blamed the password's
        // strength, and the password never changed. The form already collects
        // the value for the client-side check above — it just has to be sent.
        body: JSON.stringify({
          currentPassword: currentPass,
          newPassword: newPass,
          confirmNewPassword: confirmPass,
        }),
      })
      toast.success("Password updated.")
      setCurrentPass("")
      setNewPass("")
      setConfirmPass("")
      setShowNewPass(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your password. Try again.")
    } finally {
      setIsUpdatingPass(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1080px] space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your details, notifications, payments and security
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(tab) => changeTab(tab)}
          className="space-y-6"
        >
          {/* A 2×2 grid on phones (as on the artisan Settings), so Security is never clipped off-screen. */}
          <TabsList ref={tabsListRef} className="grid h-auto w-full grid-cols-2 gap-1 bg-muted sm:inline-flex sm:w-fit sm:gap-0">
            <TabsTrigger value="profile" className="min-h-11 gap-2 sm:min-h-0">
              <User className="h-4 w-4" aria-hidden="true" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="min-h-11 gap-2 sm:min-h-0">
              <Bell className="h-4 w-4" aria-hidden="true" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="payments" className="min-h-11 gap-2 sm:min-h-0">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="security" className="min-h-11 gap-2 sm:min-h-0">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Profile */}
          <TabsContent value="profile" className="space-y-6">
            <ProfilePhotoCard user={user} refreshUser={refreshUser} />

            <Card className="gap-0 py-0">
              <div className="border-b p-4 sm:p-6">
                <h3 className="font-semibold">Your details</h3>
                <p className="text-sm text-muted-foreground">
                  Update your name, contact details and address
                </p>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      className="max-sm:h-11"
                      maxLength={NAME_MAX}
                      value={firstname}
                      onChange={(e) => setFirstname(e.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleName">
                      Middle name <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="middleName"
                      className="max-sm:h-11"
                      autoComplete="additional-name"
                      maxLength={NAME_MAX}
                      value={middlename}
                      onChange={(e) => setMiddlename(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      className="max-sm:h-11"
                      maxLength={NAME_MAX}
                      value={lastname}
                      onChange={(e) => setLastname(e.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Lock aria-hidden="true" className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                      <Input
                        id="email"
                        className="cursor-not-allowed bg-muted/50 pl-10 pr-9 text-muted-foreground max-sm:h-11"
                        value={email}
                        readOnly
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                  </div>
                  <PhoneField
                    id="phone"
                    label="Phone number"
                    className="max-sm:[&_button]:min-h-11 max-sm:[&_input]:h-11"
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
                  />
                  <div className="space-y-2">
                    <Label htmlFor="nationalId">National ID</Label>
                    <div className="relative">
                      <CreditCard aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      {user.nationalId && (
                        <Lock aria-hidden="true" className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                      )}
                      <Input
                        id="nationalId"
                        className={user.nationalId ? "cursor-not-allowed bg-muted/50 pl-10 pr-9 text-muted-foreground max-sm:h-11" : "pl-10 max-sm:h-11"}
                        value={nationalId}
                        onChange={user.nationalId ? undefined : (e) => setNationalId(e.target.value)}
                        readOnly={!!user.nationalId}
                        placeholder="e.g. GHA-123456789-0"
                        maxLength={30}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {user.nationalId
                        ? "National ID cannot be changed once set."
                        : "This can only be set once and cannot be changed afterwards."}
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="street">Street</Label>
                    <div className="relative">
                      <MapPin aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="street"
                        className="pl-10 max-sm:h-11"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="Street address"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      className="max-sm:h-11"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      className="max-sm:h-11"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Country"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Zip code</Label>
                    <Input
                      id="zipCode"
                      className="max-sm:h-11"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="Zip / Postal code"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                className="max-sm:h-11 max-sm:w-full"
                onClick={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Save changes
              </Button>
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-6">
            {isLoadingNotifs ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Loading" />
              </div>
            ) : notifsLoadFailed ? (
              <Card className="gap-0 py-0">
                <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-foreground">Couldn&apos;t load your notification preferences</p>
                  <p className="mt-1 text-sm text-muted-foreground">Refresh the page to try again.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="gap-0 py-0">
                  <div className="border-b p-4 sm:p-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <Bell className="h-5 w-5 text-foreground" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-semibold">What we tell you about</h3>
                        <p className="text-sm text-muted-foreground">Choose which updates you receive</p>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-4 sm:p-6">
                    {/*
                      PR2: the "Review Requests" row is deliberately absent, not disabled. No
                      backend trigger sends a post-completion review prompt, so the toggle
                      controlled nothing. `reviewRequests` stays on the interface and in the save
                      payload so the stored value round-trips untouched; restore the row here once
                      a real review-nudge trigger exists.
                    */}
                    {([
                      { key: "bookingConfirmations", label: "Applications",              desc: "When an artisan applies to a job you posted" },
                      { key: "jobStatusUpdates",     label: "Job updates",               desc: "When one of your jobs changes stage" },
                      { key: "paymentReceipts",      label: "Payment receipts",          desc: "A receipt for each completed payment" },
                      { key: "promotionalOffers",    label: "Offers",                    desc: "Discounts and special offers from JinVa" },
                      { key: "serviceReminders",     label: "Service reminders",         desc: "Reminders before a booked visit" },
                      { key: "jobExpired",           label: "Expired jobs",              desc: "When a job you posted expires without an artisan" },
                      { key: "messageReceived",      label: "New messages",              desc: "When an artisan sends you a message" },
                    ] as { key: keyof CustomerNotifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
                      <Label
                        key={key}
                        htmlFor={`notif-switch-${key}`}
                        id={key === "paymentReceipts" ? "payment-receipts" : undefined}
                        className={cn(
                          "flex min-h-11 scroll-mt-24 cursor-pointer items-center justify-between gap-4 rounded-lg border p-4 text-base leading-normal font-normal transition-colors hover:bg-muted/50 motion-reduce:transition-none",
                          key === "paymentReceipts" && highlight && "border-primary/40 bg-primary/[0.04]",
                        )}
                      >
                        <span className="min-w-0">
                          <span id={`notif-${key}`} className="block font-medium">{label}</span>
                          <span id={`notif-${key}-desc`} className="block text-sm text-muted-foreground">{desc}</span>
                        </span>
                        <Switch
                          id={`notif-switch-${key}`}
                          aria-labelledby={`notif-${key}`}
                          aria-describedby={`notif-${key}-desc`}
                          checked={notifPrefs[key] ?? true}
                          onCheckedChange={(v) => toggleNotif(key, v)}
                        />
                      </Label>
                    ))}
                  </CardContent>
                </Card>

                <Card className="gap-0 py-0">
                  <div className="border-b p-4 sm:p-6">
                    <h3 className="font-semibold">How we reach you</h3>
                    <p className="text-sm text-muted-foreground">
                      In-app notifications always arrive when an update is on. Not every update is sent by email.
                    </p>
                  </div>
                  <CardContent className="space-y-4 p-4 sm:p-6">
                    {/*
                      PR2: the SMS row is deliberately absent, not disabled. There is no SMS
                      delivery capability anywhere in the platform and SMS is not a PRD-required
                      channel, so showing the toggle implied a working feature that silently did
                      nothing. `smsEnabled` stays on the interface and in the save payload so the
                      stored value round-trips untouched; restore the row here if real SMS
                      delivery is ever built.
                    */}
                    {([
                      { key: "emailEnabled", label: "Email", desc: "Send updates to your email address" },
                      { key: "pushEnabled",  label: "Push notifications", desc: "Show updates as browser notifications on this device" },
                    ] as { key: keyof CustomerNotifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
                      <Label
                        key={key}
                        htmlFor={`notif-switch-${key}`}
                        className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border p-4 text-base leading-normal font-normal transition-colors hover:bg-muted/50 motion-reduce:transition-none"
                      >
                        <span className="min-w-0">
                          <span id={`notif-${key}`} className="block font-medium">{label}</span>
                          <span id={`notif-${key}-desc`} className="block text-sm text-muted-foreground">{desc}</span>
                        </span>
                        <Switch
                          id={`notif-switch-${key}`}
                          aria-labelledby={`notif-${key}`}
                          aria-describedby={`notif-${key}-desc`}
                          checked={notifPrefs[key] ?? (key === "emailEnabled" || key === "pushEnabled")}
                          onCheckedChange={(v) => toggleNotif(key, v)}
                        />
                      </Label>
                    ))}
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    className="max-sm:h-11 max-sm:w-full"
                    onClick={handleSaveNotifications}
                    disabled={isSavingNotifs}
                  >
                    {isSavingNotifs && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    Save notifications
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Payments (item 5): preferences, receipts and protection. The
              history moved to Spending (/dashboard/user/report). */}
          <TabsContent value="payments">
            <PaymentsTab
              accountEmail={user.email}
              onDirtyChange={setPaymentsDirty}
              onReceiptSettings={() => changeTab("notifications", { highlight: "payment-receipts" })}
            />
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-6">
            <Card className="gap-0 py-0">
              <div className="border-b p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Shield className="h-5 w-5 text-foreground" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Change password</h3>
                    <p className="text-sm text-muted-foreground">Update your account password</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="max-w-md space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPass">Current password</Label>
                    <Input
                      id="currentPass"
                      className="max-sm:h-11"
                      type="password"
                      autoComplete="current-password"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="newPass">New password</Label>
                      <div className="relative">
                        <Input
                          id="newPass"
                          {...NEW_PASSWORD_INPUT_PROPS}
                          className="pr-11 max-sm:h-11"
                          type={showNewPass ? "text" : "password"}
                          autoComplete="new-password"
                          aria-describedby="newPass-rules"
                          value={newPass}
                          onChange={(e) => setNewPass(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass((v) => !v)}
                          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showNewPass ? "Hide new password" : "Show new password"}
                          aria-pressed={showNewPass}
                        >
                          {showNewPass ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                    <PasswordChecklist id="newPass-rules" password={newPass} />
                    <SuggestPasswordButton
                      disabled={isUpdatingPass}
                      onSuggest={(suggested) => {
                        setNewPass(suggested)
                        setConfirmPass(suggested)
                        setShowNewPass(true)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPass">Confirm new password</Label>
                    <Input
                      id="confirmPass"
                      {...NEW_PASSWORD_INPUT_PROPS}
                      className="max-sm:h-11"
                      type={showNewPass ? "text" : "password"}
                      autoComplete="new-password"
                      aria-describedby="confirmPass-match"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                    />
                    <PasswordMatch id="confirmPass-match" password={newPass} confirmation={confirmPass} />
                  </div>
                  <Button
                    className="max-sm:h-11 max-sm:w-full"
                    onClick={handleUpdatePassword}
                    disabled={isUpdatingPass || !currentPass || !newPass || !confirmPass}
                  >
                    {isUpdatingPass && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    Update password
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* C6: no two-factor switch until two-factor sign-in exists — the old
                one saved nothing. */}
            <Card className="gap-0 border-destructive/30 py-0">
              <div className="border-b border-destructive/30 p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-destructive/10 p-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-destructive">Delete account</h3>
                    <p className="text-sm text-muted-foreground">This closes your account for everyone</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col gap-4 rounded-lg border border-destructive/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Close your account and remove your profile from JinVa. You can restore it within 30 days.
                  </p>
                  <Button
                    variant="destructive"
                    className="shrink-0 max-sm:h-11 max-sm:w-full"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (isDeleting) return
          if (!open) setDeleteRefusal(null)
          setShowDeleteDialog(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be signed out straight away and your profile will no longer be visible on JinVa. You
              have <span className="font-medium text-foreground">30 days</span> to change your mind — sign in
              again before then and we&apos;ll restore your account and your booking history. After 30 days
              everything is permanently deleted and can&apos;t be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* C1.1: the refusal, rendered inline in the still-open dialog. */}
          {deleteRefusal && (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
              <p>{deleteRefusal}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="max-sm:h-11" disabled={isDeleting}>Keep my account</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteAccount()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 max-sm:h-11"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {leaveDialog}
    </DashboardLayout>
  )
}

export default function UserSettingsPage() {
  return (
    <Suspense>
      <UserSettingsContent />
    </Suspense>
  )
}
