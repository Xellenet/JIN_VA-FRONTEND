"use client"

import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Bar,
  BarChart,
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
  XCircle,
  Calendar,
  FileText,
  Star,
  UserRound,
} from "lucide-react"
import { mockOrders } from "@/lib/data/mock-data"
import { naviiAvatar } from "@/lib/utils"

const monthlySpending = [
  { month: "Jul", amount: 120 },
  { month: "Aug", amount: 250 },
  { month: "Sep", amount: 180 },
  { month: "Oct", amount: 90 },
  { month: "Nov", amount: 320 },
  { month: "Dec", amount: 150 },
]

export default function UserReportPage() {
  const myBookings = mockOrders.slice(0, 6)
  const completed = myBookings.filter((b) => b.status === "completed").length
  const inProgress = myBookings.filter((b) => b.status === "in-progress").length
  const cancelled = myBookings.filter((b) => b.status === "cancelled").length
  const totalSpent = monthlySpending.reduce((sum, m) => sum + m.amount, 0)

  const statusConfig: Record<string, { label: string; className: string }> = {
    "in-progress": { label: "In Progress", className: "bg-muted text-muted-foreground border-muted" },
    completed: { label: "Completed", className: "bg-success/10 text-success border-success/20" },
    cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
    pending: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
    available: { label: "Available", className: "bg-info/10 text-info border-info/20" },
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Reports</h1>
            <p className="text-muted-foreground">
              Track your booking history, spending, and service usage
            </p>
          </div>
          <Button variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export History
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">GH₵ {totalSpent}</p>
                </div>
                <div className="rounded-lg bg-success/10 p-3">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completed}</p>
                </div>
                <div className="rounded-lg bg-success/10 p-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{inProgress}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <Clock className="h-5 w-5 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cancelled</p>
                  <p className="text-2xl font-bold">{cancelled}</p>
                </div>
                <div className="rounded-lg bg-destructive/10 p-3">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Spending Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Monthly Spending</CardTitle>
              <Badge variant="outline" className="border-foreground/20">Last 6 months</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlySpending}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-xs" />
                <YAxis axisLine={false} tickLine={false} className="text-xs" tickFormatter={(v) => `GH₵ ${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  formatter={(value: number) => [`GH₵ ${value}`, "Spent"]}
                />
                <Bar dataKey="amount" fill="var(--brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Booking History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Booking History</CardTitle>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <FileText className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Service</th>
                    <th className="pb-3 font-medium">Artisan</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Payment</th>
                    <th className="pb-3 font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {myBookings.map((booking) => (
                    <tr key={booking.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-4">
                        <span className="font-medium">{booking.serviceName}</span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={naviiAvatar(booking.artisanName)} />
                            <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{booking.artisanName}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {booking.orderDate}
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant="outline" className={statusConfig[booking.status]?.className}>
                          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                          {statusConfig[booking.status]?.label}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <Badge
                          variant="outline"
                          className={
                            booking.paymentStatus === "paid"
                              ? "border-success/20 bg-success/10 text-success"
                              : booking.paymentStatus === "pending"
                                ? "border-warning/20 bg-warning/10 text-warning"
                                : "border-destructive/20 bg-destructive/10 text-destructive"
                          }
                        >
                          {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-4">
                        {booking.status === "completed" ? (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-rating text-rating" />
                            <span className="text-sm font-medium">4.8</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">--</span>
                        )}
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
