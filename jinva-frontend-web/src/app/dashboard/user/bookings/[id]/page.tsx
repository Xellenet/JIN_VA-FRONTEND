"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  CheckCircle,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { formatClockTime, formatCurrency, toClockTime } from "@/lib/utils"
import { toast } from "sonner"
import { getBookingStatusConfig } from "@/lib/status-badges"
import { DISPUTABLE_BOOKING_STATUSES } from "@/lib/disputes"
import { DisputeEntryPoint } from "@/components/disputes/dispute-entry-point"
import { AttachmentGallery } from "@/components/dashboard/attachment-gallery"
import { threeLetterMonth } from "@/lib/spending"
import { ArtisanIdentity } from "@/components/dashboard/artisan-identity"

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
  const instant = new Date(`${booking.scheduledDate}T${toClockTime(booking.endTime)}Z`)
  return Date.now() > instant.getTime()
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [booking, setBooking] = useState<BackendBooking | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isFlagging, setIsFlagging] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

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

  // QA BK-23: completing the booking also completes its job; for a paid job
  // that releases the artisan's money, so the server only allows it once the
  // artisan has started and marked the work finished.
  const handleComplete = async () => {
    if (!booking) return
    setIsCompleting(true)
    try {
      await apiFetch(`/bookings/${booking.id}/complete`, { method: "PATCH" })
      setBooking((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev))
      setShowCompleteDialog(false)
      toast.success("Booking marked as completed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete this booking.")
    } finally {
      setIsCompleting(false)
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
          <Loader2 aria-label="Loading booking" className="h-8 w-8 text-muted-foreground motion-safe:animate-spin" />
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
            <Link href="/dashboard/user/bookings">Back to bookings</Link>
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
        <Button variant="ghost" asChild className="h-11 gap-2 text-muted-foreground hover:text-foreground sm:h-9">
          <Link href="/dashboard/user/bookings">
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Back to bookings
          </Link>
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{booking.service?.name ?? "Booking"}</h1>
            <p className="text-muted-foreground">
              Booking #{booking.id} · Requested {threeLetterMonth(new Date(booking.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}
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
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <Wrench aria-hidden className="h-4 w-4 text-primary" />
                  Appointment details
                </h2>
              </div>
              <CardContent className="p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Service</p>
                    <p className="mt-1 font-medium text-foreground">{booking.service?.name ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Agreed price</p>
                    <p className="mt-1 font-medium text-foreground">
                      {booking.agreedPrice != null ? formatCurrency(booking.agreedPrice) : "Not specified"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-primary/5 p-4 md:col-span-2">
                    <p className="text-xs text-muted-foreground">Scheduled date and time</p>
                    <div className="mt-1 flex flex-wrap items-center gap-4">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Calendar aria-hidden className="h-3.5 w-3.5 text-primary" />
                        {threeLetterMonth(new Date(booking.scheduledDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" }))}
                      </span>
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Clock aria-hidden className="h-3.5 w-3.5 text-primary" />
                        {formatClockTime(booking.startTime)} – {formatClockTime(booking.endTime)}
                      </span>
                    </div>
                  </div>
                </div>

                {booking.notes && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Your notes</p>
                    <p className="mt-1 leading-relaxed">{booking.notes}</p>
                  </div>
                )}
                {booking.artisanNotes && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Artisan&apos;s notes</p>
                    <p className="mt-1 leading-relaxed">{booking.artisanNotes}</p>
                  </div>
                )}

                {(booking.noShowByCustomerAt || booking.noShowByArtisanAt) && (
                  <div className="mt-4 space-y-1 rounded-lg border border-attention/20 bg-attention/10 p-4 text-sm text-attention">
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
                  <h2 className="font-semibold text-foreground">Attached photos</h2>
                </div>
                <CardContent className="p-5">
                  {/* QA MSG-18: private photos, loaded with the signed-in request. */}
                  <AttachmentGallery
                    attachments={booking.attachmentUrls.map((url, i) => ({
                      id: i + 1,
                      url,
                      fileType: "",
                      createdAt: booking.createdAt,
                    }))}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <div className="border-b border-border p-5">
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <UserRound aria-hidden className="h-4 w-4 text-primary" />
                  Artisan
                </h2>
              </div>
              <CardContent className="p-5">
                {/* The whole avatar and name block opens the artisan's public profile. */}
                <ArtisanIdentity
                  profileId={booking.artisanProfile?.id}
                  name={artisanName}
                  picture={booking.artisanProfile?.user?.profilePicture}
                  avatarClassName="h-14 w-14"
                  nameClassName="font-semibold"
                  subtitle={
                    booking.artisanProfile?.businessName && booking.artisanProfile.businessName !== artisanName
                      ? booking.artisanProfile.businessName
                      : undefined
                  }
                />
                {booking.artisanProfile?.user && (
                  <div className="mt-4">
                    <Button variant="outline" className="h-11 w-full bg-transparent sm:h-9" asChild>
                      {/* MC2 — `&booking=` rides along so the message carries a
                          reference to this booking (feeds AD1's evidence view). */}
                      <Link href={`/dashboard/user/messages?artisan=${booking.artisanProfile.user.id}&booking=${booking.id}`}>
                        <MessageSquare aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                        Message artisan
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 p-5">
                {booking.jobId && (
                  <Button className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:h-9" asChild>
                    <Link href={`/dashboard/user/jobs/${booking.jobId}`}>
                      <Briefcase aria-hidden className="mr-2 h-4 w-4" />
                      View linked job
                    </Link>
                  </Button>
                )}
                {booking.status === "CONFIRMED" && (
                  <Button
                    variant="outline"
                    className="h-11 w-full bg-transparent sm:h-9"
                    onClick={() => setShowCompleteDialog(true)}
                  >
                    <CheckCircle aria-hidden className="mr-2 h-4 w-4" />
                    Mark as completed
                  </Button>
                )}
                {canFlagNoShow && (
                  <Button
                    variant="outline"
                    className="h-11 w-full border-attention/40 bg-transparent text-attention hover:bg-attention/10 sm:h-9"
                    onClick={handleFlagNoShow}
                    disabled={isFlagging}
                  >
                    {isFlagging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <AlertOctagon aria-hidden className="mr-2 h-4 w-4" />
                    Mark artisan as a no-show
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
                    className="h-11 w-full sm:h-9"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancel booking
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={showCompleteDialog} onOpenChange={(open) => !isCompleting && setShowCompleteDialog(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this booking as completed?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm the work is done. If you paid through JinVa, this releases the payment to the artisan and
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCompleting}>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleComplete()
              }}
              disabled={isCompleting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isCompleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, it&apos;s done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9" disabled={isCancelling}>No, keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="h-11 bg-destructive text-white hover:bg-destructive/90 sm:h-9"
              disabled={isCancelling}
            >
              {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
