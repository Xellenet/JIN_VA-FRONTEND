"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Search,
  Download,
  AlertTriangle,
  Eye,
  Loader2,
} from "lucide-react"
import { naviiAvatar, cn, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch, apiFetchWithMeta } from "@/lib/api"
import { getPaymentStatusConfig, paymentStatusConfig } from "@/lib/status-badges"

// Ad1: the real, paginated shape of GET /payments/admin/all — replaces the
// old mockTx/TxStatus/TxType entirely. There is no `artisan` relation on
// this response (only `artisanProfileId`, a bare FK) — the backend's
// `getAllPayments` only eager-loads `job` and `customer`, so an artisan name
// genuinely isn't available here today; shown as "Artisan #<id>" rather than
// guessed or fabricated.
// QA re-verification (2026-08-21, LOW — partial-refund amount): the backend
// now persists `refundedAmount` on the Payment entity and accumulates it
// across partial refunds (only flipping `status` to the terminal REFUNDED
// once the cumulative total reaches the full `amount`). `GET
// /payments/admin/all` returns the raw entity, so the field is already on
// the wire — it just wasn't read here. Added below and surfaced in the
// table/cards, the detail dialog, and the refund dialog's remaining-balance
// math.
interface BackendPayment {
  id: number
  jobId: number
  job?: { id: number; title: string }
  customerId: number
  customer?: { id: number; firstname: string; lastname: string; profilePicture?: string }
  artisanProfileId: number
  amount: number
  platformFee: number
  artisanAmount: number
  refundedAmount?: number
  currency: string
  status: string
  reference: string
  channel?: string
  transferReference?: string
  transferCode?: string
  paidAt?: string
  releasedAt?: string
  createdAt: string
}

const PAGE_SIZE = 20

