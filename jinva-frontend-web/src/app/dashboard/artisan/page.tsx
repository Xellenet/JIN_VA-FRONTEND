import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, Calendar, DollarSign, Briefcase } from "lucide-react"
import { mockArtisans, mockOrders } from "@/lib/data/mock-data"

export default function ArtisanDashboard() {
  const user = {
    ...mockArtisans[0],
    role: "artisan" as const,
  }

  const myJobs = mockOrders.filter((order) => order.artisanId === user.id)

  const statusConfig = {
    "in-progress": { label: "In Progress", className: "bg-muted text-muted-foreground border-muted" },
    completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
    cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    available: { label: "Available", className: "bg-blue-100 text-blue-700 border-blue-200" },
  }

  const paymentStatusConfig = {
    paid: { label: "Paid", className: "border-green-200 bg-green-50 text-green-700" },
    pending: { label: "Pending", className: "border-yellow-200 bg-yellow-50 text-yellow-700" },
    refunded: { label: "Refunded", className: "border-red-200 bg-red-50 text-red-700" },
  } as const

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex items-center justify-between rounded-lg bg-card p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar || "/placeholder.svg"} />
              <AvatarFallback>{user.name.substring(0, 2)}</AvatarFallback>
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
                  <p className="text-2xl font-bold">{user.jobsCompleted}</p>
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
                  <p className="text-2xl font-bold">{user.avgRating}</p>
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
                  <p className="text-2xl font-bold">{myJobs.filter((j) => j.status === "in-progress").length}</p>
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
                  <p className="text-2xl font-bold">{user.reviews}</p>
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
                <h2 className="text-xl font-semibold">My Current Jobs</h2>
                <p className="text-sm text-muted-foreground">Track and manage your assigned jobs</p>
              </div>
              <Button variant="outline">View All</Button>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium">Service</th>
                    <th className="pb-3 font-medium">Order Date</th>
                    <th className="pb-3 font-medium">Deadline</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {myJobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0">
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={job.clientAvatar || "/placeholder.svg"} />
                            <AvatarFallback>{job.clientName.substring(0, 2)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{job.clientName}</span>
                        </div>
                      </td>
                      <td className="py-4 text-sm">{job.serviceName}</td>
                      <td className="py-4 text-sm">{job.orderDate}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {job.deadline}
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant="outline" className={statusConfig[job.status].className}>
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"></span>
                          {statusConfig[job.status].label}
                        </Badge>
                      </td>
                      <td className="py-4">
                        {(() => {
                          const paymentBadge = paymentStatusConfig[job.paymentStatus]

                          return (
                        <Badge
                          variant="outline"
                          className={paymentBadge.className}
                        >
                          {paymentBadge.label}
                        </Badge>
                          )
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
