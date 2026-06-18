"use client"

import { useState } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
} from "lucide-react"
import { naviiAvatar, cn } from "@/lib/utils"
import { toast } from "sonner"

type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED"

interface Dispute {
  id: string
  ref: string
  clientName: string
  artisanName: string
  service: string
  amount: number
  reason: string
  description: string
  openedAt: string
  status: DisputeStatus
  resolution?: string
  resolvedAt?: string
}

const mockDisputes: Dispute[] = [
  { id: "1", ref: "DIS-101", clientName: "Nana Ama",     artisanName: "Robert Fox",       service: "Plumbing Repair",    amount: 280, reason: "Work not completed",    description: "The artisan left before finishing the drain repair. Water still leaking from the same pipe.", openedAt: "2026-06-03", status: "OPEN" },
  { id: "2", ref: "DIS-102", clientName: "Kofi Asante",  artisanName: "Brooklyn Simmons", service: "Electrical Install", amount: 420, reason: "Quality issue",          description: "Two light switches were installed incorrectly and one outlet is sparking. Requested re-visit but artisan is unresponsive.", openedAt: "2026-06-05", status: "UNDER_REVIEW" },
  { id: "3", ref: "DIS-103", clientName: "Emma Wilson",  artisanName: "Kwame Asante",     service: "AC Service",         amount: 150, reason: "No-show",               description: "Artisan did not show up at the agreed time. No prior notice or message received.", openedAt: "2026-06-07", status: "RESOLVED", resolution: "Full refund issued to client. Artisan warned.", resolvedAt: "2026-06-09" },
  { id: "4", ref: "DIS-104", clientName: "James Mensah", artisanName: "Ama Owusu",        service: "Fence Installation", amount: 600, reason: "Material mismatch",      description: "Client requested hardwood fence but artisan used softwood without prior discussion.", openedAt: "2026-06-10", status: "UNDER_REVIEW" },
  { id: "5", ref: "DIS-105", clientName: "Abena Owusu",  artisanName: "Robert Fox",       service: "Cabinet Repair",     amount: 180, reason: "Overcharge",            description: "Client was charged GH₵ 180 but the quote given was GH₵ 120.", openedAt: "2026-06-13", status: "OPEN" },
  { id: "6", ref: "DIS-106", clientName: "Yaw Darko",    artisanName: "Brooklyn Simmons", service: "Pipe Replacement",   amount: 340, reason: "Damage to property",    description: "During pipe replacement, artisan broke a tile and refused to compensate.", openedAt: "2026-06-15", status: "CLOSED", resolution: "Dispute closed — client withdrew complaint.", resolvedAt: "2026-06-16" },
]

const REASONS = ["Work not completed", "Quality issue", "No-show", "Material mismatch", "Overcharge", "Damage to property", "Other"]

