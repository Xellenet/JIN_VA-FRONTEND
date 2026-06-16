"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Star,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Award,
  ImageIcon,
  ArrowLeft,
  MessageSquare,
} from "lucide-react"
import { mockArtisans } from "@/lib/data/mock-data"

export default function ArtisanPublicProfile() {
  const { id } = useParams<{ id: string }>()

  const artisan = mockArtisans.find((p) => p.id === id) || mockArtisans[0]

  const reviews = [
    { name: "Devon Lane", date: "Aug 18, 2025", rating: 5, comment: "Amazing job on our bathroom renovation. Professional, punctual, and exceeded expectations." },
    { name: "Kristin Watson", date: "Jul 25, 2025", rating: 5, comment: "Quick response for our emergency leak. Fixed everything in under 2 hours. Very reasonable pricing." },
    { name: "Jacob Jones", date: "Jun 30, 2025", rating: 4, comment: "Good work overall. Would hire again for future plumbing needs." },
    { name: "Wade Warren", date: "Jun 10, 2025", rating: 5, comment: "Excellent work on our kitchen sink installation. Clean, efficient, and friendly." },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back button */}
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/user/search">
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Link>
        </Button>

        {/* Profile Hero */}
        <Card className="overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary to-primary/80" />
          <CardContent className="relative px-6 pb-6">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
              <div className="relative -mt-16">
                <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                  <AvatarImage src={artisan.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-2xl">{artisan.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
              </div>

              <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground">{artisan.name}</h1>
                    <Badge
                      variant="outline"
                      className={
                        artisan.availability === "available"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-muted bg-muted text-muted-foreground"
                      }
                    >
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                      {artisan.availability === "available" ? "Available" : "Busy"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{artisan.specialization}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {artisan.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {artisan.phone}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Springfield, IL
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" asChild className="bg-transparent">
                    <Link href={`/dashboard/user/messages?artisan=${artisan.id}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Message
                    </Link>
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href={`/dashboard/user/book/${artisan.id}`}>Book Now</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold text-foreground">{artisan.avgRating}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Avg. Rating</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{artisan.jobsCompleted}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Jobs Completed</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Award className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{artisan.reviews}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Reviews</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-foreground">0</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Portfolio Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="portfolio" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold text-foreground">No portfolio items yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This artisan hasn't added any portfolio items yet.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about">
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">About {artisan.name}</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Experienced artisan with over 10 years in residential and commercial plumbing. Specializing in {artisan.specialization?.toLowerCase()}, pipe installation, and bathroom renovations. Licensed and insured professional committed to quality workmanship and customer satisfaction.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-foreground">Specialization</p>
                    <p className="mt-1 text-sm text-muted-foreground">{artisan.specialization}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-foreground">Experience</p>
                    <p className="mt-1 text-sm text-muted-foreground">10+ years</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-foreground">License</p>
                    <p className="mt-1 text-sm text-muted-foreground">PLB-2015-0472</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-foreground">Certifications</p>
                    <p className="mt-1 text-sm text-muted-foreground">Master Artisan, EPA 608, OSHA 10</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <div className="border-b border-border p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Client Reviews</h3>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-foreground">{artisan.avgRating}</span>
                    <span className="text-sm text-muted-foreground">({artisan.reviews} reviews)</span>
                  </div>
                </div>
              </div>
              <CardContent className="divide-y divide-border p-0">
                {reviews.map((review) => (
                  <div key={`${review.name}-${review.date}`} className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{review.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{review.name}</p>
                          <p className="text-xs text-muted-foreground">{review.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={`${review.name}-star-${i + 1}`}
                            className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
