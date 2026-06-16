"use client"

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
} from "recharts"
import {
  DollarSign,
  Download,
  CheckCircle2,
  Clock,
  Star,
  TrendingUp,
  Briefcase,
  Calendar,
  FileText,
} from "lucide-react"
import { mockArtisans, mockOrders } from "@/lib/data/mock-data"

const monthlyEarnings = [
  { month: "Jul", earnings: 1800 },
  { month: "Aug", earnings: 2400 },
  { month: "Sep", earnings: 2100 },
  { month: "Oct", earnings: 1950 },
  { month: "Nov", earnings: 2800 },
  { month: "Dec", earnings: 3200 },
]

const weeklyJobs = [
  { week: "W1", completed: 5, assigned: 7 },
  { week: "W2", completed: 6, assigned: 8 },
  { week: "W3", completed: 4, assigned: 6 },
  { week: "W4", completed: 7, assigned: 9 },
]

const ratingHistory = [
  { month: "Jul", rating: 4.6 },
  { month: "Aug", rating: 4.7 },
  { month: "Sep", rating: 4.7 },
  { month: "Oct", rating: 4.8 },
  { month: "Nov", rating: 4.8 },
  { month: "Dec", rating: 4.9 },
]

export default function ArtisanReportPage() {
  const artisan = mockArtisans[0]
  const user = { ...artisan, role: "artisan" as const }

  const myJobs = mockOrders.filter((o) => o.artisanId === artisan.id)
  const completedJobs = myJobs.filter((j) => j.status === "completed").length
  const activeJobs = myJobs.filter((j) => j.status === "in-progress").length
  const totalEarnings = monthlyEarnings.reduce((sum, m) => sum + m.earnings, 0)

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Performance Reports</h1>
            <p className="text-muted-foreground">
              Track your earnings, job completion, and ratings over time
            </p>
          </div>
          <Button variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold">${totalEarnings.toLocaleString()}</p>
                  <div className="mt-1 flex items-center gap-1 text-sm text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>+14% vs last period</span>
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
                  <p className="text-sm text-muted-foreground">Jobs Completed</p>
                  <p className="text-2xl font-bold">{artisan.jobsCompleted}</p>
                  <div className="mt-1 flex items-center gap-1 text-sm text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>+8 this month</span>
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
                  <p className="text-sm text-muted-foreground">Active Jobs</p>
                  <p className="text-2xl font-bold">{activeJobs}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                  <p className="text-2xl font-bold">{artisan.avgRating}</p>
                  <div className="mt-1 flex items-center gap-1 text-sm text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>{artisan.reviews} reviews</span>
                  </div>
                </div>
                <div className="rounded-lg bg-yellow-50 p-3">
                  <Star className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Earnings Chart + Rating Trend */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Monthly Earnings</CardTitle>
                <Badge variant="outline" className="border-foreground/20">Last 6 months</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyEarnings}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-xs" />
                  <YAxis axisLine={false} tickLine={false} className="text-xs" tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Earnings"]}
                  />
                  <Bar dataKey="earnings" fill="#1e4035" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rating Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={ratingHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-xs" />
                  <YAxis domain={[4.0, 5.0]} axisLine={false} tickLine={false} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                    formatter={(value: number) => [value.toFixed(1), "Rating"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="#eab308"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#eab308" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Job Completion + Job History */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Weekly Job Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeklyJobs}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} className="text-xs" />
                  <YAxis axisLine={false} tickLine={false} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                  <Bar dataKey="assigned" fill="#d1d5db" radius={[4, 4, 0, 0]} name="Assigned" />
                  <Bar dataKey="completed" fill="#1e4035" radius={[4, 4, 0, 0]} name="Completed" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#d1d5db" }} />
                  <span className="text-muted-foreground">Assigned</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Completed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Completion Rate</p>
                    <p className="text-sm text-green-600">Jobs completed on time</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-green-700">92%</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Avg. Response Time</p>
                    <p className="text-sm text-muted-foreground">Time to accept new jobs</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-foreground">1.2h</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-yellow-50 p-4">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">Client Satisfaction</p>
                    <p className="text-sm text-yellow-600">Based on review feedback</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-yellow-700">96%</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-800">Avg. Jobs per Week</p>
                    <p className="text-sm text-blue-600">Weekly average this quarter</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-blue-700">5.5</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Jobs Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Job History</CardTitle>
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
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium">Service</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {myJobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={job.clientAvatar || "/placeholder.svg"} />
                            <AvatarFallback>{job.clientName.substring(0, 2)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{job.clientName}</span>
                        </div>
                      </td>
                      <td className="py-4 text-sm">{job.serviceName}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {job.orderDate}
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant="outline" className={statusConfig[job.status]?.className}>
                          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                          {statusConfig[job.status]?.label}
                        </Badge>
                      </td>
                      <td className="py-4">
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
                          {job.paymentStatus.charAt(0).toUpperCase() + job.paymentStatus.slice(1)}
                        </Badge>
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
