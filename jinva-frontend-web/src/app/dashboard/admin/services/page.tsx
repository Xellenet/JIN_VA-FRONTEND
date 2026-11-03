"use client"

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EyeOff, Eye, Loader2, Pencil, Plus, Search, Trash2, Wrench } from "lucide-react"
import { ApiError, apiFetch } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

/** What `GET /services?includeInactive=true` returns to an admin. */
interface AdminService {
  id: number
  name: string
  description?: string | null
  /** "150.00", or null until a typical starting price is set. */
  price?: string | number | null
  estimatedDurationMins?: number
  isActive?: boolean
  usage?: { artisans: number; bookings: number; jobs: number }
}

interface FormState {
  name: string
  description: string
  price: string
  duration: string
  isActive: boolean
}

type FormErrors = Partial<Record<"name" | "description" | "price" | "duration", string>>

type Filter = "all" | "visible" | "hidden"

const NAME_MAX = 60
const DESCRIPTION_MAX = 500
const DURATION_MIN = 5
const DURATION_MAX = 480
const PRICE_MAX = 1_000_000

const EMPTY_FORM: FormState = { name: "", description: "", price: "", duration: "60", isActive: true }

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
]

/** The same rules the API applies (CreateServiceDto), so errors show before a round trip. */
function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  const name = form.name.trim().replace(/\s+/g, " ")
  if (!name) errors.name = "Enter a service name."
  else if (name.length < 2) errors.name = "The name must be at least 2 characters."
  else if (name.length > NAME_MAX) errors.name = `The name must be ${NAME_MAX} characters or fewer.`

  if (form.description.trim().length > DESCRIPTION_MAX)
    errors.description = `The description must be ${DESCRIPTION_MAX} characters or fewer.`

  const price = form.price.trim()
  if (price) {
    const value = Number(price)
    if (!/^\d+(\.\d{1,2})?$/.test(price) || !Number.isFinite(value))
      errors.price = "Enter an amount in cedis, with up to 2 decimal places, such as 150 or 99.50."
    else if (value <= 0) errors.price = "The price must be more than GH₵ 0.00, or leave it empty."
    else if (value > PRICE_MAX) errors.price = `The price must be ${formatCurrency(PRICE_MAX)} or less.`
  }

  const duration = form.duration.trim()
  if (!duration) errors.duration = "Enter how long the work usually takes."
  else if (!/^\d+$/.test(duration) || Number(duration) < DURATION_MIN || Number(duration) > DURATION_MAX)
    errors.duration = `Enter whole minutes between ${DURATION_MIN} and ${DURATION_MAX}.`
  return errors
}

