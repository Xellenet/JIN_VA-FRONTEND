"use client"

import { useState, useMemo } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
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
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Search,
  Download,
} from "lucide-react"
import { naviiAvatar, cn } from "@/lib/utils"
import { toast } from "sonner"

type TxStatus = "COMPLETED" | "PENDING" | "REFUNDED" | "FAILED"
type TxType   = "PAYMENT" | "REFUND" | "PAYOUT"

interface Transaction {
  id: string
  ref: string
  clientName: string
  artisanName: string
  service: string
  amount: number
  fee: number
  net: number
  type: TxType
  status: TxStatus
  date: string
}

const mockTx: Transaction[] = [
  { id: "1",  ref: "TX-1001", clientName: "Nana Ama",      artisanName: "Robert Fox",       service: "Plumbing Repair",      amount: 280,  fee: 14, net: 266, type: "PAYMENT",  status: "COMPLETED", date: "2026-06-01" },
  { id: "2",  ref: "TX-1002", clientName: "Kofi Asante",   artisanName: "Brooklyn Simmons", service: "Electrical Install",   amount: 420,  fee: 21, net: 399, type: "PAYMENT",  status: "COMPLETED", date: "2026-06-03" },
  { id: "3",  ref: "TX-1003", clientName: "Emma Wilson",   artisanName: "Kwame Asante",     service: "AC Service",           amount: 150,  fee:  0, net: 150, type: "REFUND",   status: "REFUNDED",  date: "2026-06-05" },
  { id: "4",  ref: "TX-1004", clientName: "James Mensah",  artisanName: "Ama Owusu",        service: "Fence Installation",   amount: 600,  fee: 30, net: 570, type: "PAYMENT",  status: "PENDING",   date: "2026-06-07" },
  { id: "5",  ref: "TX-1005", clientName: "Abena Owusu",   artisanName: "Robert Fox",       service: "Cabinet Repair",       amount: 180,  fee: 9,  net: 171, type: "PAYMENT",  status: "COMPLETED", date: "2026-06-09" },
  { id: "6",  ref: "TX-1006", clientName: "Yaw Darko",     artisanName: "Brooklyn Simmons", service: "Pipe Replacement",     amount: 340,  fee: 17, net: 323, type: "PAYMENT",  status: "FAILED",    date: "2026-06-10" },
  { id: "7",  ref: "TX-1007", clientName: "System",        artisanName: "Robert Fox",       service: "Weekly Payout",        amount: 1200, fee: 0,  net: 1200, type: "PAYOUT",  status: "COMPLETED", date: "2026-06-11" },
  { id: "8",  ref: "TX-1008", clientName: "System",        artisanName: "Brooklyn Simmons", service: "Weekly Payout",        amount: 980,  fee: 0,  net: 980,  type: "PAYOUT",  status: "COMPLETED", date: "2026-06-11" },
  { id: "9",  ref: "TX-1009", clientName: "Esi Boateng",   artisanName: "Kwame Asante",     service: "Roofing Repair",       amount: 520,  fee: 26, net: 494, type: "PAYMENT",  status: "COMPLETED", date: "2026-06-14" },
  { id: "10", ref: "TX-1010", clientName: "Kweku Mensah",  artisanName: "Ama Owusu",        service: "Interior Painting",    amount: 390,  fee: 19, net: 371, type: "PAYMENT",  status: "PENDING",   date: "2026-06-16" },
]

const statusCfg: Record<TxStatus, { label: string; className: string }> = {
  COMPLETED: { label: "Completed", className: "bg-primary/10 text-primary border-primary/20" },
  PENDING:   { label: "Pending",   className: "bg-muted text-muted-foreground border-border" },
  REFUNDED:  { label: "Refunded",  className: "bg-muted text-muted-foreground border-border" },
  FAILED:    { label: "Failed",    className: "bg-destructive/10 text-destructive border-destructive/20" },
}

const typeCfg: Record<TxType, { label: string; icon: typeof ArrowUpRight }> = {
  PAYMENT: { label: "Payment", icon: ArrowUpRight },
  REFUND:  { label: "Refund",  icon: ArrowDownRight },
  PAYOUT:  { label: "Payout",  icon: ArrowDownRight },
}

