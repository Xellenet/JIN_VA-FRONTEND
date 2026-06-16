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
  Briefcase,
  Camera,
  Mail,
  Phone,
  MapPin,
  Trash2,
  AlertTriangle,
  Clock,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export default function ArtisanSettingsPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account, notifications, availability, and security preferences
          </p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
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
                    <p className="text-sm text-muted-foreground">{user.specialization}</p>
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
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" defaultValue={user.name} />
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
                      <Input id="phone" className="pl-10" defaultValue={user.phone ?? ""} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialization">Specialization</Label>
                    <Input id="specialization" defaultValue={user.specialization ?? ""} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Service Area Address</Label>
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
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Auto-Accept Matching Jobs</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically accept jobs matching your specialization
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Show Phone Number to Clients</p>
                    <p className="text-sm text-muted-foreground">
                      Allow clients to see your phone number on your profile
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Accept Emergency Jobs</p>
                    <p className="text-sm text-muted-foreground">
                      Receive high-priority emergency repair requests
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
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
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
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
                    <p className="text-sm text-muted-foreground">
                      Set your regular working hours and days off
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                {[
                  { day: "Monday", from: "08:00", to: "17:00", on: true },
                  { day: "Tuesday", from: "08:00", to: "17:00", on: true },
                  { day: "Wednesday", from: "08:00", to: "17:00", on: true },
                  { day: "Thursday", from: "08:00", to: "17:00", on: true },
                  { day: "Friday", from: "08:00", to: "17:00", on: true },
                  { day: "Saturday", from: "09:00", to: "14:00", on: true },
                  { day: "Sunday", from: "00:00", to: "00:00", on: false },
                ].map((schedule) => (
                  <div
                    key={schedule.day}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <Switch defaultChecked={schedule.on} />
                      <span className="w-24 font-medium">{schedule.day}</span>
                    </div>
                    {schedule.on ? (
                      <div className="flex items-center gap-3">
                        <Input
                          type="time"
                          defaultValue={schedule.from}
                          className="w-32"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          defaultValue={schedule.to}
                          className="w-32"
                        />
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
                <p className="text-sm text-muted-foreground">
                  Override your schedule with a quick availability toggle
                </p>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Current Status</p>
                    <p className="text-sm text-muted-foreground">
                      Set yourself as available or busy regardless of schedule
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    >
                      Available
                    </Button>
                    <Button variant="outline">Busy</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Vacation Mode</p>
                    <p className="text-sm text-muted-foreground">
                      Temporarily pause all job assignments
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Save Schedule
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
                      Choose which alerts you want to receive
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                {[
                  { label: "New Job Assignments", desc: "Get notified when a new job is assigned to you", on: true },
                  { label: "Job Status Changes", desc: "Alerts when a job status is updated by admin or client", on: true },
                  { label: "Client Messages", desc: "Notifications for new messages from clients", on: true },
                  { label: "Payment Received", desc: "Get notified when a payment is processed", on: true },
                  { label: "New Reviews", desc: "Alerts when a client leaves a review", on: true },
                  { label: "Schedule Reminders", desc: "Upcoming job reminders 1 hour before start", on: true },
                  { label: "Low Rating Alerts", desc: "Get alerted if your rating drops below 4.0", on: false },
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
                  <Switch defaultChecked />
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
