"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  CheckCircle,
  Loader2,
  FileText,
  Lightbulb,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface BackendService {
  id: string
  name: string
  description?: string
  price?: number
}

const TIPS = [
  "Be as specific as possible about the problem — it helps artisans prepare the right tools.",
  "A realistic budget range gets you faster, higher-quality applications.",
  "Include photos of the issue in your description if possible.",
  "Set a preferred date but be flexible — good artisans are often booked 2–3 days ahead.",
]

// ─── Field validation ─────────────────────────────────────────────────────────

interface FieldErrors {
  service?: string
  title?: string
  description?: string
  address?: string
  budgetMin?: string
  budgetMax?: string
}

function validate(fields: {
  selectedService: string
  title: string
  description: string
  address: string
  budgetMin: string
  budgetMax: string
}): FieldErrors {
  const errs: FieldErrors = {}
  if (!fields.selectedService) errs.service = "Please select a service category."
  if (!fields.title.trim()) errs.title = "Job title is required."
  else if (fields.title.trim().length < 5) errs.title = "Title must be at least 5 characters."
  if (!fields.description.trim()) errs.description = "Please describe the problem."
  else if (fields.description.trim().length < 10) errs.description = "Description must be at least 10 characters."
  if (!fields.address.trim()) errs.address = "Service address is required."
  if (!fields.budgetMin) errs.budgetMin = "Enter a minimum budget."
  else if (Number(fields.budgetMin) < 0) errs.budgetMin = "Budget cannot be negative."
  if (!fields.budgetMax) errs.budgetMax = "Enter a maximum budget."
  else if (Number(fields.budgetMax) < 0) errs.budgetMax = "Budget cannot be negative."
  if (fields.budgetMin && fields.budgetMax && Number(fields.budgetMin) > Number(fields.budgetMax))
    errs.budgetMax = "Maximum must be greater than or equal to minimum."
  return errs
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PostJobPage() {
  const router = useRouter()

  const [services, setServices] = useState<BackendService[]>([])
  const [selectedService, setSelectedService] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [address, setAddress] = useState("")
  const [budgetMin, setBudgetMin] = useState("")
  const [budgetMax, setBudgetMax] = useState("")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const [touched, setTouched] = useState<Partial<Record<keyof FieldErrors, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  useEffect(() => {
    apiFetch<BackendService[] | { items: BackendService[] }>("/services")
      .then((r) => setServices(Array.isArray(r) ? r : (r as { items: BackendService[] }).items ?? []))
      .catch(() => setServices([]))
  }, [])

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.")
      return
    }
    setIsGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { "Accept-Language": "en" } },
          )
          const data = await res.json()
          setAddress(data.display_name ?? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`)
        } catch {
          setAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`)
        }
        setTouched((t) => ({ ...t, address: true }))
        setIsGettingLocation(false)
      },
      () => {
        toast.error("Could not get your location. Please allow location access and try again.")
        setIsGettingLocation(false)
      },
      { timeout: 10000 },
    )
  }

  const selectedServiceData = services.find((s) => String(s.id) === selectedService)

  const errors = validate({ selectedService, title, description, address, budgetMin, budgetMax })
  const isFormValid = Object.keys(errors).length === 0

  // Show an error only if the field has been touched OR submit was attempted
  const showError = (field: keyof FieldErrors) =>
    !!(errors[field] && (touched[field] || submitAttempted))

  const mark = (field: keyof FieldErrors) => setTouched((t) => ({ ...t, [field]: true }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!isFormValid) {
      toast.error("Please fix the highlighted fields before submitting.")
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        description: `${description.trim()}${date ? `\n\nPreferred date: ${date}${time ? ` at ${time}` : ""}` : ""}`,
        location: address.trim(),
        serviceId: selectedService,
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
      }
      const job = await apiFetch<{ id: string }>("/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setCreatedJobId(String(job.id))
      setShowConfirmation(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post job.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const today = new Date().toISOString().split("T")[0]

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })

  const fmtTime = (t: string) => {
    const [h, m] = t.split(":")
    const hour = Number(h)
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/user">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Post a Job</h1>
          <p className="text-sm text-muted-foreground">
            Describe what you need — skilled artisans will apply and you choose the best fit
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Form ─────────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-5 lg:col-span-2">

            {/* Job Details */}
            <Card>
              <div className="border-b p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Job Details
                </h3>
              </div>
              <CardContent className="space-y-5 p-5">

                {/* Service Category */}
                <div className="w-full space-y-2">
                  <Label>
                    Service Category{!selectedService && <span className="ml-0.5 text-destructive">*</span>}
                  </Label>
                  <div className="w-full">
                    <Select
                      value={selectedService}
                      onValueChange={(v) => { setSelectedService(v); mark("service") }}
                    >
                      <SelectTrigger
                        className={cn("w-full min-w-0", showError("service") && "border-destructive")}
                        onBlur={() => mark("service")}
                      >
                        <SelectValue placeholder="What kind of work do you need?" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.length === 0 ? (
                          <SelectItem value="__loading" disabled>Loading services…</SelectItem>
                        ) : (
                          services.map((s) => (
                            <SelectItem key={String(s.id)} value={String(s.id)}>{s.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {showError("service") && (
                    <p className="text-xs text-destructive">{errors.service}</p>
                  )}
                </div>

                {/* Job Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Job Title{!title.trim() && <span className="ml-0.5 text-destructive">*</span>}
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g. Fix leaking kitchen tap, Install new light switches"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => mark("title")}
                    className={cn(showError("title") && "border-destructive")}
                  />
                  {showError("title") && (
                    <p className="text-xs text-destructive">{errors.title}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Describe the Problem{!description.trim() && <span className="ml-0.5 text-destructive">*</span>}
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the issue in detail — what's happening, how long it's been going on, any relevant context…"
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => mark("description")}
                    className={cn(showError("description") && "border-destructive")}
                  />
                  <p className={cn(
                    "text-xs",
                    showError("description") ? "text-destructive" : "text-muted-foreground",
                  )}>
                    {showError("description") ? errors.description : `${description.length}/500 characters — more detail = better artisan match`}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Schedule & Location */}
            <Card>
              <div className="border-b p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  Schedule & Location
                </h3>
              </div>
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="date">Preferred Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="date"
                        type="date"
                        className="pl-10"
                        min={today}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Preferred Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="time"
                        type="time"
                        className="pl-10"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">
                    Service Address{!address.trim() && <span className="ml-0.5 text-destructive">*</span>}
                  </Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={isGettingLocation}
                      title="Use my current location"
                      className="absolute left-3 top-3 text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
                    >
                      {isGettingLocation ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                    </button>
                    <Textarea
                      id="address"
                      className={cn("pl-10", showError("address") && "border-destructive")}
                      placeholder="Full address where the work should be done — or click the pin to use your location"
                      rows={2}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      onBlur={() => mark("address")}
                    />
                  </div>
                  {showError("address") ? (
                    <p className="text-xs text-destructive">{errors.address}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Click the pin icon to automatically fill your current location.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Budget */}
            <Card>
              <div className="border-b p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Budget Range
                </h3>
              </div>
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="budgetMin">
                      Minimum (GH₵){!budgetMin && <span className="ml-0.5 text-destructive">*</span>}
                    </Label>
                    <Input
                      id="budgetMin"
                      type="number"
                      min="0"
                      placeholder="50"
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value)}
                      onBlur={() => mark("budgetMin")}
                      className={cn(showError("budgetMin") && "border-destructive")}
                    />
                    {showError("budgetMin") && (
                      <p className="text-xs text-destructive">{errors.budgetMin}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budgetMax">
                      Maximum (GH₵){!budgetMax && <span className="ml-0.5 text-destructive">*</span>}
                    </Label>
                    <Input
                      id="budgetMax"
                      type="number"
                      min="0"
                      placeholder="300"
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                      onBlur={() => mark("budgetMax")}
                      className={cn(showError("budgetMax") && "border-destructive")}
                    />
                    {showError("budgetMax") && (
                      <p className="text-xs text-destructive">{errors.budgetMax}</p>
                    )}
                  </div>
                </div>
                {budgetMin && budgetMax && Number(budgetMin) <= Number(budgetMax) && (
                  <p className="text-sm text-muted-foreground">
                    Budget range:{" "}
                    <span className="font-medium text-foreground">
                      GH₵ {Number(budgetMin).toLocaleString()} – GH₵ {Number(budgetMax).toLocaleString()}
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="button" variant="outline" asChild className="flex-1 bg-transparent md:flex-none">
                <Link href="/dashboard/user">Cancel</Link>
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 md:flex-none md:px-8"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post Job
              </Button>
            </div>
          </form>

          {/* ── Sidebar ───────────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Job Summary — mirrors every field in Job Details */}
            <Card>
              <div className="border-b p-4">
                <h3 className="text-sm font-semibold text-foreground">Job Summary</h3>
              </div>
              <CardContent className="divide-y divide-border p-0">
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Service Category</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {selectedServiceData?.name || <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Job Title</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {title || <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="mt-0.5 text-sm text-foreground line-clamp-3">
                    {description.trim() || <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Preferred Date & Time</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {date
                      ? `${fmtDate(date)}${time ? `, ${fmtTime(time)}` : ""}`
                      : <span className="text-muted-foreground">Flexible</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Service Address</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground line-clamp-2">
                    {address.trim() || <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Budget Range</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {budgetMin && budgetMax && Number(budgetMin) <= Number(budgetMax)
                      ? `GH₵ ${Number(budgetMin).toLocaleString()} – GH₵ ${Number(budgetMax).toLocaleString()}`
                      : <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <div className="border-b p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Tips for a great post
                </h3>
              </div>
              <CardContent className="p-4">
                <ul className="space-y-3">
                  {TIPS.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                        {i + 1}
                      </span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Browse artisans */}
            <Card className="bg-muted/30">
              <CardContent className="p-4 text-center">
                <p className="text-sm font-medium text-foreground">Know who you want?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Browse and book a specific artisan directly.
                </p>
                <Button variant="outline" size="sm" className="mt-3 bg-transparent" asChild>
                  <Link href="/dashboard/user/search">Browse Artisans</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Success dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle>Job Posted!</DialogTitle>
            <DialogDescription>
              Your job is now live. Artisans will review it and send you applications. You'll be notified when someone applies.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium text-foreground">{selectedServiceData?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title</span>
                <span className="max-w-[180px] truncate font-medium text-foreground">{title}</span>
              </div>
              {date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preferred Date</span>
                  <span className="font-medium text-foreground">
                    {fmtDate(date)}{time ? ` at ${fmtTime(time)}` : ""}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-medium text-foreground">
                  GH₵ {Number(budgetMin).toLocaleString()} – GH₵ {Number(budgetMax).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => router.push(createdJobId ? `/dashboard/user/bookings/${createdJobId}` : "/dashboard/user/bookings")}
            >
              Track My Job
            </Button>
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={() => { setShowConfirmation(false); router.push("/dashboard/user") }}
            >
              Back to Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
