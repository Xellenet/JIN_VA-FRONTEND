"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Settings,
  Shield,
  Bell,
  Globe,
  Users,
  Wrench,
  Loader2,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { applyPushPreference } from "@/lib/push-notifications"

/**
 * PR3 — admin notification preferences (design-spec.md section 5).
 *
 * The five event rows below replace eight hardcoded, uncontrolled rows whose
 * copy described an e-commerce store ("New Order Alerts", "Low Stock
 * Warnings") on a services marketplace with no orders and no inventory, behind
 * a Save button that had no onClick at all.
 *
 * `GET`/`PATCH /notifications/preferences` now return and accept the
 * admin-shaped body (api-contract.md §6): the five event keys plus the three
 * channel flags, all five defaulting to `true` server-side. Every one of them
 * is hydrated from the GET response and sent on save — nothing on this tab is
 * a local default, so the screen always shows the state the server holds.
 *
 * Writes are role-scoped in both directions server-side (an admin sending a
 * customer key has it ignored), so the whole id-stripped object is safe to
 * PATCH, matching what the Customer and Artisan tabs already do.
 */
interface AdminNotifPrefs {
  disputeFiled: boolean
  paymentTransferFailed: boolean
  verificationSubmitted: boolean
  reviewFlagged: boolean
  artisanRegistered: boolean
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
}

/**
 * Pre-hydration placeholder only — the Notifications tab renders a spinner
 * until the GET lands, so these values are never shown as if they were real
 * state. They mirror the server's own defaults (api-contract.md §6: all five
 * event toggles default to `true`) so a fetch failure can't misreport a toggle
 * as off when the backend has it on.
 */
const ADMIN_NOTIF_FALLBACK: AdminNotifPrefs = {
  disputeFiled: true,
  paymentTransferFailed: true,
  verificationSubmitted: true,
  reviewFlagged: true,
  artisanRegistered: true,
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
}

const ADMIN_EVENT_ROWS: { key: keyof AdminNotifPrefs; label: string; desc: string }[] = [
  { key: "disputeFiled", label: "Dispute Filed", desc: "Get notified when a customer or artisan opens a new dispute that needs review" },
  { key: "paymentTransferFailed", label: "Payment Transfer Failed", desc: "Get notified when an artisan payout fails and needs manual attention" },
  { key: "verificationSubmitted", label: "Artisan Verification Submitted", desc: "Get notified when a new artisan submits documents for verification" },
  { key: "reviewFlagged", label: "Review Flagged for Moderation", desc: "Get notified when a review is flagged and enters the moderation queue" },
  { key: "artisanRegistered", label: "New Artisan Registered", desc: "Get notified when a new artisan creates an account on the platform" },
]

/** The one field of `GET /payments/admin/all` this page needs (AT9). */
interface FeeProbePayment {
  amount: number | string
  platformFee: number | string
}

