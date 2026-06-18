"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Star, Briefcase, Heart, Search, MessageSquare, UserRound, Loader2 } from "lucide-react"
import { naviiAvatar, cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

interface BackendArtisan {
  id: string
  bio?: string
  averageRating: number
  totalReviews: number
  availabilityStatus: string
  isVerified: boolean
  location?: string
  businessName?: string
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
    reviews: Number(a.totalReviews ?? 0),
    availability: a.availabilityStatus === "AVAILABLE" ? "available" : "busy",
  }
}

type MappedArtisan = ReturnType<typeof mapArtisan>

export default function FavouritesPage() {
  const [favourites, setFavourites] = useState<MappedArtisan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<BackendArtisan[] | { items: BackendArtisan[] }>("/favourites")
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: BackendArtisan[] }).items ?? []
        setFavourites(items.map(mapArtisan))
      })
      .catch(() => toast.error("Could not load favourites."))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = favourites.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.specialization.toLowerCase().includes(search.toLowerCase()),
  )

  const handleRemove = async (id: string) => {
    setRemoving(id)
    try {
      await apiFetch(`/favourites/${id}`, { method: "DELETE" })
      setFavourites((prev) => prev.filter((a) => a.id !== id))
      toast.success("Removed from favourites.")
    } catch {
      toast.error("Failed to remove. Please try again.")
    } finally {
      setRemoving(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Favourites</p>
            <h1 className="mt-0.5 text-2xl font-bold text-foreground">Saved Artisans</h1>
            <p className="text-sm text-muted-foreground">
              Quick access to artisans you&apos;ve bookmarked for rebooking
            </p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 sm:shrink-0" asChild>
            <Link href="/dashboard/user/search">
              <Search className="mr-2 h-4 w-4" />
              Find More Artisans
            </Link>
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your favourites..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {filtered.length} saved artisan{filtered.length !== 1 ? "s" : ""}
            </p>

            {filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 rounded-full bg-muted p-5">
                    <Heart className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {search ? "No matches found" : "No favourites yet"}
                  </h3>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    {search
                      ? "Try a different search term."
                      : "Save artisans you like for quick rebooking in the future."}
                  </p>
                  {!search && (
                    <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                      <Link href="/dashboard/user/search">Discover Artisans</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((artisan) => (
                  <Card key={artisan.id} className="group overflow-hidden transition-shadow hover:shadow-md">
                    <CardContent className="p-0">
                      <div className="relative h-28 bg-gradient-to-br from-primary to-primary/70">
                        <Avatar className="absolute -bottom-10 left-1/2 h-20 w-20 -translate-x-1/2 border-4 border-background shadow-md">
                          <AvatarImage src={artisan.avatar || naviiAvatar(artisan.name)} />
                          <AvatarFallback><UserRound className="h-5 w-5" /></AvatarFallback>
                        </Avatar>
                        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold shadow-sm">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {artisan.avgRating.toFixed(1)}
                        </div>
                        <button
                          type="button"
                          disabled={removing === artisan.id}
                          onClick={() => handleRemove(artisan.id)}
                          className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-background disabled:opacity-50"
                        >
                          {removing === artisan.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
                            : <Heart className="h-3.5 w-3.5 fill-destructive text-destructive" />
                          }
                        </button>
                      </div>

                      <div className="mt-12 space-y-4 p-4">
                        <div className="text-center">
                          <h3 className="font-semibold text-foreground">{artisan.name}</h3>
                          <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "mt-2 text-xs",
                              artisan.availability === "available"
                                ? "border-primary/30 bg-primary/5 text-primary"
                                : "border-border bg-muted text-muted-foreground",
                            )}
                          >
                            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                            {artisan.availability === "available" ? "Available" : "Busy"}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5" />
                            {artisan.reviews} reviews
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" className="bg-transparent text-xs" asChild>
                            <Link href={`/dashboard/user/messages?artisan=${artisan.id}`}>
                              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                              Message
                            </Link>
                          </Button>
                          <Button size="sm" className="bg-primary text-xs text-primary-foreground hover:bg-primary/90" asChild>
                            <Link href={`/dashboard/user/book/${artisan.id}`}>Book Again</Link>
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
