"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RatingStars } from "@/components/ui/rating-stars"
import {
  Briefcase,
  Heart,
  Search,
  MessageSquare,
  UserRound,
  ShieldCheck,
  ArrowUpDown,
  ChevronDown,
  AlertTriangle,
} from "lucide-react"
import { naviiAvatar, cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

interface BackendArtisan {
  id: string
  bio?: string
  averageRating: number
  totalReviews: number
  completedJobsCount?: number
  availabilityStatus: string
  isVerified: boolean
  location?: string
  businessName?: string
  services?: { id: string; name: string }[]
  user: { id: string; firstname: string; lastname: string; profilePicture?: string }
  favouritedAt?: string
}

// FB1: the real `GET /favourites` response is `{ message, data, pagination }`
// — read `.data` (and `.pagination` for paging), never a nonexistent `items`
// field. Also defensively accepts a bare array in case the shape is ever
// simplified server-side.
interface FavouritesEnvelope {
  message?: string
  data?: BackendArtisan[]
  pagination?: { total: number; page: number; limit: number; totalPages: number }
}

function extractFavourites(response: BackendArtisan[] | FavouritesEnvelope): BackendArtisan[] {
  return Array.isArray(response) ? response : response?.data ?? []
}

function mapArtisan(a: BackendArtisan) {
  return {
    id: a.id,
    name: `${a.user.firstname} ${a.user.lastname}`.trim(),
    specialization: a.businessName || a.services?.[0]?.name || "General Service",
    avatar: a.user.profilePicture,
    avgRating: Number(a.averageRating ?? 0),
    totalReviews: Number(a.totalReviews ?? 0),
    completedJobsCount: a.completedJobsCount,
    availability: a.availabilityStatus === "AVAILABLE" ? "available" : "busy",
    isVerified: a.isVerified,
    favouritedAt: a.favouritedAt,
  }
}

type MappedArtisan = ReturnType<typeof mapArtisan>
type SortBy = "recent" | "rating" | "name"

const sortOptions: { label: string; value: SortBy }[] = [
  { label: "Recently Saved", value: "recent" },
  { label: "Highest Rated", value: "rating" },
  { label: "Name A–Z", value: "name" },
]

function FavouriteCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Skeleton className="h-28 w-full rounded-none" />
        <div className="mt-12 space-y-4 p-4">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-full" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function FavouritesPage() {
  const [favourites, setFavourites] = useState<MappedArtisan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>("recent")
  const sortTouchedRef = useRef(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError(false)
    apiFetch<BackendArtisan[] | FavouritesEnvelope>("/favourites")
      .then((r) => {
        const mapped = extractFavourites(r).map(mapArtisan)
        setFavourites(mapped)
        // design-spec.md §10.2: if the backend hasn't shipped `favouritedAt`
        // yet, "Recently Saved" has nothing real to sort by — fall back to
        // "Highest Rated" rather than a no-op sort, unless the customer
        // already picked a sort themselves.
        if (!sortTouchedRef.current && mapped.length > 0 && !mapped.some((a) => a.favouritedAt)) {
          setSortBy("rating")
        }
      })
      .catch(() => {
        setLoadError(true)
        toast.error("Could not load favourites.")
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const list = favourites.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.specialization.toLowerCase().includes(search.toLowerCase()),
    )
    const sorted = [...list]
    if (sortBy === "rating") {
      sorted.sort((a, b) => b.avgRating - a.avgRating)
    } else if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      sorted.sort((a, b) => {
        if (!a.favouritedAt && !b.favouritedAt) return 0
        if (!a.favouritedAt) return 1
        if (!b.favouritedAt) return -1
        return new Date(b.favouritedAt).getTime() - new Date(a.favouritedAt).getTime()
      })
    }
    return sorted
  }, [favourites, search, sortBy])

  const handleRemove = async (id: string) => {
    setRemovingId(id)
    try {
      await apiFetch(`/favourites/${id}`, { method: "DELETE" })
      setFavourites((prev) => prev.filter((a) => a.id !== id))
      toast.success("Removed from favourites.")
    } catch (err) {
      // Edge case: removing an already-gone favourite (stale UI / double
      // click) should read as a no-op, not a hard failure.
      const message = err instanceof Error ? err.message : ""
      if (/not found/i.test(message)) {
        setFavourites((prev) => prev.filter((a) => a.id !== id))
      } else {
        toast.error("Failed to remove. Please try again.")
      }
    } finally {
      setRemovingId(null)
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search your favourites..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 bg-transparent sm:shrink-0">
                <ArrowUpDown className="h-4 w-4" />
                Sort: {sortOptions.find((o) => o.value === sortBy)?.label}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sortOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); sortTouchedRef.current = true }}
                  className={sortBy === opt.value ? "bg-accent text-accent-foreground" : ""}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <FavouriteCardSkeleton key={i} />
            ))}
          </div>
        ) : loadError ? (
          <Card>
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon"><AlertTriangle className="text-muted-foreground" /></EmptyMedia>
                <EmptyTitle>Couldn&apos;t load your favourites</EmptyTitle>
                <EmptyDescription>Something went wrong on our end.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" className="bg-transparent" onClick={load}>Retry</Button>
              </EmptyContent>
            </Empty>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {filtered.length} saved artisan{filtered.length !== 1 ? "s" : ""}
            </p>

            {filtered.length === 0 ? (
              <Card>
                <Empty className="border-0 py-16">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Heart className="text-muted-foreground" /></EmptyMedia>
                    <EmptyTitle>{search ? "No matches found" : "No favourites yet"}</EmptyTitle>
                    <EmptyDescription>
                      {search
                        ? "Try a different search term."
                        : "Save artisans you like for quick rebooking in the future."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {!search && (
                    <EmptyContent>
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                        <Link href="/dashboard/user/search">Discover Artisans</Link>
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((artisan) => (
                  <Card key={artisan.id} className="overflow-hidden transition-shadow hover:shadow-md">
                    <CardContent className="p-0">
                      <div className="relative h-28 bg-gradient-to-br from-primary to-primary/70">
                        {artisan.isVerified && (
                          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-primary shadow-sm">
                            <ShieldCheck className="h-3 w-3" />
                            Verified
                          </div>
                        )}
                        {artisan.totalReviews > 0 && (
                          <div className="absolute right-3 top-3 rounded-full bg-background/90 px-2.5 py-1 shadow-sm">
                            <RatingStars rating={artisan.avgRating} totalReviews={artisan.totalReviews} size="sm" />
                          </div>
                        )}
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                          <div className="relative">
                            <Avatar className="h-20 w-20 border-4 border-background shadow-md">
                              <AvatarImage src={artisan.avatar || naviiAvatar(artisan.name)} />
                              <AvatarFallback><UserRound className="h-5 w-5" /></AvatarFallback>
                            </Avatar>
                            <button
                              type="button"
                              disabled={removingId === artisan.id}
                              onClick={() => handleRemove(artisan.id)}
                              aria-label="Remove from favourites"
                              title="Remove from favourites"
                              className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-destructive focus-visible:bg-background focus-visible:text-destructive focus-visible:outline-none disabled:opacity-50"
                            >
                              <Heart className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-12 space-y-4 p-4">
                        <div className="text-center">
                          <h3 className="font-semibold text-foreground">{artisan.name}</h3>
                          <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                          {artisan.favouritedAt && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Saved {formatDistanceToNow(new Date(artisan.favouritedAt), { addSuffix: true })}
                            </p>
                          )}
                          {artisan.totalReviews === 0 && (
                            <div className="mt-1.5 flex justify-center">
                              <RatingStars rating={0} totalReviews={0} size="sm" />
                            </div>
                          )}
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

                        {artisan.completedJobsCount != null && (
                          <div className="flex items-center justify-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3.5 w-3.5" />
                              {artisan.completedJobsCount} jobs completed
                            </span>
                          </div>
                        )}

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
