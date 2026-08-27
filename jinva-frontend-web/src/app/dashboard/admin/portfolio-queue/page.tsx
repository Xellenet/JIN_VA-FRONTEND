"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  CheckCircle,
  XCircle,
  Eye,
  ImageIcon,
  Video,
  Search,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { naviiAvatar, resolveMediaUrl } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { QueueCounterCard } from "@/components/dashboard/admin/queue-counter-card"

interface QueueItem {
  id: number
  artisanId: number
  artisanName: string
  fileUrl: string
  fileType: string
  caption: string | null
  tag: string | null
  createdAt: string
}

function isVideo(item: Pick<QueueItem, "fileType">) {
  return item.fileType?.startsWith("video/")
}

export default function PortfolioQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState("")
  const [preview, setPreview] = useState<QueueItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<QueueItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [actioningId, setActioningId] = useState<number | null>(null)

  // Session-only counters — the queue endpoint only ever returns PENDING
  // items, so historical approved/rejected totals aren't available here.
  const [approvedCount, setApprovedCount] = useState(0)
  const [rejectedCount, setRejectedCount] = useState(0)

  const fetchQueue = () => {
    setIsLoading(true)
    setLoadError(false)
    apiFetch<QueueItem[]>("/admin/portfolio/queue")
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchQueue()
  }, [])

  const filtered = items.filter(
    (i) =>
      i.artisanName.toLowerCase().includes(search.toLowerCase()) ||
      (i.tag ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (i.caption ?? "").toLowerCase().includes(search.toLowerCase()),
  )

  const approve = async (id: number) => {
    setActioningId(id)
    try {
      await apiFetch(`/admin/portfolio/${id}/approve`, { method: "PATCH" })
      setItems((prev) => prev.filter((i) => i.id !== id))
      setApprovedCount((c) => c + 1)
      setPreview(null)
      toast.success("Portfolio item approved and published.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve item.")
    } finally {
      setActioningId(null)
    }
  }

  const reject = async () => {
    if (!rejectTarget) return
    if (rejectReason.trim().length < 10) {
      toast.error("Please provide a reason of at least 10 characters.")
      return
    }
    setActioningId(rejectTarget.id)
    try {
      await apiFetch(`/admin/portfolio/${rejectTarget.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
      })
      setItems((prev) => prev.filter((i) => i.id !== rejectTarget.id))
      setRejectedCount((c) => c + 1)
      setPreview(null)
      setRejectTarget(null)
      setRejectReason("")
      toast.success("Portfolio item rejected. Artisan will be notified.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject item.")
    } finally {
      setActioningId(null)
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfolio Moderation</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve artisan portfolio uploads before they go live
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <QueueCounterCard label="Pending Review" value={items.length} isLoading={isLoading} />
          <QueueCounterCard label="Approved" value={approvedCount} tone="primary" sublabel="this session" />
          <QueueCounterCard label="Rejected" value={rejectedCount} tone="destructive" sublabel="this session" />
        </div>

        {/* Table card */}
        <Card>
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {filtered.length} item{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search artisan or tag…"
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
                  <TableHead>Artisan</TableHead>
                  <TableHead>Caption</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : loadError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
                      <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive/60" />
                      <p className="text-sm text-muted-foreground">Couldn&apos;t load the moderation queue.</p>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                      {items.length === 0 ? "No pending portfolio items — you're all caught up." : "No items match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={naviiAvatar(item.artisanName, 32)} />
                            <AvatarFallback className="text-xs">{item.artisanName[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{item.artisanName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate text-sm text-foreground">{item.caption || "—"}</p>
                      </TableCell>
                      <TableCell>
                        {item.tag && <Badge variant="secondary" className="text-xs">{item.tag}</Badge>}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          {isVideo(item)
                            ? <><Video className="h-3.5 w-3.5" /> Video</>
                            : <><ImageIcon className="h-3.5 w-3.5" /> Image</>}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(item.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setPreview(item)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90"
                            disabled={actioningId === item.id}
                            onClick={() => approve(item.id)}
                          >
                            {actioningId === item.id
                              ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              : <CheckCircle className="mr-1 h-3 w-3" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            disabled={actioningId === item.id}
                            onClick={() => setRejectTarget(item)}
                          >
                            <XCircle className="mr-1 h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>{preview?.caption || "No caption provided"}</DialogDescription>
          </DialogHeader>
          <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl bg-black">
            {preview && (
              isVideo(preview)
                ? <video src={resolveMediaUrl(preview.fileUrl)} controls className="h-full w-full object-contain" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={resolveMediaUrl(preview.fileUrl)} alt={preview.caption || "Preview"} className="h-full w-full object-contain" />
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {preview?.tag && <Badge variant="secondary">{preview.tag}</Badge>}
            <span>by {preview?.artisanName}</span>
          </div>
          {preview && (
            <DialogFooter className="gap-2">
              <Button variant="outline" className="bg-transparent" onClick={() => setRejectTarget(preview)}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={actioningId === preview.id}
                onClick={() => approve(preview.id)}
              >
                {actioningId === preview.id
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <CheckCircle className="mr-2 h-4 w-4" />}
                Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Portfolio Item</DialogTitle>
            <DialogDescription>
              Provide a reason (at least 10 characters) so the artisan knows what to fix.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Image too blurry, please re-upload a clearer photo."
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" className="bg-transparent" onClick={() => { setRejectTarget(null); setRejectReason("") }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reject} disabled={actioningId === rejectTarget?.id}>
              {actioningId === rejectTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
