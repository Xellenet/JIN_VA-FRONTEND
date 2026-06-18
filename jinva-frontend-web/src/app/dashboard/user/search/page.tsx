"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Search, ChevronDown, Star, Briefcase, UserRound, Loader2, ShieldCheck } from "lucide-react"
import { naviiAvatar } from "@/lib/utils"
import { apiFetch } from "@/lib/api"

interface BackendArtisan {
  id: string
  bio?: string
  experienceYears?: number
  hourlyRate?: number
  businessName?: string
  averageRating: number
  totalReviews: number
  availabilityStatus: string
  isVerified: boolean
  location?: string
  services?: { id: string; name: string }[]
  user: { id: string; firstname: string; lastname: string; profilePicture?: string }
}

interface BackendService {
  id: string
  name: string
  description?: string
}

function mapArtisan(a: BackendArtisan) {
  return {
    id: a.id,
    name: `${a.user.firstname} ${a.user.lastname}`.trim(),
    specialization: a.businessName || a.services?.[0]?.name || "General Service",
    avatar: a.user.profilePicture,
    avgRating: Number(a.averageRating ?? 0),
    reviews: Number(a.totalReviews ?? 0),
    availability: a.availabilityStatus === "AVAILABLE" ? "available" : "busy",
    location: a.location,
    experienceYears: a.experienceYears,
    services: a.services ?? [],
    isVerified: a.isVerified,
    hourlyRate: a.hourlyRate,
  }
}

type MappedArtisan = ReturnType<typeof mapArtisan>

const ratingOptions = [
  { label: "All Ratings", value: 0 },
  { label: "4.5 & above", value: 4.5 },
  { label: "4.0 & above", value: 4.0 },
  { label: "3.5 & above", value: 3.5 },
  { label: "3.0 & above", value: 3.0 },
]

