"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Search,
  ChevronDown,
  Star,
  Briefcase,
  UserRound,
  Loader2,
  ShieldCheck,
  Heart,
  MapPin,
  Info,
  ArrowUpDown,
  Wallet,
} from "lucide-react"
import { naviiAvatar, formatCurrency } from "@/lib/utils"
import { apiFetchWithMeta } from "@/lib/api"
import { useFavouriteIds } from "@/hooks/use-favourites"

interface BackendArtisan {
  id: string
  bio?: string
  experienceYears?: number
  hourlyRate?: number
  businessName?: string
  averageRating: number
  totalReviews: number
  completedJobsCount?: number
  availabilityStatus: string
  isVerified: boolean
  location?: string
  services?: { id: string; name: string; price?: number | null }[]
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
    completedJobsCount: Number(a.completedJobsCount ?? 0),
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

// D2: only "highest rated" and "most experienced" are backed by a real
// `sortBy` value today. "Most reviewed" has no backend `sortBy` value (see
// api-contract.md §1 note) and "nearest" is deferred (Decision #1) — neither
// is offered here so we never send an unsupported value.
const sortOptions = [
  { label: "Highest Rated", value: "rating" },
  { label: "Most Experienced", value: "experience" },
]

const availabilityWindowOptions = [
  { label: "Any time", value: "" },
  { label: "Available now", value: "now" },
  { label: "Available this week", value: "this_week" },
]

const PAGE_SIZE = 20
const DEBOUNCE_MS = 300

export default function SearchArtisansPage() {
  const [keyword, setKeyword] = useState("")
  const [location, setLocation] = useState("")
  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [selectedServiceName, setSelectedServiceName] = useState("All Services")
  const [minRating, setMinRating] = useState(0)
  const [availabilityFilter, setAvailabilityFilter] = useState("")
  const [availabilityWindow, setAvailabilityWindow] = useState("")
  const [sortBy, setSortBy] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [artisans, setArtisans] = useState<MappedArtisan[]>([])
  const [services, setServices] = useState<BackendService[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const { favouriteIds, pendingId, toggleFavourite } = useFavouriteIds()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    apiFetchWithMeta<BackendService[] | { items: BackendService[] }>("/services")
      .then(({ data }) => setServices(Array.isArray(data) ? data : (data as { items: BackendService[] }).items ?? []))
      .catch(() => {})
  }, [])

