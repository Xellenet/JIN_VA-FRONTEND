"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Star,
  Mail,
  Lock,
  Phone,
  MapPin,
  Briefcase,
  Camera,
  Award,
  ImageIcon,
  UserRound,
  Loader2,
  MessageSquare,
  AlertTriangle,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch, apiFetchWithMeta } from "@/lib/api"
import { resolveAvatarUrl } from "@/lib/utils"
import { toast } from "sonner"
import { RatingStars } from "@/components/ui/rating-stars"
import { VerifiedBookingBadge } from "@/components/reviews/verified-booking-badge"
import {
  ProfileCompleteness,
  SearchVisibilityBadge,
  readProfileCompleteness,
} from "@/components/artisan/profile-completeness"
import type { ApiReview } from "@/lib/types"

// RV2: reviews are paginated server-side (default limit 10, max 50) — always
// send `page`/`limit` explicitly, or reviews 11+ are silently unreachable.
const REVIEWS_PAGE_SIZE = 10

function extractTotalPages(meta: Record<string, unknown> | undefined): number {
  const direct = meta?.totalPages as number | undefined
  const nested = (meta?.pagination as { totalPages?: number } | undefined)?.totalPages
  const value = direct ?? nested ?? 1
  return value > 0 ? value : 1
}

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
  // C2: the persisted search-visibility flag and the ordered list of
  // still-missing required fields (api-contract.md, `GET`/`PATCH
  // /users/me/artisan-profile`). Optional because a failed or legacy response
  // may omit them, which the completeness component reads as "unknown".
  isProfileComplete?: boolean
  missingFields?: string[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

/**
 * FE-2: the fields `PATCH /users/me/artisan-profile` owns. When that half of
 * the save is rejected while the contact half has already committed, these are
 * the inputs holding a value the server does not have — so they are the ones
 * that get marked.
 */
type ProfessionalField = "bio" | "location" | "experienceYears" | "hourlyRate" | "businessName"

/**
 * FE-2: an amber ring on an input whose value is not what is stored.
 *
 * Deliberately not `aria-invalid`: nothing the artisan typed is invalid, and a
 * screen reader announcing "invalid entry" would be wrong. The state is "not
 * saved", which the note below the field says in words and `aria-describedby`
 * ties to the input.
 */
const UNSAVED_FIELD_CLASS = "border-warning focus-visible:border-warning focus-visible:ring-warning/30"

function UnsavedFieldNote({ id }: { id: string }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs font-medium text-warning">
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      Not saved yet
    </p>
  )
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
  const [reviewsPage, setReviewsPage] = useState(1)
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // FE-2: set when the contact half of a save committed and the professional
  // half was rejected. That is the only outcome where the page shows a MIX of
  // stored and unstored values — on a first-half failure nothing is sent at
  // all and the toast says so — so it is the only one that needs the fields
  // themselves to carry the distinction. Cleared by the next successful save.
  const [professionalHalfUnsaved, setProfessionalHalfUnsaved] = useState(false)

  // C2: controlled so a completeness row's action can switch to the About tab
  // before scrolling to the input it points at — three of the four required
  // fields live in that tab, and Tabs unmounts the inactive one.
  const [activeTab, setActiveTab] = useState("about")

  /**
   * C2.4: the fix has to land in the viewport *and* the keyboard focus — an
   * anchor alone moves the eye but not the caret. Retries across a few frames
   * because the input may only mount once the About tab has switched in, so
   * the row is never a dead action.
   */
  const focusProfileField = useCallback((anchorId: string) => {
    setActiveTab("about")
    let attempts = 0
    const tryFocus = () => {
      const el = document.getElementById(anchorId)
      if (!el) {
        if (attempts++ < 20) requestAnimationFrame(tryFocus)
        return
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true })
    }
    requestAnimationFrame(tryFocus)
  }, [])

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

  // RV2: paginated so reviews 11+ stay reachable — reused by the pager below.
  const loadReviewsPage = useCallback((artisanProfileId: string, p: number) => {
    apiFetchWithMeta<ApiReview[] | { items: ApiReview[] }>(
      `/reviews/artisan-profile/${artisanProfileId}?page=${p}&limit=${REVIEWS_PAGE_SIZE}`,
    )
      .then(({ data, meta }) => {
        const items = Array.isArray(data) ? data : (data as { items: ApiReview[] })?.items ?? []
        setReviews(items)
        setReviewsPage(p)
        setReviewsTotalPages(extractTotalPages(meta))
      })
      .catch(() => setReviews((prev) => (p === 1 ? [] : prev)))
  }, [])

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
        loadReviewsPage(profile.id, 1)
      })
      .catch(() => {})
      .finally(() => setIsLoadingProfile(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * FE-2: which professional inputs currently differ from what the server
   * actually holds, judged against `artisanProfile` — which the failure path
   * deliberately leaves untouched, so it is still the stored truth.
   *
   * Computed rather than captured at failure time, so editing a field back to
   * its stored value clears that field's marker on its own, and a field the
   * artisan never touched is never marked. The two numeric fields compare
   * numerically: the API returns `hourlyRate` as `95.00` while the input holds
   * `95`, which is the same rate and must not read as unsaved.
   */
  const unsavedFields = useMemo<Set<ProfessionalField>>(() => {
    const marked = new Set<ProfessionalField>()
    if (!professionalHalfUnsaved) return marked

    const differsAsText = (typed: string, stored: string | undefined) => typed.trim() !== (stored ?? "").trim()
    const differsAsNumber = (typed: string, stored: number | undefined) => {
      if (typed.trim() === "") return stored != null
      return stored == null || Number(typed) !== Number(stored)
    }

    if (differsAsText(bio, artisanProfile?.bio)) marked.add("bio")
    if (differsAsText(location, artisanProfile?.location)) marked.add("location")
    if (differsAsText(businessName, artisanProfile?.businessName)) marked.add("businessName")
    if (differsAsNumber(experienceYears, artisanProfile?.experienceYears)) marked.add("experienceYears")
    if (differsAsNumber(hourlyRate, artisanProfile?.hourlyRate)) marked.add("hourlyRate")
    return marked
  }, [professionalHalfUnsaved, artisanProfile, bio, location, businessName, experienceYears, hourlyRate])

  const handleSaveProfile = async () => {
    const wasIncomplete = readProfileCompleteness(artisanProfile).state === "incomplete"

    setIsSaving(true)
    try {
      // FE-4: sequential, never `Promise.all`. Fired in parallel, a rejected
      // user-record PATCH (the reported repro is a phone number already in use)
      // still left the artisan-profile write committed — so the artisan was told
      // the save failed while half of it had silently landed, possibly moving
      // them into or out of customer search. Awaiting this one first means the
      // second write is simply never sent when this one fails, which makes the
      // common case genuinely all-or-nothing. Same shape as
      // /dashboard/artisan/settings's handleSave, which is the in-repo precedent.
      await apiFetch("/users/me", {
        method: "PATCH",
        // `email` is deliberately absent: `UpdateMeDto` doesn't accept it and
        // the API's ValidationPipe rejects unknown properties, so including it
        // made every save on this page fail with "property email should not
        // exist".
        body: JSON.stringify({ firstname, lastname, phoneNumber: phone }),
      })

      let savedProfile: BackendArtisanProfile
      try {
        savedProfile = await apiFetch<BackendArtisanProfile>("/users/me/artisan-profile", {
          method: "PATCH",
          body: JSON.stringify({
            bio: bio || undefined,
            experienceYears: experienceYears ? Number(experienceYears) : undefined,
            businessName: businessName || undefined,
            hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
            location: location || undefined,
          }),
        })
      } catch (profileErr: unknown) {
        // The rarer reverse case: contact details are already committed, so this
        // is not "the save failed" — it's half-saved, and the toast says so
        // plainly (requirements.md Open Question 2). Deliberately no compensating
        // write back to the previous contact details: a rollback can itself fail,
        // and a failed rollback leaves a worse state than an honest message.
        //
        // `artisanProfile` is left untouched on purpose — the completeness
        // checklist and the hero badge must keep reporting what is actually
        // stored, so a failed save can never show the artisan as having moved
        // into or out of search. `refreshUser` is still called: the contact half
        // DID land, and the hero reads name/phone off the auth context.
        //
        // The professional inputs keep the artisan's typed values rather than
        // being reverted, because the message asks them to try again and
        // retyping is not a retry. FE-2: they are marked instead — an amber
        // ring and a "Not saved yet" note on each field that differs from
        // what is stored — so the screen distinguishes the two committed
        // contact fields from the uncommitted professional ones, and someone
        // who reloads later cannot lose text they believed was saved.
        setProfessionalHalfUnsaved(true)
        await refreshUser()
        const reason = profileErr instanceof Error ? profileErr.message : ""
        toast.error(
          reason
            ? `Your contact details were saved, but your professional details couldn't be: ${reason}`
            : "Your contact details were saved, but your professional details couldn't be — please try again.",
        )
        return
      }

      // C2: the PATCH response carries fresh `isProfileComplete` +
      // `missingFields` (api-contract.md), so the checklist and the hero badge
      // update straight from the save — no follow-up GET, no hard refresh.
      setArtisanProfile((prev) => (prev ? { ...prev, ...savedProfile } : savedProfile))
      // FE-2: everything on this form is now stored, so any marker from an
      // earlier half-failure is cleared.
      setProfessionalHalfUnsaved(false)
      await refreshUser()
      const nowComplete = readProfileCompleteness(savedProfile).state === "complete"
      toast.success(
        wasIncomplete && nowComplete
          ? "Profile updated — customers can now find you in search."
          : "Profile updated successfully.",
      )
    } catch (err: unknown) {
      // Only the user-record half can reach this now, so nothing was committed.
      // The message is the backend's own (e.g. "Phone number already in use").
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
                    {/* C2/§3.4: search visibility, permanently visible in both
                        states — the positive signal that replaces a dismissible
                        "you're all set" panel. */}
                    <SearchVisibilityBadge profile={artisanProfile} />
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

        {/* C2/§3.2: the completeness checklist — between the hero and the tabs,
            so the missing field and the input that fixes it are on one screen. */}
        <ProfileCompleteness
          variant="card"
          profile={artisanProfile}
          isLoading={isLoadingProfile}
          onFixField={focusProfileField}
        />

        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                          {/* `PATCH /users/me` rejects `email` outright — changing it
                              needs its own verified flow — so this matches the
                              read-only treatment the customer settings page already
                              uses rather than accepting edits nothing can save. */}
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                            <Input
                              id="email"
                              className="cursor-not-allowed bg-muted/50 pl-10 pr-9 text-muted-foreground"
                              value={email}
                              readOnly
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
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
                          {/* Lives in this card for layout reasons, but it is
                              saved by the artisan-profile PATCH — so it is
                              marked with the professional fields, not the
                              contact ones. */}
                          <Label htmlFor="location">Service Area / Location</Label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Textarea
                              id="location"
                              className={`pl-10 ${unsavedFields.has("location") ? UNSAVED_FIELD_CLASS : ""}`}
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                              placeholder="e.g., Accra, Greater Accra Region"
                              rows={2}
                              aria-describedby={unsavedFields.has("location") ? "location-unsaved" : undefined}
                            />
                          </div>
                          {unsavedFields.has("location") && <UnsavedFieldNote id="location-unsaved" />}
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
                            className={unsavedFields.has("bio") ? UNSAVED_FIELD_CLASS : undefined}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Describe your experience, specializations, and what clients can expect..."
                            rows={4}
                            aria-describedby={unsavedFields.has("bio") ? "bio-unsaved" : undefined}
                          />
                          {unsavedFields.has("bio") && <UnsavedFieldNote id="bio-unsaved" />}
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="experience">Years of Experience</Label>
                            <Input
                              id="experience"
                              type="number"
                              min="0"
                              className={unsavedFields.has("experienceYears") ? UNSAVED_FIELD_CLASS : undefined}
                              value={experienceYears}
                              onChange={(e) => setExperienceYears(e.target.value)}
                              placeholder="e.g., 5"
                              aria-describedby={
                                unsavedFields.has("experienceYears") ? "experience-unsaved" : undefined
                              }
                            />
                            {unsavedFields.has("experienceYears") && <UnsavedFieldNote id="experience-unsaved" />}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="hourlyRate">Hourly Rate (GH₵)</Label>
                            {/* No currency icon: lucide's DollarSign renders a
                                literal "$" next to a field that is in cedis.
                                The label carries the unit instead — the same
                                treatment as "Price (GH₵)" on the admin services
                                form. */}
                            <Input
                              id="hourlyRate"
                              type="number"
                              min="0"
                              className={unsavedFields.has("hourlyRate") ? UNSAVED_FIELD_CLASS : undefined}
                              value={hourlyRate}
                              onChange={(e) => setHourlyRate(e.target.value)}
                              placeholder="e.g., 50"
                              aria-describedby={unsavedFields.has("hourlyRate") ? "hourlyRate-unsaved" : undefined}
                            />
                            {unsavedFields.has("hourlyRate") && <UnsavedFieldNote id="hourlyRate-unsaved" />}
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="businessName">Business Name</Label>
                            <Input
                              id="businessName"
                              className={unsavedFields.has("businessName") ? UNSAVED_FIELD_CLASS : undefined}
                              value={businessName}
                              onChange={(e) => setBusinessName(e.target.value)}
                              placeholder="e.g., John's Plumbing Services"
                              aria-describedby={unsavedFields.has("businessName") ? "businessName-unsaved" : undefined}
                            />
                            {unsavedFields.has("businessName") && <UnsavedFieldNote id="businessName-unsaved" />}
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
                            <AvatarImage src={resolveAvatarUrl(avatar, reviewerName)} />
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
                                  className={`h-3.5 w-3.5 ${si < Number(review.rating) ? "fill-rating text-rating" : "text-muted-foreground/30"}`}
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
              {reviewsTotalPages > 1 && (
                <div className="border-t border-border p-3">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            if (artisanProfile && reviewsPage > 1) loadReviewsPage(artisanProfile.id, reviewsPage - 1)
                          }}
                          className={reviewsPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {Array.from({ length: reviewsTotalPages }, (_, i) => i + 1).map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === reviewsPage}
                            onClick={(e) => { e.preventDefault(); if (artisanProfile) loadReviewsPage(artisanProfile.id, p) }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            if (artisanProfile && reviewsPage < reviewsTotalPages) loadReviewsPage(artisanProfile.id, reviewsPage + 1)
                          }}
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
    </DashboardLayout>
  )
}
