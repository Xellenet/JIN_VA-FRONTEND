"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, Calendar, DollarSign, Briefcase, Loader2, UserRound } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { naviiAvatar } from "@/lib/utils"

interface BackendJob {
  id: string
  title: string
  description?: string
  location?: string
  status: string
  createdAt: string
  customer?: { id: string; firstname: string; lastname: string; profilePicture?: string }
  service?: { id: string; name: string }
}

const statusConfig = {
  IN_PROGRESS: { label: "In Progress", className: "bg-muted text-muted-foreground border-muted" },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  OPEN: { label: "Open", className: "bg-blue-100 text-blue-700 border-blue-200" },
} as const

export default function ArtisanDashboard() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<BackendJob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiFetch<BackendJob[] | { items?: BackendJob[] }>("/jobs")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setJobs(items)
      })
      .catch(() => setJobs([]))
      .finally(() => setIsLoading(false))
  }, [])

  if (!user) return null

  const activeJobs = jobs.filter((j) => j.status === "IN_PROGRESS")
  const completedJobs = jobs.filter((j) => j.status === "COMPLETED")

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex items-center justify-between rounded-lg bg-card p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar} />
              <AvatarFallback><UserRound className="h-6 w-6" /></AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">Welcome back, {user.name}!</h1>
              <p className="text-muted-foreground">Here's your job overview and upcoming appointments</p>
            </div>
          </div>
          <Button className="bg-primary hover:bg-primary/90">View All Jobs</Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-muted p-3">
                  <Briefcase className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jobs Completed</p>
                  <p className="text-2xl font-bold">{completedJobs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-yellow-100 p-3">
                  <Star className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                  <p className="text-2xl font-bold">{user.rating?.toFixed(1) ?? "—"}</p>
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
                  <p className="text-2xl font-bold">{activeJobs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-100 p-3">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Reviews</p>
                  <p className="text-2xl font-bold">{user.reviews ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Jobs */}
        <Card>
          <div className="border-b p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Available Jobs</h2>
                <p className="text-sm text-muted-foreground">Browse and apply for open jobs near you</p>
              </div>
              <Button variant="outline">View All</Button>
            </div>
          </div>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No jobs available right now.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Client</th>
                      <th className="pb-3 font-medium">Service</th>
                      <th className="pb-3 font-medium">Posted</th>
                      <th className="pb-3 font-medium">Location</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.slice(0, 8).map((job) => {
                      const clientName = job.customer
                        ? `${job.customer.firstname} ${job.customer.lastname}`.trim()
                        : "Unknown"
                      const cfg = statusConfig[job.status as keyof typeof statusConfig] ?? {
                        label: job.status,
                        className: "",
                      }
                      return (
                        <tr key={job.id} className="border-b last:border-0">
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={job.customer?.profilePicture || naviiAvatar(clientName)} />
                                <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{clientName}</span>
                            </div>
                          </td>
                          <td className="py-4 text-sm">{job.service?.name ?? job.title}</td>
                          <td className="py-4 text-sm">{new Date(job.createdAt).toLocaleDateString()}</td>
                          <td className="py-4 text-sm text-muted-foreground">{job.location ?? "—"}</td>
                          <td className="py-4">
                            <Badge variant="outline" className={cfg.className}>
                              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                              {cfg.label}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
