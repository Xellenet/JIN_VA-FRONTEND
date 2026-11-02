"use client"

import Link from "next/link"
import { AlertTriangle, CalendarDays, Gavel, Inbox, Lock, MapPin, Send, ShieldCheck, StickyNote, Wallet, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  artisanActionRows,
  artisanJobHref,
  bookingTitle,
  calendarBookingHref,
  clientLabel,
  formatGhs,
  locationText,
  type ArtisanActionKind,
  type ArtisanBooking,
  type ArtisanEarningsSnapshot,
  type ArtisanVerificationNeed,
} from "@/lib/artisan-overview"
import { formatAppointment } from "@/lib/overview"
import { cn } from "@/lib/utils"
import { ActionRowList, CaughtUp } from "./rail-needs-action"
import { RailError, RailSection, RailSkeleton, railFocusRing, type RailLayout, type RailSectionState } from "./rail-section"

export interface ArtisanRailStates {
  /** Built from three sections; `partial` = one of them failed, the rest still show. */
  actions: RailSectionState<{
    requests: number | null
    disputes: number | null
    earnings: ArtisanEarningsSnapshot | null
    verification?: ArtisanVerificationNeed
    partial: boolean
  }>
  appointments: RailSectionState<{ today: ArtisanBooking[]; next: ArtisanBooking | null }>
  earnings: RailSectionState<ArtisanEarningsSnapshot>
}

const ACTION_ICONS: Record<ArtisanActionKind, LucideIcon> = {
  bookingRequests: Inbox,
  disputes: Gavel,
  payoutsNeedAction: AlertTriangle,
  payoutMethod: Wallet,
  verification: ShieldCheck,
}

/**
 * The artisan's "at a glance" rail: the same panel, sections and states as
 * the customer `AccountRail`, with the artisan's content (what needs answering,
 * today's work, what they've earned).
 */
export function ArtisanRail({
  layout,
  states,
  now,
  onRetry,
  className,
}: {
  layout: RailLayout
  states: ArtisanRailStates
  now: Date
  onRetry: () => void
  className?: string
}) {
  if (layout === "rail") {
    return (
      <aside
        aria-label="Your work at a glance"
        className={cn("divide-y overflow-hidden rounded-2xl border bg-muted/50 dark:bg-muted/40", className)}
      >
        <RailArtisanActions state={states.actions} layout="rail" onRetry={onRetry} />
        <RailAppointments state={states.appointments} layout="rail" now={now} onRetry={onRetry} />
        <RailEarnings state={states.earnings} layout="rail" onRetry={onRetry} />
      </aside>
    )
  }
  return (
    <aside aria-label="Your work at a glance" className={cn("grid items-start gap-4 md:grid-cols-2 md:gap-6", className)}>
      <RailAppointments state={states.appointments} layout="cards" now={now} onRetry={onRetry} />
      <RailEarnings state={states.earnings} layout="cards" onRetry={onRetry} />
    </aside>
  )
}

export function RailArtisanActions({
  state,
  layout,
  onRetry,
}: {
  state: ArtisanRailStates["actions"]
  layout: RailLayout
  onRetry: () => void
}) {
  const rows = state.kind === "ready" ? artisanActionRows(state.data) : []
  return (
    <RailSection title="Needs your action" layout={layout} name="action">
      {state.kind === "loading" ? (
        <div className="mt-3 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-8 items-center gap-3">
              <RailSkeleton className="h-8 w-8 rounded-lg" />
              <RailSkeleton className="h-3.5 flex-1" />
              <RailSkeleton className="h-6 w-6 rounded-full" />
            </div>
          ))}
        </div>
      ) : state.kind === "error" ? (
        <RailError message="Couldn't load this" rateLimited={state.rateLimited} onRetry={onRetry} />
      ) : (
        <>
          {rows.length === 0 && !state.data.partial ? (
            <CaughtUp text="Nothing needs you right now. Booking requests and disputes will show here." />
          ) : rows.length > 0 ? (
            <ActionRowList
              layout={layout}
              rows={rows.map((r) => ({
                key: r.kind,
                href: r.href,
                icon: ACTION_ICONS[r.kind],
                label: r.label,
                detail: r.detail,
                count: r.count,
                ariaLabel: r.ariaLabel,
              }))}
            />
          ) : null}
          {state.data.partial && (
            <RailError message="Some of this couldn't load" rateLimited={false} onRetry={onRetry} />
          )}
        </>
      )}
    </RailSection>
  )
}

