"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBookingResponse } from "@/components/artisan/booking-response"
import { CalendarBookings, type BookingsState } from "@/components/artisan/calendar/calendar-bookings"
import { StatusCard, TimeOffCard, WorkingHoursCard, type ApiBlock, type ApiSlot } from "@/components/artisan/calendar/calendar-hours"
import { apiFetch } from "@/lib/api"
import { describeAvailability, type AvailabilitySummary } from "@/lib/availability"
import { calendarGroup, clientLabel, parseBookingParam } from "@/lib/artisan-overview"
import {
  getArtisanBookings,
  getBooking,
  getBookingJobs,
  type ArtisanBookingRecord,
  type BookingJobLink,
} from "@/lib/artisan-overview-api"

type Tab = "bookings" | "hours"

export default function ArtisanCalendarPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <CalendarContent />
      </Suspense>
    </DashboardLayout>
  )
}

/**
 * Calendar (H4): booking requests and upcoming bookings first, past
 * confirmed bookings split out as "Needs follow-up", and working hours, status
 * and time off in a second tab. `?booking=:id` opens the Bookings tab and
 * scrolls to that booking; `?tab=hours` opens the second tab.
 */
function CalendarContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const highlightId = parseBookingParam(searchParams.get("booking"))
  const tab: Tab = searchParams.get("tab") === "hours" && highlightId == null ? "hours" : "bookings"
  const [now, setNow] = useState(() => new Date())

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("booking")
    if (next === "hours") params.set("tab", "hours")
    else params.delete("tab")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // ── Bookings ───────────────────────────────────────────────────────────────
  const [bookings, setBookings] = useState<BookingsState>({ kind: "loading" })
  const [jobs, setJobs] = useState<Map<number, BookingJobLink>>(new Map())

  const loadBookings = useCallback(() => {
    setBookings({ kind: "loading" })
    getArtisanBookings({ limit: 100 })
      .then((items) => setBookings({ kind: "ready", items }))
      .catch(() => setBookings({ kind: "error" }))
    getBookingJobs()
      .then((list) => setJobs(new Map(list.map((j) => [Number(j.bookingId), j]))))
      .catch(() => setJobs(new Map()))
  }, [])

  // ── Availability ───────────────────────────────────────────────────────────
  const [status, setStatus] = useState<string | null>(null)
  const [slots, setSlots] = useState<ApiSlot[]>([])
  const [hoursFailed, setHoursFailed] = useState(false)
  const [blocks, setBlocks] = useState<ApiBlock[]>([])
  const [blocksLoading, setBlocksLoading] = useState(true)

  // "What clients see": the same computed state search and the public profile
  // show, refreshed after every change to status, hours or time off.
  const [summary, setSummary] = useState<AvailabilitySummary | null>(null)
  const [summaryVersion, setSummaryVersion] = useState(0)
  const refreshSummary = useCallback(() => setSummaryVersion((v) => v + 1), [])
  useEffect(() => {
    if (summaryVersion === 0) return
    let cancelled = false
    apiFetch<{ summary?: AvailabilitySummary }>("/availability/my")
      .then((data) => {
        if (!cancelled) setSummary(data.summary ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [summaryVersion])
  const changeSlots = useCallback(
    (fn: (prev: ApiSlot[]) => ApiSlot[]) => {
      setSlots(fn)
      refreshSummary()
    },
    [refreshSummary],
  )
  const changeBlocks = useCallback(
    (fn: (prev: ApiBlock[]) => ApiBlock[]) => {
      setBlocks(fn)
      refreshSummary()
    },
    [refreshSummary],
  )
  const changeStatus = useCallback(
    (next: string) => {
      setStatus(next)
      refreshSummary()
    },
    [refreshSummary],
  )

  useEffect(() => {
    loadBookings()
    apiFetch<{ status?: string; slots?: ApiSlot[]; summary?: AvailabilitySummary }>("/availability/my")
      .then((data) => {
        setStatus(data.status ?? "AVAILABLE")
        setSlots(data.slots ?? [])
        setSummary(data.summary ?? null)
      })
      .catch(() => setHoursFailed(true))
    apiFetch<ApiBlock[] | { items?: ApiBlock[] }>("/availability/my/blocks")
      .then((data) => setBlocks(Array.isArray(data) ? data : (data.items ?? [])))
      .catch(() => {})
      .finally(() => setBlocksLoading(false))
    const tick = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(tick)
  }, [loadBookings])

  // A linked booking outside the newest 100 is fetched on its own.
  const fetchedLinked = useRef<number | null>(null)
  useEffect(() => {
    if (highlightId == null || bookings.kind !== "ready" || fetchedLinked.current === highlightId) return
    if (bookings.items.some((b) => b.id === highlightId)) return
    fetchedLinked.current = highlightId
    getBooking(highlightId)
      .then((b) =>
        setBookings((prev) => (prev.kind === "ready" && !prev.items.some((x) => x.id === b.id) ? { kind: "ready", items: [...prev.items, b] } : prev)),
      )
      .catch(() => toast.error("That booking couldn't be found."))
  }, [highlightId, bookings])

  // Scroll to the linked booking once it is on screen.
  const scrolledTo = useRef<number | null>(null)
  useEffect(() => {
    if (highlightId == null || scrolledTo.current === highlightId || bookings.kind !== "ready") return
    const frame = window.requestAnimationFrame(() => {
      const el = document.getElementById(`booking-${highlightId}`)
      if (!el) return
      scrolledTo.current = highlightId
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" })
    })
    return () => window.cancelAnimationFrame(frame)
  })

  const patch = (id: number, change: Partial<ArtisanBookingRecord>) =>
    setBookings((prev) => (prev.kind === "ready" ? { kind: "ready", items: prev.items.map((b) => (b.id === id ? { ...b, ...change } : b)) } : prev))

  const { accept, decline, respondingId, dialogs } = useBookingResponse({
    onAccepted: (id, { jobId, price }) => {
      patch(id, { status: "CONFIRMED", jobId, ...(price != null ? { agreedPrice: price } : {}) })
      getBookingJobs()
        .then((list) => setJobs(new Map(list.map((j) => [Number(j.bookingId), j]))))
        .catch(() => {})
    },
    onDeclined: (id) => patch(id, { status: "DECLINED" }),
  })

  const [noShowBusy, setNoShowBusy] = useState<number | null>(null)
  const markNoShow = async (b: ArtisanBookingRecord) => {
    setNoShowBusy(b.id)
    try {
      const res = await apiFetch<{ message?: string } | null>(`/bookings/${b.id}/no-show`, { method: "PATCH" })
      patch(b.id, { status: "NO_SHOW", noShowByArtisanAt: new Date().toISOString() })
      toast.success(res?.message ?? "Marked as a no-show.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't mark this booking. Try again.")
    } finally {
      setNoShowBusy(null)
    }
  }

  const target = (b: ArtisanBookingRecord) => ({
    id: b.id,
    clientName: clientLabel(b.customer ? `${b.customer.firstname} ${b.customer.lastname}` : ""),
    agreedPrice: b.agreedPrice ?? null,
  })

  const requestCount = useMemo(
    () => (bookings.kind === "ready" ? bookings.items.filter((b) => calendarGroup(b, now) === "requests").length : 0),
    [bookings, now],
  )

  return (
    <div className="w-full max-w-[1200px] space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Answer booking requests, see what&apos;s coming up and set when clients can book you.
          </p>
        </div>
        {status && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Clients see: <span className="font-medium text-foreground">{describeAvailability(summary, status).text}</span>
          </p>
        )}
      </header>

      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <TabsList className="h-auto w-full bg-muted p-1 sm:w-fit">
          <TabsTrigger value="bookings" className="min-h-11 gap-2 px-4 sm:min-h-9">
            Bookings
            {requestCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-attention px-1.5 text-xs font-semibold tabular-nums text-attention-foreground">
                {requestCount}
                <span className="sr-only"> {requestCount === 1 ? "request" : "requests"}</span>
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="hours" className="min-h-11 px-4 sm:min-h-9">
            Hours and time off
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <CalendarBookings
            state={bookings}
            jobs={jobs}
            now={now}
            highlightId={highlightId}
            respondingId={respondingId ?? noShowBusy}
            onAccept={(b) => accept(target(b))}
            onDecline={(b) => decline(target(b))}
            onNoShow={markNoShow}
            onRetry={loadBookings}
          />
        </TabsContent>

        <TabsContent value="hours" className="space-y-5">
          {hoursFailed ? (
            <p role="alert" className="rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
              Couldn&apos;t load your status and working hours. Refresh the page to try again.
            </p>
          ) : status == null ? (
            <div aria-hidden className="h-40 rounded-xl border bg-card motion-safe:animate-pulse" />
          ) : (
            <>
              <StatusCard saved={status} onSaved={changeStatus} />
              <WorkingHoursCard slots={slots} setSlots={changeSlots} />
            </>
          )}
          <TimeOffCard blocks={blocks} loading={blocksLoading} setBlocks={changeBlocks} />
        </TabsContent>
      </Tabs>

      {dialogs}
    </div>
  )
}
