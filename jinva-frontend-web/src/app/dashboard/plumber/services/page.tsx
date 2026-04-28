"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronDown, Wrench, DollarSign, CheckCircle2 } from "lucide-react"
import { mockServices, mockPlumbers } from "@/lib/data/mock-data"

export default function PlumberServicesPage() {
  const user = {
    ...mockPlumbers[0],
    role: "plumber" as const,
  }

  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  const categories = [
    "all",
    ...Array.from(new Set(mockServices.map((s) => s.category))),
  ]

  const filteredServices = mockServices.filter((service) => {
    const matchesSearch =
      searchQuery === "" ||
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      categoryFilter === "all" || service.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const activeServices = filteredServices.filter((s) => s.status === "active")
  const inactiveServices = filteredServices.filter((s) => s.status === "inactive")

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Services</h1>
          <p className="text-muted-foreground">
            Browse available services you can be assigned to
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative">
                <Button
                  variant="outline"
                  className="gap-2 bg-transparent"
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  {categoryFilter === "all" ? "All Categories" : categoryFilter}
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {showCategoryDropdown && (
                  <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border bg-card py-1 shadow-lg">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                        onClick={() => {
                          setCategoryFilter(cat)
                          setShowCategoryDropdown(false)
                        }}
                      >
                        {cat === "all" ? "All Categories" : cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="outline" className="gap-2 bg-transparent">
                Price Range
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {filteredServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  No services found
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            ) : (
              <>
                {/* Active Services */}
                {activeServices.length > 0 && (
                  <div className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-foreground">
                      Active Services ({activeServices.length})
                    </h2>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {activeServices.map((service) => (
                        <Card
                          key={service.id}
                          className="overflow-hidden transition-shadow hover:shadow-md"
                        >
                          <CardContent className="p-0">
                            <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
                              <div className="flex items-center justify-between">
                                <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                                  <Wrench className="h-6 w-6" />
                                </div>
                                <Badge
                                  variant="secondary"
                                  className="bg-white text-primary"
                                >
                                  <DollarSign className="mr-0.5 h-3 w-3" />
                                  {service.price}
                                </Badge>
                              </div>
                            </div>

                            <div className="space-y-4 p-6">
                              <div>
                                <div className="flex items-start justify-between">
                                  <h3 className="font-semibold text-foreground">
                                    {service.name}
                                  </h3>
                                  <Badge
                                    variant="outline"
                                    className="border-green-200 bg-green-50 text-green-700"
                                  >
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Active
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {service.category}
                                </p>
                              </div>

                              <p className="text-sm text-muted-foreground">
                                {service.description}
                              </p>

                              <div className="flex gap-2 pt-2">
                                <Button
                                  variant="outline"
                                  className="flex-1 bg-transparent"
                                >
                                  View Details
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inactive Services */}
                {inactiveServices.length > 0 && (
                  <div>
                    <h2 className="mb-4 text-lg font-semibold text-foreground">
                      Inactive Services ({inactiveServices.length})
                    </h2>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {inactiveServices.map((service) => (
                        <Card
                          key={service.id}
                          className="overflow-hidden opacity-75 transition-shadow hover:shadow-md"
                        >
                          <CardContent className="p-0">
                            <div className="bg-gradient-to-br from-gray-400 to-gray-500 p-6 text-white">
                              <div className="flex items-center justify-between">
                                <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                                  <Wrench className="h-6 w-6" />
                                </div>
                                <Badge
                                  variant="secondary"
                                  className="bg-white text-gray-600"
                                >
                                  <DollarSign className="mr-0.5 h-3 w-3" />
                                  {service.price}
                                </Badge>
                              </div>
                            </div>

                            <div className="space-y-4 p-6">
                              <div>
                                <div className="flex items-start justify-between">
                                  <h3 className="font-semibold text-foreground">
                                    {service.name}
                                  </h3>
                                  <Badge
                                    variant="outline"
                                    className="border-gray-200 bg-gray-50 text-gray-600"
                                  >
                                    Inactive
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {service.category}
                                </p>
                              </div>

                              <p className="text-sm text-muted-foreground">
                                {service.description}
                              </p>

                              <div className="flex gap-2 pt-2">
                                <Button
                                  variant="outline"
                                  className="flex-1 bg-transparent"
                                >
                                  View Details
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
