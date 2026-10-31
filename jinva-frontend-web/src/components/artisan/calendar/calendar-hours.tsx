"use client"

import { useState } from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { RADIO_TILE_CLASS, RadioMark } from "@/components/settings/settings-row"
import { apiFetch, apiFetchWithMessage } from "@/lib/api"
import { formatTime12 } from "@/lib/overview"
import { cn } from "@/lib/utils"
import { threeLetterMonth } from "@/lib/spending"

// 0 = Sunday … 6 = Saturday (the API's dayOfWeek). Shown Monday first.
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Available", hint: "Clients can request bookings in your working hours." },
  { value: "BUSY", label: "Busy", hint: "You show as busy. Clients can still see your profile." },
  { value: "UNAVAILABLE", label: "Unavailable", hint: "Clients can't request bookings until you switch back." },
]

export interface ApiSlot {
  id: number
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

export interface ApiBlock {
  id: number
  startDate: string
  endDate: string
  reason?: string | null
}

const slotText = (s: Pick<ApiSlot, "startTime" | "endTime">) =>
  `${formatTime12(s.startTime) ?? s.startTime} – ${formatTime12(s.endTime) ?? s.endTime}`

function formatDay(value: string, withYear: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return value
  return threeLetterMonth(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }))
}

/** Availability status, saved as soon as it changes (H4). The saved value is what shows as current. */
export function StatusCard({ saved, onSaved }: { saved: string; onSaved: (status: string) => void }) {
  const [pending, setPending] = useState<string | null>(null)

  const change = async (next: string) => {
    if (next === saved || pending) return
    setPending(next)
    try {
      await apiFetch("/availability/my/status", { method: "PUT", body: JSON.stringify({ status: next }) })
      onSaved(next)
      toast.success(`Status saved: ${STATUS_OPTIONS.find((o) => o.value === next)?.label ?? next}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your status. Try again.")
    } finally {
      setPending(null)
    }
  }

  return (
    <section aria-labelledby="status-title" className="rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="status-title" className="text-[15px] font-semibold text-foreground">
          Taking bookings
        </h2>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {pending ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 aria-hidden className="h-3.5 w-3.5 motion-safe:animate-spin" />
              Saving…
            </span>
          ) : (
            <>Changes save straight away</>
          )}
        </p>
      </div>
      <RadioGroupPrimitive.Root
        aria-labelledby="status-title"
        value={pending ?? saved}
        onValueChange={(v) => void change(v)}
        disabled={pending != null}
        className="mt-4 grid gap-2 md:grid-cols-3"
      >
        {STATUS_OPTIONS.map((o) => (
          <RadioGroupPrimitive.Item
            key={o.value}
            value={o.value}
            aria-labelledby={`status-${o.value}-label`}
            aria-describedby={`status-${o.value}-hint`}
            className={cn(RADIO_TILE_CLASS, "items-start")}
          >
            <span className="mt-0.5">
              <RadioMark />
            </span>
            <span className="min-w-0">
              <span id={`status-${o.value}-label`} className="block text-sm font-medium text-foreground">
                {o.label}
                {saved === o.value && !pending && <span className="sr-only"> (current)</span>}
              </span>
              <span id={`status-${o.value}-hint`} className="mt-0.5 block text-xs text-muted-foreground">
                {o.hint}
              </span>
            </span>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </section>
  )
}

/** Weekly working hours: labelled switches, 44px remove buttons with a confirmation, and the add form. */
export function WorkingHoursCard({ slots, setSlots }: { slots: ApiSlot[]; setSlots: (fn: (prev: ApiSlot[]) => ApiSlot[]) => void }) {
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ApiSlot | null>(null)
  const [removing, setRemoving] = useState(false)
  const [day, setDay] = useState("1")
  const [start, setStart] = useState("08:00")
  const [end, setEnd] = useState("17:00")
  const [formError, setFormError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const toggle = async (slot: ApiSlot) => {
    setTogglingId(slot.id)
    try {
      await apiFetch(`/availability/my/slots/${slot.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !slot.isActive }) })
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, isActive: !s.isActive } : s)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update these hours. Try again.")
    } finally {
      setTogglingId(null)
    }
  }

  const remove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await apiFetch(`/availability/my/slots/${removeTarget.id}`, { method: "DELETE" })
      setSlots((prev) => prev.filter((s) => s.id !== removeTarget.id))
      toast.success("Hours removed.")
      setRemoveTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove these hours. Try again.")
    } finally {
      setRemoving(false)
    }
  }

  const add = async () => {
    const error = !start || !end ? "Choose a start and end time." : end <= start ? "The end time must be after the start time." : null
    setFormError(error)
    if (error) return
    setAdding(true)
    try {
      // QA AV-01: no isActive on create; new hours are on by default.
      const created = await apiFetch<ApiSlot>("/availability/my/slots", {
        method: "POST",
        body: JSON.stringify({ dayOfWeek: Number(day), startTime: start, endTime: end }),
      })
      setSlots((prev) => [...prev, created])
      toast.success(`Hours added for ${DAY_NAMES[Number(day)]}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add these hours. Try again.")
    } finally {
      setAdding(false)
    }
  }

  return (
    <section aria-labelledby="hours-title" className="rounded-xl border bg-card">
      <div className="border-b px-4 py-4 sm:px-6">
        <h2 id="hours-title" className="text-[15px] font-semibold text-foreground">
          Working hours
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clients can request bookings inside these hours. Switch a time off to pause it without deleting it.
        </p>
      </div>

      <ul className="divide-y">
        {DAY_ORDER.map((d) => {
          const daySlots = slots.filter((s) => s.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime))
          return (
            <li key={d} className="grid gap-2 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start sm:px-6">
              <h3 className="pt-2.5 text-sm font-medium text-foreground">{DAY_NAMES[d]}</h3>
              {daySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground sm:pt-2.5">No hours set</p>
              ) : (
                <ul className="space-y-1">
                  {daySlots.map((slot) => {
                    const id = `slot-${slot.id}`
                    return (
                      <li key={slot.id} className="flex min-h-11 items-center gap-3">
                        <Switch
                          id={id}
                          checked={slot.isActive}
                          disabled={togglingId === slot.id}
                          onCheckedChange={() => void toggle(slot)}
                          aria-describedby={`${id}-state`}
                        />
                        <Label htmlFor={id} className="flex min-h-11 flex-1 cursor-pointer flex-wrap items-center gap-x-2 font-normal">
                          <span className={cn("tabular-nums text-foreground", !slot.isActive && "text-muted-foreground line-through")}>
                            {DAY_NAMES[d]} {slotText(slot)}
                          </span>
                          <span id={`${id}-state`} className="text-xs text-muted-foreground">
                            {slot.isActive ? "On" : "Paused"}
                          </span>
                        </Label>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setRemoveTarget(slot)}
                          aria-label={`Remove ${DAY_NAMES[d]} ${slotText(slot)}`}
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      <form
        noValidate
        className="border-t px-4 py-4 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <h3 className="text-sm font-semibold text-foreground">Add hours</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="slot-day">Day</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger id="slot-day" className="w-full data-[size=default]:h-11 sm:data-[size=default]:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_ORDER.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {DAY_NAMES[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slot-start">Start time</Label>
            <Input id="slot-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-11 sm:h-9" aria-invalid={formError != null} aria-describedby={formError ? "slot-error" : undefined} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slot-end">End time</Label>
            <Input id="slot-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-11 sm:h-9" aria-invalid={formError != null} aria-describedby={formError ? "slot-error" : undefined} />
          </div>
        </div>
        {formError && (
          <p id="slot-error" role="alert" className="mt-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" variant="outline" className="mt-3 h-11 bg-transparent sm:h-9" disabled={adding}>
          {adding ? <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" /> : <Plus aria-hidden className="h-4 w-4" />}
          Add hours
        </Button>
      </form>

      <AlertDialog open={removeTarget != null} onOpenChange={(open) => !open && !removing && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removeTarget ? `${DAY_NAMES[removeTarget.dayOfWeek]} ${slotText(removeTarget)}` : "these hours"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Clients can no longer request bookings in this time. Bookings you already have stay as they are. To stop
              for a while instead, switch the hours off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9" disabled={removing}>
              Keep hours
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-white hover:bg-destructive/90 sm:h-9"
              disabled={removing}
              onClick={(e) => {
                e.preventDefault()
                void remove()
              }}
            >
              {removing && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
              Remove hours
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/** Time off (blocked date ranges). */
export function TimeOffCard({
  blocks,
  loading,
  setBlocks,
}: {
  blocks: ApiBlock[]
  loading: boolean
  setBlocks: (fn: (prev: ApiBlock[]) => ApiBlock[]) => void
}) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ApiBlock | null>(null)
  const [removing, setRemoving] = useState(false)

  const rangeText = (b: ApiBlock) =>
    b.startDate.slice(0, 10) === b.endDate.slice(0, 10)
      ? formatDay(b.startDate, true)
      : `${formatDay(b.startDate, false)} to ${formatDay(b.endDate, true)}`

  const add = async () => {
    const error =
      !startDate || !endDate
        ? "Choose a start and end date."
        : endDate < startDate
          ? "The end date must be on or after the start date."
          : null
    setFormError(error)
    if (error) return
    setAdding(true)
    try {
      const { data: created, message } = await apiFetchWithMessage<ApiBlock & { conflictingBookingIds?: number[] }>(
        "/availability/my/blocks",
        { method: "POST", body: JSON.stringify({ startDate, endDate, reason: reason.trim() || undefined }) },
      )
      setBlocks((prev) => [...prev, created])
      setStartDate("")
      setEndDate("")
      setReason("")
      // QA AV-06: bookings already in the range aren't cancelled; say so.
      if (created.conflictingBookingIds?.length) {
        toast.warning(message ?? "Time off added, but you still have bookings on these dates.")
      } else {
        toast.success("Time off added. Clients can't request bookings on these dates.")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add this time off. Try again.")
    } finally {
      setAdding(false)
    }
  }

  const remove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await apiFetch(`/availability/my/blocks/${removeTarget.id}`, { method: "DELETE" })
      setBlocks((prev) => prev.filter((b) => b.id !== removeTarget.id))
      toast.success("Time off removed.")
      setRemoveTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove this time off. Try again.")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <section aria-labelledby="timeoff-title" className="rounded-xl border bg-card">
      <div className="border-b px-4 py-4 sm:px-6">
        <h2 id="timeoff-title" className="text-[15px] font-semibold text-foreground">
          Time off
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Clients can&apos;t request bookings on these dates.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 aria-hidden className="h-5 w-5 text-muted-foreground motion-safe:animate-spin" />
          <span className="sr-only">Loading your time off</span>
        </div>
      ) : blocks.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground sm:px-6">No time off planned.</p>
      ) : (
        <ul className="divide-y">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-2 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{rangeText(b)}</p>
                {b.reason && (
                  <p dir="auto" className="break-words text-sm text-muted-foreground [unicode-bidi:isolate]">
                    {b.reason}
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setRemoveTarget(b)}
                aria-label={`Remove time off ${rangeText(b)}`}
              >
                <Trash2 aria-hidden className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        noValidate
        className="border-t px-4 py-4 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <h3 className="text-sm font-semibold text-foreground">Add time off</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="block-start">First day off</Label>
            <Input id="block-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 sm:h-9" aria-invalid={formError != null} aria-describedby={formError ? "block-error" : undefined} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="block-end">Last day off</Label>
            <Input id="block-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 sm:h-9" aria-invalid={formError != null} aria-describedby={formError ? "block-error" : undefined} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="block-reason">Reason (optional)</Label>
            <Textarea id="block-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="For example, a public holiday" />
          </div>
        </div>
        {formError && (
          <p id="block-error" role="alert" className="mt-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" variant="outline" className="mt-3 h-11 bg-transparent sm:h-9" disabled={adding}>
          {adding ? <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" /> : <Plus aria-hidden className="h-4 w-4" />}
          Add time off
        </Button>
      </form>

      <AlertDialog open={removeTarget != null} onOpenChange={(open) => !open && !removing && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove time off{removeTarget ? ` ${rangeText(removeTarget)}` : ""}?</AlertDialogTitle>
            <AlertDialogDescription>Clients can request bookings on these dates again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9" disabled={removing}>
              Keep time off
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-white hover:bg-destructive/90 sm:h-9"
              disabled={removing}
              onClick={(e) => {
                e.preventDefault()
                void remove()
              }}
            >
              {removing && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
              Remove time off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
