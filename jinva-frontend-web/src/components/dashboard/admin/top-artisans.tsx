import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { RatingStars } from "@/components/ui/rating-stars"
import { UserRound } from "lucide-react"
import type { AdminAnalytics } from "@/lib/admin-analytics"

/**
 * QA ADM-02: artisans ranked by jobs completed in the period, then rating,
 * from the analytics rollup. It used to show three made-up people.
 */
export function TopArtisans({ artisans }: { artisans: NonNullable<AdminAnalytics["topArtisans"]> }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Top Performing Artisans</CardTitle>
          <Button variant="link" size="sm" className="h-8" asChild>
            <Link href="/dashboard/admin/artisans">See All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {artisans.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No artisans yet.</p>
        ) : (
          <div className="space-y-4">
            {artisans.map((artisan) => (
              <div key={artisan.artisanProfileId} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback>
                      <UserRound className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{artisan.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{artisan.businessName?.trim() || "Artisan"}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium">
                    {artisan.completedJobs} job{artisan.completedJobs === 1 ? "" : "s"} completed
                  </p>
                  {artisan.totalReviews > 0 ? (
                    <RatingStars
                      rating={artisan.averageRating}
                      totalReviews={artisan.totalReviews}
                      size="sm"
                      showCount={false}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">No reviews yet</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