export default function AdminSettingsPage() {
  // ── Applied platform fee (AT9) ──────────────────────────────────────────
  const [appliedFeePercent, setAppliedFeePercent] = useState<number | null>(null)
  const [isLoadingFee, setIsLoadingFee] = useState(true)

  // ── Notification preferences (PR3) ──────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<AdminNotifPrefs>(ADMIN_NOTIF_FALLBACK)
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(true)
  const [isSavingNotifs, setIsSavingNotifs] = useState(false)

  useEffect(() => {
    // Hydrate every toggle from the server, event keys included — a local
    // default shown as live state is how "artisanRegistered" ended up
    // displaying as off while the backend had it on.
    apiFetch<Partial<AdminNotifPrefs>>("/notifications/preferences")
      .then((r) =>
        setNotifPrefs((p) => ({
          disputeFiled: r?.disputeFiled ?? p.disputeFiled,
          paymentTransferFailed: r?.paymentTransferFailed ?? p.paymentTransferFailed,
          verificationSubmitted: r?.verificationSubmitted ?? p.verificationSubmitted,
          reviewFlagged: r?.reviewFlagged ?? p.reviewFlagged,
          artisanRegistered: r?.artisanRegistered ?? p.artisanRegistered,
          emailEnabled: r?.emailEnabled ?? p.emailEnabled,
          smsEnabled: r?.smsEnabled ?? p.smsEnabled,
          pushEnabled: r?.pushEnabled ?? p.pushEnabled,
        })),
      )
      .catch(() => toast.error("Couldn't load notification preferences."))
      .finally(() => setIsLoadingNotifs(false))
  }, [])

  useEffect(() => {
    // The newest payment carries both the amount and the fee taken from it, so
    // the rate the platform is really applying is arithmetic over real data
    // rather than a number typed into this file.
    apiFetch<FeeProbePayment[]>("/payments/admin/all?page=1&limit=1")
      .then((rows) => {
        const latest = Array.isArray(rows) ? rows[0] : undefined
        const amount = Number(latest?.amount)
        const fee = Number(latest?.platformFee)
        if (!latest || !Number.isFinite(amount) || !Number.isFinite(fee) || amount <= 0) return
        setAppliedFeePercent(Math.round((fee / amount) * 10000) / 100)
      })
      .catch(() => {
        // Leave it unknown rather than showing a number we can't stand behind.
      })
      .finally(() => setIsLoadingFee(false))
  }, [])

  const toggleNotif = (key: keyof AdminNotifPrefs, val: boolean) => {
    setNotifPrefs((p) => ({ ...p, [key]: val }))
    // PN1: the push channel toggle is where browser permission is requested and
    // this device's FCM token is registered/unregistered.
    if (key === "pushEnabled") applyPushPreference(val)
  }

  const handleSaveNotifications = async () => {
    setIsSavingNotifs(true)
    try {
      // All eight fields — the five admin event toggles and the three channels.
      // `stripPreferenceMetadata` is not needed here because this component's
      // state never holds the preferences row's own `id`.
      await apiFetch("/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify(notifPrefs),
      })
      toast.success("Notification preferences saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save notification preferences.")
    } finally {
      setIsSavingNotifs(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">System Settings</h1>
          <p className="text-muted-foreground">
            Manage system-wide configurations and notifications
          </p>
        </div>

        {/*
          The "Products" tab and its mock inventory list are gone, along with
          /dashboard/admin/products (resolved Open Question 15): JinVa is a
          services marketplace with no product concept in the PRD or the
          backend — both were template leftovers whose "Delete Product" action
          only ever mutated a local array.
        */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" />
              General
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

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <div className="border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Globe className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Platform Configuration</h3>
                    <p className="text-sm text-muted-foreground">
                      Control platform-wide settings and defaults
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-6">
                {/*
                  AT9: these four shipped as `Plumbify` / `support@plumbify.com`
                  / `UTC-5 (Eastern Time)` — a different product in a different
                  country. Corrected to the real platform and to Ghana's
                  timezone (GMT, UTC+0, no daylight saving), which is also what
                  the GH₵ currency below already implied.
                */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="platformName">Platform Name</Label>
                    <Input id="platformName" defaultValue="JinVa" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supportEmail">Support Email</Label>
                    <Input id="supportEmail" defaultValue="support@jinva.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Default Currency</Label>
                    <Input id="currency" defaultValue="GHS (GH₵)" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input id="timezone" defaultValue="GMT (UTC+0) — Accra" />
                  </div>
                </div>

                <div className="space-y-4 border-t pt-6">
                  <h4 className="font-medium">System Controls</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Maintenance Mode</p>
                        <p className="text-sm text-muted-foreground">
                          Temporarily disable the platform for maintenance
                        </p>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Allow New Registrations</p>
                        <p className="text-sm text-muted-foreground">
                          Enable or disable new user and artisan sign-ups
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Auto-Assign Artisans</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically assign available artisans to new orders
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Enable Client Reviews</p>
                        <p className="text-sm text-muted-foreground">
                          Allow clients to leave ratings and reviews for artisans
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <div className="border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Users className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">User Management Defaults</h3>
                    <p className="text-sm text-muted-foreground">
                      Set default policies for users and artisans
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Require Email Verification</p>
                    <p className="text-sm text-muted-foreground">
                      New accounts must verify their email before accessing the platform
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Require Artisan License Verification</p>
                    <p className="text-sm text-muted-foreground">
                      Artisan accounts need admin-approved license verification
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Auto-Deactivate Inactive Accounts</p>
                    <p className="text-sm text-muted-foreground">
                      Deactivate accounts with no activity for 90+ days
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <Card>
              <div className="border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Wrench className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Service & Order Defaults</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure default behavior for services and orders
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cancellation">Cancellation Window (hours)</Label>
                    <Input id="cancellation" type="number" defaultValue="24" />
                  </div>
                  {/*
                    AT9: this shipped as an editable input reading 15 while the
                    backend's platform fee default is 5 — a 3x disagreement an
                    admin could reasonably have acted on, behind a Save button
                    that discarded whatever they typed. The fee is an env var
                    read at boot, and no endpoint exposes it, so the honest
                    value available today is the one the ledger actually shows:
                    platformFee / amount on the most recent real payment. Made
                    read-only until the backend exposes the configured value
                    (design-spec.md §11 item I); runtime configuration of the
                    fee stays out of scope.
                  */}
                  <div className="space-y-2">
                    <Label htmlFor="commission">Platform Commission (%)</Label>
                    <Input
                      id="commission"
                      readOnly
                      disabled
                      value={
                        isLoadingFee
                          ? "Checking…"
                          : appliedFeePercent != null
                            ? `${appliedFeePercent}%`
                            : "Not yet observable"
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {appliedFeePercent != null
                        ? "The rate the platform actually applied on the most recent payment. Set on the server; not editable here."
                        : "No payments have been taken yet, so there is no applied rate to read. Set on the server; not editable here."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxBookings">Max Concurrent Bookings per Client</Label>
                    <Input id="maxBookings" type="number" defaultValue="5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxJobs">Max Concurrent Jobs per Artisan</Label>
                    <Input id="maxJobs" type="number" defaultValue="3" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Save Settings
              </Button>
            </div>
          </TabsContent>

          {/* Notifications (PR3, design-spec.md section 5) */}
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
                        <p className="text-sm text-muted-foreground">
                          Choose which platform events you want to be alerted about
                        </p>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    {ADMIN_EVENT_ROWS.map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                        <Switch
                          checked={notifPrefs[key]}
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
                    {/*
                      PR2: the SMS row is deliberately absent, not disabled — no SMS delivery
                      capability exists anywhere on the platform. Same treatment as the Customer
                      and Artisan tabs.
                    */}
                    {([
                      { key: "emailEnabled", label: "Email Notifications", desc: "Receive notifications via email" },
                      { key: "pushEnabled",  label: "Push Notifications",  desc: "Receive browser push notifications" },
                    ] as { key: keyof AdminNotifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                        <Switch
                          checked={notifPrefs[key]}
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
                    <h3 className="font-semibold">Security Configuration</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage system-wide security and access policies
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Two-Factor Authentication (System-wide)</p>
                      <p className="text-sm text-muted-foreground">
                        Require 2FA for all admin and artisan accounts
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Session Timeout</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically log out inactive users after a set time
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">IP Whitelisting for Admin Panel</p>
                      <p className="text-sm text-muted-foreground">
                        Restrict admin access to specific IP addresses
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Login Attempt Limits</p>
                      <p className="text-sm text-muted-foreground">
                        Lock accounts after 5 consecutive failed login attempts
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">Password Policy</h4>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="minLength">Minimum Password Length</Label>
                      <Input id="minLength" type="number" defaultValue="8" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Password Expiry (days)</Label>
                      <Input id="expiry" type="number" defaultValue="90" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Save Security Settings
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
