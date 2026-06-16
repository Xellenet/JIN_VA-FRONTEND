"use client"

import { useState, useMemo } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  ChevronDown,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  ArrowUpDown,
  Calendar,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react"
import { mockUsers, mockOrders } from "@/lib/data/mock-data"

type SortField = "clientName" | "orderDate" | "serviceName" | "status" | "paymentStatus"
type SortDir = "asc" | "desc"

export default function OrdersPage() {
  const user = mockUsers[0]
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("orderDate")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const filtered = useMemo(() => {
    let result = [...mockOrders]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.clientName.toLowerCase().includes(q) ||
          o.artisanName.toLowerCase().includes(q) ||
          o.serviceName.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter)
    }

    if (paymentFilter !== "all") {
      result = result.filter((o) => o.paymentStatus === paymentFilter)
    }

    result.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const cmp = String(aVal).localeCompare(String(bVal))
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [search, statusFilter, paymentFilter, sortField, sortDir])

  const statusCounts = {
    all: mockOrders.length,
    pending: mockOrders.filter((o) => o.status === "pending").length,
    "in-progress": mockOrders.filter((o) => o.status === "in-progress").length,
    completed: mockOrders.filter((o) => o.status === "completed").length,
    cancelled: mockOrders.filter((o) => o.status === "cancelled").length,
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: "border-green-200 bg-green-50 text-green-700",
      "in-progress": "border-muted bg-muted text-muted-foreground",
      pending: "border-blue-200 bg-blue-50 text-blue-700",
      cancelled: "border-red-200 bg-red-50 text-red-700",
      available: "border-teal-200 bg-teal-50 text-teal-700",
    }
    return map[status] || "border-muted bg-muted text-muted-foreground"
  }

  const paymentBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: "border-green-200 bg-green-50 text-green-700",
      pending: "border-yellow-200 bg-yellow-50 text-yellow-700",
      refunded: "border-red-200 bg-red-50 text-red-700",
    }
    return map[status] || "border-muted bg-muted text-muted-foreground"
  }

  const SortHeader = ({ label, field }: { label: string; field: SortField }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-medium hover:text-foreground"
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  )

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { label: "All Orders", count: statusCounts.all, icon: ClipboardList, color: "text-foreground", filter: "all" },
            { label: "Pending", count: statusCounts.pending, icon: Clock, color: "text-blue-600", filter: "pending" },
            { label: "In Progress", count: statusCounts["in-progress"], icon: Calendar, color: "text-muted-foreground", filter: "in-progress" },
            { label: "Completed", count: statusCounts.completed, icon: CheckCircle2, color: "text-green-600", filter: "completed" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setStatusFilter(item.filter)}
              className="text-left"
            >
              <Card className={`cursor-pointer transition-shadow hover:shadow-md ${statusFilter === item.filter ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`rounded-lg bg-muted p-2.5 ${item.color}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="text-2xl font-bold">{item.count}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">Orders</CardTitle>
                <p className="text-sm text-muted-foreground">
                  View, manage, and track all customer orders
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and filters */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by client, artisan, or service..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {statusFilter === "all" ? "All Status" : statusFilter.replace("-", " ")}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["all", "pending", "in-progress", "completed", "cancelled"].map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)} className="capitalize">
                      {s === "all" ? "All Status" : s.replace("-", " ")}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {paymentFilter === "all" ? "All Payments" : paymentFilter}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["all", "paid", "pending", "refunded"].map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setPaymentFilter(s)} className="capitalize">
                      {s === "all" ? "All Payments" : s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3"><SortHeader label="Client" field="clientName" /></th>
                    <th className="pb-3"><SortHeader label="Service" field="serviceName" /></th>
                    <th className="pb-3"><SortHeader label="Order Date" field="orderDate" /></th>
                    <th className="pb-3">Assigned Artisan</th>
                    <th className="pb-3"><SortHeader label="Status" field="status" /></th>
                    <th className="pb-3"><SortHeader label="Payment" field="paymentStatus" /></th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <XCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />
                        No orders found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    filtered.map((order) => (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={order.clientAvatar || "/placeholder.svg"} />
                              <AvatarFallback>{order.clientName.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{order.clientName}</span>
                          </div>
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">{order.serviceName}</td>
                        <td className="py-4 text-sm text-muted-foreground">{order.orderDate}</td>
                        <td className="py-4 text-sm text-muted-foreground">{order.artisanName}</td>
                        <td className="py-4">
                          <Badge variant="outline" className={statusBadge(order.status)}>
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                            <span className="capitalize">{order.status.replace("-", " ")}</span>
                          </Badge>
                        </td>
                        <td className="py-4">
                          <Badge variant="outline" className={paymentBadge(order.paymentStatus)}>
                            <span className="capitalize">{order.paymentStatus}</span>
                          </Badge>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Assign Artisan</DropdownMenuItem>
                                <DropdownMenuItem>Update Status</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Cancel Order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>Showing {filtered.length} of {mockOrders.length} orders</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
