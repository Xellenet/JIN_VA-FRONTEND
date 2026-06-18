"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
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
} from "lucide-react"
import { naviiAvatar, cn } from "@/lib/utils"
import { toast } from "sonner"

interface QueueItem {
  id: string
  artisanName: string
  artisanEmail: string
  caption: string
  tag: string
  fileType: "image" | "video"
  submittedAt: string
  status: "PENDING" | "APPROVED" | "REJECTED"
}

const mockQueue: QueueItem[] = [
  { id: "1", artisanName: "Robert Fox",        artisanEmail: "robert@example.com",   caption: "Kitchen cabinet repair", tag: "Carpentry",  fileType: "image", submittedAt: "2026-06-16", status: "PENDING" },
  { id: "2", artisanName: "Brooklyn Simmons",  artisanEmail: "brooklyn@example.com", caption: "Bathroom plumbing install", tag: "Plumbing", fileType: "image", submittedAt: "2026-06-16", status: "PENDING" },
  { id: "3", artisanName: "Kwame Asante",      artisanEmail: "kwame@example.com",    caption: "AC unit installation walkthrough", tag: "HVAC", fileType: "video", submittedAt: "2026-06-15", status: "PENDING" },
  { id: "4", artisanName: "Ama Owusu",         artisanEmail: "ama@example.com",      caption: "Outdoor fence build", tag: "Carpentry",      fileType: "image", submittedAt: "2026-06-15", status: "PENDING" },
  { id: "5", artisanName: "James Mensah",      artisanEmail: "james@example.com",    caption: "Electrical panel upgrade", tag: "Electrical", fileType: "image", submittedAt: "2026-06-14", status: "PENDING" },
]

export default function PortfolioQueuePage() {
  const [items, setItems]         = useState<QueueItem[]>(mockQueue)
  const [search, setSearch]       = useState("")
  const [preview, setPreview]     = useState<QueueItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<QueueItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const filtered = items.filter(
    (i) =>
      i.artisanName.toLowerCase().includes(search.toLowerCase()) ||
      i.tag.toLowerCase().includes(search.toLowerCase()) ||
      i.caption.toLowerCase().includes(search.toLowerCase()),
  )

  const pending  = items.filter((i) => i.status === "PENDING").length
  const approved = items.filter((i) => i.status === "APPROVED").length
  const rejected = items.filter((i) => i.status === "REJECTED").length

  const approve = (id: string) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "APPROVED" } : i))
    setPreview(null)
    toast.success("Portfolio item approved and published.")
  }

  const reject = () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) { toast.error("Please provide a reason."); return }
    setItems((prev) => prev.map((i) => i.id === rejectTarget.id ? { ...i, status: "REJECTED" } : i))
    setRejectTarget(null)
    setRejectReason("")
    toast.success("Portfolio item rejected. Artisan will be notified.")
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
          {[
            { label: "Pending Review", value: pending,  color: "text-foreground",     bg: "bg-muted" },
            { label: "Approved",       value: approved, color: "text-primary",        bg: "bg-primary/10" },
            { label: "Rejected",       value: rejected, color: "text-destructive",    bg: "bg-destructive/10" },
          ].map(({ label, value, color, bg }) => (
            <Card key={label}>
              <CardContent className={cn("p-4", bg)}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("mt-0.5 text-2xl font-bold", color)}>{value}</p>
              </CardContent>
            </Card>
          ))}
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                      No items found.
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
                            <p className="truncate text-xs text-muted-foreground">{item.artisanEmail}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate text-sm text-foreground">{item.caption}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{item.tag}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          {item.fileType === "video"
                            ? <><Video className="h-3.5 w-3.5" /> Video</>
                            : <><ImageIcon className="h-3.5 w-3.5" /> Image</>}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(item.submittedAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            item.status === "APPROVED"  && "bg-primary/10 text-primary border-primary/20",
                            item.status === "PENDING"   && "bg-muted text-muted-foreground border-border",
                            item.status === "REJECTED"  && "bg-destructive/10 text-destructive border-destructive/20",
                          )}
                        >
                          {item.status === "APPROVED" && <CheckCircle className="mr-1 h-3 w-3" />}
                          {item.status === "REJECTED" && <XCircle className="mr-1 h-3 w-3" />}
                          {item.status}
                        </Badge>
                      </TableCell>
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
                          {item.status === "PENDING" && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90"
                                onClick={() => approve(item.id)}
                              >
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-xs"
                                onClick={() => setRejectTarget(item)}
                              >
                                <XCircle className="mr-1 h-3 w-3" />
                                Reject
                              </Button>
                            </>
                          )}
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
            <DialogDescription>{preview?.caption}</DialogDescription>
          </DialogHeader>
          <div className="flex h-56 items-center justify-center rounded-xl bg-muted">
            {preview?.fileType === "video"
              ? <Video className="h-12 w-12 text-muted-foreground/40" />
              : <ImageIcon className="h-12 w-12 text-muted-foreground/40" />}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{preview?.tag}</Badge>
            <span>by {preview?.artisanName}</span>
          </div>
          {preview?.status === "PENDING" && (
            <DialogFooter className="gap-2">
              <Button variant="outline" className="bg-transparent" onClick={() => setRejectTarget(preview!)}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => approve(preview!.id)}>
                <CheckCircle className="mr-2 h-4 w-4" /> Approve
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
              Provide a reason so the artisan knows what to fix.
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
            <Button variant="destructive" onClick={reject}>Send Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
