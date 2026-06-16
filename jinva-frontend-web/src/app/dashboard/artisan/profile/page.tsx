"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Star,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Camera,
  Plus,
  Trash2,
  ImageIcon,
  Video,
  Eye,
  X,
  Calendar,
  Award,
  Upload,
  UserRound,
} from "lucide-react"
import { mockPortfolio } from "@/lib/data/mock-data"
import type { PortfolioItem } from "@/lib/types"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { naviiAvatar } from "@/lib/utils"

export default function ArtisanProfile() {
  const { user } = useAuth()
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(mockPortfolio)
  const [activeFilter, setActiveFilter] = useState("all")
  const [previewItem, setPreviewItem] = useState<PortfolioItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  if (!user) return null

  const categories = ["all", ...Array.from(new Set(portfolio.map((p) => p.category)))]
  const filtered = activeFilter === "all" ? portfolio : portfolio.filter((p) => p.category === activeFilter)

  const handleDelete = (id: string) => {
    setPortfolio((prev) => prev.filter((item) => item.id !== id))
    setDeleteConfirm(null)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Profile Hero */}
        <Card className="overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary to-primary/80" />
          <CardContent className="relative px-6 pb-6">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
              <div className="relative -mt-16">
                <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback><UserRound className="h-10 w-10" /></AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
                    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                      Available
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{user.specialization}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {user.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {user.phone}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Springfield, IL
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline">Edit Profile</Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Share Portfolio</Button>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl font-bold text-foreground">{user.rating ?? 0}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Avg. Rating</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">{user.jobsCompleted ?? 0}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Jobs Completed</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Award className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">{user.reviews}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Reviews</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">{portfolio.length}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Portfolio Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section */}
        <Tabs defaultValue="portfolio" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-none md:inline-flex">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    variant={activeFilter === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter(cat)}
                    className={
                      activeFilter === cat ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                    }
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Button>
                ))}
              </div>

              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Work
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Portfolio Item</DialogTitle>
                    <DialogDescription>Showcase your completed work to attract new clients.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="pf-title">Title</Label>
                      <Input id="pf-title" placeholder="e.g., Bathroom Renovation" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pf-category">Category</Label>
                      <Input id="pf-category" placeholder="e.g., Renovation, Repair, Installation" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pf-desc">Description</Label>
                      <Textarea id="pf-desc" placeholder="Describe the work you did..." rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label>Upload Media</Label>
                      <div className="flex items-center gap-3">
                        <label
                          htmlFor="pf-upload-img"
                          className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted flex-1 justify-center"
                        >
                          <Upload className="h-5 w-5" />
                          <span>Click to upload images or videos</span>
                          <input id="pf-upload-img" type="file" accept="image/*,video/*" className="hidden" multiple />
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Supports JPG, PNG, MP4. Max 10MB per file.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowAddDialog(false)}>
                      Add to Portfolio
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Portfolio Grid */}
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold text-foreground">No items yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your first portfolio item to showcase your work.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((item) => (
                  <Card key={item.id} className="group overflow-hidden">
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      <Image
                        src={item.image || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {item.type === "video" && (
                        <div className="absolute left-3 top-3">
                          <Badge className="bg-foreground/70 text-background">
                            <Video className="mr-1 h-3 w-3" />
                            Video
                          </Badge>
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-full"
                          onClick={() => setPreviewItem(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-full text-destructive hover:bg-destructive hover:text-white"
                          onClick={() => setDeleteConfirm(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-foreground">{item.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {item.category}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {item.date}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="font-semibold text-foreground">Personal Information</h3>
                </div>
                <CardContent className="p-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" defaultValue={user.name} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="email" className="pl-10" defaultValue={user.email} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="phone" className="pl-10" defaultValue={user.phone ?? ""} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialization">Specialization</Label>
                      <Input id="specialization" defaultValue={user.specialization ?? ""} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Textarea id="address" className="pl-10" defaultValue="123 Main St, Springfield, IL" rows={2} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="font-semibold text-foreground">Professional Details</h3>
                </div>
                <CardContent className="p-5">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        defaultValue="Experienced artisan with over 10 years in residential and commercial plumbing. Specializing in pipe installation, leak repairs, and bathroom renovations. Licensed and insured professional committed to quality workmanship."
                        rows={4}
                      />
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="experience">Years of Experience</Label>
                        <Input id="experience" type="number" defaultValue="10" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="license">License Number</Label>
                        <Input id="license" defaultValue="PLB-2015-0472" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="certs">Certifications</Label>
                      <Textarea
                        id="certs"
                        defaultValue="Master Artisan License, EPA Section 608 Certification, OSHA 10-Hour Safety Certification"
                        rows={3}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-end">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
            </div>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <div className="border-b border-border p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Client Reviews</h3>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-foreground">{user.rating ?? 0}</span>
                    <span className="text-sm text-muted-foreground">({(user.reviews ?? 0)} reviews)</span>
                  </div>
                </div>
              </div>
              <CardContent className="divide-y divide-border p-0">
                {[
                  {
                    name: "Devon Lane",
                    date: "Aug 18, 2025",
                    rating: 5,
                    comment: "Robert did an amazing job on our bathroom renovation. Professional, punctual, and the quality of work exceeded expectations. Highly recommended!",
                  },
                  {
                    name: "Kristin Watson",
                    date: "Jul 25, 2025",
                    rating: 5,
                    comment: "Quick response to our emergency leak. He arrived within an hour and fixed the issue efficiently. Fair pricing too.",
                  },
                  {
                    name: "Jacob Jones",
                    date: "Jul 10, 2025",
                    rating: 4,
                    comment: "Great pipe installation work. Clean worksite and thorough explanation of the work done. Would use his services again.",
                  },
                  {
                    name: "Wade Warren",
                    date: "Jun 20, 2025",
                    rating: 5,
                    comment: "Installed a tankless water heater for us. The installation was clean and he walked us through everything. Very knowledgeable.",
                  },
                  {
                    name: "Jane Cooper",
                    date: "Jun 5, 2025",
                    rating: 4,
                    comment: "Professional and skilled. Fixed our kitchen sink issue in no time. Slightly delayed on arrival but the work quality made up for it.",
                  },
                ].map((review, i) => (
                  <div key={i} className="p-5">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={naviiAvatar(review.name)} />
                        <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-foreground">{review.name}</h4>
                          <span className="text-xs text-muted-foreground">{review.date}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, si) => (
                            <Star
                              key={si}
                              className={`h-3.5 w-3.5 ${
                                si < review.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Lightbox Preview */}
        {previewItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4"
            onClick={() => setPreviewItem(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPreviewItem(null)
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of ${previewItem.title}`}
          >
            <div
              className="relative w-full max-w-3xl rounded-lg bg-background shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={() => {}}
              role="document"
            >
              <Button
                size="icon"
                variant="ghost"
                className="absolute -right-2 -top-2 z-10 h-8 w-8 rounded-full bg-background shadow-md"
                onClick={() => setPreviewItem(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="relative aspect-video overflow-hidden rounded-t-lg">
                <Image src={previewItem.image || "/placeholder.svg"} alt={previewItem.title} fill className="object-cover" />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-foreground">{previewItem.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{previewItem.description}</p>
                <div className="mt-3 flex items-center gap-3">
                  <Badge variant="secondary">{previewItem.category}</Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {previewItem.date}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Portfolio Item</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this item from your portfolio? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
