"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, Search, MessageSquare, Loader2 } from "lucide-react"
import { cn, formatCurrency, resolveAvatarUrl } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { getDisputeOutcomeConfig, getDisputeStatusConfig } from "@/lib/status-badges"
import { QueueCounterCard } from "@/components/dashboard/admin/queue-counter-card"
import {
  ResolveDisputeDialog,
  type AdminDispute,
  type AdminDisputeStatus,
} from "@/components/admin/resolve-dispute-dialog"

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [active, setActive] = useState<AdminDispute | null>(null)

  useEffect(() => {
    apiFetch<AdminDispute[] | { items: AdminDispute[] }>("/admin/disputes?limit=100")
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: AdminDispute[] }).items ?? []
        setDisputes(items)
      })
      .catch(() => toast.error("Could not load disputes."))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = disputes.filter((d) => {
    const q = search.toLowerCase()
    const raiserName = d.raisedBy
      ? `${d.raisedBy.firstname ?? ""} ${d.raisedBy.lastname ?? ""}`.toLowerCase()
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

  /**
   * DC1.5: a dispute's new state always comes from the server. The dialog
   * re-reads `GET /admin/disputes/:id` after every resolve attempt and hands
   * the result back here — a local patch from the request body cannot
   * represent `outcome`, `moneyAction`, or a ruling the backend rolled back
   * because the money action failed.
   */
  const applyServerState = (updated: AdminDispute) => {
    setDisputes((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)))
    setActive((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
  }

  const markUnderReview = async (id: number) => {
    try {
      await apiFetch(`/admin/disputes/${id}/start-review`, { method: "PATCH" })
      setDisputes((prev) => prev.map((d) => d.id === id ? { ...d, status: "UNDER_REVIEW" as AdminDisputeStatus } : d))
      toast.success("Dispute marked as under review.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.")
    }
  }

  const closeDispute = async (id: number) => {
    try {
      await apiFetch(`/admin/disputes/${id}/close`, { method: "PATCH", body: JSON.stringify({}) })
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, status: "CLOSED" as AdminDisputeStatus, resolvedAt: new Date().toISOString() } : d,
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
          <QueueCounterCard label="Open"         value={counts.open}     tone="destructive" />
          <QueueCounterCard label="Under Review" value={counts.review}   tone="muted" />
          <QueueCounterCard label="Resolved"     value={counts.resolved} tone="primary" />
          <QueueCounterCard label="Closed"       value={counts.closed}   tone="muted" />
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
                      const cfg = getDisputeStatusConfig(d.status)
                      const StatusIcon = cfg.icon
                      const outcomeCfg = d.outcome ? getDisputeOutcomeConfig(d.outcome) : null
                      const OutcomeIcon = outcomeCfg?.icon
                      const raiserName = d.raisedBy
                        ? `${d.raisedBy.firstname ?? ""} ${d.raisedBy.lastname ?? ""}`.trim() || "a former JinVa user"
                        : "Unknown"
                      return (
                        <TableRow key={d.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs text-muted-foreground">#{d.id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage src={resolveAvatarUrl(d.raisedBy?.profilePicture, raiserName, 24)} />
                                <AvatarFallback className="text-xs">{raiserName[0]}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-foreground">{raiserName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{d.reason}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground">
                            {d.booking?.agreedPrice != null ? formatCurrency(d.booking.agreedPrice) : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {fmtDate(d.createdAt)}
                          </TableCell>
                          <TableCell>
                            {/* DC1.8: a resolved row reflects the recorded
                                verdict, not just the status. A CLOSED dispute
                                carries no outcome, so it gets no second badge. */}
                            <div className="flex flex-col items-start gap-1">
                              <Badge variant="outline" className={cn("text-xs", cfg.className)}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {cfg.label}
                              </Badge>
                              {outcomeCfg && OutcomeIcon && (
                                <Badge variant="outline" className={cn("text-xs", outcomeCfg.className)}>
                                  <OutcomeIcon className="mr-1 h-3 w-3" />
                                  {outcomeCfg.label}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setActive(d)}
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
                                  onClick={() => setActive(d)}
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

      {/* DC1 — the three-step resolve flow (design-spec.md §10). */}
      <ResolveDisputeDialog
        dispute={active}
        onOpenChange={(open) => { if (!open) setActive(null) }}
        onDisputeUpdated={applyServerState}
      />
    </DashboardLayout>
  )
}
