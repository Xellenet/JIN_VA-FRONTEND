import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Star, ChevronRight } from "lucide-react"
import type { PlumberProfile } from "@/lib/types"

interface TopPlumbersProps {
  plumbers: PlumberProfile[]
}

export function TopPlumbers({ plumbers }: TopPlumbersProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Top Performing Plumbers</CardTitle>
          <Button variant="link" size="sm" className="h-8">
            See All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {plumbers.slice(0, 3).map((plumber) => (
            <div key={plumber.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={plumber.avatar || "/placeholder.svg"} />
                  <AvatarFallback>{plumber.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{plumber.name}</p>
                  <p className="text-sm text-muted-foreground">{plumber.specialization}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">{plumber.jobsCompleted} Jobs Completed</p>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <span>{plumber.avgRating}</span>
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
