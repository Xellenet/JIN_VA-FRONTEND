"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Loader2,
  Search,
  SearchX,
  UserX,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { apiFetch } from "@/lib/api"
import { formatDayWithWeekday, initialsOf } from "@/lib/artisan-jobs"
import { getBookingStatusConfig } from "@/lib/status-badges"
import { cn, formatClockTime, formatCurrency, resolveAvatarUrl } from "@/lib/utils"

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

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Declined", value: "DECLINED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "No-show", value: "NO_SHOW" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Completed", value: "COMPLETED" },
]

/** An icon beside each badge, so status never reads by colour alone. */
const STATUS_ICONS: Record<string, typeof CircleDot> = {
  PENDING: CalendarClock,
  CONFIRMED: CalendarCheck,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  DECLINED: Ban,
  EXPIRED: CalendarX,
  NO_SHOW: UserX,
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"
const selectClass = cn(
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground sm:h-9 dark:bg-input/30",
  focusRing,
)

function artisanNameOf(b: BackendBooking): string {
  const u = b.artisanProfile?.user
  return u ? `${u.firstname} ${u.lastname}`.trim() : (b.artisanProfile?.businessName ?? "Artisan")
}

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
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [cancelBookingId, setCancelBookingId] = useState<number | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    setLoadFailed(false)
    apiFetch<BackendBooking[] | { items?: BackendBooking[] }>("/bookings/my?limit=100")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setBookings(items)
      })
      .catch(() => {
        setBookings([])
        setLoadFailed(true)
      })
      .finally(() => setIsLoading(false))
  }, [reloadKey])

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return bookings.filter((b) => {
      const matchesSearch =
        !q ||
        (b.service?.name ?? "").toLowerCase().includes(q) ||
        artisanNameOf(b).toLowerCase().includes(q) ||
        String(b.id).includes(q)
      const matchesStatus = statusFilter === "all" || b.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [bookings, searchQuery, statusFilter])

  const filtersOn = Boolean(searchQuery.trim()) || statusFilter !== "all"
  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
  }
  const listTitle =
    statusFilter === "all"
      ? "All bookings"
      : `${STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label ?? "Matching"} bookings`

  const handleCancelBooking = async () => {
    if (cancelBookingId == null) return
    setIsCancelling(true)
    try {
      await apiFetch(`/bookings/${cancelBookingId}`, { method: "DELETE" })
      setBookings((prev) => prev.map((b) => (b.id === cancelBookingId ? { ...b, status: "CANCELLED" } : b)))
      toast.success("Booking cancelled.")
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
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
          <p className="mt-1 text-muted-foreground">Track the booking requests you&apos;ve sent to artisans.</p>
        </div>

        <section aria-labelledby="booking-list-title" className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5">
            <h2 id="booking-list-title" className="text-[15px] font-semibold text-foreground">
              {listTitle}
            </h2>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,18rem)_minmax(0,12rem)_auto] sm:items-end">
              <div className="space-y-1">
                <Label htmlFor="booking-search" className="text-xs text-muted-foreground">
                  Search
                </Label>
                <div className="relative">
                  <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="booking-search"
                    type="search"
                    placeholder="Service, artisan or booking number"
                    className="h-11 pl-9 sm:h-9"
                    maxLength={100}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="booking-status" className="text-xs text-muted-foreground">
                  Status
                </Label>
                <select
                  id="booking-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={selectClass}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {filtersOn && (
                <Button variant="ghost" className="h-11 w-fit gap-1.5 text-muted-foreground sm:h-9" onClick={clearFilters}>
                  <X aria-hidden className="h-4 w-4" />
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <SkeletonRows />
          ) : loadFailed ? (
            <div role="alert" className="flex flex-col items-center px-4 py-12 text-center">
              <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
              </span>
              <p className="font-medium text-foreground">Couldn&apos;t load your bookings</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Check your connection, then try again.</p>
              <Button variant="outline" className="mt-5 h-11 bg-transparent sm:h-9" onClick={() => setReloadKey((k) => k + 1)}>
                Try again
              </Button>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center sm:px-5">
              <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-dashed text-muted-foreground">
                <SearchX className="h-5 w-5" />
              </span>
              <p className="font-medium text-foreground">{filtersOn ? "No bookings match these filters" : "No bookings yet"}</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {filtersOn ? "Try another search or status." : "Book an artisan from their profile and your requests show up here."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {filtersOn ? (
                  <Button variant="outline" className="h-11 bg-transparent sm:h-9" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button className="h-11 sm:h-9" asChild>
                    <Link href="/dashboard/user/search">Find an artisan</Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <ul className="divide-y">
                {filteredBookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} onCancel={() => setCancelBookingId(booking.id)} />
                ))}
              </ul>
              <div className="border-t px-4 py-3 sm:px-5">
                <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
                  {filtersOn
                    ? `${filteredBookings.length} of ${bookings.length} ${bookings.length === 1 ? "booking" : "bookings"}`
                    : `${bookings.length} ${bookings.length === 1 ? "booking" : "bookings"}`}
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      <AlertDialog open={cancelBookingId != null} onOpenChange={(open) => !open && setCancelBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              The artisan will be told you&apos;ve cancelled the request. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9" disabled={isCancelling}>
              Keep booking
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              className="h-11 bg-destructive text-white hover:bg-destructive/90 sm:h-9"
              disabled={isCancelling}
            >
              {isCancelling ? <Loader2 aria-hidden className="mr-2 h-4 w-4 motion-safe:animate-spin" /> : null}
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

function BookingRow({ booking, onCancel }: { booking: BackendBooking; onCancel: () => void }) {
  const artisanName = artisanNameOf(booking)
  const cfg = getBookingStatusConfig(booking.status)
  const StatusIcon = STATUS_ICONS[booking.status] ?? CircleDot
  const href = `/dashboard/user/bookings/${encodeURIComponent(String(booking.id))}`
  const canCancel = booking.status === "PENDING" || booking.status === "CONFIRMED"
  const picture = booking.artisanProfile?.user?.profilePicture

  return (
    <li className="group relative px-4 py-4 transition-colors duration-150 hover:bg-muted/40 motion-reduce:transition-none sm:px-5">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          {picture ? <AvatarImage src={resolveAvatarUrl(picture)} alt="" /> : null}
          <AvatarFallback className="text-xs font-medium text-foreground/80">{initialsOf(artisanName) || "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <h3 className="min-w-0 font-medium text-foreground">
              {/* The title link covers the row, so the whole row opens the booking. */}
              <Link
                href={href}
                className={cn("rounded-sm after:absolute after:inset-0 after:content-[''] group-hover:text-primary", focusRing)}
              >
                {booking.service?.name ?? "Service booking"}
              </Link>
            </h3>
            <Badge variant="outline" className={cn("w-fit shrink-0 text-xs", cfg.className)}>
              <StatusIcon aria-hidden className="mr-1 h-3 w-3" />
              {cfg.label}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            With <span dir="auto" className="[unicode-bidi:isolate]">{artisanName}</span>, booking #{booking.id}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays aria-hidden className="h-3.5 w-3.5 shrink-0" />
              {formatDayWithWeekday(booking.scheduledDate)}
            </span>
            <span className="flex items-center gap-1.5 tabular-nums">
              <Clock aria-hidden className="h-3.5 w-3.5 shrink-0" />
              {formatClockTime(booking.startTime)}–{formatClockTime(booking.endTime)}
            </span>
            {booking.agreedPrice != null && <span className="tabular-nums">{formatCurrency(booking.agreedPrice)}</span>}
          </div>

          {(booking.jobId || canCancel) && (
            <div className="relative z-10 mt-3 flex flex-wrap gap-2">
              {booking.jobId ? (
                <Button variant="outline" className="h-11 bg-transparent sm:h-9" asChild>
                  <Link href={`/dashboard/user/jobs/${booking.jobId}`}>View job</Link>
                </Button>
              ) : null}
              {canCancel && (
                <Button
                  variant="outline"
                  className="h-11 border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9"
                  onClick={onCancel}
                >
                  Cancel booking
                </Button>
              )}
            </div>
          )}
        </div>
        <ChevronRight
          aria-hidden
          className="mt-3 hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none sm:block"
        />
      </div>
    </li>
  )
}

function SkeletonRows() {
  return (
    <ul aria-hidden className="divide-y">
      {["w-2/5", "w-1/3", "w-1/2"].map((w, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className={cn("h-3.5 rounded bg-muted motion-safe:animate-pulse", w)} />
            <div className="h-3 w-1/4 rounded bg-muted motion-safe:animate-pulse" />
          </div>
          <div className="hidden h-5 w-20 rounded-md bg-muted motion-safe:animate-pulse sm:block" />
        </li>
      ))}
    </ul>
  )
}
