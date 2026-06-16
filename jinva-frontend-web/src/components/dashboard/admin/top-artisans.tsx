import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Star, ChevronRight } from "lucide-react"
import type { ArtisanProfile } from "@/lib/types"

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
                  <AvatarImage src={artisan.avatar || "/placeholder.svg"} />
                  <AvatarFallback>{artisan.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{artisan.name}</p>
                  <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">{artisan.jobsCompleted} Jobs Completed</p>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <span>{artisan.avgRating}</span>
                  </div>
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
