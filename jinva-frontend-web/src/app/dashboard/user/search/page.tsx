"use client"

import { useState, useMemo } from "react"
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
import { Search, ChevronDown, Star, Phone, Mail, MapPin, Briefcase, UserRound } from "lucide-react"
import { naviiAvatar } from "@/lib/utils"
import { mockArtisans } from "@/lib/data/mock-data"

const specializations = [
  "All Specializations",
  "Installation",
  "Leak Repair",
  "Drain Cleaning",
  "Emergency Service",
  "Maintenance",
  "Renovation",
  "Inspection",
  "Water Heater",
  "Pipe Fitting",
]

const ratingOptions = [
  { label: "All Ratings", value: 0 },
  { label: "4.5 & above", value: 4.5 },
  { label: "4.0 & above", value: 4.0 },
  { label: "3.5 & above", value: 3.5 },
  { label: "3.0 & above", value: 3.0 },
]

const availabilityOptions = [
  { label: "All Availability", value: "all" },
  { label: "Available Now", value: "available" },
  { label: "Busy", value: "busy" },
]

export default function SearchArtisansPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSpecialization, setSelectedSpecialization] = useState("All Specializations")
  const [selectedRating, setSelectedRating] = useState(0)
  const [selectedAvailability, setSelectedAvailability] = useState("all")

  const filteredArtisans = useMemo(() => {
    return mockArtisans.filter((artisan) => {
      const matchesSearch =
        !searchQuery ||
        artisan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artisan.specialization?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesSpec =
        selectedSpecialization === "All Specializations" ||
        artisan.specialization === selectedSpecialization

      const matchesRating = artisan.avgRating >= selectedRating

      const matchesAvailability =
        selectedAvailability === "all" || artisan.availability === selectedAvailability

      return matchesSearch && matchesSpec && matchesRating && matchesAvailability
    })
  }, [searchQuery, selectedSpecialization, selectedRating, selectedAvailability])

  const activeFilters = [
    selectedSpecialization !== "All Specializations" ? selectedSpecialization : null,
    selectedRating > 0 ? `${selectedRating}+ stars` : null,
    selectedAvailability !== "all" ? (selectedAvailability === "available" ? "Available" : "Busy") : null,
  ].filter(Boolean)

  const clearFilters = () => {
    setSelectedSpecialization("All Specializations")
    setSelectedRating(0)
    setSelectedAvailability("all")
    setSearchQuery("")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Find Artisans</h1>
          <p className="text-muted-foreground">Search and book trusted artisans in your area</p>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or specialization..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Specialization dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {selectedSpecialization}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Specialization</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {specializations.map((spec) => (
                    <DropdownMenuItem
                      key={spec}
                      onClick={() => setSelectedSpecialization(spec)}
                      className={selectedSpecialization === spec ? "bg-accent text-accent-foreground" : ""}
                    >
                      {spec}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Rating dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {selectedRating > 0 ? `${selectedRating}+ Stars` : "Rating"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Minimum Rating</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ratingOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setSelectedRating(opt.value)}
                      className={selectedRating === opt.value ? "bg-accent text-accent-foreground" : ""}
                    >
                      <div className="flex items-center gap-2">
                        {opt.value > 0 && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />}
                        {opt.label}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Availability dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {selectedAvailability === "all"
                      ? "Availability"
                      : selectedAvailability === "available"
                        ? "Available"
                        : "Busy"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Availability</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availabilityOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setSelectedAvailability(opt.value)}
                      className={selectedAvailability === opt.value ? "bg-accent text-accent-foreground" : ""}
                    >
                      <div className="flex items-center gap-2">
                        {opt.value !== "all" && (
                          <span
                            className={`h-2 w-2 rounded-full ${opt.value === "available" ? "bg-green-500" : "bg-muted-foreground"}`}
                          />
                        )}
                        {opt.label}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Active filters chips */}
            {activeFilters.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Active filters:</span>
                {activeFilters.map((f) => (
                  <Badge key={f} variant="secondary" className="gap-1 text-xs">
                    {f}
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" className="h-6 text-xs text-primary hover:text-primary/80" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          Showing {filteredArtisans.length} artisan{filteredArtisans.length !== 1 ? "s" : ""}
        </p>

        {/* Artisans Grid */}
        {filteredArtisans.length === 0 ? (
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
            {filteredArtisans.map((artisan) => (
              <Card key={artisan.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="p-0">
                  <div className="relative h-32 bg-gradient-to-br from-primary to-primary/80">
                    <Avatar className="absolute -bottom-12 left-1/2 h-24 w-24 -translate-x-1/2 border-4 border-background shadow-lg">
                      <AvatarImage src={artisan.avatar || naviiAvatar(artisan.name)} />
                      <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-sm font-semibold shadow-sm">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      {artisan.avgRating}
                    </div>
                  </div>

                  <div className="mt-14 space-y-4 p-4">
                    <div className="text-center">
                      <h3 className="font-semibold text-foreground">{artisan.name}</h3>
                      <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                      <Badge
                        variant="outline"
                        className={
                          artisan.availability === "available"
                            ? "mt-2 border-green-200 bg-green-50 text-green-700"
                            : "mt-2 border-muted bg-muted text-muted-foreground"
                        }
                      >
                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                        {artisan.availability === "available" ? "Available" : "Busy"}
                      </Badge>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{artisan.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{artisan.email}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5" />
                          {artisan.jobsCompleted} jobs
                        </span>
                        <span>{artisan.reviews} reviews</span>
                      </div>
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
      </div>
    </DashboardLayout>
  )
}
