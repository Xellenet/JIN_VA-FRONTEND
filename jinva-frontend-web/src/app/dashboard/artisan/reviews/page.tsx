"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { RatingStars } from "@/components/ui/rating-stars"
import { VerifiedBookingBadge } from "@/components/reviews/verified-booking-badge"
import { ReviewPhotoThumbnails } from "@/components/reviews/review-photo-thumbnails"
import { AlertTriangle, ExternalLink, Loader2, MessageSquare, Star, UserRound } from "lucide-react"
import { naviiAvatar, cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import type { ApiReview } from "@/lib/types"

const REPLY_MAX_LENGTH = 300

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

interface BackendArtisanProfile {
  id: string
  averageRating: number
  totalReviews: number
}

function fetchArtisanReviews(artisanProfileId: string): Promise<ApiReview[]> {
  return apiFetch<ApiReview[] | { items: ApiReview[] }>(`/reviews/artisan-profile/${artisanProfileId}`).then((r) =>
    Array.isArray(r) ? r : (r as { items: ApiReview[] }).items ?? [],
  )
}

function ReviewCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </CardContent>
    </Card>
  )
}

export default function ArtisanMyReviewsPage() {
  const [summary, setSummary] = useState<{ averageRating: number; totalReviews: number } | null>(null)
  const [reviews, setReviews] = useState<ApiReview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)

  const [replyingId, setReplyingId] = useState<number | null>(null)
  const [replyText, setReplyText] = useState("")
  const [isPostingReply, setIsPostingReply] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError(false)
    apiFetch<BackendArtisanProfile>("/users/me/artisan-profile")
      .then((profile) => {
        setSummary({
          averageRating: Number(profile.averageRating ?? 0),
          totalReviews: Number(profile.totalReviews ?? 0),
        })
        return fetchArtisanReviews(profile.id)
      })
      .then(setReviews)
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const r of reviews) {
      const bucket = Math.round(Number(r.rating))
      if (bucket >= 1 && bucket <= 5) c[bucket] += 1
    }
    return c
  }, [reviews])

  const awaitingReplyCount = useMemo(() => reviews.filter((r) => !r.artisanReply).length, [reviews])
  const highRatedPercent = useMemo(() => {
    if (reviews.length === 0) return 0
    return Math.round((reviews.filter((r) => Number(r.rating) >= 4).length / reviews.length) * 100)
  }, [reviews])

  const filtered = ratingFilter ? reviews.filter((r) => Math.round(Number(r.rating)) === ratingFilter) : reviews

  const startReply = (review: ApiReview) => {
    setReplyingId(review.id)
    setReplyText("")
  }

  const submitReply = async (review: ApiReview) => {
    const trimmed = replyText.trim()
    if (trimmed.length === 0 || isPostingReply) return
    setIsPostingReply(true)
    try {
      const updated = await apiFetch<ApiReview>(`/reviews/${review.id}/replies`, {
        method: "POST",
        body: JSON.stringify({ reply: trimmed }),
      })
      setReviews((prev) => prev.map((r) => (r.id === review.id ? updated : r)))
      setReplyingId(null)
      setReplyText("")
      toast.success("Reply posted.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post reply.")
    } finally {
      setIsPostingReply(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">New screen</p>
          <h1 className="mt-0.5 text-2xl font-bold text-foreground">My Reviews</h1>
          <p className="text-sm text-muted-foreground">
            What customers are saying about your work — and your chance to respond, once, publicly.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            {Array.from({ length: 3 }).map((_, i) => <ReviewCardSkeleton key={i} />)}
          </div>
        ) : loadError ? (
          <Card>
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon"><AlertTriangle className="text-muted-foreground" /></EmptyMedia>
                <EmptyTitle>Couldn&apos;t load your reviews</EmptyTitle>
                <EmptyDescription>Something went wrong on our end.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" className="bg-transparent" onClick={load}>Retry</Button>
              </EmptyContent>
            </Empty>
          </Card>
        ) : reviews.length === 0 ? (
          <Card>
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Star className="text-muted-foreground" /></EmptyMedia>
                <EmptyTitle>No reviews yet</EmptyTitle>
                <EmptyDescription>
                  Reviews appear here once a customer marks a job complete and rates your work.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-6 p-5">
                <RatingStars rating={summary?.averageRating ?? 0} totalReviews={summary?.totalReviews} size="lg" showCount={false} />
                <div className="flex flex-1 flex-wrap items-center justify-end gap-6 text-center">
                  <div>
                    <p className="text-xl font-bold text-foreground">{summary?.totalReviews ?? reviews.length}</p>
                    <p className="text-xs text-muted-foreground">Total reviews</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{awaitingReplyCount}</p>
                    <p className="text-xs text-muted-foreground">Awaiting your reply</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{highRatedPercent}%</p>
                    <p className="text-xs text-muted-foreground">4★ &amp; above</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Badge
                asChild
                variant="outline"
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-xs",
                  ratingFilter === null && "border-primary bg-primary text-primary-foreground",
                )}
              >
                <button type="button" onClick={() => setRatingFilter(null)}>
                  All ({reviews.length})
                </button>
              </Badge>
              {[5, 4, 3, 2, 1].map((n) => (
                <Badge
                  key={n}
                  asChild
                  variant="outline"
                  className={cn(
                    "cursor-pointer gap-1 rounded-full px-3 py-1.5 text-xs",
                    ratingFilter === n && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  <button type="button" onClick={() => setRatingFilter(n)}>
                    <Star className={cn("h-2.5 w-2.5", ratingFilter === n ? "fill-primary-foreground text-primary-foreground" : "fill-yellow-400 text-yellow-400")} />
                    {n} ({counts[n]})
                  </button>
                </Badge>
              ))}
            </div>

            {filtered.length === 0 ? (
              <Card>
                <Empty className="border-0 py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Star className="text-muted-foreground" /></EmptyMedia>
                    <EmptyTitle>No reviews at this rating</EmptyTitle>
                    <EmptyDescription>Try a different filter.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </Card>
            ) : (
              <div className="space-y-3.5">
                {filtered.map((review) => {
                  const reviewerName = review.reviewerUser
                    ? `${review.reviewerUser.firstname} ${review.reviewerUser.lastname}`.trim()
                    : review.reviewerName
                  const avatar = review.reviewerUser?.profilePicture

                  return (
                    <Card key={review.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={avatar || naviiAvatar(reviewerName)} />
                              <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">{reviewerName}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {review.verifiedBooking && <VerifiedBookingBadge />}
                                <span>{formatDate(review.createdAt)}</span>
                                {review.editedAt && <Badge variant="outline" className="text-muted-foreground">Edited</Badge>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={`${review.id}-star-${i}`}
                                className={cn("h-3.5 w-3.5", i < Math.round(Number(review.rating)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")}
                              />
                            ))}
                          </div>
                        </div>

                        {review.review ? (
                          <p className="mt-3 text-sm leading-relaxed text-foreground">{review.review}</p>
                        ) : (
                          <p className="mt-3 text-sm italic text-muted-foreground">No written feedback — rating only.</p>
                        )}

                        <ReviewPhotoThumbnails photos={review.photos} />

                        {review.job?.id && (
                          <Link
                            href={`/dashboard/artisan/jobs/${review.job.id}`}
                            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Job
                          </Link>
                        )}

                        {review.artisanReply ? (
                          <div className="mt-3 rounded-r-lg border-l-2 border-primary bg-primary/5 py-2 pl-3 pr-2">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                              <MessageSquare className="h-3 w-3" />
                              Your response
                              {review.artisanRepliedAt && (
                                <span className="font-normal text-muted-foreground">· {formatDate(review.artisanRepliedAt)}</span>
                              )}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-foreground">{review.artisanReply}</p>
                          </div>
                        ) : replyingId === review.id ? (
                          <div className="mt-3 space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                            <Textarea
                              autoFocus
                              placeholder="Respond publicly and professionally — once posted, this reply is permanent and visible to everyone."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value.slice(0, REPLY_MAX_LENGTH))}
                              maxLength={REPLY_MAX_LENGTH}
                              rows={3}
                              disabled={isPostingReply}
                            />
                            <p className="text-xs text-muted-foreground">{replyText.length}/{REPLY_MAX_LENGTH} characters</p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                                disabled={replyText.trim().length === 0 || isPostingReply}
                                onClick={() => submitReply(review)}
                              >
                                {isPostingReply && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                Post Reply
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-transparent"
                                disabled={isPostingReply}
                                onClick={() => { setReplyingId(null); setReplyText("") }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <Button variant="outline" size="sm" className="h-7 gap-1.5 bg-transparent text-xs" onClick={() => startReply(review)}>
                              <MessageSquare className="h-3.5 w-3.5" />
                              Reply
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
