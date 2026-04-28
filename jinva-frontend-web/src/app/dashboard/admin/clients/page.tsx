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
  Plus,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  ArrowUpDown,
  Users,
  UserCheck,
  UserX,
  Mail,
  Phone,
} from "lucide-react"
import { mockUsers, mockClients } from "@/lib/data/mock-data"

type SortField = "name" | "email" | "totalOrders" | "totalSpent" | "joinedDate" | "status"
type SortDir = "asc" | "desc"

export default function ClientsPage() {
  const user = mockUsers[0]
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const filtered = useMemo(() => {
    let result = [...mockClients]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.address.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter)
    }

    result.sort((a, b) => {
      let cmp = 0
      if (sortField === "totalOrders" || sortField === "totalSpent") {
        cmp = a[sortField] - b[sortField]
      } else {
        cmp = String(a[sortField]).localeCompare(String(b[sortField]))
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [search, statusFilter, sortField, sortDir])

  const statusCounts = {
    all: mockClients.length,
    active: mockClients.filter((c) => c.status === "active").length,
    inactive: mockClients.filter((c) => c.status === "inactive").length,
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
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Total Clients", count: statusCounts.all, icon: Users, color: "text-foreground", filter: "all" },
            { label: "Active Clients", count: statusCounts.active, icon: UserCheck, color: "text-green-600", filter: "active" },
            { label: "Inactive Clients", count: statusCounts.inactive, icon: UserX, color: "text-red-600", filter: "inactive" },
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">Clients</CardTitle>
                <p className="text-sm text-muted-foreground">
                  View, manage, and track all registered clients
                </p>
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and filters */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or address..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {statusFilter === "all" ? "All Status" : statusFilter}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["all", "active", "inactive"].map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)} className="capitalize">
                      {s === "all" ? "All Status" : s}
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
                    <th className="pb-3"><SortHeader label="Client" field="name" /></th>
                    <th className="pb-3 font-medium">Contact</th>
                    <th className="pb-3 font-medium">Address</th>
                    <th className="pb-3"><SortHeader label="Orders" field="totalOrders" /></th>
                    <th className="pb-3"><SortHeader label="Total Spent" field="totalSpent" /></th>
                    <th className="pb-3"><SortHeader label="Joined" field="joinedDate" /></th>
                    <th className="pb-3"><SortHeader label="Status" field="status" /></th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <UserX className="mx-auto mb-2 h-8 w-8 opacity-40" />
                        No clients found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    filtered.map((client) => (
                      <tr key={client.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={client.avatar || "/placeholder.svg"} />
                              <AvatarFallback>{client.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{client.name}</p>
                              <p className="text-xs text-muted-foreground">{client.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              {client.email}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {client.phone}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-sm text-muted-foreground max-w-[180px] truncate">
                          {client.address}
                        </td>
                        <td className="py-4 text-sm font-medium">{client.totalOrders}</td>
                        <td className="py-4 text-sm font-semibold text-foreground">
                          ${client.totalSpent.toLocaleString()}
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">{client.joinedDate}</td>
                        <td className="py-4">
                          <Badge
                            variant="outline"
                            className={
                              client.status === "active"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-red-200 bg-red-50 text-red-700"
                            }
                          >
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                            <span className="capitalize">{client.status}</span>
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
                                <DropdownMenuItem>View Orders</DropdownMenuItem>
                                <DropdownMenuItem>Send Message</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Deactivate
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
            <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>Showing {filtered.length} of {mockClients.length} clients</p>
              <p>Total Revenue: <span className="font-semibold text-foreground">${mockClients.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
