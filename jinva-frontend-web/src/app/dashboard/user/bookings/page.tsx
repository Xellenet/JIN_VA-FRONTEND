"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
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
import { Calendar, Clock, Search, ChevronDown, MessageSquare } from "lucide-react"
import { mockOrders, mockArtisans } from "@/lib/data/mock-data"
import type { Order } from "@/lib/types"

const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
]

const dateRangeOptions = [
  { label: "All Time", value: "all" },
  { label: "Last 7 Days", value: "7" },
  { label: "Last 30 Days", value: "30" },
  { label: "Last 90 Days", value: "90" },
  { label: "Last 6 Months", value: "180" },
]

export default function UserBookingsPage() {
  const user = {
    id: "u1",
    name: "Sarah Williams",
    email: "sarah@example.com",
    role: "user" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  }

  const [bookings, setBookings] = useState<Order[]>(mockOrders)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateRange, setDateRange] = useState("all")
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null)

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesSearch =
        !searchQuery ||
        booking.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.artisanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.id.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === "all" || booking.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [bookings, searchQuery, statusFilter, dateRange])

  const handleCancelBooking = () => {
    if (cancelBookingId) {
      setBookings((prev) => prev.filter((b) => b.id !== cancelBookingId))
      setCancelBookingId(null)
    }
  }

  const getArtisanIdForBooking = (booking: Order) => {
    const artisan = mockArtisans.find(
      (p) => p.name.includes(booking.artisanName.split(" ")[0]) || p.id === booking.artisanId,
    )
    return artisan?.id || "p1"
  }

  const statusConfig: Record<string, { label: string; className: string }> = {
    "in-progress": { label: "In Progress", className: "bg-muted text-muted-foreground border-muted" },
    completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
    cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    available: { label: "Available", className: "bg-blue-100 text-blue-700 border-blue-200" },
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
          <p className="text-muted-foreground">View and manage all your service bookings</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search bookings..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Status Filter Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {statusOptions.find((s) => s.value === statusFilter)?.label || "All Status"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {statusOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value)}
                      className={statusFilter === opt.value ? "bg-accent text-accent-foreground" : ""}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Date Range Filter Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {dateRangeOptions.find((d) => d.value === dateRange)?.label || "Date Range"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by Date</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {dateRangeOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setDateRange(opt.value)}
                      className={dateRange === opt.value ? "bg-accent text-accent-foreground" : ""}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Results info */}
            <p className="mb-4 text-sm text-muted-foreground">
              Showing {filteredBookings.length} booking{filteredBookings.length !== 1 ? "s" : ""}
            </p>

            <div className="space-y-4">
              {filteredBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="mb-4 h-12 w-12 text-muted-foreground/40" />
                  <h3 className="text-lg font-semibold text-foreground">No bookings found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters.</p>
                  <Button
                    variant="outline"
                    className="mt-4 bg-transparent"
                    onClick={() => {
                      setSearchQuery("")
                      setStatusFilter("all")
                      setDateRange("all")
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              ) : (
                filteredBookings.map((booking) => (
                  <div key={booking.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={booking.clientAvatar || "/placeholder.svg"} />
                          <AvatarFallback>{booking.artisanName.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div>
                            <h3 className="font-semibold text-foreground">{booking.serviceName}</h3>
                            <p className="text-sm text-muted-foreground">Booking ID: #{booking.id}</p>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src="/placeholder.svg" />
                                <AvatarFallback>{booking.artisanName.substring(0, 2)}</AvatarFallback>
                              </Avatar>
                              <span>{booking.artisanName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {booking.orderDate}
                            </div>
                            {booking.deadline && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                Due: {booking.deadline}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 md:items-end">
                        <Badge variant="outline" className={statusConfig[booking.status]?.className || ""}>
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                          {statusConfig[booking.status]?.label || booking.status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            booking.paymentStatus === "paid"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : booking.paymentStatus === "pending"
                                ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                                : "border-red-200 bg-red-50 text-red-700"
                          }
                        >
                          Payment:{" "}
                          {booking.paymentStatus === "paid"
                            ? "Paid"
                            : booking.paymentStatus === "pending"
                              ? "Pending"
                              : "Refunded"}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 border-t pt-4">
                      <Button variant="outline" size="sm" asChild className="bg-transparent">
                        <Link href={`/dashboard/user/bookings/${booking.id}`}>View Details</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="bg-transparent">
                        <Link href={`/dashboard/user/messages?artisan=${getArtisanIdForBooking(booking)}`}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Contact Artisan
                        </Link>
                      </Button>
                      {booking.status === "completed" && (
                        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                          <Link href={`/dashboard/user/review/${booking.id}`}>Leave Review</Link>
                        </Button>
                      )}
                      {booking.status === "pending" && (
                        <Button size="sm" variant="destructive" onClick={() => setCancelBookingId(booking.id)}>
                          Cancel Booking
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelBookingId} onOpenChange={(open) => !open && setCancelBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking? This action cannot be undone and any associated payment will be refunded.
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
