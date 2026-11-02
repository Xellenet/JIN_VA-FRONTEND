import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  describeAvailability,
  timeOffText,
  weeklyHoursRows,
  type AvailabilitySummary,
  type AvailabilityTone,
  type PublicTimeOff,
  type PublicWeeklyHours,
} from "@/lib/availability"

const TONE_CLASS: Record<AvailabilityTone, string> = {
  positive: "border-primary/30 bg-primary/5 text-primary",
  neutral: "border-border bg-background text-foreground",
  muted: "border-border bg-muted text-muted-foreground",
}

/**
 * The artisan's availability in plain words ("Available today · 08:00–17:00",
 * "On time off until 12 Nov", …), computed by the API from their Calendar
 * settings. Falls back to the bare status when the API sends no summary.
 */
export function AvailabilityBadge({
  summary,
  status,
  className,
}: {
  summary?: AvailabilitySummary | null
  status?: string | null
  className?: string
}) {
  const { text, tone } = describeAvailability(summary, status)
  return (
    <Badge variant="outline" className={cn("max-w-full whitespace-normal text-left tabular-nums", TONE_CLASS[tone], className)}>
      <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="min-w-0">{text}</span>
    </Badge>
  )
}

/** Monday-first working hours ("Closed" on days without hours), plus upcoming time off. */
export function WorkingHoursSection({
  hours,
  timeOff,
  today,
  firstName,
}: {
  hours: PublicWeeklyHours[]
  timeOff: PublicTimeOff[]
  today?: string
  firstName: string
}) {
  const rows = weeklyHoursRows(hours)
  return (
    <section aria-labelledby="working-hours-title" className="max-w-md">
      <h3 id="working-hours-title" className="mb-3 text-sm font-semibold text-foreground">
        Working hours
      </h3>
      {hours.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {firstName} hasn&apos;t set working hours yet, so there are no times to book.
        </p>
      ) : (
        <dl className="divide-y rounded-lg border border-border text-sm">
          {rows.map((r) => (
            <div key={r.dayOfWeek} className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="text-foreground">{r.day}</dt>
              <dd className={cn("text-right tabular-nums", r.closed ? "text-muted-foreground" : "font-medium text-foreground")}>{r.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {timeOff.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Time off: </span>
          {timeOff.map((t) => timeOffText(t, today)).join("; ")}. No bookings on these dates.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Times are in Ghana time (GMT).</p>
    </section>
  )
}
