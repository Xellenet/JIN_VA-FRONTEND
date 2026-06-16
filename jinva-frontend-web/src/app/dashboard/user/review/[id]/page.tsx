"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Star, CheckCircle2, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

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

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [job, setJob] = useState<BackendJob | null>(null)
  const [isLoadingJob, setIsLoadingJob] = useState(true)
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    apiFetch<BackendJob>(`/jobs/${id}`)
      .then(setJob)
      .catch(() => toast.error("Failed to load booking details."))
      .finally(() => setIsLoadingJob(false))
  }, [id])

  const handleSubmit = async () => {
    if (rating === 0 || !comment.trim() || !job?.acceptedArtisan) return
    setIsSubmitting(true)
    try {
      await apiFetch("/reviews", {
        method: "POST",
        body: JSON.stringify({
          rating,
          review: comment,
          reviewedUserId: job.acceptedArtisan.id,
          ...(job.acceptedArtisan.artisanProfile?.id
            ? { artisanProfileId: job.acceptedArtisan.artisanProfile.id }
            : {}),
        }),
      })
      setSubmitted(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit review.")
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

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-foreground">Review Submitted</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Thank you for your feedback! Your review helps other customers make informed decisions.
              </p>
              <div className="mt-4 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <Button
                className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => router.push("/dashboard/user/bookings")}
              >
                Back to Bookings
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
          <Link href={`/dashboard/user/bookings/${id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Booking Details
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Leave a Review</h1>
          <p className="text-muted-foreground">Share your experience with {artisanName}</p>
        </div>

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
                          onClick={() => setRating(starValue)}
                          onMouseEnter={() => setHoveredRating(starValue)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            className={`h-10 w-10 transition-colors ${
                              starValue <= (hoveredRating || rating)
                                ? "fill-yellow-400 text-yellow-400"
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
                  />
                  <p className="text-xs text-muted-foreground">{comment.length}/500 characters</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSubmit}
                disabled={rating === 0 || !comment.trim() || isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Review
              </Button>
              <Button variant="outline" className="bg-transparent" asChild>
                <Link href={`/dashboard/user/bookings/${id}`}>Cancel</Link>
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
                      <AvatarImage src={job.acceptedArtisan.profilePicture || "/placeholder.svg"} />
                      <AvatarFallback>{artisanName.substring(0, 2)}</AvatarFallback>
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
                      <span className="font-medium text-foreground">#{job.id.substring(0, 8)}</span>
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
