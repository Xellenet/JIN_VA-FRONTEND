"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { AttachmentUploader } from "@/components/dashboard/attachment-uploader"
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
  Wallet,
  CheckCircle,
  Loader2,
  FileText,
  Lightbulb,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { cn, formatCurrency } from "@/lib/utils"
import { threeLetterMonth } from "@/lib/spending"

interface BackendService {
  id: number | string
  name: string
  description?: string | null
}

type ServicesState = "loading" | "ready" | "error"

// The API's limits (CreateJobDto); the description leaves room for the
// preferred date and time this page appends to it.
const TITLE_MAX = 150
const DESCRIPTION_MAX = 1500
const ADDRESS_MAX = 200

const TIPS = [
  "Be as specific as possible about the problem. It helps artisans bring the right tools.",
  "A realistic budget range gets you more, and better, applications.",
  "Add photos of the problem if you can. They help artisans judge the work before they apply.",
  "Pick a preferred date but stay flexible. Good artisans are often booked a few days ahead.",
]

// ─── Field validation ─────────────────────────────────────────────────────────

interface FieldErrors {
  service?: string
  title?: string
  description?: string
  date?: string
  address?: string
  budgetMin?: string
  budgetMax?: string
}

/** Form order, so a failed submit can focus the first problem. */
const FIELD_ORDER: ReadonlyArray<keyof FieldErrors> = [
  "service", "title", "description", "date", "address", "budgetMin", "budgetMax",
]

/** Today in Ghana (UTC, no daylight saving) as YYYY-MM-DD. */
const todayIso = () => new Date().toISOString().split("T")[0]

const isAmount = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim())

function validate(fields: {
  selectedService: string
  title: string
  description: string
  date: string
  address: string
  budgetMin: string
  budgetMax: string
}): FieldErrors {
  const errs: FieldErrors = {}
  if (!fields.selectedService) errs.service = "Choose the type of work you need."
  if (!fields.title.trim()) errs.title = "Enter a job title."
  else if (fields.title.trim().length < 5) errs.title = "The title must be at least 5 characters."
  else if (fields.title.trim().length > TITLE_MAX) errs.title = `The title must be ${TITLE_MAX} characters or fewer.`
  if (!fields.description.trim()) errs.description = "Describe the problem."
  else if (fields.description.trim().length < 10) errs.description = "The description must be at least 10 characters."
  else if (fields.description.trim().length > DESCRIPTION_MAX)
    errs.description = `The description must be ${DESCRIPTION_MAX.toLocaleString("en-GB")} characters or fewer.`
  if (fields.date && fields.date < todayIso()) errs.date = "Choose today or a later date."
  if (!fields.address.trim()) errs.address = "Enter the address where the work should be done."
  else if (fields.address.trim().length > ADDRESS_MAX) errs.address = `The address must be ${ADDRESS_MAX} characters or fewer.`
  if (!fields.budgetMin.trim()) errs.budgetMin = "Enter a minimum budget."
  else if (!isAmount(fields.budgetMin)) errs.budgetMin = "Enter an amount in cedis, such as 50 or 75.50."
  if (!fields.budgetMax.trim()) errs.budgetMax = "Enter a maximum budget."
  else if (!isAmount(fields.budgetMax)) errs.budgetMax = "Enter an amount in cedis, such as 300 or 450.50."
  else if (Number(fields.budgetMax) <= 0) errs.budgetMax = "The maximum must be more than GH₵ 0.00."
  if (!errs.budgetMin && !errs.budgetMax && Number(fields.budgetMin) > Number(fields.budgetMax))
    errs.budgetMax = "The maximum must be the same as or more than the minimum."
  return errs
}

const fmtDate = (d: string, withYear = false) =>
  threeLetterMonth(
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    }).replace(",", ""),
  )

