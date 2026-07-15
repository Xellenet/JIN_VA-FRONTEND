"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

function ArtisanSettingsContent() {
  const { user, refreshUser } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get("tab") ?? "account"

  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  useEffect(() => {
    if (!user) return
    const parts = user.name.split(" ")
    setFirstname(parts[0] ?? "")
    setLastname(parts.slice(1).join(" "))
    setEmail(user.email ?? "")
    setPhone(user.phone ?? "")
  }, [user])
  const [isSaving, setIsSaving] = useState(false)

  // ── Notification preferences ────────────────────────────────────────────
  interface ArtisanNotifPrefs {
    newJobOpportunities: boolean; applicationUpdates: boolean; artisanJobUpdates: boolean
    paymentReleased: boolean; reviewsAndRatings: boolean; artisanPromotions: boolean
    applicationRejected: boolean; appliedJobExpired: boolean; profileVerified: boolean
    messageReceived: boolean
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

  const toggleNotif = (key: keyof ArtisanNotifPrefs, val: boolean) =>
    setNotifPrefs((p) => ({ ...p, [key]: val }))

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

  const [currentPass, setCurrentPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [isUpdatingPass, setIsUpdatingPass] = useState(false)

  if (!user) return null

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ firstname, lastname, email, phoneNumber: phone }),
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
                      <Input id="address" className="pl-10" placeholder="Enter your primary service area" />
                    </div>
                  </div>
                </div>
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
                    <Label htmlFor="radius">Service Radius (miles)</Label>
                    <Input id="radius" type="number" defaultValue="25" />
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
                      { key: "messageReceived",     label: "New Messages",          desc: "Get notified when you receive a direct message" },
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
                  </div>
                  <CardContent className="p-6 space-y-4">
                    {([
                      { key: "emailEnabled", label: "Email Notifications", desc: "Receive notifications via email" },
                      { key: "smsEnabled",   label: "SMS Notifications",   desc: "Receive notifications via text message" },
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
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
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
