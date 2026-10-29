"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Settings,
  Shield,
  Bell,
  Globe,
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

/**
 * `GET /admin/platform-config` (AT9, QA ADM-20): the rules the backend really
 * enforces. The General and Security tabs used to be editable fields and
 * switches whose Save sent nothing, so every change was lost on reload; they
 * now show these values as they are.
 */
interface PlatformConfig {
  platformFeePercent: number
  currency: string
  timezone: string
  supportEmail: string | null
  bookingResponseHours: number
  maxPendingBookingsPerArtisan: number
  bookingReminderHours: number[]
  agreedPriceTolerancePercent: number
  jobAutoCompleteHours: number
  emailVerificationRequired: boolean
  passwordMinLength: number
  passwordRule: string
}

function ConfigRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 border-b py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <p className="shrink-0 text-sm font-medium text-foreground sm:text-right">{value}</p>
    </div>
  )
}

export default function AdminSettingsPage() {
  // ── Platform rules (AT9, QA ADM-20) ─────────────────────────────────────
  const [config, setConfig] = useState<PlatformConfig | null>(null)
  const [configFailed, setConfigFailed] = useState(false)

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
    apiFetch<PlatformConfig>("/admin/platform-config")
      .then(setConfig)
      .catch(() => setConfigFailed(true))
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

          {/* General (QA ADM-20: read-only — these are fixed in the platform's configuration) */}
          <TabsContent value="general" className="space-y-6">
            <PlatformRulesCard
              icon={<Globe className="h-5 w-5 text-foreground" />}
              title="Platform"
              description="How JinVa is set up"
              config={config}
              failed={configFailed}
              rows={(c) => [
                { label: "Currency", value: c.currency === "GHS" ? "Ghana cedi (GH₵)" : c.currency },
                { label: "Timezone", value: c.timezone },
                { label: "Support email", value: c.supportEmail ?? "Not set", hint: "Shown in every email JinVa sends" },
                {
                  label: "Platform commission",
                  value: `${c.platformFeePercent}%`,
                  hint: "Taken from each payment before the artisan is paid",
                },
              ]}
            />
            <PlatformRulesCard
              icon={<Wrench className="h-5 w-5 text-foreground" />}
              title="Bookings and jobs"
              description="The rules every booking and job follows"
              config={config}
              failed={configFailed}
              rows={(c) => [
                {
                  label: "Artisan response window",
                  value: `${c.bookingResponseHours} hours`,
                  hint: "A booking request the artisan doesn't answer in time expires",
                },
                {
                  label: "Pending requests per artisan",
                  value: `${c.maxPendingBookingsPerArtisan} per customer`,
                  hint: "How many unanswered requests one customer can have with one artisan",
                },
                {
                  label: "Appointment reminders",
                  value: c.bookingReminderHours.map((h) => `${h}h`).join(" and ") + " before",
                },
                {
                  label: "Agreed price range",
                  value: `within ${c.agreedPriceTolerancePercent}% of the listed price`,
                  hint: "When a service has a listed price",
                },
                {
                  label: "Automatic job completion",
                  value: `${c.jobAutoCompleteHours} hours`,
                  hint: "After the artisan marks a job finished, if the customer doesn't respond",
                },
              ]}
            />
          </TabsContent>

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
            <PlatformRulesCard
              icon={<Shield className="h-5 w-5 text-foreground" />}
              title="Accounts and sign-in"
              description="Applied to every customer, artisan and admin account"
              config={config}
              failed={configFailed}
              rows={(c) => [
                {
                  label: "Email verification",
                  value: c.emailVerificationRequired ? "Required before first sign-in" : "Not required",
                },
                { label: "Password rule", value: `${c.passwordMinLength}+ characters`, hint: c.passwordRule },
                {
                  label: "Banned accounts",
                  value: "Signed out everywhere",
                  hint: "A ban ends every session and blocks sign-in until the account is unbanned",
                },
                {
                  label: "Suspended accounts",
                  value: "Can sign in, can't transact",
                  hint: "Hidden from search; can't book, post jobs, apply or message",
                },
              ]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

function PlatformRulesCard({
  icon,
  title,
  description,
  config,
  failed,
  rows,
}: {
  icon: React.ReactNode
  title: string
  description: string
  config: PlatformConfig | null
  failed: boolean
  rows: (c: PlatformConfig) => Array<{ label: string; value: string; hint?: string }>
}) {
  return (
    <Card>
      <div className="border-b p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">{icon}</div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <CardContent className="p-6 pt-3">
        {failed ? (
          <p className="py-4 text-sm text-muted-foreground">Couldn&apos;t load these settings. Refresh to try again.</p>
        ) : !config ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          rows(config).map((r) => <ConfigRow key={r.label} {...r} />)
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          These are set in the platform&apos;s configuration and can&apos;t be changed from this screen.
        </p>
      </CardContent>
    </Card>
  )
}
