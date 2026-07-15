"use client"

import { useState, useMemo, useEffect } from "react"
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
  Users,
  UserCheck,
  UserX,
  Mail,
  Phone,
  UserRound,
  Loader2,
} from "lucide-react"
import { naviiAvatar } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

interface BackendUser {
  id: number
  firstname: string
  lastname: string
  email: string
  phoneNumber?: string
  profilePicture?: string
  isBanned: boolean
  createdAt: string
}

function mapUser(u: BackendUser) {
  return {
    id: String(u.id),
    name: `${u.firstname} ${u.lastname}`.trim(),
    email: u.email,
    phone: u.phoneNumber ?? "—",
    joinedDate: new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    status: u.isBanned ? "banned" : "active",
    avatar: u.profilePicture,
  }
}

type MappedUser = ReturnType<typeof mapUser>

export default function ClientsPage() {
  const [clients, setClients] = useState<MappedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [actionPending, setActionPending] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<BackendUser[] | { items: BackendUser[] }>("/admin/users?role=CUSTOMER&limit=100")
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: BackendUser[] }).items ?? []
        setClients(items.map(mapUser))
      })
      .catch(() => toast.error("Could not load clients."))
      .finally(() => setIsLoading(false))
  }, [])

  const handleBan = async (id: string, currentStatus: string) => {
    const isBanned = currentStatus === "banned"
    setActionPending(id)
    try {
      await apiFetch(`/admin/users/${id}/${isBanned ? "unban" : "ban"}`, { method: "PATCH" })
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: isBanned ? "active" : "banned" } : c)),
      )
      toast.success(`User ${isBanned ? "unbanned" : "banned"} successfully.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.")
    } finally {
      setActionPending(null)
    }
  }

  const filtered = useMemo(() => {
    let result = [...clients]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q),
      )
    }
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter)
    }
    return result
  }, [clients, search, statusFilter])

  const statusCounts = {
    all: clients.length,
    active: clients.filter((c) => c.status === "active").length,
    banned: clients.filter((c) => c.status === "banned").length,
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Total Clients",  count: statusCounts.all,    icon: Users,      color: "text-foreground",  filter: "all"    },
            { label: "Active Clients", count: statusCounts.active,  icon: UserCheck,  color: "text-green-600",   filter: "active" },
            { label: "Banned Clients", count: statusCounts.banned,  icon: UserX,      color: "text-red-600",     filter: "banned" },
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
                <p className="text-sm text-muted-foreground">View and manage all registered customers</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
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
                  {["all", "active", "banned"].map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)} className="capitalize">
                      {s === "all" ? "All Status" : s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Client</th>
                      <th className="pb-3 font-medium">Contact</th>
                      <th className="pb-3 font-medium">Joined</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
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
                                <AvatarImage src={client.avatar || naviiAvatar(client.name)} />
                                <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
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
                              {client.phone !== "—" && (
                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Phone className="h-3.5 w-3.5" />
                                  {client.phone}
                                </span>
                              )}
                            </div>
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
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={actionPending === client.id}>
                                  {actionPending === client.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <MoreVertical className="h-4 w-4" />
                                  }
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className={client.status === "banned" ? "text-green-600" : "text-destructive"}
                                  onClick={() => handleBan(client.id, client.status)}
                                >
                                  {client.status === "banned" ? "Unban User" : "Ban User"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>Showing {filtered.length} of {clients.length} clients</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
