"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Upload,
  ImageIcon,
  Video,
  Trash2,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  GripVertical,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react"
import { cn, resolveMediaUrl } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import type { ApiPortfolioItem, PortfolioStatus } from "@/lib/types"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "video/mp4"]
const MAX_SIZE_BYTES = 50 * 1024 * 1024

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Unsupported file type. Please upload a JPEG, PNG, or MP4 file."
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "File exceeds the 50MB size limit."
  }
  return null
}

function isVideo(item: ApiPortfolioItem) {
  return item.fileType?.startsWith("video/")
}

const statusConfig: Record<PortfolioStatus, { label: string; className: string; icon: typeof CheckCircle }> = {
  APPROVED: { label: "Published", className: "bg-primary/10 text-primary border-primary/20", icon: CheckCircle },
  PENDING: { label: "Under Review", className: "bg-muted text-muted-foreground border-border", icon: Clock },
  REJECTED: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
}

const SERVICE_CATEGORIES = [
  "Plumbing", "Electrical", "Carpentry", "Painting", "Cleaning",
  "Roofing", "HVAC", "Landscaping", "Masonry", "General",
]

function FileDropzone({
  file,
  onFile,
  accept = "image/jpeg,image/png,video/mp4",
  label = "Click to upload, or drag and drop",
}: {
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
    <div
      className={cn(
        "flex h-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-muted/30 px-4 text-center transition-colors hover:bg-muted/50",
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
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Upload className="mb-1 h-8 w-8 text-muted-foreground" />
      {file ? (
        <>
          <p className="max-w-full truncate text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB — click to replace</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">JPEG, PNG, MP4 · max 50MB</p>
        </>
      )}
    </div>
  )
}

export default function ArtisanPortfolioPage() {
  const [artisanId, setArtisanId] = useState<string | null>(null)
  const [items, setItems] = useState<ApiPortfolioItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [caption, setCaption] = useState("")
  const [tag, setTag] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [resubmitTarget, setResubmitTarget] = useState<ApiPortfolioItem | null>(null)
  const [resubmitFile, setResubmitFile] = useState<File | null>(null)
  const [resubmitCaption, setResubmitCaption] = useState("")
  const [resubmitTag, setResubmitTag] = useState("")
  const [isResubmitting, setIsResubmitting] = useState(false)

  const [activeFilter, setActiveFilter] = useState<"ALL" | "APPROVED" | "PENDING" | "REJECTED">("ALL")
  const [draggedId, setDraggedId] = useState<number | null>(null)

  const fetchItems = useCallback((id: string) => {
    setIsLoading(true)
    setLoadError(false)
    apiFetch<ApiPortfolioItem[]>(`/portfolio/${id}`)
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    apiFetch<{ id: string }>("/users/me/artisan-profile")
      .then((profile) => {
        setArtisanId(profile.id)
        fetchItems(profile.id)
      })
      .catch(() => {
        setLoadError(true)
        setIsLoading(false)
      })
  }, [fetchItems])

  const counts = {
    total: items.length,
    approved: items.filter((i) => i.status === "APPROVED").length,
    pending: items.filter((i) => i.status === "PENDING").length,
    rejected: items.filter((i) => i.status === "REJECTED").length,
  }

  const displayed = activeFilter === "ALL" ? items : items.filter((i) => i.status === activeFilter)

  const resetUploadForm = () => {
    setUploadFile(null)
    setCaption("")
    setTag("")
  }

  const handleUpload = async () => {
    if (!uploadFile) { toast.error("Please select a photo or video to upload."); return }
    if (!tag) { toast.error("Please choose a service category."); return }
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
      toast.success("Submitted for review — admin will approve within 24 hours.")
      resetUploadForm()
      setUploadOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      await apiFetch(`/portfolio/${deleteId}`, { method: "DELETE" })
      setItems((prev) => prev.filter((i) => String(i.id) !== deleteId))
      toast.success("Portfolio item removed.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove item.")
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
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
    if (!resubmitFile) { toast.error("Please choose a new file to resubmit."); return }
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
      toast.success("Resubmitted for review.")
      setResubmitTarget(null)
      setResubmitFile(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Resubmit failed. Please try again.")
    } finally {
      setIsResubmitting(false)
    }
  }

  // PF7: drag-and-drop reordering, persisted via PATCH /portfolio/:id/reorder.
  // Only enabled on the "All" tab so sortOrder always reflects the full list.
  const persistOrder = async (ordered: ApiPortfolioItem[]) => {
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
      toast.error("Couldn't save the new order. Refreshing your portfolio.")
      if (artisanId) fetchItems(artisanId)
    }
  }

  const handleDrop = (targetId: number) => {
    if (draggedId === null || draggedId === targetId || activeFilter !== "ALL") {
      setDraggedId(null)
      return
    }
    const list = [...items]
    const fromIdx = list.findIndex((i) => i.id === draggedId)
    const toIdx = list.findIndex((i) => i.id === targetId)
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); return }
    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)
    setItems(list)
    setDraggedId(null)
    persistOrder(list)
  }

  const filterTabs: { key: typeof activeFilter; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: counts.total },
    { key: "APPROVED", label: "Published", count: counts.approved },
    { key: "PENDING", label: "Pending", count: counts.pending },
    { key: "REJECTED", label: "Rejected", count: counts.rejected },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
            <p className="text-sm text-muted-foreground">
              Showcase your work — all uploads require admin approval before going live
            </p>
          </div>
          <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) resetUploadForm() }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 sm:shrink-0" disabled={!artisanId}>
                <Plus className="mr-2 h-4 w-4" />
                Upload Work
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Portfolio Item</DialogTitle>
                <DialogDescription>
                  Add a photo or video of completed work. It will be reviewed before publishing.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <FileDropzone file={uploadFile} onFile={setUploadFile} />
                <div className="space-y-2">
                  <Label htmlFor="caption">Caption (optional)</Label>
                  <Input
                    id="caption"
                    placeholder="Briefly describe the work done"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Service Category *</Label>
                  <Select value={tag} onValueChange={setTag}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setUploadOpen(false)} disabled={isUploading}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleUpload} disabled={isUploading}>
                    {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit for Review
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Items", value: counts.total, color: "text-foreground" },
            { label: "Published", value: counts.approved, color: "text-primary" },
            { label: "Under Review", value: counts.pending, color: "text-muted-foreground" },
            { label: "Rejected", value: counts.rejected, color: "text-destructive" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("mt-0.5 text-2xl font-bold", color)}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
            {filterTabs.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  activeFilter === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                <span className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-xs",
                  activeFilter === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  {count}
                </span>
              </button>
            ))}
          </div>
          {activeFilter === "ALL" && items.length > 1 && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <GripVertical className="h-3.5 w-3.5" /> Drag items to reorder
            </p>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : loadError ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="mb-4 h-12 w-12 text-destructive/60" />
              <h3 className="font-semibold text-foreground">Couldn&apos;t load your portfolio</h3>
              <p className="mt-1 text-sm text-muted-foreground">Please refresh the page to try again.</p>
            </CardContent>
          </Card>
        ) : displayed.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <h3 className="font-semibold text-foreground">No {activeFilter !== "ALL" ? activeFilter.toLowerCase() : ""} items</h3>
              <p className="mt-1 text-sm text-muted-foreground">Upload photos and videos of your completed work.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((item) => {
              const cfg = statusConfig[item.status]
              const StatusIcon = cfg.icon
              const draggable = activeFilter === "ALL"
              return (
                <Card
                  key={item.id}
                  className={cn(
                    "group overflow-hidden transition-shadow hover:shadow-md",
                    draggedId === item.id && "opacity-50",
                  )}
                  draggable={draggable}
                  onDragStart={() => draggable && setDraggedId(item.id)}
                  onDragOver={(e) => draggable && e.preventDefault()}
                  onDrop={() => draggable && handleDrop(item.id)}
                >
                  <div className="relative h-44 bg-muted">
                    {isVideo(item) ? (
                      <video src={resolveMediaUrl(item.fileUrl)} className="h-full w-full object-cover" muted preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveMediaUrl(item.fileUrl)}
                        alt={item.caption || item.tag || "Portfolio item"}
                        className="h-full w-full object-cover"
                      />
                    )}
                    {item.status === "REJECTED" && (
                      <div className="absolute inset-0 bg-destructive/10" />
                    )}
                    {draggable && (
                      <div className="absolute left-2 top-2 flex h-6 w-6 cursor-grab items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className={cn("absolute top-2", draggable ? "left-9" : "left-2")}>
                      <Badge variant="outline" className={cn("text-xs", cfg.className)}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7"
                        onClick={() => setDeleteId(String(item.id))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <p className="truncate text-sm font-medium text-foreground">{item.caption || "Untitled"}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      {item.tag && <Badge variant="secondary" className="text-xs">{item.tag}</Badge>}
                      {isVideo(item) && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Video className="h-3 w-3" /> Video
                        </span>
                      )}
                    </div>
                    {item.status === "REJECTED" && (
                      <div className="mt-2 space-y-2">
                        {item.rejectionReason && (
                          <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                            <XCircle className="mr-1 inline h-3 w-3" />
                            {item.rejectionReason}
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-full gap-1.5 bg-transparent text-xs"
                          onClick={() => openResubmit(item)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Resubmit
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Portfolio Item</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the item from your portfolio. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PF7a: resubmit a rejected item — picks a new file, resets to PENDING */}
      <Dialog open={!!resubmitTarget} onOpenChange={(o) => { if (!o) { setResubmitTarget(null); setResubmitFile(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resubmit Portfolio Item</DialogTitle>
            <DialogDescription>
              Upload a new file to replace the rejected one. It will go back into the review queue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FileDropzone file={resubmitFile} onFile={setResubmitFile} label="Click to upload a replacement file" />
            <div className="space-y-2">
              <Label htmlFor="resubmit-caption">Caption (optional)</Label>
              <Textarea
                id="resubmit-caption"
                rows={2}
                value={resubmitCaption}
                onChange={(e) => setResubmitCaption(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Service Category</Label>
              <Select value={resubmitTag} onValueChange={setResubmitTag}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setResubmitTarget(null)} disabled={isResubmitting}>
                Cancel
              </Button>
              <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleResubmit} disabled={isResubmitting}>
                {isResubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resubmit for Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