function usageTotal(s: AdminService): number {
  return (s.usage?.artisans ?? 0) + (s.usage?.jobs ?? 0) + (s.usage?.bookings ?? 0)
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "3 artisans, 12 jobs and 1 booking", leaving out the zeros. */
function usageText(s: AdminService): string {
  const parts = [
    s.usage?.artisans ? plural(s.usage.artisans, "artisan") : null,
    s.usage?.jobs ? plural(s.usage.jobs, "job") : null,
    s.usage?.bookings ? plural(s.usage.bookings, "booking") : null,
  ].filter((p): p is string => !!p)
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

function durationText(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/**
 * The platform's service types: what customers post jobs under and artisans
 * offer. `POST/PATCH/DELETE /services` are admin-only on the server; this page
 * sits under /dashboard/admin, which the middleware limits to admins.
 *
 * A service that artisans, jobs or bookings use can't be deleted (the API
 * answers 409), so it is hidden instead: it leaves the public catalogue and
 * the existing records keep it.
 */
export default function AdminServicesPage() {
  const [services, setServices] = useState<AdminService[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminService | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AdminService | null>(null)
  const [deleteBlocked, setDeleteBlocked] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError(false)
    apiFetch<AdminService[]>("/services?limit=200&includeInactive=true")
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const hiddenCount = services.filter((s) => s.isActive === false).length

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return services
      .filter((s) => filter === "all" || (filter === "hidden" ? s.isActive === false : s.isActive !== false))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "en-GB"))
  }, [services, search, filter])

  /** Replaces one row with the server's copy, keeping its usage counts. */
  const replace = (updated: AdminService) =>
    setServices((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated, usage: s.usage } : s)))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setDialogOpen(true)
  }

  const openEdit = (s: AdminService) => {
    setEditing(s)
    setForm({
      name: s.name,
      description: s.description ?? "",
      price: s.price != null && s.price !== "" ? Number(s.price).toFixed(2) : "",
      duration: String(s.estimatedDurationMins ?? 60),
      isActive: s.isActive !== false,
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    const errors = validate(form)
    setFormErrors(errors)
    if (Object.keys(errors).length) {
      const first = (["name", "description", "price", "duration"] as const).find((k) => errors[k])
      if (first) document.getElementById(`svc-${first}`)?.focus()
      return
    }

    const price = form.price.trim()
    const payload = {
      name: form.name.trim().replace(/\s+/g, " "),
      // An emptied description or price clears it on edit; on create it is left out.
      description: form.description.trim() || (editing ? "" : undefined),
      price: price ? Number(price) : editing ? null : undefined,
      estimatedDurationMins: Number(form.duration),
      isActive: form.isActive,
    }

    setIsSaving(true)
    try {
      if (editing) {
        const updated = await apiFetch<AdminService>(`/services/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        replace(updated)
        toast.success(`${updated.name} saved.`)
      } else {
        const created = await apiFetch<AdminService>("/services", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        setServices((prev) => [...prev, { ...created, usage: { artisans: 0, bookings: 0, jobs: 0 } }])
        toast.success(`${created.name} added.`)
      }
      setDialogOpen(false)
    } catch (err) {
      // A duplicate name is a 409; show it on the field it is about.
      if (err instanceof ApiError && err.status === 409) {
        setFormErrors({ name: err.message })
        document.getElementById("svc-name")?.focus()
      } else {
        toast.error(err instanceof Error ? err.message : "The service couldn't be saved. Please try again.")
      }
    } finally {
      setIsSaving(false)
    }
  }

  const setVisibility = async (s: AdminService, isActive: boolean) => {
    setTogglingId(s.id)
    try {
      const updated = await apiFetch<AdminService>(`/services/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      })
      replace(updated)
      toast.success(
        isActive
          ? `${s.name} is visible again.`
          : `${s.name} is hidden. Customers and artisans can no longer pick it; existing jobs and bookings keep it.`,
      )
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The service couldn't be updated. Please try again.")
      return false
    } finally {
      setTogglingId(null)
    }
  }

  const askDelete = (s: AdminService) => {
    setDeleteBlocked(
      usageTotal(s) > 0
        ? `${s.name} is used by ${usageText(s)}, so it can't be deleted without breaking those records.`
        : null,
    )
    setDeleteTarget(s)
  }

  const closeDelete = () => {
    setDeleteTarget(null)
    setDeleteBlocked(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await apiFetch(`/services/${deleteTarget.id}`, { method: "DELETE" })
      setServices((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      toast.success(`${deleteTarget.name} deleted.`)
      closeDelete()
    } catch (err) {
      // Something started using it after the list loaded: show why, offer to hide.
      if (err instanceof ApiError && err.status === 409) setDeleteBlocked(err.message)
      else toast.error(err instanceof Error ? err.message : "The service couldn't be deleted. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const hideInstead = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    const ok = await setVisibility(deleteTarget, false)
    setIsDeleting(false)
    if (ok) closeDelete()
  }

  const nameLength = form.name.trim().replace(/\s+/g, " ").length

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Services</h1>
            <p className="text-sm text-muted-foreground">
              The service types customers post jobs under and artisans offer.
            </p>
          </div>
          <Button className="h-11 w-full gap-2 sm:h-9 sm:w-auto" onClick={openCreate}>
            <Plus aria-hidden className="h-4 w-4" />
            Add service
          </Button>
        </div>

        <Card className="gap-0 py-0">
          <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search services"
                placeholder="Search by name or description"
                className="h-11 pl-10 md:h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div role="group" aria-label="Show" className="flex gap-1 rounded-lg bg-muted p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "h-11 flex-1 rounded-md px-3 text-sm font-medium transition-colors md:h-8 md:flex-none",
                    filter === f.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                  {f.value === "hidden" && hiddenCount > 0 ? ` (${hiddenCount})` : ""}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16" role="status" aria-label="Loading services">
              <Loader2 aria-hidden className="h-6 w-6 text-muted-foreground motion-safe:animate-spin" />
            </div>
          ) : loadError ? (
            <div className="space-y-3 px-4 py-12 text-center">
              <p className="text-sm text-foreground">The services couldn&apos;t be loaded.</p>
              <Button variant="outline" className="h-11 sm:h-9" onClick={load}>Try again</Button>
            </div>
          ) : services.length === 0 ? (
            <div className="space-y-3 px-4 py-12 text-center">
              <Wrench aria-hidden className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="font-medium text-foreground">No service types yet</p>
              <p className="text-sm text-muted-foreground">Add the first one so customers can post jobs.</p>
            </div>
          ) : shown.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              {search.trim() ? <>No services match &ldquo;{search.trim()}&rdquo;.</> : "No services in this view."}
            </p>
          ) : (
            <ul className="divide-y" aria-label="Service types">
              {shown.map((s) => {
                const hidden = s.isActive === false
                const used = usageTotal(s) > 0
                return (
                  <li key={s.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn("font-medium", hidden ? "text-muted-foreground" : "text-foreground")}>{s.name}</p>
                        {hidden && (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <EyeOff aria-hidden />
                            Hidden
                          </Badge>
                        )}
                      </div>
                      {s.description && <p className="line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                      <p className="text-xs text-muted-foreground">
                        {s.price != null && s.price !== "" ? (
                          <>Typical starting price <span className="font-medium tabular-nums text-foreground">{formatCurrency(s.price)}</span></>
                        ) : (
                          "No typical starting price"
                        )}
                        {" · "}
                        About {durationText(s.estimatedDurationMins ?? 60)}
                        {" · "}
                        {used ? `Used by ${usageText(s)}` : "Not used yet"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        className="h-11 flex-1 gap-2 bg-transparent md:h-9 md:flex-none"
                        onClick={() => openEdit(s)}
                        aria-label={`Edit ${s.name}`}
                      >
                        <Pencil aria-hidden className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 flex-1 gap-2 bg-transparent md:h-9 md:flex-none"
                        onClick={() => setVisibility(s, hidden)}
                        disabled={togglingId === s.id}
                        aria-label={hidden ? `Show ${s.name}` : `Hide ${s.name}`}
                      >
                        {togglingId === s.id ? (
                          <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
                        ) : hidden ? (
                          <Eye aria-hidden className="h-4 w-4" />
                        ) : (
                          <EyeOff aria-hidden className="h-4 w-4" />
                        )}
                        {hidden ? "Show" : "Hide"}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 shrink-0 bg-transparent text-destructive hover:text-destructive md:h-9 md:w-9"
                        onClick={() => askDelete(s)}
                        aria-label={`Delete ${s.name}`}
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {!isLoading && !loadError && services.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {plural(services.length, "service")}
            {hiddenCount ? `, ${hiddenCount} hidden` : ""}. Hidden services don&apos;t appear when customers post a job or
            book, or when artisans add services; jobs and bookings that already use them keep them.
          </p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !isSaving && setDialogOpen(open)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={handleSave} noValidate className="space-y-5">
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ${editing.name}` : "Add service"}</DialogTitle>
              <DialogDescription>
                Customers pick a service type when they post a job, and artisans add the ones they offer.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="svc-name">Name</Label>
              <Input
                id="svc-name"
                value={form.name}
                maxLength={NAME_MAX + 20}
                autoComplete="off"
                aria-invalid={!!formErrors.name}
                aria-describedby="svc-name-hint"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-11 sm:h-9"
              />
              <p id="svc-name-hint" className={cn("text-xs", formErrors.name ? "text-destructive" : "text-muted-foreground")}>
                {formErrors.name ?? `${nameLength}/${NAME_MAX} characters. Each name must be unique.`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-description">Description (optional)</Label>
              <Textarea
                id="svc-description"
                rows={3}
                value={form.description}
                aria-invalid={!!formErrors.description}
                aria-describedby="svc-description-hint"
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <p
                id="svc-description-hint"
                className={cn("text-xs", formErrors.description ? "text-destructive" : "text-muted-foreground")}
              >
                {formErrors.description ?? `${form.description.trim().length}/${DESCRIPTION_MAX} characters`}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="svc-price">Typical starting price (GH₵, optional)</Label>
                <Input
                  id="svc-price"
                  inputMode="decimal"
                  placeholder="e.g. 150.00"
                  value={form.price}
                  aria-invalid={!!formErrors.price}
                  aria-describedby="svc-price-hint"
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  onBlur={() => {
                    const v = form.price.trim()
                    if (/^\d+(\.\d{1,2})?$/.test(v)) setForm((f) => ({ ...f, price: Number(v).toFixed(2) }))
                  }}
                  className="h-11 tabular-nums sm:h-9"
                />
                <p id="svc-price-hint" className={cn("text-xs", formErrors.price ? "text-destructive" : "text-muted-foreground")}>
                  {formErrors.price ?? "A guide shown to customers and artisans. Leave empty if it varies too much."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-duration">Estimated duration (minutes)</Label>
                <Input
                  id="svc-duration"
                  inputMode="numeric"
                  value={form.duration}
                  aria-invalid={!!formErrors.duration}
                  aria-describedby="svc-duration-hint"
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  className="h-11 tabular-nums sm:h-9"
                />
                <p
                  id="svc-duration-hint"
                  className={cn("text-xs", formErrors.duration ? "text-destructive" : "text-muted-foreground")}
                >
                  {formErrors.duration ?? `Sets a booking's default end time. ${DURATION_MIN} to ${DURATION_MAX} minutes.`}
                </p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="svc-active">Visible</Label>
                <p id="svc-active-hint" className="text-xs text-muted-foreground">
                  When off, customers and artisans can&apos;t pick it. Existing jobs and bookings keep it.
                </p>
              </div>
              <Switch
                id="svc-active"
                checked={form.isActive}
                aria-describedby="svc-active-hint"
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11 gap-2 sm:h-9" disabled={isSaving}>
                {isSaving && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                {editing ? "Save changes" : "Add service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !isDeleting && closeDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteBlocked ? `${deleteTarget?.name} can't be deleted` : `Delete ${deleteTarget?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlocked ? (
                <>
                  {deleteBlocked}{" "}
                  {deleteTarget?.isActive === false
                    ? "It is already hidden, so no one new can pick it."
                    : "Hide it instead: customers and artisans can no longer pick it, and existing records keep it."}
                </>
              ) : (
                "Nothing uses this service yet, so it will be removed for good. This can't be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9" disabled={isDeleting}>
              {deleteBlocked ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {deleteBlocked ? (
              deleteTarget?.isActive !== false && (
                <Button className="h-11 gap-2 sm:h-9" onClick={hideInstead} disabled={isDeleting}>
                  {isDeleting ? <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" /> : <EyeOff aria-hidden className="h-4 w-4" />}
                  Hide service
                </Button>
              )
            ) : (
              <Button variant="destructive" className="h-11 gap-2 sm:h-9" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                Delete service
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
