"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Star, CheckCircle2, Loader2, UserRound, Clock, AlertTriangle } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { naviiAvatar } from "@/lib/utils"
import { toast } from "sonner"
import { ReviewPhotoPicker } from "@/components/reviews/review-photo-picker"
import { ReviewPhotoThumbnails } from "@/components/reviews/review-photo-thumbnails"
import { VerifiedBookingBadge } from "@/components/reviews/verified-booking-badge"
import type { ApiReview } from "@/lib/types"

// RE1 — matches `REVIEW_EDIT_WINDOW_HOURS` in api-contract.md §1.
const REVIEW_EDIT_WINDOW_HOURS = 48

interface BackendJob {
  id: string
  title: string
  createdAt: string
  service?: { name: string }
  acceptedArtisan?: {
    id: string
    firstname: string
    lastname: string
    profilePicture?: string
    artisanProfile?: { id: string; averageRating?: number; totalReviews?: number }
  }
}

const ratingLabels: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
}

function ReviewPageContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editReviewId = searchParams.get("editReviewId")
  const isEditMode = !!editReviewId

  const [job, setJob] = useState<BackendJob | null>(null)
  const [isLoadingJob, setIsLoadingJob] = useState(true)
  const [existingReview, setExistingReview] = useState<ApiReview | null>(null)
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState("")
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const tasks: Promise<unknown>[] = [apiFetch<BackendJob>(`/jobs/${id}`).then(setJob)]
    if (editReviewId) {
      tasks.push(
        apiFetch<ApiReview>(`/reviews/${editReviewId}`).then((review) => {
          setExistingReview(review)
          setRating(Math.round(Number(review.rating)))
          setComment(review.review ?? "")
        }),
      )
    }
    Promise.all(tasks)
      .catch(() => toast.error(editReviewId ? "Failed to load this review." : "Failed to load booking details."))
      .finally(() => setIsLoadingJob(false))
  }, [id, editReviewId])

  const hoursElapsed = existingReview ? (Date.now() - new Date(existingReview.createdAt).getTime()) / 3_600_000 : 0
  const hoursLeft = Math.max(0, Math.ceil(REVIEW_EDIT_WINDOW_HOURS - hoursElapsed))
  const editWindowExpired = isEditMode && !!existingReview && hoursLeft <= 0

  const handleSubmit = async () => {
    if (rating === 0 || !job) return
    if (comment.trim().length > 0 && comment.trim().length < 20) {
      toast.error("Review text must be at least 20 characters (or leave it blank).")
      return
    }
    if (editWindowExpired) {
      toast.error("The 48-hour edit window for this review has passed.")
      return
    }
    setIsSubmitting(true)
    try {
      if (isEditMode && existingReview) {
        await apiFetch(`/reviews/${existingReview.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            rating,
            ...(comment.trim().length >= 20 ? { review: comment.trim() } : {}),
          }),
        })
      } else {
        await apiFetch("/reviews", {
          method: "POST",
          body: JSON.stringify({
            jobId: Number(id),
            rating,
            ...(comment.trim().length >= 20 ? { review: comment.trim() } : {}),
            ...(photoUrls.length > 0 ? { photoUrls } : {}),
          }),
        })
      }
      setSubmitted(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${isEditMode ? "update" : "submit"} your review.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingJob) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  const artisanName = job?.acceptedArtisan
    ? `${job.acceptedArtisan.firstname} ${job.acceptedArtisan.lastname}`.trim()
    : "Artisan"

  const backToProfileHref = existingReview?.artisanProfile
    ? `/dashboard/user/artisan/${existingReview.artisanProfile.id}`
    : null

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-foreground">
                {isEditMode ? "Review Updated" : "Review Submitted"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {isEditMode
                  ? "Your changes have been saved."
                  : "Thank you for your feedback! Your review helps other customers make informed decisions."}
              </p>
              <div className="mt-4 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${i < rating ? "fill-rating text-rating" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <div className="mt-3">
                <VerifiedBookingBadge />
              </div>
              <Button
                className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => router.push(isEditMode && backToProfileHref ? backToProfileHref : "/dashboard/user/bookings")}
              >
                {isEditMode ? "Back to Profile" : "Back to Bookings"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href={isEditMode && backToProfileHref ? backToProfileHref : `/dashboard/user/bookings/${id}`}>
            <ArrowLeft className="h-4 w-4" />
            {isEditMode && backToProfileHref ? "Back to Artisan Profile" : "Back to Booking Details"}
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">{isEditMode ? "Edit Your Review" : "Leave a Review"}</h1>
          <p className="text-muted-foreground">
            {isEditMode ? `Update your review for ${artisanName}` : `Share your experience with ${artisanName}`}
          </p>
        </div>

        {isEditMode && existingReview && (
          editWindowExpired ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              The 48-hour edit window for this review has passed — it can no longer be edited.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              {hoursLeft}h left to edit this review.
            </div>
          )
        )}
        {isEditMode && existingReview?.status === "FLAGGED" && (
          <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
            This review is under moderation review and is temporarily hidden from other users. You can still edit
            it — editing won&apos;t clear the flag.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="font-semibold text-foreground">Your Rating</h3>
              </div>
              <CardContent className="p-5">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const starValue = i + 1
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={editWindowExpired}
                          onClick={() => setRating(starValue)}
                          onMouseEnter={() => setHoveredRating(starValue)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                          <Star
                            className={`h-10 w-10 transition-colors ${
                              starValue <= (hoveredRating || rating)
                                ? "fill-rating text-rating"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {hoveredRating
                      ? ratingLabels[hoveredRating]
                      : rating
                        ? ratingLabels[rating]
                        : "Select a rating"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <div className="border-b border-border p-5">
                <h3 className="font-semibold text-foreground">Review Details</h3>
              </div>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-2">
                  <Label htmlFor="review-comment">Your Review</Label>
                  <Textarea
                    id="review-comment"
                    placeholder="Tell others about your experience with this artisan. What did they do well? How was the quality of work?"
                    rows={6}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={500}
                    disabled={editWindowExpired}
                  />
                  <p className="text-xs text-muted-foreground">{comment.length}/500 characters</p>
                </div>

                {!isEditMode && (
                  <div className="space-y-2 pt-2">
                    <Label>Add Photos (optional)</Label>
                    <ReviewPhotoPicker value={photoUrls} onChange={setPhotoUrls} disabled={isSubmitting} />
                  </div>
                )}
                {isEditMode && existingReview && existingReview.photos.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <Label>Photos</Label>
                    <ReviewPhotoThumbnails photos={existingReview.photos} />
                    <p className="text-xs text-muted-foreground">Photos can&apos;t be changed after a review is submitted.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting || editWindowExpired}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isEditMode ? "Update Review" : "Submit Review"}
              </Button>
              <Button variant="outline" className="bg-transparent" asChild>
                <Link href={isEditMode && backToProfileHref ? backToProfileHref : `/dashboard/user/bookings/${id}`}>
                  Cancel
                </Link>
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {job?.acceptedArtisan && (
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="font-semibold text-foreground">Artisan</h3>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={job.acceptedArtisan.profilePicture || naviiAvatar(artisanName)} />
                      <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold text-foreground">{artisanName}</h4>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {job && (
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="font-semibold text-foreground">Booking Summary</h3>
                </div>
                <CardContent className="p-5">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium text-foreground">{job.service?.name ?? job.title}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Booking ID</span>
                      <span className="font-medium text-foreground">#{String(job.id).substring(0, 8)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium text-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewPageContent />
    </Suspense>
  )
}