const fmtTime = (t: string) => {
  const [h, m] = t.split(":")
  const hour = Number(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "pm" : "am"}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PostJobPage() {
  const router = useRouter()

  const [services, setServices] = useState<BackendService[]>([])
  const [servicesState, setServicesState] = useState<ServicesState>("loading")
  const [selectedService, setSelectedService] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [address, setAddress] = useState("")
  const [budgetMin, setBudgetMin] = useState("")
  const [budgetMax, setBudgetMax] = useState("")
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const [touched, setTouched] = useState<Partial<Record<keyof FieldErrors, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const loadServices = useCallback(() => {
    setServicesState("loading")
    apiFetch<BackendService[] | { items: BackendService[] }>("/services?limit=200")
      .then((r) => {
        const list = Array.isArray(r) ? r : (r.items ?? [])
        setServices([...list].sort((a, b) => a.name.localeCompare(b.name, "en-GB")))
        setServicesState("ready")
      })
      .catch(() => {
        setServices([])
        setServicesState("error")
      })
  }, [])

  useEffect(() => { loadServices() }, [loadServices])

  /** Browser location rougher than this (metres) is not used at all. */
  const LOCATION_REJECT_METRES = 5000
  /** Rougher than this is used, with a "check the address" note. */
  const LOCATION_WARN_METRES = 1000

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Your browser can't share your location. Please type the address.")
      return
    }
    setIsGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        // Computers without GPS are placed by their internet connection, which
        // in Ghana often resolves to Accra wherever the person is. The browser
        // says how sure it is (`accuracy`, metres): too rough and we fill
        // nothing (and send nothing to the lookup); a little rough and we ask
        // the person to check.
        const km = Math.round((coords.accuracy ?? 0) / 1000)
        if (coords.accuracy > LOCATION_REJECT_METRES) {
          toast.error(
            `Your browser could only guess your location roughly (about ${km} km off), which can put you in the wrong town. Please type your address, or use your phone with location turned on.`,
          )
          setIsGettingLocation(false)
          return
        }
        // QA JOB-04: looked up through JinVa, which passes on only a rounded
        // point. The browser used to send the exact coordinates straight to a
        // third-party geocoder.
        try {
          const res = await apiFetch<{ label: string | null; available: boolean }>(
            `/locations/reverse?lat=${coords.latitude}&lon=${coords.longitude}`,
          )
          if (res.label) {
            setAddress(res.label.slice(0, ADDRESS_MAX))
            if (coords.accuracy > LOCATION_WARN_METRES) {
              toast.info(`This is approximate (about ${Math.max(km, 1)} km). Check the address before you post.`)
            }
          } else if (res.available === false) {
            toast.info("We found you, but the address lookup isn't responding right now. Please type the address.")
          } else {
            toast.info("We found you, but there's no address for that spot. Please type it in.")
          }
        } catch {
          toast.info("We found you, but couldn't look up the address. Please type it in.")
        }
        setTouched((t) => ({ ...t, address: true }))
        setIsGettingLocation(false)
      },
      (err) => {
        // Say which of the three things went wrong, so the person can fix it.
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location access is blocked for JinVa. Allow it in your browser's site settings (or open JinVa in your browser instead of inside another app), then try again."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Your device couldn't find your location. Turn on location (GPS) and try again, or type the address."
              : "Finding your location took too long. Try again near a window, or type the address."
        toast.error(message)
        setIsGettingLocation(false)
      },
      // Ask for GPS on phones; a recent fix is fine, and indoors can need longer than 10 s.
      { timeout: 20000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: true },
    )
  }

  const selectedServiceData = services.find((s) => String(s.id) === selectedService)

  const errors = validate({ selectedService, title, description, date, address, budgetMin, budgetMax })
  const isFormValid = Object.keys(errors).length === 0

  // Show an error only if the field has been touched OR submit was attempted
  const showError = (field: keyof FieldErrors) =>
    !!(errors[field] && (touched[field] || submitAttempted))

  const mark = (field: keyof FieldErrors) => setTouched((t) => ({ ...t, [field]: true }))

  /** aria wiring for a field whose hint or error sits in `#<id>-hint`. */
  const fieldA11y = (field: keyof FieldErrors, id: string) => ({
    "aria-invalid": showError(field) || undefined,
    "aria-describedby": `${id}-hint`,
  })

  const budgetRange =
    isAmount(budgetMin) && isAmount(budgetMax) && Number(budgetMin) <= Number(budgetMax)
      ? `${formatCurrency(budgetMin)} – ${formatCurrency(budgetMax)}`
      : null

  const resetForm = () => {
    setSelectedService("")
    setTitle("")
    setDescription("")
    setDate("")
    setTime("")
    setAddress("")
    setBudgetMin("")
    setBudgetMax("")
    setAttachmentUrls([])
    setTouched({})
    setSubmitAttempted(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!isFormValid) {
      const first = FIELD_ORDER.find((f) => errors[f])
      if (first) document.getElementById(first)?.focus()
      return
    }

    // The preferred date and time travel in the description (there is no
    // field for them), written the way artisans read dates elsewhere.
    const when = date
      ? `Preferred date: ${fmtDate(date, true)}${time ? ` at ${fmtTime(time)}` : ""}`
      : time
        ? `Preferred time: ${fmtTime(time)}`
        : ""

    setIsSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        description: `${description.trim()}${when ? `\n\n${when}` : ""}`,
        location: address.trim(),
        serviceId: Number(selectedService),
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
        // GHS is the only currency the platform supports in-app; hardcoded
        // since no currency picker is wanted (backend requires this field).
        currency: "GHS",
        // QA JOB-20: the preferred date is also the posting's deadline. If
        // nobody has been accepted by the end of that day (Ghana time), the
        // posting expires instead of staying open for a date that's passed.
        ...(date ? { deadline: `${date}T23:59:59.000Z` } : {}),
        ...(attachmentUrls.length ? { attachmentUrls } : {}),
      }
      const job = await apiFetch<{ id: string | number }>("/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setCreatedJobId(String(job.id))
      setShowConfirmation(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Your job couldn't be posted. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const today = todayIso()
  const noServices = servicesState === "ready" && services.length === 0
  const serviceHint =
    servicesState === "error"
      ? "The service types couldn't be loaded."
      : noServices
        ? "No service types yet. Please try again later."
        : showError("service")
          ? errors.service
          : null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild className="h-11 gap-2 text-muted-foreground hover:text-foreground sm:h-9">
          <Link href="/dashboard/user">
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Back to overview
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Post a job</h1>
          <p className="text-sm text-muted-foreground">
            Describe what you need. Artisans apply, and you choose who does the work.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Form ─────────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} noValidate className="min-w-0 space-y-5 lg:col-span-2">

            {/* Job details */}
            <Card className="gap-0 py-0">
              <div className="border-b p-5">
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <FileText aria-hidden className="h-4 w-4 text-primary" />
                  Job details
                </h2>
              </div>
              <CardContent className="space-y-5 p-5">

                {/* Service type */}
                <div className="w-full space-y-2">
                  <Label htmlFor="service">
                    Service type<span aria-hidden className="ml-0.5 text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedService}
                    onValueChange={(v) => { setSelectedService(v); mark("service") }}
                    disabled={servicesState !== "ready" || noServices}
                  >
                    <SelectTrigger
                      id="service"
                      className={cn("w-full min-w-0 data-[size=default]:h-11 sm:data-[size=default]:h-9", showError("service") && "border-destructive")}
                      onBlur={() => mark("service")}
                      aria-required
                      {...fieldA11y("service", "service")}
                    >
                      <SelectValue
                        placeholder={
                          servicesState === "loading"
                            ? "Loading service types…"
                            : noServices || servicesState === "error"
                              ? "No service types to choose from"
                              : "What kind of work do you need?"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={String(s.id)} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div id="service-hint" className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {serviceHint ? (
                      <p
                        role={servicesState === "ready" && !noServices ? undefined : "status"}
                        className={cn("text-xs", showError("service") || servicesState === "error" || noServices ? "text-destructive" : "text-muted-foreground")}
                      >
                        {serviceHint}
                      </p>
                    ) : selectedServiceData?.description ? (
                      <p className="text-xs text-muted-foreground">{selectedServiceData.description}</p>
                    ) : null}
                    {(servicesState === "error" || noServices) && (
                      <Button type="button" variant="link" className="h-11 px-0 text-xs underline sm:h-auto" onClick={loadServices}>
                        Try again
                      </Button>
                    )}
                  </div>
                </div>

                {/* Job title */}
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Job title<span aria-hidden className="ml-0.5 text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g. Fix a leaking kitchen tap"
                    value={title}
                    maxLength={TITLE_MAX}
                    aria-required
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => mark("title")}
                    className={cn("h-11 sm:h-9", showError("title") && "border-destructive")}
                    {...fieldA11y("title", "title")}
                  />
                  <p id="title-hint" className={cn("text-xs", showError("title") ? "text-destructive" : "text-muted-foreground")}>
                    {showError("title") ? errors.title : `${title.trim().length}/${TITLE_MAX} characters`}
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Describe the problem<span aria-hidden className="ml-0.5 text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="What's happening, how long it's been going on, and anything else an artisan should know"
                    rows={5}
                    value={description}
                    maxLength={DESCRIPTION_MAX}
                    aria-required
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => mark("description")}
                    className={cn(showError("description") && "border-destructive")}
                    {...fieldA11y("description", "description")}
                  />
                  <p id="description-hint" className={cn(
                    "text-xs",
                    showError("description") ? "text-destructive" : "text-muted-foreground",
                  )}>
                    {showError("description")
                      ? errors.description
                      : `${description.trim().length.toLocaleString("en-GB")}/${DESCRIPTION_MAX.toLocaleString("en-GB")} characters. More detail gets better matches.`}
                  </p>
                </div>

                {/* Photos */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Photos (optional)</p>
                  <AttachmentUploader value={attachmentUrls} onChange={setAttachmentUrls} disabled={isSubmitting} />
                </div>
              </CardContent>
            </Card>

            {/* Schedule and location */}
            <Card className="gap-0 py-0">
              <div className="border-b p-5">
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <Calendar aria-hidden className="h-4 w-4 text-primary" />
                  Schedule and location
                </h2>
              </div>
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="date">Preferred date (optional)</Label>
                    <div className="relative">
                      <Calendar aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="date"
                        type="date"
                        className={cn("h-11 pl-10 sm:h-9", showError("date") && "border-destructive")}
                        min={today}
                        value={date}
                        onChange={(e) => { setDate(e.target.value); mark("date") }}
                        onBlur={() => mark("date")}
                        {...fieldA11y("date", "date")}
                      />
                    </div>
                    <p id="date-hint" className={cn("text-xs", showError("date") ? "text-destructive" : "text-muted-foreground")}>
                      {showError("date") ? errors.date : "If no artisan is accepted by this date, the posting closes."}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="time">Preferred time (optional)</Label>
                    <div className="relative">
                      <Clock aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="time"
                        type="time"
                        className="h-11 pl-10 sm:h-9"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">
                    Service address<span aria-hidden className="ml-0.5 text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={isGettingLocation}
                      aria-label="Use my current location"
                      title="Use my current location"
                      className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {isGettingLocation ? (
                        <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
                      ) : (
                        <MapPin aria-hidden className="h-4 w-4" />
                      )}
                    </button>
                    <Textarea
                      id="address"
                      className={cn("pl-11", showError("address") && "border-destructive")}
                      placeholder="Where the work should be done, or tap the pin to use your location"
                      rows={2}
                      value={address}
                      maxLength={ADDRESS_MAX}
                      aria-required
                      onChange={(e) => setAddress(e.target.value)}
                      onBlur={() => mark("address")}
                      {...fieldA11y("address", "address")}
                    />
                  </div>
                  <p id="address-hint" className={cn("text-xs", showError("address") ? "text-destructive" : "text-muted-foreground")}>
                    {showError("address") ? errors.address : "Tap the pin to fill in your current location."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Budget */}
            <Card className="gap-0 py-0">
              <div className="border-b p-5">
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <Wallet aria-hidden className="h-4 w-4 text-primary" />
                  Budget range
                </h2>
              </div>
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="budgetMin">
                      Minimum (GH₵)<span aria-hidden className="ml-0.5 text-destructive">*</span>
                    </Label>
                    <Input
                      id="budgetMin"
                      inputMode="decimal"
                      placeholder="50.00"
                      value={budgetMin}
                      aria-required
                      onChange={(e) => setBudgetMin(e.target.value)}
                      onBlur={() => mark("budgetMin")}
                      className={cn("h-11 tabular-nums sm:h-9", showError("budgetMin") && "border-destructive")}
                      {...fieldA11y("budgetMin", "budgetMin")}
                    />
                    <p id="budgetMin-hint" className={cn("text-xs", showError("budgetMin") ? "text-destructive" : "sr-only")}>
                      {showError("budgetMin") ? errors.budgetMin : "In Ghana cedis."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budgetMax">
                      Maximum (GH₵)<span aria-hidden className="ml-0.5 text-destructive">*</span>
                    </Label>
                    <Input
                      id="budgetMax"
                      inputMode="decimal"
                      placeholder="300.00"
                      value={budgetMax}
                      aria-required
                      onChange={(e) => setBudgetMax(e.target.value)}
                      onBlur={() => mark("budgetMax")}
                      className={cn("h-11 tabular-nums sm:h-9", showError("budgetMax") && "border-destructive")}
                      {...fieldA11y("budgetMax", "budgetMax")}
                    />
                    <p id="budgetMax-hint" className={cn("text-xs", showError("budgetMax") ? "text-destructive" : "sr-only")}>
                      {showError("budgetMax") ? errors.budgetMax : "In Ghana cedis."}
                    </p>
                  </div>
                </div>
                {budgetRange && (
                  <p className="text-sm text-muted-foreground">
                    Budget range: <span className="font-medium tabular-nums text-foreground">{budgetRange}</span>
                  </p>
                )}
              </CardContent>
            </Card>

            {submitAttempted && !isFormValid && (
              <p role="alert" className="text-sm text-destructive">
                Please fix the highlighted fields before posting.
              </p>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" asChild className="h-11 flex-1 bg-transparent md:flex-none">
                <Link href="/dashboard/user">Cancel</Link>
              </Button>
              <Button
                type="submit"
                className="h-11 flex-1 bg-primary text-primary-foreground hover:bg-primary/90 md:flex-none md:px-8"
                disabled={isSubmitting || noServices || servicesState === "error"}
              >
                {isSubmitting && <Loader2 aria-hidden className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
                Post job
              </Button>
            </div>
          </form>

          {/* ── Sidebar ───────────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-5">

            {/* Job summary — mirrors every field in Job details */}
            <Card className="gap-0 py-0">
              <div className="border-b p-4">
                <h2 className="text-sm font-semibold text-foreground">Job summary</h2>
              </div>
              <CardContent className="divide-y divide-border p-0">
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Service type</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {selectedServiceData?.name || <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Job title</p>
                  <p className="mt-0.5 break-words text-sm font-medium text-foreground">
                    {title.trim() || <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="mt-0.5 line-clamp-3 break-words text-sm text-foreground">
                    {description.trim() || <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Preferred date and time</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {date
                      ? `${fmtDate(date)}${time ? `, ${fmtTime(time)}` : ""}`
                      : time
                        ? `Any day, ${fmtTime(time)}`
                        : <span className="text-muted-foreground">Flexible</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Service address</p>
                  <p className="mt-0.5 line-clamp-2 break-words text-sm font-medium text-foreground">
                    {address.trim() || <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Budget range</p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                    {budgetRange ?? <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
                {attachmentUrls.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-muted-foreground">Photos</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {attachmentUrls.length === 1 ? "1 photo" : `${attachmentUrls.length} photos`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="gap-0 py-0">
              <div className="border-b p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Lightbulb aria-hidden className="h-4 w-4 text-primary" />
                  Tips for a great post
                </h2>
              </div>
              <CardContent className="p-4">
                <ol className="space-y-3">
                  {TIPS.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                        {i + 1}
                      </span>
                      {tip}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Browse artisans */}
            <Card className="gap-0 bg-muted/30 py-0">
              <CardContent className="p-4 text-center">
                <p className="text-sm font-medium text-foreground">Know who you want?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Find a specific artisan and book them directly.
                </p>
                <Button variant="outline" className="mt-3 h-11 bg-transparent sm:h-9" asChild>
                  <Link href="/dashboard/user/search">Find artisans</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Success dialog. Closing it clears the form, so the same job can't be posted twice by accident. */}
      <Dialog
        open={showConfirmation}
        onOpenChange={(open) => {
          setShowConfirmation(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle aria-hidden className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle>Job posted</DialogTitle>
            <DialogDescription>
              Your job is live. Artisans can now apply, and we&apos;ll let you know when someone does.
            </DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Service</dt>
              <dd className="text-right font-medium text-foreground">{selectedServiceData?.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Title</dt>
              <dd className="min-w-0 truncate text-right font-medium text-foreground">{title.trim()}</dd>
            </div>
            {date && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Preferred date</dt>
                <dd className="text-right font-medium text-foreground">
                  {fmtDate(date)}{time ? ` at ${fmtTime(time)}` : ""}
                </dd>
              </div>
            )}
            {budgetRange && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Budget</dt>
                <dd className="text-right font-medium tabular-nums text-foreground">{budgetRange}</dd>
              </div>
            )}
          </dl>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => router.push(createdJobId ? `/dashboard/user/jobs/${createdJobId}` : "/dashboard/user/jobs")}
            >
              Track my job
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full bg-transparent"
              onClick={() => { setShowConfirmation(false); router.push("/dashboard/user") }}
            >
              Back to overview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
