"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { AlertCircle, AlertOctagon, Briefcase, CalendarClock, Check, ChevronDown, Clock, Loader2, MapPin, MessageSquareText, StickyNote, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarWidget } from "@/components/ui/calendar"
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
import type { ArtisanBookingRecord, BookingJobLink } from "@/lib/artisan-overview-api"
import {
  artisanJobHref,
  calendarGroup,
  clientLabel,
  formatGhs,
  locationText,
  respondByText,
  type CalendarGroup,
} from "@/lib/artisan-overview"
import { formatAppointment } from "@/lib/overview"
import { getBookingStatusConfig } from "@/lib/status-badges"
import { cn } from "@/lib/utils"

const RESPOND_WINDOW_MS = 24 * 3_600_000

export type BookingsState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: ArtisanBookingRecord[] }

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const nameOf = (b: ArtisanBookingRecord) =>
  clientLabel(b.customer ? `${b.customer.firstname ?? ""} ${b.customer.lastname ?? ""}` : "")

/**
 * The Calendar's bookings (H4): requests first, then upcoming bookings, then
 * confirmed bookings whose time has passed ("Needs follow-up"), then a closed
 * history. Each booking shows the client's note, the artisan's note and the
 * location (from the job made on confirmation, else "Location shared in
 * messages"). `highlightId` (from `?booking=`) is scrolled to and outlined.
 */
