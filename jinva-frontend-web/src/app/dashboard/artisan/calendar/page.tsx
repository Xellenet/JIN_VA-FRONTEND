"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarDays, Plus, Trash2, Clock, CheckCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"

// 0=Sunday … 6=Saturday
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const STATUS_OPTIONS = [
  { value: "AVAILABLE",   label: "Available" },
  { value: "BUSY",        label: "Busy" },
  { value: "UNAVAILABLE", label: "Unavailable" },
]

interface ApiSlot {
  id: number
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

interface ApiAvailability {
  artisanProfileId: number
  status: string
  slots: ApiSlot[]
}

export default function ArtisanCalendarPage() {
  const [availability, setAvailability] = useState<ApiAvailability | null>(null)
  const [status, setStatus] = useState("AVAILABLE")
  const [slots, setSlots] = useState<ApiSlot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // New slot form
  const [newDay, setNewDay] = useState("1")
  const [newStart, setNewStart] = useState("08:00")
  const [newEnd, setNewEnd] = useState("17:00")
  const [isAddingSlot, setIsAddingSlot] = useState(false)

  useEffect(() => {
    apiFetch<ApiAvailability>("/availability/my")
      .then((data) => {
        setAvailability(data)
        setStatus(data.status ?? "AVAILABLE")
        setSlots(data.slots ?? [])
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const saveStatus = async () => {
    setIsSavingStatus(true)
    try {
      await apiFetch("/availability/my/status", {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
      toast.success("Availability status updated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.")
    } finally {
      setIsSavingStatus(false)
    }
  }

  const toggleSlotActive = async (slot: ApiSlot) => {
    try {
      await apiFetch(`/availability/my/slots/${slot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !slot.isActive }),
      })
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, isActive: !s.isActive } : s)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update slot.")
    }
  }

  const deleteSlot = async (id: number) => {
    setDeletingId(id)
    try {
      await apiFetch(`/availability/my/slots/${id}`, { method: "DELETE" })
      setSlots((prev) => prev.filter((s) => s.id !== id))
      toast.success("Slot removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove slot.")
    } finally {
      setDeletingId(null)
    }
  }

  const addSlot = async () => {
    if (!newStart || !newEnd) { toast.error("Please fill in start and end times."); return }
    if (newEnd <= newStart) { toast.error("End time must be after start time."); return }
    setIsAddingSlot(true)
    try {
      const created = await apiFetch<ApiSlot>("/availability/my/slots", {
        method: "POST",
        body: JSON.stringify({
          dayOfWeek: Number(newDay),
          startTime: newStart,
          endTime: newEnd,
          isActive: true,
        }),
      })
      setSlots((prev) => [...prev, created])
      toast.success("Slot added.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add slot.")
    } finally {
      setIsAddingSlot(false)
    }
  }

  const slotsByDay = DAY_NAMES.map((day, idx) => ({
    day,
    dayOfWeek: idx,
    slots: slots.filter((s) => s.dayOfWeek === idx),
  }))

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Availability</h1>
            <p className="text-sm text-muted-foreground">
              Set your availability status and working hours
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {/* Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Availability Status
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Current Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                  onClick={saveStatus}
                  disabled={isSavingStatus}
                >
                  {isSavingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Status"}
                </Button>
              </CardContent>
            </Card>

            {/* Working Hours */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Working Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                {slotsByDay.map(({ day, dayOfWeek, slots: daySlots }) => (
                  <div key={day} className="py-3">
                    <p className="mb-2 text-sm font-medium text-foreground">{day}</p>
                    {daySlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No slots — add one below</p>
                    ) : (
                      <div className="space-y-2">
                        {daySlots.map((slot) => (
                          <div
                            key={slot.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border px-3 py-2",
                              !slot.isActive && "opacity-50",
                            )}
                          >
                            <Switch
                              checked={slot.isActive}
                              onCheckedChange={() => toggleSlotActive(slot)}
                            />
                            <span className="flex-1 text-sm text-foreground">
                              {slot.startTime} – {slot.endTime}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              disabled={deletingId === slot.id}
                              onClick={() => deleteSlot(slot.id)}
                            >
                              {deletingId === slot.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Add Slot */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Add Working Slot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Day</Label>
                    <Select value={newDay} onValueChange={setNewDay}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.map((name, idx) => (
                          <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Time</Label>
                    <Input
                      type="time"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Time</Label>
                    <Input
                      type="time"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 bg-transparent"
                  onClick={addSlot}
                  disabled={isAddingSlot}
                >
                  {isAddingSlot
                    ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    : <Plus className="mr-2 h-3.5 w-3.5" />
                  }
                  Add Slot
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right column — summary */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Current Status</p>
                <p className="mt-1 font-medium text-foreground capitalize">{status.toLowerCase()}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total Slots</p>
                <p className="mt-1 font-medium text-foreground">{slots.length} defined</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Active Slots</p>
                <p className="mt-1 font-medium text-foreground">
                  {slots.filter((s) => s.isActive).length} active
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Days Available</p>
                <p className="mt-1 text-sm text-foreground">
                  {Array.from(new Set(slots.filter((s) => s.isActive).map((s) => s.dayOfWeek)))
                    .sort()
                    .map((d) => DAY_NAMES[d].slice(0, 3))
                    .join(", ") || "None"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
