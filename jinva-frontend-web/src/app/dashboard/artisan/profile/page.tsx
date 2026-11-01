"use client"

import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Star, Mail, Phone, MapPin, UserRound, ShieldCheck, Eye, Wrench, ImageIcon } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"
import { splitStoredPhone } from "@/lib/phone"
import { availabilityLabel } from "@/lib/availability"
import { useTabParam } from "@/lib/use-tab-param"
import { SearchVisibilityBadge } from "@/components/artisan/profile-completeness"
import {
  AboutTab,
  type BackendArtisanProfile,
  type ProfileLoadState,
} from "@/components/artisan/profile/about-tab"
import { ServicesTab, type ServicesProfileUpdate } from "@/components/artisan/profile/services-tab"
import { PortfolioTab } from "@/components/artisan/profile/portfolio-tab"
import { ReviewsTab } from "@/components/artisan/profile/reviews-tab"

const TABS = ["about", "services", "portfolio", "reviews"] as const
type Tab = (typeof TABS)[number]

/** Settings → Verification, where identity documents are sent. */
const VERIFICATION_HREF = "/dashboard/artisan/settings?tab=verification"

/** One figure in the header's stat strip. */
function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-0 px-2 py-3 text-center sm:px-4">
      <p className="text-lg font-semibold tabular-nums text-foreground sm:text-xl">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

/**
 * Profile: the artisan's shop front — everything a client sees, in one place.
 * The header is the profile as clients meet it; the tabs edit its parts
 * (About, Services, Portfolio, Reviews), each linkable by `?tab=`. Only About
 * is loaded up front (the header needs the same profile); the other tabs load
 * when they are opened. Account-only things (email, password, payouts,
 * verification) live in Settings.
 */
function ArtisanProfileContent() {
  const { user } = useAuth()
  const [activeTab, changeTab] = useTabParam<Tab>(TABS, "about")

  const [profile, setProfile] = useState<BackendArtisanProfile | null>(null)
  const [loadState, setLoadState] = useState<ProfileLoadState>("loading")
  const [loadedAt, setLoadedAt] = useState(0)
  const [completedJobs, setCompletedJobs] = useState<number | null>(null)

  const loadProfile = useCallback(async () => {
    setLoadState("loading")
    try {
      const loaded = await apiFetch<BackendArtisanProfile>("/users/me/artisan-profile")
      setProfile(loaded)
      setLoadedAt(Date.now())
      setLoadState("ready")
      // C7: the completed-jobs count is computed by the public profile
      // endpoint (the same number clients see). The owner can read it even
      // while hidden from search.
      apiFetch<{ completedJobsCount?: number }>(`/artisans/${loaded.id}`)
        .then((pub) => setCompletedJobs(pub.completedJobsCount ?? 0))
        .catch(() => setCompletedJobs(null))
    } catch {
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  // C2: a save's response carries fresh completeness, so the checklist and
  // the header badge update straight from it.
  const mergeProfile = useCallback((saved: BackendArtisanProfile | ServicesProfileUpdate) => {
    setProfile((prev) => (prev ? { ...prev, ...definedOnly(saved) } : prev))
  }, [])

  if (!user) return null

  const rating = Number(profile?.averageRating ?? user.rating ?? 0)
  const totalReviews = profile?.totalReviews ?? user.reviews ?? 0

  return (
    <div className="space-y-6">
      {/* The shop front, as clients meet it. */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="h-24 bg-gradient-to-r from-primary to-primary/80 sm:h-32" />
        <CardContent className="relative px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-end md:gap-6">
            <div className="relative -mt-12 sm:-mt-16">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg sm:h-28 sm:w-28">
                <AvatarImage src={user.avatar} alt="" />
                <AvatarFallback><UserRound className="h-10 w-10" aria-hidden="true" /></AvatarFallback>
              </Avatar>
            </div>

            <div className="flex w-full min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">{user.name}</h1>
                  {profile?.isVerified && (
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Verified
                    </Badge>
                  )}
                  {profile && (
                    <Badge
                      variant="outline"
                      className={
                        profile.availabilityStatus === "AVAILABLE"
                          ? "border-primary/30 bg-primary/5 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {availabilityLabel(profile.availabilityStatus)}
                    </Badge>
                  )}
                  {/* C2/§3.4: search visibility, always shown. */}
                  <SearchVisibilityBadge profile={profile} />
                </div>
                <p className="mt-1 text-muted-foreground">
                  {profile?.businessName || profile?.services?.[0]?.name || "Artisan"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="[overflow-wrap:anywhere]">{user.email}</span>
                  </span>
                  {user.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {splitStoredPhone(user.phone).national}
                    </span>
                  )}
                  {profile?.location && (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="[overflow-wrap:anywhere]">{profile.location}</span>
                    </span>
                  )}
                </div>
                {profile && !profile.isVerified && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <Link
                      href={VERIFICATION_HREF}
                      className="font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
                    >
                      Verify your identity
                    </Link>{" "}
                    to show clients a verified badge.
                  </p>
                )}
              </div>

              {profile && (
                <Button variant="outline" asChild className="w-full bg-transparent max-sm:h-11 sm:w-auto md:shrink-0">
                  <Link href={`/dashboard/user/artisan/${profile.id}`}>
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    Preview as a client
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Stat strip: one compact row on every width (M4). */}
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
            <Stat value={completedJobs ?? "–"} label="Jobs completed" />
            <Stat value={totalReviews} label={totalReviews === 1 ? "Review" : "Reviews"} />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={changeTab} className="gap-6">
        {/* A 2×2 grid on phones (as in Settings), so no tab is clipped. */}
        <TabsList
          aria-label="Your profile"
          className="grid h-auto w-full grid-cols-2 gap-1 bg-muted sm:inline-flex sm:w-fit sm:gap-0"
        >
          <TabsTrigger value="about" className="min-h-11 gap-2 sm:min-h-0">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            About
          </TabsTrigger>
          <TabsTrigger value="services" className="min-h-11 gap-2 sm:min-h-0">
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Services
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="min-h-11 gap-2 sm:min-h-0">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            Portfolio
          </TabsTrigger>
          <TabsTrigger value="reviews" className="min-h-11 gap-2 sm:min-h-0">
            <Star className="h-4 w-4" aria-hidden="true" />
            Reviews
          </TabsTrigger>
        </TabsList>

        {/* About stays mounted (hidden) on the other tabs, so unsaved edits
            survive a look at Services or Reviews. */}
        <TabsContent value="about" forceMount className="data-[state=inactive]:hidden">
          <AboutTab
            profile={profile}
            loadState={loadState}
            loadedAt={loadedAt}
            onReload={() => void loadProfile()}
            onSaved={mergeProfile}
          />
        </TabsContent>
        <TabsContent value="services">
          <ServicesTab onProfileChange={mergeProfile} />
        </TabsContent>
        <TabsContent value="portfolio">
          <PortfolioTab />
        </TabsContent>
        <TabsContent value="reviews">
          <ReviewsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** The fields a response actually carries, so a partial one never blanks the rest. */
function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}

export default function ArtisanProfilePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <ArtisanProfileContent />
      </Suspense>
    </DashboardLayout>
  )
}