const statusCfg: Record<DisputeStatus, { label: string; icon: typeof Clock; className: string }> = {
  OPEN:         { label: "Open",         icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  UNDER_REVIEW: { label: "Under Review", icon: Clock,         className: "bg-muted text-muted-foreground border-border" },
  RESOLVED:     { label: "Resolved",     icon: CheckCircle,   className: "bg-primary/10 text-primary border-primary/20" },
  CLOSED:       { label: "Closed",       icon: XCircle,       className: "bg-muted text-muted-foreground border-border" },
}

export default function DisputesPage() {
  const [disputes, setDisputes]   = useState<Dispute[]>(mockDisputes)
  const [search, setSearch]       = useState("")
  const [active, setActive]       = useState<Dispute | null>(null)
  const [resolution, setResolution] = useState("")
  const [outcome, setOutcome]     = useState("")

  const filtered = disputes.filter(
    (d) =>
      d.ref.toLowerCase().includes(search.toLowerCase()) ||
      d.clientName.toLowerCase().includes(search.toLowerCase()) ||
      d.artisanName.toLowerCase().includes(search.toLowerCase()) ||
      d.reason.toLowerCase().includes(search.toLowerCase()),
  )

  const counts = {
    open:   disputes.filter((d) => d.status === "OPEN").length,
    review: disputes.filter((d) => d.status === "UNDER_REVIEW").length,
    resolved: disputes.filter((d) => d.status === "RESOLVED").length,
    closed: disputes.filter((d) => d.status === "CLOSED").length,
  }

  const markUnderReview = (id: string) => {
    setDisputes((prev) => prev.map((d) => d.id === id ? { ...d, status: "UNDER_REVIEW" as DisputeStatus } : d))
    toast.success("Dispute marked as under review.")
  }

  const resolveDispute = () => {
    if (!active) return
    if (!resolution.trim()) { toast.error("Please enter a resolution note."); return }
    setDisputes((prev) => prev.map((d) => d.id === active.id
      ? { ...d, status: "RESOLVED" as DisputeStatus, resolution, resolvedAt: new Date().toISOString().split("T")[0] }
      : d,
    ))
    setActive(null)
    setResolution("")
    setOutcome("")
    toast.success("Dispute resolved. Both parties will be notified.")
  }

  const closeDispute = (id: string) => {
    setDisputes((prev) => prev.map((d) => d.id === id
      ? { ...d, status: "CLOSED" as DisputeStatus, resolution: "Dispute closed by admin.", resolvedAt: new Date().toISOString().split("T")[0] }
      : d,
    ))
    toast.success("Dispute closed.")
  }

  const fmtDate  = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  const fmtMoney = (n: number) => `GH₵ ${n.toLocaleString()}`

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disputes</h1>
          <p className="text-sm text-muted-foreground">
            Manage and resolve disputes raised by clients against artisans
          </p>
        </div>

        {/* Stats */}
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

        {/* Table */}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Artisan</TableHead>
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
                    <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                      No disputes found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((d) => {
                    const cfg = statusCfg[d.status]
                    const StatusIcon = cfg.icon
                    return (
                      <TableRow key={d.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs text-muted-foreground">{d.ref}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarImage src={naviiAvatar(d.clientName, 24)} />
                              <AvatarFallback className="text-xs">{d.clientName[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-foreground">{d.clientName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{d.artisanName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{d.reason}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">{fmtMoney(d.amount)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(d.openedAt)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", cfg.className)}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setActive(d); setResolution(d.resolution ?? "") }}>
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                            {d.status === "OPEN" && (
                              <Button size="sm" variant="outline" className="h-7 bg-transparent px-2 text-xs" onClick={() => markUnderReview(d.id)}>
                                Review
                              </Button>
                            )}
                            {(d.status === "OPEN" || d.status === "UNDER_REVIEW") && (
                              <Button size="sm" className="h-7 bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90" onClick={() => { setActive(d); setResolution(d.resolution ?? "") }}>
                                Resolve
                              </Button>
                            )}
                            {d.status === "UNDER_REVIEW" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => closeDispute(d.id)}>
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
          </div>
        </Card>
      </div>

      {/* Resolution dialog */}
      <Dialog open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setResolution(""); setOutcome("") } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {active?.status === "RESOLVED" || active?.status === "CLOSED"
                ? "Dispute Details"
                : "Resolve Dispute"}
            </DialogTitle>
            <DialogDescription>{active?.ref} — {active?.reason}</DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Client</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={naviiAvatar(active.clientName, 24)} />
                      <AvatarFallback className="text-xs">{active.clientName[0]}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium text-foreground">{active.clientName}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Artisan</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={naviiAvatar(active.artisanName, 24)} />
                      <AvatarFallback className="text-xs">{active.artisanName[0]}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium text-foreground">{active.artisanName}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client's Description</p>
                <p className="mt-1 rounded-lg bg-muted/30 p-3 text-sm text-foreground leading-relaxed">{active.description}</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount at dispute:</span>
                <span className="font-semibold text-foreground">GH₵ {active.amount}</span>
              </div>

              {active.status !== "RESOLVED" && active.status !== "CLOSED" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Outcome</Label>
                    <Select value={outcome} onValueChange={setOutcome}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an outcome…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_refund">Full refund to client</SelectItem>
                        <SelectItem value="partial_refund">Partial refund to client</SelectItem>
                        <SelectItem value="no_refund">No refund — favour artisan</SelectItem>
                        <SelectItem value="rework">Artisan to redo work</SelectItem>
                        <SelectItem value="warning">Issue warning only</SelectItem>
                        <SelectItem value="withdraw">Client withdrew complaint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Resolution Note</Label>
                    <Textarea
                      placeholder="Document the resolution and any actions taken…"
                      rows={3}
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                active.resolution && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resolution</p>
                    <p className="mt-1 rounded-lg bg-primary/5 p-3 text-sm text-foreground">{active.resolution}</p>
                    {active.resolvedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">Resolved {fmtDate(active.resolvedAt)}</p>
                    )}
                  </div>
                )
              )}
            </div>
          )}
          {active && active.status !== "RESOLVED" && active.status !== "CLOSED" && (
            <DialogFooter className="gap-2">
              <Button variant="outline" className="bg-transparent" onClick={() => { setActive(null); setResolution(""); setOutcome("") }}>
                Cancel
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={resolveDispute}>
                <CheckCircle className="mr-2 h-4 w-4" /> Mark as Resolved
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
