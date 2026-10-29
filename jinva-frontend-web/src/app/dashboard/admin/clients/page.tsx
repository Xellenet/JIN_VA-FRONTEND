"use client"

import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, ChevronDown, Users, UserCheck, UserX, UserMinus, Mail, Phone, UserRound, Loader2 } from "lucide-react"
import { resolveAvatarUrl } from "@/lib/utils"
import { AccountActionsMenu, AccountStatusBadge, type AccountStatus } from "@/components/admin/account-actions-menu"
import { PagePager } from "@/components/admin/page-pager"
import { useAdminList } from "@/hooks/use-admin-list"

interface BackendUser {
  id: number
  firstname: string
  lastname: string
  email: string
  phoneNumber?: string
  profilePicture?: string
  accountStatus: AccountStatus
  createdAt: string
}

const STATUS_LABELS = { all: "All Status", ACTIVE: "Active", SUSPENDED: "Suspended", BANNED: "Banned" } as const

export default function ClientsPage() {
  const list = useAdminList<BackendUser>("/admin/users", { role: "CUSTOMER" })

  const setAccountStatus = (id: number, accountStatus: AccountStatus) => {
    list.setItems((prev) => prev.map((u) => (u.id === id ? { ...u, accountStatus } : u)))
    list.reload()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { label: "Total Clients", filter: "all", icon: Users, color: "text-foreground" },
              { label: "Active Clients", filter: "ACTIVE", icon: UserCheck, color: "text-success" },
              { label: "Suspended Clients", filter: "SUSPENDED", icon: UserMinus, color: "text-warning" },
              { label: "Banned Clients", filter: "BANNED", icon: UserX, color: "text-destructive" },
            ] as const
          ).map((item) => (
            <button key={item.label} type="button" onClick={() => list.setStatus(item.filter)} className="text-left">
              <Card
                className={`cursor-pointer transition-shadow hover:shadow-md ${list.status === item.filter ? "ring-2 ring-primary" : ""}`}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`rounded-lg bg-muted p-2.5 ${item.color}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="text-2xl font-bold">{list.counts[item.filter] ?? "—"}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Clients</CardTitle>
            <p className="text-sm text-muted-foreground">View and manage all registered customers</p>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  className="pl-10"
                  value={list.search}
                  onChange={(e) => list.setSearch(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {STATUS_LABELS[list.status]}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => list.setStatus(s)}>
                      {STATUS_LABELS[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {list.isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : list.loadFailed ? (
              <p className="py-12 text-center text-muted-foreground">Could not load clients. Refresh to try again.</p>
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
                    {list.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          <UserX className="mx-auto mb-2 h-8 w-8 opacity-40" />
                          No clients found matching your criteria
                        </td>
                      </tr>
                    ) : (
                      list.items.map((client) => {
                        const name = `${client.firstname} ${client.lastname}`.trim()
                        return (
                          <tr key={client.id} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={resolveAvatarUrl(client.profilePicture)} />
                                  <AvatarFallback>
                                    <UserRound className="h-4 w-4" />
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{name}</p>
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
                                {client.phoneNumber && (
                                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5" />
                                    {client.phoneNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 text-sm text-muted-foreground">
                              {new Date(client.createdAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-4">
                              <AccountStatusBadge status={client.accountStatus} />
                            </td>
                            <td className="py-4">
                              <AccountActionsMenu
                                userId={client.id}
                                name={name}
                                status={client.accountStatus}
                                onChanged={(s) => setAccountStatus(client.id, s)}
                              />
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {list.items.length} of {list.total} client{list.total === 1 ? "" : "s"}
              </p>
              <PagePager page={list.page} totalPages={list.totalPages} onPage={list.setPage} />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