export function CalendarBookings({
  state,
  jobs,
  now,
  highlightId,
  respondingId,
  onAccept,
  onDecline,
  onNoShow,
  onRetry,
}: {
  state: BookingsState
  jobs: Map<number, BookingJobLink>
  now: Date
  highlightId: number | null
  respondingId: number | null
  onAccept: (b: ArtisanBookingRecord) => void
  onDecline: (b: ArtisanBookingRecord) => void
  onNoShow: (b: ArtisanBookingRecord) => Promise<void>
  onRetry: () => void
}) {
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [noShowTarget, setNoShowTarget] = useState<ArtisanBookingRecord | null>(null)

  const groups = useMemo(() => {
    const g: Record<CalendarGroup, ArtisanBookingRecord[]> = { requests: [], upcoming: [], followUp: [], history: [] }
    if (state.kind !== "ready") return g
    for (const b of state.items) g[calendarGroup(b, now)].push(b)
    const asc = (a: ArtisanBookingRecord, b: ArtisanBookingRecord) =>
      (a.scheduledDate + a.startTime).localeCompare(b.scheduledDate + b.startTime)
    g.requests.sort(asc)
    g.upcoming.sort(asc)
    g.followUp.sort((a, b) => asc(b, a))
    g.history.sort((a, b) => asc(b, a))
    return g
  }, [state, now])

  // A linked booking in the closed history opens it so it can be shown.
  const highlightGroup =
    highlightId != null && state.kind === "ready"
      ? (Object.keys(groups) as CalendarGroup[]).find((k) => groups[k].some((b) => b.id === highlightId))
      : undefined
  useEffect(() => {
    if (highlightGroup === "history") setHistoryOpen(true)
    if (highlightGroup) setDate(undefined)
  }, [highlightGroup])

  const datesWithBookings = useMemo(
    () => new Set([...groups.requests, ...groups.upcoming].map((b) => b.scheduledDate)),
    [groups],
  )
  const onDate = (list: ArtisanBookingRecord[]) => (date ? list.filter((b) => b.scheduledDate === toDateKey(date)) : list)

  if (state.kind === "loading") {
    return (
      <div aria-busy className="flex justify-center rounded-xl border bg-card py-16">
        <Loader2 aria-hidden className="h-6 w-6 text-muted-foreground motion-safe:animate-spin" />
        <span className="sr-only">Loading your bookings</span>
      </div>
    )
  }
  if (state.kind === "error") {
    return (
      <div role="alert" className="flex flex-col items-center rounded-xl border bg-card px-4 py-12 text-center">
        <AlertCircle aria-hidden className="mb-3 h-6 w-6 text-destructive" />
        <p className="font-medium text-foreground">Couldn&apos;t load your bookings</p>
        <p className="mt-1 text-sm text-muted-foreground">Check your connection, then try again.</p>
        <Button variant="outline" className="mt-5 h-11 bg-transparent sm:h-9" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }

  const card = (b: ArtisanBookingRecord, group: CalendarGroup) => (
    <BookingCard
      key={b.id}
      booking={b}
      group={group}
      job={jobs.get(b.id) ?? null}
      now={now}
      highlighted={highlightId === b.id}
      busy={respondingId === b.id}
      disabled={respondingId != null}
      onAccept={onAccept}
      onDecline={onDecline}
      onNoShow={setNoShowTarget}
    />
  )

  const requests = onDate(groups.requests)
  const upcoming = onDate(groups.upcoming)

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-6">
        {date && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/[0.04] px-4 py-2">
            <p className="text-sm text-foreground">
              Showing requests and bookings on{" "}
              <span className="font-medium">
                {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </p>
            <Button variant="ghost" className="h-11 sm:h-9" onClick={() => setDate(undefined)}>
              Show all dates
            </Button>
          </div>
        )}

        <Group
          id="requests"
          title="Booking requests"
          count={requests.length}
          empty={date ? "No requests on this date." : "No requests waiting. New ones show here, and on your Overview."}
        >
          {requests.map((b) => card(b, "requests"))}
        </Group>

        <Group
          id="upcoming"
          title="Upcoming"
          count={upcoming.length}
          empty={date ? "No bookings on this date." : "No upcoming bookings. Bookings you accept show here."}
        >
          {upcoming.map((b) => card(b, "upcoming"))}
        </Group>

        {groups.followUp.length > 0 && (
          <Group
            id="follow-up"
            title="Needs follow-up"
            count={groups.followUp.length}
            description="These bookings' time has passed. Open the job to request completion, or mark the client as a no-show if they didn't turn up."
          >
            {groups.followUp.map((b) => card(b, "followUp"))}
          </Group>
        )}

        {groups.history.length > 0 && (
          <section aria-labelledby="history-title">
            <h2 id="history-title" className="text-[15px] font-semibold text-foreground">
              <button
                type="button"
                aria-expanded={historyOpen}
                aria-controls="history-list"
                onClick={() => setHistoryOpen((o) => !o)}
                className="inline-flex min-h-11 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"
              >
                Past and closed
                <span className="text-sm font-normal text-muted-foreground">({groups.history.length})</span>
                <ChevronDown
                  aria-hidden
                  className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", historyOpen && "rotate-180")}
                />
              </button>
            </h2>
            {historyOpen && (
              <ul id="history-list" className="mt-3 space-y-3">
                {groups.history.map((b) => card(b, "history"))}
              </ul>
            )}
          </section>
        )}
      </div>

      <div className="hidden flex-col items-center gap-2 lg:sticky lg:top-4 lg:flex">
        <CalendarWidget
          mode="single"
          selected={date}
          onSelect={setDate}
          modifiers={{ hasBooking: (d: Date) => datesWithBookings.has(toDateKey(d)) }}
          modifiersClassNames={{ hasBooking: "font-bold underline decoration-primary decoration-2 underline-offset-4" }}
          className="rounded-xl border bg-card"
        />
        <p className="max-w-[16rem] text-center text-xs text-muted-foreground">
          Underlined dates have requests or bookings. Pick one to show only that day.
        </p>
      </div>

      <AlertDialog open={noShowTarget != null} onOpenChange={(open) => !open && respondingId == null && setNoShowTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {noShowTarget ? nameOf(noShowTarget) : "the client"} as a no-show?</AlertDialogTitle>
            <AlertDialogDescription>
              Only do this if the client wasn&apos;t there at the booked time. They are told, and the booking closes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9" disabled={respondingId != null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 sm:h-9"
              disabled={respondingId != null}
              onClick={(e) => {
                e.preventDefault()
                if (noShowTarget) void onNoShow(noShowTarget).then(() => setNoShowTarget(null))
              }}
            >
              {respondingId != null && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
              Mark as no-show
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Group({
  id,
  title,
  count,
  description,
  empty,
  children,
}: {
  id: string
  title: string
  count: number
  description?: string
  empty?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
        {title}
        <span className="text-sm font-normal tabular-nums text-muted-foreground">({count})</span>
      </h2>
      {description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>}
      {count === 0 && empty ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
          <CalendarClock aria-hidden className="h-4 w-4 shrink-0" />
          {empty}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">{children}</ul>
      )}
    </section>
  )
}

function BookingCard({
  booking: b,
  group,
  job,
  now,
  highlighted,
  busy,
  disabled,
  onAccept,
  onDecline,
  onNoShow,
}: {
  booking: ArtisanBookingRecord
  group: CalendarGroup
  job: BookingJobLink | null
  now: Date
  highlighted: boolean
  busy: boolean
  disabled: boolean
  onAccept: (b: ArtisanBookingRecord) => void
  onDecline: (b: ArtisanBookingRecord) => void
  onNoShow: (b: ArtisanBookingRecord) => void
}) {
  const when = formatAppointment(b, now)
  const client = nameOf(b)
  const service = b.service?.name?.trim() || null
  const status = getBookingStatusConfig(b.status)
  const jobHref = artisanJobHref(job?.id ?? b.jobId)
  const price = b.agreedPrice != null && Number(b.agreedPrice) > 0 ? formatGhs(b.agreedPrice) : null
  const created = b.createdAt ? new Date(b.createdAt).getTime() : Number.NaN
  const deadline =
    group === "requests" && Number.isFinite(created) ? respondByText(new Date(created + RESPOND_WINDOW_MS).toISOString(), now) : null
  const statusLabel = group === "followUp" ? "Time has passed" : status.label
  const canRespond = group === "requests" && !deadline?.expired
  const canNoShow = group === "followUp" && !b.noShowByArtisanAt

  return (
    <li
      id={`booking-${b.id}`}
      data-booking={b.id}
      aria-current={highlighted ? "true" : undefined}
      className={cn(
        "scroll-mt-6 rounded-xl border bg-card p-4 sm:p-5",
        highlighted && "border-primary ring-2 ring-primary/40 dark:ring-ring/50",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 dir="auto" className="font-medium text-foreground [unicode-bidi:isolate]">
            {client}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {service && <span className="text-foreground">{service}, </span>}
            {when ? when.line : b.scheduledDate}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("shrink-0", group === "followUp" ? "border-attention/30 bg-attention/10 text-attention" : status.className)}
        >
          {statusLabel}
        </Badge>
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        <Detail icon={MapPin} label="Location">
          {locationText(job?.location)}
        </Detail>
        {b.notes && (
          <Detail icon={StickyNote} label="Client's note">
            {b.notes}
          </Detail>
        )}
        {b.artisanNotes && (
          <Detail icon={MessageSquareText} label="Your note">
            {b.artisanNotes}
          </Detail>
        )}
        {price && (
          <Detail icon={Briefcase} label="Agreed price">
            <span className="font-medium tabular-nums text-foreground">{price}</span>
          </Detail>
        )}
      </dl>

      {deadline?.text && (
        <p className={cn("mt-3 flex items-center gap-1.5 text-sm font-medium", deadline.urgent ? "text-attention" : "text-muted-foreground")}>
          <Clock aria-hidden className="h-4 w-4" />
          {deadline.text}
        </p>
      )}
      {b.status === "NO_SHOW" && (
        <p className="mt-3 text-sm text-muted-foreground">
          {b.noShowByArtisanAt ? "You marked the client as a no-show." : "The client marked this booking as a no-show."}
        </p>
      )}

      {(canRespond || canNoShow || jobHref) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          {canRespond && (
            <>
              <Button className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={() => onAccept(b)} disabled={disabled}>
                {busy ? <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" /> : <Check aria-hidden className="h-4 w-4" />}
                Accept
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1 bg-transparent sm:h-9 sm:flex-none"
                onClick={() => onDecline(b)}
                disabled={disabled}
              >
                <X aria-hidden className="h-4 w-4" />
                Decline
              </Button>
            </>
          )}
          {jobHref && (
            <Button variant="outline" className="h-11 bg-transparent sm:h-9" asChild>
              <Link href={jobHref}>
                <Briefcase aria-hidden className="h-4 w-4" />
                View job
              </Link>
            </Button>
          )}
          {canNoShow && (
            <Button
              variant="outline"
              className="h-11 border-attention/40 bg-transparent text-attention hover:bg-attention/10 sm:h-9"
              onClick={() => onNoShow(b)}
              disabled={disabled}
            >
              <AlertOctagon aria-hidden className="h-4 w-4" />
              Mark client as no-show
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

function Detail({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <Icon aria-hidden className="mt-0.5 h-3.5 w-3.5 self-start" />
        <span className="w-[6.5rem] max-[399px]:sr-only">{label}</span>
      </dt>
      <dd dir="auto" className="min-w-0 break-words text-foreground/90 [unicode-bidi:isolate]">
        {children}
      </dd>
    </div>
  )
}
