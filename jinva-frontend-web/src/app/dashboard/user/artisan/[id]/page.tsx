"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
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
  Flag,
  Pencil,
} from "lucide-react"
import { naviiAvatar, formatCurrency } from "@/lib/utils"
import { apiFetch, apiFetchWithMeta } from "@/lib/api"
import { useFavouriteIds } from "@/hooks/use-favourites"
import { useAuth } from "@/contexts/auth-context"
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery"
import { RatingStars } from "@/components/ui/rating-stars"
import { VerifiedBookingBadge } from "@/components/reviews/verified-booking-badge"
import { ReviewPhotoThumbnails } from "@/components/reviews/review-photo-thumbnails"
import { ReviewReasonDialog } from "@/components/reviews/review-reason-dialog"
import type { ApiPortfolioItem, ApiReview } from "@/lib/types"
import { toast } from "sonner"

// RE1 — matches `REVIEW_EDIT_WINDOW_HOURS` in api-contract.md §1.
const REVIEW_EDIT_WINDOW_HOURS = 48

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
  cancellationPolicy?: string
  services?: { id: string; name: string; price?: number | null }[]
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

// RV2: reviews are paginated server-side (default limit 10, max 50) — always
// send `page`/`limit` explicitly and surface `meta.pagination` rather than
// relying on the backend default, or reviews 11+ are silently unreachable.
const REVIEWS_PAGE_SIZE = 10

function extractTotalPages(meta: Record<string, unknown> | undefined): number {
  const direct = meta?.totalPages as number | undefined
  const nested = (meta?.pagination as { totalPages?: number } | undefined)?.totalPages
  const value = direct ?? nested ?? 1
  return value > 0 ? value : 1
}

function fetchReviews(artisanId: string, page: number): Promise<{ reviews: ApiReview[]; totalPages: number }> {
  return apiFetchWithMeta<ApiReview[] | { items: ApiReview[] }>(
    `/reviews/artisan-profile/${artisanId}?page=${page}&limit=${REVIEWS_PAGE_SIZE}`,
  )
    .then(({ data, meta }) => ({
      reviews: Array.isArray(data) ? data : (data as { items: ApiReview[] })?.items ?? [],
      totalPages: extractTotalPages(meta),
    }))
    .catch(() => ({ reviews: [] as ApiReview[], totalPages: 1 }))
}

