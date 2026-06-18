"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, ChevronDown, Wrench, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api"

interface BackendService {
  id: string
  name: string
  description?: string
  price?: number
}

export default function UserServicesPage() {
  const [services, setServices] = useState<BackendService[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    apiFetch<BackendService[] | { items?: BackendService[] }>("/services")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setServices(items)
      })
      .catch(() => setServices([]))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = services.filter(
    (s) =>
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Available Services</h1>
          <p className="text-muted-foreground">Browse and book services in your area</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" className="gap-2 bg-transparent">
                All Categories
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Wrench className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold text-foreground">
                  {searchQuery ? "No services match your search" : "No services available yet"}
                </h3>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((service) => (
                  <Card key={service.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
                        <div className="flex items-center justify-between">
                          <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                            <Wrench className="h-6 w-6" />
                          </div>
                          {service.price != null && (
                            <Badge variant="secondary" className="bg-white text-primary">
                              ${service.price}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 p-6">
                        <div>
                          <h3 className="font-semibold text-foreground">{service.name}</h3>
                        </div>

                        {service.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" className="flex-1 bg-transparent" asChild>
                            <Link href="/dashboard/user/search">Find Artisan</Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
