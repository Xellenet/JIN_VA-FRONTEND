"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar as CalendarWidget } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  CalendarDays,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  Loader2,
  CalendarOff,
  CalendarClock,
  UserRound,
  Check,
  X,
  AlertOctagon,
  Briefcase,
} from "lucide-react"
import { cn, formatCurrency, resolveAvatarUrl } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { getBookingStatusConfig } from "@/lib/status-badges"

// 0=Sunday … 6=Saturday
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const STATUS_OPTIONS = [
  { value: "AVAILABLE",   label: "Available" },
  { value: "BUSY",        label: "Busy" },
  { value: "UNAVAILABLE", label: "Unavailable" },
]

interface ApiSlot {
  id: number
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

interface ApiAvailability {
  artisanProfileId: number
  status: string
  slots: ApiSlot[]
}

interface ApiBlock {
  id: number
  startDate: string
  endDate: string
  reason?: string
  createdAt: string
}

interface ApiBooking {
  id: number
  scheduledDate: string
  startTime: string
  endTime: string
  status: string
  agreedPrice?: number
  currency?: string
  jobId?: number
  noShowByCustomerAt?: string | null
  noShowByArtisanAt?: string | null
  customer?: { id: number; firstname: string; lastname: string; profilePicture?: string }
  service?: { id: number; name: string }
}

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isBookingPastEnd(b: ApiBooking): boolean {
  return Date.now() > new Date(`${b.scheduledDate}T${b.endTime}:00Z`).getTime()
}

export default function ArtisanCalendarPage() {
  const [status, setStatus] = useState("AVAILABLE")
  const [slots, setSlots] = useState<ApiSlot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // New slot form
  const [newDay, setNewDay] = useState("1")
  const [newStart, setNewStart] = useState("08:00")
  const [newEnd, setNewEnd] = useState("17:00")
  const [isAddingSlot, setIsAddingSlot] = useState(false)

  // A1: blocked dates / time-off
  const [blocks, setBlocks] = useState<ApiBlock[]>([])
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true)
  const [blockStart, setBlockStart] = useState("")
  const [blockEnd, setBlockEnd] = useState("")
  const [blockReason, setBlockReason] = useState("")
  const [isAddingBlock, setIsAddingBlock] = useState(false)
  const [deletingBlockId, setDeletingBlockId] = useState<number | null>(null)

  // A3: upcoming bookings + accept/decline/no-show
  const [bookings, setBookings] = useState<ApiBooking[]>([])
  const [isLoadingBookings, setIsLoadingBookings] = useState(true)
  const [bookingsLoadFailed, setBookingsLoadFailed] = useState(false)
  const [selectedBookingDate, setSelectedBookingDate] = useState<Date | undefined>(undefined)
  const [respondingId, setRespondingId] = useState<number | null>(null)
  const [declineTargetId, setDeclineTargetId] = useState<number | null>(null)

