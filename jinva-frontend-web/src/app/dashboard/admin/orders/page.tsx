"use client"

import { useState, useEffect, useMemo } from "react"
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
  ArrowUpDown,
  Calendar,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  UserRound,
  Loader2,
} from "lucide-react"
import { naviiAvatar } from "@/lib/utils"
import { apiFetch } from "@/lib/api"

interface BackendJob {
  id: string
  title: string
  status: string
  createdAt: string
  customer?: { id: string; firstname: string; lastname: string; profilePicture?: string }
  acceptedArtisan?: { id: string; firstname: string; lastname: string; profilePicture?: string }
  service?: { id: string; name: string }
}

interface MappedOrder {
  id: string
  clientName: string
  clientAvatar?: string
  artisanName: string
  serviceName: string
  orderDate: string
  status: string
}

function mapStatus(s: string): string {
  const map: Record<string, string> = {
    PENDING: "pending",
    IN_PROGRESS: "in-progress",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  }
  return map[s] ?? s.toLowerCase()
}

function mapJob(j: BackendJob): MappedOrder {
  return {
    id: j.id,
    clientName: j.customer ? `${j.customer.firstname} ${j.customer.lastname}`.trim() : "Unknown",
    clientAvatar: j.customer?.profilePicture,
    artisanName: j.acceptedArtisan
      ? `${j.acceptedArtisan.firstname} ${j.acceptedArtisan.lastname}`.trim()
      : "Unassigned",
    serviceName: j.service?.name ?? j.title,
    orderDate: new Date(j.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    status: mapStatus(j.status),
  }
}

type SortField = "clientName" | "orderDate" | "serviceName" | "status"
type SortDir = "asc" | "desc"

export default function OrdersPage() {
  const [orders, setOrders] = useState<MappedOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortField, setSortField] = useState<SortField>("orderDate")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  useEffect(() => {
    // `/jobs` caps `limit` at 50 (400 above it), so 100 returned nothing at all.
    apiFetch<BackendJob[] | { items: BackendJob[] }>("/jobs?page=1&limit=50")
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: BackendJob[] }).items ?? []
        setOrders(items.map(mapJob))
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  const filtered = useMemo(() => {
    let result = [...orders]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.clientName.toLowerCase().includes(q) ||
          o.artisanName.toLowerCase().includes(q) ||
          o.serviceName.toLowerCase().includes(q),
      )
    }
    if (statusFilter !== "all") result = result.filter((o) => o.status === statusFilter)
    result.sort((a, b) => {
      const cmp = String(a[sortField]).localeCompare(String(b[sortField]))
      return sortDir === "asc" ? cmp : -cmp
    })
    return result
  }, [orders, search, statusFilter, sortField, sortDir])

  const statusCounts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    "in-progress": orders.filter((o) => o.status === "in-progress").length,
    completed: orders.filter((o) => o.status === "completed").length,
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: "border-primary/30 bg-primary/5 text-primary",
      "in-progress": "border-border bg-muted text-muted-foreground",
      pending: "border-blue-200 bg-blue-50 text-blue-700",
      cancelled: "border-destructive/30 bg-destructive/5 text-destructive",
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
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { label: "All Jobs", count: statusCounts.all, icon: ClipboardList, filter: "all" },
            { label: "Pending", count: statusCounts.pending, icon: Clock, filter: "pending" },
            { label: "In Progress", count: statusCounts["in-progress"], icon: Calendar, filter: "in-progress" },
            { label: "Completed", count: statusCounts.completed, icon: CheckCircle2, filter: "completed" },
          ].map((item) => (
            <button key={item.label} type="button" onClick={() => setStatusFilter(item.filter)} className="text-left">
              <Card className={`cursor-pointer transition-shadow hover:shadow-md ${statusFilter === item.filter ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-muted p-2.5 text-foreground">
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
                <CardTitle className="text-2xl font-bold">Jobs</CardTitle>
                <p className="text-sm text-muted-foreground">View, manage, and track all platform jobs</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-3"><SortHeader label="Client" field="clientName" /></th>
                        <th className="pb-3"><SortHeader label="Service" field="serviceName" /></th>
                        <th className="pb-3"><SortHeader label="Date" field="orderDate" /></th>
                        <th className="pb-3">Assigned Artisan</th>
                        <th className="pb-3"><SortHeader label="Status" field="status" /></th>
                        <th className="pb-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-muted-foreground">
                            <XCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />
                            No jobs found matching your criteria
                          </td>
                        </tr>
                      ) : (
                        filtered.map((order) => (
                          <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={order.clientAvatar || naviiAvatar(order.clientName)} />
                                  <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
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
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Eye className="h-4 w-4" />
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
                <div className="mt-4 text-sm text-muted-foreground">
                  Showing {filtered.length} of {orders.length} jobs
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
