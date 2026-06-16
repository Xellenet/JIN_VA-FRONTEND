"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import {
  DollarSign,
  Users,
  Briefcase,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
} from "lucide-react"
import { mockOrders, mockArtisans, mockClients } from "@/lib/data/mock-data"

const revenueData = [
  { month: "Jan", revenue: 12400, orders: 18 },
  { month: "Feb", revenue: 15200, orders: 22 },
  { month: "Mar", revenue: 18900, orders: 28 },
  { month: "Apr", revenue: 14300, orders: 20 },
  { month: "May", revenue: 17800, orders: 25 },
  { month: "Jun", revenue: 13600, orders: 19 },
  { month: "Jul", revenue: 19200, orders: 27 },
  { month: "Aug", revenue: 24500, orders: 35 },
  { month: "Sep", revenue: 21800, orders: 31 },
  { month: "Oct", revenue: 20100, orders: 29 },
  { month: "Nov", revenue: 23400, orders: 33 },
  { month: "Dec", revenue: 26800, orders: 38 },
]

const serviceBreakdown = [
  { name: "Emergency Repairs", value: 35, color: "#171717" },
  { name: "Installation", value: 28, color: "#eab308" },
  { name: "Maintenance", value: 22, color: "#6b7280" },
  { name: "Inspection", value: 15, color: "#d1d5db" },
]

const weeklyOrders = [
  { day: "Mon", count: 8 },
  { day: "Tue", count: 12 },
  { day: "Wed", count: 10 },
  { day: "Thu", count: 14 },
  { day: "Fri", count: 11 },
  { day: "Sat", count: 6 },
  { day: "Sun", count: 3 },
]

export default function AdminReportPage() {
  const [period, setPeriod] = useState("monthly")

  const completedOrders = mockOrders.filter((o) => o.status === "completed").length
  const inProgressOrders = mockOrders.filter((o) => o.status === "in-progress").length
  const cancelledOrders = mockOrders.filter((o) => o.status === "cancelled").length
  const pendingOrders = mockOrders.filter((o) => o.status === "pending").length
  const totalRevenue = revenueData.reduce((sum, m) => sum + m.revenue, 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive overview of platform performance and metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border bg-muted p-1">
              {["weekly", "monthly", "yearly"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    period === p
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">
                    ${(totalRevenue / 1000).toFixed(1)}k
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-sm text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>+12.5% vs last period</span>
                  </div>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{mockOrders.length}</p>
                  <div className="mt-1 flex items-center gap-1 text-sm text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>+8 new this week</span>
                  </div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <Briefcase className="h-5 w-5 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Clients</p>
                  <p className="text-2xl font-bold">
                    {mockClients.filter((c) => c.status === "active").length}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-sm text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>+3 this month</span>
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cancellation Rate</p>
                  <p className="text-2xl font-bold">
                    {((cancelledOrders / mockOrders.length) * 100).toFixed(1)}%
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span>-2% improvement</span>
                  </div>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart + Order Status */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Revenue Overview</CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-muted0" />
                    <span className="text-muted-foreground">Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#d1d5db" }} />
                    <span className="text-muted-foreground">Orders</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-xs" />
                  <YAxis axisLine={false} tickLine={false} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                    formatter={(value: number, name: string) => [
                      name === "revenue" ? `$${value.toLocaleString()}` : value,
                      name === "revenue" ? "Revenue" : "Orders",
                    ]}
                  />
                  <Bar dataKey="revenue" fill="#171717" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={serviceBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {serviceBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                      formatter={(value: number) => [`${value}%`, "Share"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-3">
                {serviceBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Status Cards + Weekly Trend */}
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Completed</span>
                </div>
                <span className="text-xl font-bold text-green-700">{completedOrders}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-foreground" />
                  <span className="font-medium text-muted-foreground">In Progress</span>
                </div>
                <span className="text-xl font-bold text-muted-foreground">{inProgressOrders}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-yellow-50 p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Pending</span>
                </div>
                <span className="text-xl font-bold text-yellow-700">{pendingOrders}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-50 p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">Cancelled</span>
                </div>
                <span className="text-xl font-bold text-red-700">{cancelledOrders}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Weekly Order Trend</CardTitle>
                <Badge variant="outline" className="border-foreground/20">This Week</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={weeklyOrders}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} className="text-xs" />
                  <YAxis axisLine={false} tickLine={false} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#171717"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#171717" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Artisans Performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Artisan Performance</CardTitle>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <FileText className="h-4 w-4" />
                Download Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Artisan</th>
                    <th className="pb-3 font-medium">Specialization</th>
                    <th className="pb-3 font-medium">Jobs Completed</th>
                    <th className="pb-3 font-medium">Avg. Rating</th>
                    <th className="pb-3 font-medium">Reviews</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {mockArtisans.map((artisan) => {
                    const perf = artisan.avgRating >= 4.9 ? "Excellent" : artisan.avgRating >= 4.5 ? "Good" : "Average"
                    const perfColor = perf === "Excellent" ? "text-green-600 bg-green-50 border-green-200" : perf === "Good" ? "text-foreground bg-muted border-muted" : "text-yellow-600 bg-yellow-50 border-yellow-200"
                    return (
                      <tr key={artisan.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={artisan.avatar || "/placeholder.svg"} />
                              <AvatarFallback>{artisan.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{artisan.name}</p>
                              <p className="text-xs text-muted-foreground">{artisan.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-sm">{artisan.specialization}</td>
                        <td className="py-4 text-sm font-semibold">{artisan.jobsCompleted}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-1 text-sm">
                            <span className="font-semibold text-foreground">{artisan.avgRating}</span>
                            <span className="text-muted-foreground">/ 5</span>
                          </div>
                        </td>
                        <td className="py-4 text-sm">{artisan.reviews}</td>
                        <td className="py-4">
                          <Badge
                            variant="outline"
                            className={
                              artisan.availability === "available"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-red-200 bg-red-50 text-red-700"
                            }
                          >
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                            {artisan.availability === "available" ? "Available" : "Busy"}
                          </Badge>
                        </td>
                        <td className="py-4">
                          <Badge variant="outline" className={perfColor}>
                            <ArrowUpRight className="mr-1 h-3 w-3" />
                            {perf}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
