"use client"

/**
 * Profile → Reviews: every review clients left, with a star filter and a
 * one-time public reply (was `/dashboard/artisan/reviews`, which now
 * redirects here).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { VerifiedBookingBadge } from "@/components/reviews/verified-booking-badge"
import { ReviewPhotoThumbnails } from "@/components/reviews/review-photo-thumbnails"
import { AlertCircle, Loader2, MessageSquare, Star, UserRound } from "lucide-react"
import { cn, resolveAvatarUrl } from "@/lib/utils"
import { formatDate } from "@/lib/spending"
import { apiFetch, apiFetchWithMeta } from "@/lib/api"
import { toast } from "sonner"
import type { ApiReview } from "@/lib/types"

const REPLY_MAX_LENGTH = 300

// RV2: reviews are paginated server-side (default limit 10, max 50) — always
// send `page`/`limit` explicitly and load further pages via "Load more," or
// reviews 11+ are silently unreachable (and un-repliable, breaking AR1).
const REVIEWS_PAGE_SIZE = 10

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-ring"

type StarBucket = 1 | 2 | 3 | 4 | 5
type Filter = "all" | "awaiting" | StarBucket

interface BackendArtisanProfile {
  id: string
  averageRating: number
  totalReviews: number
}

/** H12: counts for the whole review history, never just the loaded page. */
interface ReviewSummary {
  averageRating: number
  totalReviews: number
  byRating: Record<StarBucket, number>
  /** Written reviews without a reply. Rating-only reviews are not counted. */
  awaitingReply: number
  /** Share of all reviews rated 4 or 5, 0–100. */
  highRatedPercent: number
}

const toNumber = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isFinite(n) ? n : null
}

/**
 * H12/B7: reads `GET /reviews/me/summary`. The field names are read loosely
 * (the endpoint is new) and anything that doesn't carry per-star counts is
 * treated as "no server summary", so the page falls back instead of showing
 * made-up numbers.
 */
function normaliseSummary(raw: unknown): ReviewSummary | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const dist = r.byRating ?? r.countsByRating ?? r.ratingCounts ?? r.distribution ?? r.byStar ?? r.counts
  const byRating: Record<StarBucket, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let found = false
  if (Array.isArray(dist)) {
    for (const row of dist as Record<string, unknown>[]) {
      const star = toNumber(row?.rating ?? row?.stars ?? row?.star)
      const count = toNumber(row?.count ?? row?.total)
      if (star && star >= 1 && star <= 5 && count !== null) {
        byRating[Math.round(star) as StarBucket] = count
        found = true
      }
    }
  } else if (dist && typeof dist === "object") {
    for (const k of [1, 2, 3, 4, 5] as StarBucket[]) {
      const d = dist as Record<string, unknown>
      const count = toNumber(d[k] ?? d[String(k)])
      if (count !== null) {
        byRating[k] = count
        found = true
      }
    }
  }
  if (!found) return null

  const summed = byRating[1] + byRating[2] + byRating[3] + byRating[4] + byRating[5]
  const total = toNumber(r.totalReviews ?? r.total) ?? summed
  const awaiting = toNumber(r.awaitingReply ?? r.awaitingReplyCount ?? r.unanswered ?? r.unansweredCount)
  // A percent (0–100) is used as is; a share (0–1) is scaled up.
  const percent = toNumber(
    r.fourStarAndAbovePercent ?? r.highRatedPercent ?? r.fourPlusPercent ?? r.fourStarsAndAbovePercent,
  )
  const fraction = toNumber(r.fourStarAndAboveShare ?? r.fourPlusShare ?? r.highRatedShare)
  const share =
    percent ?? (fraction !== null ? fraction * 100 : summed > 0 ? ((byRating[4] + byRating[5]) / summed) * 100 : 0)
  if (awaiting === null) return null
  return {
    averageRating: toNumber(r.averageRating ?? r.average) ?? 0,
    totalReviews: total,
    byRating,
    awaitingReply: awaiting,
    highRatedPercent: Math.round(share),
  }
}

