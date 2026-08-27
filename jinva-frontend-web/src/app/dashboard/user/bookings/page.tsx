"use client"

import { useState, useMemo, useEffect } from "react"
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
import { Calendar, Clock, Search, ChevronDown, Loader2, UserRound, Wrench } from "lucide-react"
import { formatCurrency, resolveAvatarUrl } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { getBookingStatusConfig } from "@/lib/status-badges"

interface BackendBooking {
  id: number
  scheduledDate: string
  startTime: string
  endTime: string
  status: string
  agreedPrice?: number
  currency?: string
  createdAt: string
  artisanProfile?: { id: number; businessName?: string; user?: { id: number; firstname: string; lastname: string; profilePicture?: string } }
  service?: { id: number; name: string }
  jobId?: number
}

const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Declined", value: "DECLINED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "No-show", value: "NO_SHOW" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Completed", value: "COMPLETED" },
]

/**
 * Decisions #2: this is now a real, standalone bookings list — pending,
 * confirmed, declined, expired, no-show, cancelled, and completed *booking
 * requests* only, read from `GET /bookings/my`. Job progress (once a booking
 * is confirmed and a Job is created/linked, R2) lives on its own separate
 * page at /dashboard/user/jobs — this list must never fold that back in.
 */
export default function UserBookingsPage() {
  const [bookings, setBookings] = useState<BackendBooking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [cancelBookingId, setCancelBookingId] = useState<number | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    apiFetch<BackendBooking[] | { items?: BackendBooking[] }>("/bookings/my?limit=100")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setBookings(items)
      })
      .catch(() => setBookings([]))
      .finally(() => setIsLoading(false))
  }, [])

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const artisanName = b.artisanProfile?.user
        ? `${b.artisanProfile.user.firstname} ${b.artisanProfile.user.lastname}`
        : b.artisanProfile?.businessName ?? ""
      const matchesSearch =
        !searchQuery ||
        (b.service?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        artisanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(b.id).includes(searchQuery)
      const matchesStatus = statusFilter === "all" || b.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [bookings, searchQuery, statusFilter])

  const canCancel = (status: string) => status === "PENDING" || status === "CONFIRMED"

  const handleCancelBooking = async () => {
    if (cancelBookingId == null) return
    setIsCancelling(true)
    try {
      await apiFetch(`/bookings/${cancelBookingId}`, { method: "DELETE" })
      setBookings((prev) =>
        prev.map((b) => (b.id === cancelBookingId ? { ...b, status: "CANCELLED" } : b))
      )
      toast.success("Booking cancelled successfully.")
    } catch (err) {
      // R2 edge case: DELETE /bookings/:id is blocked once the linked job has
      // progressed past PENDING — the backend's message already names the
      // correct next step (use the job's own cancel action).
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking.")
    } finally {
      setIsCancelling(false)
      setCancelBookingId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
          <p className="text-muted-foreground">Track the status of your booking requests with artisans</p>
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {statusOptions.find((s) => s.value === statusFilter)?.label ?? "All Status"}
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
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Showing {filteredBookings.length} booking{filteredBookings.length !== 1 ? "s" : ""}
            </p>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="mb-4 h-12 w-12 text-muted-foreground/40" />
                    <h3 className="text-lg font-semibold text-foreground">No bookings found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {bookings.length === 0
                        ? "Book an artisan directly from their profile to see requests here."
                        : "Try adjusting your search or filters."}
                    </p>
                    {bookings.length > 0 && (
                      <Button
                        variant="outline"
                        className="mt-4 bg-transparent"
                        onClick={() => { setSearchQuery(""); setStatusFilter("all") }}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredBookings.map((booking) => {
                    const artisanName = booking.artisanProfile?.user
                      ? `${booking.artisanProfile.user.firstname} ${booking.artisanProfile.user.lastname}`.trim()
                      : booking.artisanProfile?.businessName ?? "Artisan"
                    const cfg = getBookingStatusConfig(booking.status)
                    return (
                      <div key={booking.id} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-14 w-14">
                              <AvatarImage src={resolveAvatarUrl(booking.artisanProfile?.user?.profilePicture, artisanName)} />
                              <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground">{booking.service?.name ?? "Service booking"}</h3>
                              <p className="text-sm text-muted-foreground">with {artisanName} · Booking #{booking.id}</p>
                              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-4 w-4" />
                                  {new Date(booking.scheduledDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  {booking.startTime} – {booking.endTime}
                                </div>
                                {booking.agreedPrice != null && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Wrench className="h-4 w-4" />
                                    {formatCurrency(booking.agreedPrice)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 md:items-end">
                            <Badge variant="outline" className={cfg.className}>
                              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                              {cfg.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                          <Button variant="outline" size="sm" asChild className="bg-transparent">
                            <Link href={`/dashboard/user/bookings/${booking.id}`}>View Details</Link>
                          </Button>
                          {booking.jobId && (
                            <Button variant="outline" size="sm" asChild className="bg-transparent">
                              <Link href={`/dashboard/user/jobs/${booking.jobId}`}>View Job</Link>
                            </Button>
                          )}
                          {canCancel(booking.status) && (
                            <Button size="sm" variant="destructive" onClick={() => setCancelBookingId(booking.id)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={cancelBookingId != null} onOpenChange={(open) => !open && setCancelBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>No, Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isCancelling}
            >
              {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
