"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import Link from "next/link"
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
  Trash2,
  AlertTriangle,
  Loader2,
  Wallet,
  CalendarDays,
  UserCircle,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { ApiError, apiFetch } from "@/lib/api"
import { isStrongPassword, PASSWORD_MESSAGES } from "@/components/auth/signup-fields"
import { splitStoredPhone } from "@/lib/phone"
import { loginUrlAfterAccountDeletion } from "@/lib/auth"
import { applyPushPreference } from "@/lib/push-notifications"
import { stripPreferenceMetadata } from "@/lib/notifications"
import { toast } from "sonner"
import { ProfilePhotoCard } from "@/components/settings/profile-photo-card"
import { PayoutMethodCard, PAYOUT_METHOD_ANCHOR } from "@/components/settings/payout-method-card"

const TABS = ["profile", "notifications", "payouts", "security"] as const
type Tab = (typeof TABS)[number]

/**
 * Old links used `?tab=account` (now Profile) and `?tab=availability` (removed,
 * C4: working hours live in Calendar). Anything unknown opens Profile; a bare
 * `#payout-method` anchor opens Payouts.
 */
function resolveTab(param: string | null, hash: string): Tab {
  if (param && (TABS as readonly string[]).includes(param)) return param as Tab
  if (hash === `#${PAYOUT_METHOD_ANCHOR}`) return "payouts"
  return "profile"
}

interface ArtisanNotifPrefs {
  newJobOpportunities: boolean; applicationUpdates: boolean; artisanJobUpdates: boolean
  paymentReleased: boolean; reviewsAndRatings: boolean; artisanPromotions: boolean
  applicationRejected: boolean; appliedJobExpired: boolean; profileVerified: boolean
  messageReceived: boolean; portfolioApproved: boolean; portfolioRejected: boolean
  // A7: 24h/2h pre-appointment reminders for confirmed bookings.
  bookingReminders: boolean
  // PR1: returned by the backend's ArtisanNotificationPreferencesResponseDto;
  // they must round-trip or an artisan can't turn them off.
  verificationRejected: boolean; bookingReceived: boolean
  bookingCancelled: boolean; bookingCompletedArtisan: boolean
  emailEnabled: boolean; smsEnabled: boolean; pushEnabled: boolean
}

const NOTIFICATION_ROWS: { key: keyof ArtisanNotifPrefs; label: string; desc: string }[] = [
  { key: "newJobOpportunities", label: "New job opportunities", desc: "When a client posts a job that matches your services" },
  { key: "applicationUpdates", label: "Application accepted", desc: "When a client accepts your application" },
  { key: "applicationRejected", label: "Application not selected", desc: "When a client chooses someone else" },
  { key: "artisanJobUpdates", label: "Job updates", desc: "When a job you're on is cancelled or changes status" },
  { key: "bookingReceived", label: "Booking requests", desc: "When a client books you directly" },
  { key: "bookingCancelled", label: "Booking cancelled", desc: "When a client cancels a booking" },
  { key: "bookingCompletedArtisan", label: "Booking completed", desc: "When a booking is marked complete" },
  { key: "bookingReminders", label: "Appointment reminders", desc: "Reminders before your confirmed bookings" },
  { key: "paymentReleased", label: "Payment sent", desc: "When your earnings for a job are sent to you" },
  { key: "reviewsAndRatings", label: "Reviews", desc: "When a client leaves you a review or rating" },
  { key: "messageReceived", label: "New messages", desc: "When a client sends you a message" },
  { key: "appliedJobExpired", label: "Applied job expired", desc: "When a job you applied to expires" },
  { key: "profileVerified", label: "Verification approved", desc: "When your identity verification is approved" },
  { key: "verificationRejected", label: "Verification not approved", desc: "When your identity verification needs another look" },
  { key: "portfolioApproved", label: "Portfolio photo approved", desc: "When a photo you uploaded is approved" },
  { key: "portfolioRejected", label: "Portfolio photo not approved", desc: "When a photo you uploaded isn't approved" },
  { key: "artisanPromotions", label: "JinVa offers for artisans", desc: "Occasional offers and news for artisans" },
]

const CHANNEL_ROWS: { key: keyof ArtisanNotifPrefs; label: string; desc: string }[] = [
  // PR2: no SMS row — there is no SMS delivery anywhere in the platform.
  // `smsEnabled` stays in the payload so the stored value round-trips.
  { key: "emailEnabled", label: "Email", desc: "Send notifications to your email" },
  { key: "pushEnabled", label: "Push notifications", desc: "Show notifications in this browser" },
]