function extractTotalPages(meta: Record<string, unknown> | undefined): number {
  const direct = meta?.totalPages as number | undefined
  const nested = (meta?.pagination as { totalPages?: number } | undefined)?.totalPages
  const value = direct ?? nested ?? 1
  return value > 0 ? value : 1
}

function fetchArtisanReviews(artisanProfileId: string, page: number): Promise<{ reviews: ApiReview[]; totalPages: number }> {
  return apiFetchWithMeta<ApiReview[] | { items: ApiReview[] }>(
    `/reviews/artisan-profile/${artisanProfileId}?page=${page}&limit=${REVIEWS_PAGE_SIZE}`,
  ).then(({ data, meta }) => ({
    reviews: Array.isArray(data) ? data : (data as { items: ApiReview[] })?.items ?? [],
    totalPages: extractTotalPages(meta),
  }))
}

const isAwaitingReply = (r: ApiReview) => !r.artisanReply && (r.review ?? "").trim().length > 0
// B7: star = floor(rating), so a 4.5 counts as 4 — same as the server summary.
const bucketOf = (r: ApiReview) => Math.floor(Number(r.rating)) as StarBucket

/** A star row with a text alternative (stars are decoration for the sighted label). */
function StarRow({ rating, className }: Readonly<{ rating: number; className?: string }>) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
  return (
    <span role="img" aria-label={`Rated ${rounded} out of 5`} className={cn("inline-flex gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("h-4 w-4", i < rounded ? "fill-rating text-rating" : "text-muted-foreground/30")}
        />
      ))}
    </span>
  )
}

