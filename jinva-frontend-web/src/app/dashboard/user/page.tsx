"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Clock, CheckCircle, Search, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

interface BackendJob {
  id: string
  title: string
  service?: { id: string; name: string }
  status: string
  createdAt: string
  acceptedArtisan?: { id: string; firstname: string; lastname: string; profilePicture?: string }
}

const statusConfig: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: "In Progress", className: "bg-muted text-muted-foreground border-muted" },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  OPEN: { label: "Open", className: "bg-blue-100 text-blue-700 border-blue-200" },
  EXPIRED: { label: "Expired", className: "bg-gray-100 text-gray-600 border-gray-200" },
}

export default function UserDashboard() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<BackendJob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiFetch<BackendJob[] | { items?: BackendJob[] }>("/jobs/mine")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setJobs(items.slice(0, 4))
      })
      .catch(() => setJobs([]))
      .finally(() => setIsLoading(false))
  }, [])

  if (!user) return null

  const pending = jobs.filter((j) => j.status === "OPEN").length
  const active = jobs.filter((j) => j.status === "IN_PROGRESS" || j.status === "PENDING").length
  const completed = jobs.filter((j) => j.status === "COMPLETED").length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex items-center justify-between rounded-lg bg-card p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar || "/placeholder.svg"} />
              <AvatarFallback>{user.name.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Welcome back, {user.name}!</h1>
              <p className="text-muted-foreground">Find trusted artisans and manage your bookings</p>
            </div>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <Link href="/dashboard/user/search">
              <Search className="mr-2 h-4 w-4" />
              Find Artisans
            </Link>
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-muted p-3">
                  <Clock className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Open Bookings</p>
                  <p className="text-2xl font-bold text-foreground">{pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-3">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Jobs</p>
                  <p className="text-2xl font-bold text-foreground">{active}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-foreground">{completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Bookings */}
        <Card>
          <div className="border-b p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">My Bookings</h2>
                <p className="text-sm text-muted-foreground">Track your service requests and appointments</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/dashboard/user/bookings">View All</Link>
              </Button>
            </div>
          </div>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-muted-foreground">No bookings yet.</p>
                <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                  <Link href="/dashboard/user/search">Book an Artisan</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => {
                  const artisanName = job.acceptedArtisan
                    ? `${job.acceptedArtisan.firstname} ${job.acceptedArtisan.lastname}`.trim()
                    : "Awaiting artisan"
                  const cfg = statusConfig[job.status] ?? { label: job.status, className: "" }
                  return (
                    <div
                      key={job.id}
                      className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={job.acceptedArtisan?.profilePicture || "/placeholder.svg"} />
                          <AvatarFallback>{artisanName.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground">{job.title}</h3>
                          <p className="text-sm text-muted-foreground">{job.service?.name}</p>
                          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {new Date(job.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cfg.className}>
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                          {cfg.label}
                        </Badge>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/dashboard/user/bookings/${job.id}`}>View Details</Link>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
