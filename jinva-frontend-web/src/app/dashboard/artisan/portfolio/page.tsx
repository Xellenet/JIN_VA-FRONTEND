"use client"

import { useState } from "react"
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
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface PortfolioItem {
  id: string
  caption: string
  tag: string
  status: "APPROVED" | "PENDING" | "REJECTED"
  fileType: "image" | "video"
  rejectionReason?: string
}

const mockItems: PortfolioItem[] = [
  { id: "1", caption: "Kitchen cabinet repair — clean finish", tag: "Carpentry", status: "APPROVED", fileType: "image" },
  { id: "2", caption: "Full bathroom plumbing install", tag: "Plumbing", status: "APPROVED", fileType: "image" },
  { id: "3", caption: "Electrical panel upgrade (200A)", tag: "Electrical", status: "PENDING", fileType: "image" },
  { id: "4", caption: "Roof repair after storm damage", tag: "Roofing", status: "REJECTED", fileType: "image", rejectionReason: "Image too blurry. Please re-upload a clearer photo." },
  { id: "5", caption: "Outdoor cedar fence installation", tag: "Carpentry", status: "APPROVED", fileType: "image" },
  { id: "6", caption: "AC unit installation walkthrough", tag: "HVAC", status: "PENDING", fileType: "video" },
]

const statusConfig = {
  APPROVED: { label: "Published", className: "bg-primary/10 text-primary border-primary/20", icon: CheckCircle },
  PENDING: { label: "Under Review", className: "bg-muted text-muted-foreground border-border", icon: Clock },
  REJECTED: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
}

const SERVICE_CATEGORIES = [
  "Plumbing", "Electrical", "Carpentry", "Painting", "Cleaning",
  "Roofing", "HVAC", "Landscaping", "Masonry", "General",
]

export default function ArtisanPortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>(mockItems)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [caption, setCaption] = useState("")
  const [tag, setTag] = useState("")
  const [description, setDescription] = useState("")
  const [activeFilter, setActiveFilter] = useState<"ALL" | "APPROVED" | "PENDING" | "REJECTED">("ALL")

  const counts = {
    total: items.length,
    approved: items.filter((i) => i.status === "APPROVED").length,
    pending: items.filter((i) => i.status === "PENDING").length,
    rejected: items.filter((i) => i.status === "REJECTED").length,
  }

  const displayed = activeFilter === "ALL" ? items : items.filter((i) => i.status === activeFilter)

  const handleUpload = () => {
    if (!caption.trim() || !tag) {
      toast.error("Please fill in the caption and category.")
      return
    }
    setItems((prev) => [
      { id: String(Date.now()), caption, tag, status: "PENDING", fileType: "image" },
      ...prev,
    ])
    setCaption("")
    setTag("")
    setDescription("")
    setUploadOpen(false)
    toast.success("Submitted for review — admin will approve within 24 hours.")
  }

  const handleDelete = () => {
    if (!deleteId) return
    setItems((prev) => prev.filter((i) => i.id !== deleteId))
    setDeleteId(null)
    toast.success("Portfolio item removed.")
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
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 sm:shrink-0">
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
                <div className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 transition-colors hover:bg-muted/50">
                  <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Click to upload</p>
                  <p className="text-xs text-muted-foreground">JPEG, PNG, MP4 · max 50MB</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caption">Caption *</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="desc">Additional details (optional)</Label>
                  <Textarea
                    id="desc"
                    placeholder="e.g. materials used, project duration..."
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setUploadOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleUpload}>
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

        {/* Grid */}
        {displayed.length === 0 ? (
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
              return (
                <Card key={item.id} className="group overflow-hidden transition-shadow hover:shadow-md">
                  <div className="relative h-44 bg-muted">
                    <div className="flex h-full items-center justify-center">
                      {item.fileType === "video"
                        ? <Video className="h-10 w-10 text-muted-foreground/40" />
                        : <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                      }
                    </div>
                    {item.status === "REJECTED" && (
                      <div className="absolute inset-0 bg-destructive/10" />
                    )}
                    <div className="absolute left-2 top-2">
                      <Badge variant="outline" className={cn("text-xs", cfg.className)}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="secondary" className="h-7 w-7">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <p className="truncate text-sm font-medium text-foreground">{item.caption}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">{item.tag}</Badge>
                      {item.fileType === "video" && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Video className="h-3 w-3" /> Video
                        </span>
                      )}
                    </div>
                    {item.status === "REJECTED" && item.rejectionReason && (
                      <p className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                        <XCircle className="mr-1 inline h-3 w-3" />
                        {item.rejectionReason}
                      </p>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