export function ReviewsTab() {
  const [profileStats, setProfileStats] = useState<{ averageRating: number; totalReviews: number } | null>(null)
  const [serverSummary, setServerSummary] = useState<ReviewSummary | null>(null)
  const [artisanProfileId, setArtisanProfileId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ApiReview[]>([])
  const [reviewsPage, setReviewsPage] = useState(1)
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")

  const [replyingId, setReplyingId] = useState<number | null>(null)
  const [replyText, setReplyText] = useState("")
  const [isPostingReply, setIsPostingReply] = useState(false)

  const loadSummary = useCallback(() => {
    // Optional: when the endpoint isn't there yet (or answers in a shape we
    // can't read) the page falls back to counts it can prove — see `summary`.
    apiFetch<unknown>("/reviews/me/summary")
      .then((raw) => setServerSummary(normaliseSummary(raw)))
      .catch(() => setServerSummary(null))
  }, [])

  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError(false)
    loadSummary()
    apiFetch<BackendArtisanProfile>("/users/me/artisan-profile")
      .then((profile) => {
        setProfileStats({
          averageRating: Number(profile.averageRating ?? 0),
          totalReviews: Number(profile.totalReviews ?? 0),
        })
        setArtisanProfileId(profile.id)
        return fetchArtisanReviews(profile.id, 1)
      })
      .then(({ reviews: items, totalPages }) => {
        setReviews(items)
        setReviewsPage(1)
        setReviewsTotalPages(totalPages)
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false))
  }, [loadSummary])

  useEffect(() => { load() }, [load])

  // RV2: appends rather than replaces, so the star filter works on everything
  // loaded so far.
  const loadMore = () => {
    if (!artisanProfileId || isLoadingMore || reviewsPage >= reviewsTotalPages) return
    setIsLoadingMore(true)
    fetchArtisanReviews(artisanProfileId, reviewsPage + 1)
      .then(({ reviews: items, totalPages }) => {
        setReviews((prev) => [...prev, ...items])
        setReviewsPage((p) => p + 1)
        setReviewsTotalPages(totalPages)
      })
      .catch(() => toast.error("Couldn't load more reviews. Try again."))
      .finally(() => setIsLoadingMore(false))
  }

  const allLoaded = reviewsPage >= reviewsTotalPages

  /**
   * H12: the server summary when there is one. Without it, counts are only
   * shown once every review is loaded (then they're exact); before that the
   * chips show no numbers rather than numbers for page one.
   */
  const summary: ReviewSummary | null = useMemo(() => {
    if (serverSummary) return serverSummary
    if (!allLoaded) return null
    const byRating: Record<StarBucket, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const r of reviews) {
      const b = bucketOf(r)
      if (b >= 1 && b <= 5) byRating[b] += 1
    }
    const total = reviews.length
    return {
      averageRating: profileStats?.averageRating ?? 0,
      totalReviews: profileStats?.totalReviews ?? total,
      byRating,
      awaitingReply: reviews.filter(isAwaitingReply).length,
      highRatedPercent: total === 0 ? 0 : Math.round(((byRating[4] + byRating[5]) / total) * 100),
    }
  }, [serverSummary, allLoaded, reviews, profileStats])

  const averageRating = serverSummary?.averageRating ?? profileStats?.averageRating ?? 0
  const totalReviews = serverSummary?.totalReviews ?? profileStats?.totalReviews ?? reviews.length

  const filtered = reviews.filter((r) =>
    filter === "all" ? true : filter === "awaiting" ? isAwaitingReply(r) : bucketOf(r) === filter,
  )
  const filterTotal: number | null =
    filter === "all"
      ? totalReviews
      : !summary
        ? null
        : filter === "awaiting"
          ? summary.awaitingReply
          : summary.byRating[filter]

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
      const wasAwaiting = isAwaitingReply(review)
      setReviews((prev) => prev.map((r) => (r.id === review.id ? updated : r)))
      if (wasAwaiting) {
        setServerSummary((s) => (s ? { ...s, awaitingReply: Math.max(0, s.awaitingReply - 1) } : s))
      }
      setReplyingId(null)
      setReplyText("")
      toast.success("Reply posted.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post your reply. Try again.")
    } finally {
      setIsPostingReply(false)
    }
  }

  const chips: { key: Filter; label: string; ariaLabel: string; count: number | null }[] = [
    { key: "all", label: "All", ariaLabel: "All reviews", count: totalReviews },
    ...([5, 4, 3, 2, 1] as StarBucket[]).map((n) => ({
      key: n as Filter,
      label: `${n}★`,
      ariaLabel: `${n} star${n === 1 ? "" : "s"}`,
      count: summary ? summary.byRating[n] : null,
    })),
    { key: "awaiting", label: "Awaiting reply", ariaLabel: "Awaiting your reply", count: summary?.awaitingReply ?? null },
  ]

  return (
    <>
      <div className="space-y-6">
        <p className="max-w-[60ch] text-sm text-muted-foreground sm:text-base">
          What clients say about your work. You can reply to each review once, and everyone can see your reply.
        </p>

        {isLoading ? (
          <div aria-hidden className="space-y-4">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <div className="overflow-hidden rounded-xl border bg-card">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-3 border-b px-4 py-4 last:border-b-0 sm:px-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : loadError ? (
          <section
            aria-labelledby="reviews-error-title"
            className="flex flex-col items-start gap-3 rounded-xl border bg-card px-5 py-6 sm:px-6"
          >
            <AlertCircle aria-hidden className="h-6 w-6 text-destructive" />
            <div>
              <h2 id="reviews-error-title" className="font-semibold text-foreground">
                Couldn&apos;t load your reviews
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
            </div>
            <Button variant="outline" className={cn(FOCUS_RING, "h-11 bg-transparent sm:h-9")} onClick={load}>
              Try again
            </Button>
          </section>
        ) : reviews.length === 0 ? (
          <section
            aria-labelledby="reviews-empty-title"
            className="flex flex-col items-start gap-3 rounded-xl border border-dashed px-5 py-8 sm:px-8"
          >
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Star className="h-6 w-6" />
            </span>
            <h2 id="reviews-empty-title" className="text-lg font-semibold text-foreground">No reviews yet</h2>
            <p className="max-w-[56ch] text-sm text-muted-foreground sm:text-base">
              When a client confirms a job is done, they can rate your work. Their reviews will show here.
            </p>
          </section>
        ) : (
          <>
            <RatingBand averageRating={averageRating} totalReviews={totalReviews} summary={summary} />

            <div role="group" aria-label="Show reviews" className="flex flex-wrap gap-2">
              {chips.map((c) => {
                const on = filter === c.key
                return (
                  <button
                    key={String(c.key)}
                    type="button"
                    aria-pressed={on}
                    aria-label={c.count === null ? c.ariaLabel : `${c.ariaLabel}, ${c.count}`}
                    onClick={() => setFilter(c.key)}
                    className={cn(
                      FOCUS_RING,
                      "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm sm:h-9",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    <span aria-hidden>{c.label}</span>
                    {c.count !== null && (
                      <span aria-hidden className={cn("tabular-nums", on ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {c.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <section aria-label="Review list" className="overflow-hidden rounded-xl border bg-card">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-start gap-2 px-4 py-6 sm:px-5">
                  <p className="font-medium text-foreground">
                    {filter === "awaiting" ? "You've replied to every written review" : "No reviews with this rating"}
                    {!allLoaded && " so far"}
                  </p>
                  {!allLoaded && (
                    <p className="text-sm text-muted-foreground">Load more reviews to look further back.</p>
                  )}
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((review) => (
                    <ReviewRow
                      key={review.id}
                      review={review}
                      replying={replyingId === review.id}
                      replyText={replyText}
                      isPostingReply={isPostingReply}
                      onStartReply={() => startReply(review)}
                      onChangeReply={setReplyText}
                      onCancelReply={() => { setReplyingId(null); setReplyText("") }}
                      onSubmitReply={() => submitReply(review)}
                    />
                  ))}
                </ul>
              )}

              {!allLoaded && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {filterTotal !== null ? `Showing ${filtered.length} of ${filterTotal}` : `Showing ${filtered.length}`}
                  </p>
                  <Button
                    variant="outline"
                    className={cn(FOCUS_RING, "h-11 bg-transparent sm:h-9")}
                    disabled={isLoadingMore}
                    onClick={loadMore}
                  >
                    {isLoadingMore && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                    Load more reviews
                  </Button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}

/** Statement-band summary, in the language of the client Spending page. */
function RatingBand({
  averageRating,
  totalReviews,
  summary,
}: Readonly<{ averageRating: number; totalReviews: number; summary: ReviewSummary | null }>) {
  const avg = Math.max(0, Math.min(5, Number(averageRating) || 0))
  const cells = summary
    ? [
        {
          label: "Awaiting your reply",
          value: summary.awaitingReply.toLocaleString("en-GB"),
          note: "Written reviews you haven't answered",
        },
        {
          label: "4 stars and above",
          value: `${summary.highRatedPercent}%`,
          note: "Share of all your reviews",
        },
      ]
    : []
  return (
    <section aria-label="Rating summary" className="overflow-hidden rounded-2xl bg-brand text-brand-foreground">
      <div className={cn("grid", cells.length > 0 && "md:grid-cols-[1.5fr_1fr_1fr]")}>
        <div className="min-w-0 px-5 py-5 md:px-8 md:py-7">
          <p className="text-sm text-brand-foreground/80">Average rating</p>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="tnum text-[44px] font-semibold leading-none tracking-[-0.035em] tabular-nums md:text-5xl">
              {avg.toFixed(1)}
            </span>
            <span className="text-sm text-brand-foreground/75">out of 5</span>
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-foreground/85">
            <span aria-hidden className="inline-flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => {
                const fill = Math.max(0, Math.min(1, avg - i)) * 100
                return (
                  <span key={i} className="relative inline-flex">
                    <Star className="h-4 w-4 text-brand-foreground/30" />
                    {fill > 0 && (
                      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill}%` }}>
                        <Star className="h-4 w-4 fill-rating text-rating" />
                      </span>
                    )}
                  </span>
                )
              })}
            </span>
            <span>
              From {totalReviews.toLocaleString("en-GB")} review{totalReviews === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={cn(
              "min-w-0 border-t border-white/12 px-5 py-3.5 md:border-t-0 md:border-l md:px-7 md:py-7",
              "max-md:flex max-md:items-start max-md:justify-between max-md:gap-4",
              i === 0 && "md:border-l",
            )}
          >
            <div className="min-w-0">
              <p className="text-sm text-brand-foreground/80">{cell.label}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-brand-foreground/70 md:hidden">{cell.note}</p>
            </div>
            <div className="shrink-0">
              <p className="tnum whitespace-nowrap text-base font-semibold tabular-nums md:mt-3 md:text-[26px]">{cell.value}</p>
              <p className="mt-1.5 hidden text-[13px] leading-snug text-brand-foreground/70 md:block">{cell.note}</p>
            </div>
          </div>
        ))}
      </div>
      {!summary && (
        <p className={cn("border-t border-white/12 px-5 py-3 text-sm text-brand-foreground/80 md:px-8")}>
          Load all your reviews to see the counts for each rating.
        </p>
      )}
    </section>
  )
}

function ReviewRow({
  review,
  replying,
  replyText,
  isPostingReply,
  onStartReply,
  onChangeReply,
  onCancelReply,
  onSubmitReply,
}: Readonly<{
  review: ApiReview
  replying: boolean
  replyText: string
  isPostingReply: boolean
  onStartReply: () => void
  onChangeReply: (v: string) => void
  onCancelReply: () => void
  onSubmitReply: () => void
}>) {
  const reviewerName = review.reviewerUser
    ? `${review.reviewerUser.firstname} ${review.reviewerUser.lastname}`.trim()
    : review.reviewerName
  const avatar = review.reviewerUser?.profilePicture
  const replyId = `reply-${review.id}`

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={resolveAvatarUrl(avatar)} alt="" />
          <AvatarFallback><UserRound aria-hidden className="h-4 w-4" /></AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="font-medium text-foreground">{reviewerName}</p>
            <StarRow rating={review.rating} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{formatDate(review.createdAt)}</span>
            {review.editedAt && <span>(edited)</span>}
            {review.verifiedBooking && <VerifiedBookingBadge />}
          </p>

          {review.review ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground sm:text-[15px]">{review.review}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Rating only, no written review.</p>
          )}

          <ReviewPhotoThumbnails photos={review.photos} />

          {review.artisanReply ? (
            <div className="mt-3 rounded-r-lg border-l-2 border-primary bg-primary/5 py-2 pl-3 pr-2">
              <p className="text-sm font-medium text-foreground">
                Your reply
                {review.artisanRepliedAt && (
                  <span className="font-normal text-muted-foreground">, {formatDate(review.artisanRepliedAt)}</span>
                )}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{review.artisanReply}</p>
            </div>
          ) : replying ? (
            <div className="mt-3 space-y-2">
              <label htmlFor={replyId} className="text-sm font-medium text-foreground">
                Your reply
              </label>
              <Textarea
                id={replyId}
                autoFocus
                aria-describedby={`${replyId}-hint`}
                placeholder="Thank the client or answer their point. Keep it polite."
                value={replyText}
                onChange={(e) => onChangeReply(e.target.value.slice(0, REPLY_MAX_LENGTH))}
                maxLength={REPLY_MAX_LENGTH}
                rows={3}
                disabled={isPostingReply}
              />
              <p id={`${replyId}-hint`} className="text-sm text-muted-foreground">
                Everyone can see your reply and you can&apos;t change it later.{" "}
                <span className="tabular-nums">{replyText.length}/{REPLY_MAX_LENGTH}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className={cn(FOCUS_RING, "h-11 sm:h-9")}
                  disabled={replyText.trim().length === 0 || isPostingReply}
                  onClick={onSubmitReply}
                >
                  {isPostingReply && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                  Post reply
                </Button>
                <Button
                  variant="outline"
                  className={cn(FOCUS_RING, "h-11 bg-transparent sm:h-9")}
                  disabled={isPostingReply}
                  onClick={onCancelReply}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {(!review.artisanReply && !replying) || review.job?.id ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
              {!review.artisanReply && !replying && (
                <Button
                  variant="outline"
                  className={cn(FOCUS_RING, "h-11 gap-1.5 bg-transparent sm:h-9")}
                  onClick={onStartReply}
                  aria-label={`Reply to ${reviewerName}`}
                >
                  <MessageSquare aria-hidden className="h-4 w-4" />
                  Reply
                </Button>
              )}
              {review.job?.id && (
                <Link
                  href={`/dashboard/artisan/jobs/${review.job.id}`}
                  className={cn(
                    FOCUS_RING,
                    "inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:underline sm:min-h-9",
                  )}
                >
                  View job
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}
