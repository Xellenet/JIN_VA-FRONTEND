"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface TimeSlot {
  startTime: string
  endTime: string
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

/**
 * NFR (f): the time-slot selector has no accessible primitive backing it
 * today, so this builds one from Radix's RadioGroup — a real `role="radiogroup"`
 * of `role="radio"` options with correct `aria-checked`/roving keyboard focus
 * for free, each carrying an explicit `aria-label` that states the full time
 * range (not just a bare visual chip) and meeting WCAG AA contrast in its
 * selected/hover states via the same tokens used elsewhere in the app.
 */
export function TimeSlotSelector({
  slots,
  value,
  onChange,
  disabled,
}: {
  readonly slots: TimeSlot[]
  readonly value: string | null
  readonly onChange: (startTime: string) => void
  readonly disabled?: boolean
}) {
  if (slots.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No available times for this date — it may be fully booked or blocked. Please choose another date.
      </p>
    )
  }

  return (
    <RadioGroup
      value={value ?? undefined}
      onValueChange={onChange}
      disabled={disabled}
      aria-label="Available time slots"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {slots.map((slot) => {
        const id = `time-slot-${slot.startTime}`
        const label = `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`
        const isSelected = value === slot.startTime
        return (
          // relative: sr-only positions this radio button with `position:
          // absolute`. Without a positioned ancestor, the browser computes
          // its box far from the visible label, so focusing it on click
          // scrolls the whole page to "reveal" an element that's actually
          // sitting right here, clipped to 1x1px.
          <div key={slot.startTime} className="relative">
            <RadioGroupItem
              value={slot.startTime}
              id={id}
              className="peer sr-only"
              aria-label={`Time slot ${label}`}
            />
            <Label
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-lg border border-input px-3 py-2 text-center text-sm font-medium transition-colors",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {label}
            </Label>
          </div>
        )
      })}
    </RadioGroup>
  )
}