export default function TransactionsPage() {
  const [payments, setPayments] = useState<BackendPayment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  const [detailPayment, setDetailPayment] = useState<BackendPayment | null>(null)
  const [showTechDetails, setShowTechDetails] = useState(false)
  const [refundPayment, setRefundPayment] = useState<BackendPayment | null>(null)
  const [refundMode, setRefundMode] = useState<"full" | "partial">("full")
  const [refundAmount, setRefundAmount] = useState("")
  const [isRefunding, setIsRefunding] = useState(false)

  const load = (p: number) => {
    setIsLoading(true)
    setLoadError(false)
    apiFetchWithMeta<BackendPayment[]>(`/payments/admin/all?page=${p}&limit=${PAGE_SIZE}`)
      .then(({ data, meta }) => {
        setPayments(data)
        const pagination = meta?.pagination as { total?: number; totalPages?: number } | undefined
        setTotalPages(pagination?.totalPages && pagination.totalPages > 0 ? pagination.totalPages : 1)
        setTotal(pagination?.total ?? data.length)
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { load(page) }, [page])

  // Ad1: `GET /payments/admin/all` takes only page/limit — no server-side
  // search or status filtering exists today. These filters therefore only
  // narrow the current page of results, called out explicitly below rather
  // than silently implying a full-ledger search.
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return payments.filter((p) => {
      const customerName = p.customer ? `${p.customer.firstname} ${p.customer.lastname}`.toLowerCase() : ""
      const matchSearch =
        !q ||
        p.reference.toLowerCase().includes(q) ||
        customerName.includes(q) ||
        (p.job?.title ?? "").toLowerCase().includes(q)
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [payments, search, statusFilter])

  // Ad1: stat tiles are computed from the current page only (no dedicated
  // summary endpoint exists — see requirements.md's open question). Labelled
  // accordingly so they never read as full-ledger totals.
  const stats = useMemo(() => {
    const totalRevenue = payments.filter((p) => p.status === "HELD" || p.status === "RELEASED").reduce((s, p) => s + Number(p.amount), 0)
    const totalPayouts = payments.filter((p) => p.status === "RELEASED").reduce((s, p) => s + Number(p.artisanAmount), 0)
    const totalFees = payments.filter((p) => p.status === "HELD" || p.status === "RELEASED").reduce((s, p) => s + Number(p.platformFee), 0)
    const needsReview = payments.filter((p) => p.status === "PENDING_TRANSFER" || p.status === "TRANSFER_FAILED").length
    return { totalRevenue, totalPayouts, totalFees, needsReview }
  }, [payments])

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

  const canRefund = (p: BackendPayment) => p.status === "HELD" || p.status === "RELEASED"

  // QA LOW (partial-refund amount): the refundable ceiling is whatever's
  // left after any prior partial refund, not the original payment amount —
  // matches the backend's own `amount - refundedAmount` check in
  // `adminRefund`, so the UI can't offer an amount the server would reject.
  const remainingRefundable = (p: BackendPayment | null) => +(Number(p?.amount ?? 0) - Number(p?.refundedAmount ?? 0)).toFixed(2)

  const openRefund = (p: BackendPayment) => {
    setRefundPayment(p)
    setRefundMode("full")
    setRefundAmount("")
  }

  const partialAmountValid = () => {
    const n = Number(refundAmount)
    return refundAmount.trim() !== "" && Number.isFinite(n) && n > 0 && n <= remainingRefundable(refundPayment)
  }

  const handleRefund = async () => {
    if (!refundPayment) return
    if (refundMode === "partial" && !partialAmountValid()) {
      toast.error("Enter a valid amount that doesn't exceed the remaining refundable balance.")
      return
    }
    setIsRefunding(true)
    try {
      await apiFetch(`/payments/admin/refund/${refundPayment.id}`, {
        method: "POST",
        body: JSON.stringify(refundMode === "partial" ? { amountGhs: Number(refundAmount) } : {}),
      })
      // Ad2: `adminRefund` only returns `{ message }`, not the updated
      // payment row, so the optimistic update mirrors its own accumulation
      // logic — a partial refund adds to `refundedAmount` and only flips
      // `status` to the terminal REFUNDED once the cumulative total reaches
      // the full amount; a full refund always closes out whatever remained.
      const amountJustRefunded = refundMode === "partial" ? Number(refundAmount) : remainingRefundable(refundPayment)
      setPayments((prev) => prev.map((p) => {
        if (p.id !== refundPayment.id) return p
        const newRefundedAmount = +(Number(p.refundedAmount ?? 0) + amountJustRefunded).toFixed(2)
        return {
          ...p,
          refundedAmount: newRefundedAmount,
          status: newRefundedAmount >= Number(p.amount) ? "REFUNDED" : p.status,
        }
      }))
      toast.success(`Refunded ${formatCurrency(amountJustRefunded)} to the customer's original payment method.`)
      setRefundPayment(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund failed.")
    } finally {
      setIsRefunding(false)
    }
  }

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return
    setPage(p)
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
            <p className="text-sm text-muted-foreground">
              Full ledger of platform payments and refunds — from Paystack
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-transparent sm:shrink-0"
            disabled
            title="CSV export not available yet — no backend endpoint"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Ad1: stat tiles are current-page arithmetic, not a full-ledger summary */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Revenue (this page)", value: formatCurrency(stats.totalRevenue), icon: DollarSign, iconBg: "bg-primary/10", iconColor: "text-primary" },
            { label: "Payouts (this page)", value: formatCurrency(stats.totalPayouts), icon: ArrowDownRight, iconBg: "bg-muted", iconColor: "text-foreground" },
            { label: "Fees (this page)", value: formatCurrency(stats.totalFees), icon: ArrowUpRight, iconBg: "bg-primary/10", iconColor: "text-primary" },
            { label: "Needs Review (this page)", value: String(stats.needsReview), icon: AlertTriangle, iconBg: "bg-orange-100", iconColor: "text-orange-700" },
          ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
            <Card key={label} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className={cn("inline-flex rounded-full p-2.5", iconBg)}>
                  <Icon className={cn("h-4 w-4", iconColor)} />
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search this page by ref, customer, job…"
                className="h-8 pl-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {Object.keys(paymentStatusConfig).map((s) => (
                  <SelectItem key={s} value={s}>{getPaymentStatusConfig(s).label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Couldn&apos;t load transactions.</p>
              <Button variant="outline" className="bg-transparent" onClick={() => load(page)}>Try Again</Button>
            </div>
          ) : (
            <>
              {/* QA MEDIUM (2026-08-20): below md, this table's Status column
                  was pushed off-screen with no scroll affordance — replaced
                  with stacked cards below. The md+ table also had a LOW finding
                  (Actions column scrolled out of view at ordinary 1440px
                  widths, no visible affordance) — fixed by making the Actions
                  column sticky to the right edge with its own background, so
                  Refund/View stay reachable without requiring a sideways
                  scroll to be discovered first. */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Artisan</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="text-right">Payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="sticky right-0 z-10 bg-background text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.1)]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-16 text-center text-muted-foreground">
                          No transactions match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((p) => {
                        const cfg = getPaymentStatusConfig(p.status)
                        const customerName = p.customer ? `${p.customer.firstname} ${p.customer.lastname}`.trim() : "Unknown"
                        return (
                          <TableRow key={p.id} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-xs text-muted-foreground">{p.reference}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarImage src={p.customer?.profilePicture || naviiAvatar(customerName, 24)} />
                                  <AvatarFallback className="text-xs">{customerName[0]}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-foreground">{customerName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">Artisan #{p.artisanProfileId}</TableCell>
                            <TableCell className="max-w-[140px]">
                              <p className="truncate text-sm text-muted-foreground">{p.job?.title ?? `Job #${p.jobId}`}</p>
                            </TableCell>
                            <TableCell className="text-right">
                              <p className="font-medium text-foreground">{formatCurrency(p.amount)}</p>
                              {Number(p.refundedAmount ?? 0) > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Refunded {formatCurrency(p.refundedAmount ?? 0)}
                                  {p.status !== "REFUNDED" && " (partial)"}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(p.platformFee)}</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(p.artisanAmount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-xs", cfg.className)}>
                                <cfg.icon className="h-3 w-3" />
                                {cfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(p.createdAt)}</TableCell>
                            <TableCell className="sticky right-0 z-10 bg-background shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.1)]">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setDetailPayment(p); setShowTechDetails(false) }}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 bg-transparent px-2 text-xs disabled:opacity-40"
                                  disabled={!canRefund(p)}
                                  title={!canRefund(p) ? `Refund disabled — payment must be Withheld or Paid Out (currently ${cfg.label})` : undefined}
                                  onClick={() => openRefund(p)}
                                >
                                  Refund
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y md:hidden">
                {filtered.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    No transactions match the current filters.
                  </p>
                ) : (
                  filtered.map((p) => {
                    const cfg = getPaymentStatusConfig(p.status)
                    const customerName = p.customer ? `${p.customer.firstname} ${p.customer.lastname}`.trim() : "Unknown"
                    return (
                      <div key={p.id} className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarImage src={p.customer?.profilePicture || naviiAvatar(customerName, 24)} />
                              <AvatarFallback className="text-xs">{customerName[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-foreground">{customerName}</span>
                          </div>
                          <Badge variant="outline" className={cn("shrink-0 text-xs", cfg.className)}>
                            <cfg.icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{p.job?.title ?? `Job #${p.jobId}`}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{fmtDate(p.createdAt)}</span>
                          <span className="text-right">
                            <span className="font-medium text-foreground">{formatCurrency(p.amount)}</span>
                            {Number(p.refundedAmount ?? 0) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Refunded {formatCurrency(p.refundedAmount ?? 0)}
                                {p.status !== "REFUNDED" && " (partial)"}
                              </p>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-xs text-muted-foreground">
                          <span>Ref: {p.reference}</span>
                          <span>Fee: {formatCurrency(p.platformFee)}</span>
                          <span>Payout: {formatCurrency(p.artisanAmount)}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 flex-1 bg-transparent text-xs"
                            onClick={() => { setDetailPayment(p); setShowTechDetails(false) }}
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 flex-1 bg-transparent text-xs disabled:opacity-40"
                            disabled={!canRefund(p)}
                            title={!canRefund(p) ? `Refund disabled — payment must be Withheld or Paid Out (currently ${cfg.label})` : undefined}
                            onClick={() => openRefund(p)}
                          >
                            Refund
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {total} transactions{search || statusFilter !== "ALL" ? " (filtered within this page)" : ""}
                </span>
                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); goToPage(page - 1) }} className={page === 1 ? "pointer-events-none opacity-50" : ""} />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .map((p, i, arr) => (
                          <PaginationItem key={p}>
                            {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
                            <PaginationLink href="#" isActive={p === page} onClick={(e) => { e.preventDefault(); goToPage(p) }}>{p}</PaginationLink>
                          </PaginationItem>
                        ))}
                      <PaginationItem>
                        <PaginationNext href="#" onClick={(e) => { e.preventDefault(); goToPage(page + 1) }} className={page === totalPages ? "pointer-events-none opacity-50" : ""} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Payment Detail dialog (3.5) */}
      <Dialog open={!!detailPayment} onOpenChange={(o) => !o && setDetailPayment(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Detail</DialogTitle>
            <DialogDescription>
              {detailPayment?.reference} — {detailPayment?.job?.title ?? `Job #${detailPayment?.jobId}`}
            </DialogDescription>
          </DialogHeader>
          {detailPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium text-foreground">
                    {detailPayment.customer ? `${detailPayment.customer.firstname} ${detailPayment.customer.lastname}` : "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Artisan</p>
                  <p className="font-medium text-foreground">Artisan #{detailPayment.artisanProfileId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid on</p>
                  <p className="font-medium text-foreground">{detailPayment.paidAt ? fmtDate(detailPayment.paidAt) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className={cn("text-xs", getPaymentStatusConfig(detailPayment.status).className)}>
                    {getPaymentStatusConfig(detailPayment.status).label}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Job amount</span><span>{formatCurrency(detailPayment.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span>− {formatCurrency(detailPayment.platformFee)}</span></div>
                <div className="flex justify-between border-t pt-2 font-semibold"><span>Artisan payout</span><span>{formatCurrency(detailPayment.artisanAmount)}</span></div>
                {/* QA LOW (partial-refund amount): the only lasting record of
                    "how much" was previously the success toast at refund
                    time — this persists it on the one screen an admin would
                    come back to later to check. */}
                {Number(detailPayment.refundedAmount ?? 0) > 0 && (
                  <div className="flex justify-between border-t pt-2 text-destructive">
                    <span>Refunded {detailPayment.status !== "REFUNDED" && "(partial)"}</span>
                    <span className="font-semibold">− {formatCurrency(detailPayment.refundedAmount ?? 0)}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => setShowTechDetails((v) => !v)}
              >
                {showTechDetails ? "▾" : "▸"} Show technical details
              </button>
              {showTechDetails && (
                <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                  <p>transferReference: {detailPayment.transferReference ?? "null"}</p>
                  <p>transferCode: {detailPayment.transferCode ?? "null"}</p>
                  <p>channel: {detailPayment.channel ?? "—"}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="items-center justify-between gap-2 sm:justify-between">
            {detailPayment && !canRefund(detailPayment) && (
              <span className="text-xs text-muted-foreground">
                Refund disabled — payment must be Withheld or Paid Out (currently {getPaymentStatusConfig(detailPayment.status).label})
              </span>
            )}
            <Button
              variant="destructive"
              disabled={!detailPayment || !canRefund(detailPayment)}
              onClick={() => { if (detailPayment) { openRefund(detailPayment); setDetailPayment(null) } }}
            >
              Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund dialog (3.5 / Ad2) */}
      <Dialog open={!!refundPayment} onOpenChange={(o) => !o && setRefundPayment(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Refund Payment</DialogTitle>
            <DialogDescription>
              {refundPayment?.reference} — {refundPayment?.job?.title ?? `Job #${refundPayment?.jobId}`}
            </DialogDescription>
          </DialogHeader>
          {refundPayment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-sm">
                <span>Customer: <span className="font-semibold text-foreground">
                  {refundPayment.customer ? `${refundPayment.customer.firstname} ${refundPayment.customer.lastname}` : "Unknown"}
                </span></span>
                <span>Paid: <strong>{formatCurrency(refundPayment.amount)}</strong></span>
              </div>

              {/* QA LOW (partial-refund amount): the refundable ceiling is
                  what's left after any prior partial refund, not the
                  original amount — surfaced here so an admin doesn't try to
                  refund more than the backend will accept. */}
              {Number(refundPayment.refundedAmount ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Already refunded {formatCurrency(refundPayment.refundedAmount ?? 0)} — {formatCurrency(remainingRefundable(refundPayment))} remains refundable.
                </p>
              )}

              <RadioGroup value={refundMode} onValueChange={(v) => setRefundMode(v as "full" | "partial")}>
                <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3", refundMode === "full" && "border-primary bg-primary/5")}>
                  <RadioGroupItem value="full" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Full refund</p>
                    <p className="text-xs text-muted-foreground">
                      Return the remaining {formatCurrency(remainingRefundable(refundPayment))} to the customer&apos;s original payment method.
                    </p>
                  </div>
                </label>
                <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3", refundMode === "partial" && "border-primary bg-primary/5")}>
                  <RadioGroupItem value="partial" className="mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Partial refund</p>
                    <p className="text-xs text-muted-foreground">
                      Return part of the payment — the rest stays held or paid to the artisan.
                    </p>
                    {refundMode === "partial" && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">GH₵</span>
                        <Input
                          type="number"
                          min={0}
                          max={remainingRefundable(refundPayment)}
                          className="h-8 max-w-[140px] text-sm"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </label>
              </RadioGroup>

              <div className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  This refunds{" "}
                  <strong>
                    {refundMode === "partial"
                      ? formatCurrency(partialAmountValid() ? Number(refundAmount) : 0)
                      : formatCurrency(remainingRefundable(refundPayment))}
                  </strong>{" "}
                  to {refundPayment.customer ? `${refundPayment.customer.firstname} ${refundPayment.customer.lastname}` : "the customer"}&apos;s original payment method and cannot be undone.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setRefundPayment(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isRefunding || (refundMode === "partial" && !partialAmountValid())}
              onClick={handleRefund}
            >
              {isRefunding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refund {refundMode === "partial" && partialAmountValid() ? formatCurrency(Number(refundAmount)) : refundPayment ? formatCurrency(remainingRefundable(refundPayment)) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
