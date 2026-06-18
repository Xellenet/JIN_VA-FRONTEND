"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { CalendarDays, Plus, Trash2, Clock, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface WorkingHour {
  day: string
  enabled: boolean
  start: string
  end: string
}

interface BlockedDate {
  id: string
  start: string
  end: string
  reason: string
}

interface UpcomingBooking {
  id: string
  clientName: string
  service: string
  date: string
  time: string
  status: "confirmed" | "pending"
}

const INITIAL_HOURS: WorkingHour[] = [
  { day: "Monday",    enabled: true,  start: "08:00", end: "17:00" },
  { day: "Tuesday",   enabled: true,  start: "08:00", end: "17:00" },
  { day: "Wednesday", enabled: true,  start: "08:00", end: "17:00" },
  { day: "Thursday",  enabled: true,  start: "08:00", end: "17:00" },
  { day: "Friday",    enabled: true,  start: "08:00", end: "16:00" },
  { day: "Saturday",  enabled: false, start: "09:00", end: "13:00" },
  { day: "Sunday",    enabled: false, start: "09:00", end: "13:00" },
]

const MOCK_BLOCKED: BlockedDate[] = [
  { id: "1", start: "2026-07-04", end: "2026-07-06", reason: "Public holiday" },
  { id: "2", start: "2026-08-14", end: "2026-08-14", reason: "Personal appointment" },
]

const MOCK_BOOKINGS: UpcomingBooking[] = [
  { id: "1", clientName: "Sarah Williams", service: "Plumbing Repair",      date: "2026-06-22", time: "10:00", status: "confirmed" },
  { id: "2", clientName: "James Osei",     service: "Electrical Inspection", date: "2026-06-24", time: "14:00", status: "pending"   },
  { id: "3", clientName: "Amara Diallo",   service: "Carpentry Work",        date: "2026-06-27", time: "09:00", status: "confirmed" },
]

export default function ArtisanCalendarPage() {
  const [hours, setHours] = useState<WorkingHour[]>(INITIAL_HOURS)
  const [blocked, setBlocked] = useState<BlockedDate[]>(MOCK_BLOCKED)
  const [newStart, setNewStart]   = useState("")
  const [newEnd, setNewEnd]       = useState("")
  const [newReason, setNewReason] = useState("")
  const [saving, setSaving]       = useState(false)

  const toggleDay = (idx: number) => {
    setHours((prev) =>
      prev.map((h, i) => (i === idx ? { ...h, enabled: !h.enabled } : h)),
    )
  }

  const updateTime = (idx: number, field: "start" | "end", val: string) => {
    setHours((prev) =>
      prev.map((h, i) => (i === idx ? { ...h, [field]: val } : h)),
    )
  }

  const addBlocked = () => {
    if (!newStart || !newEnd) {
      toast.error("Please provide start and end dates.")
      return
    }
    if (new Date(newEnd) < new Date(newStart)) {
      toast.error("End date must be after start date.")
      return
    }
    setBlocked((prev) => [
      ...prev,
      { id: String(Date.now()), start: newStart, end: newEnd, reason: newReason || "Unavailable" },
    ])
    setNewStart("")
    setNewEnd("")
    setNewReason("")
    toast.success("Blocked dates added.")
  }

  const removeBlocked = (id: string) => {
    setBlocked((prev) => prev.filter((b) => b.id !== id))
    toast.success("Blocked date removed.")
  }

  const handleSave = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 800))
    setSaving(false)
    toast.success("Availability saved successfully.")
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Availability</h1>
            <p className="text-sm text-muted-foreground">
              Set your working hours and block dates when you're unavailable
            </p>
          </div>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90 sm:shrink-0"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Saving…
              </span>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {/* Left column */}
          <div className="space-y-5">
            {/* Working Hours */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Working Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                {hours.map((h, idx) => (
                  <div
                    key={h.day}
                    className={cn(
                      "flex items-center gap-4 py-3",
                      !h.enabled && "opacity-50",
                    )}
                  >
                    <Switch
                      checked={h.enabled}
                      onCheckedChange={() => toggleDay(idx)}
                    />
                    <span className="w-24 shrink-0 text-sm font-medium text-foreground">
                      {h.day}
                    </span>
                    {h.enabled ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          type="time"
                          value={h.start}
                          onChange={(e) => updateTime(idx, "start", e.target.value)}
                          className="h-8 w-28 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={h.end}
                          onChange={(e) => updateTime(idx, "end", e.target.value)}
                          className="h-8 w-28 text-sm"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Closed</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Blocked Dates */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Blocked Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing blocks */}
                {blocked.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No blocked dates.</p>
                ) : (
                  <div className="space-y-2">
                    {blocked.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {fmt(b.start)}
                            {b.end !== b.start && ` → ${fmt(b.end)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{b.reason}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeBlocked(b.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new */}
                <div className="rounded-xl border border-dashed p-4">
                  <p className="mb-3 text-sm font-medium text-foreground">Add Blocked Period</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Start Date</Label>
                      <Input
                        type="date"
                        value={newStart}
                        onChange={(e) => setNewStart(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">End Date</Label>
                      <Input
                        type="date"
                        value={newEnd}
                        onChange={(e) => setNewEnd(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Reason (optional)</Label>
                      <Input
                        placeholder="e.g. Holiday, Personal leave"
                        value={newReason}
                        onChange={(e) => setNewReason(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 bg-transparent"
                    onClick={addBlocked}
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Add Block
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column — Upcoming Bookings */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upcoming Bookings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {MOCK_BOOKINGS.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
              ) : (
                MOCK_BOOKINGS.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-lg border p-3 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {b.clientName}
                        </p>
                        <p className="text-xs text-muted-foreground">{b.service}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          b.status === "confirmed"
                            ? "shrink-0 border-primary/20 bg-primary/5 text-xs text-primary"
                            : "shrink-0 border-border bg-muted text-xs text-muted-foreground"
                        }
                      >
                        {b.status === "confirmed" ? "Confirmed" : "Pending"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {fmt(b.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {b.time}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
