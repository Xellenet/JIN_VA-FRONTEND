import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, ChevronDown, Wrench } from "lucide-react"
import { mockServices, mockArtisans } from "@/lib/data/mock-data"

export default function UserServicesPage() {
  const user = {
    id: "u1",
    name: "Sarah Williams",
    email: "sarah@example.com",
    role: "user" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  }

  const defaultArtisan = mockArtisans[0]

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Available Services</h1>
          <p className="text-muted-foreground">Browse and book plumbing services</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search services..." className="pl-10" />
              </div>
              <Button variant="outline" className="gap-2 bg-transparent">
                All Categories
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="gap-2 bg-transparent">
                Price Range
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {mockServices
                .filter((service) => service.status === "active")
                .map((service) => (
                  <Card key={service.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
                        <div className="flex items-center justify-between">
                          <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                            <Wrench className="h-6 w-6" />
                          </div>
                          <Badge variant="secondary" className="bg-white text-primary">
                            ${service.price}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-4 p-6">
                        <div>
                          <h3 className="font-semibold text-foreground">{service.name}</h3>
                          <p className="text-sm text-muted-foreground">{service.category}</p>
                        </div>

                        <p className="text-sm text-muted-foreground">{service.description}</p>

                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" className="flex-1 bg-transparent" asChild>
                            <Link href="/dashboard/user/search">Find Artisan</Link>
                          </Button>
                          <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                            <Link href={`/dashboard/user/book/${defaultArtisan.id}`}>Book Now</Link>
                          </Button>
                        </div>
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
