"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Star,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Camera,
  Award,
  ImageIcon,
  UserRound,
  Loader2,
  DollarSign,
  MessageSquare,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"
import { naviiAvatar } from "@/lib/utils"
import { toast } from "sonner"
import { RatingStars } from "@/components/ui/rating-stars"
import { VerifiedBookingBadge } from "@/components/reviews/verified-booking-badge"
import type { ApiReview } from "@/lib/types"

interface BackendArtisanProfile {
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
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export default function ArtisanProfile() {
  const { user, refreshUser } = useAuth()

  // Personal info form
  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  // Artisan profile form
  const [bio, setBio] = useState("")
  const [location, setLocation] = useState("")
  const [experienceYears, setExperienceYears] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")

  // Loaded data
  const [artisanProfile, setArtisanProfile] = useState<BackendArtisanProfile | null>(null)
  const [reviews, setReviews] = useState<ApiReview[]>([])
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB")
      e.target.value = ""
      return
    }
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are supported")
      e.target.value = ""
      return
    }

    const formData = new FormData()
    formData.append("avatar", file)

    setIsUploadingAvatar(true)
    try {
      await apiFetch("/users/me/avatar", { method: "POST", body: formData })
      await refreshUser()
      toast.success("Profile photo updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo")
    } finally {
      setIsUploadingAvatar(false)
      e.target.value = ""
    }
  }

  // Populate personal fields from auth user
  useEffect(() => {
    if (!user) return
    const parts = user.name.split(" ")
    setFirstname(parts[0] ?? "")
    setLastname(parts.slice(1).join(" "))
    setEmail(user.email ?? "")
    setPhone(user.phone ?? "")
  }, [user])

  // Load artisan profile + reviews
  useEffect(() => {
    apiFetch<BackendArtisanProfile>("/users/me/artisan-profile")
      .then((profile) => {
        setArtisanProfile(profile)
        setBio(profile.bio ?? "")
        setLocation(profile.location ?? "")
        setExperienceYears(profile.experienceYears != null ? String(profile.experienceYears) : "")
        setBusinessName(profile.businessName ?? "")
        setHourlyRate(profile.hourlyRate != null ? String(profile.hourlyRate) : "")

        return apiFetch<ApiReview[] | { items: ApiReview[] }>(
          `/reviews/artisan-profile/${profile.id}`,
        ).catch(() => [] as ApiReview[])
      })
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: ApiReview[] }).items ?? []
        setReviews(items)
      })
      .catch(() => {})
      .finally(() => setIsLoadingProfile(false))
  }, [])

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      await Promise.all([
        apiFetch("/users/me", {
          method: "PATCH",
          body: JSON.stringify({ firstname, lastname, email, phoneNumber: phone }),
        }),
        apiFetch("/users/me/artisan-profile", {
          method: "PATCH",
          body: JSON.stringify({
            bio: bio || undefined,
            experienceYears: experienceYears ? Number(experienceYears) : undefined,
            businessName: businessName || undefined,
            hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
            location: location || undefined,
          }),
        }),
      ])
      await refreshUser()
      toast.success("Profile updated successfully.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Profile Hero */}
        <Card className="overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary to-primary/80" />
          <CardContent className="relative px-6 pb-6">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
              <div className="relative -mt-16">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback><UserRound className="h-10 w-10" /></AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
                    {artisanProfile && (
                      <Badge
                        variant="outline"
                        className={
                          artisanProfile.availabilityStatus === "AVAILABLE"
                            ? "border-primary/30 bg-primary/5 text-primary"
                            : "border-border bg-muted text-muted-foreground"
                        }
                      >
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                        {artisanProfile.availabilityStatus === "AVAILABLE" ? "Available" : "Busy"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {artisanProfile?.businessName || artisanProfile?.services?.[0]?.name || "Artisan"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {user.email}
                    </span>
                    {user.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {user.phone}
                      </span>
                    )}
                    {artisanProfile?.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {artisanProfile.location}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="bg-transparent">Edit Profile</Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href="/dashboard/artisan/portfolio">
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Manage Portfolio
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <RatingStars
                    rating={Number(artisanProfile?.averageRating ?? user.rating ?? 0)}
                    totalReviews={artisanProfile?.totalReviews ?? user.reviews ?? 0}
                    size="lg"
                    showCount={false}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Avg. Rating</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">{user.jobsCompleted ?? 0}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Jobs Completed</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Award className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">
                    {artisanProfile?.totalReviews ?? user.reviews ?? 0}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section */}
        <Tabs defaultValue="about" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-none md:inline-flex">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          {/* About Tab */}
          <TabsContent value="about" className="space-y-6">
            {isLoadingProfile ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <div className="border-b border-border p-5">
                      <h3 className="font-semibold text-foreground">Personal Information</h3>
                    </div>
                    <CardContent className="p-5">
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="firstname">First Name</Label>
                          <Input
                            id="firstname"
                            value={firstname}
                            onChange={(e) => setFirstname(e.target.value)}
                            placeholder="First name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastname">Last Name</Label>
                          <Input
                            id="lastname"
                            value={lastname}
                            onChange={(e) => setLastname(e.target.value)}
                            placeholder="Last name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="email"
                              className="pl-10"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="Email address"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="phone"
                              className="pl-10"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="Phone number"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="location">Service Area / Location</Label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Textarea
                              id="location"
                              className="pl-10"
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                              placeholder="e.g., Accra, Greater Accra Region"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <div className="border-b border-border p-5">
                      <h3 className="font-semibold text-foreground">Professional Details</h3>
                    </div>
                    <CardContent className="p-5">
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="bio">Bio</Label>
                          <Textarea
                            id="bio"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Describe your experience, specializations, and what clients can expect..."
                            rows={4}
                          />
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="experience">Years of Experience</Label>
                            <Input
                              id="experience"
                              type="number"
                              min="0"
                              value={experienceYears}
                              onChange={(e) => setExperienceYears(e.target.value)}
                              placeholder="e.g., 5"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="hourlyRate">Hourly Rate (GH₵)</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="hourlyRate"
                                type="number"
                                min="0"
                                className="pl-10"
                                value={hourlyRate}
                                onChange={(e) => setHourlyRate(e.target.value)}
                                placeholder="e.g., 50"
                              />
                            </div>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="businessName">Business Name</Label>
                            <Input
                              id="businessName"
                              value={businessName}
                              onChange={(e) => setBusinessName(e.target.value)}
                              placeholder="e.g., John's Plumbing Services"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-end">
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <div className="border-b border-border p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Client Reviews</h3>
                  <RatingStars
                    rating={Number(artisanProfile?.averageRating ?? user.rating ?? 0)}
                    totalReviews={artisanProfile?.totalReviews ?? user.reviews ?? 0}
                    size="lg"
                  />
                </div>
              </div>
              <CardContent className="divide-y divide-border p-0">
                {reviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Star className="mb-3 h-8 w-8 text-muted-foreground/40" />
                    <p className="font-medium text-foreground">No reviews yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Reviews from clients will appear here after job completion.
                    </p>
                  </div>
                ) : (
                  reviews.map((review) => {
                    const reviewerName = review.reviewerUser
                      ? `${review.reviewerUser.firstname} ${review.reviewerUser.lastname}`.trim()
                      : (review.reviewerName ?? "Anonymous")
                    const avatar = review.reviewerUser?.profilePicture
                    return (
                      <div key={review.id} className="p-5">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={avatar || naviiAvatar(reviewerName)} />
                            <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-foreground">{reviewerName}</h4>
                                {review.verifiedBooking && <VerifiedBookingBadge />}
                              </div>
                              <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, si) => (
                                <Star
                                  key={`${review.id}-star-${si}`}
                                  className={`h-3.5 w-3.5 ${si < Number(review.rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                                />
                              ))}
                            </div>
                            {review.review && (
                              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.review}</p>
                            )}
                            {review.artisanReply && (
                              <div className="mt-3 rounded-r-lg border-l-2 border-primary bg-primary/5 py-2 pl-3 pr-2">
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                  <MessageSquare className="h-3 w-3" />
                                  Your response
                                  {review.artisanRepliedAt && (
                                    <span className="font-normal text-muted-foreground">
                                      · {formatDate(review.artisanRepliedAt)}
                                    </span>
                                  )}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-foreground">{review.artisanReply}</p>
                              </div>
                            )}
                          </div>
                        </div>
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