  const fetchArtisans = useCallback(
    async (params: {
      kw: string
      loc: string
      svcId: string
      rating: number
      avail: string
      availWindow: string
      sort: string
      min: string
      max: string
      pageNum: number
    }) => {
      setIsLoading(true)
      setLoadError(false)
      try {
        const qs = new URLSearchParams()
        if (params.kw) qs.set("keyword", params.kw)
        if (params.loc) qs.set("location", params.loc)
        if (params.svcId) qs.set("serviceId", params.svcId)
        if (params.rating > 0) qs.set("minRating", String(params.rating))
        if (params.avail) qs.set("availabilityStatus", params.avail)
        if (params.availWindow) qs.set("availabilityWindow", params.availWindow)
        if (params.sort) qs.set("sortBy", params.sort)
        if (params.min) qs.set("minPrice", params.min)
        if (params.max) qs.set("maxPrice", params.max)
        qs.set("page", String(params.pageNum))
        qs.set("limit", String(PAGE_SIZE))

        const { data: result, meta } = await apiFetchWithMeta<BackendArtisan[] | { items: BackendArtisan[] }>(
          `/artisans?${qs}`,
        )
        const items = Array.isArray(result) ? result : (result as { items: BackendArtisan[] }).items ?? []
        setArtisans(items.map(mapArtisan))

        const metaTotalPages = (meta?.totalPages as number | undefined)
          ?? ((meta?.pagination as { totalPages?: number } | undefined)?.totalPages)
        const metaTotal = (meta?.total as number | undefined)
          ?? ((meta?.pagination as { total?: number } | undefined)?.total)
        setTotalPages(metaTotalPages && metaTotalPages > 0 ? metaTotalPages : 1)
        setTotal(metaTotal ?? items.length)
      } catch {
        setArtisans([])
        setTotalPages(1)
        setTotal(0)
        setLoadError(true)
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  // D5: reset back to page 1 whenever a filter (anything but page itself)
  // changes, so we never show a stale page N of newly-filtered results.
  useEffect(() => {
    setPage(1)
  }, [keyword, location, selectedServiceId, minRating, availabilityFilter, availabilityWindow, sortBy, minPrice, maxPrice])

  // D5/D6: every filter and every page change is debounced at a uniform
  // 300ms — nothing fires an immediate, un-throttled request.
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchArtisans({
        kw: keyword,
        loc: location,
        svcId: selectedServiceId,
        rating: minRating,
        avail: availabilityFilter,
        availWindow: availabilityWindow,
        sort: sortBy,
        min: minPrice,
        max: maxPrice,
        pageNum: page,
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [keyword, location, selectedServiceId, minRating, availabilityFilter, availabilityWindow, sortBy, minPrice, maxPrice, page, fetchArtisans])

  const activeFilters = [
    selectedServiceId ? selectedServiceName : null,
    minRating > 0 ? `${minRating}+ stars` : null,
    availabilityFilter === "AVAILABLE" ? "Available" : availabilityFilter === "BUSY" ? "Busy" : null,
    availabilityWindow ? availabilityWindowOptions.find((o) => o.value === availabilityWindow)?.label : null,
    location ? `Near "${location}"` : null,
    minPrice || maxPrice
      ? `${minPrice ? formatCurrency(minPrice) : "Any"} – ${maxPrice ? formatCurrency(maxPrice) : "Any"}`
      : null,
    sortBy ? `Sort: ${sortOptions.find((o) => o.value === sortBy)?.label}` : null,
  ].filter(Boolean)

  const clearFilters = () => {
    setSelectedServiceId("")
    setSelectedServiceName("All Services")
    setMinRating(0)
    setAvailabilityFilter("")
    setAvailabilityWindow("")
    setSortBy("")
    setMinPrice("")
    setMaxPrice("")
    setKeyword("")
    setLocation("")
  }

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return
    setPage(p)
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

              <div className="relative flex-1 md:max-w-xs">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Location (e.g. Accra)"
                  className="pl-10"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {selectedServiceName}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
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
                <DropdownMenuContent align="start" className="w-48">
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
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>Availability</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {[
                    { label: "All Availability", value: "" },
                    { label: "Available Now (status)", value: "AVAILABLE" },
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

              {/* D7: best-effort schedule-based availability window */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {availabilityWindow
                      ? availabilityWindowOptions.find((o) => o.value === availabilityWindow)?.label
                      : "Schedule"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Availability Window</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availabilityWindowOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value || "any"}
                      onClick={() => setAvailabilityWindow(opt.value)}
                      className={availabilityWindow === opt.value ? "bg-accent text-accent-foreground" : ""}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="flex items-start gap-1.5 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>Based on the artisan&apos;s stated weekly hours — not a live availability guarantee.</span>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* D4: price range filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    <Wallet className="h-4 w-4" />
                    {minPrice || maxPrice
                      ? `${minPrice ? formatCurrency(minPrice) : "Any"} – ${maxPrice ? formatCurrency(maxPrice) : "Any"}`
                      : "Price Range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 space-y-3">
                  <p className="text-sm font-medium text-foreground">Price Range (GH₵)</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="minPrice" className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        id="minPrice"
                        type="number"
                        min={0}
                        placeholder="0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="maxPrice" className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        id="maxPrice"
                        type="number"
                        min={0}
                        placeholder="Any"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                      />
                    </div>
                  </div>
                  {(minPrice || maxPrice) && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setMinPrice(""); setMaxPrice("") }}>
                      Clear price range
                    </Button>
                  )}
                </PopoverContent>
              </Popover>

              {/* D2: sort control — "nearest" intentionally excluded (Decision #1) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    <ArrowUpDown className="h-4 w-4" />
                    {sortBy ? sortOptions.find((o) => o.value === sortBy)?.label : "Sort"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setSortBy("")}
                    className={!sortBy ? "bg-accent text-accent-foreground" : ""}
                  >
                    Default
                  </DropdownMenuItem>
                  {sortOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setSortBy(opt.value)}
                      className={sortBy === opt.value ? "bg-accent text-accent-foreground" : ""}
                    >
                      {opt.label}
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
              {loadError
                ? "Could not load results."
                : `Showing ${artisans.length} of ${total} artisan${total !== 1 ? "s" : ""}`}
            </p>

            {artisans.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="mb-4 h-12 w-12 text-muted-foreground/40" />
                  <h3 className="text-lg font-semibold text-foreground">
                    {loadError ? "Something went wrong" : "No artisans found"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {loadError
                      ? "We couldn't load search results. Please try again."
                      : "Try adjusting your filters or search query."}
                  </p>
                  <Button variant="outline" className="mt-4 bg-transparent" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
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
                          <button
                            type="button"
                            disabled={pendingId === artisan.id}
                            onClick={() => toggleFavourite(artisan.id)}
                            className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 shadow-sm transition-opacity hover:bg-background disabled:opacity-50"
                            title={favouriteIds.has(artisan.id) ? "Remove from favourites" : "Save to favourites"}
                          >
                            {pendingId === artisan.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                              : <Heart className={`h-3.5 w-3.5 ${favouriteIds.has(artisan.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                            }
                          </button>
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
                                {artisan.completedJobsCount} jobs completed
                              </span>
                              {artisan.experienceYears && (
                                <span>{artisan.experienceYears}yr exp</span>
                              )}
                              {artisan.hourlyRate && (
                                <span>{formatCurrency(artisan.hourlyRate)}/hr</span>
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

                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => { e.preventDefault(); goToPage(page - 1) }}
                          className={page === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === page}
                            onClick={(e) => { e.preventDefault(); goToPage(p) }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => { e.preventDefault(); goToPage(page + 1) }}
                          className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
