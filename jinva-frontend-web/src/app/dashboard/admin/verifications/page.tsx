"use client"

import { useCallback, useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Lightbox } from "@/components/ui/lightbox"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { ReviewReasonDialog } from "@/components/reviews/review-reason-dialog"
import { QueueCounterCard } from "@/components/dashboard/admin/queue-counter-card"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Loader2,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { naviiAvatar, cn, resolveMediaUrl } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch, apiFetchWithMeta } from "@/lib/api"

/**
 * AT1 / design-spec.md §9 — the artisan verification queue.
 *
 * The backend for this has been complete and notification-wired for a while
 * (`GET /admin/verifications`, `/:id`, `PATCH .../start-review|approve|reject`)
 * with no frontend at all, so this is a rewire rather than a build. It is a
 * deliberate clone of the Portfolio Queue's structure — counter row, Card +
 * toolbar + Table, Eye/Approve/Reject row actions, a preview dialog, and
 * `ReviewReasonDialog` for the mandatory rejection reason — so an admin needs
 * no second mental model for a second moderation queue.
 *
 * The one place it departs from the Portfolio Queue is PII: the ID number is
 * masked in the table and revealed only inside the review dialog, behind a
 * "Show ID number" text-button (the same progressive-disclosure idiom the
 * Transactions detail dialog uses for "Show technical details"). Date of birth
 * never appears in a list view.
 */

type VerificationStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"

interface BackendVerification {
  id: number
  artisanProfile?: { id: number }
  documentType: string
  idNumber?: string
  fullLegalName?: string
  dateOfBirth?: string
  documentFrontUrl: string
  documentBackUrl?: string
  selfieUrl: string
  additionalNotes?: string
  status: VerificationStatus
  adminNotes?: string
  rejectionReason?: string
  reviewedBy?: { id: number; firstname: string; lastname: string }
  reviewedAt?: string
  createdAt: string
}

const PAGE_SIZE = 20

/** `DocumentType` on the backend (`common/types/enums.ts`). */
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  GHANA_CARD: "Ghana Card",
  PASSPORT: "Passport",
  VOTERS_ID: "Voter's ID",
  DRIVERS_LICENSE: "Driver's Licence",
  NATIONAL_ID: "National ID",
}

/**
 * Verification statuses reuse tones already in this app rather than getting
 * their own: gray for "queued, nothing has happened yet", the shared yellow
 * "in progress / awaiting" tone for UNDER_REVIEW, primary for approved and
 * destructive for rejected.
 */
