"use client"

import Link from "next/link"
import { CalendarDays } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { NextBooking } from "@/lib/customer-api"
import { artisanHref, bookingHref, formatAppointment, initials } from "@/lib/overview"
import { cn, resolveAvatarUrl } from "@/lib/utils"
import { RailError, RailSection, RailSkeleton, railFocusRing, type RailLayout, type RailSectionState } from "./rail-section"

/**
 * "Next appointment" (FR-2.5). The card links to the booking; the artisan's
 * name links to their profile when they still exist. Only the artisan's name
 * and photo are shown (FR-2.10).
 */
export function RailNextAppointment({
  state,
  layout,
  now,
  onRetry,
}: {
  state: RailSectionState<NextBooking | null>
  layout: RailLayout
  now: Date
  onRetry: () => void
}) {
  const booking = state.kind === "ready" ? state.data : null
  const href = booking ? bookingHref(booking.id) : null

  return (
    <RailSection
      title="Next appointment"
      layout={layout}
      name="appt"
      aside={
        href ? (
          <Link
            href={href}
            className={cn("rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline", railFocusRing)}
          >
            View booking
          </Link>
        ) : null
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
        <RailError message="Couldn't load this" rateLimited={state.rateLimited} onRetry={onRetry} />
      ) : booking ? (
        <BookingCard booking={booking} href={href} now={now} />
      ) : (
        <div className="mt-3 flex items-start gap-3 px-1 py-2">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-inset ring-border"
          >
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">No upcoming appointments</p>
            <Link
              href="/dashboard/user/search"
              className={cn(
                "mt-1 inline-flex min-h-9 items-center rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline",
                railFocusRing,
              )}
            >
              Book an artisan
            </Link>
          </div>
        </div>
      )}
    </RailSection>
  )
}

function BookingCard({ booking, href, now }: { booking: NextBooking; href: string | null; now: Date }) {
  const when = formatAppointment(booking, now)
  const service = booking.service?.name ?? "Booking"
  const artisanLink = artisanHref(booking.artisan.id)
  const confirmed = booking.status === "CONFIRMED"
  const label = `View booking: ${service} with ${booking.artisan.displayName}${when ? `, ${when.line}` : ""}`

  return (
    <div className="group relative mt-3 flex gap-3 rounded-xl border bg-card p-3 transition-colors duration-150 hover:border-primary/40 motion-reduce:transition-none">
      {when && (
        <span
          aria-hidden
          className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/[0.07] py-2 text-primary dark:bg-primary/15"
        >
          <span className="text-[11px] font-medium leading-none">{when.tile.weekday}</span>
          <span className="mt-1 text-2xl font-semibold leading-none tabular-nums">{when.tile.day}</span>
          <span className="mt-1 text-[11px] font-medium leading-none">{when.tile.month}</span>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          {href ? (
            // The whole card is the booking link (stretched); the artisan link sits above it.
            <Link
              href={href}
              aria-label={label}
              className={cn(
                "truncate rounded-sm text-sm font-semibold text-foreground after:absolute after:inset-0 after:rounded-xl after:content-['']",
                "focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary dark:focus-visible:after:ring-ring",
              )}
            >
              {service}
            </Link>
          ) : (
            <span className="truncate text-sm font-semibold text-foreground">{service}</span>
          )}
          <span
            className={cn(
              "shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
              confirmed ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning",
            )}
          >
            {confirmed ? "Confirmed" : "Awaiting confirmation"}
          </span>
        </span>
        {when && (
          <>
            <span className="mt-1 block text-sm text-muted-foreground">
              {when.relative ? (
                <>
                  <span className="font-medium text-foreground">{when.relative}</span>, {when.date}
                </>
              ) : (
                when.date
              )}
            </span>
            {when.time && <span className="block text-sm tabular-nums text-muted-foreground">{when.time}</span>}
          </>
        )}
        <span className="mt-2 flex items-center gap-2 text-sm">
          <Avatar className="h-6 w-6 shrink-0">
            {booking.artisan.avatar ? <AvatarImage src={resolveAvatarUrl(booking.artisan.avatar)} alt="" /> : null}
            <AvatarFallback className="text-[10px] font-medium text-foreground/80">
              {initials(booking.artisan.displayName)}
            </AvatarFallback>
          </Avatar>
          {artisanLink ? (
            <Link
              href={artisanLink}
              dir="auto"
              className={cn(
                "relative z-10 truncate rounded-sm text-foreground underline-offset-4 [unicode-bidi:isolate] hover:underline",
                railFocusRing,
              )}
            >
              {booking.artisan.displayName}
            </Link>
          ) : (
            <span dir="auto" className="truncate text-foreground [unicode-bidi:isolate]">
              {booking.artisan.displayName}
            </span>
          )}
        </span>
      </span>
    </div>
  )
}
