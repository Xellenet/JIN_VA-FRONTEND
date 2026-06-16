"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  CreditCard,
  User,
  Wrench,
  Phone,
  Mail,
  MessageSquare,
  Star,
  FileText,
} from "lucide-react"
import { mockOrders, mockArtisans } from "@/lib/data/mock-data"

export default function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const user = {
    id: "u1",
    name: "Sarah Williams",
    email: "sarah@example.com",
    role: "user" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  }

  const booking = mockOrders.find((o) => o.id === id) || mockOrders[0]
  const artisan = mockArtisans.find((p) => p.name.includes(booking.artisanName.split(" ")[0])) || mockArtisans[0]

  const statusConfig: Record<string, { label: string; className: string }> = {
    "in-progress": { label: "In Progress", className: "border-muted bg-muted text-muted-foreground" },
    completed: { label: "Completed", className: "border-green-200 bg-green-50 text-green-700" },
    cancelled: { label: "Cancelled", className: "border-red-200 bg-red-50 text-red-700" },
    pending: { label: "Pending", className: "border-yellow-200 bg-yellow-50 text-yellow-700" },
    available: { label: "Available", className: "border-blue-200 bg-blue-50 text-blue-700" },
  }

  const paymentConfig: Record<string, { label: string; className: string }> = {
    paid: { label: "Paid", className: "border-green-200 bg-green-50 text-green-700" },
    pending: { label: "Payment Pending", className: "border-yellow-200 bg-yellow-50 text-yellow-700" },
    refunded: { label: "Refunded", className: "border-red-200 bg-red-50 text-red-700" },
  }

  const handleCancelBooking = () => {
    setShowCancelDialog(false)
    router.push("/dashboard/user/bookings")
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Back button */}
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/user/bookings">
            <ArrowLeft className="h-4 w-4" />
            Back to Bookings
          </Link>
        </Button>

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Booking Details</h1>
            <p className="text-muted-foreground">Booking #{booking.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusConfig[booking.status]?.className || ""}>
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
              {statusConfig[booking.status]?.label || booking.status}
            </Badge>
            <Badge variant="outline" className={paymentConfig[booking.paymentStatus]?.className || ""}>
              {paymentConfig[booking.paymentStatus]?.label || booking.paymentStatus}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Details */}
          <div className="space-y-6 lg:col-span-2">
            {/* Service Info */}
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <Wrench className="h-4 w-4 text-primary" />
                  Service Information
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Service Name</p>
                    <p className="mt-1 font-medium text-foreground">{booking.serviceName}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Booking ID</p>
                    <p className="mt-1 font-medium text-foreground">#{booking.id}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Order Date</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="font-medium text-foreground">{booking.orderDate}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Deadline</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="font-medium text-foreground">{booking.deadline || "Not set"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  Service Location
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="font-medium text-foreground">123 Oak Street</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">Springfield, IL 62701</p>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Additional Notes:</p>
                  <p className="mt-1 leading-relaxed">
                    The leak is under the kitchen sink. Please use the side door entrance. The main water shutoff valve is in the basement.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Booking Timeline
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="space-y-0">
                  {[
                    { label: "Booking Created", time: booking.orderDate, done: true },
                    { label: "Artisan Assigned", time: booking.orderDate, done: true },
                    {
                      label: "Work Started",
                      time: booking.status !== "pending" ? booking.orderDate : "",
                      done: booking.status === "in-progress" || booking.status === "completed",
                    },
                    {
                      label: "Work Completed",
                      time: booking.status === "completed" ? booking.deadline || "" : "",
                      done: booking.status === "completed",
                    },
                  ].map((step, idx, arr) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            step.done ? "bg-primary text-primary-foreground" : "border-2 border-border bg-background"
                          }`}
                        >
                          {step.done ? (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-xs text-muted-foreground">{idx + 1}</span>
                          )}
                        </div>
                        {idx < arr.length - 1 && (
                          <div className={`h-8 w-0.5 ${step.done ? "bg-primary/50" : "bg-border"}`} />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`text-sm font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        {step.time && <p className="text-xs text-muted-foreground">{step.time}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Assigned Artisan */}
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  Assigned Artisan
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={artisan.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{artisan.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-foreground">{artisan.name}</h4>
                    <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{artisan.avgRating}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {artisan.phone}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {artisan.email}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="flex-1 bg-transparent" size="sm" asChild>
                    <Link href={`/dashboard/user/artisan/${artisan.id}`}>View Profile</Link>
                  </Button>
                  <Button variant="outline" className="flex-1 bg-transparent" size="sm" asChild>
                    <Link href={`/dashboard/user/messages?artisan=${artisan.id}`}>
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                      Chat
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Payment Summary */}
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Payment Summary
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Service cost</span>
                    <span className="font-medium text-foreground">$120.00</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Service fee</span>
                    <span className="font-medium text-foreground">$10.00</span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Total</span>
                      <span className="text-lg font-bold text-primary">$130.00</span>
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`mt-4 w-full justify-center ${paymentConfig[booking.paymentStatus]?.className || ""}`}
                >
                  {paymentConfig[booking.paymentStatus]?.label || booking.paymentStatus}
                </Badge>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="space-y-2 p-5">
                {booking.status === "completed" && (
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href={`/dashboard/user/review/${booking.id}`}>
                      <Star className="mr-2 h-4 w-4" />
                      Leave a Review
                    </Link>
                  </Button>
                )}
                {booking.status === "pending" && (
                  <Button variant="destructive" className="w-full" onClick={() => setShowCancelDialog(true)}>
                    Cancel Booking
                  </Button>
                )}
                {booking.status === "in-progress" && (
                  <Button variant="outline" className="w-full bg-transparent" asChild>
                    <Link href={`/dashboard/user/messages?artisan=${artisan.id}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Contact Support
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel booking #{booking.id} ({booking.serviceName})? This action cannot be undone and any associated payment will be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Yes, Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