const STATUS_CFG: Record<VerificationStatus, { label: string; className: string; icon: typeof Clock }> = {
  PENDING:      { label: "Pending",      className: "bg-gray-100 text-gray-600 border-gray-200",                icon: Clock },
  UNDER_REVIEW: { label: "Under Review", className: "bg-yellow-100 text-yellow-700 border-yellow-200",          icon: Clock },
  APPROVED:     { label: "Approved",     className: "bg-primary/10 text-primary border-primary/20",             icon: CheckCircle },
  REJECTED:     { label: "Rejected",     className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
]

/** Days a submission can sit unreviewed before the queue calls it out. */
const STALE_AFTER_DAYS = 7

function fmtDate(iso?: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

/**
 * Masks an identity-document number for list display, keeping only enough for
 * an admin to tell two rows apart. Never the whole value — a queue is the one
 * admin surface most likely to end up in a screenshot or a shared screen.
 */
function maskIdNumber(value?: string): string {
  if (!value) return "—"
  const trimmed = value.trim()
  if (trimmed.length <= 4) return "*".repeat(trimmed.length)
  const head = trimmed.slice(0, Math.min(3, trimmed.length - 4))
  const tail = trimmed.slice(-4)
  return `${head}${"*".repeat(Math.max(4, trimmed.length - head.length - 4))}${tail}`
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

/**
 * `VerificationResponseDto` only exposes `artisanProfile.id`, so the artisan's
 * account name/avatar genuinely isn't on the wire (noted for the backend
 * engineer). The name declared on the submitted document is, and it is what an
 * admin is actually comparing against the photo — so that is what's shown,
 * labelled as such, with the profile id as the cross-reference.
 */
function displayName(v: BackendVerification): string {
  return v.fullLegalName?.trim() || `Artisan profile #${v.artisanProfile?.id ?? "—"}`
}

export default function AdminVerificationsPage() {
  const [items, setItems] = useState<BackendVerification[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState("PENDING")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState("")

  const [counts, setCounts] = useState<{ pending: number; approved: number; rejected: number } | null>(null)

  const [review, setReview] = useState<BackendVerification | null>(null)
  const [revealId, setRevealId] = useState(false)
  const [adminNotes, setAdminNotes] = useState("")
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)
  const [rejectTarget, setRejectTarget] = useState<BackendVerification | null>(null)
  const [actioningId, setActioningId] = useState<number | null>(null)

  const load = useCallback(
    async (p: number, status: string) => {
      setIsLoading(true)
      setLoadError(false)
      try {
        const query = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
        if (status !== "ALL") query.set("status", status)
        const { data, meta } = await apiFetchWithMeta<BackendVerification[]>(`/admin/verifications?${query}`)
        const rows = Array.isArray(data) ? data : []
        if (rows.length === 0 && p > 1) {
          await load(p - 1, status)
          return
        }
        setItems(rows)
        setPage(p)
        setTotalPages(extractTotalPages(meta))
        setTotal(extractTotal(meta))
      } catch {
        setLoadError(true)
        setItems([])
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  /**
   * Real whole-set totals, not page-local arithmetic and not session counters:
   * the list endpoint takes `?status=` and returns a `pagination.total`, so one
   * `limit=1` call per bucket gives a number that stays correct past page one.
   * Same technique the reviews screen already uses for its flagged count.
   */
  const loadCounts = useCallback(async () => {
    try {
      const [pending, review_, approved, rejected] = await Promise.all(
        (["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const).map((s) =>
          apiFetchWithMeta<BackendVerification[]>(`/admin/verifications?status=${s}&limit=1`),
        ),
      )
      setCounts({
        pending: extractTotal(pending.meta) + extractTotal(review_.meta),
        approved: extractTotal(approved.meta),
        rejected: extractTotal(rejected.meta),
      })
    } catch {
      // Non-blocking — the tiles show their loading shape rather than a wrong number.
    }
  }, [])

  useEffect(() => {
    load(1, statusFilter)
  }, [load, statusFilter])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  const refresh = useCallback(async () => {
    await Promise.all([load(page, statusFilter), loadCounts()])
  }, [load, loadCounts, page, statusFilter])

  const openReview = async (v: BackendVerification) => {
    setReview(v)
    setRevealId(false)
    setAdminNotes(v.adminNotes ?? "")
    // The detail endpoint is the one that loads the artisan relations, so
    // re-read the record on open rather than trusting the list projection.
    try {
      const detail = await apiFetch<BackendVerification>(`/admin/verifications/${v.id}`)
      if (detail?.id) {
        setReview(detail)
        setAdminNotes(detail.adminNotes ?? "")
      }
    } catch {
      // Keep the row's own data on screen — it is enough to act on.
    }
  }

  /**
   * `notes` is passed in rather than read from state: the row-level Approve
   * button would otherwise send whatever was last typed in the dialog, because
   * a `setAdminNotes` in the same handler hasn't flushed by the time this runs.
   */
  const approve = async (v: BackendVerification, notes: string) => {
    setActioningId(v.id)
    try {
      await apiFetch(`/admin/verifications/${v.id}/approve`, {
        method: "PATCH",
        body: JSON.stringify(notes.trim() ? { notes: notes.trim() } : {}),
      })
      setItems((prev) => prev.filter((i) => i.id !== v.id))
      setReview(null)
      toast.success(`${displayName(v)} is now verified. They've been notified.`)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve this verification.")
    } finally {
      setActioningId(null)
    }
  }

  const reject = async (reason: string) => {
    if (!rejectTarget) return
    const target = rejectTarget
    setActioningId(target.id)
    try {
      await apiFetch(`/admin/verifications/${target.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({
          reason,
          ...(adminNotes.trim() ? { notes: adminNotes.trim() } : {}),
        }),
      })
      setItems((prev) => prev.filter((i) => i.id !== target.id))
      setRejectTarget(null)
      setReview(null)
      toast.success("Verification rejected. The artisan has been notified and can re-submit.")
      await refresh()
    } finally {
      setActioningId(null)
    }
  }

  // `GET /admin/verifications` has no search param, so this narrows the loaded
  // page only — said plainly in the placeholder rather than implied to be a
  // whole-queue search.
  const filtered = items.filter((v) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      displayName(v).toLowerCase().includes(q)
      || (DOCUMENT_TYPE_LABELS[v.documentType] ?? v.documentType).toLowerCase().includes(q)
      || String(v.id).includes(q)
    )
  })

  const canAct = (v: BackendVerification) => v.status === "PENDING" || v.status === "UNDER_REVIEW"

  const documentTiles = (v: BackendVerification) =>
    [
      { url: v.documentFrontUrl, label: `${DOCUMENT_TYPE_LABELS[v.documentType] ?? v.documentType} — front` },
      { url: v.documentBackUrl, label: `${DOCUMENT_TYPE_LABELS[v.documentType] ?? v.documentType} — back` },
      { url: v.selfieUrl, label: "Selfie" },
    ].filter((t): t is { url: string; label: string } => Boolean(t.url))

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Artisan Verification</h1>
          <p className="text-sm text-muted-foreground">
            Review identity documents before granting the verified badge
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <QueueCounterCard
            label="Awaiting Review"
            value={counts?.pending ?? 0}
            isLoading={counts === null}
            sublabel="pending + under review"
          />
          <QueueCounterCard
            label="Approved"
            value={counts?.approved ?? 0}
            tone="primary"
            isLoading={counts === null}
            sublabel="all time"
          />
          <QueueCounterCard
            label="Rejected"
            value={counts?.rejected ?? 0}
            tone="destructive"
            isLoading={counts === null}
            sublabel="all time"
          />
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {total} submission{total !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search this page…"
                  className="h-8 pl-9 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : loadError ? (
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertTriangle className="text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>Couldn&apos;t load the verification queue</EmptyTitle>
                <EmptyDescription>Something went wrong on our end.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" className="bg-transparent" onClick={() => load(page, statusFilter)}>
                  Retry
                </Button>
              </EmptyContent>
            </Empty>
          ) : filtered.length === 0 ? (
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {search ? (
                    <Search className="text-muted-foreground" />
                  ) : (
                    <ShieldCheck className="text-muted-foreground" />
                  )}
                </EmptyMedia>
                <EmptyTitle>
                  {search ? "No verifications match your search" : "No verifications waiting"}
                </EmptyTitle>
                <EmptyDescription>
                  {search
                    ? "Try a different term, or clear the search to see the whole page."
                    : "You're all caught up."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artisan</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>ID number</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => {
                    const name = displayName(v)
                    const cfg = STATUS_CFG[v.status] ?? STATUS_CFG.PENDING
                    const StatusIcon = cfg.icon
                    const age = daysSince(v.createdAt)
                    const isStale = canAct(v) && age >= STALE_AFTER_DAYS
                    return (
                      <TableRow key={v.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={naviiAvatar(name, 32)} />
                              <AvatarFallback className="text-xs">{name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                Profile #{v.artisanProfile?.id ?? "—"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {DOCUMENT_TYPE_LABELS[v.documentType] ?? v.documentType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {maskIdNumber(v.idNumber)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {isStale ? (
                            <span className="flex items-center gap-1 font-medium text-destructive">
                              <AlertTriangle className="h-3 w-3" />
                              {fmtDate(v.createdAt)} · {age} days
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{fmtDate(v.createdAt)}</span>
                          )}
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
                              title="Review documents"
                              onClick={() => openReview(v)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canAct(v) && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90"
                                  disabled={actioningId === v.id}
                                  onClick={() => approve(v, v.adminNotes ?? "")}
                                >
                                  {actioningId === v.id
                                    ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    : <CheckCircle className="mr-1 h-3 w-3" />}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2 text-xs"
                                  disabled={actioningId === v.id}
                                  onClick={() => { setAdminNotes(v.adminNotes ?? ""); setRejectTarget(v) }}
                                >
                                  <XCircle className="mr-1 h-3 w-3" />
                                  Reject
                                </Button>
                              </>
                            )}
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
                      onClick={(e) => { e.preventDefault(); if (page > 1) load(page - 1, statusFilter) }}
                      className={page === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === page}
                        onClick={(e) => { e.preventDefault(); load(p, statusFilter) }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (page < totalPages) load(page + 1, statusFilter) }}
                      className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>
      </div>

      {/* Review dialog — the Portfolio Queue preview dialog with three tiles */}
      <Dialog open={!!review} onOpenChange={(o) => { if (!o) { setReview(null); setRevealId(false) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{review ? `Verify ${displayName(review)}` : "Verify artisan"}</DialogTitle>
            <DialogDescription>
              {review
                ? `Artisan profile #${review.artisanProfile?.id ?? "—"} · submitted ${fmtDate(review.createdAt)}`
                : null}
            </DialogDescription>
          </DialogHeader>

          {review && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {documentTiles(review).map((tile) => (
                  <button
                    key={tile.label}
                    type="button"
                    className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-black"
                    onClick={() => setLightbox({ url: resolveMediaUrl(tile.url), label: tile.label })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveMediaUrl(tile.url)}
                      alt={tile.label}
                      className="h-full w-full object-contain"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] text-white">
                      {tile.label}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Tap any document to open it full-size.</p>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Name on document</p>
                  <p className="mt-0.5 font-medium text-foreground">{review.fullLegalName ?? "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Document type</p>
                  <p className="mt-0.5 font-medium text-foreground">
                    {DOCUMENT_TYPE_LABELS[review.documentType] ?? review.documentType}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID number</p>
                  <p className="mt-0.5 font-mono text-xs font-medium text-foreground">
                    {revealId ? (review.idNumber ?? "Not provided") : maskIdNumber(review.idNumber)}
                    {review.idNumber && (
                      <>
                        {" · "}
                        <button
                          type="button"
                          className="font-sans text-xs font-semibold text-primary hover:underline"
                          onClick={() => setRevealId((r) => !r)}
                        >
                          {revealId ? "Hide ID number" : "Show ID number"}
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date of birth</p>
                  <p className="mt-0.5 font-medium text-foreground">{fmtDate(review.dateOfBirth)}</p>
                </div>
              </div>

              {review.additionalNotes && (
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Notes from the artisan</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{review.additionalNotes}</p>
                </div>
              )}

              {review.status === "REJECTED" && review.rejectionReason && (
                <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  Previously rejected: {review.rejectionReason}
                </div>
              )}

              {canAct(review) ? (
                <div className="space-y-1.5">
                  <Label htmlFor="verification-notes">Internal notes (optional)</Label>
                  <Textarea
                    id="verification-notes"
                    rows={2}
                    placeholder="Only other admins see this…"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <span>
                    {STATUS_CFG[review.status].label}
                    {review.reviewedBy
                      ? ` by ${review.reviewedBy.firstname} ${review.reviewedBy.lastname}`.trimEnd()
                      : ""}
                  </span>
                  <span>{fmtDate(review.reviewedAt)}</span>
                </div>
              )}
            </div>
          )}

          {review && canAct(review) && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="bg-transparent"
                disabled={actioningId === review.id}
                onClick={() => setRejectTarget(review)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={actioningId === review.id}
                onClick={() => approve(review, adminNotes)}
              >
                {actioningId === review.id
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <ShieldCheck className="mr-2 h-4 w-4" />}
                Approve &amp; verify
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {lightbox && (
        <Lightbox label={lightbox.label} onClose={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt={lightbox.label} className="max-h-[80vh] w-full object-contain" />
        </Lightbox>
      )}

      {/* Rejection — mandatory reason, reused as-is from the reviews round */}
      <ReviewReasonDialog
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        title="Reject Verification"
        subtitle={rejectTarget ? displayName(rejectTarget) : undefined}
        reasonLabel="Why is this verification being rejected?"
        reasonPlaceholder="e.g. The back of the Ghana Card is too blurry to read the ID number."
        minLength={10}
        maxLength={500}
        confirmLabel="Send Rejection"
        helperText="The artisan sees this reason and can re-submit with corrected documents."
        onConfirm={reject}
      />
    </DashboardLayout>
  )
}
