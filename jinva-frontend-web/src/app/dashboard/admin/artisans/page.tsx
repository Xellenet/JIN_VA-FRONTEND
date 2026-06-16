import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, ChevronDown, Plus, Star, UserRound } from "lucide-react"
import { mockArtisans } from "@/lib/data/mock-data"
import { naviiAvatar } from "@/lib/utils"

export default function ArtisansPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">Artisans</CardTitle>
                <p className="text-sm text-muted-foreground">Manage and track all artisans in your team.</p>
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90 sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Artisan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search" className="pl-10" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2 bg-transparent">
                  All Status
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="gap-2 bg-transparent">
                  All Specializations
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="gap-2 bg-transparent">
                  All Ratings
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {mockArtisans.map((artisan) => (
                <Card key={artisan.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="relative h-40 bg-gradient-to-br from-primary to-primary/80">
                      <Avatar className="absolute bottom-0 left-1/2 h-24 w-24 -translate-x-1/2 translate-y-1/2 border-4 border-background">
                        <AvatarImage src={artisan.avatar || naviiAvatar(artisan.name)} />
                        <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-sm font-semibold">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        {artisan.avgRating}
                      </div>
                    </div>
                    <div className="mt-14 space-y-3 p-4 text-center">
                      <div>
                        <h3 className="font-semibold">{artisan.name}</h3>
                        <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          artisan.availability === "available"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-muted bg-muted text-muted-foreground"
                        }
                      >
                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"></span>
                        {artisan.availability === "available" ? "Active" : "Busy"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
