"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Plus, MoreVertical, Pencil, Trash2, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

interface BackendService {
  id: number
  name: string
  description?: string
  price?: number
  estimatedDurationMins?: number
}

interface ServiceFormState {
  name: string
  description: string
  price: string
  estimatedDurationMins: string
}

const EMPTY_FORM: ServiceFormState = { name: "", description: "", price: "", estimatedDurationMins: "60" }

/**
 * A2: `Service.estimatedDurationMins` is used by R1's booking flow to derive
 * a booking's `endTime` when the customer doesn't pick one explicitly.
 * `POST/PATCH /services` are ADMIN-only server-side (services are a shared
 * platform catalogue, not a per-artisan record — see write-up), so this is
 * the actual "wherever services are created/edited today" surface, not the
 * artisan-side "add/remove from my profile" page. This also converts the
 * page off `mockServices` to live data as a side effect of wiring the new
 * field in.
 */
export default function AdminServicesPage() {
  const [services, setServices] = useState<BackendService[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ServiceFormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<BackendService | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchServices = () => {
    setIsLoading(true)
    apiFetch<BackendService[] | { items?: BackendService[] }>("/services?limit=200")
      .then((data) => setServices(Array.isArray(data) ? data : (data.items ?? [])))
      .catch(() => toast.error("Failed to load services."))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { fetchServices() }, [])

  const filtered = services.filter(
    (s) =>
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (service: BackendService) => {
    setEditingId(service.id)
    setForm({
      name: service.name,
      description: service.description ?? "",
      price: service.price != null ? String(service.price) : "",
      estimatedDurationMins: service.estimatedDurationMins != null ? String(service.estimatedDurationMins) : "60",
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Service name is required."); return }
    const duration = Number(form.estimatedDurationMins)
    if (!Number.isFinite(duration) || duration < 5 || duration > 480) {
      toast.error("Estimated duration must be between 5 and 480 minutes.")
      return
    }

    setIsSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: form.price.trim() ? Number(form.price) : undefined,
      estimatedDurationMins: duration,
    }
    try {
      if (editingId != null) {
        const updated = await apiFetch<BackendService>(`/services/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        setServices((prev) => prev.map((s) => (s.id === editingId ? updated : s)))
        toast.success("Service updated.")
      } else {
        const created = await apiFetch<BackendService>("/services", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        setServices((prev) => [...prev, created])
        toast.success("Service created.")
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save service.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await apiFetch(`/services/${deleteTarget.id}`, { method: "DELETE" })
      setServices((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      toast.success("Service deleted.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete service.")
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">Service Catalogue</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage the platform-wide service categories artisans can offer, including estimated duration used for bookings
                </p>
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90 sm:w-auto" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add new service
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search services..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Service Name</th>
                      <th className="pb-3 font-medium">Description</th>
                      <th className="pb-3 font-medium">Price</th>
                      <th className="pb-3 font-medium">Est. Duration</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No services found.</td>
                      </tr>
                    ) : (
                      filtered.map((service) => (
                        <tr key={service.id} className="border-b last:border-0">
                          <td className="py-4 font-medium">{service.name}</td>
                          <td className="max-w-xs truncate py-4 text-sm text-muted-foreground">{service.description ?? "—"}</td>
                          <td className="py-4 font-semibold text-foreground">{service.price != null ? formatCurrency(service.price) : "—"}</td>
                          <td className="py-4 text-sm text-muted-foreground">{service.estimatedDurationMins ?? 60} min</td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(service)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(service)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId != null ? "Edit Service" : "Add New Service"}</DialogTitle>
            <DialogDescription>
              Estimated duration determines how bookings for this service compute their end time by default.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="svc-name">Name</Label>
              <Input id="svc-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-desc">Description</Label>
              <Textarea id="svc-desc" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="svc-price">Price (GH₵)</Label>
                <Input id="svc-price" type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-duration">Est. Duration (mins)</Label>
                <Input
                  id="svc-duration"
                  type="number"
                  min="5"
                  max="480"
                  value={form.estimatedDurationMins}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedDurationMins: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId != null ? "Save Changes" : "Create Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone and may affect artisans or jobs referencing it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