/** Today's confirmed bookings, then the next one if it isn't today. */
export function RailAppointments({
  state,
  layout,
  now,
  onRetry,
}: {
  state: ArtisanRailStates["appointments"]
  layout: RailLayout
  now: Date
  onRetry: () => void
}) {
  const today = state.kind === "ready" ? state.data.today : []
  const next = state.kind === "ready" ? state.data.next : null
  const nextIsToday = next != null && today.some((b) => b.bookingId === next.bookingId)
  const title = today.length > 0 ? "Today" : "Next appointment"

  return (
    <RailSection
      title={title}
      layout={layout}
      name="appt"
      aside={
        <Link
          href="/dashboard/artisan/calendar"
          className={cn("-my-3 inline-flex min-h-11 items-center rounded-md text-sm sm:my-0 sm:min-h-0 font-medium text-primary underline-offset-4 hover:underline", railFocusRing)}
        >
          Calendar
        </Link>
      }
    >
      {state.kind === "loading" ? (
        <div className="mt-3 flex gap-3">
          <RailSkeleton className="h-[76px] w-14 rounded-lg" />
          <div className="flex-1 space-y-2 pt-1">
            <RailSkeleton className="h-3.5 w-2/5" />
            <RailSkeleton className="h-3 w-3/5" />
            <RailSkeleton className="h-3 w-1/3" />
          </div>
        </div>
      ) : state.kind === "error" ? (
        <RailError message="Couldn't load your appointments" rateLimited={state.rateLimited} onRetry={onRetry} />
      ) : today.length === 0 && !next ? (
        <div className="mt-3 flex items-start gap-3 px-1 py-2">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-inset ring-border"
          >
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">No upcoming appointments</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Bookings you accept show here.</p>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {today.map((b) => (
            <AppointmentCard key={b.bookingId} booking={b} now={now} />
          ))}
          {next && !nextIsToday && (
            <>
              {today.length > 0 && <h3 className="pt-1 text-sm font-semibold text-foreground">Next appointment</h3>}
              <AppointmentCard booking={next} now={now} />
            </>
          )}
        </div>
      )}
    </RailSection>
  )
}