export default function ArtisanPublicProfile() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [artisan, setArtisan] = useState<BackendArtisan | null>(null)
  const [reviews, setReviews] = useState<ApiReview[]>([])
  const [reviewsPage, setReviewsPage] = useState(1)
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [flagTarget, setFlagTarget] = useState<ApiReview | null>(null)
  const { favouriteIds, pendingId, toggleFavourite } = useFavouriteIds()

  // P3/PF9: this artisan's public (APPROVED-only) portfolio items
  const [portfolioItems, setPortfolioItems] = useState<ApiPortfolioItem[]>([])
  const [portfolioLoading, setPortfolioLoading] = useState(true)
  const [portfolioError, setPortfolioError] = useState(false)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    Promise.all([apiFetch<BackendArtisan>(`/artisans/${id}`), fetchReviews(id, 1)])
      .then(([profile, reviewData]) => {
        setArtisan(profile)
        setReviews(reviewData.reviews)
        setReviewsPage(1)
        setReviewsTotalPages(reviewData.totalPages)
      })
      .catch(() => setError("Could not load artisan profile."))
      .finally(() => setIsLoading(false))
  }, [id])

  // RV2: reused both by the pagination control and by the post-flag refresh
  // below. If flagging emptied the current page (e.g. the last review on the
  // last page gets flagged), step back a page rather than show a dead end —
  // same guard already used by the admin reviews queue's pager.
  const loadReviewsPage = useCallback((artisanId: string, p: number) => {
    fetchReviews(artisanId, p).then(({ reviews: items, totalPages }) => {
      if (items.length === 0 && p > 1) {
        loadReviewsPage(artisanId, p - 1)
        return
      }
      setReviews(items)
      setReviewsPage(p)
      setReviewsTotalPages(totalPages)
    })
  }, [])

  const handleFlagSubmitted = async (reason: string) => {
    if (!flagTarget) return
    await apiFetch(`/reviews/${flagTarget.id}/flag`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })
    // FL1: hides immediately for everyone except the original reviewer, who
    // still sees it marked "Under review" — refetch the current page rather
    // than guess which branch applies, so the list always matches what the
    // server would return.
    if (id) loadReviewsPage(id, reviewsPage)
    toast.success("Reported — this review has been hidden pending review.")
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setPortfolioLoading(true)
    setPortfolioError(false)
    apiFetch<ApiPortfolioItem[]>(`/portfolio/${id}`)
      .then((data) => {
        if (!cancelled) setPortfolioItems(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setPortfolioError(true)
      })
      .finally(() => {
        if (!cancelled) setPortfolioLoading(false)
      })
    return () => { cancelled = true }
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
      <div className="space-y-6 pb-24">
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
                    {/* The deep link takes the artisan's **user** id, not this
                        page's artisan-profile id — they are different sequences
                        and a profile id can collide with an unrelated user's id
                        (qa-report.md F4). */}
                    <Link href={`/dashboard/user/messages?artisan=${artisan.user.id}`}>
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
                  <RatingStars
                    rating={Number(artisan.averageRating)}
                    totalReviews={Number(artisan.totalReviews ?? 0)}
                    size="lg"
                    showCount={false}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Avg. Rating</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Award className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{artisan.completedJobsCount ?? 0}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Jobs Completed</p>
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
                  <span className="text-2xl font-bold text-foreground">{portfolioItems.length}</span>
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
            <TabsTrigger value="reviews">Reviews ({Number(artisan.totalReviews ?? reviews.length)})</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio">
            <PortfolioGallery items={portfolioItems} isLoading={portfolioLoading} error={portfolioError} />
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
                    <h4 className="mb-3 text-sm font-semibold text-foreground">Services &amp; Pricing</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {artisan.services.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg border border-border p-3"
                        >
                          <span className="text-sm font-medium text-foreground">{s.name}</span>
                          <span className={s.price != null ? "text-sm font-semibold text-primary" : "text-xs italic text-muted-foreground"}>
                            {s.price != null ? formatCurrency(s.price) : "Price on request"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Cancellation Policy
                  </h4>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    {artisan.cancellationPolicy ? (
                      <p className="text-sm leading-relaxed text-muted-foreground">{artisan.cancellationPolicy}</p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        This artisan hasn&apos;t set a specific cancellation policy yet. Please confirm cancellation terms directly with them before booking.
                      </p>
                    )}
                  </div>
                </div>
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
                  <RatingStars rating={Number(artisan.averageRating)} totalReviews={Number(artisan.totalReviews ?? 0)} size="lg" />
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
                    const isOwnReview = !!user && !!review.reviewerUser && String(review.reviewerUser.id) === String(user.id)
                    const hoursElapsed = (Date.now() - new Date(review.createdAt).getTime()) / 3_600_000
                    const hoursLeft = Math.ceil(REVIEW_EDIT_WINDOW_HOURS - hoursElapsed)
                    const canEdit = isOwnReview && hoursLeft > 0 && !!review.job?.id
                    const isUnderReview = review.status === "FLAGGED" && isOwnReview

                    return (
                      <div key={review.id} className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={avatar || naviiAvatar(reviewerName)} />
                              <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-medium text-foreground">{reviewerName}</p>
                                {review.verifiedBooking && <VerifiedBookingBadge />}
                                {isUnderReview && (
                                  <Badge variant="outline" className="border-yellow-200 bg-yellow-100 text-yellow-700">
                                    Under review
                                  </Badge>
                                )}
                                {review.editedAt && (
                                  <Badge variant="outline" className="text-muted-foreground">Edited</Badge>
                                )}
                              </div>
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
                        <ReviewPhotoThumbnails photos={review.photos} />
                        {review.artisanReply && (
                          <div className="mt-3 rounded-r-lg border-l-2 border-primary bg-primary/5 py-2 pl-3 pr-2">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                              <MessageSquare className="h-3 w-3" />
                              Response from {artisan.businessName || name}
                              {review.artisanRepliedAt && (
                                <span className="font-normal text-muted-foreground">· {formatDate(review.artisanRepliedAt)}</span>
                              )}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-foreground">{review.artisanReply}</p>
                          </div>
                        )}
                        {isUnderReview && (
                          <p className="mt-2 text-xs italic text-muted-foreground">
                            This review is under moderation review and is temporarily hidden from other users.
                          </p>
                        )}
                        {(canEdit || !isOwnReview) && (
                          <div className="mt-2 flex items-center gap-3">
                            {canEdit && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary" asChild>
                                <Link href={`/dashboard/user/review/${review.job!.id}?editReviewId=${review.id}`}>
                                  <Pencil className="mr-1 h-3 w-3" />
                                  Edit ({hoursLeft}h left)
                                </Link>
                              </Button>
                            )}
                            {!isOwnReview && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => setFlagTarget(review)}
                              >
                                <Flag className="mr-1 h-3 w-3" />
                                Report
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </CardContent>
              {reviewsTotalPages > 1 && (
                <div className="border-t border-border p-3">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => { e.preventDefault(); if (id && reviewsPage > 1) loadReviewsPage(id, reviewsPage - 1) }}
                          className={reviewsPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {Array.from({ length: reviewsTotalPages }, (_, i) => i + 1).map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === reviewsPage}
                            onClick={(e) => { e.preventDefault(); if (id) loadReviewsPage(id, p) }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => { e.preventDefault(); if (id && reviewsPage < reviewsTotalPages) loadReviewsPage(id, reviewsPage + 1) }}
                          className={reviewsPage === reviewsTotalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ReviewReasonDialog
        open={!!flagTarget}
        onOpenChange={(o) => !o && setFlagTarget(null)}
        title="Report Review"
        subtitle={flagTarget ? `By ${flagTarget.reviewerUser ? `${flagTarget.reviewerUser.firstname} ${flagTarget.reviewerUser.lastname}`.trim() : flagTarget.reviewerName}` : undefined}
        reasonLabel="Why are you reporting this review?"
        reasonPlaceholder="Describe why this review looks fake, abusive, or off-topic…"
        minLength={10}
        maxLength={500}
        confirmLabel="Submit Report"
        helperText="This hides the review from public view while our team investigates. Your reason is recorded for the moderation team."
        onConfirm={handleFlagSubmitted}
      />

      {/* P4: "Book Now" stays anchored at every scroll position, on mobile
          and desktop, offset past the sidebar on large screens so it never
          covers navigation. `pb-24` above keeps page content clear of it. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur supports-backdrop-blur:bg-background/80 lg:left-56">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{formatCurrency(artisan.hourlyRate ?? 0)}/hr · {specialization}</p>
          </div>
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" asChild>
            <Link href={`/dashboard/user/book/${artisan.id}`}>Book Now</Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
