"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
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
  ArrowLeft,
  MessageSquare,
  UserRound,
  Loader2,
  ShieldCheck,
  Heart,
  Flag,
  Pencil,
} from "lucide-react"
import { cn, formatCurrency, resolveAvatarUrl } from "@/lib/utils"
import { formatDay } from "@/lib/artisan-jobs"
import { ApiError, apiFetch, apiFetchWithMeta } from "@/lib/api"
import { useFavouriteIds } from "@/hooks/use-favourites"
import { useAuth } from "@/contexts/auth-context"
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery"
import { RatingStars } from "@/components/ui/rating-stars"
import { VerifiedBookingBadge } from "@/components/reviews/verified-booking-badge"
import { ReviewPhotoThumbnails } from "@/components/reviews/review-photo-thumbnails"
import { ReviewReasonDialog } from "@/components/reviews/review-reason-dialog"
import type { ApiPortfolioItem, ApiReview } from "@/lib/types"
import { toast } from "sonner"
import { notBookableReason, type AvailabilitySummary, type PublicTimeOff, type PublicWeeklyHours } from "@/lib/availability"
import { AvailabilityBadge, WorkingHoursSection } from "@/components/dashboard/availability-badge"

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
  /** Computed from the artisan's Calendar settings; absent on an older API. */
  availability?: AvailabilitySummary
  weeklyHours?: PublicWeeklyHours[]
  upcomingTimeOff?: PublicTimeOff[]
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

/** One figure in the hero's stat strip (the same strip as the artisan's own Profile). */
function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-0 px-2 py-3 text-center sm:px-4">
      <p className="text-lg font-semibold tabular-nums text-foreground sm:text-xl">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

