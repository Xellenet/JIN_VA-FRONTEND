"use client"

import Link from "next/link"
import { AlertCircle, Check, Clock, Loader2, MapPin, StickyNote, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  clientLabel,
  formatGhs,
  locationText,
  respondByText,
  type BookingRequest,
} from "@/lib/artisan-overview"
import { formatAppointment } from "@/lib/overview"
import { cn } from "@/lib/utils"
import type { RailSectionState } from "./rail-section"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"

/**
 * Booking requests waiting for the artisan (H3): the first thing on the
 * Overview because they expire. Accept and Decline are on each request.
 * Hidden when there are none (the rail says "all caught up").
 */
export function BookingRequests({
  state,
  prices,
  now,
  respondingId,
  onAccept,
  onDecline,
  onRetry,
}: {
  state: RailSectionState<{ total: number; items: BookingRequest[] }>
  /** Agreed price per booking id: a string, null (none agreed), or absent (not known). */
  prices: Map<number, string | null>
  now: Date
  respondingId: number | null
  onAccept: (r: BookingRequest) => void
  onDecline: (r: BookingRequest) => void
  onRetry: () => void
}) {
  if (state.kind === "ready" && state.data.items.length === 0) return null
  const total = state.kind === "ready" ? state.data.total : null
  const shown = state.kind === "ready" ? state.data.items.length : 0

  return (
    <section
      id="booking-requests"
      aria-labelledby="requests-title"
      aria-busy={state.kind === "loading" || undefined}
      className="scroll-mt-4 overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex min-h-[49px] items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 id="requests-title" className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          Booking requests
          {total != null && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-attention px-1.5 text-xs font-semibold tabular-nums text-attention-foreground">
              {total}
            </span>
          )}
        </h2>
        {total != null && total > shown && (
          <Link
            href="/dashboard/artisan/calendar"
            className={cn("inline-flex min-h-11 items-center rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline sm:min-h-0", focusRing)}
          >
            See all {total}
          </Link>
        )}
      </div>

      {state.kind === "loading" ? (
        <div aria-hidden className="space-y-3 px-4 py-4 sm:px-5">
          <div className="h-4 w-2/5 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-3 w-3/5 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-10 w-48 rounded bg-muted motion-safe:animate-pulse" />
        </div>
      ) : state.kind === "error" ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-destructive" />
            {state.rateLimited ? "Too many requests, please wait a moment" : "Couldn't load your booking requests"}
          </p>
          {!state.rateLimited && (
            <Button variant="outline" className="h-11 bg-transparent sm:h-9" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-y">
          {state.data.items.map((r) => (
            <RequestRow
              key={r.bookingId}
              request={r}
              price={prices.has(r.bookingId) ? (prices.get(r.bookingId) ?? null) : undefined}
              now={now}
              busy={respondingId === r.bookingId}
              disabled={respondingId != null}
              onAccept={onAccept}
              onDecline={onDecline}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function RequestRow({
  request: r,
  price,
  now,
  busy,
  disabled,
  onAccept,
  onDecline,
}: {
  request: BookingRequest
  price: string | null | undefined
  now: Date
  busy: boolean
  disabled: boolean
  onAccept: (r: BookingRequest) => void
  onDecline: (r: BookingRequest) => void
}) {
  const when = formatAppointment(r, now)
  const client = clientLabel(r.clientName)
  const deadline = respondByText(r.respondBy, now)
  const headingId = `request-${r.bookingId}`

  return (
    <li aria-labelledby={headingId} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
      {when && (
        <span
          aria-hidden
          className="hidden w-14 shrink-0 flex-col items-center justify-center self-start rounded-lg bg-primary/[0.07] py-2 text-primary min-[400px]:flex dark:bg-primary/15"
        >
          <span className="text-[11px] font-medium leading-none">{when.tile.weekday}</span>
          <span className="mt-1 text-2xl font-semibold leading-none tabular-nums">{when.tile.day}</span>
          <span className="mt-1 text-[11px] font-medium leading-none">{when.tile.month}</span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 id={headingId} dir="auto" className="min-w-0 font-medium text-foreground [unicode-bidi:isolate]">
            {client}
          </h3>
          {deadline.text && (
            <p
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                deadline.urgent ? "text-attention" : "text-muted-foreground",
              )}
            >
              <Clock aria-hidden className="h-3.5 w-3.5" />
              {deadline.text}
            </p>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {r.service?.name && (
            <span dir="auto" className="text-foreground [unicode-bidi:isolate]">
              {r.service.name},{" "}
            </span>
          )}
          {when ? when.line : r.scheduledDate}
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="sr-only">Location: </span>
          <span dir="auto" className="min-w-0 break-words [unicode-bidi:isolate]">
            {locationText(r.location)}
          </span>
        </p>
        {r.notes && (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-foreground/90">
            <StickyNote aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="sr-only">Client&apos;s note: </span>
            <span dir="auto" className="line-clamp-3 min-w-0 break-words [unicode-bidi:isolate]">
              {r.notes}
            </span>
          </p>
        )}
        {price !== undefined && (
          <p className="mt-2 text-sm text-muted-foreground">
            {price && Number(price) > 0 ? (
              <>
                Agreed price <span className="font-semibold tabular-nums text-foreground">{formatGhs(price)}</span>
              </>
            ) : (
              "No price agreed yet. You set it when you accept."
            )}
          </p>
        )}
        {!deadline.expired && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
            <Button
              className="h-11 sm:h-9"
              onClick={() => onAccept(r)}
              disabled={disabled}
              aria-label={`Accept ${client}'s request`}
            >
              {busy ? (
                <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <Check aria-hidden className="h-4 w-4" />
              )}
              Accept
            </Button>
            <Button
              variant="outline"
              className="h-11 bg-transparent sm:h-9"
              onClick={() => onDecline(r)}
              disabled={disabled}
              aria-label={`Decline ${client}'s request`}
            >
              <X aria-hidden className="h-4 w-4" />
              Decline
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}
