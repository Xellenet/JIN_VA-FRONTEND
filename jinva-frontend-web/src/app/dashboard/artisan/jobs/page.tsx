"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Calendar,
  Clock,
  Search,
  ChevronDown,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Timer,
} from "lucide-react"
import { mockOrders, mockArtisans } from "@/lib/data/mock-data"

const statusConfig = {
  "in-progress": {
    label: "In Progress",
    className: "bg-muted text-muted-foreground border-muted",
    icon: Timer,
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: AlertCircle,
  },
  available: {
    label: "Available",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    icon: CheckCircle2,
  },
}

type StatusFilter = "all" | "in-progress" | "completed" | "cancelled" | "pending"

export default function ArtisanJobsPage() {
  const user = {
    ...mockArtisans[0],
    role: "artisan" as const,
  }

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  const myJobs = mockOrders.filter((order) => order.artisanId === user.id)

  const filteredJobs = myJobs.filter((job) => {
    const matchesSearch =
      searchQuery === "" ||
      job.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.serviceName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const jobCounts = {
    all: myJobs.length,
    "in-progress": myJobs.filter((j) => j.status === "in-progress").length,
    completed: myJobs.filter((j) => j.status === "completed").length,
    pending: myJobs.filter((j) => j.status === "pending").length,
    cancelled: myJobs.filter((j) => j.status === "cancelled").length,
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>
          <p className="text-muted-foreground">
            View and manage all your assigned jobs
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card
            className={`cursor-pointer transition-shadow hover:shadow-md ${statusFilter === "all" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Jobs</p>
              <p className="text-2xl font-bold text-foreground">{jobCounts.all}</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-shadow hover:shadow-md ${statusFilter === "in-progress" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter("in-progress")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{jobCounts["in-progress"]}</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-shadow hover:shadow-md ${statusFilter === "completed" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter("completed")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{jobCounts.completed}</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-shadow hover:shadow-md ${statusFilter === "pending" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter("pending")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{jobCounts.pending}</p>
            </CardContent>
          </Card>
        </div>

        {/* Jobs List */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by client or service..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative">
                <Button
                  variant="outline"
                  className="gap-2 bg-transparent"
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                >
                  {statusFilter === "all" ? "All Status" : statusConfig[statusFilter as keyof typeof statusConfig]?.label}
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {showStatusDropdown && (
                  <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border bg-card py-1 shadow-lg">
                    {(["all", "in-progress", "completed", "pending", "cancelled"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                        onClick={() => {
                          setStatusFilter(status)
                          setShowStatusDropdown(false)
                        }}
                      >
                        {status === "all" ? "All Status" : statusConfig[status].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="outline" className="gap-2 bg-transparent">
                Date Range
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">No jobs found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredJobs.map((job) => {
                  const StatusIcon = statusConfig[job.status].icon
                  return (
                    <div
                      key={job.id}
                      className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-14 w-14">
                            <AvatarImage
                              src={job.clientAvatar || "/placeholder.svg"}
                              alt={job.clientName}
                            />
                            <AvatarFallback>
                              {job.clientName.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {job.serviceName}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Job ID: #{job.id}
                              </p>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage
                                    src={job.clientAvatar || "/placeholder.svg"}
                                    alt={job.clientName}
                                  />
                                  <AvatarFallback>
                                    {job.clientName.substring(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <span>Client: {job.clientName}</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                {job.orderDate}
                              </div>
                              {job.deadline && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  Due: {job.deadline}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 md:items-end">
                          <Badge
                            variant="outline"
                            className={statusConfig[job.status].className}
                          >
                            <StatusIcon className="mr-1.5 h-3 w-3" />
                            {statusConfig[job.status].label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              job.paymentStatus === "paid"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : job.paymentStatus === "pending"
                                  ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                                  : "border-red-200 bg-red-50 text-red-700"
                            }
                          >
                            Payment:{" "}
                            {job.paymentStatus === "paid"
                              ? "Paid"
                              : job.paymentStatus === "pending"
                                ? "Pending"
                                : "Refunded"}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                        <Button variant="outline" size="sm" className="bg-transparent">
                          View Details
                        </Button>
                        <Button variant="outline" size="sm" className="bg-transparent">
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Contact Client
                        </Button>
                        {job.status === "in-progress" && (
                          <Button
                            size="sm"
                            className="bg-green-600 text-white hover:bg-green-700"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Mark Complete
                          </Button>
                        )}
                        {job.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              Accept Job
                            </Button>
                            <Button size="sm" variant="destructive">
                              Decline
                            </Button>
                          </>
                        )}
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
