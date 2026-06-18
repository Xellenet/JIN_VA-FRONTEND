"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Wrench, Plus, Minus, Loader2, CheckCircle2 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

interface BackendService {
  id: string
  name: string
  description?: string
  price?: number
}

interface ArtisanProfile {
  id: string
  services?: { id: string; name: string }[]
}

export default function ArtisanServicesPage() {
  const [allServices, setAllServices] = useState<BackendService[]>([])
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    Promise.all([
      apiFetch<BackendService[] | { items: BackendService[] }>("/services"),
      apiFetch<ArtisanProfile>("/users/me/artisan-profile"),
    ])
      .then(([servicesResult, profile]) => {
        const services = Array.isArray(servicesResult)
          ? servicesResult
          : (servicesResult as { items: BackendService[] }).items ?? []
        setAllServices(services)
        setEnrolledIds(new Set(profile.services?.map((s) => s.id) ?? []))
      })
      .catch(() => toast.error("Could not load services."))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = allServices.filter(
    (s) =>
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const myServices = filtered.filter((s) => enrolledIds.has(s.id))
  const availableServices = filtered.filter((s) => !enrolledIds.has(s.id))

  const handleAdd = async (serviceId: string) => {
    setActionLoading(serviceId)
    try {
      await apiFetch(`/artisans/me/services/${serviceId}`, { method: "POST" })
      setEnrolledIds((prev) => new Set([...prev, serviceId]))
      toast.success("Service added to your profile.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add service.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemove = async (serviceId: string) => {
    setActionLoading(serviceId)
    try {
      await apiFetch(`/artisans/me/services/${serviceId}`, { method: "DELETE" })
      setEnrolledIds((prev) => {
        const next = new Set(prev)
        next.delete(serviceId)
        return next
      })
      toast.success("Service removed from your profile.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove service.")
    } finally {
      setActionLoading(null)
    }
  }

  const ServiceCard = ({ service, enrolled }: { service: BackendService; enrolled: boolean }) => (
    <Card className={`overflow-hidden transition-shadow hover:shadow-md ${!enrolled ? "opacity-90" : ""}`}>
      <CardContent className="p-0">
        <div className={`p-5 ${enrolled ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground" : "bg-muted/40"}`}>
          <div className="flex items-center justify-between">
            <div className={`rounded-lg p-2.5 ${enrolled ? "bg-white/20" : "bg-background"}`}>
              <Wrench className={`h-5 w-5 ${enrolled ? "" : "text-muted-foreground"}`} />
            </div>
            {enrolled && (
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Active
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <h3 className="font-semibold text-foreground">{service.name}</h3>
            {service.price !== undefined && (
              <p className="text-sm text-muted-foreground">From ${service.price}</p>
            )}
          </div>
          {service.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
          )}
          <Button
            size="sm"
            disabled={actionLoading === service.id}
            onClick={() => enrolled ? handleRemove(service.id) : handleAdd(service.id)}
            className={
              enrolled
                ? "w-full bg-transparent border border-destructive/50 text-destructive hover:bg-destructive/5"
                : "w-full bg-primary text-primary-foreground hover:bg-primary/90"
            }
            variant={enrolled ? "outline" : "default"}
          >
            {actionLoading === service.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : enrolled ? (
              <><Minus className="mr-1.5 h-3.5 w-3.5" />Remove</>
            ) : (
              <><Plus className="mr-1.5 h-3.5 w-3.5" />Add to Profile</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Artisan</p>
          <h1 className="mt-0.5 text-2xl font-bold text-foreground">My Services</h1>
          <p className="text-sm text-muted-foreground">
            Manage the services you offer on your profile
          </p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            {myServices.length > 0 && (
              <section>
                <h2 className="mb-4 text-base font-semibold text-foreground">
                  Active Services
                  <Badge variant="secondary" className="ml-2">{myServices.length}</Badge>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {myServices.map((s) => <ServiceCard key={s.id} service={s} enrolled={true} />)}
                </div>
              </section>
            )}

            {availableServices.length > 0 && (
              <section>
                <h2 className="mb-4 text-base font-semibold text-foreground">
                  Available to Add
                  <Badge variant="secondary" className="ml-2">{availableServices.length}</Badge>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableServices.map((s) => <ServiceCard key={s.id} service={s} enrolled={false} />)}
                </div>
              </section>
            )}

            {filtered.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">No services found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
