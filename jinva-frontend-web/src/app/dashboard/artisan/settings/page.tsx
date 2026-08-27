"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  User,
  Bell,
  Shield,
  Briefcase,
  Camera,
  Mail,
  Phone,
  MapPin,
  Trash2,
  AlertTriangle,
  Clock,
  UserRound,
  Loader2,
  CreditCard,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"
import { applyPushPreference } from "@/lib/push-notifications"
import { stripPreferenceMetadata } from "@/lib/notifications"
import { toast } from "sonner"
import { RETRYABLE_PAYOUT_STATUSES } from "@/lib/status-badges"

function ArtisanSettingsContent() {
  const { user, refreshUser, logout } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get("tab") ?? "account"

  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  // F7: Service Area (`location`) and Service Radius (`serviceRadiusKm`) are
  // real, savable ArtisanProfile fields — wired up as controlled state below
  // and included in the profile save payload.
  const [serviceArea, setServiceArea] = useState("")
  const [serviceRadiusKm, setServiceRadiusKm] = useState("")
  // F6: cancellation policy is a real, savable ArtisanProfile field.
  const [cancellationPolicy, setCancellationPolicy] = useState("")

  useEffect(() => {
    if (!user) return
    const parts = user.name.split(" ")
    setFirstname(parts[0] ?? "")
    setLastname(parts.slice(1).join(" "))
    setEmail(user.email ?? "")
    setPhone(user.phone ?? "")
  }, [user])

  useEffect(() => {
    apiFetch<{
      location?: string
      serviceRadiusKm?: number
      cancellationPolicy?: string
      payoutType?: "mobile_money" | "bank"
      payoutAccountName?: string
      payoutAccountNumber?: string // masked to last 4 chars server-side — never the full number
      payoutBankCode?: string
    }>("/users/me/artisan-profile")
      .then((profile) => {
        setServiceArea(profile.location ?? "")
        setServiceRadiusKm(profile.serviceRadiusKm != null ? String(profile.serviceRadiusKm) : "")
        setCancellationPolicy(profile.cancellationPolicy ?? "")
        // A1: read back the artisan's actual saved payout status instead of
        // defaulting to unconfigured — this is the real, demonstrated bug
        // requirements.md calls out (a page refresh made a correctly
        // configured artisan look unconfigured).
        if (profile.payoutType) {
          setHasPayoutMethod(true)
          setPayoutType(profile.payoutType)
          setSavedPayoutAccountName(profile.payoutAccountName ?? "")
          setSavedMaskedAccountNumber(profile.payoutAccountNumber ?? "")
          setSavedPayoutBankCode(profile.payoutBankCode ?? "")
        }
      })
      .catch(() => {})
  }, [])

  // A3/3.3: has any of this artisan's payments ever gotten stuck on a
  // transfer to the currently-saved payout method? Drives the "Last
  // transfer failed" summary-card language — links to Earnings (A3) rather
  // than duplicating the retry action here.
  const [hasStuckTransfer, setHasStuckTransfer] = useState(false)
  useEffect(() => {
    apiFetch<{ status: string }[]>("/payments/my-earnings")
      .then((rows) => setHasStuckTransfer(rows.some((r) => (RETRYABLE_PAYOUT_STATUSES as readonly string[]).includes(r.status))))
      .catch(() => {})
  }, [])

  const [isSaving, setIsSaving] = useState(false)

  // ── Delete account (F4) ─────────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      await apiFetch("/users/me", { method: "DELETE" })
      toast.success("Your account has been deleted.")
      await logout()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account.")
      setIsDeleting(false)
    }
  }

  // ── Payout method (F5) ──────────────────────────────────────────────────
  type PayoutType = "mobile_money" | "bank"
  const [payoutType, setPayoutType] = useState<PayoutType>("mobile_money")
  const [payoutAccountName, setPayoutAccountName] = useState("")
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("")
  const [payoutBankCode, setPayoutBankCode] = useState("")
  const [isSavingPayout, setIsSavingPayout] = useState(false)
  const [hasPayoutMethod, setHasPayoutMethod] = useState(false)
  // What's actually on file, per the server (A1) — distinct from the form's
  // own draft state above, which is only ever populated when the artisan is
  // actively (re)filling the form to overwrite it.
  const [savedPayoutAccountName, setSavedPayoutAccountName] = useState("")
  const [savedMaskedAccountNumber, setSavedMaskedAccountNumber] = useState("")
  const [savedPayoutBankCode, setSavedPayoutBankCode] = useState("")

  // QA LOW (2026-08-20): "Edit" used to just flip hasPayoutMethod, leaving
  // Account Name/Network-Bank-Code blank even though the real values are
  // already known (displayed one line above). Pre-fills the draft fields
  // from what's actually on file before showing the form. The masked
  // account number is still deliberately left blank — the backend never
  // returns the full number, so there's nothing real to pre-fill there.
  const handleEditPayoutMethod = () => {
    setPayoutAccountName(savedPayoutAccountName)
    setPayoutBankCode(savedPayoutBankCode)
    setPayoutAccountNumber("")
    setHasPayoutMethod(false)
  }

  const handleSavePayoutMethod = async () => {
    if (!payoutAccountName.trim() || payoutAccountName.trim().length < 2) {
      toast.error("Enter the full name on the account.")
      return
    }
    if (!payoutAccountNumber.trim() || payoutAccountNumber.trim().length < 8) {
      toast.error(
        payoutType === "mobile_money"
          ? "Enter a valid mobile money number (e.g. 0241234567)."
          : "Enter a valid bank account number.",
      )
      return
    }
    if (!payoutBankCode.trim()) {
      toast.error(payoutType === "mobile_money" ? "Select a mobile money network." : "Enter the bank code.")
      return
    }

    setIsSavingPayout(true)
    try {
      await apiFetch("/payments/payout-method", {
        method: "POST",
        body: JSON.stringify({
          type: payoutType,
          accountName: payoutAccountName.trim(),
          accountNumber: payoutAccountNumber.trim(),
          bankCode: payoutBankCode.trim(),
        }),
      })
      setHasPayoutMethod(true)
      setSavedPayoutAccountName(payoutAccountName.trim())
      setSavedMaskedAccountNumber(`••••${payoutAccountNumber.trim().slice(-4)}`)
      setSavedPayoutBankCode(payoutBankCode.trim())
      toast.success("Payout method saved.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save payout method.")
    } finally {
      setIsSavingPayout(false)
    }
  }

  // ── Notification preferences ────────────────────────────────────────────
  interface ArtisanNotifPrefs {
    newJobOpportunities: boolean; applicationUpdates: boolean; artisanJobUpdates: boolean
    paymentReleased: boolean; reviewsAndRatings: boolean; artisanPromotions: boolean
    applicationRejected: boolean; appliedJobExpired: boolean; profileVerified: boolean
    messageReceived: boolean; portfolioApproved: boolean; portfolioRejected: boolean
    // A7: 24h/2h pre-appointment reminders for confirmed bookings.
    bookingReminders: boolean
    // PR1: the backend's ArtisanNotificationPreferencesResponseDto has always
    // returned these four, but this interface omitted them — so they were
    // dropped on fetch and never sent back on save, leaving an artisan unable
    // to turn off "someone booked me", "a booking was cancelled", "a booking
    // was completed" or "my verification was rejected". Frontend-only fix; the
    // backend contract is unchanged.
    verificationRejected: boolean; bookingReceived: boolean
    bookingCancelled: boolean; bookingCompletedArtisan: boolean
    emailEnabled: boolean; smsEnabled: boolean; pushEnabled: boolean
  }
  const [notifPrefs, setNotifPrefs] = useState<Partial<ArtisanNotifPrefs>>({})
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false)
  const [isSavingNotifs, setIsSavingNotifs] = useState(false)

  useEffect(() => {
    setIsLoadingNotifs(true)
    apiFetch<ArtisanNotifPrefs>("/notifications/preferences")
      .then(setNotifPrefs)
      .catch(() => {})
      .finally(() => setIsLoadingNotifs(false))
  }, [])

  const toggleNotif = (key: keyof ArtisanNotifPrefs, val: boolean) => {
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

  const [currentPass, setCurrentPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [isUpdatingPass, setIsUpdatingPass] = useState(false)

  if (!user) return null

  const handleSaveProfile = async () => {
    const radiusValue = serviceRadiusKm.trim() === "" ? undefined : Number(serviceRadiusKm)
    if (radiusValue !== undefined && (!Number.isFinite(radiusValue) || radiusValue <= 0)) {
      toast.error("Service radius must be a positive number of kilometers.")
      return
    }

    setIsSaving(true)
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ firstname, lastname, email, phoneNumber: phone }),
      })
      // F6/F7: Service Area, Service Radius, and Cancellation Policy live on
      // the artisan profile, not the base user record.
      await apiFetch("/users/me/artisan-profile", {
        method: "PATCH",
        body: JSON.stringify({
          location: serviceArea || undefined,
          ...(radiusValue !== undefined ? { serviceRadiusKm: radiusValue } : {}),
          cancellationPolicy: cancellationPolicy || undefined,
        }),
      })
      await refreshUser()
      toast.success("Profile updated successfully.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (newPass !== confirmPass) {
      toast.error("New passwords do not match.")
      return
    }
    if (newPass.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }
    setIsUpdatingPass(true)
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
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
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Settings</p>
          <h1 className="mt-0.5 text-2xl font-bold text-foreground">Account Preferences</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account, notifications, availability, and security preferences
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(tab) => router.replace(`?tab=${tab}`, { scroll: false })}
          className="space-y-6"
        >
          <TabsList className="bg-muted">
            <TabsTrigger value="account" className="gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="availability" className="gap-2">
              <Clock className="h-4 w-4" />
              Availability
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Account */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <div className="border-b p-6">
                <h3 className="font-semibold">Profile Photo</h3>
                <p className="text-sm text-muted-foreground">
                  Your photo is visible to clients on your profile
                </p>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback><UserRound className="h-6 w-6" /></AvatarFallback>
                    </Avatar>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute bottom-0 right-0 h-8 w-8 rounded-full border-2 border-background"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.specialization ?? "Artisan"}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        Upload New Photo
                      </Button>
                      <Button size="sm" variant="outline">
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <div className="border-b p-6">
                <h3 className="font-semibold">Personal Information</h3>
                <p className="text-sm text-muted-foreground">
                  Update your name and contact details
                </p>
              </div>
              <CardContent className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstname">First Name</Label>
                    <Input id="firstname" value={firstname} onChange={(e) => setFirstname(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastname">Last Name</Label>
                    <Input id="lastname" value={lastname} onChange={(e) => setLastname(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="phone" className="pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Service Area</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="address"
                        className="pl-10"
                        placeholder="Enter your primary service area"
                        value={serviceArea}
                        onChange={(e) => setServiceArea(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
                    <Textarea
                      id="cancellationPolicy"
                      placeholder="e.g. Free cancellation up to 24 hours before the scheduled job; 50% fee thereafter."
                      value={cancellationPolicy}
                      onChange={(e) => setCancellationPolicy(e.target.value)}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Shown on your public profile so customers know your policy before booking.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <div className="border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Wallet className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Payout Method</h3>
                    <p className="text-sm text-muted-foreground">
                      Where you get paid for completed jobs
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                {hasPayoutMethod ? (
                  <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {payoutType === "mobile_money" ? "Mobile Money" : "Bank Account"} — {savedMaskedAccountNumber}
                        </p>
                        <p className="text-sm text-muted-foreground">{savedPayoutAccountName}</p>
                        {/* 3.3: "Working" (default) vs "Last transfer failed" once a
                            payment on this artisan's account has actually been
                            blocked — links to Earnings instead of duplicating the
                            retry action here. */}
                        {hasStuckTransfer ? (
                          <Badge variant="outline" className="mt-1.5 border-destructive/20 bg-destructive/10 text-destructive">
                            Last transfer failed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-1.5 border-success/20 bg-success/10 text-success">
                            Working
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {hasStuckTransfer && (
                        <Button size="sm" variant="outline" className="bg-transparent" asChild>
                          <Link href="/dashboard/artisan/earnings">View Earnings</Link>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={handleEditPayoutMethod}>
                        Edit
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-md space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="payoutType">Payout Type</Label>
                      <Select value={payoutType} onValueChange={(v) => setPayoutType(v as PayoutType)}>
                        <SelectTrigger id="payoutType" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mobile_money">Mobile Money</SelectItem>
                          <SelectItem value="bank">Bank Account</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payoutAccountName">Account Name</Label>
                      <Input
                        id="payoutAccountName"
                        placeholder="Full name on the account"
                        value={payoutAccountName}
                        onChange={(e) => setPayoutAccountName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payoutAccountNumber">
                        {payoutType === "mobile_money" ? "Mobile Money Number" : "Account Number"}
                      </Label>
                      <Input
                        id="payoutAccountNumber"
                        placeholder={payoutType === "mobile_money" ? "0241234567" : "Account number"}
                        value={payoutAccountNumber}
                        onChange={(e) => setPayoutAccountNumber(e.target.value.replace(/\s+/g, ""))}
                      />
                    </div>
                    <div className="space-y-2">
                      {payoutType === "mobile_money" ? (
                        <>
                          <Label htmlFor="payoutBankCode">Network</Label>
                          <Select value={payoutBankCode} onValueChange={setPayoutBankCode}>
                            <SelectTrigger id="payoutBankCode" className="w-full">
                              <SelectValue placeholder="Select network" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                              <SelectItem value="VOD">Vodafone Cash</SelectItem>
                              <SelectItem value="ATL">AirtelTigo Money</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      ) : (
                        <>
                          <Label htmlFor="payoutBankCode">Bank Code</Label>
                          <Input
                            id="payoutBankCode"
                            placeholder="e.g. 030 for GCB"
                            value={payoutBankCode}
                            onChange={(e) => setPayoutBankCode(e.target.value)}
                          />
                        </>
                      )}
                    </div>
                    <Button
                      onClick={handleSavePayoutMethod}
                      disabled={isSavingPayout}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {isSavingPayout && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Payout Method
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <div className="border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Briefcase className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Job Preferences</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure how you receive and handle job requests
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                {[
                  { label: "Auto-Accept Matching Jobs", desc: "Automatically accept jobs matching your specialization" },
                  { label: "Show Phone Number to Clients", desc: "Allow clients to see your phone number on your profile", defaultOn: true },
                  { label: "Accept Emergency Jobs", desc: "Receive high-priority emergency repair requests", defaultOn: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.defaultOn} />
                  </div>
                ))}
                <div className="grid gap-6 md:grid-cols-2 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="maxJobs">Max Concurrent Jobs</Label>
                    <Input id="maxJobs" type="number" defaultValue="3" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="radius">Service Radius (kilometers)</Label>
                    <Input
                      id="radius"
                      type="number"
                      min={1}
                      placeholder="e.g. 25"
                      value={serviceRadiusKm}
                      onChange={(e) => setServiceRadiusKm(e.target.value)}
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

          {/* Availability */}
          <TabsContent value="availability" className="space-y-6">
            <Card>
              <div className="border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Clock className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Availability Schedule</h3>
                    <p className="text-sm text-muted-foreground">Set your regular working hours</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                {[
                  { day: "Monday",    from: "08:00", to: "17:00", on: true },
                  { day: "Tuesday",   from: "08:00", to: "17:00", on: true },
                  { day: "Wednesday", from: "08:00", to: "17:00", on: true },
                  { day: "Thursday",  from: "08:00", to: "17:00", on: true },
                  { day: "Friday",    from: "08:00", to: "17:00", on: true },
                  { day: "Saturday",  from: "09:00", to: "14:00", on: true },
                  { day: "Sunday",    from: "00:00", to: "00:00", on: false },
                ].map((schedule) => (
                  <div key={schedule.day} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-4">
                      <Switch defaultChecked={schedule.on} />
                      <span className="w-24 font-medium">{schedule.day}</span>
                    </div>
                    {schedule.on ? (
                      <div className="flex items-center gap-3">
                        <Input type="time" defaultValue={schedule.from} className="w-32" />
                        <span className="text-muted-foreground">to</span>
                        <Input type="time" defaultValue={schedule.to} className="w-32" />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Day off</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <div className="border-b p-6">
                <h3 className="font-semibold">Quick Status</h3>
                <p className="text-sm text-muted-foreground">Override your schedule with a quick availability toggle</p>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Current Status</p>
                    <p className="text-sm text-muted-foreground">Set yourself as available or busy</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10">
                      Available
                    </Button>
                    <Button variant="outline" className="bg-transparent">Busy</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Vacation Mode</p>
                    <p className="text-sm text-muted-foreground">Temporarily pause all job assignments</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Save Schedule</Button>
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
                <Card>
                  <div className="border-b p-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <Bell className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Notification Preferences</h3>
                        <p className="text-sm text-muted-foreground">Choose which alerts you want to receive</p>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    {([
                      { key: "newJobOpportunities", label: "New Job Opportunities", desc: "Get notified about new job postings matching your services" },
                      { key: "applicationUpdates",  label: "Application Updates",   desc: "Get notified when your application is accepted" },
                      { key: "applicationRejected", label: "Application Rejected",  desc: "Get notified when your application is not selected" },
                      { key: "artisanJobUpdates",   label: "Job Updates",           desc: "Get notified about job cancellations and status changes" },
                      { key: "paymentReleased",     label: "Payment Released",      desc: "Get notified when payment is released after job completion" },
                      { key: "reviewsAndRatings",   label: "Reviews & Ratings",     desc: "Get notified when you receive a new review or rating" },
                      { key: "artisanPromotions",   label: "Platform Promotions",   desc: "Get notified about promotions targeted at artisans" },
                      { key: "appliedJobExpired",   label: "Applied Job Expired",   desc: "Get notified when a job you applied to has expired" },
                      { key: "profileVerified",     label: "Profile Verified",      desc: "Get notified when your profile is verified by admin" },
                      { key: "verificationRejected", label: "Verification Rejected", desc: "Get notified if your profile verification is rejected" },
                      { key: "messageReceived",     label: "New Messages",          desc: "Get notified when you receive a direct message" },
                      { key: "portfolioApproved",   label: "Portfolio Approved",    desc: "Get notified when an admin approves a portfolio item you uploaded" },
                      { key: "portfolioRejected",   label: "Portfolio Rejected",    desc: "Get notified when an admin rejects a portfolio item you uploaded" },
                      { key: "bookingReceived",     label: "Booking Received",      desc: "Get notified when a customer books your service directly" },
                      { key: "bookingCancelled",    label: "Booking Cancelled",     desc: "Get notified if a customer cancels a booking" },
                      { key: "bookingCompletedArtisan", label: "Booking Completed", desc: "Get notified when a booking is marked complete" },
                      { key: "bookingReminders",    label: "Appointment Reminders", desc: "24h and 2h reminders before your confirmed bookings" },
                    ] as { key: keyof ArtisanNotifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                        <Switch
                          checked={notifPrefs[key] ?? true}
                          onCheckedChange={(v) => toggleNotif(key, v)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <div className="border-b p-6">
                    <h3 className="font-semibold">Notification Channels</h3>
                    <p className="text-sm text-muted-foreground">Choose how you receive notifications</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Email and SMS coverage varies by notification type — in-app notifications always
                      fire when the toggle above is on.
                    </p>
                  </div>
                  <CardContent className="p-6 space-y-4">
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
                    ] as { key: keyof ArtisanNotifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
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

          {/* Security */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <div className="border-b p-6">
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
              <CardContent className="p-6">
                <div className="max-w-md space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPass">Current Password</Label>
                    <Input id="currentPass" type="password" placeholder="Enter current password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPass">New Password</Label>
                    <Input id="newPass" type="password" placeholder="Enter new password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPass">Confirm New Password</Label>
                    <Input id="confirmPass" type="password" placeholder="Confirm new password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} />
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

            <Card>
              <div className="border-b p-6">
                <h3 className="font-semibold">Two-Factor Authentication</h3>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Enable 2FA</p>
                    <p className="text-sm text-muted-foreground">Use an authenticator app for additional security</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <div className="border-b border-destructive/30 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-destructive/10 p-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-destructive">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground">Irreversible account actions</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
                  <div>
                    <p className="font-medium">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and remove your profile from the platform
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

      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => !isDeleting && setShowDeleteDialog(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate your account immediately and log you out. This action cannot be undone from
              within the app — contact support if you need to recover your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
    </DashboardLayout>
  )
}

export default function ArtisanSettingsPage() {
  return (
    <Suspense>
      <ArtisanSettingsContent />
    </Suspense>
  )
}
