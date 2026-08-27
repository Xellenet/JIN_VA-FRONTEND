import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { RatingStars } from "@/components/ui/rating-stars"
import { ChevronRight, UserRound } from "lucide-react"
import type { ArtisanProfile } from "@/lib/types"
import { resolveAvatarUrl } from "@/lib/utils"

interface TopArtisansProps {
  artisans: ArtisanProfile[]
}

export function TopArtisans({ artisans }: TopArtisansProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Top Performing Artisans</CardTitle>
          <Button variant="link" size="sm" className="h-8">
            See All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {artisans.slice(0, 3).map((artisan) => (
            <div key={artisan.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={resolveAvatarUrl(artisan.avatar, artisan.name)} />
                  <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{artisan.name}</p>
                  <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">{artisan.jobsCompleted} Jobs Completed</p>
                  <RatingStars rating={artisan.avgRating} totalReviews={artisan.reviews} size="sm" showCount={false} />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
