"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Wrench,
  Phone,
  Mail,
  MessageSquare,
  Star,
  FileText,
  Loader2,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

interface BackendJob {
  id: string
  title: string
  description?: string
  location?: string
  status: string
  createdAt: string
  customer?: { id: string; firstname: string; lastname: string; email?: string; phoneNumber?: string; profilePicture?: string }
  acceptedArtisan?: { id: string; firstname: string; lastname: string; email?: string; phoneNumber?: string; profilePicture?: string }
  service?: { id: string; name: string; price?: number }
}

const statusConfig: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: "In Progress", className: "border-muted bg-muted text-muted-foreground" },
  COMPLETED: { label: "Completed", className: "border-green-200 bg-green-50 text-green-700" },
  CANCELLED: { label: "Cancelled", className: "border-red-200 bg-red-50 text-red-700" },
  PENDING: { label: "Pending", className: "border-yellow-200 bg-yellow-50 text-yellow-700" },
  OPEN: { label: "Open", className: "border-blue-200 bg-blue-50 text-blue-700" },
  EXPIRED: { label: "Expired", className: "border-gray-200 bg-gray-50 text-gray-600" },
}

export default function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<BackendJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    apiFetch<BackendJob>(`/jobs/${id}`)
      .then(setJob)
      .catch(() => toast.error("Failed to load booking details."))
      .finally(() => setIsLoading(false))
  }, [id])

  const handleCancelBooking = async () => {
    if (!job) return
    setIsCancelling(true)
    try {
      await apiFetch(`/jobs/${job.id}/cancel`, { method: "PATCH" })
      setJob((prev) => prev ? { ...prev, status: "CANCELLED" } : prev)
      setShowCancelDialog(false)
      toast.success("Booking cancelled.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel.")
    } finally {
      setIsCancelling(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!job) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">Booking not found.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/dashboard/user/bookings">Back to Bookings</Link>
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const artisanName = job.acceptedArtisan
    ? `${job.acceptedArtisan.firstname} ${job.acceptedArtisan.lastname}`.trim()
    : "Awaiting artisan"

  const cfg = statusConfig[job.status] ?? { label: job.status, className: "" }

  const timelineSteps = [
    { label: "Booking Created", done: true, time: new Date(job.createdAt).toLocaleDateString() },
    { label: "Artisan Assigned", done: !!job.acceptedArtisan, time: job.acceptedArtisan ? "Assigned" : "" },
    { label: "Work Started", done: job.status === "IN_PROGRESS" || job.status === "COMPLETED", time: "" },
    { label: "Work Completed", done: job.status === "COMPLETED", time: "" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/user/bookings">
            <ArrowLeft className="h-4 w-4" />
            Back to Bookings
          </Link>
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Booking Details</h1>
            <p className="text-muted-foreground">Booking #{job.id.substring(0, 8)}</p>
          </div>
          <Badge variant="outline" className={cfg.className}>
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
            {cfg.label}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <Wrench className="h-4 w-4 text-primary" />
                  Service Information
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Job Title</p>
                    <p className="mt-1 font-medium text-foreground">{job.title}</p>
                  </div>
                  {job.service && (
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">Service</p>
                      <p className="mt-1 font-medium text-foreground">{job.service.name}</p>
                    </div>
                  )}
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Booking ID</p>
                    <p className="mt-1 font-medium text-foreground">#{job.id.substring(0, 8)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">Created</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="font-medium text-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {job.location && (
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    Service Location
                  </h3>
                </div>
                <CardContent className="p-5">
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="font-medium text-foreground">{job.location}</p>
                  </div>
                  {job.description && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Description:</p>
                      <p className="mt-1 leading-relaxed">{job.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Booking Timeline
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="space-y-0">
                  {timelineSteps.map((step, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            step.done ? "bg-primary text-primary-foreground" : "border-2 border-border bg-background"
                          }`}
                        >
                          {step.done ? (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-xs text-muted-foreground">{idx + 1}</span>
                          )}
                        </div>
                        {idx < timelineSteps.length - 1 && (
                          <div className={`h-8 w-0.5 ${step.done ? "bg-primary/50" : "bg-border"}`} />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`text-sm font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        {step.time && <p className="text-xs text-muted-foreground">{step.time}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  Assigned Artisan
                </h3>
              </div>
              <CardContent className="p-5">
                {job.acceptedArtisan ? (
                  <>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={job.acceptedArtisan.profilePicture || "/placeholder.svg"} />
                        <AvatarFallback>{artisanName.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold text-foreground">{artisanName}</h4>
                        <div className="mt-1 flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">—</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                      {job.acceptedArtisan.phoneNumber && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {job.acceptedArtisan.phoneNumber}
                        </div>
                      )}
                      {job.acceptedArtisan.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {job.acceptedArtisan.email}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" className="flex-1 bg-transparent" size="sm" asChild>
                        <Link href={`/dashboard/user/messages?artisan=${job.acceptedArtisan.id}`}>
                          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                          Chat
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No artisan assigned yet. Waiting for applications.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 p-5">
                {job.status === "COMPLETED" && (
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href={`/dashboard/user/review/${job.id}`}>
                      <Star className="mr-2 h-4 w-4" />
                      Leave a Review
                    </Link>
                  </Button>
                )}
                {job.status === "OPEN" && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancel Booking
                  </Button>
                )}
                {job.status === "IN_PROGRESS" && job.acceptedArtisan && (
                  <Button variant="outline" className="w-full bg-transparent" asChild>
                    <Link href={`/dashboard/user/messages?artisan=${job.acceptedArtisan.id}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Contact Artisan
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel booking for "{job.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>No, Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isCancelling}
            >
              {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
