"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
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
import { RatingStars } from "@/components/ui/rating-stars"
import { VerifiedBookingBadge } from "@/components/reviews/verified-booking-badge"
import { ReviewPhotoThumbnails } from "@/components/reviews/review-photo-thumbnails"
import { ReviewReasonDialog } from "@/components/reviews/review-reason-dialog"
import { QueueCounterCard } from "@/components/dashboard/admin/queue-counter-card"
import { Flag, Trash2, Eye, Search, MessageSquare, History, AlertTriangle, Loader2, BadgeCheck } from "lucide-react"
import { naviiAvatar, cn } from "@/lib/utils"
import { apiFetch, apiFetchWithMeta } from "@/lib/api"
import { toast } from "sonner"
import type { AdminApiReview, ReviewModerationLogEntry, ReviewStatus } from "@/lib/types"

const PAGE_SIZE = 20

const statusCfg: Record<ReviewStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-primary/10 text-primary border-primary/20" },
  FLAGGED: { label: "Flagged", className: "bg-destructive/10 text-destructive border-destructive/20" },
  REMOVED: { label: "Removed", className: "bg-muted text-muted-foreground border-border" },
}

const actionCfg: Record<ReviewModerationLogEntry["action"], { label: string; className: string }> = {
  FLAG: { label: "Flagged", className: "bg-destructive/10 text-destructive border-destructive/20" },
  REMOVE: { label: "Removed", className: "bg-muted text-muted-foreground border-border" },
  RESTORE: { label: "Restored", className: "bg-primary/10 text-primary border-primary/20" },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
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

function StarRow({ rating }: Readonly<{ rating: number }>) {
  return <RatingStars rating={rating} size="dense" showValue={false} />
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminApiReview[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalReviews, setTotalReviews] = useState(0)
  const [flaggedCount, setFlaggedCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState("")

  const [detail, setDetail] = useState<AdminApiReview | null>(null)
  const [flagTarget, setFlagTarget] = useState<AdminApiReview | null>(null)
  const [removeTarget, setRemoveTarget] = useState<AdminApiReview | null>(null)
  const [restoringId, setRestoringId] = useState<number | null>(null)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [moderationLog, setModerationLog] = useState<ReviewModerationLogEntry[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)

  const removedCount = useMemo(
    () => moderationLog.filter((e) => e.action === "REMOVE").length,
    [moderationLog],
  )

  const loadReviews = useCallback(async (p: number) => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const { data, meta } = await apiFetchWithMeta<AdminApiReview[]>(`/admin/reviews?page=${p}&limit=${PAGE_SIZE}`)
      const entries = Array.isArray(data) ? data : []
      if (entries.length === 0 && p > 1) {
        await loadReviews(p - 1)
        return
      }
      setReviews(entries)
      setPage(p)
      setTotalPages(extractTotalPages(meta))
      setTotalReviews(extractTotal(meta))
    } catch {
      setLoadError(true)
      setReviews([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadFlaggedCount = useCallback(async () => {
    try {
      const { meta } = await apiFetchWithMeta<AdminApiReview[]>(`/admin/reviews?status=FLAGGED&limit=1`)
      setFlaggedCount(extractTotal(meta))
    } catch {
      // Non-blocking — the stat card just shows 0 if this fails.
    }
  }, [])

  const loadModerationLog = useCallback(async (p: number, append: boolean) => {
    setHistoryLoading(true)
    try {
      const { data, meta } = await apiFetchWithMeta<ReviewModerationLogEntry[]>(
        `/admin/reviews/moderation-log?page=${p}&limit=100`,
      )
      const entries = Array.isArray(data) ? data : []
      setModerationLog((prev) => (append ? [...prev, ...entries] : entries))
      setHistoryPage(p)
      setHistoryTotalPages(extractTotalPages(meta))
    } catch {
      toast.error("Couldn't load moderation history.")
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReviews(1)
    loadFlaggedCount()
    loadModerationLog(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshAfterModeration = useCallback(async () => {
    await Promise.all([loadReviews(page), loadFlaggedCount(), loadModerationLog(1, false)])
  }, [page, loadReviews, loadFlaggedCount, loadModerationLog])

  const filtered = reviews.filter((r) => {
    const artisanName = r.artisanProfile?.businessName
      || (r.reviewedUser ? `${r.reviewedUser.firstname} ${r.reviewedUser.lastname}`.trim() : "")
    const q = search.toLowerCase()
    return (
      r.reviewerName.toLowerCase().includes(q)
      || artisanName.toLowerCase().includes(q)
      || (r.review ?? "").toLowerCase().includes(q)
    )
  })

  const handleFlagSubmit = async (reason: string) => {
    if (!flagTarget) return
    await apiFetch(`/reviews/${flagTarget.id}/flag`, { method: "POST", body: JSON.stringify({ reason }) })
    toast.success("Review flagged and hidden from public view.")
    await refreshAfterModeration()
  }

  const handleRemoveSubmit = async (reason: string) => {
    if (!removeTarget) return
    await apiFetch(`/admin/reviews/${removeTarget.id}/remove`, { method: "PATCH", body: JSON.stringify({ reason }) })
    toast.success("Review permanently removed.")
    await refreshAfterModeration()
  }

  const handleRestore = async (review: AdminApiReview) => {
    setRestoringId(review.id)
    try {
      await apiFetch(`/admin/reviews/${review.id}/restore`, { method: "PATCH" })
      toast.success("Review restored to active.")
      setDetail(null)
      await refreshAfterModeration()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore review.")
    } finally {
      setRestoringId(null)
    }
  }

  const artisanNameOf = (r: AdminApiReview) =>
    r.artisanProfile?.businessName
    || (r.reviewedUser ? `${r.reviewedUser.firstname} ${r.reviewedUser.lastname}`.trim() : "Unknown")

  const reviewerNameOf = (r: AdminApiReview) =>
    r.reviewerUser ? `${r.reviewerUser.firstname} ${r.reviewerUser.lastname}`.trim() : r.reviewerName

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review Moderation</h1>
          <p className="text-sm text-muted-foreground">
            Monitor, flag, and remove reviews that violate platform guidelines
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <QueueCounterCard label="Total Reviews" value={totalReviews} isLoading={isLoading} />
          <QueueCounterCard label="Flagged" value={flaggedCount} tone="destructive" />
          <QueueCounterCard label="Removed" value={removedCount} tone="muted" />
        </div>

        {/* Table */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{filtered.length} reviews</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 bg-transparent text-xs"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="h-3.5 w-3.5" />
                Removal history
              </Button>
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
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : loadError ? (
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon"><AlertTriangle className="text-muted-foreground" /></EmptyMedia>
                <EmptyTitle>Couldn&apos;t load reviews</EmptyTitle>
                <EmptyDescription>Something went wrong on our end.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" className="bg-transparent" onClick={() => loadReviews(page)}>Retry</Button>
              </EmptyContent>
            </Empty>
          ) : filtered.length === 0 ? (
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Search className="text-muted-foreground" /></EmptyMedia>
                <EmptyTitle>No reviews found</EmptyTitle>
                <EmptyDescription>Try a different search term or clear your filters.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Author</TableHead>
                    <TableHead>Artisan</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead className="max-w-[200px]">Comment</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const reviewerName = reviewerNameOf(r)
                    const latestFlag = r.flags[r.flags.length - 1]
                    return (
                      <TableRow key={r.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarImage src={r.reviewerUser?.profilePicture || naviiAvatar(reviewerName, 28)} />
                              <AvatarFallback className="text-xs">{reviewerName[0]}</AvatarFallback>
                            </Avatar>
                            <p className="truncate text-sm font-medium text-foreground">{reviewerName}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{artisanNameOf(r)}</TableCell>
                        <TableCell><StarRow rating={Number(r.rating)} /></TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="truncate text-sm text-muted-foreground">{r.review || "No written feedback"}</p>
                          {latestFlag && (
                            <p className="mt-0.5 truncate text-xs text-destructive">Flagged: {latestFlag.reason}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.verifiedBooking && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-primary">
                              <BadgeCheck className="h-3 w-3" />
                              Verified
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(r.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", statusCfg[r.status].className)}>
                            {statusCfg[r.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetail(r)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {r.status === "ACTIVE" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setFlagTarget(r)}
                                title="Flag — opens reason dialog"
                              >
                                <Flag className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {r.status === "FLAGGED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 bg-transparent px-2 text-xs"
                                disabled={restoringId === r.id}
                                onClick={() => handleRestore(r)}
                              >
                                {restoringId === r.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                Restore
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setRemoveTarget(r)}
                              title="Remove — opens reason dialog"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && !loadError && totalPages > 1 && (
            <div className="border-t p-3">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (page > 1) loadReviews(page - 1) }}
                      className={page === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink href="#" isActive={p === page} onClick={(e) => { e.preventDefault(); loadReviews(p) }}>
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (page < totalPages) loadReviews(page + 1) }}
                      className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Detail</DialogTitle>
            <DialogDescription>
              By {detail && reviewerNameOf(detail)} — for {detail && artisanNameOf(detail)}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <StarRow rating={Number(detail.rating)} />
                <span className="text-sm text-muted-foreground">{detail.rating}/5</span>
                {detail.verifiedBooking && <VerifiedBookingBadge />}
              </div>
              <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground leading-relaxed">
                &ldquo;{detail.review || "No written feedback."}&rdquo;
              </p>
              <ReviewPhotoThumbnails photos={detail.photos} />
              {detail.artisanReply && (
                <div className="rounded-r-lg border-l-2 border-primary bg-primary/5 py-2 pl-3 pr-2">
                  <p className="text-xs font-semibold text-primary">Artisan reply</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground">{detail.artisanReply}</p>
                </div>
              )}
              {detail.flags.length > 0 && (
                <div className="space-y-1.5 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                  {detail.flags.map((f, i) => (
                    <p key={i}>
                      <Flag className="mr-1 inline h-3 w-3" />
                      {f.reason} — {f.actorName}, {fmtDate(f.createdAt)}
                    </p>
                  ))}
                </div>
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
                <Button variant="outline" className="bg-transparent" onClick={() => { setFlagTarget(detail); setDetail(null) }}>
                  <Flag className="mr-2 h-4 w-4" /> Flag
                </Button>
              )}
              {detail?.status === "FLAGGED" && (
                <Button
                  variant="outline"
                  className="bg-transparent"
                  disabled={restoringId === detail.id}
                  onClick={() => handleRestore(detail)}
                >
                  {restoringId === detail.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Restore
                </Button>
              )}
              <Button variant="destructive" onClick={() => { setRemoveTarget(detail); setDetail(null) }}>
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Flag — required reason, hides immediately */}
      <ReviewReasonDialog
        open={!!flagTarget}
        onOpenChange={(o) => !o && setFlagTarget(null)}
        title="Flag Review"
        subtitle={flagTarget ? `By ${reviewerNameOf(flagTarget)} — for ${artisanNameOf(flagTarget)}` : undefined}
        reasonLabel="Why is this review being flagged?"
        reasonPlaceholder="Describe the guideline this review violates…"
        minLength={10}
        maxLength={500}
        confirmLabel="Submit Flag"
        helperText="This hides the review from public view immediately while our team investigates. Your reason is recorded for the moderation team."
        onConfirm={handleFlagSubmit}
      />

      {/* Remove — required reason, permanent hard delete */}
      <ReviewReasonDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Remove Review"
        subtitle={removeTarget ? `By ${reviewerNameOf(removeTarget)} — for ${artisanNameOf(removeTarget)}` : undefined}
        reasonLabel="Reason for removal (required)"
        reasonPlaceholder="This is recorded in the moderation log…"
        minLength={10}
        maxLength={1000}
        confirmLabel="Remove Review"
        warning="This permanently deletes the review. It cannot be recovered or restored. Your reason is kept in the moderation log for accountability."
        onConfirm={handleRemoveSubmit}
      />

      {/* Removal history — secondary accountability utility, AM5 */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Removal History</DialogTitle>
            <DialogDescription>Past flag / remove / restore actions, newest first.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {historyLoading && moderationLog.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : moderationLog.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No moderation actions logged yet.</p>
            ) : (
              moderationLog.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={cn("text-xs", actionCfg[entry.action].className)}>
                      {actionCfg[entry.action].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{fmtDate(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {entry.reviewerName} → {entry.artisanName} · {entry.rating}/5
                  </p>
                  <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{entry.reviewExcerpt}&rdquo;</p>
                  {entry.reason && <p className="mt-1 text-xs text-foreground">Reason: {entry.reason}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">By {entry.actorName} ({entry.actorRole})</p>
                </div>
              ))
            )}
          </div>
          {historyTotalPages > historyPage && (
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent"
              disabled={historyLoading}
              onClick={() => loadModerationLog(historyPage + 1, true)}
            >
              {historyLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Load more
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
