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
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { ApiError, apiFetch } from "@/lib/api"
import { PhoneField } from "@/components/forms/phone-field"
import { isStrongPassword, PASSWORD_MESSAGES, PHONE_IN_USE_CODE } from "@/components/auth/signup-fields"
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
        toast.error(err instanceof Error ? err.message : "Failed to delete account.")
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
  const [isSavingNotifs, setIsSavingNotifs] = useState(false)

  useEffect(() => {
    setIsLoadingNotifs(true)
    apiFetch<CustomerNotifPrefs>("/notifications/preferences")
      .then(setNotifPrefs)
      .catch(() => {})
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
      toast.error("Failed to save notification preferences.")
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

  // Phones: the tab strip scrolls; keep the active tab in view.
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
        : firstname.trim().length > NAME_MAX || lastname.trim().length > NAME_MAX
          ? `First and last name can each be at most ${NAME_MAX} characters.`
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

    setIsSaving(true)
    let accountSaved = false
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstname: firstname.trim(),
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
      toast.success("Profile updated successfully.")
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === PHONE_IN_USE_CODE) {
        setPhoneError(PHONE_MESSAGES.inUse)
        return
      }
      const reason = err instanceof Error ? err.message : "Failed to save changes."
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password.")
    } finally {
      setIsUpdatingPass(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1080px] space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Account Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your personal information, notifications, payments and security
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(tab) => changeTab(tab)}
          className="space-y-6"
        >
          <TabsList ref={tabsListRef} className="h-auto w-full justify-start overflow-x-auto bg-muted sm:w-fit">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Profile */}
          <TabsContent value="profile" className="space-y-6">
            <ProfilePhotoCard user={user} refreshUser={refreshUser} />

            <Card className="gap-0 py-0">
              <div className="border-b p-4 sm:p-6">
                <h3 className="font-semibold">Personal Information</h3>
                <p className="text-sm text-muted-foreground">
                  Update your name, contact details, and address
                </p>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      maxLength={NAME_MAX}
                      value={firstname}
                      onChange={(e) => setFirstname(e.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      maxLength={NAME_MAX}
                      value={lastname}
                      onChange={(e) => setLastname(e.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                      <Input
                        id="email"
                        className="cursor-not-allowed bg-muted/50 pl-10 pr-9 text-muted-foreground"
                        value={email}
                        readOnly
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                  </div>
                  <PhoneField
                    id="phone"
                    label="Phone Number"
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
                    <Label htmlFor="nationalId">National Identification</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      {user.nationalId && (
                        <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                      )}
                      <Input
                        id="nationalId"
                        className={user.nationalId ? "cursor-not-allowed bg-muted/50 pl-10 pr-9 text-muted-foreground" : "pl-10"}
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
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="street"
                        className="pl-10"
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
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Country"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input
                      id="zipCode"
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-6">
            {isLoadingNotifs ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Card className="gap-0 py-0">
                  <div className="border-b p-4 sm:p-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <Bell className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Notification Preferences</h3>
                        <p className="text-sm text-muted-foreground">Choose which notifications you want to receive</p>
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
                      { key: "bookingConfirmations", label: "Booking Confirmations",  desc: "Get notified when an artisan applies to your job" },
                      { key: "jobStatusUpdates",     label: "Job Status Updates",      desc: "Receive updates when your job status changes" },
                      { key: "paymentReceipts",      label: "Payment Receipts",        desc: "Receive receipts for completed payments" },
                      { key: "promotionalOffers",    label: "Promotional Offers",      desc: "Get notified about discounts and special offers" },
                      { key: "serviceReminders",     label: "Service Reminders",       desc: "Reminders for upcoming scheduled services" },
                      { key: "jobExpired",           label: "Job Expired",             desc: "Get notified when your job posting expires without being filled" },
                      { key: "messageReceived",      label: "New Messages",            desc: "Get notified when you receive a direct message" },
                    ] as { key: keyof CustomerNotifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
                      <div
                        key={key}
                        id={key === "paymentReceipts" ? "payment-receipts" : undefined}
                        className={`flex scroll-mt-24 items-center justify-between gap-4 rounded-lg border p-4 ${
                          key === "paymentReceipts" && highlight ? "border-primary/40 bg-primary/[0.04]" : ""
                        }`}
                      >
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                        <Switch
                          aria-label={label}
                          checked={notifPrefs[key] ?? true}
                          onCheckedChange={(v) => toggleNotif(key, v)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="gap-0 py-0">
                  <div className="border-b p-4 sm:p-6">
                    <h3 className="font-semibold">Notification Channels</h3>
                    <p className="text-sm text-muted-foreground">Choose how you receive notifications</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Email and SMS coverage varies by notification type — in-app notifications always
                      fire when the toggle above is on.
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
                      { key: "emailEnabled", label: "Email Notifications", desc: "Receive notifications via email" },
                      { key: "pushEnabled",  label: "Push Notifications",  desc: "Receive browser push notifications" },
                    ] as { key: keyof CustomerNotifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                        <Switch
                          checked={notifPrefs[key] ?? (key === "emailEnabled" || key === "pushEnabled")}
                          onCheckedChange={(v) => toggleNotif(key, v)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={handleSaveNotifications}
                    disabled={isSavingNotifs}
                  >
                    {isSavingNotifs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Notifications
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
                    <Shield className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Change Password</h3>
                    <p className="text-sm text-muted-foreground">Update your account password</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="max-w-md space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPass">Current Password</Label>
                    <Input
                      id="currentPass"
                      type="password"
                      placeholder="Enter current password"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPass">New Password</Label>
                    <Input
                      id="newPass"
                      type="password"
                      placeholder="Enter new password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPass">Confirm New Password</Label>
                    <Input
                      id="confirmPass"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                    />
                  </div>
                  <Button
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={handleUpdatePassword}
                    disabled={isUpdatingPass || !currentPass || !newPass || !confirmPass}
                  >
                    {isUpdatingPass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
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
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-destructive">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground">Permanent account actions</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
                  <div>
                    <p className="font-medium">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Close your account and remove your profile from JinVa. You can restore it within 30 days.
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
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
            <AlertDialogCancel disabled={isDeleting}>Keep my account</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteAccount()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Account
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
