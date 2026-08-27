"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Search,
  ChevronDown,
  ArrowUpDown,
  Calendar,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  UserRound,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { naviiAvatar } from "@/lib/utils"
import { apiFetchWithMeta } from "@/lib/api"

/**
 * AT8 / design-spec.md §10.5 — the admin Jobs screen.
 *
 * Two defects fixed here:
 *
 *  1. It called the **public** `GET /jobs` rather than `GET /admin/jobs`. The
 *     admin endpoint applies `withDeleted()`, so soft-deleted jobs were
 *     invisible on the one screen whose whole purpose is seeing the full job
 *     set. Deleted rows are now fetched and visibly marked.
 *  2. The "Assign Artisan" and "Update Status" menu items had no `onClick` at
 *     all. Per the round's resolved Open Question 10 they are removed rather
 *     than wired: admin-side job mutation is not a named PRD requirement and
 *     building it wasn't asked for. A menu item that does nothing is worse
 *     than an absent one.
 *
 * The status filter is now applied server-side, the four counter tiles read
 * real whole-set totals from the list endpoint's pagination metadata instead
 * of counting the loaded page, and real pagination replaces the silent
 * `limit=50` truncation. Search and column sorting remain page-local (the
 * endpoint takes neither), which the footer states plainly.
 */

interface BackendJob {
  id: number | string
  title?: string
  status: string
  createdAt: string
  deletedAt?: string | null
  customer?: { id: number | string; firstname: string; lastname: string; profilePicture?: string }
  /**
   * `GET /admin/jobs` joins `customer` and `service` only, so the accepted
   * artisan's name genuinely isn't on the wire — `acceptedArtisanId` is
   * (TypeORM populates the `@RelationId`). Shown as "Assigned" rather than a
   * fabricated name; flagged for the backend engineer to join the relation.
   */
  acceptedArtisan?: { id: number | string; firstname: string; lastname: string }
  acceptedArtisanId?: number | null
  service?: { id: number | string; name: string }
}

interface MappedJob {
  id: string
  clientName: string
  clientAvatar?: string
  artisanName: string
  serviceName: string
  createdAt: string
  orderDate: string
  status: string
  isDeleted: boolean
}

const PAGE_SIZE = 20

/** `Status` on the backend (`common/types/enums.ts`). */
const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: "border-primary/15 bg-primary/5 text-primary",
  PENDING: "border-warning/20 bg-warning/10 text-warning",
  IN_PROGRESS: "border-border bg-muted text-muted-foreground",
  COMPLETED: "border-primary/30 bg-primary/5 text-primary",
  CANCELLED: "border-destructive/30 bg-destructive/5 text-destructive",
  EXPIRED: "border-border bg-muted text-muted-foreground",
}

const FILTER_OPTIONS = ["ALL", "OPEN", "PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"] as const

/** The four tiles, each a server-side filter shortcut. */
const COUNTER_TILES = [
  { label: "All Jobs", filter: "ALL", icon: ClipboardList },
  { label: "Pending", filter: "PENDING", icon: Clock },
  { label: "In Progress", filter: "IN_PROGRESS", icon: Calendar },
  { label: "Completed", filter: "COMPLETED", icon: CheckCircle2 },
] as const

