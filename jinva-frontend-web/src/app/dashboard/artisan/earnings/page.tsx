"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Wallet,
  Clock,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ReceiptText,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { formatCurrency, cn } from "@/lib/utils"
import { toast } from "sonner"
import { getPaymentStatusConfig, RETRYABLE_PAYOUT_STATUSES } from "@/lib/status-badges"

// A2: the artisan-facing equivalent of the customer's GET /payments/history —
// GET /payments/my-earnings returns a deliberately minimal shape (see
// PaymentsService.getMyEarnings on the backend): job, the artisan's own
// payout amount, status, and date only. It does NOT include the job's gross
// amount, the platform fee, or any customer identity — unlike
// design-spec.md's mockup (which shows Gross/Fee columns and a first-name
// customer context line), those fields simply aren't in this endpoint's
// response today. Rather than guess/fabricate them, this page renders only
// what the backend actually returns and says so in the table caption; this
// is a real gap worth flagging back to product/backend, not a frontend bug.
interface EarningRow {
  id: number
  jobId: number
  job: { id: number; title: string | null }
  artisanAmount: number
  status: string
  date: string
}

export default function ArtisanEarningsPage() {
  const [rows, setRows] = useState<EarningRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [hasPayoutMethod, setHasPayoutMethod] = useState<boolean | null>(null)
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null)
  const [isRetryingAll, setIsRetryingAll] = useState(false)

  const load = () => {
    setIsLoading(true)
    setLoadError(false)
    apiFetch<EarningRow[]>("/payments/my-earnings")
      .then(setRows)
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
    apiFetch<{ payoutType?: string }>("/users/me/artisan-profile")
      .then((p) => setHasPayoutMethod(!!p.payoutType))
      .catch(() => setHasPayoutMethod(null))
  }, [])

  const stuckRows = useMemo(
    () => rows.filter((r) => (RETRYABLE_PAYOUT_STATUSES as readonly string[]).includes(r.status)),
    [rows],
  )

  const stats = useMemo(() => {
    const totalEarnings = rows
      .filter((r) => r.status === "RELEASED")
      .reduce((sum, r) => sum + Number(r.artisanAmount), 0)
    const pendingPayout = rows
      .filter((r) => (RETRYABLE_PAYOUT_STATUSES as readonly string[]).includes(r.status) || r.status === "HELD")
      .reduce((sum, r) => sum + Number(r.artisanAmount), 0)
    const now = new Date()
    const thisMonth = rows
      .filter((r) => r.status === "RELEASED" && new Date(r.date).getMonth() === now.getMonth() && new Date(r.date).getFullYear() === now.getFullYear())
      .reduce((sum, r) => sum + Number(r.artisanAmount), 0)
    return { totalEarnings, pendingPayout, thisMonth }
  }, [rows])

  const handleRetry = async (jobId: number) => {
    setRetryingJobId(jobId)
    try {
      await apiFetch(`/payments/retry-transfer/${jobId}`, { method: "POST" })
      toast.success("Transfer retry initiated.")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed — the payout is still blocked.")
    } finally {
      setRetryingJobId(null)
    }
  }

  // QA LOW (2026-08-20): the banner said "N payouts need attention" but its
  // button only ever retried stuckRows[0]. Retries every stuck row in
  // sequence now, so the banner's copy and its action actually match; each
  // row below still keeps its own single-row Retry button too.
  const handleRetryAll = async () => {
    setIsRetryingAll(true)
    const targets = stuckRows.map((r) => r.jobId)
    let succeeded = 0
    for (const jobId of targets) {
      try {
        await apiFetch(`/payments/retry-transfer/${jobId}`, { method: "POST" })
        succeeded += 1
      } catch {
        // continue attempting the remaining rows; failures are summarized below
      }
    }
    if (succeeded === targets.length) {
      toast.success(`Retried ${succeeded} payout${succeeded === 1 ? "" : "s"}.`)
    } else if (succeeded > 0) {
      toast.warning(`Retried ${succeeded} of ${targets.length} payouts — the rest are still blocked.`)
    } else {
      toast.error("Retry failed — the payouts are still blocked.")
    }
    load()
    setIsRetryingAll(false)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Payments</p>
          <h1 className="mt-0.5 text-2xl font-bold text-foreground">Earnings &amp; Payouts</h1>
          <p className="text-sm text-muted-foreground">What you&apos;ve earned and what&apos;s still on its way</p>
        </div>

        {/* A3: pending-transfer / no-payout-method banners */}
        {hasPayoutMethod === false && (
          <Alert>
            <Wallet className="h-4 w-4" />
            <AlertTitle>No payout method on file</AlertTitle>
            <AlertDescription>
              <p>Add a mobile money or bank account so we can pay you when a job completes.</p>
              <Button size="sm" className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <Link href="/dashboard/artisan/settings">Add Payout Method</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {hasPayoutMethod === true && stuckRows.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{stuckRows.length} payout{stuckRows.length > 1 ? "s" : ""} need{stuckRows.length > 1 ? "" : "s"} attention</AlertTitle>
            <AlertDescription>
              <p>A transfer to your payout account didn&apos;t go through. You can retry now.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 bg-transparent"
                disabled={isRetryingAll}
                onClick={handleRetryAll}
              >
                {isRetryingAll && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Retry {stuckRows.length > 1 ? `All ${stuckRows.length}` : "Transfer"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        ) : loadError ? (
          <Card>
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon"><AlertTriangle className="text-muted-foreground" /></EmptyMedia>
                <EmptyTitle>Couldn&apos;t load your earnings</EmptyTitle>
                <EmptyDescription>Something went wrong fetching your payment history.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" className="bg-transparent" onClick={load}>Try Again</Button>
              </EmptyContent>
            </Empty>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Wallet className="text-muted-foreground" /></EmptyMedia>
                <EmptyTitle>No earnings yet</EmptyTitle>
                <EmptyDescription>Completed jobs you&apos;re paid for will show up here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Total Earnings (paid out)", value: formatCurrency(stats.totalEarnings), icon: Wallet, iconBg: "bg-primary/10", iconColor: "text-primary" },
                { label: "Pending Payout", value: formatCurrency(stats.pendingPayout), icon: Clock, iconBg: "bg-muted", iconColor: "text-foreground" },
                { label: "Paid Out This Month", value: formatCurrency(stats.thisMonth), icon: Calendar, iconBg: "bg-primary/10", iconColor: "text-primary" },
              ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className={cn("inline-flex rounded-full p-2.5", iconBg)}>
                      <Icon className={cn("h-4 w-4", iconColor)} />
                    </div>
                    <p className="mt-3 text-xl font-bold text-foreground">{value}</p>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <div className="flex items-center gap-2 border-b p-4">
                <ReceiptText className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Job Payments</h3>
                  <p className="text-xs text-muted-foreground">
                    Your payout already has the platform fee taken out — full fee breakdown isn&apos;t available from this list yet.
                  </p>
                </div>
              </div>
              {/* QA MEDIUM (2026-08-20): below md, the 5-column table forces an
                  undiscoverable horizontal scroll to see Status — replaced with
                  stacked cards carrying the same fields/actions. Table stays
                  for md+ where every column fits without scrolling. */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Your Payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const cfg = getPaymentStatusConfig(r.status)
                      const isRetryable = (RETRYABLE_PAYOUT_STATUSES as readonly string[]).includes(r.status)
                      return (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell className="max-w-[180px] truncate font-medium text-foreground">
                            {r.job?.title ?? `Job #${r.jobId}`}
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground">
                            {formatCurrency(r.artisanAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cfg.className}>
                              <cfg.icon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </TableCell>
                          <TableCell className="text-right">
                            {isRetryable ? (
                              hasPayoutMethod === false ? (
                                <Button size="sm" variant="outline" className="h-7 bg-transparent px-2 text-xs" asChild>
                                  <Link href="/dashboard/artisan/settings">Add Payout Method</Link>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 bg-transparent px-2 text-xs"
                                  disabled={retryingJobId === r.jobId}
                                  onClick={() => handleRetry(r.jobId)}
                                >
                                  {retryingJobId === r.jobId && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                  Retry
                                </Button>
                              )
                            ) : (
                              <Link href={`/dashboard/artisan/jobs/${r.jobId}`} className="text-xs text-primary hover:underline">
                                View Job
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y md:hidden">
                {rows.map((r) => {
                  const cfg = getPaymentStatusConfig(r.status)
                  const isRetryable = (RETRYABLE_PAYOUT_STATUSES as readonly string[]).includes(r.status)
                  return (
                    <div key={r.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate font-medium text-foreground">{r.job?.title ?? `Job #${r.jobId}`}</p>
                        <Badge variant="outline" className={cn("shrink-0", cfg.className)}>
                          <cfg.icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <span className="font-medium text-foreground">{formatCurrency(r.artisanAmount)}</span>
                      </div>
                      <div className="pt-1">
                        {isRetryable ? (
                          hasPayoutMethod === false ? (
                            <Button size="sm" variant="outline" className="h-7 w-full bg-transparent text-xs" asChild>
                              <Link href="/dashboard/artisan/settings">Add Payout Method</Link>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-full bg-transparent text-xs"
                              disabled={retryingJobId === r.jobId}
                              onClick={() => handleRetry(r.jobId)}
                            >
                              {retryingJobId === r.jobId && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              Retry
                            </Button>
                          )
                        ) : (
                          <Link href={`/dashboard/artisan/jobs/${r.jobId}`} className="text-xs text-primary hover:underline">
                            View Job
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t px-4 py-3 text-xs text-muted-foreground">
                Released when the job is marked complete — no scheduled payout delay.
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