  useEffect(() => {
    apiFetch<ApiAvailability>("/availability/my")
      .then((data) => {
        setStatus(data.status ?? "AVAILABLE")
        setSlots(data.slots ?? [])
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const fetchBlocks = () => {
    setIsLoadingBlocks(true)
    apiFetch<ApiBlock[] | { items?: ApiBlock[] }>("/availability/my/blocks")
      .then((data) => setBlocks(Array.isArray(data) ? data : (data.items ?? [])))
      .catch(() => {})
      .finally(() => setIsLoadingBlocks(false))
  }

  const fetchBookings = () => {
    setIsLoadingBookings(true)
    setBookingsLoadFailed(false)
    apiFetch<ApiBooking[] | { items?: ApiBooking[] }>("/bookings/artisan?limit=100")
      .then((data) => setBookings(Array.isArray(data) ? data : (data.items ?? [])))
      .catch(() => setBookingsLoadFailed(true))
      .finally(() => setIsLoadingBookings(false))
  }

  useEffect(() => {
    fetchBlocks()
    fetchBookings()
  }, [])

  const saveStatus = async () => {
    setIsSavingStatus(true)
    try {
      await apiFetch("/availability/my/status", {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
      toast.success("Availability status updated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.")
    } finally {
      setIsSavingStatus(false)
    }
  }

  const toggleSlotActive = async (slot: ApiSlot) => {
    try {
      await apiFetch(`/availability/my/slots/${slot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !slot.isActive }),
      })
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, isActive: !s.isActive } : s)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update slot.")
    }
  }

  const deleteSlot = async (id: number) => {
    setDeletingId(id)
    try {
      await apiFetch(`/availability/my/slots/${id}`, { method: "DELETE" })
      setSlots((prev) => prev.filter((s) => s.id !== id))
      toast.success("Slot removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove slot.")
    } finally {
      setDeletingId(null)
    }
  }

  const addSlot = async () => {
    if (!newStart || !newEnd) { toast.error("Please fill in start and end times."); return }
    if (newEnd <= newStart) { toast.error("End time must be after start time."); return }
    setIsAddingSlot(true)
    try {
      const created = await apiFetch<ApiSlot>("/availability/my/slots", {
        method: "POST",
        body: JSON.stringify({
          dayOfWeek: Number(newDay),
          startTime: newStart,
          endTime: newEnd,
          isActive: true,
        }),
      })
      setSlots((prev) => [...prev, created])
      toast.success("Slot added.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add slot.")
    } finally {
      setIsAddingSlot(false)
    }
  }

  // ─── A1: block time off ────────────────────────────────────────────────────
  const addBlock = async () => {
    if (!blockStart || !blockEnd) { toast.error("Please choose a start and end date."); return }
    if (blockEnd < blockStart) { toast.error("End date must be on or after the start date."); return }
    setIsAddingBlock(true)
    try {
      const created = await apiFetch<ApiBlock>("/availability/my/blocks", {
        method: "POST",
        body: JSON.stringify({
          startDate: blockStart,
          endDate: blockEnd,
          reason: blockReason.trim() || undefined,
        }),
      })
      setBlocks((prev) => [...prev, created])
      setBlockStart("")
      setBlockEnd("")
      setBlockReason("")
      toast.success("Time off blocked. Customers won't be able to request slots in this range.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to block this date range.")
    } finally {
      setIsAddingBlock(false)
    }
  }

  const deleteBlock = async (id: number) => {
    setDeletingBlockId(id)
    try {
      await apiFetch(`/availability/my/blocks/${id}`, { method: "DELETE" })
      setBlocks((prev) => prev.filter((b) => b.id !== id))
      toast.success("Block removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove block.")
    } finally {
      setDeletingBlockId(null)
    }
  }

  // ─── A3: accept / decline / no-show ────────────────────────────────────────
  const handleAccept = async (booking: ApiBooking) => {
    setRespondingId(booking.id)
    try {
      const result = await apiFetch<{ jobId: number }>(`/bookings/${booking.id}/confirm`, {
        method: "PATCH",
        body: JSON.stringify({}),
      })
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: "CONFIRMED", jobId: result?.jobId } : b)),
      )
      toast.success("Booking confirmed. A job has been created for this appointment.")
    } catch (err) {
      // A3 edge case: the request may have already auto-expired (A5) or the
      // artisan's own account may be suspended — the backend's message
      // already distinguishes these from a generic failure.
      toast.error(err instanceof Error ? err.message : "Failed to confirm this booking.")
    } finally {
      setRespondingId(null)
    }
  }

  const handleDecline = async () => {
    if (declineTargetId == null) return
    setRespondingId(declineTargetId)
    try {
      await apiFetch(`/bookings/${declineTargetId}/decline`, {
        method: "PATCH",
        body: JSON.stringify({}),
      })
      setBookings((prev) => prev.map((b) => (b.id === declineTargetId ? { ...b, status: "DECLINED" } : b)))
      toast.success("Booking declined.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decline this booking.")
    } finally {
      setRespondingId(null)
      setDeclineTargetId(null)
    }
  }

  const handleFlagNoShow = async (booking: ApiBooking) => {
    setRespondingId(booking.id)
    try {
      const res = await apiFetch<{ message?: string }>(`/bookings/${booking.id}/no-show`, { method: "PATCH" })
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: "NO_SHOW", noShowByArtisanAt: new Date().toISOString() } : b)),
      )
      toast.success(res?.message ?? "Marked as a no-show.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to flag no-show.")
    } finally {
      setRespondingId(null)
    }
  }

  const slotsByDay = DAY_NAMES.map((day, idx) => ({
    day,
    dayOfWeek: idx,
    slots: slots.filter((s) => s.dayOfWeek === idx),
  }))

  // Upcoming = PENDING or CONFIRMED (matches A3's own scope); NO_SHOW is kept
  // visible too, since it's just been transitioned from CONFIRMED and both
  // parties should still see it reflected here immediately after flagging.
  const relevantBookings = useMemo(
    () => bookings.filter((b) => ["PENDING", "CONFIRMED", "NO_SHOW"].includes(b.status)),
    [bookings],
  )

  const bookingDatesSet = useMemo(() => new Set(relevantBookings.map((b) => b.scheduledDate)), [relevantBookings])

  const displayedBookings = useMemo(() => {
    const list = selectedBookingDate
      ? relevantBookings.filter((b) => b.scheduledDate === toDateKey(selectedBookingDate))
      : relevantBookings
    return [...list].sort((a, b) => (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime))
  }, [relevantBookings, selectedBookingDate])

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Availability</h1>
            <p className="text-sm text-muted-foreground">
              Set your availability status, working hours, and time off
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {/* Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Availability Status
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Current Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                  onClick={saveStatus}
                  disabled={isSavingStatus}
                >
                  {isSavingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Status"}
                </Button>
              </CardContent>
            </Card>

            {/* Working Hours */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Working Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                {slotsByDay.map(({ day, dayOfWeek, slots: daySlots }) => (
                  <div key={day} className="py-3">
                    <p className="mb-2 text-sm font-medium text-foreground">{day}</p>
                    {daySlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No slots — add one below</p>
                    ) : (
                      <div className="space-y-2">
                        {daySlots.map((slot) => (
                          <div
                            key={slot.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border px-3 py-2",
                              !slot.isActive && "opacity-50",
                            )}
                          >
                            <Switch
                              checked={slot.isActive}
                              onCheckedChange={() => toggleSlotActive(slot)}
                            />
                            <span className="flex-1 text-sm text-foreground">
                              {slot.startTime} – {slot.endTime}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              disabled={deletingId === slot.id}
                              onClick={() => deleteSlot(slot.id)}
                            >
                              {deletingId === slot.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Add Slot */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Add Working Slot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Day</Label>
                    <Select value={newDay} onValueChange={setNewDay}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.map((name, idx) => (
                          <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Time</Label>
                    <Input
                      type="time"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Time</Label>
                    <Input
                      type="time"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 bg-transparent"
                  onClick={addSlot}
                  disabled={isAddingSlot}
                >
                  {isAddingSlot
                    ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    : <Plus className="mr-2 h-3.5 w-3.5" />
                  }
                  Add Slot
                </Button>
              </CardContent>
            </Card>

            {/* A1: Blocked dates / time off */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarOff className="h-4 w-4 text-primary" />
                  Block Time Off
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingBlocks ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : blocks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No time off blocked — add a range below.</p>
                ) : (
                  <div className="space-y-2">
                    {blocks.map((block) => (
                      <div key={block.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                        <div className="flex-1">
                          <p className="text-sm text-foreground">
                            {new Date(block.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            {" – "}
                            {new Date(block.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {block.reason && <p className="text-xs text-muted-foreground">{block.reason}</p>}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={deletingBlockId === block.id}
                          onClick={() => deleteBlock(block.id)}
                          aria-label="Remove block"
                        >
                          {deletingBlockId === block.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Date</Label>
                    <Input type="date" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Date</Label>
                    <Input type="date" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Reason (optional)</Label>
                    <Textarea
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="e.g. Personal time off, public holiday…"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent"
                  onClick={addBlock}
                  disabled={isAddingBlock}
                >
                  {isAddingBlock
                    ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    : <Plus className="mr-2 h-3.5 w-3.5" />
                  }
                  Block Dates
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right column — summary */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Current Status</p>
                <p className="mt-1 font-medium text-foreground capitalize">{status.toLowerCase()}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total Slots</p>
                <p className="mt-1 font-medium text-foreground">{slots.length} defined</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Active Slots</p>
                <p className="mt-1 font-medium text-foreground">
                  {slots.filter((s) => s.isActive).length} active
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Days Available</p>
                <p className="mt-1 text-sm text-foreground">
                  {Array.from(new Set(slots.filter((s) => s.isActive).map((s) => s.dayOfWeek)))
                    .sort()
                    .map((d) => DAY_NAMES[d].slice(0, 3))
                    .join(", ") || "None"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Blocked Ranges</p>
                <p className="mt-1 font-medium text-foreground">{blocks.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Pending Booking Requests</p>
                <p className="mt-1 font-medium text-foreground">
                  {bookings.filter((b) => b.status === "PENDING").length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* A3: upcoming bookings calendar + accept/decline/no-show */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              Upcoming Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBookings ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : bookingsLoadFailed ? (
              <p className="py-6 text-center text-sm text-destructive">Could not load your bookings. Please refresh the page.</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-center gap-2">
                  <CalendarWidget
                    mode="single"
                    selected={selectedBookingDate}
                    onSelect={setSelectedBookingDate}
                    modifiers={{ hasBooking: (date: Date) => bookingDatesSet.has(toDateKey(date)) }}
                    modifiersClassNames={{ hasBooking: "font-bold underline decoration-primary decoration-2 underline-offset-4" }}
                    className="rounded-lg border"
                  />
                  {selectedBookingDate && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedBookingDate(undefined)}>
                      Show all upcoming
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {displayedBookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                      <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-foreground">No upcoming bookings</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedBookingDate ? "No bookings on this date." : "New booking requests will appear here."}
                      </p>
                    </div>
                  ) : (
                    displayedBookings.map((booking) => {
                      const customerName = booking.customer
                        ? `${booking.customer.firstname} ${booking.customer.lastname}`.trim()
                        : "Customer"
                      const cfg = getBookingStatusConfig(booking.status)
                      const isResponding = respondingId === booking.id
                      const pastDue = booking.status === "CONFIRMED" && isBookingPastEnd(booking)
                      return (
                        <div key={booking.id} className="rounded-lg border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarImage src={resolveAvatarUrl(booking.customer?.profilePicture, customerName)} />
                                <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">{booking.service?.name ?? "Service"} — {customerName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(booking.scheduledDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                                  {" · "}{booking.startTime} – {booking.endTime}
                                  {booking.agreedPrice != null && <> · {formatCurrency(booking.agreedPrice)}</>}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className={cfg.className}>
                              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                              {cfg.label}
                            </Badge>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                            {booking.status === "PENDING" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                                  onClick={() => handleAccept(booking)}
                                  disabled={isResponding}
                                >
                                  {isResponding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-transparent"
                                  onClick={() => setDeclineTargetId(booking.id)}
                                  disabled={isResponding}
                                >
                                  <X className="mr-1.5 h-3.5 w-3.5" />
                                  Decline
                                </Button>
                              </>
                            )}
                            {booking.status === "CONFIRMED" && booking.jobId && (
                              <Button size="sm" variant="outline" className="bg-transparent" asChild>
                                <Link href={`/dashboard/artisan/jobs/${booking.jobId}`}>
                                  <Briefcase className="mr-1.5 h-3.5 w-3.5" />
                                  View Job
                                </Link>
                              </Button>
                            )}
                            {pastDue && !booking.noShowByArtisanAt && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-attention/40 bg-transparent text-attention hover:bg-attention/10"
                                onClick={() => handleFlagNoShow(booking)}
                                disabled={isResponding}
                              >
                                {isResponding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <AlertOctagon className="mr-1.5 h-3.5 w-3.5" />}
                                Mark Customer as No-show
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={declineTargetId != null} onOpenChange={(open) => !open && setDeclineTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Booking Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline this booking request? The customer will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDecline} className="bg-destructive text-white hover:bg-destructive/90">
              Decline Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
