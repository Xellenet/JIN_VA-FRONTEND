import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Clock, CheckCircle, Search } from "lucide-react"
import { mockOrders } from "@/lib/data/mock-data"

export default function UserDashboard() {
  const user = {
    id: "u1",
    name: "Sarah Williams",
    email: "sarah@example.com",
    role: "user" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  }

  const myBookings = mockOrders.slice(0, 4)

  const statusConfig: Record<string, { label: string; className: string }> = {
    "in-progress": { label: "In Progress", className: "bg-muted text-muted-foreground border-muted" },
    completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
    cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    available: { label: "Available", className: "bg-blue-100 text-blue-700 border-blue-200" },
  }

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
                  <p className="text-sm text-muted-foreground">Pending Bookings</p>
                  <p className="text-2xl font-bold text-foreground">{myBookings.filter((b) => b.status === "pending").length}</p>
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
                  <p className="text-2xl font-bold text-foreground">{myBookings.filter((b) => b.status === "in-progress").length}</p>
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
                  <p className="text-2xl font-bold text-foreground">{myBookings.filter((b) => b.status === "completed").length}</p>
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
            <div className="space-y-4">
              {myBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={booking.clientAvatar || "/placeholder.svg"} />
                      <AvatarFallback>{booking.artisanName.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground">{booking.serviceName}</h3>
                      <p className="text-sm text-muted-foreground">Artisan: {booking.artisanName}</p>
                      <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {booking.orderDate}
                        </div>
                        {booking.deadline && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Due: {booking.deadline}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={statusConfig[booking.status]?.className || ""}>
                      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                      {statusConfig[booking.status]?.label || booking.status}
                    </Badge>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/user/bookings/${booking.id}`}>View Details</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
