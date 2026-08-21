"use client"

import { Fragment, useState, useEffect, useRef, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
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
  Camera,
  Mail,
  Phone,
  MapPin,
  Trash2,
  AlertTriangle,
  UserRound,
  Loader2,
  Lock,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Receipt,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"
import { applyPushPreference } from "@/lib/push-notifications"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { getPaymentStatusConfig } from "@/lib/status-badges"

// C4: matches GET /payments/history's real, unpaginated shape verbatim — no
// client-side pagination is invented for a list the backend doesn't paginate.
//
// QA re-verification (2026-08-21, NEW MAJOR): `getMyHistory`'s response
// shape changed when the backend closed security-report.md finding #5 (it
// no longer returns the raw Payment entity). The top-level `jobId` field is
// gone (only `job.id` remains) and `createdAt` was renamed to `date`. This
// interface and every read site below were updated to match — `jobId` is
// kept as an optional fallback only, `date` replaces `createdAt`.
interface BackendPayment {
  id: number
  jobId?: number
  amount: number
  status: string
  reference: string
  paidAt?: string
  date: string
  job?: { id: number; title: string }
}

function UserSettingsContent() {
  const { user, refreshUser, logout } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get("tab") ?? "profile"

  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
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

  // ── Avatar upload ────────────────────────────────────────────────────────
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB")
      e.target.value = ""
      return
    }
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are supported")
      e.target.value = ""
      return
    }

    const formData = new FormData()
    formData.append("avatar", file)

    setIsUploadingAvatar(true)
    try {
      await apiFetch("/users/me/avatar", { method: "POST", body: formData })
      await refreshUser()
      toast.success("Profile photo updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo")
    } finally {
      setIsUploadingAvatar(false)
      e.target.value = ""
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
        body: JSON.stringify(notifPrefs),
      })
      toast.success("Notification preferences saved.")
    } catch {
      toast.error("Failed to save notification preferences.")
    } finally {
      setIsSavingNotifs(false)
    }
  }

  // ── Payment history (C4 / design-spec.md 2.2) ───────────────────────────
  const [payments, setPayments] = useState<BackendPayment[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(true)
  const [paymentsError, setPaymentsError] = useState(false)
  const [expandedPaymentId, setExpandedPaymentId] = useState<number | null>(null)

  const loadPayments = () => {
    setIsLoadingPayments(true)
    setPaymentsError(false)
    apiFetch<BackendPayment[]>("/payments/history")
      .then(setPayments)
      .catch(() => setPaymentsError(true))
      .finally(() => setIsLoadingPayments(false))
  }

  useEffect(() => {
    loadPayments()
  }, [])

  useEffect(() => {
    if (!user) return
    const parts = user.name.split(" ")
    setFirstname(parts[0] ?? "")
    setLastname(parts.slice(1).join(" "))
    setEmail(user.email ?? "")
    setPhone(user.phone ?? "")
    setStreet(user.address?.street ?? "")
    setCity(user.address?.city ?? "")
    setCountry(user.address?.country ?? "")
    setZipCode(user.address?.zipCode ?? "")
    setNationalId(user.nationalId ?? "")
  }, [user])

  if (!user) return null

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstname,
          lastname,
          phoneNumber: phone,
          addresses: [{ street, city, country, zipCode }],
          ...(nationalId && !user.nationalId ? { nationalId } : {}),
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
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your personal information, notifications, and security preferences
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(tab) => router.replace(`?tab=${tab}`, { scroll: false })}
          className="space-y-6"
        >
          <TabsList className="bg-muted">
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
            <Card>
              <div className="border-b p-6">
                <h3 className="font-semibold">Profile Photo</h3>
                <p className="text-sm text-muted-foreground">
                  Update your profile picture visible to artisans
                </p>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback><UserRound className="h-6 w-6" /></AvatarFallback>
                    </Avatar>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute bottom-0 right-0 h-8 w-8 rounded-full border-2 border-background"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                      >
                        {isUploadingAvatar ? (
                          <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Uploading…</>
                        ) : "Upload New Photo"}
                      </Button>
                      <Button size="sm" variant="outline">Remove</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <div className="border-b p-6">
                <h3 className="font-semibold">Personal Information</h3>
                <p className="text-sm text-muted-foreground">
                  Update your name, contact details, and address
                </p>
              </div>
              <CardContent className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstname}
                      onChange={(e) => setFirstname(e.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
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
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="phone"
                        className="pl-10"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone number"
                      />
                    </div>
                  </div>
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
                        placeholder="Enter your national ID number"
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

            <Card>
              <div className="border-b p-6">
                <h3 className="font-semibold">Booking Preferences</h3>
                <p className="text-sm text-muted-foreground">
                  Customize your default booking behavior
                </p>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Auto-Confirm Bookings</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically confirm bookings when an artisan accepts
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Save Payment Method</p>
                    <p className="text-sm text-muted-foreground">
                      Remember your preferred payment method for future bookings
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Share Location with Artisan</p>
                    <p className="text-sm text-muted-foreground">
                      Allow assigned artisan to see your location for navigation
                    </p>
                  </div>
                  <Switch defaultChecked />
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
                <Card>
                  <div className="border-b p-6">
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
                  <CardContent className="p-6 space-y-4">
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

          {/* Payments (C4, design-spec.md 2.2) */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <div className="border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <CreditCard className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Payment History</h3>
                    <p className="text-sm text-muted-foreground">Everything you&apos;ve paid for on JinVa, newest first</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-0">
                {isLoadingPayments ? (
                  <div className="space-y-3 p-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : paymentsError ? (
                  <Empty className="border-0 py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <AlertTriangle className="text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle>Couldn&apos;t load your payments</EmptyTitle>
                      <EmptyDescription>Something went wrong fetching your payment history.</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button variant="outline" className="bg-transparent" onClick={loadPayments}>Try Again</Button>
                    </EmptyContent>
                  </Empty>
                ) : payments.length === 0 ? (
                  <Empty className="border-0 py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Receipt className="text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle>No payments yet</EmptyTitle>
                      <EmptyDescription>Payments you make for jobs will show up here.</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                        <a href="/dashboard/user/search">Browse Artisans</a>
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <>
                    {/* QA MEDIUM (2026-08-20): below md, this table's Status
                        column was pushed off-screen with no scroll affordance —
                        replaced with stacked cards carrying the same fields.
                        Table stays for md+ where it fits without scrolling. */}
                    <div className="hidden overflow-x-auto md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Job</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-8" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((p) => {
                            const cfg = getPaymentStatusConfig(p.status)
                            const isExpanded = expandedPaymentId === p.id
                            return (
                              <Fragment key={p.id}>
                                <TableRow
                                  className="cursor-pointer hover:bg-muted/30"
                                  onClick={() => setExpandedPaymentId(isExpanded ? null : p.id)}
                                >
                                  <TableCell className="max-w-[180px] truncate font-medium text-foreground">
                                    {p.job?.title ?? `Job #${p.job?.id ?? p.jobId}`}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                    {new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-foreground">
                                    {formatCurrency(p.amount)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={cfg.className}>
                                      <cfg.icon className="h-3 w-3" />
                                      {cfg.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                                    <TableCell colSpan={5} className="text-xs text-muted-foreground">
                                      <div className="flex flex-wrap gap-x-6 gap-y-1 py-1">
                                        <span>Reference: <span className="font-mono">{p.reference}</span></span>
                                        {p.paidAt && (
                                          <span>Paid at: {new Date(p.paidAt).toLocaleString("en-GB")}</span>
                                        )}
                                        <Link
                                          href={`/dashboard/user/jobs/${p.job?.id ?? p.jobId}`}
                                          className="text-primary hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          View Job
                                        </Link>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="divide-y md:hidden">
                      {payments.map((p) => {
                        const cfg = getPaymentStatusConfig(p.status)
                        const isExpanded = expandedPaymentId === p.id
                        return (
                          <div
                            key={p.id}
                            className="cursor-pointer space-y-2 p-4"
                            onClick={() => setExpandedPaymentId(isExpanded ? null : p.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="truncate font-medium text-foreground">{p.job?.title ?? `Job #${p.job?.id ?? p.jobId}`}</p>
                              {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <Badge variant="outline" className={cfg.className}>
                                <cfg.icon className="h-3 w-3" />
                                {cfg.label}
                              </Badge>
                              <span className="font-medium text-foreground">{formatCurrency(p.amount)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                            {isExpanded && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
                                <span>Reference: <span className="font-mono">{p.reference}</span></span>
                                {p.paidAt && (
                                  <span>Paid at: {new Date(p.paidAt).toLocaleString("en-GB")}</span>
                                )}
                                <Link
                                  href={`/dashboard/user/jobs/${p.job?.id ?? p.jobId}`}
                                  className="text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View Job
                                </Link>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
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
                      Permanently delete your account and all associated data
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

export default function UserSettingsPage() {
  return (
    <Suspense>
      <UserSettingsContent />
    </Suspense>
  )
}
