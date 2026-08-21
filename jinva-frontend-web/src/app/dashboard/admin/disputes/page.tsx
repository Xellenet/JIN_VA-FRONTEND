"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertTriangle,
  Search,
  MessageSquare,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  CreditCard,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { naviiAvatar, cn, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { getPaymentStatusConfig } from "@/lib/status-badges"

// 3.6: GET /admin/disputes/:id (unlike the list endpoint) already returns
// the dispute↔payment linkage the backend added for Ad3 — `jobId` and
// `payment` are null when the underlying booking never produced a paid job
// (a real, expected case, not an error).
interface LinkedPayment {
  id: number
  amount: number
  status: string
  paidAt?: string
  reference: string
}

type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED"

interface BackendDispute {
  id: number
  reason: string
  status: DisputeStatus
  resolution?: string
  adminNotes?: string
  resolvedAt?: string
  createdAt: string
  booking?: {
    id: number
    scheduledDate?: string
    status?: string
    agreedPrice?: number
  }
  raisedBy?: {
    id: number
    firstname: string
    lastname: string
    profilePicture?: string
  }
}

const statusCfg: Record<DisputeStatus, { label: string; icon: typeof Clock; className: string }> = {
  OPEN:         { label: "Open",         icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  UNDER_REVIEW: { label: "Under Review", icon: Clock,         className: "bg-muted text-muted-foreground border-border" },
  RESOLVED:     { label: "Resolved",     icon: CheckCircle,   className: "bg-primary/10 text-primary border-primary/20" },
  CLOSED:       { label: "Closed",       icon: XCircle,       className: "bg-muted text-muted-foreground border-border" },
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<BackendDispute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [active, setActive] = useState<BackendDispute | null>(null)
  const [resolution, setResolution] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 3.6: linked payment — fetched from the dispute detail endpoint the
  // moment a dispute is opened, since the list endpoint doesn't carry it.
  const [linkedPayment, setLinkedPayment] = useState<LinkedPayment | null | undefined>(undefined)
  const [isLoadingPayment, setIsLoadingPayment] = useState(false)

  const openDispute = (d: BackendDispute) => {
    setActive(d)
    setResolution(d.resolution ?? "")
    setLinkedPayment(undefined)
    setIsLoadingPayment(true)
    apiFetch<{ jobId: number | null; payment: LinkedPayment | null }>(`/admin/disputes/${d.id}`)
      .then((detail) => setLinkedPayment(detail.payment ?? null))
      .catch(() => setLinkedPayment(null))
      .finally(() => setIsLoadingPayment(false))
  }

  useEffect(() => {
    apiFetch<BackendDispute[] | { items: BackendDispute[] }>("/admin/disputes?limit=100")
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: BackendDispute[] }).items ?? []
        setDisputes(items)
      })
      .catch(() => toast.error("Could not load disputes."))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = disputes.filter((d) => {
    const q = search.toLowerCase()
    const raiserName = d.raisedBy
      ? `${d.raisedBy.firstname} ${d.raisedBy.lastname}`.toLowerCase()
      : ""
    return (
      String(d.id).includes(q) ||
      d.reason.toLowerCase().includes(q) ||
      raiserName.includes(q)
    )
  })

  const counts = {
    open:     disputes.filter((d) => d.status === "OPEN").length,
    review:   disputes.filter((d) => d.status === "UNDER_REVIEW").length,
    resolved: disputes.filter((d) => d.status === "RESOLVED").length,
    closed:   disputes.filter((d) => d.status === "CLOSED").length,
  }

  const markUnderReview = async (id: number) => {
    try {
      await apiFetch(`/admin/disputes/${id}/start-review`, { method: "PATCH" })
      setDisputes((prev) => prev.map((d) => d.id === id ? { ...d, status: "UNDER_REVIEW" as DisputeStatus } : d))
      toast.success("Dispute marked as under review.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.")
    }
  }

  const resolveDispute = async () => {
    if (!active) return
    if (!resolution.trim()) { toast.error("Please enter a resolution note."); return }
    setIsSubmitting(true)
    try {
      await apiFetch(`/admin/disputes/${active.id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ resolution }),
      })
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === active.id
            ? { ...d, status: "RESOLVED" as DisputeStatus, resolution, resolvedAt: new Date().toISOString() }
            : d,
        ),
      )
      setActive(null)
      setResolution("")
      toast.success("Dispute resolved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve dispute.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeDispute = async (id: number) => {
    try {
      await apiFetch(`/admin/disputes/${id}/close`, { method: "PATCH", body: JSON.stringify({}) })
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, status: "CLOSED" as DisputeStatus, resolvedAt: new Date().toISOString() } : d,
        ),
      )
      toast.success("Dispute closed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close dispute.")
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disputes</h1>
          <p className="text-sm text-muted-foreground">
            Manage and resolve disputes raised on the platform
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Open",         value: counts.open,     className: "text-destructive",      bg: "bg-destructive/10" },
            { label: "Under Review", value: counts.review,   className: "text-muted-foreground", bg: "bg-muted" },
            { label: "Resolved",     value: counts.resolved, className: "text-primary",          bg: "bg-primary/10" },
            { label: "Closed",       value: counts.closed,   className: "text-muted-foreground", bg: "bg-muted" },
          ].map(({ label, value, className, bg }) => (
            <Card key={label}>
              <CardContent className={cn("p-4", bg)}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("mt-0.5 text-2xl font-bold", className)}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{filtered.length} disputes</span>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search disputes…"
                className="h-8 pl-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Raised By</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                        No disputes found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((d) => {
                      const cfg = statusCfg[d.status] ?? statusCfg.OPEN
                      const StatusIcon = cfg.icon
                      const raiserName = d.raisedBy
                        ? `${d.raisedBy.firstname} ${d.raisedBy.lastname}`.trim()
                        : "Unknown"
                      return (
                        <TableRow key={d.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs text-muted-foreground">#{d.id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage src={d.raisedBy?.profilePicture || naviiAvatar(raiserName, 24)} />
                                <AvatarFallback className="text-xs">{raiserName[0]}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-foreground">{raiserName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{d.reason}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground">
                            {d.booking?.agreedPrice != null ? `GH₵ ${Number(d.booking.agreedPrice).toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {fmtDate(d.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-xs", cfg.className)}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => openDispute(d)}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                              {d.status === "OPEN" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 bg-transparent px-2 text-xs"
                                  onClick={() => markUnderReview(d.id)}
                                >
                                  Review
                                </Button>
                              )}
                              {(d.status === "OPEN" || d.status === "UNDER_REVIEW") && (
                                <Button
                                  size="sm"
                                  className="h-7 bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90"
                                  onClick={() => openDispute(d)}
                                >
                                  Resolve
                                </Button>
                              )}
                              {d.status === "UNDER_REVIEW" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => closeDispute(d.id)}
                                >
                                  Close
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setResolution(""); setLinkedPayment(undefined) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {active?.status === "RESOLVED" || active?.status === "CLOSED"
                ? "Dispute Details"
                : "Resolve Dispute"}
            </DialogTitle>
            <DialogDescription>
              #{active?.id} — {active?.reason}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Raised By</p>
                {active.raisedBy ? (
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={active.raisedBy.profilePicture || naviiAvatar(`${active.raisedBy.firstname} ${active.raisedBy.lastname}`, 24)} />
                      <AvatarFallback className="text-xs">{active.raisedBy.firstname[0]}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium text-foreground">
                      {`${active.raisedBy.firstname} ${active.raisedBy.lastname}`.trim()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Unknown</p>
                )}
              </div>

              {/* 3.6: Linked Payment panel (Ad3) */}
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  Linked Payment
                </p>
                {isLoadingPayment ? (
                  <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking for a linked payment…
                  </div>
                ) : linkedPayment ? (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(linkedPayment.amount)}</p>
                      <Badge variant="outline" className={cn("mt-1 text-xs", getPaymentStatusConfig(linkedPayment.status).className)}>
                        {getPaymentStatusConfig(linkedPayment.status).label}
                      </Badge>
                      {linkedPayment.paidAt && (
                        <p className="mt-1 text-xs text-muted-foreground">Paid {fmtDate(linkedPayment.paidAt)}</p>
                      )}
                    </div>
                    <Link
                      href="/dashboard/admin/transactions"
                      className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      View in Transactions <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No payment on file for this booking.</p>
                )}
              </div>

              {active.booking?.agreedPrice != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Amount at dispute:</span>
                  <span className="font-semibold text-foreground">GH₵ {Number(active.booking.agreedPrice).toLocaleString()}</span>
                </div>
              )}

              {active.status !== "RESOLVED" && active.status !== "CLOSED" ? (
                <div className="space-y-1.5">
                  <Label>Resolution Note</Label>
                  <Textarea
                    placeholder="Document the resolution and any actions taken…"
                    rows={3}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  />
                </div>
              ) : (
                active.resolution && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resolution</p>
                    <p className="mt-1 rounded-lg bg-primary/5 p-3 text-sm text-foreground">{active.resolution}</p>
                    {active.resolvedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Resolved {new Date(active.resolvedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          )}
          {active && active.status !== "RESOLVED" && active.status !== "CLOSED" && (
            <DialogFooter className="gap-2">
              <Button variant="outline" className="bg-transparent" onClick={() => { setActive(null); setResolution("") }}>
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={resolveDispute}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Resolved
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
