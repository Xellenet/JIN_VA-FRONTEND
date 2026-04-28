import { DashboardLayout } from "@/components/dashboard/layout"
import { StatsCard } from "@/components/dashboard/admin/stats-card"
import { RevenueChart } from "@/components/dashboard/admin/revenue-chart"
import { RecentActivities } from "@/components/dashboard/admin/recent-activities"
import { TopPlumbers } from "@/components/dashboard/admin/top-plumbers"
import { OngoingJobs } from "@/components/dashboard/admin/ongoing-jobs"
import { Users, Clock, CheckCircle2, XCircle } from "lucide-react"
import { mockUsers, mockActivities, mockPlumbers, mockOrders } from "@/lib/data/mock-data"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function AdminDashboard() {
  const user = mockUsers[0]

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col items-start gap-3 rounded-lg bg-card p-4 sm:flex-row sm:items-center sm:p-6">
          <Avatar className="h-12 w-12">
            <AvatarImage src="/placeholder.svg" />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl text-balance">Welcome to PlumHub</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Manage your clients, orders, services, and products all in one place.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            icon={<Users className="h-5 w-5 text-muted-foreground" />}
            title="Total Active Clients"
            value="35"
            subtitle="Currently receiving our services"
            trend={5}
            trendLabel="+5%"
          />
          <StatsCard
            icon={<Clock className="h-5 w-5 text-muted-foreground" />}
            title="Pending Orders"
            value="12"
            subtitle="Orders waiting for action"
            trend={2}
            trendLabel="+2"
          />
          <StatsCard
            icon={<CheckCircle2 className="h-5 w-5 text-muted-foreground" />}
            title="Completed Jobs"
            value="87"
            subtitle="Successfully finished this month"
            trend={18}
            trendLabel="+18%"
          />
          <StatsCard
            icon={<XCircle className="h-5 w-5 text-muted-foreground" />}
            title="Cancellations"
            value="05"
            subtitle="Cancelled by clients this week"
            trend={-2}
            trendLabel="-2"
          />
        </div>

        {/* Revenue Chart and Recent Activities */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <RevenueChart />
          <RecentActivities activities={mockActivities} />
        </div>

        {/* Bottom Section */}
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <TopPlumbers plumbers={mockPlumbers} />
          <OngoingJobs jobs={mockOrders} />
        </div>
      </div>
    </DashboardLayout>
  )
}
