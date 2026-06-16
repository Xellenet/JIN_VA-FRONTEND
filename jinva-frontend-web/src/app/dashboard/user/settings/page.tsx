"use client"

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
  Camera,
  Mail,
  Phone,
  MapPin,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export default function UserSettingsPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your personal information, notifications, and security preferences
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
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
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{user.name.substring(0, 2)}</AvatarFallback>
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
                    <p className="text-sm text-muted-foreground">{user.email}</p>
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
                  Update your name, contact details, and address
                </p>
              </div>
              <CardContent className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" defaultValue="Sarah" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" defaultValue="Williams" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" className="pl-10" defaultValue={user.email} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="phone" className="pl-10" defaultValue="+1 234 567 890" />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="address" className="pl-10" defaultValue="123 Main Street, Springfield" />
                    </div>
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
                      Automatically confirm bookings when a artisan accepts
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
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Save Changes
              </Button>
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <div className="border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Bell className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Notification Preferences</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose which notifications you want to receive
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                {[
                  { label: "Booking Confirmations", desc: "Get notified when a artisan confirms your booking", on: true },
                  { label: "Job Status Updates", desc: "Receive updates when your job status changes", on: true },
                  { label: "Artisan En Route", desc: "Get alerted when a artisan is on their way", on: true },
                  { label: "Payment Receipts", desc: "Receive email receipts for completed payments", on: true },
                  { label: "Promotional Offers", desc: "Get notified about discounts and special offers", on: false },
                  { label: "Service Reminders", desc: "Reminders for upcoming scheduled services", on: true },
                  { label: "Review Requests", desc: "Get prompted to review artisans after service completion", on: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.on} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <div className="border-b p-6">
                <h3 className="font-semibold">Notification Channels</h3>
                <p className="text-sm text-muted-foreground">
                  Choose how you receive notifications
                </p>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">SMS Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive notifications via text message</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive browser push notifications</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Save Notifications
              </Button>
            </div>
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
                    <p className="text-sm text-muted-foreground">
                      Update your account password
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="max-w-md space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPass">Current Password</Label>
                    <Input id="currentPass" type="password" placeholder="Enter current password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPass">New Password</Label>
                    <Input id="newPass" type="password" placeholder="Enter new password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPass">Confirm New Password</Label>
                    <Input id="confirmPass" type="password" placeholder="Confirm new password" />
                  </div>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <div className="border-b p-6">
                <h3 className="font-semibold">Two-Factor Authentication</h3>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Enable 2FA</p>
                    <p className="text-sm text-muted-foreground">
                      Use an authenticator app for additional security
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <div className="border-b border-red-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-700">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground">
                      Irreversible account actions
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center justify-between rounded-lg border border-red-100 p-4">
                  <div>
                    <p className="font-medium">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data
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
