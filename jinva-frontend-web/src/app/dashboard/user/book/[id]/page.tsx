"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarWidget } from "@/components/ui/calendar"
import { TimeSlotSelector, type TimeSlot } from "@/components/dashboard/time-slot-selector"
import { AttachmentUploader } from "@/components/dashboard/attachment-uploader"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ArrowLeft, CalendarDays, CreditCard, CheckCircle, Loader2, UserRound, AlertTriangle } from "lucide-react"
import { formatCurrency, resolveAvatarUrl } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { RatingStars } from "@/components/ui/rating-stars"
import { toast } from "sonner"

interface BackendService {
  id: string
  name: string
  description?: string
  price?: number
  estimatedDurationMins?: number
}

interface BackendArtisan {
  id: string
  businessName?: string
  averageRating: number
  totalReviews: number
  availabilityStatus: string
  services?: { id: string; name: string }[]
  user: { id: string; firstname: string; lastname: string; profilePicture?: string }
}

interface ApiWeeklySlot {
  id: number
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

interface ApiAvailabilityResponse {
  artisanProfileId: number
  status: string
  slots: ApiWeeklySlot[]
  date?: string
  bookableSlots?: TimeSlot[]
}

interface BackendBooking {
  id: number
  status: string
  scheduledDate: string
  startTime: string
  endTime: string
  service?: { id: number; name: string }
}

// ─── Date helpers (all local-calendar-date based — see NFR (c) note below) ──
// The backend treats scheduledDate/startTime/endTime as the literal values
// the artisan's own bookable-slot computation returned; the frontend never
// constructs a wall-clock time itself from a browser Date object, so there is
// no naive-local-time-to-UTC conversion bug to introduce here — we simply
// echo back one of the server's own previously-returned slot strings.
function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number)
  const total = h * 60 + m + mins
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

function computeDiscreteSlots(windows: TimeSlot[], durationMins: number): TimeSlot[] {
  const result: TimeSlot[] = []
  for (const w of windows) {
    let cursor = w.startTime
    // Guard against a pathological zero/negative duration making this loop forever.
    const safeDuration = durationMins > 0 ? durationMins : 60
    let iterations = 0
    while (addMinutes(cursor, safeDuration) <= w.endTime && iterations < 200) {
      const end = addMinutes(cursor, safeDuration)
      result.push({ startTime: cursor, endTime: end })
      cursor = end
      iterations++
    }
  }
  return result
}

function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

