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
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Settings,
  Shield,
  Bell,
  Globe,
  Trash2,
  Package,
  MoreVertical,
  AlertTriangle,
  Search,
  Users,
  Wrench,
  Loader2,
} from "lucide-react"
import { mockProducts } from "@/lib/data/mock-data"
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
 * BACKEND DEPENDENCY — these five keys do not exist yet. The backend today
 * only has customer- and artisan-shaped notification-preference DTOs
 * (`CustomerNotificationPreferencesResponseDto` /
 * `ArtisanNotificationPreferencesResponseDto`), and for an ADMIN caller
 * `GET/PATCH /notifications/preferences` falls through to the customer shape.
 * design-spec.md section 7 item 6 asks the backend engineer for an
 * admin-shaped DTO on that same endpoint.
 *
 * TODO(messaging-notifications, pass 2): once the admin-shaped DTO ships,
 *   1. add the five ADMIN_EVENT_ROWS keys to the PATCH payload in
 *      handleSaveNotifications (they are excluded today because the backend
 *      runs a global ValidationPipe with `forbidNonWhitelisted: true`, so
 *      posting an unknown key 400s the entire request — including the channel
 *      toggles that do work);
 *   2. hydrate them from the GET response instead of ADMIN_NOTIF_DEFAULTS;
 *   3. restore the "Notification preferences saved." toast copy.
 * Expected endpoints, unchanged from what Customer/Artisan already use:
 *   GET   /notifications/preferences   -> admin-shaped DTO
 *   PATCH /notifications/preferences   -> partial admin-shaped DTO
 * The five key names below are taken from the backend's own in-progress
 * `UpdateNotificationPreferencesDto` / `ADMIN_UPDATABLE` (`disputeFiled`,
 * `paymentTransferFailed`, `verificationSubmitted`, `reviewFlagged`,
 * `artisanRegistered`) rather than invented here, so pass 2 should be a payload
 * change and nothing else. Verified against the running server on 2026-08-21:
 * all five are still rejected with `property <key> should not exist`, i.e. that
 * backend work is written but not yet deployed. Re-confirm the names against
 * api-contract.md before wiring.
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

/** Defaults mirror the mockup: everything on except "New Artisan Registered". */
const ADMIN_NOTIF_DEFAULTS: AdminNotifPrefs = {
  disputeFiled: true,
  paymentTransferFailed: true,
  verificationSubmitted: true,
  reviewFlagged: true,
  artisanRegistered: false,
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

export default function AdminSettingsPage() {
  const [products, setProducts] = useState(mockProducts)
  const [productSearch, setProductSearch] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // ── Notification preferences (PR3) ──────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<AdminNotifPrefs>(ADMIN_NOTIF_DEFAULTS)
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(true)
  const [isSavingNotifs, setIsSavingNotifs] = useState(false)

  useEffect(() => {
    // Only the channel toggles are real on this endpoint for an admin today;
    // the five event keys stay on their defaults until the backend DTO exists.
    apiFetch<Partial<AdminNotifPrefs>>("/notifications/preferences")
      .then((r) =>
        setNotifPrefs((p) => ({
          ...p,
          emailEnabled: r?.emailEnabled ?? p.emailEnabled,
          smsEnabled: r?.smsEnabled ?? p.smsEnabled,
          pushEnabled: r?.pushEnabled ?? p.pushEnabled,
        })),
      )
      .catch(() => {})
      .finally(() => setIsLoadingNotifs(false))
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
      // See the TODO above: ADMIN_EVENT_KEYS are deliberately not sent yet.
      await apiFetch("/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify({
          emailEnabled: notifPrefs.emailEnabled,
          smsEnabled: notifPrefs.smsEnabled,
          pushEnabled: notifPrefs.pushEnabled,
        }),
      })
      toast.success("Notification channels saved.")
    } catch {
      toast.error("Failed to save notification preferences.")
    } finally {
      setIsSavingNotifs(false)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  )

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
    setDeleteConfirm(null)
  }

  const stockBadge = (status: string) => {
    const map: Record<string, string> = {
      "in-stock": "border-green-200 bg-green-50 text-green-700",
      "low-stock": "border-yellow-200 bg-yellow-50 text-yellow-700",
      "out-of-stock": "border-red-200 bg-red-50 text-red-700",
    }
    return map[status] || ""
  }

  const stockLabel = (status: string) => {
    const map: Record<string, string> = {
      "in-stock": "In Stock",
      "low-stock": "Low Stock",
      "out-of-stock": "Out of Stock",
    }
    return map[status] || status
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">System Settings</h1>
          <p className="text-muted-foreground">
            Manage system-wide configurations, notifications, and product inventory
          </p>
        </div>

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
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Products
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
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="platformName">Platform Name</Label>
                    <Input id="platformName" defaultValue="Plumbify" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supportEmail">Support Email</Label>
                    <Input id="supportEmail" defaultValue="support@plumbify.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Default Currency</Label>
                    <Input id="currency" defaultValue="GHS (GH₵)" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input id="timezone" defaultValue="UTC-5 (Eastern Time)" />
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
                  <div className="space-y-2">
                    <Label htmlFor="commission">Platform Commission (%)</Label>
                    <Input id="commission" type="number" defaultValue="15" />
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

          {/* Product Management */}
          <TabsContent value="products" className="space-y-6">
            <Card>
              <div className="border-b p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <Package className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Product Management</h3>
                      <p className="text-sm text-muted-foreground">
                        Delete or manage products from the system inventory
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-foreground/20">
                    {products.length} products
                  </Badge>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search products by name or SKU..."
                    className="pl-10"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  {filteredProducts.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      <p>No products found</p>
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="font-mono">{product.sku}</span>
                              <span>{'|'}</span>
                              <span>{product.category}</span>
                              <span>{'|'}</span>
                              <span className="font-semibold text-foreground">
                                GH₵ {product.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={stockBadge(product.status)}>
                            {stockLabel(product.status)}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Stock: {product.stock}
                          </span>

                          {deleteConfirm === product.id ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteProduct(product.id)}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteConfirm(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteConfirm(product.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Product
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200">
              <div className="border-b border-red-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-700">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground">
                      Irreversible system-wide actions. Proceed with caution.
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-red-100 p-4">
                  <div>
                    <p className="font-medium">Purge All Cancelled Orders</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently remove all cancelled order records from the system
                    </p>
                  </div>
                  <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 bg-transparent">
                    Purge Orders
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-red-100 p-4">
                  <div>
                    <p className="font-medium">Deactivate All Inactive Artisans</p>
                    <p className="text-sm text-muted-foreground">
                      Mark all artisans with no jobs in 60+ days as inactive
                    </p>
                  </div>
                  <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 bg-transparent">
                    Deactivate
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-red-100 p-4">
                  <div>
                    <p className="font-medium">Reset System Data</p>
                    <p className="text-sm text-muted-foreground">
                      Clear all data and reset the platform to its default state
                    </p>
                  </div>
                  <Button variant="destructive">
                    Reset System
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
