"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Star, UserRound, Loader2, ShieldCheck } from "lucide-react"
import { naviiAvatar } from "@/lib/utils"
import { apiFetch } from "@/lib/api"

interface BackendArtisan {
  id: string
  businessName?: string
  averageRating: number
  totalReviews: number
  availabilityStatus: string
  isVerified: boolean
  services?: { id: string; name: string }[]
  user: { id: string; firstname: string; lastname: string; profilePicture?: string }
}

function mapArtisan(a: BackendArtisan) {
  return {
    id: a.id,
    name: `${a.user.firstname} ${a.user.lastname}`.trim(),
    specialization: a.businessName || a.services?.[0]?.name || "General Service",
    avatar: a.user.profilePicture,
    avgRating: Number(a.averageRating ?? 0),
    availability: a.availabilityStatus === "AVAILABLE" ? "available" : "busy",
    isVerified: a.isVerified,
  }
}

type MappedArtisan = ReturnType<typeof mapArtisan>

export default function ArtisansPage() {
  const [artisans, setArtisans] = useState<MappedArtisan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    apiFetch<BackendArtisan[] | { items: BackendArtisan[] }>("/admin/artisans?page=1&limit=50")
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: BackendArtisan[] }).items ?? []
        setArtisans(items.map(mapArtisan))
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = artisans.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.specialization.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">Artisans</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {artisans.length} artisan{artisans.length !== 1 ? "s" : ""} registered on the platform
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search artisans..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <UserRound className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground">
                  {search ? "No artisans match your search." : "No artisans yet."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {filtered.map((artisan) => (
                  <Card key={artisan.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="relative h-40 bg-gradient-to-br from-primary to-primary/80">
                        <Avatar className="absolute bottom-0 left-1/2 h-24 w-24 -translate-x-1/2 translate-y-1/2 border-4 border-background">
                          <AvatarImage src={artisan.avatar || naviiAvatar(artisan.name)} />
                          <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background px-2 py-1 text-sm font-semibold">
                          <Star className="h-3.5 w-3.5 fill-rating text-rating" />
                          {artisan.avgRating.toFixed(1)}
                        </div>
                        {artisan.isVerified && (
                          <div className="absolute left-3 top-3 flex items-center justify-center rounded-full bg-background/90 p-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="mt-14 space-y-3 p-4 text-center">
                        <div>
                          <h3 className="font-semibold">{artisan.name}</h3>
                          <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            artisan.availability === "available"
                              ? "border-primary/30 bg-primary/5 text-primary"
                              : "border-border bg-muted text-muted-foreground"
                          }
                        >
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                          {artisan.availability === "available" ? "Available" : "Busy"}
                        </Badge>
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
