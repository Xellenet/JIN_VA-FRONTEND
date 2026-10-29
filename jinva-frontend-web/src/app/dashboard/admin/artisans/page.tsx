"use client"

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
import { Search, Star, UserRound, Loader2, ShieldCheck, ChevronDown } from "lucide-react"
import { resolveAvatarUrl } from "@/lib/utils"
import { AccountActionsMenu, AccountStatusBadge, type AccountStatus } from "@/components/admin/account-actions-menu"
import { PagePager } from "@/components/admin/page-pager"
import { useAdminList } from "@/hooks/use-admin-list"
import { availabilityLabel } from "@/lib/availability"

interface BackendArtisan {
  id: string
  businessName?: string
  averageRating: number
  totalReviews: number
  availabilityStatus: string
  isVerified: boolean
  accountStatus: AccountStatus
  services?: { id: string; name: string }[]
  user: { id: number; firstname: string; lastname: string; profilePicture?: string }
}

const STATUS_LABELS = { all: "All Status", ACTIVE: "Active", SUSPENDED: "Suspended", BANNED: "Banned" } as const

export default function ArtisansPage() {
  // QA ADM-03 / ADM-06: paged, searched and filtered on the server, with
  // suspend and activate next to ban.
  const list = useAdminList<BackendArtisan>("/admin/artisans")

  const setAccountStatus = (profileId: string, accountStatus: AccountStatus) => {
    list.setItems((prev) => prev.map((a) => (a.id === profileId ? { ...a, accountStatus } : a)))
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Artisans</CardTitle>
            <p className="text-sm text-muted-foreground">
              {list.counts.all ?? "—"} artisan{list.counts.all === 1 ? "" : "s"} registered on the platform
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, business or service..."
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
                      {list.counts[s] != null ? ` (${list.counts[s]})` : ""}
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
              <p className="py-16 text-center text-muted-foreground">Could not load artisans. Refresh to try again.</p>
            ) : list.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <UserRound className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground">
                  {list.search || list.status !== "all" ? "No artisans match your search." : "No artisans yet."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {list.items.map((artisan) => {
                  const name = `${artisan.user.firstname} ${artisan.user.lastname}`.trim()
                  const available = artisan.availabilityStatus === "AVAILABLE"
                  return (
                    <Card key={artisan.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="relative h-40 bg-gradient-to-br from-primary to-primary/80">
                          <Avatar className="absolute bottom-0 left-1/2 h-24 w-24 -translate-x-1/2 translate-y-1/2 border-4 border-background">
                            <AvatarImage src={resolveAvatarUrl(artisan.user.profilePicture)} />
                            <AvatarFallback>
                              <UserRound className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background px-2 py-1 text-sm font-semibold">
                            <Star className="h-3.5 w-3.5 fill-rating text-rating" />
                            {Number(artisan.averageRating ?? 0).toFixed(1)}
                          </div>
                          {artisan.isVerified && (
                            <div className="absolute left-3 top-3 flex items-center justify-center rounded-full bg-background/90 p-1">
                              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            </div>
                          )}
                        </div>
                        <div className="mt-14 space-y-3 p-4 text-center">
                          <div>
                            <h3 className="font-semibold">{name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {artisan.businessName || artisan.services?.[0]?.name || "General Service"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <AccountStatusBadge status={artisan.accountStatus} />
                            <Badge
                              variant="outline"
                              className={
                                available
                                  ? "border-primary/30 bg-primary/5 text-primary"
                                  : "border-border bg-muted text-muted-foreground"
                              }
                            >
                              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                              {availabilityLabel(artisan.availabilityStatus)}
                            </Badge>
                            <AccountActionsMenu
                              userId={artisan.user.id}
                              name={name}
                              status={artisan.accountStatus}
                              onChanged={(s) => setAccountStatus(artisan.id, s)}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {list.items.length} of {list.total} artisan{list.total === 1 ? "" : "s"}
              </p>
              <PagePager page={list.page} totalPages={list.totalPages} onPage={list.setPage} />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