/** Back link: a 44px target on phones, flush with the content edge. */
const BACK_CLASS = "-ml-3 h-11 gap-2 text-muted-foreground hover:text-foreground sm:h-9"

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
  // P1: an artisan reaches this page only through "Preview as a client" on
  // their own Profile (middleware lets that one route through). They see what
  // clients see, without the client actions — saving, messaging, booking and
  // reporting are a client's to take.
  const isPreview = user?.role === "artisan"
  const { favouriteIds, pendingId, toggleFavourite } = useFavouriteIds({ enabled: user?.role === "user" })

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
      .catch((err) =>
        setError(
          // QA SRCH-15: hidden artisans (suspended, banned, unfinished) answer 404.
          err instanceof ApiError && err.status === 404
            ? "This artisan isn't available right now."
            : "Couldn't load this profile. Refresh the page to try again.",
        ),
      )
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
    toast.success("Review reported. It's hidden while our team checks it.")
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
          <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" aria-label="Loading profile" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !artisan) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" asChild className={BACK_CLASS}>
            {user?.role === "artisan" ? (
              <Link href="/dashboard/artisan/profile"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to your profile</Link>
            ) : (
              <Link href="/dashboard/user/search"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to search</Link>
            )}
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <h1 className="text-lg font-semibold text-foreground">Profile unavailable</h1>
              <p className="mt-1 text-muted-foreground">{error || "Artisan not found."}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  const name = `${artisan.user.firstname} ${artisan.user.lastname}`.trim()
  const backLink = isPreview
    ? { href: "/dashboard/artisan/profile", label: "Back to your profile" }
    : { href: "/dashboard/user/search", label: "Back to search" }
  // Why Book is off (no hours, time off for 2 weeks, busy or unavailable), or null.
  const bookBlockedReason = notBookableReason(artisan.availability, artisan.availabilityStatus)
  const firstName = artisan.user.firstname?.trim() || name
  const specialization = artisan.businessName || artisan.services?.[0]?.name || "Artisan"
  const rating = Number(artisan.averageRating ?? 0)
  const totalReviews = Number(artisan.totalReviews ?? 0)
  const experienceYears = artisan.experienceYears != null && artisan.experienceYears > 0 ? artisan.experienceYears : null
  const hourlyRate = artisan.hourlyRate != null && Number(artisan.hourlyRate) > 0 ? artisan.hourlyRate : null

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-24">
        <Button variant="ghost" asChild className={BACK_CLASS}>
          <Link href={backLink.href}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLink.label}
          </Link>
        </Button>

        {isPreview && (
          <p className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm text-foreground">
            This is how clients see your profile. They also get Save, Message and Book buttons here.
          </p>
        )}

        {/* Profile hero: the same hero and stat strip as the artisan's own Profile. */}
        <Card className="gap-0 overflow-hidden py-0">
          <div className="h-24 bg-gradient-to-r from-primary to-primary/80 sm:h-32" />
          <CardContent className="relative px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-end md:gap-6">
              <div className="relative -mt-12 sm:-mt-16">
                <Avatar className="h-24 w-24 border-4 border-background shadow-lg sm:h-28 sm:w-28">
                  <AvatarImage src={resolveAvatarUrl(artisan.user.profilePicture)} alt="" />
                  <AvatarFallback><UserRound className="h-10 w-10" aria-hidden="true" /></AvatarFallback>
                </Avatar>
              </div>

              <div className="flex w-full min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 dir="auto" className="text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">{name}</h1>
                    {artisan.isVerified && (
                      <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Verified
                      </Badge>
                    )}
                    <AvailabilityBadge summary={artisan.availability} status={artisan.availabilityStatus} />
                  </div>
                  <p dir="auto" className="mt-1 text-muted-foreground [overflow-wrap:anywhere]">{specialization}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {artisan.location && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="[overflow-wrap:anywhere]">{artisan.location}</span>
                      </span>
                    )}
                    {experienceYears && (
                      <span>{experienceYears} {experienceYears === 1 ? "year" : "years"} of experience</span>
                    )}
                    {hourlyRate && (
                      <span className="tabular-nums">{formatCurrency(hourlyRate)} an hour</span>
                    )}
                  </div>
                  {bookBlockedReason && (
                    <p id="book-blocked-reason" className="mt-2 text-sm text-muted-foreground">
                      {bookBlockedReason}
                    </p>
                  )}
                </div>

                {!isPreview && (
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto md:shrink-0">
                  <Button
                    variant="outline"
                    className="h-11 bg-transparent sm:h-9"
                    disabled={pendingId === artisan.id}
                    aria-pressed={favouriteIds.has(artisan.id)}
                    onClick={() => toggleFavourite(artisan.id)}
                  >
                    {pendingId === artisan.id
                      ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      : <Heart aria-hidden="true" className={cn("h-4 w-4", favouriteIds.has(artisan.id) && "fill-destructive text-destructive")} />
                    }
                    {favouriteIds.has(artisan.id) ? "Saved" : "Save"}
                  </Button>
                  <Button variant="outline" asChild className="h-11 bg-transparent sm:h-9">
                    {/* The deep link takes the artisan's **user** id, not this
                        page's artisan-profile id — they are different sequences
                        and a profile id can collide with an unrelated user's id
                        (qa-report.md F4). */}
                    <Link href={`/dashboard/user/messages?artisan=${artisan.user.id}`}>
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      Message
                    </Link>
                  </Button>
                  {bookBlockedReason ? (
                    <Button className="col-span-2 h-11 sm:h-9" disabled aria-describedby="book-blocked-reason">
                      Book now
                    </Button>
                  ) : (
                    <Button className="col-span-2 h-11 sm:h-9" asChild>
                      <Link href={`/dashboard/user/book/${artisan.id}`}>Book now</Link>
                    </Button>
                  )}
                </div>
                )}
              </div>
            </div>

            {/* Stat strip: one compact row on every width. */}
            <div className="mt-5 grid grid-cols-3 divide-x rounded-lg border bg-muted/40">
              <Stat
                value={
                  totalReviews > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-4 w-4 fill-rating text-rating" aria-hidden="true" />
                      {rating.toFixed(1)}
                    </span>
                  ) : (
                    "–"
                  )
                }
                label={totalReviews > 0 ? "Average rating" : "No ratings yet"}
              />
              <Stat value={artisan.completedJobsCount ?? 0} label="Jobs completed" />
              <Stat value={totalReviews} label={totalReviews === 1 ? "Review" : "Reviews"} />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="about" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:inline-flex sm:w-fit sm:gap-0">
            <TabsTrigger value="about" className="min-h-11 sm:min-h-0">About</TabsTrigger>
            <TabsTrigger value="portfolio" className="min-h-11 sm:min-h-0">
              Portfolio
              <span className="tabular-nums text-muted-foreground">{portfolioLoading ? "" : ` (${portfolioItems.length})`}</span>
            </TabsTrigger>
            <TabsTrigger value="reviews" className="min-h-11 sm:min-h-0">
              Reviews
              <span className="tabular-nums text-muted-foreground"> ({Number(artisan.totalReviews ?? reviews.length)})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio">
            <PortfolioGallery items={portfolioItems} isLoading={portfolioLoading} error={portfolioError} />
          </TabsContent>

          <TabsContent value="about">
            <Card className="gap-0 py-0">
              <CardContent className="space-y-6 p-4 sm:p-6">
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-foreground">About {firstName}</h2>
                  {/* B4: never a bio the artisan didn't write. Bio is optional
                      (B1), so an empty one gets an honest line instead. */}
                  {artisan.bio?.trim() ? (
                    <p dir="auto" className="whitespace-pre-line leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{artisan.bio}</p>
                  ) : (
                    <p className="text-muted-foreground">
                      {artisan.user.firstname?.trim() || "This artisan"} hasn&apos;t added a bio yet.
                    </p>
                  )}
                </div>
                {artisan.services && artisan.services.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">Services and pricing</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {artisan.services.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                        >
                          <span className="min-w-0 text-sm font-medium text-foreground">{s.name}</span>
                          <span className={s.price != null ? "shrink-0 text-sm font-semibold tabular-nums text-foreground" : "shrink-0 text-xs text-muted-foreground"}>
                            {s.price != null ? formatCurrency(s.price) : "Price on request"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {artisan.weeklyHours && (
                  <WorkingHoursSection
                    hours={artisan.weeklyHours}
                    timeOff={artisan.upcomingTimeOff ?? []}
                    today={artisan.availability?.today}
                    firstName={firstName}
                  />
                )}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Cancellation policy</h3>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    {artisan.cancellationPolicy ? (
                      <p dir="auto" className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{artisan.cancellationPolicy}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No cancellation policy set yet. Agree cancellation terms with them in messages before you book.
                      </p>
                    )}
                  </div>
                </div>
                <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Specialisation</dt>
                    <dd dir="auto" className="mt-0.5 font-medium text-foreground [overflow-wrap:anywhere]">{specialization}</dd>
                  </div>
                  {experienceYears && (
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Experience</dt>
                      <dd className="mt-0.5 font-medium text-foreground">{experienceYears} {experienceYears === 1 ? "year" : "years"}</dd>
                    </div>
                  )}
                  {artisan.location && (
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Location</dt>
                      <dd className="mt-0.5 font-medium text-foreground [overflow-wrap:anywhere]">{artisan.location}</dd>
                    </div>
                  )}
                  {hourlyRate && (
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Hourly rate</dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-foreground">{formatCurrency(hourlyRate)}</dd>
                    </div>
                  )}
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">On JinVa since</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{formatDay(artisan.createdAt) || "–"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            <Card className="gap-0 py-0">
              <div className="border-b border-border px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-foreground">Client reviews</h2>
                  <RatingStars rating={rating} totalReviews={totalReviews} size="lg" />
                </div>
              </div>
              <CardContent className="divide-y divide-border p-0">
                {reviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Star className="mb-3 h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">No reviews yet. Reviews appear here after clients finish a job.</p>
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
                      <div key={review.id} className="px-4 py-5 sm:px-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarImage src={resolveAvatarUrl(avatar)} alt="" />
                              <AvatarFallback><UserRound className="h-4 w-4" aria-hidden="true" /></AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-medium text-foreground">{reviewerName}</p>
                                {review.verifiedBooking && <VerifiedBookingBadge />}
                                {isUnderReview && (
                                  <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">
                                    Under review
                                  </Badge>
                                )}
                                {review.editedAt && (
                                  <Badge variant="outline" className="text-muted-foreground">Edited</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                <time dateTime={review.createdAt}>{formatDay(review.createdAt)}</time>
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5" role="img" aria-label={`Rated ${Number(review.rating)} out of 5`}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={`${review.id}-star-${i}`}
                                aria-hidden="true"
                                className={`h-4 w-4 ${i < Number(review.rating) ? "fill-rating text-rating" : "text-muted-foreground/30"}`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.review && (
                          <p dir="auto" className="mt-3 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{review.review}</p>
                        )}
                        <ReviewPhotoThumbnails photos={review.photos} />
                        {review.artisanReply && (
                          <div className="mt-3 rounded-r-lg border-l-2 border-primary bg-primary/5 py-2 pl-3 pr-2">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                              <MessageSquare className="h-3 w-3" aria-hidden="true" />
                              Reply from {artisan.businessName || name}
                              {review.artisanRepliedAt && (
                                <span className="font-normal text-muted-foreground">
                                  , <time dateTime={review.artisanRepliedAt}>{formatDay(review.artisanRepliedAt)}</time>
                                </span>
                              )}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-foreground">{review.artisanReply}</p>
                          </div>
                        )}
                        {isUnderReview && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Our team is checking this review. Other people can&apos;t see it until they finish.
                          </p>
                        )}
                        {!isPreview && (canEdit || !isOwnReview) && (
                          <div className="mt-2 flex items-center gap-3">
                            {canEdit && (
                              <Button variant="ghost" size="sm" className="-ml-2 h-11 px-2 text-xs text-primary hover:text-primary sm:h-7" asChild>
                                <Link href={`/dashboard/user/review/${review.job!.id}?editReviewId=${review.id}`}>
                                  <Pencil className="h-3 w-3" aria-hidden="true" />
                                  Edit ({hoursLeft} {hoursLeft === 1 ? "hour" : "hours"} left)
                                </Link>
                              </Button>
                            )}
                            {!isOwnReview && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="-ml-2 h-11 px-2 text-xs text-muted-foreground hover:text-destructive sm:h-7"
                                onClick={() => setFlagTarget(review)}
                              >
                                <Flag className="h-3 w-3" aria-hidden="true" />
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
        title="Report review"
        subtitle={flagTarget ? `By ${flagTarget.reviewerUser ? `${flagTarget.reviewerUser.firstname} ${flagTarget.reviewerUser.lastname}`.trim() : flagTarget.reviewerName}` : undefined}
        reasonLabel="Why are you reporting this review?"
        reasonPlaceholder="Describe why this review looks fake, abusive, or off-topic…"
        minLength={10}
        maxLength={500}
        confirmLabel="Send report"
        helperText="This hides the review from public view while our team investigates. Your reason is recorded for the moderation team."
        onConfirm={handleFlagSubmitted}
      />

      {/* P4: "Book now" stays anchored at every scroll position, on mobile
          and desktop, offset past the sidebar on large screens so it never
          covers navigation. `pb-24` above keeps page content clear of it.
          Not shown in the artisan's own preview (P1). */}
      {!isPreview && (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur supports-backdrop-blur:bg-background/80 lg:left-56">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {specialization}
              {hourlyRate ? `, ${formatCurrency(hourlyRate)} an hour` : ""}
            </p>
          </div>
          {bookBlockedReason ? (
            <div className="flex w-full flex-col gap-1 sm:w-auto sm:items-end">
              <Button className="h-11 w-full sm:h-9 sm:w-auto" disabled aria-describedby="sticky-book-reason">
                Book now
              </Button>
              <p id="sticky-book-reason" className="text-center text-xs text-muted-foreground sm:text-right">
                {bookBlockedReason}
              </p>
            </div>
          ) : (
            <Button className="h-11 w-full sm:h-9 sm:w-auto" asChild>
              <Link href={`/dashboard/user/book/${artisan.id}`}>Book now</Link>
            </Button>
          )}
        </div>
      </div>
      )}
    </DashboardLayout>
  )
}
