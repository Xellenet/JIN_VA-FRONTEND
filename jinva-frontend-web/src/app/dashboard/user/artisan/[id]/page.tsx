"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Star,
  MapPin,
  Briefcase,
  Award,
  ImageIcon,
  ArrowLeft,
  MessageSquare,
  UserRound,
  Loader2,
  ShieldCheck,
  Heart,
} from "lucide-react"
import { naviiAvatar, formatCurrency } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { useFavouriteIds } from "@/hooks/use-favourites"

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
  user: {
    id: string
    firstname: string
    lastname: string
    profilePicture?: string
    email?: string
    phoneNumber?: string
  }
  createdAt: string
}

interface BackendReview {
  id: string
  rating: number
  review?: string
  reviewerName?: string
  reviewerUser?: {
    id: string
    firstname: string
    lastname: string
    profilePicture?: string
  }
  createdAt: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export default function ArtisanPublicProfile() {
  const { id } = useParams<{ id: string }>()

  const [artisan, setArtisan] = useState<BackendArtisan | null>(null)
  const [reviews, setReviews] = useState<BackendReview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const { favouriteIds, pendingId, toggleFavourite } = useFavouriteIds()

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    Promise.all([
      apiFetch<BackendArtisan>(`/artisans/${id}`),
      apiFetch<BackendReview[] | { items: BackendReview[] }>(`/reviews/artisan-profile/${id}`).catch(() => [] as BackendReview[]),
    ])
      .then(([profile, reviewsResult]) => {
        setArtisan(profile)
        const reviewItems = Array.isArray(reviewsResult)
          ? reviewsResult
          : (reviewsResult as { items: BackendReview[] }).items ?? []
        setReviews(reviewItems)
      })
      .catch(() => setError("Could not load artisan profile."))
      .finally(() => setIsLoading(false))
  }, [id])

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !artisan) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
            <Link href="/dashboard/user/search"><ArrowLeft className="h-4 w-4" />Back to Search</Link>
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">{error || "Artisan not found."}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  const name = `${artisan.user.firstname} ${artisan.user.lastname}`.trim()
  const isAvailable = artisan.availabilityStatus === "AVAILABLE"
  const specialization = artisan.businessName || artisan.services?.[0]?.name || "General Service"

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/user/search">
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Link>
        </Button>

        {/* Profile Hero */}
        <Card className="overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary to-primary/80" />
          <CardContent className="relative px-6 pb-6">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
              <div className="relative -mt-16">
                <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                  <AvatarImage src={artisan.user.profilePicture || naviiAvatar(name, 128)} />
                  <AvatarFallback><UserRound className="h-8 w-8" /></AvatarFallback>
                </Avatar>
                {artisan.isVerified && (
                  <span className="absolute -right-1 bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-background shadow">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">{name}</h1>
                    <Badge
                      variant="outline"
                      className={isAvailable
                        ? "border-primary/20 bg-primary/5 text-primary"
                        : "border-border bg-muted text-muted-foreground"}
                    >
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                      {isAvailable ? "Available" : "Busy"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{specialization}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {artisan.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {artisan.location}
                      </span>
                    )}
                    {artisan.experienceYears && (
                      <span>{artisan.experienceYears} years experience</span>
                    )}
                    {artisan.hourlyRate && (
                      <span>{formatCurrency(artisan.hourlyRate)}/hr</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="bg-transparent"
                    disabled={pendingId === artisan.id}
                    onClick={() => toggleFavourite(artisan.id)}
                  >
                    {pendingId === artisan.id
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Heart className={`mr-2 h-4 w-4 ${favouriteIds.has(artisan.id) ? "fill-destructive text-destructive" : ""}`} />
                    }
                    {favouriteIds.has(artisan.id) ? "Saved" : "Save"}
                  </Button>
                  <Button variant="outline" asChild className="bg-transparent">
                    <Link href={`/dashboard/user/messages?artisan=${artisan.id}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Message
                    </Link>
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href={`/dashboard/user/book/${artisan.id}`}>Book Now</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold text-foreground">{Number(artisan.averageRating).toFixed(1)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Avg. Rating</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Award className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{artisan.totalReviews}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Reviews</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{artisan.services?.length ?? 0}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Services</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-foreground">0</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Portfolio Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="about" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold text-foreground">No portfolio items yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This artisan hasn&apos;t added any portfolio items yet.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about">
            <Card>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-foreground">About {name}</h3>
                  <p className="leading-relaxed text-muted-foreground">
                    {artisan.bio || `Professional artisan specializing in ${specialization.toLowerCase()}. Committed to quality workmanship and customer satisfaction.`}
                  </p>
                </div>
                {artisan.services && artisan.services.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-foreground">Services Offered</h4>
                    <div className="flex flex-wrap gap-2">
                      {artisan.services.map((s) => (
                        <Badge key={s.id} variant="secondary">{s.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-foreground">Specialization</p>
                    <p className="mt-1 text-sm text-muted-foreground">{specialization}</p>
                  </div>
                  {artisan.experienceYears && (
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm font-medium text-foreground">Experience</p>
                      <p className="mt-1 text-sm text-muted-foreground">{artisan.experienceYears} years</p>
                    </div>
                  )}
                  {artisan.location && (
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm font-medium text-foreground">Location</p>
                      <p className="mt-1 text-sm text-muted-foreground">{artisan.location}</p>
                    </div>
                  )}
                  {artisan.hourlyRate && (
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm font-medium text-foreground">Hourly Rate</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatCurrency(artisan.hourlyRate)}/hr</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <div className="border-b border-border p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Client Reviews</h3>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-foreground">{Number(artisan.averageRating).toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">({artisan.totalReviews} reviews)</span>
                  </div>
                </div>
              </div>
              <CardContent className="divide-y divide-border p-0">
                {reviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Star className="mb-3 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No reviews yet.</p>
                  </div>
                ) : (
                  reviews.map((review) => {
                    const reviewerName = review.reviewerUser
                      ? `${review.reviewerUser.firstname} ${review.reviewerUser.lastname}`.trim()
                      : (review.reviewerName ?? "Anonymous")
                    const avatar = review.reviewerUser?.profilePicture
                    return (
                      <div key={review.id} className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={avatar || naviiAvatar(reviewerName)} />
                              <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">{reviewerName}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={`${review.id}-star-${i}`}
                                className={`h-4 w-4 ${i < Number(review.rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.review && (
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{review.review}</p>
                        )}
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