export default function BookArtisanPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [artisan, setArtisan] = useState<{
    name: string; specialization: string; avatar?: string; avgRating: number; reviews: number; availability: string
  } | null>(null)
  const [services, setServices] = useState<BackendService[]>([])
  const [selectedService, setSelectedService] = useState("")
  const [notes, setNotes] = useState("")
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])

  const [weeklySlots, setWeeklySlots] = useState<ApiWeeklySlot[]>([])
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)
  const [availabilityLoadFailed, setAvailabilityLoadFailed] = useState(false)

  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null)
  const [bookabilityCache, setBookabilityCache] = useState<Map<string, TimeSlot[]>>(new Map())
  const [pendingDateKeys, setPendingDateKeys] = useState<Set<string>>(new Set())

  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdBooking, setCreatedBooking] = useState<BackendBooking | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<BackendService[] | { items: BackendService[] }>("/services").then((r) =>
        Array.isArray(r) ? r : (r as { items: BackendService[] }).items ?? []
      ),
      apiFetch<BackendArtisan>(`/artisans/${id}`),
    ])
      .then(([svcList, profile]) => {
        setServices(svcList)
        setArtisan({
          name: `${profile.user.firstname} ${profile.user.lastname}`.trim(),
          specialization: profile.businessName || profile.services?.[0]?.name || "General Service",
          avatar: profile.user.profilePicture,
          avgRating: Number(profile.averageRating ?? 0),
          reviews: Number(profile.totalReviews ?? 0),
          availability: profile.availabilityStatus === "AVAILABLE" ? "available" : "busy",
        })
      })
      .catch(() => {
        setServices([])
      })
  }, [id])

  // R1a edge case: artisan with zero weekly availability slots at all — must
  // show a clear empty state and disable submission, not silently allow a
  // booking against no schedule.
  useEffect(() => {
    setIsLoadingAvailability(true)
    apiFetch<ApiAvailabilityResponse>(`/availability/${id}`)
      .then((res) => setWeeklySlots(res.slots ?? []))
      .catch(() => setAvailabilityLoadFailed(true))
      .finally(() => setIsLoadingAvailability(false))
  }, [id])

  const hasAnyActiveSlot = weeklySlots.some((s) => s.isActive)
  const todayKey = toDateKey(new Date())

  // Batch-prefetch bookability for every date in the visible month that has
  // configured working hours for its day-of-week — this is what lets the
  // calendar grid disable "fully booked or blocked" dates (not just past
  // dates / days with no configured hours at all) with an accurate,
  // domain-specific reason per NFR (f), instead of only discovering that at
  // submit time.
  const fetchMonthBookability = useCallback(
    async (month: Date) => {
      if (weeklySlots.length === 0) return
      const year = month.getFullYear()
      const monthIdx = month.getMonth()
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()

      const candidates: string[] = []
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(year, monthIdx, d)
        const key = toDateKey(dt)
        if (key < todayKey) continue
        const dow = dt.getDay()
        const hasHours = weeklySlots.some((s) => s.isActive && s.dayOfWeek === dow)
        if (!hasHours) continue
        if (bookabilityCache.has(key) || pendingDateKeys.has(key)) continue
        candidates.push(key)
      }
      if (candidates.length === 0) return

      setPendingDateKeys((prev) => new Set([...prev, ...candidates]))
      const results = await Promise.all(
        candidates.map((key) =>
          apiFetch<ApiAvailabilityResponse>(`/availability/${id}?date=${key}`)
            .then((res) => ({ key, slots: res.bookableSlots ?? [] }))
            .catch(() => ({ key, slots: null as TimeSlot[] | null })),
        ),
      )
      setBookabilityCache((prev) => {
        const next = new Map(prev)
        for (const r of results) {
          if (r.slots !== null) next.set(r.key, r.slots)
        }
        return next
      })
      setPendingDateKeys((prev) => {
        const next = new Set(prev)
        for (const r of results) next.delete(r.key)
        return next
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weeklySlots, id, todayKey],
  )

  useEffect(() => {
    if (!isLoadingAvailability && hasAnyActiveSlot) {
      fetchMonthBookability(visibleMonth)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingAvailability, hasAnyActiveSlot, visibleMonth, weeklySlots])

  const isDateDisabled = useCallback(
    (date: Date) => {
      const key = toDateKey(date)
      if (key < todayKey) return true
      const dow = date.getDay()
      const hasHours = weeklySlots.some((s) => s.isActive && s.dayOfWeek === dow)
      if (!hasHours) return true
      const cached = bookabilityCache.get(key)
      if (cached && cached.length === 0) return true
      return false
    },
    [weeklySlots, bookabilityCache, todayKey],
  )

  const dayLabel = useCallback(
    (date: Date, modifiers?: Record<string, boolean>) => {
      const base = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      if (modifiers?.pastDate) return `${base}, unavailable — date is in the past`
      if (modifiers?.noWorkingHours) return `${base}, unavailable — artisan has no working hours on this day`
      if (modifiers?.unavailable) return `${base}, unavailable — fully booked or blocked`
      if (modifiers?.selected) return `${base}, selected`
      return base
    },
    [],
  )

  const handleSelectDate = (date: Date | undefined) => {
    setSelectedDate(date)
    setSelectedStartTime(null)
    if (!date) return
    const key = toDateKey(date)
    if (!bookabilityCache.has(key) && !pendingDateKeys.has(key)) {
      setPendingDateKeys((prev) => new Set(prev).add(key))
      apiFetch<ApiAvailabilityResponse>(`/availability/${id}?date=${key}`)
        .then((res) => {
          setBookabilityCache((prev) => new Map(prev).set(key, res.bookableSlots ?? []))
        })
        .catch(() => toast.error("Could not load available times for this date."))
        .finally(() => {
          setPendingDateKeys((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        })
    }
  }

  // service.id is numeric (see BackendService), but Radix's SelectItem value
  // is always a string — and its hidden native <select> fallback re-fires
  // onValueChange with a stringified value after the initial (numeric) one,
  // so selectedService ends up a string regardless. Compare as strings here
  // rather than fighting that.
  const selectedServiceData = services.find((s) => String(s.id) === selectedService)
  const durationMins = selectedServiceData?.estimatedDurationMins || 60

  const selectedDateKey = selectedDate ? toDateKey(selectedDate) : null
  const windowsForSelectedDate = selectedDateKey ? bookabilityCache.get(selectedDateKey) : undefined
  const isLoadingSlotsForDate = !!selectedDateKey && pendingDateKeys.has(selectedDateKey)

  const discreteSlots = useMemo(() => {
    if (!windowsForSelectedDate) return []
    let slots = computeDiscreteSlots(windowsForSelectedDate, durationMins)
    // Courtesy client-side filter for "today" so we don't offer times that
    // have already passed in the customer's own clock — the server's UTC
    // clock remains the authoritative check at submit time (NFR (c)).
    if (selectedDateKey === todayKey) {
      const now = new Date()
      const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      slots = slots.filter((s) => s.startTime > nowHHMM)
    }
    return slots
  }, [windowsForSelectedDate, durationMins, selectedDateKey, todayKey])

  const isFormValid = !!selectedService && !!selectedDate && !!selectedStartTime

  const invalidateDate = (key: string) => {
    setBookabilityCache((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid || !selectedDate || !selectedDateKey) return

    const slot = discreteSlots.find((s) => s.startTime === selectedStartTime)
    if (!slot) {
      toast.error("Please select a valid time slot.")
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        artisanProfileId: Number(id),
        serviceId: Number(selectedService),
        scheduledDate: selectedDateKey,
        startTime: slot.startTime,
        endTime: slot.endTime,
        notes: notes.trim() || undefined,
        agreedPrice: selectedServiceData?.price != null ? Number(selectedServiceData.price) : undefined,
        currency: "GHS",
        attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      }
      const booking = await apiFetch<BackendBooking>("/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setCreatedBooking(booking)
      setShowConfirmation(true)
      invalidateDate(selectedDateKey)
    } catch (err) {
      // Surfaces backend messages verbatim, including the A4 "no longer
      // available" 409 and the A9 "too many pending requests" 409 — both are
      // already specific, human-readable strings, not generic failures.
      toast.error(err instanceof Error ? err.message : "Failed to create booking.")
      invalidateDate(selectedDateKey)
      setSelectedStartTime(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
            <Link href={`/dashboard/user/artisan/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to Profile
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Book a Service</h1>
          <p className="text-muted-foreground">Fill in the details below to book {artisan?.name ?? "this artisan"}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <form onSubmit={handleSubmit}>
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="font-semibold text-foreground">Service Details</h3>
                </div>
                <CardContent className="space-y-5 p-5">
                  <div className="space-y-2">
                    <Label htmlFor="service">Service Type <span className="text-destructive">*</span></Label>
                    <Select
                      value={selectedService}
                      onValueChange={(v) => { setSelectedService(v); setSelectedStartTime(null) }}
                    >
                      <SelectTrigger>
                        {/* Explicit children instead of relying on Radix's
                            SelectItem->ItemText portal, which is flaky when the
                            item content is a multi-element tree (name + price)
                            rather than plain text — this always reflects the
                            selection directly from our own state. */}
                        <SelectValue placeholder="Select a service">
                          {selectedServiceData && (
                            <div className="flex items-center justify-between gap-4">
                              <span>{selectedServiceData.name}</span>
                              {selectedServiceData.price != null && (
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(selectedServiceData.price)}
                                </span>
                              )}
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={String(service.id)}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{service.name}</span>
                              {service.price != null && (
                                <span className="text-xs text-muted-foreground">{formatCurrency(service.price)}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes for the Artisan</Label>
                    <Textarea
                      id="notes"
                      placeholder="Describe the issue, or add any details the artisan should know before arriving…"
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Attach Photos (optional)</Label>
                    <AttachmentUploader value={attachmentUrls} onChange={setAttachmentUrls} disabled={isSubmitting} />
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <div className="border-b border-border p-5">
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Choose Date &amp; Time
                  </h3>
                </div>
                {/* overflow-anchor: none — this block's height changes
                    asynchronously (loading spinner -> full time-slot grid
                    once the fetch for the picked date resolves) inside a
                    nested scroll container (DashboardLayout's <main>), which
                    is exactly the case that trips up the browser's scroll
                    anchoring and produces a visible jump/blank-space flash. */}
                <CardContent className="space-y-5 p-5" style={{ overflowAnchor: "none" }}>
                  {isLoadingAvailability ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : availabilityLoadFailed ? (
                    <p className="text-sm text-destructive">Could not load this artisan&apos;s availability. Please try again later.</p>
                  ) : !hasAnyActiveSlot ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
                      <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">This artisan hasn&apos;t set their availability yet</p>
                      <p className="text-xs text-muted-foreground">
                        They need to configure their working hours before you can book a specific time. Please check back later or post an open job instead.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-center">
                        <CalendarWidget
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleSelectDate}
                          month={visibleMonth}
                          onMonthChange={setVisibleMonth}
                          disabled={isDateDisabled}
                          modifiers={{
                            pastDate: (date: Date) => toDateKey(date) < todayKey,
                            noWorkingHours: (date: Date) =>
                              !weeklySlots.some((s) => s.isActive && s.dayOfWeek === date.getDay()),
                            unavailable: (date: Date) => {
                              const key = toDateKey(date)
                              if (key < todayKey) return false
                              const hasHours = weeklySlots.some((s) => s.isActive && s.dayOfWeek === date.getDay())
                              if (!hasHours) return false
                              const cached = bookabilityCache.get(key)
                              return !!cached && cached.length === 0
                            },
                          }}
                          labels={{ labelDayButton: dayLabel, labelGridcell: dayLabel }}
                          className="rounded-lg border"
                        />
                      </div>

                      {selectedDate && (
                        <div className="space-y-2">
                          <Label id="time-slot-label">
                            Available Times — {selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                          </Label>
                          {isLoadingSlotsForDate ? (
                            <div className="flex justify-center py-6">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            <TimeSlotSelector
                              slots={discreteSlots}
                              value={selectedStartTime}
                              onChange={setSelectedStartTime}
                              disabled={isSubmitting}
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" asChild className="flex-1 md:flex-none bg-transparent">
                  <Link href="/dashboard/user/search">Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 md:flex-none md:px-8"
                  disabled={!isFormValid || isSubmitting || !hasAnyActiveSlot}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm Booking
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="font-semibold text-foreground">Selected Artisan</h3>
              </div>
              <CardContent className="p-5">
                {artisan ? (
                  <>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={resolveAvatarUrl(artisan.avatar, artisan.name)} />
                        <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold text-foreground">{artisan.name}</h4>
                        <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                        <div className="mt-1">
                          <RatingStars rating={artisan.avgRating} totalReviews={artisan.reviews} size="sm" />
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`mt-4 w-full justify-center ${artisan.availability === "available" ? "border-primary/20 bg-primary/5 text-primary" : "border-border bg-muted text-muted-foreground"}`}
                    >
                      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                      {artisan.availability === "available" ? "Available" : "Busy"}
                    </Badge>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <CreditCard className="h-4 w-4" />
                  Booking Summary
                </h3>
              </div>
              <CardContent className="p-5">
                {selectedServiceData ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{selectedServiceData.name}</span>
                      {selectedServiceData.price != null && (
                        <span className="font-medium text-foreground">{formatCurrency(selectedServiceData.price)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium text-foreground">{durationMins} min</span>
                    </div>
                    {selectedDate && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium text-foreground">
                          {selectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    )}
                    {selectedStartTime && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Time</span>
                        <span className="font-medium text-foreground">
                          {formatTimeLabel(selectedStartTime)} – {formatTimeLabel(addMinutes(selectedStartTime, durationMins))}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    Select a service to see pricing
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <DialogTitle>Booking Request Sent!</DialogTitle>
              <DialogDescription>
                Your request has been sent to the artisan and is awaiting their confirmation. You&apos;ll be notified as soon as they respond.
              </DialogDescription>
            </DialogHeader>
            {createdBooking && (
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Booking ID</span>
                    <span className="font-medium text-foreground">#{createdBooking.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">Pending</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium text-foreground">{createdBooking.scheduledDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium text-foreground">
                      {formatTimeLabel(createdBooking.startTime)} – {formatTimeLabel(createdBooking.endTime)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => router.push(createdBooking ? `/dashboard/user/bookings/${createdBooking.id}` : "/dashboard/user/bookings")}
              >
                View My Bookings
              </Button>
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => { setShowConfirmation(false); router.push("/dashboard/user") }}
              >
                Back to Dashboard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
