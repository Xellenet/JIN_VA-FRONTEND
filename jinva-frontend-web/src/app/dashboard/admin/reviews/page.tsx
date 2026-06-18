"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Flag, Trash2, Eye, Star, Search, MessageSquare } from "lucide-react"
import { naviiAvatar, cn } from "@/lib/utils"
import { toast } from "sonner"

type ReviewStatus = "ACTIVE" | "FLAGGED" | "REMOVED"

interface Review {
  id: string
  authorName: string
  authorEmail: string
  artisanName: string
  rating: number
  comment: string
  createdAt: string
  status: ReviewStatus
  flagReason?: string
}

const mockReviews: Review[] = [
  { id: "1", authorName: "Nana Ama",      authorEmail: "nana@example.com",   artisanName: "Robert Fox",       rating: 5, comment: "Incredible work — cleaned my entire drainage system in under 2 hours. Very professional.", createdAt: "2026-06-10", status: "ACTIVE" },
  { id: "2", authorName: "Kofi Asante",   authorEmail: "kofi@example.com",   artisanName: "Brooklyn Simmons", rating: 1, comment: "Terrible service. Showed up 4 hours late and left the job halfway done. Never booking again!!", createdAt: "2026-06-12", status: "FLAGGED", flagReason: "Potential spam / exaggerated claim" },
  { id: "3", authorName: "Emma Wilson",   authorEmail: "emma@example.com",   artisanName: "Kwame Asante",     rating: 4, comment: "Solid work on the AC unit. Would recommend to anyone needing HVAC service.", createdAt: "2026-06-13", status: "ACTIVE" },
  { id: "4", authorName: "James Mensah",  authorEmail: "james@example.com",  artisanName: "Ama Owusu",        rating: 2, comment: "Materials used were low quality. Had to redo the fence after 2 weeks.", createdAt: "2026-06-14", status: "FLAGGED", flagReason: "Unverified claim" },
  { id: "5", authorName: "Abena Owusu",   authorEmail: "abena@example.com",  artisanName: "Robert Fox",       rating: 5, comment: "Robert fixed our kitchen cabinets beautifully. Will definitely rebook.", createdAt: "2026-06-15", status: "ACTIVE" },
  { id: "6", authorName: "Yaw Darko",     authorEmail: "yaw@example.com",    artisanName: "Brooklyn Simmons", rating: 3, comment: "Average service. The job was done but he left a mess.", createdAt: "2026-06-16", status: "ACTIVE" },
]

const statusCfg: Record<ReviewStatus, { label: string; className: string }> = {
  ACTIVE:  { label: "Active",   className: "bg-primary/10 text-primary border-primary/20" },
  FLAGGED: { label: "Flagged",  className: "bg-destructive/10 text-destructive border-destructive/20" },
  REMOVED: { label: "Removed",  className: "bg-muted text-muted-foreground border-border" },
}

export default function ReviewsPage() {
  const [reviews, setReviews]   = useState<Review[]>(mockReviews)
  const [search, setSearch]     = useState("")
  const [detail, setDetail]     = useState<Review | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)

  const filtered = reviews.filter(
    (r) =>
      r.authorName.toLowerCase().includes(search.toLowerCase()) ||
      r.artisanName.toLowerCase().includes(search.toLowerCase()) ||
      r.comment.toLowerCase().includes(search.toLowerCase()),
  )

  const counts = {
    total:   reviews.length,
    flagged: reviews.filter((r) => r.status === "FLAGGED").length,
    removed: reviews.filter((r) => r.status === "REMOVED").length,
  }

  const flagReview = (id: string) => {
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status: "FLAGGED" as ReviewStatus } : r))
    toast.success("Review flagged for further review.")
  }

  const restoreReview = (id: string) => {
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status: "ACTIVE" as ReviewStatus, flagReason: undefined } : r))
    toast.success("Review restored to active.")
  }

  const removeReview = () => {
    if (!removeId) return
    setReviews((prev) => prev.map((r) => r.id === removeId ? { ...r, status: "REMOVED" as ReviewStatus } : r))
    setRemoveId(null)
    setDetail(null)
    toast.success("Review removed from public view.")
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

  const StarRow = ({ rating }: { rating: number }) => (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  )

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review Moderation</h1>
          <p className="text-sm text-muted-foreground">
            Monitor, flag, and remove reviews that violate platform guidelines
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Reviews", value: counts.total,   className: "text-foreground",  bg: "bg-muted" },
            { label: "Flagged",       value: counts.flagged, className: "text-destructive", bg: "bg-destructive/10" },
            { label: "Removed",       value: counts.removed, className: "text-muted-foreground", bg: "bg-muted" },
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
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{filtered.length} reviews</span>
            </div>
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search reviews…"
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
                  <TableHead>Author</TableHead>
                  <TableHead>Artisan</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="max-w-[200px]">Comment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                      No reviews found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={naviiAvatar(r.authorName, 28)} />
                            <AvatarFallback className="text-xs">{r.authorName[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{r.authorName}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.authorEmail}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{r.artisanName}</TableCell>
                      <TableCell><StarRow rating={r.rating} /></TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm text-muted-foreground">{r.comment}</p>
                        {r.flagReason && (
                          <p className="mt-0.5 text-xs text-destructive">{r.flagReason}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(r.createdAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", statusCfg[r.status].className)}
                        >
                          {statusCfg[r.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetail(r)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {r.status === "ACTIVE" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => flagReview(r.id)}>
                              <Flag className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {r.status === "FLAGGED" && (
                            <Button size="sm" variant="outline" className="h-7 bg-transparent px-2 text-xs" onClick={() => restoreReview(r.id)}>
                              Restore
                            </Button>
                          )}
                          {r.status !== "REMOVED" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setRemoveId(r.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Detail</DialogTitle>
            <DialogDescription>
              By {detail?.authorName} — for {detail?.artisanName}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <StarRow rating={detail.rating} />
                <span className="text-sm text-muted-foreground">{detail.rating}/5</span>
              </div>
              <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground leading-relaxed">
                "{detail.comment}"
              </p>
              {detail.flagReason && (
                <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                  <Flag className="mr-1 inline h-3 w-3" />
                  Flag reason: {detail.flagReason}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Submitted {fmtDate(detail.createdAt)}</span>
                <Badge variant="outline" className={cn("text-xs", statusCfg[detail.status].className)}>
                  {statusCfg[detail.status].label}
                </Badge>
              </div>
            </div>
          )}
          {detail?.status !== "REMOVED" && (
            <DialogFooter className="gap-2">
              {detail?.status === "ACTIVE" && (
                <Button variant="outline" className="bg-transparent" onClick={() => { flagReview(detail!.id); setDetail(null) }}>
                  <Flag className="mr-2 h-4 w-4" /> Flag
                </Button>
              )}
              {detail?.status === "FLAGGED" && (
                <Button variant="outline" className="bg-transparent" onClick={() => { restoreReview(detail!.id); setDetail(null) }}>
                  Restore
                </Button>
              )}
              <Button variant="destructive" onClick={() => { setRemoveId(detail!.id); setDetail(null) }}>
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog open={!!removeId} onOpenChange={(o) => !o && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Review</AlertDialogTitle>
            <AlertDialogDescription>
              This review will be hidden from public view. The author will not be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeReview} className="bg-destructive text-white hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
