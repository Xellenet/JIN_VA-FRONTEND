"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
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
  Wrench,
  MessageSquare,
  Loader2,
  UserRound,
  Briefcase,
  AlertOctagon,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { naviiAvatar, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { getBookingStatusConfig } from "@/lib/status-badges"
import { DISPUTABLE_BOOKING_STATUSES } from "@/lib/disputes"
import { DisputeEntryPoint } from "@/components/disputes/dispute-entry-point"

interface BackendBooking {
  id: number
  scheduledDate: string
  startTime: string
  endTime: string
  status: string
  notes?: string
  artisanNotes?: string
  agreedPrice?: number
  currency?: string
  attachmentUrls?: string[]
  noShowByCustomerAt?: string | null
  noShowByArtisanAt?: string | null
  jobId?: number
  createdAt: string
  customer?: { id: number; firstname: string; lastname: string; profilePicture?: string }
  artisanProfile?: { id: number; businessName?: string; user?: { id: number; firstname: string; lastname: string; profilePicture?: string } }
  service?: { id: number; name: string }
}

function isPastEnd(booking: BackendBooking): boolean {
  const instant = new Date(`${booking.scheduledDate}T${booking.endTime}:00Z`)
  return Date.now() > instant.getTime()
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [booking, setBooking] = useState<BackendBooking | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isFlagging, setIsFlagging] = useState(false)

  useEffect(() => {
    apiFetch<BackendBooking>(`/bookings/${id}`)
      .then(setBooking)
      .catch(() => toast.error("Failed to load booking details."))
      .finally(() => setIsLoading(false))
  }, [id])

  const handleCancel = async () => {
    if (!booking) return
    setIsCancelling(true)
    try {
      await apiFetch(`/bookings/${booking.id}`, { method: "DELETE" })
      setBooking((prev) => prev ? { ...prev, status: "CANCELLED" } : prev)
      setShowCancelDialog(false)
      toast.success("Booking cancelled.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking.")
    } finally {
      setIsCancelling(false)
    }
  }

  // A6: available to either party once the scheduled end time has passed —
  // evaluated here just for UI visibility; the server independently
  // re-checks this against its own UTC clock at submit time (NFR (c)).
  const handleFlagNoShow = async () => {
    if (!booking) return
    setIsFlagging(true)
    try {
      const res = await apiFetch<{ message?: string }>(`/bookings/${booking.id}/no-show`, { method: "PATCH" })
      setBooking((prev) => prev ? { ...prev, status: "NO_SHOW", noShowByCustomerAt: new Date().toISOString() } : prev)
      toast.success(res?.message ?? "Marked as a no-show.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to flag no-show.")
    } finally {
      setIsFlagging(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!booking) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">Booking not found.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/dashboard/user/bookings">Back to Bookings</Link>
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const artisanName = booking.artisanProfile?.user
    ? `${booking.artisanProfile.user.firstname} ${booking.artisanProfile.user.lastname}`.trim()
    : booking.artisanProfile?.businessName ?? "Artisan"

  const cfg = getBookingStatusConfig(booking.status)
  const canCancel = booking.status === "PENDING" || booking.status === "CONFIRMED"
  const canFlagNoShow = booking.status === "CONFIRMED" && isPastEnd(booking) && !booking.noShowByCustomerAt

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/user/bookings">
            <ArrowLeft className="h-4 w-4" />
            Back to Bookings
          </Link>
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{booking.service?.name ?? "Booking"}</h1>
            <p className="text-muted-foreground">
              Booking #{booking.id} · Requested {new Date(booking.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <Badge variant="outline" className={cfg.className}>
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
            {cfg.label}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <Wrench className="h-4 w-4 text-primary" />
                  Appointment Details
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Service</p>
                    <p className="mt-1 font-medium text-foreground">{booking.service?.name ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Agreed Price</p>
                    <p className="mt-1 font-medium text-foreground">
                      {booking.agreedPrice != null ? formatCurrency(booking.agreedPrice) : "Not specified"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-primary/5 p-4 md:col-span-2">
                    <p className="text-xs text-muted-foreground">Scheduled Date &amp; Time</p>
                    <div className="mt-1 flex flex-wrap items-center gap-4">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        {new Date(booking.scheduledDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        {booking.startTime} – {booking.endTime}
                      </span>
                    </div>
                  </div>
                </div>

                {booking.notes && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Your notes:</p>
                    <p className="mt-1 leading-relaxed">{booking.notes}</p>
                  </div>
                )}
                {booking.artisanNotes && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Artisan&apos;s notes:</p>
                    <p className="mt-1 leading-relaxed">{booking.artisanNotes}</p>
                  </div>
                )}

                {(booking.noShowByCustomerAt || booking.noShowByArtisanAt) && (
                  <div className="mt-4 space-y-1 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertOctagon className="h-3.5 w-3.5" />
                      No-show flagged
                    </p>
                    {booking.noShowByCustomerAt && <p>You flagged the artisan as a no-show.</p>}
                    {booking.noShowByArtisanAt && <p>The artisan flagged you as a no-show.</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            {booking.attachmentUrls && booking.attachmentUrls.length > 0 && (
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="font-semibold text-foreground">Attached Photos</h3>
                </div>
                <CardContent className="flex flex-wrap gap-3 p-5">
                  {booking.attachmentUrls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="Booking attachment" className="h-20 w-20 rounded-lg border border-border object-cover" />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <UserRound className="h-4 w-4 text-primary" />
                  Artisan
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={booking.artisanProfile?.user?.profilePicture || naviiAvatar(artisanName)} />
                    <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-foreground">{artisanName}</h4>
                    {booking.artisanProfile?.businessName && (
                      <p className="text-sm text-muted-foreground">{booking.artisanProfile.businessName}</p>
                    )}
                  </div>
                </div>
                {booking.artisanProfile?.user && (
                  <div className="mt-4">
                    <Button variant="outline" className="w-full bg-transparent" size="sm" asChild>
                      {/* MC2 — `&booking=` rides along so the message carries a
                          reference to this booking (feeds AD1's evidence view). */}
                      <Link href={`/dashboard/user/messages?artisan=${booking.artisanProfile.user.id}&booking=${booking.id}`}>
                        <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                        Message Artisan
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 p-5">
                {booking.jobId && (
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href={`/dashboard/user/jobs/${booking.jobId}`}>
                      <Briefcase className="mr-2 h-4 w-4" />
                      View Linked Job
                    </Link>
                  </Button>
                )}
                {canFlagNoShow && (
                  <Button
                    variant="outline"
                    className="w-full border-orange-300 bg-transparent text-orange-700 hover:bg-orange-50"
                    onClick={handleFlagNoShow}
                    disabled={isFlagging}
                  >
                    {isFlagging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <AlertOctagon className="mr-2 h-4 w-4" />
                    Mark Artisan as No-show
                  </Button>
                )}
                {/* DP1: last in the constructive group — a report is a real
                    option, not the first thing on offer. */}
                <DisputeEntryPoint
                  bookingId={booking.id}
                  isEligible={(DISPUTABLE_BOOKING_STATUSES as readonly string[]).includes(booking.status)}
                  ineligibleReason="You can report a problem once the booking is completed or cancelled."
                  contextTitle={booking.service?.name ?? `Booking #${booking.id}`}
                  counterpartyName={artisanName}
                  counterpartyRole="Artisan"
                  counterpartyAvatar={booking.artisanProfile?.user?.profilePicture}
                  contextDate={booking.scheduledDate}
                  amount={booking.agreedPrice}
                  disputeHrefBase="/dashboard/user/disputes"
                />
                {canCancel && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancel Booking
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
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
              onClick={handleCancel}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isCancelling}
            >
              {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