export default function SearchArtisansPage() {
  const [keyword, setKeyword] = useState("")
  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [selectedServiceName, setSelectedServiceName] = useState("All Services")
  const [minRating, setMinRating] = useState(0)
  const [availabilityFilter, setAvailabilityFilter] = useState("")

  const [artisans, setArtisans] = useState<MappedArtisan[]>([])
  const [services, setServices] = useState<BackendService[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    apiFetch<BackendService[] | { items: BackendService[] }>("/services")
      .then((r) => setServices(Array.isArray(r) ? r : (r as { items: BackendService[] }).items ?? []))
      .catch(() => {})
  }, [])

  const fetchArtisans = useCallback(async (kw: string, svcId: string, rating: number, avail: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (kw) params.set("keyword", kw)
      if (svcId) params.set("serviceId", svcId)
      if (rating > 0) params.set("minRating", String(rating))
      if (avail) params.set("availabilityStatus", avail)
      params.set("page", "1")
      params.set("limit", "30")
      const result = await apiFetch<BackendArtisan[] | { items: BackendArtisan[] }>(`/artisans?${params}`)
      const items = Array.isArray(result) ? result : (result as { items: BackendArtisan[] }).items ?? []
      setArtisans(items.map(mapArtisan))
    } catch {
      setArtisans([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(
      () => fetchArtisans(keyword, selectedServiceId, minRating, availabilityFilter),
      keyword ? 400 : 0,
    )
    return () => clearTimeout(debounceRef.current)
  }, [keyword, selectedServiceId, minRating, availabilityFilter, fetchArtisans])

  const activeFilters = [
    selectedServiceId ? selectedServiceName : null,
    minRating > 0 ? `${minRating}+ stars` : null,
    availabilityFilter === "AVAILABLE" ? "Available" : availabilityFilter === "BUSY" ? "Busy" : null,
  ].filter(Boolean)

  const clearFilters = () => {
    setSelectedServiceId("")
    setSelectedServiceName("All Services")
    setMinRating(0)
    setAvailabilityFilter("")
    setKeyword("")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Find Artisans</p>
          <h1 className="mt-0.5 text-2xl font-bold text-foreground">Discover Professionals</h1>
          <p className="text-sm text-muted-foreground">Search and book trusted artisans in your area</p>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or keyword..."
                  className="pl-10"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {selectedServiceName}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Service Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { setSelectedServiceId(""); setSelectedServiceName("All Services") }}
                    className={!selectedServiceId ? "bg-accent text-accent-foreground" : ""}
                  >
                    All Services
                  </DropdownMenuItem>
                  {services.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => { setSelectedServiceId(s.id); setSelectedServiceName(s.name) }}
                      className={selectedServiceId === s.id ? "bg-accent text-accent-foreground" : ""}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {minRating > 0 ? `${minRating}+ Stars` : "Rating"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Minimum Rating</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ratingOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setMinRating(opt.value)}
                      className={minRating === opt.value ? "bg-accent text-accent-foreground" : ""}
                    >
                      <div className="flex items-center gap-2">
                        {opt.value > 0 && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />}
                        {opt.label}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {availabilityFilter === "AVAILABLE" ? "Available" : availabilityFilter === "BUSY" ? "Busy" : "Availability"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Availability</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {[
                    { label: "All Availability", value: "" },
                    { label: "Available Now", value: "AVAILABLE" },
                    { label: "Busy", value: "BUSY" },
                  ].map((opt) => (
                    <DropdownMenuItem
                      key={opt.value || "all"}
                      onClick={() => setAvailabilityFilter(opt.value)}
                      className={availabilityFilter === opt.value ? "bg-accent text-accent-foreground" : ""}
                    >
                      <div className="flex items-center gap-2">
                        {opt.value && (
                          <span className={`h-2 w-2 rounded-full ${opt.value === "AVAILABLE" ? "bg-primary" : "bg-muted-foreground"}`} />
                        )}
                        {opt.label}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {activeFilters.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Active filters:</span>
                {activeFilters.map((f) => (
                  <Badge key={f} variant="secondary" className="gap-1 text-xs">{f}</Badge>
                ))}
                <Button variant="ghost" size="sm" className="h-6 text-xs text-primary hover:text-primary/80" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Showing {artisans.length} artisan{artisans.length !== 1 ? "s" : ""}
            </p>

            {artisans.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="mb-4 h-12 w-12 text-muted-foreground/40" />
                  <h3 className="text-lg font-semibold text-foreground">No artisans found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Try adjusting your filters or search query.</p>
                  <Button variant="outline" className="mt-4 bg-transparent" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {artisans.map((artisan) => (
                  <Card key={artisan.id} className="overflow-hidden transition-shadow hover:shadow-md">
                    <CardContent className="p-0">
                      <div className="relative h-32 bg-gradient-to-br from-primary to-primary/80">
                        <Avatar className="absolute -bottom-12 left-1/2 h-24 w-24 -translate-x-1/2 border-4 border-background shadow-lg">
                          <AvatarImage src={artisan.avatar || naviiAvatar(artisan.name)} />
                          <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-sm font-semibold text-foreground shadow-sm">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          {artisan.avgRating.toFixed(1)}
                        </div>
                        {artisan.isVerified && (
                          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-primary shadow-sm">
                            <ShieldCheck className="h-3 w-3" />
                            Verified
                          </div>
                        )}
                      </div>

                      <div className="mt-14 space-y-4 p-4">
                        <div className="text-center">
                          <h3 className="font-semibold text-foreground">{artisan.name}</h3>
                          <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                          <Badge
                            variant="outline"
                            className={
                              artisan.availability === "available"
                                ? "mt-2 border-primary/20 bg-primary/5 text-primary"
                                : "mt-2 border-border bg-muted text-muted-foreground"
                            }
                          >
                            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                            {artisan.availability === "available" ? "Available" : "Busy"}
                          </Badge>
                        </div>

                        <div className="space-y-2 border-t pt-4">
                          <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Briefcase className="h-3.5 w-3.5" />
                              {artisan.reviews} reviews
                            </span>
                            {artisan.experienceYears && (
                              <span>{artisan.experienceYears}yr exp</span>
                            )}
                            {artisan.hourlyRate && (
                              <span>${artisan.hourlyRate}/hr</span>
                            )}
                          </div>
                          {artisan.services.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {artisan.services.slice(0, 3).map((s) => (
                                <Badge key={s.id} variant="secondary" className="text-[10px]">{s.name}</Badge>
                              ))}
                              {artisan.services.length > 3 && (
                                <Badge variant="secondary" className="text-[10px]">+{artisan.services.length - 3}</Badge>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1 bg-transparent" asChild>
                            <Link href={`/dashboard/user/artisan/${artisan.id}`}>View Profile</Link>
                          </Button>
                          <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                            <Link href={`/dashboard/user/book/${artisan.id}`}>Book Now</Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