function ArtisanSettingsContent() {
  const { user, refreshUser, logout } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [hash, setHash] = useState("")
  useEffect(() => setHash(window.location.hash), [])
  const activeTab = resolveTab(searchParams.get("tab"), hash)

  const changeTab = (tab: string) => {
    setHash("")
    router.replace(`?tab=${tab}`, { scroll: false })
  }

  // Phones: the tab strip scrolls; keep the active tab in view.
  const tabsListRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    tabsListRef.current
      ?.querySelector<HTMLElement>("[data-state=active]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeTab])

  // ── Delete account (F4 / C1) ────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // C1.1: the backend refuses deletion with a 409 while the account still owes
  // somebody something, and its message names every outstanding item — shown
  // in the open dialog, where it can be read.
  const [deleteRefusal, setDeleteRefusal] = useState<string | null>(null)

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteRefusal(null)
    try {
      // `purgeAt` is the server-computed restore deadline, carried to the
      // login form so its confirmation names the real date.
      const deleted = await apiFetch<{ purgeAt?: string }>("/users/me", { method: "DELETE" })
      // C1.2/C1.3: clear this device's state, then land on the login form
      // deliberately (see the customer settings page for the full reasoning).
      await logout()
      globalThis.location.href = loginUrlAfterAccountDeletion(deleted?.purgeAt)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setDeleteRefusal(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : "Couldn’t delete your account. Try again.")
      }
      setIsDeleting(false)
    }
  }

  // ── Notification preferences ────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<Partial<ArtisanNotifPrefs>>({})
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(true)
  const [notifsLoadFailed, setNotifsLoadFailed] = useState(false)
  const [isSavingNotifs, setIsSavingNotifs] = useState(false)

  useEffect(() => {
    apiFetch<ArtisanNotifPrefs>("/notifications/preferences")
      .then(setNotifPrefs)
      .catch(() => setNotifsLoadFailed(true))
      .finally(() => setIsLoadingNotifs(false))
  }, [])

  const toggleNotif = (key: keyof ArtisanNotifPrefs, val: boolean) => {
    setNotifPrefs((p) => ({ ...p, [key]: val }))
    // PN1: the push toggle is where browser permission is requested and this
    // device's push token is registered or removed.
    if (key === "pushEnabled") applyPushPreference(val)
  }

  const handleSaveNotifications = async () => {
    setIsSavingNotifs(true)
    try {
      await apiFetch("/notifications/preferences", {
        method: "PATCH",
        // Drops the row `id` the GET carries — the PATCH whitelist rejects it.
        body: JSON.stringify(stripPreferenceMetadata(notifPrefs)),
      })
      toast.success("Notification preferences saved")
    } catch {
      toast.error("Couldn’t save your notification preferences. Try again.")
    } finally {
      setIsSavingNotifs(false)
    }
  }

  // ── Password ────────────────────────────────────────────────────────────
  const [currentPass, setCurrentPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [passErrors, setPassErrors] = useState<{ newPass?: string; confirmPass?: string; form?: string }>({})
  const [isUpdatingPass, setIsUpdatingPass] = useState(false)

  if (!user) return null

  const handleUpdatePassword = async () => {
    const errors: typeof passErrors = {}
    if (!isStrongPassword(newPass)) errors.newPass = PASSWORD_MESSAGES.rule
    if (newPass !== confirmPass) errors.confirmPass = "The new passwords don’t match."
    setPassErrors(errors)
    if (errors.newPass || errors.confirmPass) {
      document.getElementById(errors.newPass ? "newPass" : "confirmPass")?.focus()
      return
    }
    setIsUpdatingPass(true)
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        // FE-1: `confirmNewPassword` is required by the endpoint's DTO. Kept
        // identical to /dashboard/user/settings so the pages can't drift.
        body: JSON.stringify({
          currentPassword: currentPass,
          newPassword: newPass,
          confirmNewPassword: confirmPass,
        }),
      })
      toast.success("Password updated")
      setCurrentPass("")
      setNewPass("")
      setConfirmPass("")
    } catch (err: unknown) {
      setPassErrors({ form: err instanceof Error ? err.message : "Couldn’t update your password. Try again." })
    } finally {
      setIsUpdatingPass(false)
    }
  }

  const phone = user.phone ? splitStoredPhone(user.phone).national : ""

  return (
    <DashboardLayout>
      <div className="max-w-[1080px] space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your photo, notifications, payouts and security
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={changeTab} className="space-y-6">
          {/* M1: a 2×2 grid on phones, so no tab (Security holds Delete account) is ever clipped off-screen. */}
          <TabsList ref={tabsListRef} className="grid h-auto w-full grid-cols-2 gap-1 bg-muted sm:inline-flex sm:w-fit sm:gap-0">
            <TabsTrigger value="profile" className="min-h-11 gap-2 sm:min-h-0">
              <User className="h-4 w-4" aria-hidden="true" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="min-h-11 gap-2 sm:min-h-0">
              <Bell className="h-4 w-4" aria-hidden="true" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="payouts" className="min-h-11 gap-2 sm:min-h-0">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Payouts
            </TabsTrigger>
            <TabsTrigger value="security" className="min-h-11 gap-2 sm:min-h-0">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Profile: the photo, plus where everything else is edited. Name,
              phone, service area, rates and policy live on the Profile page
              only (P1) — this tab links there rather than repeating them. */}
          <TabsContent value="profile" className="space-y-6">
            <ProfilePhotoCard user={user} refreshUser={refreshUser} />

            <Card className="gap-0 py-0">
              <div className="border-b p-4 sm:p-6">
                <h3 className="font-semibold">Your details</h3>
                <p className="text-sm text-muted-foreground">
                  Edit your name, phone, service area, rates and cancellation policy on your profile.
                </p>
              </div>
              <CardContent className="p-4 sm:p-6">
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd dir="auto" className="mt-0.5 font-medium text-foreground [overflow-wrap:anywhere]">{user.name}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd dir="auto" className="mt-0.5 font-medium text-foreground [overflow-wrap:anywhere]">{user.email}</dd>
                    <dd className="mt-0.5 text-xs text-muted-foreground">Email can&apos;t be changed.</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{phone || "Not added"}</dd>
                  </div>
                </dl>
                <Button variant="outline" asChild className="mt-5 max-sm:h-11 max-sm:w-full">
                  <Link href="/dashboard/artisan/profile">
                    <UserCircle className="h-4 w-4" aria-hidden="true" />
                    Edit your profile
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <h3 className="font-semibold">Working hours and time off</h3>
                  <p className="text-sm text-muted-foreground">
                    Set when you work and block out days off in your calendar.
                  </p>
                </div>
                <Button variant="outline" asChild className="shrink-0 max-sm:h-11 max-sm:w-full">
                  <Link href="/dashboard/artisan/calendar">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Open calendar
                  </Link>
                </Button>
              </div>
            </Card>
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
                    {NOTIFICATION_ROWS.map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div className="min-w-0">
                          <p id={`notif-${key}`} className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                        <Switch
                          aria-labelledby={`notif-${key}`}
                          checked={notifPrefs[key] ?? true}
                          onCheckedChange={(v) => toggleNotif(key, v)}
                        />
                      </div>
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
                    {CHANNEL_ROWS.map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div className="min-w-0">
                          <p id={`notif-${key}`} className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                        <Switch
                          aria-labelledby={`notif-${key}`}
                          checked={notifPrefs[key] ?? true}
                          onCheckedChange={(v) => toggleNotif(key, v)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button className="max-sm:h-11 max-sm:w-full" onClick={handleSaveNotifications} disabled={isSavingNotifs}>
                    {isSavingNotifs && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    Save notifications
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Payouts: one card, one save (H11 partial). */}
          <TabsContent value="payouts" className="space-y-6">
            <PayoutMethodCard />
          </TabsContent>

          {/* Security. C6: no 2FA switch until two-factor sign-in exists. */}
          <TabsContent value="security" className="space-y-6">
            <Card className="gap-0 py-0">
              <div className="border-b p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Shield className="h-5 w-5 text-foreground" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Change password</h3>
                    <p className="text-sm text-muted-foreground">Change the password you sign in with</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 sm:p-6">
                <form
                  noValidate
                  className="max-w-md space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleUpdatePassword()
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="currentPass">Current password</Label>
                    <Input
                      id="currentPass"
                      type="password"
                      autoComplete="current-password"
                      className="max-sm:h-11"
                      value={currentPass}
                      onChange={(e) => {
                        setCurrentPass(e.target.value)
                        setPassErrors((p) => ({ ...p, form: undefined }))
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPass" className={passErrors.newPass ? "text-destructive" : undefined}>New password</Label>
                    <Input
                      id="newPass"
                      type="password"
                      autoComplete="new-password"
                      className="max-sm:h-11"
                      aria-invalid={passErrors.newPass ? true : undefined}
                      aria-describedby={passErrors.newPass ? "newPass-error" : undefined}
                      value={newPass}
                      onChange={(e) => {
                        setNewPass(e.target.value)
                        setPassErrors((p) => ({ ...p, newPass: undefined, form: undefined }))
                      }}
                    />
                    {passErrors.newPass && <p id="newPass-error" className="text-sm text-destructive">{passErrors.newPass}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPass" className={passErrors.confirmPass ? "text-destructive" : undefined}>
                      Confirm new password
                    </Label>
                    <Input
                      id="confirmPass"
                      type="password"
                      autoComplete="new-password"
                      className="max-sm:h-11"
                      aria-invalid={passErrors.confirmPass ? true : undefined}
                      aria-describedby={passErrors.confirmPass ? "confirmPass-error" : undefined}
                      value={confirmPass}
                      onChange={(e) => {
                        setConfirmPass(e.target.value)
                        setPassErrors((p) => ({ ...p, confirmPass: undefined, form: undefined }))
                      }}
                    />
                    {passErrors.confirmPass && (
                      <p id="confirmPass-error" className="text-sm text-destructive">{passErrors.confirmPass}</p>
                    )}
                  </div>
                  {passErrors.form && (
                    <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {passErrors.form}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="max-sm:h-11 max-sm:w-full"
                    disabled={isUpdatingPass || !currentPass || !newPass || !confirmPass}
                  >
                    {isUpdatingPass && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    Update password
                  </Button>
                </form>
              </CardContent>
            </Card>

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
                    Your profile disappears from search and clients can no longer book you. You can restore your
                    account within 30 days.
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
              You&apos;ll be signed out straight away and your profile will stop appearing in search. You have{" "}
              <span className="font-medium text-foreground">30 days</span> to change your mind — sign in again
              before then and we&apos;ll restore your account, your job history and your reviews. After 30 days
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
