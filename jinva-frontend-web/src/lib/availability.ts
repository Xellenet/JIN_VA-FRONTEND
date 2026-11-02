import { formatClock, formatDay, formatDayWithWeekday } from "./artisan-jobs"

/**
 * QA ART-08: an artisan's availability has three states, and UNAVAILABLE used
 * to be shown as "Busy" everywhere because each page only knew two.
 * Still the fallback when the API doesn't send `availability` (older API).
 */
export function availabilityLabel(status: string | null | undefined): "Available" | "Busy" | "Unavailable" {
  if (status === "AVAILABLE") return "Available"
  if (status === "UNAVAILABLE") return "Unavailable"
  return "Busy"
}

/**
 * What clients see, computed by the API (Africa/Accra time) from the artisan's
 * Calendar settings: weekly hours, time off, status and bookings. Sent on
 * `GET /artisans`, `GET /artisans/:id`, `GET /favourites` (`availability`) and
 * `GET /availability/my` (`summary`).
 */
export type AvailabilityState = "available_today" | "next_available" | "on_time_off" | "no_hours" | "busy" | "unavailable"

export interface AvailabilitySummary {
  state: AvailabilityState
  /** The Accra date this was computed for (YYYY-MM-DD). */
  today: string
  hasWorkingHours: boolean
  onTimeOffUntil: string | null
  todayHours: { startTime: string; endTime: string }[]
  nextAvailableDate: string | null
  /** Clients can request a booking in the next 14 days. */
  bookable: boolean
}

export interface PublicWeeklyHours {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface PublicTimeOff {
  startDate: string
  endDate: string
}

/** How the line is styled. The words always carry the meaning; colour only repeats it. */
export type AvailabilityTone = "positive" | "neutral" | "muted"

export interface AvailabilityText {
  text: string
  tone: AvailabilityTone
  /** False when clients can't book in the next 14 days (or at all). */
  bookable: boolean
}

/** "Tue 3 Nov" ("Tue 3 Nov 2027" in another year). */
export function shortDayWithWeekday(date: string, today?: string): string {
  return dropYear(formatDayWithWeekday(date).replace(/^(\p{L}+),/u, "$1"), date, today)
}

/** "12 Nov" ("12 Nov 2027" in another year). */
export function shortDay(date: string, today?: string): string {
  return dropYear(formatDay(date), date, today)
}

function dropYear(text: string, date: string, today?: string): string {
  const year = date.slice(0, 4)
  const current = (today ?? new Date().toISOString()).slice(0, 4)
  return year === current ? text.replace(new RegExp(`,?\\s${year}$`), "") : text
}

/** "08:00–12:00, 13:00–17:00" — every window in order. */
export function hoursText(windows: { startTime: string; endTime: string }[]): string {
  return [...windows]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((w) => `${formatClock(w.startTime)}–${formatClock(w.endTime)}`)
    .join(", ")
}

/** "08:00–17:00" — first start to last end, for a compact card line. */
export function hoursSpan(windows: { startTime: string; endTime: string }[]): string {
  if (windows.length === 0) return ""
  const starts = windows.map((w) => formatClock(w.startTime)).sort()
  const ends = windows.map((w) => formatClock(w.endTime)).sort()
  return `${starts[0]}–${ends[ends.length - 1]}`
}

/**
 * The plain-words availability line shown on search cards, favourites, the
 * client profile and the artisan's own "What clients see". Falls back to the
 * bare status (`availabilityLabel`) when the API didn't send a summary.
 */
export function describeAvailability(
  summary: AvailabilitySummary | null | undefined,
  fallbackStatus?: string | null,
): AvailabilityText {
  if (!summary) {
    const label = availabilityLabel(fallbackStatus)
    return { text: label, tone: label === "Available" ? "positive" : "muted", bookable: label === "Available" }
  }
  const { today, bookable } = summary
  switch (summary.state) {
    case "available_today": {
      const span = hoursSpan(summary.todayHours)
      return { text: span ? `Available today · ${span}` : "Available today", tone: "positive", bookable }
    }
    case "next_available":
      return summary.nextAvailableDate
        ? { text: `Next available ${shortDayWithWeekday(summary.nextAvailableDate, today)}`, tone: "neutral", bookable }
        : { text: "No free days in the next 2 weeks", tone: "muted", bookable: false }
    case "on_time_off":
      return {
        text: summary.onTimeOffUntil ? `On time off until ${shortDay(summary.onTimeOffUntil, today)}` : "On time off",
        tone: "neutral",
        bookable,
      }
    case "busy":
      return { text: "Busy", tone: "muted", bookable: false }
    case "no_hours":
    case "unavailable":
    default:
      return { text: "Not taking bookings", tone: "muted", bookable: false }
  }
}

/**
 * Why a client can't book right now, for the Book button's explanation, or
 * null when they can.
 */
export function notBookableReason(summary: AvailabilitySummary | null | undefined, fallbackStatus?: string | null): string | null {
  if (!summary) {
    return fallbackStatus && fallbackStatus !== "AVAILABLE" ? "This artisan isn't taking new bookings right now." : null
  }
  if (summary.bookable) return null
  switch (summary.state) {
    case "busy":
      return "This artisan is busy and isn't taking new bookings right now."
    case "unavailable":
      return "This artisan isn't taking bookings right now."
    case "no_hours":
      return "This artisan hasn't set their working hours yet, so there are no times to book."
    default:
      return "This artisan has no free days in the next 2 weeks."
  }
}

// 0 = Sunday … 6 = Saturday (the API's dayOfWeek). Shown Monday first.
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** Monday-first rows for a "Working hours" table: each day's windows, or "Closed". */
export function weeklyHoursRows(hours: PublicWeeklyHours[]): { dayOfWeek: number; day: string; text: string; closed: boolean }[] {
  return WEEK_ORDER.map((d) => {
    const windows = hours.filter((h) => h.dayOfWeek === d)
    return { dayOfWeek: d, day: WEEKDAY_NAMES[d], text: windows.length ? hoursText(windows) : "Closed", closed: windows.length === 0 }
  })
}

/** "10 Nov" or "10 Nov to 12 Nov" for one time-off range. */
export function timeOffText(range: PublicTimeOff, today?: string): string {
  const start = range.startDate.slice(0, 10)
  const end = range.endDate.slice(0, 10)
  return start === end ? shortDay(start, today) : `${shortDay(start, today)} to ${shortDay(end, today)}`
}
