"use client"

import { useState, useEffect, useRef } from "react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Star,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Camera,
  Plus,
  Trash2,
  ImageIcon,
  Video,
  Eye,
  X,
  Calendar,
  Award,
  Upload,
  UserRound,
  Loader2,
  DollarSign,
} from "lucide-react"
import { mockPortfolio } from "@/lib/data/mock-data"
import type { PortfolioItem } from "@/lib/types"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"
import { naviiAvatar } from "@/lib/utils"
import { toast } from "sonner"

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

interface BackendReview {
  id: string
  rating: number
  review?: string
  reviewerName?: string
  reviewerUser?: { id: string; firstname: string; lastname: string; profilePicture?: string }
  createdAt: string
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
  const [reviews, setReviews] = useState<BackendReview[]>([])
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

  // Portfolio (mock — no backend endpoint yet)
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(mockPortfolio)
  const [activeFilter, setActiveFilter] = useState("all")
  const [previewItem, setPreviewItem] = useState<PortfolioItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

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

        return apiFetch<BackendReview[] | { items: BackendReview[] }>(
          `/reviews/artisan-profile/${profile.id}`,
        ).catch(() => [] as BackendReview[])
      })
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: BackendReview[] }).items ?? []
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

  const categories = ["all", ...Array.from(new Set(portfolio.map((p) => p.category)))]
  const filtered = activeFilter === "all" ? portfolio : portfolio.filter((p) => p.category === activeFilter)

  const handleDelete = (id: string) => {
    setPortfolio((prev) => prev.filter((item) => item.id !== id))
    setDeleteConfirm(null)
  }

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
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Share Portfolio</Button>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold text-foreground">
                    {Number(artisanProfile?.averageRating ?? 0).toFixed(1) ?? user.rating?.toFixed(1) ?? "0.0"}
                  </span>
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
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">{portfolio.length}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Portfolio Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section */}
        <Tabs defaultValue="about" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-none md:inline-flex">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    variant={activeFilter === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter(cat)}
                    className={activeFilter === cat ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Button>
                ))}
              </div>

              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Work
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Portfolio Item</DialogTitle>
                    <DialogDescription>Showcase your completed work to attract new clients.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="pf-title">Title</Label>
                      <Input id="pf-title" placeholder="e.g., Bathroom Renovation" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pf-category">Category</Label>
                      <Input id="pf-category" placeholder="e.g., Renovation, Repair, Installation" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pf-desc">Description</Label>
                      <Textarea id="pf-desc" placeholder="Describe the work you did..." rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label>Upload Media</Label>
                      <label
                        htmlFor="pf-upload-img"
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted"
                      >
                        <Upload className="h-5 w-5" />
                        <span>Click to upload images or videos</span>
                        <input id="pf-upload-img" type="file" accept="image/*,video/*" className="hidden" multiple />
                      </label>
                      <p className="text-xs text-muted-foreground">Supports JPG, PNG, MP4. Max 10MB per file.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowAddDialog(false)}>
                      Add to Portfolio
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold text-foreground">No items yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your first portfolio item to showcase your work.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((item) => (
                  <Card key={item.id} className="group overflow-hidden">
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      <Image
                        src={item.image || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {item.type === "video" && (
                        <div className="absolute left-3 top-3">
                          <Badge className="bg-foreground/70 text-background">
                            <Video className="mr-1 h-3 w-3" />Video
                          </Badge>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100">
                        <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full" onClick={() => setPreviewItem(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="secondary"
                          className="h-10 w-10 rounded-full text-destructive hover:bg-destructive hover:text-white"
                          onClick={() => setDeleteConfirm(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="truncate font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />{item.date}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

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
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-foreground">
                      {Number(artisanProfile?.averageRating ?? 0).toFixed(1) ?? (user.rating ?? 0).toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({artisanProfile?.totalReviews ?? user.reviews ?? 0} reviews)
                    </span>
                  </div>
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
                              <h4 className="font-medium text-foreground">{reviewerName}</h4>
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

        {/* Lightbox */}
        {previewItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4"
            onClick={() => setPreviewItem(null)}
            onKeyDown={(e) => { if (e.key === "Escape") setPreviewItem(null) }}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of ${previewItem.title}`}
          >
            <div
              className="relative w-full max-w-3xl rounded-lg bg-background shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={() => {}}
              role="document"
            >
              <Button
                size="icon" variant="ghost"
                className="absolute -right-2 -top-2 z-10 h-8 w-8 rounded-full bg-background shadow-md"
                onClick={() => setPreviewItem(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="relative aspect-video overflow-hidden rounded-t-lg">
                <Image src={previewItem.image || "/placeholder.svg"} alt={previewItem.title} fill className="object-cover" />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-foreground">{previewItem.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{previewItem.description}</p>
                <div className="mt-3 flex items-center gap-3">
                  <Badge variant="secondary">{previewItem.category}</Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />{previewItem.date}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Portfolio Item</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this item from your portfolio? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