export default function TransactionsPage() {
  const [search, setSearch]         = useState("")
  const [statusFilter, setStatusFilter] = useState<TxStatus | "ALL">("ALL")
  const [typeFilter, setTypeFilter]     = useState<TxType | "ALL">("ALL")

  const filtered = useMemo(() => {
    return mockTx.filter((t) => {
      const matchSearch =
        t.ref.toLowerCase().includes(search.toLowerCase()) ||
        t.clientName.toLowerCase().includes(search.toLowerCase()) ||
        t.artisanName.toLowerCase().includes(search.toLowerCase()) ||
        t.service.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === "ALL" || t.status === statusFilter
      const matchType   = typeFilter   === "ALL" || t.type   === typeFilter
      return matchSearch && matchStatus && matchType
    })
  }, [search, statusFilter, typeFilter])

  const totalRevenue   = mockTx.filter((t) => t.type === "PAYMENT"  && t.status === "COMPLETED").reduce((s, t) => s + t.amount, 0)
  const totalPayouts   = mockTx.filter((t) => t.type === "PAYOUT"   && t.status === "COMPLETED").reduce((s, t) => s + t.amount, 0)
  const totalFees      = mockTx.filter((t) => t.status === "COMPLETED").reduce((s, t) => s + t.fee, 0)
  const pendingCount   = mockTx.filter((t) => t.status === "PENDING").length

  const fmtDate  = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  const fmtMoney = (n: number) => `GH₵ ${n.toLocaleString()}`

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
            <p className="text-sm text-muted-foreground">
              Full ledger of all platform payments, refunds, and payouts
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-transparent sm:shrink-0"
            onClick={() => toast.success("Export initiated — file will be emailed to admin.")}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Revenue",    value: fmtMoney(totalRevenue), icon: DollarSign, iconBg: "bg-primary/10",       iconColor: "text-primary" },
            { label: "Total Payouts",    value: fmtMoney(totalPayouts), icon: ArrowDownRight, iconBg: "bg-muted",         iconColor: "text-foreground" },
            { label: "Platform Fees",    value: fmtMoney(totalFees),    icon: ArrowUpRight,   iconBg: "bg-primary/10",   iconColor: "text-primary" },
            { label: "Pending",          value: String(pendingCount),   icon: DollarSign,     iconBg: "bg-muted",         iconColor: "text-muted-foreground" },
          ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
            <Card key={label} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={cn("rounded-full p-2.5", iconBg)}>
                    <Icon className={cn("h-4 w-4", iconColor)} />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          {/* Filters */}
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by ref, client, artisan…"
                className="h-8 pl-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TxType | "ALL")}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="PAYMENT">Payment</SelectItem>
                  <SelectItem value="REFUND">Refund</SelectItem>
                  <SelectItem value="PAYOUT">Payout</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TxStatus | "ALL")}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Artisan</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                      No transactions match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t) => {
                    const TxIcon = typeCfg[t.type].icon
                    return (
                      <TableRow key={t.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs text-muted-foreground">{t.ref}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {t.clientName !== "System" && (
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage src={naviiAvatar(t.clientName, 24)} />
                                <AvatarFallback className="text-xs">{t.clientName[0]}</AvatarFallback>
                              </Avatar>
                            )}
                            <span className="text-sm text-foreground">{t.clientName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{t.artisanName}</TableCell>
                        <TableCell className="max-w-[140px]">
                          <p className="truncate text-sm text-muted-foreground">{t.service}</p>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "flex items-center gap-1 text-xs",
                            t.type === "PAYMENT" ? "text-primary" : "text-muted-foreground",
                          )}>
                            <TxIcon className="h-3 w-3" />
                            {typeCfg[t.type].label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">{fmtMoney(t.amount)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{t.fee > 0 ? fmtMoney(t.fee) : "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(t.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", statusCfg[t.status].className)}>
                            {statusCfg[t.status].label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">
            Showing {filtered.length} of {mockTx.length} transactions
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
