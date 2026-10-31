"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Video,
  XCircle,
} from "lucide-react"
import { cn, resolveMediaUrl } from "@/lib/utils"
import { formatDate } from "@/lib/spending"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import type { ApiPortfolioItem, PortfolioStatus } from "@/lib/types"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "video/mp4"]
const MAX_SIZE_BYTES = 50 * 1024 * 1024

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-ring"

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "That file type isn't supported. Upload a JPEG, PNG or MP4."
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "That file is over 50 MB. Choose a smaller one."
  }
  return null
}

function isVideo(item: ApiPortfolioItem) {
  return item.fileType?.startsWith("video/")
}

// M2: the status sits on a solid strip under the photo (never on top of it),
// with an icon and a word, so it reads on any image and never by colour alone.
const statusConfig: Record<PortfolioStatus, { label: string; className: string; icon: typeof CheckCircle }> = {
  APPROVED: { label: "Published", className: "text-primary", icon: CheckCircle },
  PENDING: { label: "In review", className: "text-muted-foreground", icon: Clock },
  REJECTED: { label: "Not approved", className: "text-destructive", icon: XCircle },
}

type Filter = "ALL" | PortfolioStatus

interface ArtisanProfileServices {
  id: string
  services?: { id: string | number; name: string }[]
}

function FileDropzone({
  id,
  file,
  onFile,
  accept = "image/jpeg,image/png,video/mp4",
  label = "Choose a photo or video",
}: {
  id: string
  file: File | null
  onFile: (f: File | null) => void
  accept?: string
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    const err = validateFile(f)
    if (err) {
      toast.error(err)
      onFile(null)
      return
    }
    onFile(f)
  }

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        className={cn(
          FOCUS_RING,
          "flex h-36 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-muted/30 px-4 text-center transition-colors hover:bg-muted/50",
          isDragging ? "border-primary bg-primary/5" : "border-border",
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <Upload aria-hidden className="mb-1 h-7 w-7 text-muted-foreground" />
        {file ? (
          <>
            <span className="max-w-full truncate text-sm font-medium text-foreground">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              {(file.size / (1024 * 1024)).toFixed(1)} MB. Tap to choose a different file
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">JPEG, PNG or MP4, up to 50 MB</span>
          </>
        )}
      </button>
    </>
  )
}

/** P3: categories are the artisan's own services, plus an item's existing tag so a resubmit can keep it. */
function CategorySelect({
  id,
  value,
  onChange,
  options,
}: Readonly<{ id: string; value: string; onChange: (v: string) => void; options: string[] }>) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-11 w-full sm:h-9">
        <SelectValue placeholder="Choose one of your services" />
      </SelectTrigger>
      <SelectContent>
        {options.map((c) => (
          <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function ArtisanPortfolioPage() {
  const [artisanId, setArtisanId] = useState<string | null>(null)
  const [serviceNames, setServiceNames] = useState<string[]>([])
  const [items, setItems] = useState<ApiPortfolioItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [caption, setCaption] = useState("")
  const [tag, setTag] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ApiPortfolioItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [resubmitTarget, setResubmitTarget] = useState<ApiPortfolioItem | null>(null)
  const [resubmitFile, setResubmitFile] = useState<File | null>(null)
  const [resubmitCaption, setResubmitCaption] = useState("")
  const [resubmitTag, setResubmitTag] = useState("")
  const [isResubmitting, setIsResubmitting] = useState(false)

  const [activeFilter, setActiveFilter] = useState<Filter>("ALL")
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [isReordering, setIsReordering] = useState(false)

  const fetchItems = useCallback((id: string) => {
    setIsLoading(true)
    setLoadError(false)
    apiFetch<ApiPortfolioItem[]>(`/portfolio/${id}`)
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false))
  }, [])

  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError(false)
    apiFetch<ArtisanProfileServices>("/users/me/artisan-profile")
      .then((profile) => {
        setArtisanId(profile.id)
        setServiceNames(
          Array.from(new Set((profile.services ?? []).map((s) => s.name).filter(Boolean))).sort((a, b) =>
            a.localeCompare(b, "en-GB"),
          ),
        )
        fetchItems(profile.id)
      })
      .catch(() => {
        setLoadError(true)
        setIsLoading(false)
      })
  }, [fetchItems])

  useEffect(() => { load() }, [load])

  const counts = {
    ALL: items.length,
    APPROVED: items.filter((i) => i.status === "APPROVED").length,
    PENDING: items.filter((i) => i.status === "PENDING").length,
    REJECTED: items.filter((i) => i.status === "REJECTED").length,
  }

  const displayed = activeFilter === "ALL" ? items : items.filter((i) => i.status === activeFilter)
  const canReorder = activeFilter === "ALL" && items.length > 1
  const hasServices = serviceNames.length > 0

  const resetUploadForm = () => {
    setUploadFile(null)
    setCaption("")
    setTag("")
  }

  const openUpload = () => {
    resetUploadForm()
    // One service: nothing to choose, so pick it.
    if (serviceNames.length === 1) setTag(serviceNames[0])
    setUploadOpen(true)
  }

  const handleUpload = async () => {
    if (!uploadFile) { toast.error("Choose a photo or video to upload."); return }
    if (!tag) { toast.error("Choose which service this work is for."); return }
    const err = validateFile(uploadFile)
    if (err) { toast.error(err); return }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("tag", tag)
      if (caption.trim()) formData.append("caption", caption.trim())

      const created = await apiFetch<ApiPortfolioItem>("/portfolio", { method: "POST", body: formData })
      // Backend always assigns sortOrder = currentMax + 1 (end of the list),
      // so append here to match the real order instead of jumping to the front.
      setItems((prev) => [...prev, created])
      // P3: no time promise — review has no guaranteed turnaround.
      toast.success("Uploaded. It will appear on your profile once our team approves it.")
      resetUploadForm()
      setUploadOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed. Try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await apiFetch(`/portfolio/${deleteTarget.id}`, { method: "DELETE" })
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id))
      toast.success("Removed from your portfolio.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove it. Try again.")
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const openResubmit = (item: ApiPortfolioItem) => {
    setResubmitTarget(item)
    setResubmitFile(null)
    setResubmitCaption(item.caption ?? "")
    setResubmitTag(item.tag ?? "")
  }

  const handleResubmit = async () => {
    if (!resubmitTarget) return
    if (!resubmitFile) { toast.error("Choose a new file to send for review."); return }
    const err = validateFile(resubmitFile)
    if (err) { toast.error(err); return }

    setIsResubmitting(true)
    try {
      const formData = new FormData()
      formData.append("file", resubmitFile)
      if (resubmitTag) formData.append("tag", resubmitTag)
      if (resubmitCaption.trim()) formData.append("caption", resubmitCaption.trim())

      const updated = await apiFetch<ApiPortfolioItem>(`/portfolio/${resubmitTarget.id}/resubmit`, {
        method: "PATCH",
        body: formData,
      })
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      toast.success("Sent for review again.")
      setResubmitTarget(null)
      setResubmitFile(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send it for review. Try again.")
    } finally {
      setIsResubmitting(false)
    }
  }

  // PF7: reordering is persisted via PATCH /portfolio/:id/reorder. Only on the
  // "All" view so sortOrder always reflects the full list.
  const persistOrder = async (ordered: ApiPortfolioItem[]) => {
    setIsReordering(true)
    try {
      await Promise.all(
        ordered.map((item, idx) =>
          apiFetch(`/portfolio/${item.id}/reorder`, {
            method: "PATCH",
            body: JSON.stringify({ sortOrder: idx }),
          }),
        ),
      )
      setItems((prev) => prev.map((it) => {
        const idx = ordered.findIndex((o) => o.id === it.id)
        return idx === -1 ? it : { ...it, sortOrder: idx }
      }))
    } catch {
      toast.error("Couldn't save the new order. Reloading your portfolio.")
      if (artisanId) fetchItems(artisanId)
    } finally {
      setIsReordering(false)
    }
  }

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (!canReorder || isReordering || toIdx < 0 || toIdx >= items.length || fromIdx === toIdx) return
    const list = [...items]
    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)
    setItems(list)
    persistOrder(list)
  }

  const handleDrop = (targetId: number) => {
    const fromIdx = items.findIndex((i) => i.id === draggedId)
    const toIdx = items.findIndex((i) => i.id === targetId)
    setDraggedId(null)
    if (fromIdx === -1 || toIdx === -1) return
    moveItem(fromIdx, toIdx)
  }

  const filterTabs: { key: Filter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "APPROVED", label: "Published" },
    { key: "PENDING", label: "In review" },
    { key: "REJECTED", label: "Not approved" },
  ]

  const resubmitOptions =
    resubmitTarget?.tag && !serviceNames.includes(resubmitTarget.tag)
      ? [resubmitTarget.tag, ...serviceNames]
      : serviceNames

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">Portfolio</h1>
            <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground sm:text-base">
              Photos and videos of your finished work. Our team checks each one before clients can see it.
            </p>
          </div>
          {items.length > 0 && hasServices && (
            <Button className={cn(FOCUS_RING, "h-11 w-full sm:h-10 sm:w-auto sm:shrink-0")} onClick={openUpload}>
              <Plus aria-hidden className="h-4 w-4" />
              Upload work
            </Button>
          )}
        </div>

        {isLoading ? (
          <GridSkeleton />
        ) : loadError ? (
          <section
            aria-labelledby="portfolio-error-title"
            className="flex flex-col items-start gap-3 rounded-xl border bg-card px-5 py-6 sm:px-6"
          >
            <AlertCircle aria-hidden className="h-6 w-6 text-destructive" />
            <div>
              <h2 id="portfolio-error-title" className="font-semibold text-foreground">
                Couldn&apos;t load your portfolio
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
            </div>
            <Button variant="outline" className={cn(FOCUS_RING, "h-11 bg-transparent sm:h-9")} onClick={load}>
              Try again
            </Button>
          </section>
        ) : items.length === 0 ? (
          <section
            aria-labelledby="portfolio-empty-title"
            className="flex flex-col items-start gap-4 rounded-xl border border-dashed px-5 py-8 sm:px-8 sm:py-10"
          >
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </span>
            <div>
              <h2 id="portfolio-empty-title" className="text-lg font-semibold text-foreground">
                Show clients what you can do
              </h2>
              <p className="mt-1.5 max-w-[56ch] text-sm text-muted-foreground sm:text-base">
                {hasServices
                  ? "Add photos or videos of jobs you've finished. Clear before-and-after shots help clients choose you."
                  : "Each piece of work is filed under one of your services. Add a service first, then upload your work."}
              </p>
            </div>
            {hasServices ? (
              <Button className={cn(FOCUS_RING, "h-11 w-full sm:w-auto")} onClick={openUpload}>
                <Plus aria-hidden className="h-4 w-4" />
                Upload work
              </Button>
            ) : (
              <Button asChild className={cn(FOCUS_RING, "h-11 w-full sm:w-auto")}>
                <Link href="/dashboard/artisan/services">Add a service</Link>
              </Button>
            )}
          </section>
        ) : (
          <>
            {!hasServices && (
              <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                To upload more work, first{" "}
                <Link href="/dashboard/artisan/services" className="font-medium text-primary underline-offset-4 hover:underline">
                  add a service
                </Link>
                .
              </p>
            )}

            {/* M2/M4: one compact segmented control carries the counts — no stat cards. */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div
                role="group"
                aria-label="Show"
                className="grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1 sm:inline-flex sm:w-auto"
              >
                {filterTabs.map(({ key, label }) => {
                  const on = activeFilter === key
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setActiveFilter(key)}
                      className={cn(
                        FOCUS_RING,
                        "flex h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm sm:h-9",
                        on
                          ? "bg-card font-semibold text-foreground shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.06)]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                      <span className="tabular-nums text-muted-foreground">{counts[key]}</span>
                    </button>
                  )
                })}
              </div>
              {canReorder && (
                <p className="text-sm text-muted-foreground">
                  Clients see your published work in this order. Use the arrows to move an item.
                </p>
              )}
            </div>

            {displayed.length === 0 ? (
              <div className="rounded-xl border border-dashed px-5 py-8 text-center">
                <p className="font-medium text-foreground">
                  {activeFilter === "APPROVED"
                    ? "Nothing published yet"
                    : activeFilter === "PENDING"
                      ? "Nothing waiting for review"
                      : "Nothing was turned down"}
                </p>
                <Button
                  variant="link"
                  className={cn(FOCUS_RING, "mt-1 h-11")}
                  onClick={() => setActiveFilter("ALL")}
                >
                  Show all work
                </Button>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy={isReordering || undefined}>
                {displayed.map((item) => {
                  const cfg = statusConfig[item.status]
                  const StatusIcon = cfg.icon
                  const index = items.findIndex((i) => i.id === item.id)
                  const name = item.caption || item.tag || "Untitled work"
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "flex flex-col overflow-hidden rounded-xl border bg-card",
                        draggedId === item.id && "opacity-50",
                      )}
                      draggable={canReorder}
                      onDragStart={() => canReorder && setDraggedId(item.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onDragOver={(e) => canReorder && e.preventDefault()}
                      onDrop={() => canReorder && handleDrop(item.id)}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                        {isVideo(item) ? (
                          <video
                            src={resolveMediaUrl(item.fileUrl)}
                            className="absolute inset-0 h-full w-full object-cover"
                            muted
                            preload="metadata"
                            aria-label={name}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveMediaUrl(item.fileUrl)}
                            alt={item.caption || `Work for ${item.tag ?? "a client"}`}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        )}
                        {isVideo(item) && (
                          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-xs font-medium text-white">
                            <Video aria-hidden className="h-3.5 w-3.5" />
                            Video
                          </span>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <p className={cn("flex items-center gap-1.5 text-sm font-medium", cfg.className)}>
                          <StatusIcon aria-hidden className="h-4 w-4" />
                          {cfg.label}
                        </p>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{item.caption || "No caption"}</p>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {[item.tag, item.createdAt ? `Added ${formatDate(item.createdAt)}` : null]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>

                        {item.status === "REJECTED" && item.rejectionReason && (
                          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {item.rejectionReason}
                          </p>
                        )}

                        <div className="mt-auto flex items-center gap-1 pt-1">
                          {item.status === "REJECTED" && (
                            <Button
                              variant="outline"
                              className={cn(FOCUS_RING, "h-11 gap-1.5 bg-transparent sm:h-9")}
                              onClick={() => openResubmit(item)}
                            >
                              <RotateCcw aria-hidden className="h-4 w-4" />
                              Send again
                            </Button>
                          )}
                          {canReorder && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(FOCUS_RING, "h-11 w-11 sm:h-9 sm:w-9")}
                                aria-label={`Move ${name} earlier`}
                                disabled={index <= 0 || isReordering}
                                onClick={() => moveItem(index, index - 1)}
                              >
                                <ArrowLeft aria-hidden className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(FOCUS_RING, "h-11 w-11 sm:h-9 sm:w-9")}
                                aria-label={`Move ${name} later`}
                                disabled={index >= items.length - 1 || isReordering}
                                onClick={() => moveItem(index, index + 1)}
                              >
                                <ArrowRight aria-hidden className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              FOCUS_RING,
                              "ml-auto h-11 w-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-9",
                            )}
                            aria-label={`Remove ${name}`}
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 aria-hidden className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) resetUploadForm() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload work</DialogTitle>
            <DialogDescription>
              Add a photo or video of a finished job. Our team checks it before clients can see it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FileDropzone id="upload-file" file={uploadFile} onFile={setUploadFile} />
            <div className="space-y-2">
              <Label htmlFor="upload-service">Service</Label>
              <CategorySelect id="upload-service" value={tag} onChange={setTag} options={serviceNames} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input
                id="caption"
                className="h-11 sm:h-9"
                placeholder="What did you do on this job?"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="h-11 flex-1 bg-transparent sm:h-9"
                onClick={() => setUploadOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button className="h-11 flex-1 sm:h-9" onClick={handleUpload} disabled={isUploading}>
                {isUploading && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this work?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be deleted from your portfolio and clients won&apos;t see it any more. You can&apos;t undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9" disabled={isDeleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-11 bg-destructive text-white hover:bg-destructive/90 sm:h-9"
            >
              {isDeleting && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PF7a: send a rejected item again — picks a new file, resets to PENDING */}
      <Dialog open={!!resubmitTarget} onOpenChange={(o) => { if (!o) { setResubmitTarget(null); setResubmitFile(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send for review again</DialogTitle>
            <DialogDescription>
              Choose a new file to replace the one that wasn&apos;t approved. It goes back to our team to check.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {resubmitTarget?.rejectionReason && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Reason: {resubmitTarget.rejectionReason}
              </p>
            )}
            <FileDropzone
              id="resubmit-file"
              file={resubmitFile}
              onFile={setResubmitFile}
              label="Choose a replacement file"
            />
            <div className="space-y-2">
              <Label htmlFor="resubmit-service">Service</Label>
              <CategorySelect
                id="resubmit-service"
                value={resubmitTag}
                onChange={setResubmitTag}
                options={resubmitOptions}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resubmit-caption">Caption (optional)</Label>
              <Textarea
                id="resubmit-caption"
                rows={2}
                value={resubmitCaption}
                onChange={(e) => setResubmitCaption(e.target.value)}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="h-11 flex-1 bg-transparent sm:h-9"
                onClick={() => setResubmitTarget(null)}
                disabled={isResubmitting}
              >
                Cancel
              </Button>
              <Button className="h-11 flex-1 sm:h-9" onClick={handleResubmit} disabled={isResubmitting}>
                {isResubmitting && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
                Send for review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

function GridSkeleton() {
  return (
    <div aria-hidden className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl border bg-card">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      ))}
    </div>
  )
}
