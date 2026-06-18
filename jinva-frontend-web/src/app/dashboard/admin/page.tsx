import { DashboardLayout } from "@/components/dashboard/layout"
import { StatsCard } from "@/components/dashboard/admin/stats-card"
import { RevenueChart } from "@/components/dashboard/admin/revenue-chart"
import { RecentActivities } from "@/components/dashboard/admin/recent-activities"
import { TopArtisans } from "@/components/dashboard/admin/top-artisans"
import { OngoingJobs } from "@/components/dashboard/admin/ongoing-jobs"
import { Users, Clock, CheckCircle2, XCircle } from "lucide-react"
import { mockActivities, mockArtisans, mockOrders } from "@/lib/data/mock-data"

export default function AdminDashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Admin Dashboard
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-foreground">Platform Overview</h1>
          <p className="text-sm text-muted-foreground">
            Manage clients, artisans, orders, and platform health in one place.
          </p>
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
          <TopArtisans artisans={mockArtisans} />
          <OngoingJobs jobs={mockOrders} />
        </div>
      </div>
    </DashboardLayout>
  )
}