function mapJob(j: BackendJob): MappedJob {
  return {
    id: String(j.id),
    clientName: j.customer ? `${j.customer.firstname} ${j.customer.lastname}`.trim() : "Unknown",
    clientAvatar: j.customer?.profilePicture,
    artisanName: j.acceptedArtisan
      ? `${j.acceptedArtisan.firstname} ${j.acceptedArtisan.lastname}`.trim()
      : j.acceptedArtisanId
        ? "Assigned"
        : "Unassigned",
    serviceName: j.service?.name ?? j.title ?? "—",
    createdAt: j.createdAt,
    orderDate: new Date(j.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    status: j.status,
    isDeleted: Boolean(j.deletedAt),
  }
}

function extractTotal(meta: Record<string, unknown> | undefined): number {
  const direct = meta?.total as number | undefined
  const nested = (meta?.pagination as { total?: number } | undefined)?.total
  return direct ?? nested ?? 0
}

function extractTotalPages(meta: Record<string, unknown> | undefined): number {
  const direct = meta?.totalPages as number | undefined
  const nested = (meta?.pagination as { totalPages?: number } | undefined)?.totalPages
  const value = direct ?? nested ?? 1
  return value > 0 ? value : 1
}

type SortField = "clientName" | "createdAt" | "serviceName" | "status"
type SortDir = "asc" | "desc"

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<MappedJob[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const load = useCallback(async (p: number, status: string) => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const query = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
      if (status !== "ALL") query.set("status", status)
      const { data, meta } = await apiFetchWithMeta<BackendJob[]>(`/admin/jobs?${query}`)
      const rows = Array.isArray(data) ? data : []
      if (rows.length === 0 && p > 1) {
        await load(p - 1, status)
        return
      }
      setJobs(rows.map(mapJob))
      setPage(p)
      setTotalPages(extractTotalPages(meta))
      setTotal(extractTotal(meta))
    } catch {
      setLoadError(true)
      setJobs([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Real whole-set counts, one cheap `limit=1` metadata read per tile, rather
   * than arithmetic over whichever page happened to be loaded.
   */
  const loadCounts = useCallback(async () => {
    try {
      const results = await Promise.all(
        COUNTER_TILES.map(({ filter }) =>
          apiFetchWithMeta<BackendJob[]>(
            `/admin/jobs?limit=1${filter === "ALL" ? "" : `&status=${filter}`}`,
          ),
        ),
      )
      setCounts(
        Object.fromEntries(
          COUNTER_TILES.map(({ filter }, i) => [filter, extractTotal(results[i].meta)]),
        ),
      )
    } catch {
      // Non-blocking — the tiles show a spinner rather than a wrong number.
    }
  }, [])

  useEffect(() => {
    load(1, statusFilter)
  }, [load, statusFilter])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  // `GET /admin/jobs` takes only status/page/limit — no search, no sort. Both
  // of these therefore narrow and reorder the loaded page only, which the
  // footer says out loud rather than implying a whole-ledger operation.
  const visible = useMemo(() => {
    let result = [...jobs]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (o) =>
          o.clientName.toLowerCase().includes(q) ||
          o.artisanName.toLowerCase().includes(q) ||
          o.serviceName.toLowerCase().includes(q) ||
          o.id.includes(q),
      )
    }
    result.sort((a, b) => {
      const cmp =
        sortField === "createdAt"
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : String(a[sortField]).localeCompare(String(b[sortField]))
      return sortDir === "asc" ? cmp : -cmp
    })
    return result
  }, [jobs, search, sortField, sortDir])

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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {COUNTER_TILES.map(({ label, filter, icon: Icon }) => (
            <button key={label} type="button" onClick={() => setStatusFilter(filter)} className="text-left">
              <Card
                className={`cursor-pointer transition-shadow hover:shadow-md ${statusFilter === filter ? "ring-2 ring-primary" : ""}`}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-muted p-2.5 text-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    {counts === null ? (
                      <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <p className="text-2xl font-bold">{counts[filter] ?? 0}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="text-2xl font-bold">Jobs</CardTitle>
              <p className="text-sm text-muted-foreground">
                Every job on the platform, including soft-deleted ones
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search this page by client, artisan, service or id…"
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {statusFilter === "ALL" ? "All Statuses" : STATUS_LABELS[statusFilter] ?? statusFilter}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {FILTER_OPTIONS.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)}>
                      {s === "ALL" ? "All Statuses" : STATUS_LABELS[s] ?? s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : loadError ? (
              <div className="py-16 text-center">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive/60" />
                <p className="text-sm text-muted-foreground">Couldn&apos;t load the job list.</p>
                <Button
                  variant="outline"
                  className="mt-4 bg-transparent"
                  onClick={() => load(page, statusFilter)}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-3"><SortHeader label="Client" field="clientName" /></th>
                        <th className="pb-3"><SortHeader label="Service" field="serviceName" /></th>
                        <th className="pb-3"><SortHeader label="Date" field="createdAt" /></th>
                        <th className="pb-3">Assigned Artisan</th>
                        <th className="pb-3"><SortHeader label="Status" field="status" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-muted-foreground">
                            <XCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />
                            {search
                              ? "No jobs on this page match your search"
                              : "No jobs with this status"}
                          </td>
                        </tr>
                      ) : (
                        visible.map((job) => (
                          <tr
                            key={job.id}
                            className="border-b transition-colors last:border-0 hover:bg-muted/30"
                          >
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={job.clientAvatar || naviiAvatar(job.clientName)} />
                                  <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{job.clientName}</span>
                              </div>
                            </td>
                            <td className="py-4 text-sm text-muted-foreground">{job.serviceName}</td>
                            <td className="py-4 text-sm text-muted-foreground">{job.orderDate}</td>
                            <td className="py-4 text-sm text-muted-foreground">{job.artisanName}</td>
                            <td className="py-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className={STATUS_BADGE[job.status] ?? ""}>
                                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                                  {STATUS_LABELS[job.status] ?? job.status}
                                </Badge>
                                {job.isDeleted && (
                                  <Badge
                                    variant="outline"
                                    className="border-border bg-muted text-muted-foreground"
                                    title="Soft-deleted — visible only to admins"
                                  >
                                    Deleted
                                  </Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-sm text-muted-foreground">
                  Showing {visible.length} of {total} job{total !== 1 ? "s" : ""}
                  {statusFilter !== "ALL" ? ` with status ${STATUS_LABELS[statusFilter] ?? statusFilter}` : ""}
                  {" — search and column sorting apply to this page only."}
                </div>

                {totalPages > 1 && (
                  <div className="mt-3 border-t pt-3">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (page > 1) load(page - 1, statusFilter) }}
                            className={page === 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <PaginationItem key={p}>
                            <PaginationLink
                              href="#"
                              isActive={p === page}
                              onClick={(e) => { e.preventDefault(); load(p, statusFilter) }}
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (page < totalPages) load(page + 1, statusFilter) }}
                            className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