function AppointmentCard({ booking, now }: { booking: ArtisanBooking; now: Date }) {
  const when = formatAppointment(booking, now)
  const client = clientLabel(booking.clientName)
  const title = bookingTitle(booking.service, client)
  const service = booking.service?.name?.trim() || null
  const jobHref = artisanJobHref(booking.jobId)
  const href = jobHref ?? calendarBookingHref(booking.bookingId)
  const label = `${jobHref ? "Open the job" : "Open in Calendar"}: ${title} with ${client}${when ? `, ${when.line}` : ""}`

  return (
    <div className="group relative flex gap-3 rounded-xl border bg-card p-3 transition-colors duration-150 hover:border-primary/40 motion-reduce:transition-none">
      {when && (
        <span
          aria-hidden
          className="flex w-14 shrink-0 flex-col items-center justify-center self-start rounded-lg bg-primary/[0.07] py-2 text-primary dark:bg-primary/15"
        >
          <span className="text-[11px] font-medium leading-none">{when.tile.weekday}</span>
          <span className="mt-1 text-2xl font-semibold leading-none tabular-nums">{when.tile.day}</span>
          <span className="mt-1 text-[11px] font-medium leading-none">{when.tile.month}</span>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <Link
          href={href}
          aria-label={label}
          className={cn(
            "block truncate rounded-sm text-sm font-semibold text-foreground after:absolute after:inset-0 after:rounded-xl after:content-['']",
            "focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary dark:focus-visible:after:ring-ring",
          )}
        >
          <span dir="auto" className="[unicode-bidi:isolate]">{client}</span>
        </Link>
        {service && (
          <span dir="auto" className="block truncate text-sm text-foreground [unicode-bidi:isolate]">
            {service}
          </span>
        )}
        {when && (
          <span className="mt-1 block text-sm text-muted-foreground">
            {when.relative ? (
              <>
                <span className="font-medium text-foreground">{when.relative}</span>
                {when.time ? `, ${when.time}` : `, ${when.date}`}
              </>
            ) : (
              <>
                {when.date}
                {when.time && <span className="block tabular-nums">{when.time}</span>}
              </>
            )}
          </span>
        )}
        <span className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="sr-only">Location: </span>
          <span dir="auto" className="min-w-0 break-words [unicode-bidi:isolate]">
            {locationText(booking.location)}
          </span>
        </span>
        {booking.notes && (
          <span className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <StickyNote aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="sr-only">Client&apos;s note: </span>
            <span dir="auto" className="line-clamp-3 min-w-0 break-words [unicode-bidi:isolate]">
              {booking.notes}
            </span>
          </span>
        )}
      </span>
    </div>
  )
}

/**
 * Earnings snapshot: this month's paid total as the figure, then where the
 * rest is (held until the client signs off, on its way, needs action).
 */
export function RailEarnings({
  state,
  layout,
  onRetry,
}: {
  state: RailSectionState<ArtisanEarningsSnapshot>
  layout: RailLayout
  onRetry: () => void
}) {
  const e = state.kind === "ready" ? state.data : null
  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Accra" })

  return (
    <RailSection
      title="Earnings"
      layout={layout}
      name="earn"
      aside={e ? <span className="text-sm text-muted-foreground">{month}</span> : null}
    >
      {state.kind === "loading" ? (
        <div className="mt-3 space-y-3">
          <RailSkeleton className="h-8 w-3/5" />
          <RailSkeleton className="h-3 w-2/5" />
          <RailSkeleton className="h-24 w-full" />
        </div>
      ) : state.kind === "error" ? (
        <RailError message="Couldn't load your earnings" rateLimited={state.rateLimited} onRetry={onRetry} />
      ) : e ? (
        <EarningsBody e={e} />
      ) : null}
    </RailSection>
  )
}

function EarningsBody({ e }: { e: ArtisanEarningsSnapshot }) {
  const [, amount] = formatGhs(e.paidThisMonth).split("GH₵ ")
  const needs = Number(e.needsAction) > 0 || e.needsActionCount > 0

  return (
    <>
      <p className="mt-3 text-[2rem] font-semibold leading-none tracking-tight tabular-nums text-foreground">
        <span className="mr-1 text-lg font-medium text-muted-foreground">GH₵</span>
        {amount}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Paid to you this month</p>

      <dl className="mt-4 divide-y rounded-lg bg-card ring-1 ring-inset ring-border">
        <EarnRow icon={Lock} label="Held for sign-off" hint="Released when the client confirms the job is done" value={e.heldForSignOff} />
        <EarnRow icon={Send} label="On its way" hint="Payout started" value={e.onTheWay} />
        {needs && (
          <EarnRow
            icon={AlertTriangle}
            label="Needs your action"
            hint={e.hasPayoutMethod ? "A payout couldn't be sent" : "Add a payout method to receive it"}
            value={e.needsAction}
            attention
          />
        )}
      </dl>

      <Button variant="outline" className="mt-4 h-11 w-full bg-card sm:h-9" asChild>
        <Link href="/dashboard/artisan/earnings">{needs && !e.hasPayoutMethod ? "Set up payouts in Earnings" : "View earnings"}</Link>
      </Button>
    </>
  )
}

function EarnRow({
  icon: Icon,
  label,
  hint,
  value,
  attention = false,
}: {
  icon: LucideIcon
  label: string
  hint: string
  value: string
  attention?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <dt className="flex min-w-0 items-start gap-2">
        <Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", attention ? "text-attention" : "text-muted-foreground")} />
        <span>
          <span className="block text-sm font-medium text-foreground">{label}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </dt>
      <dd className={cn("whitespace-nowrap text-sm font-semibold tabular-nums", attention ? "text-attention" : "text-foreground")}>
        {formatGhs(value)}
      </dd>
    </div>
  )
}

